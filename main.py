import io
import asyncio
import threading
import numpy as np
import soundfile as sf
import sounddevice as sd
import torch
import pyaudio
import os
import uuid
import json as jsonlib

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
from silero_vad import load_silero_vad, VADIterator
from kokoro import KPipeline
import nest_asyncio

from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import AIMessage, HumanMessage
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import MemorySaver
from langchain_community.embeddings import OllamaEmbeddings
from langchain_chroma import Chroma
from typing import TypedDict, Annotated, Optional
from pydantic import BaseModel

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Audio Config ─────────────────────────────────────────────────────────────
SAMPLE_RATE       = 16000
CHUNK_SIZE        = 512
SILENCE_THRESHOLD = 1.5
WHISPER_MODEL     = "base"

# ── Load Core Models ─────────────────────────────────────────────────────────
print("Loading models...")
stt_model = WhisperModel(WHISPER_MODEL, device="cuda", compute_type="float16")
vad_model = load_silero_vad()
tts_pipeline = KPipeline(lang_code='b')

# ── LLM Setup ────────────────────────────────────────────────────────────────
intent_llm = ChatGroq(model="openai/gpt-oss-120b", api_key=os.environ.get("GROQ_API_KEY"))
component_llm = ChatGroq(model="openai/gpt-oss-120b", api_key=os.environ.get("GROQ_API_KEY"))

# ── Embeddings & Vector DB ───────────────────────────────────────────────────
embeddings = OllamaEmbeddings(model="llama3.2:3b")
vectorDb = Chroma(
    persist_directory='./tata_motors_knowledge_base',
    embedding_function=embeddings
)
retriever = vectorDb.as_retriever()
print("All models loaded successfully.")

# ── Pydantic Models ──────────────────────────────────────────────────────────
class UserState(BaseModel):
    budget: Optional[int] = None
    family_size: Optional[int] = None
    fuel_preference: Optional[str] = None
    usage_pattern: Optional[str] = None
    location: Optional[str] = None
    needs_interruption: bool = False
    query_type: str = 'general'

class AgentOutput(BaseModel):
    text: str
    component: Optional[dict] = None
    follow_up: str | None

class GraphState(TypedDict):
    messages: Annotated[list, add_messages]
    user_state: UserState
    last_agent_output: Optional[AgentOutput]

# ── Component JSON Templates ─────────────────────────────────────────────────
comparison_table = """
For COMPARISON queries (Nexon vs Safari, Harrier vs Safari, etc.):
{{
  "text": "<brief natural summary of comparison  - if any numbers must be described in their numerical format and not in their word format>",
  "component": {{
    "required": true,
    "name": "comparison_table",
    "component_script": "<natural language summary of the contents of the table >",
    "content": {{
      "columns": [
        {{ "key": "feature", "label": "Feature" }},
        {{ "key": "car1", "label": "<Car 1 Name>" }},
        {{ "key": "car2", "label": "<Car 2 Name>" }}
      ],
      "rows": [
        {{ "feature": "<feature name>", "car1": "<value>", "car2": "<value>" }}
      ]
    }}
  }},
  "follow_up": "<question guiding towards purchase>"
}}
"""

car_card = """
For SINGLE CAR info queries:
{{
  "text": "<natural language summary >",
  "component": {{
    "required": true,
    "name": "car_card",
    "content": {{
      "model": "<exact car model name>"
    }}
  }},
  "follow_up": "<question guiding towards purchase>"
}}
"""

spec_table = """
For SPECIFICATION queries (one car's specs):
{{
  "text": "<natural language summary>",
  "component": {{
    "required": true,
    "name": "spec_table",
    "component_script": "<natural language summary of the contents of the table>",
    "content": {{
      "columns": [
        {{ "key": "feature", "label": "Feature" }},
        {{ "key": "value", "label": "Details" }}
      ],
      "rows": [
        {{ "feature": "<name>", "value": "<value>" }}
      ]
    }}
  }},
  "follow_up": "<question guiding towards purchase>"
}}
"""

