# WEB-BASED ACADEMIC INTELLIGENCE CHATBOT FOR GOVERNMENT ARTS AND SCIENCE COLLEGE, KANYAKUMARI

An AI-powered academic assistant and bilingual conversational platform designed for **Government Arts and Science College, Palkulam (GASCKK)**, affiliated with Manonmaniam Sundaranar University (MSU).

---

## 🌟 Key Features

- **Multilingual Support (Tamil & English):** Real-time conversational interface in Tamil (`ta-IN`) and English (`en-US`).
- **Live Voice Interaction:** Web Speech API integration with turn-based recognition and visual voice aura equalizers.
- **Retrieval-Augmented Generation (RAG):** Context-aware syllabus, university question bank, and academic rules retrieval powered by LangChain, ChromaDB, and Groq LPU (`openai/gpt-oss-120b`).
- **Student Profile Personalization (Mem0):** Episodic memory layer for remembering student department, year, and academic context.
- **Neural Text-to-Speech (gTTS):** Streaming audio responses directly via in-memory binary streams.
- **Academic Utilities:** Automated College Day Order calculator, Question Paper scanner, Faculty Directory, and Vibe Coding sandbox.

---

## 🏗️ System Architecture

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Lucide React
- **Backend:** FastAPI, Uvicorn (ASGI), Pydantic v2, Python 3.10+
- **AI / LLM:** LangChain, LangChain-Groq, Groq LPU Cloud
- **Vector DB & Embeddings:** ChromaDB, HuggingFace `sentence-transformers/all-MiniLM-L6-v2`
- **Memory Engine:** Mem0
- **Database:** SQLite 3

---

## 🚀 Getting Started

### 1. Backend Setup
```bash
# Install Python dependencies
pip install -r requirements.txt

# Run FastAPI backend server (Port 8000)
python -m uvicorn api_server:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Frontend Setup
```bash
# Navigate to frontend directory
cd frontend

# Install Node.js dependencies
npm install

# Run Next.js development server (Port 3000)
npm run dev
```

### 3. Quick Launch
Run `run_app.bat` or `start.py` to start both frontend and backend concurrently.

---

## 📄 License & Attribution
Developed for Government Arts and Science College, Kanyakumari (GASCKK) - Department of Computer Applications (BCA).
