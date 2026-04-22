# Agentic Voice Mode with Generative UI

## 🌟 Introduction
Traditional voice assistants are often limited by their linear, audio-only feedback loop. This project introduces a **Multi-Modal Agentic Voice Assistant** designed for high-stakes sales environments (demonstrated with Tata Motors). 

It doesn't just talk; it **thinks, listens, and builds**. By combining high-speed voice processing with **Generative UI**, the assistant dynamically renders interface components (tables, cards, calculators) in real-time as the conversation evolves.

## ✨ Features
- **High-Speed Barge-In (Executive Interruption):** Interruption handling powered by Silero VAD. The AI stops instantly the moment you speak.
- **Generative UI:** Real-time rendering of React components based on conversational intent.
- **Agentic Orchestration:** Uses LangGraph to manage complex states like comparison, spec-checking, and financial calculations.
- **Multi-Persona Voices:** Switch between distinct AI personalities (Adam, Jessica, Sarah) with human-like prosody.
- **Live Calculation Engine:** On-the-fly breakdown of EMIs, On-road prices, and fuel costs with step-by-step visual proofs.
- **Knowledge-Backed (RAG):** Grounded in a vector database containing specific technical data for Tata Motors' car lineup.

## 📊 JSON Schema (The Generative UI Contract)
The system operates on a structured contract between the LLM and the Frontend. Depending on the `query_type`, the AI generates a JSON payload to trigger specific UI components.

### Example: Comparison Table
```json
{
  "text": "The Nexon is a compact SUV while the Safari is a full-size seven-seater.",
  "component": {
    "required": true,
    "name": "comparison_table",
    "content": {
      "columns": [
        { "key": "feature", "label": "Feature" },
        { "key": "car1", "label": "Tata Nexon" },
        { "key": "car2", "label": "Tata Safari" }
      ],
      "rows": [
        { "feature": "Seating", "car1": "5", "car2": "7" },
        { "feature": "Price", "car1": "₹8-15 Lakh", "car2": "₹16-27 Lakh" }
      ]
    }
  },
  "follow_up": "Would you like to see the safety ratings for both?"
}
```

## 🧠 Concepts Used
- **Agentic RAG:** An autonomous agent that decides when to retrieve information and how to present it (verbally vs. visually).
- **Executive Interruption:** Using VAD (Voice Activity Detection) to allow natural "barge-in" without the lag typical of older STT systems.
- **Stateful Conversations:** Managing the history of user preferences (budget, seating needs) across multiple conversational turns using `LangGraph`.
- **WebSocket Synchronization:** Bidirectional streaming of audio data and UI state updates for a unified experience.

## 🏗️ System Architecture
The system is built on a high-concurrency, low-latency stack:

1.  **Frontend (React/Next.js):** Handles audio capture and renders dynamic `TableComponents`.
2.  **WebSocket Server (FastAPI):** Orchestrates the data flow between the mic and the AI logic.
3.  **STT (Faster Whisper):** Transcribes user speech with high accuracy even in noisy environments.
4.  **VAD (Silero):** Monitors the audio stream for human speech to enable instant interruption.
5.  **Agentic Brain (LangGraph + Groq):** Llama-3-70B on Groq LPUs handles logic with sub-100ms inference.
6.  **TTS (Kokoro):** Generates high-fidelity, expressive audio chunks.

## 🚀 Impact
- **Decision Confidence:** Users can *see* the data while hearing the explanation, reducing the cognitive load of remembering complex specs.
- **Sales Transparency:** Step-by-step calculation tables for EMIs remove "black-box" pricing and build immediate trust.
- **Scalability:** Enables dealerships to provide 24/7 high-quality, data-driven consultations without increasing headcount.
- **Reduced TAT:** Complex comparisons that would take minutes to find manually are generated in milliseconds through natural speech.

## 🏁 Conclusion
This project demonstrates that the future of UI is not just "Voice" or "Web," but a **Hybrid Agentic Experience**. By making the UI an extension of the conversation, we move from passive information retrieval to active, multi-modal assistance.


Here are some snapshots of the application:
<img width="1916" height="1016" alt="Screenshot 2026-04-19 224308" src="https://github.com/user-attachments/assets/4d77030c-bbe8-42d4-8576-b9387bbae6b7" />
<br/>
<img width="1300" height="920" alt="image" src="https://github.com/user-attachments/assets/07160026-1539-4d16-89f3-43c003ee338d" />

<br/>
---
*Built with ❤️ using LangGraph, FastAPI, and React.*