general = """
For GENERAL queries (no component needed):
{{
  "text": "<natural language answer>",
  "component": {{
    "required": false,
    "name": null,
    "content": null
  }},
  "follow_up": "<question guiding towards purchase>"
}}
"""

show_calculation = """
FOR CALCULATION queries (e.g., EMI calculation):
{{
"text": "<brief natural language summary of calculation>",
"component":
{{
  "required": true,
  "name": "show_calculation",
  "component_script": "<natural language summary of the calculation steps and result IN THE MOST SIMPLE WORDS POSSIBLE>",
  "content": {{
    "title": "<name of the calculation>",
    "inputs": [
      {{
        "label": "<input name>",
        "value": "<input value>"
      }}
    ],
    "steps": [
      {{
        "step": "<calculation step description>",
        "result": "<intermediate result>"
      }}
    ],
    "result": {{
      "label": "<final output name>",
      "value": "<final value>"
    }}
  }}
}}
}}
"""

examples = """
*EXAMPLES TO LEARN FROM:**
Example - Comparison (Realistic):
Q: "I'm confused between Nexon and Safari. Which one should I go for if I have a family of 5?"
A: {{"text": "Nexon is a compact SUV (₹7-14L, 5 seats) while Safari is a full-size SUV (₹15-25L, 7 seats).", "component": {{"required": true, "name": "comparison_table", "component_script": "Nexon is a smaller 5-seater SUV with a lower price range, while Safari is a bigger 6 or 7-seater SUV with a higher price range.", "content": {{"columns": [{{"key": "feature", "label": "Feature"}}, {{"key": "car1", "label": "Tata Nexon"}}, {{"key": "car2", "label": "Tata Safari"}}], "rows": [{{"feature": "Seating", "car1": "5", "car2": "6 or 7"}}, {{"feature": "Price", "car1": "₹7-14L", "car2": "₹15-25L"}}]}}}}, "follow_up": "Do you need extra seating often or mainly city driving?"}}

Example - Single Car (Exploration):
Q: "I've been hearing a lot about the Tata Nexon lately. What makes it so popular?"
A: {{"text": "Tata Nexon is a compact SUV for young professionals with ₹7-14L budget and 5-star safety.", "component": {{"required": true, "name": "car_card", "content": {{"model": "Tata Nexon"}}}}, "follow_up": "Would you like to explore variants or compare with competitors?"}}

Example - Specification (Practical):
Q: "Can you tell me the key specifications of the Tata Punch? I want something for daily city use."
A: {{"text": "Tata Punch is a compact micro SUV designed for city driving with good ground clearance and efficiency.", "component": {{"required": true, "name": "spec_table", "component_script": "Tata Punch comes with a petrol engine, offers good mileage, and has high ground clearance suitable for city roads.", "content": {{"columns": [{{"key": "feature", "label": "Feature"}}, {{"key": "value", "label": "Details"}}], "rows": [{{"feature": "Engine", "value": "1.2L Petrol"}}, {{"feature": "Mileage", "value": "20 kmpl"}}, {{"feature": "Ground Clearance", "value": "187 mm"}}]}}}}, "follow_up": "Is your usage mostly city driving or occasional highway trips as well?"}}

Example - General (Decision):
Q: "I drive mostly in the city and occasionally on highways. What kind of car should I be looking at?"
A: {{"text": "For city driving with occasional highway use, compact SUVs like Nexon or Punch are great options as they offer comfort, mileage, and good ground clearance.", "component": {{"required": false, "name": null, "content": null}}, "follow_up": "What is your budget range so I can suggest the best option?"}}

Example - Comparison (Feature Focus):
Q: "Between Harrier and Safari, is there any real difference apart from seating?"
A: {{"text": "Harrier is a 5-seater while Safari offers 6 or 7 seats, with similar engine and features otherwise.", "component": {{"required": true, "name": "comparison_table", "component_script": "Both Harrier and Safari share similar engine and features, but Safari offers an extra row of seating compared to Harrier.", "content": {{"columns": [{{"key": "feature", "label": "Feature"}}, {{"key": "car1", "label": "Tata Harrier"}}, {{"key": "car2", "label": "Tata Safari"}}], "rows": [{{"feature": "Seating", "car1": "5", "car2": "6 or 7"}}, {{"feature": "Engine", "car1": "Same", "car2": "Same"}}, {{"feature": "3rd Row", "car1": "No", "car2": "Yes"}}]}}}}, "follow_up": "Do you actually need the third row regularly?"}}

Example - General (Early Stage):
Q: "I'm planning to buy a car in the next few months but haven't decided anything yet. Where should I start?"
A: {{"text": "A good starting point is deciding your budget, usage type, and how many people you usually travel with.", "component": {{"required": false, "name": null, "content": null}}, "follow_up": "What is your rough budget and primary usage?"}}
"""

