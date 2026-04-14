import io
import asyncio
import threading
import numpy as np
import soundfile as sf
import sounddevice as sd
import torch
import pyaudio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
from silero_vad import load_silero_vad, VADIterator
from kokoro import KPipeline
import nest_asyncio

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SAMPLE_RATE       = 16000
CHUNK_SIZE        = 512
SILENCE_THRESHOLD = 1.5
VOICE             = "bf_lily"
WHISPER_MODEL     = "base"

print("Loading models...")
stt_model = WhisperModel(
    WHISPER_MODEL,
    device="cuda",
    compute_type="float16"
)

vad_model = load_silero_vad()
tts_pipeline = KPipeline(lang_code='b')
print("Models loaded successfully.")

def transcribe(audio_np: np.ndarray) -> str:
    buf = io.BytesIO()
    sf.write(buf, audio_np, SAMPLE_RATE, format='wav')
    buf.seek(0)
    segments, _ = stt_model.transcribe(buf, language="en")
    return " ".join(s.text for s in segments).strip()

stop_speaking = threading.Event()
active_websockets = []
loop = None

def broadcast_status(status: str):
    # Safe broadcasting to connected WebSockets
    for ws in active_websockets:
        try:
            if loop and loop.is_running():
                asyncio.run_coroutine_threadsafe(
                    ws.send_json({"type": "status", "status": status}), loop
                )
        except Exception as e:
            print("Broadcast error:", e)

def speak(text: str):
    global stop_speaking
    stop_speaking.clear()
    
    text = text.replace("*", "").replace("#", "").replace("`", "")
    
    broadcast_status("speaking")
    print(f"Speaking: {text}")
    
    for _, _, audio in tts_pipeline(text, voice=VOICE, speed=1.05, split_pattern=r'[.!?]\s+'):
        if stop_speaking.is_set():
            sd.stop()
            print("Interrupted speaking")
            break
        sd.play(audio, samplerate=24000)
        sd.wait()
    
    broadcast_status("idle")

class VADListener:
    def __init__(self, on_speech_end):
        self.on_speech_end = on_speech_end
        self.audio_buffer  = []
        self.is_speaking   = False
        self.running       = False
        self.vad_iterator  = None

    def start(self):
        if self.running: return
        self.running = True
        self.vad_iterator = VADIterator(
            vad_model, 
            sampling_rate=SAMPLE_RATE, 
            threshold=0.5, 
            min_silence_duration_ms=int(SILENCE_THRESHOLD * 1000)
        )
        threading.Thread(target=self._listen, daemon=True).start()
        print("Listening started...")
        broadcast_status("idle")

    def stop(self):
        self.running = False
        broadcast_status("stopped")
        print("Listening stopped.")

    def _listen(self):
        pa = pyaudio.PyAudio()
        stream = pa.open(rate=SAMPLE_RATE, channels=1, format=pyaudio.paInt16,
                         input=True, frames_per_buffer=CHUNK_SIZE)
        try:
            while self.running:
                raw = stream.read(CHUNK_SIZE, exception_on_overflow=False)
                chunk = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
                result = self.vad_iterator(torch.from_numpy(chunk))

                if result:
                    if 'start' in result:
                        self.is_speaking = True
                        self.audio_buffer = []
                        stop_speaking.set()
                        sd.stop()
                        broadcast_status("listening")
                        print("User speaking...")

                    if 'end' in result:
                        self.is_speaking = False
                        broadcast_status("processing")
                        print("Processing audio...")
                        if self.audio_buffer:
                            audio_np = np.concatenate(self.audio_buffer)
                            threading.Thread(target=self.on_speech_end,
                                             args=(audio_np,), daemon=True).start()
                        self.audio_buffer = []
                        self.vad_iterator.reset_states()

                if self.is_speaking:
                    self.audio_buffer.append(chunk)
        except Exception as e:
            print("Audio stream error:", e)
        finally:
            stream.stop_stream()
            stream.close()
            pa.terminate()

def on_speech_end(audio_np: np.ndarray):
    text = transcribe(audio_np)
    if not text:
        broadcast_status("idle")
        return
    print(f"User said: {text}")
    speak(f"You said: {text}")

listener = VADListener(on_speech_end)

@app.on_event("startup")
async def startup_event():
    global loop
    loop = asyncio.get_running_loop()
    nest_asyncio.apply()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_websockets.append(websocket)
    try:
        await websocket.send_json({"type": "status", "status": "idle" if listener.running else "stopped"})
        
        while True:
            data = await websocket.receive_json()
            command = data.get("command")
            if command == "start":
                listener.start()
            elif command == "stop":
                listener.stop()
    except WebSocketDisconnect:
        active_websockets.remove(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
