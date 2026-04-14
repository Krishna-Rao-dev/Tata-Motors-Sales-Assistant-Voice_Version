import io
import queue
import threading
import numpy as np
import soundfile as sf
import sounddevice as sd
import torch
import pyaudio
from faster_whisper import WhisperModel
from silero_vad import load_silero_vad, VADIterator
from kokoro import KPipeline

# ─── CONFIG ──────────────────────────────────────────────────────────────────
SAMPLE_RATE       = 16000
CHUNK_SIZE        = 512        # silero needs 512 @ 16kHz
SILENCE_THRESHOLD = 1.5        # seconds of silence = user done speaking
VOICE             = "bf_lily"  # kokoro voice
WHISPER_MODEL     = "base"     # tiny / base / small — base is good for local

stt_model = WhisperModel(
    WHISPER_MODEL,
    device="cuda",
    compute_type="float16"
)

# Silero VAD
vad_model = load_silero_vad()
vad_iterator = VADIterator(
    vad_model,
    sampling_rate=SAMPLE_RATE,
    threshold=0.5,            # speech confidence threshold
    min_silence_duration_ms=int(SILENCE_THRESHOLD * 1000)
)

tts_pipeline = KPipeline(lang_code='b')  # 'b' = British English (Lily is British)

def transcribe(audio_np: np.ndarray) -> str:
    buf = io.BytesIO()
    sf.write(buf, audio_np, SAMPLE_RATE, format='wav')
    buf.seek(0)
    segments, _ = stt_model.transcribe(buf, language="en")
    return " ".join(s.text for s in segments).strip()

stop_speaking = threading.Event()

def speak(text: str):
    global stop_speaking
    stop_speaking.clear()  # reset before speaking
    
    text = text.replace("*", "").replace("#", "").replace("`", "")
    
    for _, _, audio in tts_pipeline(text, voice=VOICE, speed=1.05, split_pattern=r'[.!?]\s+'):
        if stop_speaking.is_set():
            sd.stop()  # kill current playback
            print("🛑 Interrupted")
            return
        sd.play(audio, samplerate=24000)
        sd.wait()

class VADListener:
    def __init__(self, on_speech_end):
        self.on_speech_end = on_speech_end
        self.audio_buffer  = []
        self.is_speaking   = False
        self.running       = False

    def start(self):
        self.running = True
        threading.Thread(target=self._listen, daemon=True).start()
        print("🎙  Listening...")

    def stop(self):
        self.running = False

    def _listen(self):
        pa     = pyaudio.PyAudio()
        stream = pa.open(rate=SAMPLE_RATE, channels=1, format=pyaudio.paInt16,
                         input=True, frames_per_buffer=CHUNK_SIZE)
        try:
            while self.running:
                raw    = stream.read(CHUNK_SIZE, exception_on_overflow=False)
                chunk  = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
                result = vad_iterator(torch.from_numpy(chunk))

                if result:
                    if 'start' in result:
                        self.is_speaking  = True
                        self.audio_buffer = []
                        stop_speaking.set()  # ← ADD THIS
                        sd.stop()            # ← AND THIS
                        print("🗣  Speaking...")

                    if 'end' in result:
                        self.is_speaking = False
                        print("⏸  Processing...")
                        if self.audio_buffer:
                            audio_np = np.concatenate(self.audio_buffer)
                            threading.Thread(target=self.on_speech_end,
                                             args=(audio_np,), daemon=True).start()
                        self.audio_buffer = []
                        vad_iterator.reset_states()

                if self.is_speaking:
                    self.audio_buffer.append(chunk)
        finally:
            stream.stop_stream()
            stream.close()
            pa.terminate()
def on_speech_end(audio_np: np.ndarray):
    text = transcribe(audio_np)
    if not text:
        return
    print(f"👤 {text}")
    speak(f"You said: {text}")  # replace with LangGraph later
    print("🎙  Listening...")

if __name__ == "__main__":
    VADListener(on_speech_end).start()
    try:
        threading.Event().wait()
    except KeyboardInterrupt:
        print("\nDone.")