calculation_examples = """
Example - EMI Calculation:
Q: "If I buy a car for ₹11.5 lakh and pay ₹2.5 lakh upfront, what will my EMI be for 5 years?"
A: {{"text": "Here's the EMI calculation based on your inputs:", "component": {{"required": true, "name": "show_calculation", "component_script": "The car price is 11 lakh 50 thousand. You pay 2 lakh 50 thousand upfront. The remaining loan is 9 lakh. At 9.5 percent interest for 5 years, the EMI is about 18 thousand 900 per month.", "content": {{"title": "Car EMI Calculation", "inputs": [{{"label": "On-road Price", "value": "₹11,50,000"}}, {{"label": "Down Payment", "value": "₹2,50,000"}}, {{"label": "Loan Amount", "value": "₹9,00,000"}}, {{"label": "Interest Rate", "value": "9.5%"}}, {{"label": "Tenure", "value": "60 months"}}], "steps": [{{"step": "Loan Amount = Price - Down Payment", "result": "₹9,00,000"}}, {{"step": "Monthly Interest Rate = 9.5 / 12", "result": "0.7917%"}}, {{"step": "EMI Calculation", "result": "₹18,900 per month"}}], "result": {{"label": "Monthly EMI", "value": "₹18,900"}}}}}}, "follow_up": "Do you want to check EMI for a different down payment?"}}

Example - On-road Cost:
Q: "If a car's ex-showroom price is ₹10.8 lakh, what would be the total on-road price?"
A: {{"text": "Here's the estimated on-road cost breakdown:", "component": {{"required": true, "name": "show_calculation", "component_script": "The ex-showroom price is 10 lakh 80 thousand. Road tax is about 3 percent, which is around 32 thousand. Insurance is about 40 thousand, and other charges are around 20 thousand. So the total on-road price comes to around 11 lakh 72 thousand.", "content": {{"title": "On-road Price Calculation", "inputs": [{{"label": "Ex-showroom Price", "value": "₹10,80,000"}}], "steps": [{{"step": "Road Tax (3%)", "result": "₹32,400"}}, {{"step": "Insurance", "result": "₹40,000"}}, {{"step": "Other Charges", "result": "₹20,000"}}], "result": {{"label": "Total On-road Price", "value": "₹11,72,400"}}}}}}, "follow_up": "Do you want EMI calculation on this on-road price?"}}

Example - Fuel Cost:
Q: "If I drive around 12,000 km every year, how much will I spend on fuel in 5 years for a petrol car?"
A: {{"text": "Here's the total fuel cost over 5 years:", "component": {{"required": true, "name": "show_calculation", "component_script": "You drive 12 thousand kilometers per year, so in 5 years that is 60 thousand kilometers. If mileage is 18 kilometers per liter, you need about 3333 liters of fuel. At 100 rupees per liter, the total cost becomes around 3 lakh 33 thousand.", "content": {{"title": "Fuel Cost Calculation (5 Years)", "inputs": [{{"label": "Annual Distance", "value": "12,000 km"}}, {{"label": "Mileage", "value": "18 km/l"}}, {{"label": "Fuel Price", "value": "₹100/l"}}, {{"label": "Duration", "value": "5 years"}}], "steps": [{{"step": "Total Distance in 5 years", "result": "60,000 km"}}, {{"step": "Fuel Required", "result": "3333 liters"}}, {{"step": "Total Fuel Cost", "result": "₹3,33,300"}}], "result": {{"label": "5-Year Fuel Cost", "value": "₹3,33,300"}}}}}}, "follow_up": "Do you want to compare this with diesel cost?"}}

Example - Loan Eligibility:
Q: "My monthly salary is ₹60,000. How much EMI can I comfortably afford?"
A: {{"text": "Here's your estimated EMI affordability:", "component": {{"required": true, "name": "show_calculation", "component_script": "Your monthly salary is 60 thousand. Ideally, EMI should be around 30 percent, which is 18 thousand. So you can comfortably afford an EMI of around 18 thousand per month.", "content": {{"title": "EMI Affordability", "inputs": [{{"label": "Monthly Salary", "value": "₹60,000"}}], "steps": [{{"step": "30% of Salary", "result": "₹18,000"}}, {{"step": "Recommended EMI Range", "result": "₹15,000 - ₹18,000"}}], "result": {{"label": "Affordable EMI", "value": "₹18,000"}}}}}}, "follow_up": "Do you want to see which cars fit this EMI?"}}

Example - Down Payment Impact:
Q: "If I increase my down payment from ₹2 lakh to ₹3 lakh, how much will my EMI reduce?"
A: {{"text": "Here's how your EMI changes with higher down payment:", "component": {{"required": true, "name": "show_calculation", "component_script": "With 2 lakh down payment, the loan is 9 lakh and EMI is about 18 thousand 900. With 3 lakh down payment, the loan reduces to 8 lakh and EMI becomes about 16 thousand 800. So your EMI reduces by around 2 thousand 100.", "content": {{"title": "Down Payment Impact", "inputs": [{{"label": "Car Price", "value": "₹11,00,000"}}, {{"label": "Old Down Payment", "value": "₹2,00,000"}}, {{"label": "New Down Payment", "value": "₹3,00,000"}}], "steps": [{{"step": "Old EMI (Loan ₹9L)", "result": "₹18,900"}}, {{"step": "New EMI (Loan ₹8L)", "result": "₹16,800"}}, {{"step": "EMI Reduction", "result": "₹2,100"}}], "result": {{"label": "EMI Difference", "value": "₹2,100 less"}}}}}}, "follow_up": "Do you want to optimize EMI further or keep more cash in hand?"}}

Example - Warranty Break-even:
Q: "If the extended warranty costs ₹30,000, is it actually worth taking over 5 years?"
A: {{"text": "Here's a break-even analysis for the extended warranty:", "component": {{"required": true, "name": "show_calculation", "component_script": "The warranty costs 30 thousand. Regular service over 5 years is around 50 thousand. If you face even one major repair costing 20 thousand or more, the warranty becomes useful. So if repair costs go above 30 thousand, you recover the warranty cost.", "content": {{"title": "Warranty Break-even Analysis", "inputs": [{{"label": "Warranty Cost", "value": "₹30,000"}}, {{"label": "5-Year Service Cost", "value": "₹50,000"}}, {{"label": "Possible Major Repair", "value": "₹20,000+"}}], "steps": [{{"step": "Total Warranty Cost", "result": "₹30,000"}}, {{"step": "Regular Service Cost (5 years)", "result": "₹50,000"}}, {{"step": "Break-even Point", "result": "Repair cost ≥ ₹30,000"}}], "result": {{"label": "Is Warranty Worth It?", "value": "Yes, if major repairs occur"}}}}}}, "follow_up": "How many kilometers do you usually drive per year?"}}
"""

# ── Agentic Graph Nodes ──────────────────────────────────────────────────────

def classify_user_intent(state: GraphState):
    messages = state['messages'][-1].content
    user_state = state['user_state']

    intent_prompt = ChatPromptTemplate.from_template("""
You are analyzing a user message in a Tata Motors car sales conversation.
User Message: {messages}
Current Profile: {user_state}

Your job is to update the user profile based ONLY on what is explicitly stated in the message.

Output ONLY a raw JSON object — no markdown, no ```json, no explanation.
First character must be {{ and last must be }}

{{
  "budget": <integer in rupees or null>,
  "family_size": <integer or null>,
  "fuel_preference": <"petrol" | "diesel" | "cng" | "electric" | null>,
  "usage_pattern": <"city" | "highway" | "mixed" | null>,
  "location": <city name as string or null>,
  "needs_interruption": <true if user wants Test Drive or Booking, else false>,
  "query_type": <"general" | "comparison_table" | "car_card" | "spec_table" | "show_calculation">
}}

Rules:
- Do NOT assume anything not explicitly stated. If unsure, keep existing value or null.
- needs_interruption → true only if user explicitly says "test drive", "booking", "interested in buying", "ready to buy", "want to purchase", etc.
- query_type rules:
  * "comparison_table" → comparing 2 or more cars: "Nexon vs Safari", "which is better Punch or Altroz"
  * "car_card"         → asking about one specific car:  "tell me about Harrier", "what about Safari"
  * "spec_table"       → specific specs of one car: "Nexon's mileage", "Safari boot space", "Harrier engine"
  * "show_calculation" → any calculation: "Calculate EMI", "on-road price", "trade in value"
  * "general"          → everything else: greetings, vague questions, recommendations, "which car should I buy", "best car for me","im poor ass which car to buy" etc.
""")

    chain = intent_prompt | intent_llm
    intent = chain.invoke({"messages": messages, "user_state": user_state}).content

    updated_state = UserState.model_validate_json(intent)
    return {"user_state": updated_state}


def build_history(messages):
    history = ""
    for message in messages:
        if isinstance(message, HumanMessage):
            history += f"User Said: {message.content}\n"
        else:
            history += f"{message.content}\n"
    return history


def retriever_and_component(state: GraphState):
    user_state = state['user_state']
    message = state['messages'][-1].content
    history = build_history(state['messages'])
    docs = retriever.invoke(message)
    context = '\n\n'.join(d.page_content for d in docs)
    if len(docs) == 0:
        context = ""

    # Select the right component template based on query_type
    component_map = {
        "comparison_table": comparison_table,
        "car_card": car_card,
        "spec_table": spec_table,
        "show_calculation": show_calculation,
        "general": general,
    }
    component_template = component_map.get(user_state.query_type, general)

    prompt = ChatPromptTemplate.from_template("""
        User Query: {message}                                     
        The user has the following profile: {user_state}  
        You have to answer from context IF AND ONLY IF it is NON-EMPTY, provided below \n: {context}     
        Else, use your own knowledge  to answer the query.
        Please also refer the past history to answer the query.                               
        You are an AI sales assistant working for TATA Motors\n

        Here are your CORE responsibilites as far tone is concerned must revolve around:\n                                                                       
        1. Selling cars,
        2. Neogiating - *NOT* *Related* to prices - You must negotiate like a real car dealer - YOU MUST SOMEHOW CONVINCE PERSON TO BUY THE CAR,
        3. Upselling opportunities,
        4. Help user showing :\n
        a. EMI options & offers by elaborating the calculations step-by-step 
        b. RTO Calculations - by elaborating the calculations step-by-step
        c. Trade-in value calculations - by elaborating the calculations step-by-step                                      
                                                                                    
        However, you have to Output only a JSON object,for various types of query:
        Component: {component}
        Here are some examples to learn from: {examples}
        For Calculation related queries, here are some more detailed examples to learn from: {calculation_examples}      
        Chat History : {history}
        ADDITIONAL TIPS:
        SEEM VERY CONVINCING YET NOT VERY PUSHY. BE REALLY VERY SOFT.
        WHEREVER NUMBERS ARE THERE. PLACE IT IN THE NUMERICAL FORM THAN JUST WORD FORMAT.
        RETURN ONLY A VALID JSON OBJECT ONLY, FOLLOW THE ABOVE FORMAT VERY STRICTLY, "NO" MARKDOWNS            
                                                                                                                                 
""")
    chain = prompt | component_llm
    response = chain.invoke({
        "message": message,
        "user_state": user_state,
        "context": context,
        "component": component_template,
        "examples": examples,
        "calculation_examples": calculation_examples,
        "history": history
    }).content

    updated_state = AgentOutput.model_validate_json(response)
    return {
        "last_agent_output": updated_state,
        "messages": [AIMessage(content=f"ASSISTANT SAID: {updated_state.text} | ASSISTANT ASKED: {updated_state.follow_up}  ")]
    }


# ── Build LangGraph ──────────────────────────────────────────────────────────
memory = MemorySaver()
workflow = StateGraph(GraphState)
workflow.add_node("intent_node", classify_user_intent)
workflow.add_node("retriever_component_node", retriever_and_component)
workflow.add_edge(START, "intent_node")
workflow.add_edge("intent_node", "retriever_component_node")
workflow.add_edge("retriever_component_node", END)
graph = workflow.compile(checkpointer=memory)


# ── Core Audio ───────────────────────────────────────────────────────────────
def transcribe(audio_np: np.ndarray) -> str:
    buf = io.BytesIO()
    sf.write(buf, audio_np, SAMPLE_RATE, format='wav')
    buf.seek(0)
    segments, _ = stt_model.transcribe(buf, language="en")
    return " ".join(s.text for s in segments).strip()


stop_speaking = threading.Event()
# tts_active: set while Kokoro is playing audio.
# Used to suppress audio BUFFERING (not VAD detection) during TTS so the
# speaker echo never reaches on_speech_end. VAD detection stays fully
# alive — barge-in / interrupt is preserved.
tts_active = threading.Event()
active_websockets = []
loop = None

# Per-session state storage
sessions = {}


def broadcast_status(status: str):
    """Safe broadcasting to connected WebSockets"""
    for ws in active_websockets:
        try:
            if loop and loop.is_running():
                asyncio.run_coroutine_threadsafe(
                    ws.send_json({"type": "status", "status": status}), loop
                )
        except Exception as e:
            print("Broadcast error:", e)


def broadcast_response(response_data: dict):
    """Send structured agentic response to all connected clients"""
    for ws in active_websockets:
        try:
            if loop and loop.is_running():
                asyncio.run_coroutine_threadsafe(
                    ws.send_json({"type": "response", **response_data}), loop
                )
        except Exception as e:
            print("Broadcast response error:", e)


def speak(text: str, voice: str):
    """TTS with interrupt support — speaks through the Kokoro pipeline.

    tts_active is set for the whole duration so _listen() does NOT buffer
    mic input while the speaker is playing (kills the TTS echo loop).
    VAD detection itself is untouched — barge-in still interrupts TTS.
    """
    global stop_speaking
    stop_speaking.clear()
    tts_active.set()   # suppress audio buffering in _listen()

    text = text.replace("*", "").replace("#", "").replace("`", "")

    broadcast_status("speaking")
    print(f"Speaking: {text[:100]}...")

    for _, _, audio in tts_pipeline(text, voice=voice, speed=1.05, split_pattern=r'[.!?]\s+'):
        if stop_speaking.is_set():
            sd.stop()
            print("Interrupted speaking")
            break
        sd.play(audio, samplerate=24000)
        sd.wait()

    tts_active.clear()   # re-enable audio buffering

    # Brief settle so residual mic ring after speaker stops doesn't trigger
    # a spurious VAD 'start'. Then reset VAD state cleanly.
    import time
    time.sleep(0.35)
    if listener.vad_iterator is not None:
        try:
            listener.vad_iterator.reset_states()
        except Exception:
            pass
    listener.audio_buffer = []
    listener.is_speaking   = False

    broadcast_status("idle")


# ── Speech Processing with Agentic Flow ──────────────────────────────────────
def on_speech_end(audio_np: np.ndarray, session_id: str):
    text = transcribe(audio_np)
    if not text:
        broadcast_status("idle")
        return

    print(f"User said: {text}")

    session = sessions.get(session_id, {})
    voice = session.get("voice", "bf_lily")
    thread_id = session.get("thread_id", session_id)

    # Run agentic flow
    config = {"configurable": {"thread_id": thread_id}}
    state: GraphState = {
        "messages": [text],
        "user_state": session.get("user_state", UserState()),
        "last_agent_output": None
    }

    try:
        response = graph.invoke(state, config=config)
        agent_output = response["last_agent_output"]
        updated_user_state = response["user_state"]

        # Persist updated user state back to the session
        sessions[session_id]["user_state"] = updated_user_state

        # Send structured response to frontend for UI rendering
        response_data = {
            "text": agent_output.text,
            "component": agent_output.component,
            "follow_up": agent_output.follow_up,
            "user_said": text
        }
        broadcast_response(response_data)

        # Build speech: text → component_script (if present) → follow_up
        speak_parts = [agent_output.text]
        if agent_output.component and agent_output.component.get("component_script"):
            speak_parts.append(agent_output.component["component_script"])
        if agent_output.follow_up:
            speak_parts.append(agent_output.follow_up)

        full_speech = ". ".join(speak_parts)
        speak(full_speech, voice)

    except Exception as e:
        print(f"Agentic flow error: {e}")
        import traceback
        traceback.print_exc()
        broadcast_response({
            "text": "I'm sorry, I encountered an issue processing your request. Could you try again?",
            "component": None,
            "follow_up": None,
            "user_said": text
        })
        speak("I'm sorry, I encountered an issue processing your request. Could you try again?", voice)


# ── VAD Listener ─────────────────────────────────────────────────────────────
class VADListener:
    def __init__(self, on_speech_end):
        self.on_speech_end = on_speech_end
        self.audio_buffer  = []
        self.is_speaking   = False
        self.running       = False
        self.vad_iterator  = None
        self.session_id    = None

    def start(self, session_id):
        if self.running: return
        self.session_id = session_id
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
                            threading.Thread(
                                target=self.on_speech_end,
                                args=(audio_np, self.session_id),
                                daemon=True
                            ).start()
                        self.audio_buffer = []
                        self.vad_iterator.reset_states()

                # Only buffer if TTS is NOT playing.
                # This prevents the speaker echo from being queued as
                # user speech. VAD detection above is untouched so barge-in
                # (VAD 'start' → stop_speaking.set()) still works perfectly.
                if self.is_speaking and not tts_active.is_set():
                    self.audio_buffer.append(chunk)
        except Exception as e:
            print("Audio stream error:", e)
        finally:
            stream.stop_stream()
            stream.close()
            pa.terminate()


listener = VADListener(on_speech_end)


# ── FastAPI Events & WebSocket ───────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    global loop
    loop = asyncio.get_running_loop()
    nest_asyncio.apply()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_websockets.append(websocket)
    session_id = str(uuid.uuid4())

    try:
        await websocket.send_json({
            "type": "init",
            "status": "idle" if listener.running else "stopped",
            "session_id": session_id
        })

        while True:
            data = await websocket.receive_json()
            command = data.get("command")

            if command == "start":
                # Voice name is fetched from localStorage on the frontend
                # and sent here as part of the start command
                voice = data.get("voice", "bf_lily")
                sessions[session_id] = {
                    "voice": voice,
                    "thread_id": session_id,
                    "user_state": UserState()
                }
                print(f"Session {session_id[:8]}... started with voice: {voice}")
                listener.start(session_id)

            elif command == "stop":
                listener.stop()

    except WebSocketDisconnect:
        if websocket in active_websockets:
            active_websockets.remove(websocket)
        sessions.pop(session_id, None)
        print(f"Session {session_id[:8]}... disconnected")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
