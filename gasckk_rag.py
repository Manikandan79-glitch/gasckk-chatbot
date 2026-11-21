import os
import sys
import json
import pdfplumber
import re
import sqlite3
import itertools
from datetime import datetime
import requests
from bs4 import BeautifulSoup

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain_core.documents import Document
from langchain_core.tools import tool

# --- mem0 Persistent Memory Layer ---
try:
    from gasckk_memory import save_memory, recall_memories, get_all_memories, delete_all_memories
    MEMORY_ENABLED = True
    print("✅ GASCKK Memory Layer imported successfully.")
except Exception as _mem_import_err:
    MEMORY_ENABLED = False
    print(f"⚠️  Memory layer unavailable: {_mem_import_err}")
    def save_memory(email, utext, btext): pass
    def recall_memories(email, query, top_k=5): return ""
    def get_all_memories(email): return []
    def delete_all_memories(email): pass

# --- 1. API CONFIGURATION & RESILIENT CLIENTS ---
os.environ["USER_AGENT"] = "GASCKK-RAG-Bot"

# Groq API Configuration
# Using openai/gpt-oss-120b (huge 120B model with high limits & excellent coding/academic performance)
GROQ_KEY = "your_groq_api_key_here".strip()

groq_llm = None
try:
    groq_llm = ChatGroq(
        model_name="openai/gpt-oss-120b",
        groq_api_key=GROQ_KEY,
        temperature=0.2
    )
    print("✅ Groq Engine Initialized Successfully (openai/gpt-oss-120b).")
except Exception as e:
    print(f"⚠️ Groq Init Warning: {e}")

def _format_content(content) -> str:
    """Safely convert LLM response content to string to avoid DB and ReactMarkdown crashes."""
    res_str = ""
    if isinstance(content, str):
        res_str = content
    elif isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and "text" in item:
                parts.append(str(item["text"]))
            else:
                parts.append(str(item))
        res_str = "\n".join(parts)
    else:
        res_str = str(content)

    # Convert any raw <br> or <br/> tags to markdown linebreaks so ReactMarkdown renders correctly
    if "<br" in res_str.lower():
        res_str = re.sub(r'<br\s*/?>', '\n', res_str, flags=re.IGNORECASE)

    return res_str

# Gemini Configuration (Active gemini-2.5-flash)
GEMINI_KEYS = [
    "your_gemini_api_key_here".strip()
]
gemini_cycler = itertools.cycle(GEMINI_KEYS)

def get_next_gemini():
    try:
        key = next(gemini_cycler)
        return ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.2, api_key=key)
    except Exception:
        return None

gemini_llm = get_next_gemini()

# OpenRouter Configuration (Free DeepSeek V4 / Nex-AGI / Cohere Multi-Engine)
OPENROUTER_KEY = "your_openrouter_api_key_here-c1035068595c365ee8f5bc02e907fb748678c90978e58c1a232bb8e6531451ea".strip()

def call_openrouter(prompt_text: str) -> Optional[str]:
    """Call OpenRouter with active free models as resilient backup."""
    import requests
    headers = {
        "Authorization": f"Bearer {OPENROUTER_KEY}",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "GASCKK Academic AI"
    }
    for model_id in ["deepseek/deepseek-v4-flash-0731:free", "nex-agi/nex-n2.5-pro:free", "cohere/north-mini-code:free"]:
        try:
            payload = {
                "model": model_id,
                "messages": [{"role": "user", "content": prompt_text}],
                "temperature": 0.2
            }
            res = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload, timeout=25)
            if res.status_code == 200:
                data = res.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                if content:
                    return content
        except Exception as e:
            print(f"⚠️ OpenRouter model {model_id} warning: {e}")
    return None

# NVIDIA NIM Configuration (Multi-Key Dual Engine)
NVIDIA_KEYS = [
    "your_nvidia_api_key_here".strip(),
    "your_nvidia_api_key_here_egRn8OVeW6tWIg2c5jFVe5FpjPrtcpOLu3".strip()
]
nvidia_cycler = itertools.cycle(NVIDIA_KEYS)

def call_nvidia(prompt_text: str) -> Optional[str]:
    """Call NVIDIA NIM API with active Llama 3.2 Vision / Moonshot models."""
    import requests
    active_key = next(nvidia_cycler)
    headers = {
        "Authorization": f"Bearer {active_key}",
        "Content-Type": "application/json"
    }
    for model_id in ["meta/llama-3.2-11b-vision-instruct", "moonshotai/kimi-k3", "deepseek-ai/deepseek-v4-flash-0731"]:
        try:
            payload = {
                "model": model_id,
                "messages": [
                    {"role": "system", "content": "You are the official multilingual academic AI assistant for Government Arts and Science College Palkulam (GASCKK)."},
                    {"role": "user", "content": prompt_text}
                ],
                "temperature": 0.2,
                "max_tokens": 1024
            }
            res = requests.post("https://integrate.api.nvidia.com/v1/chat/completions", headers=headers, json=payload, timeout=25)
            if res.status_code == 200:
                data = res.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                if content:
                    return content
        except Exception as e:
            print(f"⚠️ NVIDIA model {model_id} warning: {e}")
    return None

# --- 2. SQLITE LOCAL DATABASE ---
DB_FILE = "gasckk_users_history.db"

def init_db():
    conn = sqlite3.connect(DB_FILE, timeout=15)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at TEXT
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS prompt_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            user_query TEXT NOT NULL,
            bot_response TEXT NOT NULL,
            timestamp TEXT
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS otp_codes (
            email TEXT PRIMARY KEY,
            code TEXT NOT NULL,
            expires_at TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

init_db()

def authenticate_or_register_user(email, password):
    try:
        conn = sqlite3.connect(DB_FILE, timeout=15)
        cursor = conn.cursor()
        cursor.execute("SELECT password FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()
        if row:
            conn.close()
            return row[0] == password
        else:
            now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            cursor.execute("INSERT INTO users (email, password, created_at) VALUES (?, ?, ?)", (email, password, now))
            conn.commit()
            conn.close()
            return True
    except Exception as e:
        print(f"DB Auth Error: {e}")
        return True

def is_user_registered(email: str) -> bool:
    try:
        conn = sqlite3.connect(DB_FILE, timeout=15)
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE lower(email) = ?", (email.strip().lower(),))
        row = cursor.fetchone()
        conn.close()
        return row is not None
    except Exception as e:
        print(f"DB User Check Error: {e}")
        return False

def save_otp_to_db(email: str, code: str, expiry_minutes: int = 10):
    try:
        from datetime import datetime, timedelta
        conn = sqlite3.connect(DB_FILE, timeout=15)
        cursor = conn.cursor()
        expires_at = (datetime.now() + timedelta(minutes=expiry_minutes)).strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("INSERT OR REPLACE INTO otp_codes (email, code, expires_at) VALUES (?, ?, ?)", (email, code, expires_at))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"OTP Save Error: {e}")

def verify_otp_in_db(email: str, code: str) -> bool:
    try:
        from datetime import datetime
        conn = sqlite3.connect(DB_FILE, timeout=15)
        cursor = conn.cursor()
        cursor.execute("SELECT code, expires_at FROM otp_codes WHERE email = ?", (email,))
        row = cursor.fetchone()
        
        if not row:
            conn.close()
            return False
            
        stored_code, expires_at = row
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        if stored_code == code and now <= expires_at:
            # Delete OTP after successful use
            cursor.execute("DELETE FROM otp_codes WHERE email = ?", (email,))
            
            # Ensure user exists in users table (passwordless accounts get a dummy password)
            cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
            if not cursor.fetchone():
                cursor.execute("INSERT INTO users (email, password, created_at) VALUES (?, ?, ?)", (email, "passwordless_oauth", now))
            
            conn.commit()
            conn.close()
            return True
            
        conn.close()
        return False
    except Exception as e:
        print(f"OTP Verify Error: {e}")
        return False

def save_prompt_to_db(email, query, response):
    try:
        conn = sqlite3.connect(DB_FILE, timeout=15)
        cursor = conn.cursor()
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("INSERT INTO prompt_history (email, user_query, bot_response, timestamp) VALUES (?, ?, ?, ?)",
                       (email, query, response, now))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"DB Save Error: {e}")

def get_user_prompt_history(email):
    try:
        conn = sqlite3.connect(DB_FILE, timeout=15)
        cursor = conn.cursor()
        cursor.execute("SELECT user_query, bot_response, timestamp FROM prompt_history WHERE email = ? ORDER BY id DESC", (email,))
        rows = cursor.fetchall()
        conn.close()
        return [{"q": r[0], "a": r[1], "time": r[2]} for r in rows]
    except Exception:
        return []

# --- 3. DAY ORDERS CALENDAR (ODD SEMESTER 2026-2027: JUNE TO OCTOBER) ---
DAY_ORDERS = {
    # ஜூன் 2026 (June 2026) - 11 working days (1-11)
    "2026-06-01": 0, "2026-06-02": 0, "2026-06-03": 0, "2026-06-04": 0, "2026-06-05": 0,
    "2026-06-06": 0, "2026-06-07": 0, "2026-06-08": 0, "2026-06-09": 0, "2026-06-10": 0,
    "2026-06-11": 0, "2026-06-12": 0, "2026-06-13": 0, "2026-06-14": 0,
    "2026-06-15": 1, "2026-06-16": 2, "2026-06-17": 3, "2026-06-18": 4, "2026-06-19": 5,
    "2026-06-20": 0, "2026-06-21": 0, "2026-06-22": 6, "2026-06-23": 1, "2026-06-24": 2,
    "2026-06-25": 3, "2026-06-26": 0, "2026-06-27": 0, "2026-06-28": 0, "2026-06-29": 4,
    "2026-06-30": 5,

    # ஜூலை 2026 (July 2026) - 23 working days (12-34)
    "2026-07-01": 6, "2026-07-02": 1, "2026-07-03": 2, "2026-07-04": 0, "2026-07-05": 0,
    "2026-07-06": 3, "2026-07-07": 4, "2026-07-08": 5, "2026-07-09": 6, "2026-07-10": 1,
    "2026-07-11": 0, "2026-07-12": 0, "2026-07-13": 2, "2026-07-14": 3, "2026-07-15": 4,
    "2026-07-16": 5, "2026-07-17": 6, "2026-07-18": 0, "2026-07-19": 0, "2026-07-20": 1,
    "2026-07-21": 2, "2026-07-22": 3, "2026-07-23": 4, "2026-07-24": 5, "2026-07-25": 0,
    "2026-07-26": 0, "2026-07-27": 6, "2026-07-28": 1, "2026-07-29": 2, "2026-07-30": 3,
    "2026-07-31": 4,

    # ஆகஸ்ட் 2026 (August 2026) - 17 working days (35-51)
    "2026-08-01": 0, "2026-08-02": 0, "2026-08-03": 5, "2026-08-04": 6, "2026-08-05": 1,
    "2026-08-06": 2, "2026-08-07": 3, "2026-08-08": 0, "2026-08-09": 0, "2026-08-10": 4,
    "2026-08-11": 5, "2026-08-12": 0, "2026-08-13": 6, "2026-08-14": 1, "2026-08-15": 0,
    "2026-08-16": 0, "2026-08-17": 2, "2026-08-18": 3, "2026-08-19": 4, "2026-08-20": 5,
    "2026-08-21": 6, "2026-08-22": 0, "2026-08-23": 0, "2026-08-24": 1, "2026-08-25": 2,
    "2026-08-26": 0, "2026-08-27": 0, "2026-08-28": 0, "2026-08-29": 0, "2026-08-30": 0,
    "2026-08-31": 3,

    # செப்டம்பர் 2026 (September 2026) - 20 working days (52-71)
    "2026-09-01": 4, "2026-09-02": 5, "2026-09-03": 6, "2026-09-04": 0, "2026-09-05": 0,
    "2026-09-06": 0, "2026-09-07": 1, "2026-09-08": 2, "2026-09-09": 3, "2026-09-10": 4,
    "2026-09-11": 5, "2026-09-12": 0, "2026-09-13": 0, "2026-09-14": 0, "2026-09-15": 6,
    "2026-09-16": 1, "2026-09-17": 2, "2026-09-18": 3, "2026-09-19": 0, "2026-09-20": 0,
    "2026-09-21": 4, "2026-09-22": 5, "2026-09-23": 6, "2026-09-24": 1, "2026-09-25": 2,
    "2026-09-26": 0, "2026-09-27": 0, "2026-09-28": 3, "2026-09-29": 4, "2026-09-30": 5,

    # அக்டோபர் 2026 (October 2026) - 19 working days (72-90)
    "2026-10-01": 6, "2026-10-02": 0, "2026-10-03": 0, "2026-10-04": 0, "2026-10-05": 1,
    "2026-10-06": 2, "2026-10-07": 3, "2026-10-08": 4, "2026-10-09": 5, "2026-10-10": 0,
    "2026-10-11": 0, "2026-10-12": 6, "2026-10-13": 1, "2026-10-14": 2, "2026-10-15": 3,
    "2026-10-16": 4, "2026-10-17": 0, "2026-10-18": 0, "2026-10-19": 0, "2026-10-20": 0,
    "2026-10-21": 5, "2026-10-22": 6, "2026-10-23": 1, "2026-10-24": 0, "2026-10-25": 0,
    "2026-10-26": 2, "2026-10-27": 3, "2026-10-28": 4, "2026-10-29": 5, "2026-10-30": 6,
    "2026-10-31": 0
}

# Cumulative Working Day Numbers (1 to 90)
WORKING_DAY_NUMBERS = {
    # June
    "2026-06-15": 1, "2026-06-16": 2, "2026-06-17": 3, "2026-06-18": 4, "2026-06-19": 5,
    "2026-06-22": 6, "2026-06-23": 7, "2026-06-24": 8, "2026-06-25": 9, "2026-06-29": 10, "2026-06-30": 11,
    # July
    "2026-07-01": 12, "2026-07-02": 13, "2026-07-03": 14, "2026-07-06": 15, "2026-07-07": 16,
    "2026-07-08": 17, "2026-07-09": 18, "2026-07-10": 19, "2026-07-13": 20, "2026-07-14": 21,
    "2026-07-15": 22, "2026-07-16": 23, "2026-07-17": 24, "2026-07-20": 25, "2026-07-21": 26,
    "2026-07-22": 27, "2026-07-23": 28, "2026-07-24": 29, "2026-07-27": 30, "2026-07-28": 31,
    "2026-07-29": 32, "2026-07-30": 33, "2026-07-31": 34,
    # August
    "2026-08-03": 35, "2026-08-04": 36, "2026-08-05": 37, "2026-08-06": 38, "2026-08-07": 39,
    "2026-08-10": 40, "2026-08-11": 41, "2026-08-13": 42, "2026-08-14": 43, "2026-08-17": 44,
    "2026-08-18": 45, "2026-08-19": 46, "2026-08-20": 47, "2026-08-21": 48, "2026-08-24": 49,
    "2026-08-25": 50, "2026-08-31": 51,
    # September
    "2026-09-01": 52, "2026-09-02": 53, "2026-09-03": 54, "2026-09-07": 55, "2026-09-08": 56,
    "2026-09-09": 57, "2026-09-10": 58, "2026-09-11": 59, "2026-09-15": 60, "2026-09-16": 61,
    "2026-09-17": 62, "2026-09-18": 63, "2026-09-21": 64, "2026-09-22": 65, "2026-09-23": 66,
    "2026-09-24": 67, "2026-09-25": 68, "2026-09-28": 69, "2026-09-29": 70, "2026-09-30": 71,
    # October
    "2026-10-01": 72, "2026-10-05": 73, "2026-10-06": 74, "2026-10-07": 75, "2026-10-08": 76,
    "2026-10-09": 77, "2026-10-12": 78, "2026-10-13": 79, "2026-10-14": 80, "2026-10-15": 81,
    "2026-10-16": 82, "2026-10-21": 83, "2026-10-22": 84, "2026-10-23": 85, "2026-10-26": 86,
    "2026-10-27": 87, "2026-10-28": 88, "2026-10-29": 89, "2026-10-30": 90
}

# Special College Events, Exam Dates & Holiday Descriptions
DAY_EVENTS = {
    "2026-06-15": {"ta": "முதல் பருவத் தொடக்கம்", "en": "Odd Semester Reopening / Classes Begin"},
    "2026-06-26": {"ta": "மொஹரம் பண்டிகை விடுமுறை", "en": "Muharram Holiday"},
    "2026-07-01": {"ta": "இளநிலை முதலாமாண்டு வகுப்புகள் தொடக்கம்", "en": "First Year UG Classes Begin"},
    "2026-07-27": {"ta": "முதல் அகமதிப்பீட்டுத் தேர்வு ஆரம்பம்", "en": "First Internal Assessment Exam Begins"},
    "2026-08-12": {"ta": "ஆடி அமாவாசை / உள்ளூர் விடுமுறை", "en": "Aadi Amavasai / Local Holiday"},
    "2026-08-15": {"ta": "சுதந்திர தினம் - விடுமுறை", "en": "Independence Day Holiday"},
    "2026-08-26": {"ta": "மிலாடி நபி / ஓணம் பண்டிகை - விடுமுறை", "en": "Milad-un-Nabi / Onam Holiday"},
    "2026-08-28": {"ta": "ஸ்ரீ நாராயணகுரு ஜெயந்தி விடுமுறை", "en": "Sree Narayana Guru Jayanthi Holiday"},
    "2026-09-04": {"ta": "கிருஷ்ண ஜெயந்தி விடுமுறை", "en": "Krishna Jayanthi Holiday"},
    "2026-09-07": {"ta": "இரண்டாம் அகமதிப்பீட்டுத் தேர்வு ஆரம்பம்", "en": "Second Internal Assessment Exam Begins"},
    "2026-09-14": {"ta": "விநாயகர் சதுர்த்தி - விடுமுறை", "en": "Vinayakar Chathurthi Holiday"},
    "2026-10-02": {"ta": "காந்தி ஜெயந்தி - விடுமுறை", "en": "Gandhi Jayanthi Holiday"},
    "2026-10-08": {"ta": "பல்கலை மாதிரித் தேர்வு ஆரம்பம்", "en": "University Model Exam Begins"},
    "2026-10-19": {"ta": "ஆயுத பூஜை - விடுமுறை", "en": "Ayutha Pooja Holiday"},
    "2026-10-20": {"ta": "விஜயதசமி - விடுமுறை", "en": "Vijayadasami Holiday"},
    "2026-10-30": {"ta": "கடைசிப் பணிநாள் (பணிநாள் 90)", "en": "Last Working Day of Semester (Day 90)"},
}

# --- 4. VECTOR DATABASE ---
CHROMA_DB_DIR = "./gasckk_db"
embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
vectorstore = Chroma(persist_directory=CHROMA_DB_DIR, embedding_function=embeddings)
retriever = vectorstore.as_retriever(search_kwargs={"k": 6})

# --- 5. DEPARTMENT KNOWLEDGE & SEARCH TOOLS ---
@tool
def search_vector_database(query: str) -> str:
    """Useful to search college syllabus, question papers, and general info."""
    try:
        matched_docs = retriever.invoke(query)
        if matched_docs:
            return "\n\n".join(doc.page_content for doc in matched_docs)
    except Exception:
        pass
    return "No relevant context found in Vector Store."

def parse_date_from_query(query: str) -> str | None:
    q = query.lower().strip()
    from datetime import datetime, timedelta
    
    # 1. Relative dates
    today = datetime.now()
    if any(w in q for w in ["today", "இன்று", "இன்றைய"]):
        today_str = today.strftime("%Y-%m-%d")
        if today_str in DAY_ORDERS:
            return today_str
        return today_str
    if any(w in q for w in ["tomorrow", "நாளை", "நாளைய"]):
        tomorrow = today + timedelta(days=1)
        return tomorrow.strftime("%Y-%m-%d")

    # 2. ISO format YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
    m_iso = re.search(r'(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})', q)
    if m_iso:
        y, m, d = int(m_iso.group(1)), int(m_iso.group(2)), int(m_iso.group(3))
        return f"{y:04d}-{m:02d}-{d:02d}"

    # 3. DD-MM-YYYY format
    m_dmy = re.search(r'(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})', q)
    if m_dmy:
        d, m, y = int(m_dmy.group(1)), int(m_dmy.group(2)), int(m_dmy.group(3))
        return f"{y:04d}-{m:02d}-{d:02d}"

    # 4. Month name formats: e.g. "15th June 2026", "June 15", "15 June", "ஜூன் 15"
    month_map = {
        "jan": 1, "january": 1,
        "feb": 2, "february": 2,
        "mar": 3, "march": 3,
        "apr": 4, "april": 4,
        "may": 5, "may": 5,
        "jun": 6, "june": 6, "ஜூன்": 6,
        "jul": 7, "july": 7, "ஜூலை": 7,
        "aug": 8, "august": 8, "ஆகஸ்ட்": 8,
        "sep": 9, "september": 9, "செப்டம்பர்": 9,
        "oct": 10, "october": 10, "அக்டோபர்": 10,
        "nov": 11, "november": 11, "நவம்பர்": 11,
        "dec": 12, "december": 12, "டிசம்பர்": 12,
    }
    month_pattern = r"(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|october|oct|november|nov|december|dec|ஜூன்|ஜூலை|ஆகஸ்ட்|செப்டம்பர்|அக்டோபர்|நவம்பர்|டிசம்பர்)"
    
    m_named1 = re.search(r'(\d{1,2})(?:st|nd|rd|th)?\s+' + month_pattern + r'(?:\s+(\d{4}))?', q)
    if m_named1:
        d = int(m_named1.group(1))
        m_name = m_named1.group(2)
        m = month_map.get(m_name, 6)
        y = int(m_named1.group(3)) if m_named1.group(3) else 2026
        return f"{y:04d}-{m:02d}-{d:02d}"

    m_named2 = re.search(month_pattern + r'\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*[,]?\s*(\d{4}))?', q)
    if m_named2:
        m_name = m_named2.group(1)
        d = int(m_named2.group(2))
        m = month_map.get(m_name, 6)
        y = int(m_named2.group(3)) if m_named2.group(3) else 2026
        return f"{y:04d}-{m:02d}-{d:02d}"

    return None

def get_month_day_orders_table(month: int, year: int = 2026, is_tamil: bool = False) -> str:
    from datetime import datetime
    month_names = {
        6: ("June", "ஜூன்"),
        7: ("July", "ஜூலை"),
        8: ("August", "ஆகஸ்ட்"),
        9: ("September", "செப்டம்பர்"),
        10: ("October", "அக்டோபர்")
    }
    en_m, ta_m = month_names.get(month, ("Month", "மாதம்"))
    
    prefix = f"{year}-{month:02d}"
    month_dates = {k: v for k, v in DAY_ORDERS.items() if k.startswith(prefix)}
    if not month_dates:
        return ""
    
    working_days = sum(1 for v in month_dates.values() if v > 0)
    holidays = sum(1 for v in month_dates.values() if v == 0)
    
    if is_tamil:
        res = f"### 📅 {ta_m} {year} - அரசு கலை மற்றும் அறிவியல் கல்லூரி (GASCKK) நாள் வரிசை அட்டவணை\n\n"
        res += f"| தேதி (Date) | கிழமை (Day) | நாள் வரிசை (Day Order) | பணிநாள் (Day No.) | குறிப்பு (Remarks) |\n"
        res += f"| :--- | :--- | :--- | :--- | :--- |\n"
    else:
        res = f"### 📅 {en_m} {year} - GASCKK Academic Day Order Calendar\n\n"
        res += f"| Date | Weekday | Day Order | Working Day | Remarks |\n"
        res += f"| :--- | :--- | :--- | :--- | :--- |\n"
        
    weekday_ta = {0: "திங்கள்", 1: "செவ்வாய்", 2: "புதன்", 3: "வியாழன்", 4: "வெள்ளி", 5: "சனி", 6: "ஞாயிறு"}
    weekday_en = {0: "Monday", 1: "Tuesday", 2: "Wednesday", 3: "Thursday", 4: "Friday", 5: "Saturday", 6: "Sunday"}
    
    for dt_str in sorted(month_dates.keys()):
        dt = datetime.strptime(dt_str, "%Y-%m-%d")
        w_idx = dt.weekday()
        w_str = weekday_ta[w_idx] if is_tamil else weekday_en[w_idx]
        order = month_dates[dt_str]
        event_info = DAY_EVENTS.get(dt_str, {})
        event_str = event_info.get("ta" if is_tamil else "en", "-")
        work_num = WORKING_DAY_NUMBERS.get(dt_str, "-")
        
        if order == 0:
            order_text = "-"
            status_text = f"🏖️ விடுமுறை" if is_tamil else "🏖️ Holiday"
            if event_str != "-":
                status_text += f" ({event_str})"
        else:
            order_text = f"Day Order {order}"
            status_text = event_str if event_str != "-" else ("வேலை நாள்" if is_tamil else "Working Day")
            
        res += f"| {dt_str} | {w_str} | **{order_text}** | {work_num} | {status_text} |\n"
        
    if is_tamil:
        res += f"\n📊 **சுருக்கம் ({ta_m} {year}):** இம்மாத பணி நாள்கள்: **{working_days}** | விடுமுறை நாட்கள்: **{holidays}**"
    else:
        res += f"\n📊 **Summary ({en_m} {year}):** Month Working Days: **{working_days}** | Holidays: **{holidays}**"
        
    return res

def format_day_order_response(formatted_date: str, is_tamil: bool) -> str:
    from datetime import datetime
    if formatted_date in DAY_ORDERS:
        order = DAY_ORDERS[formatted_date]
        dt = datetime.strptime(formatted_date, "%Y-%m-%d")
        weekday_ta = {0: "திங்கள்", 1: "செவ்வாய்", 2: "புதன்", 3: "வியாழன்", 4: "வெள்ளி", 5: "சனி", 6: "ஞாயிறு"}
        weekday_en = {0: "Monday", 1: "Tuesday", 2: "Wednesday", 3: "Thursday", 4: "Friday", 5: "Saturday", 6: "Sunday"}
        w_str = weekday_ta[dt.weekday()] if is_tamil else weekday_en[dt.weekday()]
        
        event_info = DAY_EVENTS.get(formatted_date, {})
        event_text = event_info.get("ta" if is_tamil else "en", "")
        working_num = WORKING_DAY_NUMBERS.get(formatted_date)
        
        if order == 0:
            holiday_reason = f" ({event_text})" if event_text else ""
            if is_tamil:
                return f"அரசு கலை மற்றும் அறிவியல் கல்லூரி (GASCKK) நாள்காட்டியின்படி, **{formatted_date}** ({w_str}) அன்று **கல்லூரி விடுமுறை (Holiday)** 🏖️ ஆகும்{holiday_reason}."
            else:
                return f"According to the GASCKK College Academic Calendar, **{formatted_date}** ({w_str}) is a **Holiday** 🏖️{holiday_reason}."
        else:
            work_day_str = f" [பணிநாள்: {working_num}/90]" if working_num and is_tamil else (f" [Working Day: {working_num}/90]" if working_num else "")
            note_str = f"\n📌 **குறிப்பு:** {event_text}" if event_text and is_tamil else (f"\n📌 **Note:** {event_text}" if event_text else "")
            if is_tamil:
                return f"அரசு கலை மற்றும் அறிவியல் கல்லூரி (GASCKK) நாள்காட்டியின்படி, **{formatted_date}** ({w_str}) அன்று **நாள் வரிசை {order} (Day Order {order})** 📅 ஆகும்.{work_day_str}{note_str}"
            else:
                return f"According to the GASCKK College Academic Calendar, the day order for **{formatted_date}** ({w_str}) is **Day Order {order}** 📅.{work_day_str}{note_str}"
    else:
        if is_tamil:
            return f"**{formatted_date}**-க்கான நாள் வரிசை நாள்காட்டியில் இல்லை (கல்லூரி நாள்காட்டி: ஜூன் 15, 2026 முதல் அக்டோபர் 31, 2026 வரை 90 பணிநாட்கள் செயலில் உள்ளது)."
        else:
            return f"Date **{formatted_date}** is not in the active calendar. Academic Calendar covers Odd Semester: June 15, 2026 to October 31, 2026 (90 Working Days)."

@tool
def check_college_day_order(date_query: str) -> str:
    """Useful to check the college day order or holiday for a date."""
    q_low = date_query.lower()
    is_ta = any('\u0b80' <= c <= '\u0bff' for c in date_query) or "ta" in date_query
    
    if "june" in q_low or "ஜூன்" in q_low:
        if any(w in q_low for w in ["all", "list", "table", "month", "schedule", "வரிசை", "வரிஜை", "அட்டவணை"]) or not re.search(r'\d{1,2}', q_low):
            table = get_month_day_orders_table(6, 2026, is_tamil=is_ta)
            if table: return table
    if "july" in q_low or "ஜூலை" in q_low:
        if any(w in q_low for w in ["all", "list", "table", "month", "schedule", "வரிசை", "வரிஜை", "அட்டவணை"]) or not re.search(r'\d{1,2}', q_low):
            table = get_month_day_orders_table(7, 2026, is_tamil=is_ta)
            if table: return table
    if "august" in q_low or "ஆகஸ்ட்" in q_low:
        if any(w in q_low for w in ["all", "list", "table", "month", "schedule", "வரிசை", "வரிஜை", "அட்டவணை"]) or not re.search(r'\d{1,2}', q_low):
            table = get_month_day_orders_table(8, 2026, is_tamil=is_ta)
            if table: return table
    if "september" in q_low or "செப்டம்பர்" in q_low or "sep" in q_low:
        if any(w in q_low for w in ["all", "list", "table", "month", "schedule", "வரிசை", "வரிஜை", "அட்டவணை"]) or not re.search(r'\d{1,2}', q_low):
            table = get_month_day_orders_table(9, 2026, is_tamil=is_ta)
            if table: return table
    if "october" in q_low or "அக்டோபர்" in q_low or "oct" in q_low:
        if any(w in q_low for w in ["all", "list", "table", "month", "schedule", "வரிசை", "வரிஜை", "அட்டவணை"]) or not re.search(r'\d{1,2}', q_low):
            table = get_month_day_orders_table(10, 2026, is_tamil=is_ta)
            if table: return table

    dt_str = parse_date_from_query(date_query)
    if dt_str:
        return format_day_order_response(dt_str, is_tamil=is_ta)
        
    return "Date not found in Day Order calendar (Calendar covers June 15, 2026 to October 31, 2026)."

# --- 5. DEPARTMENT, HOD & FACULTY KNOWLEDGE DIRECTORY ---
GASCKK_FACULTY_DIRECTORY = {
    "bca": {
        "dept_name": "Department of Computer Applications (BCA)",
        "dept_name_tamil": "கணினி பயன்பாட்டியல் துறை (BCA)",
        "established": 2012,
        "hod": "Mr. S. Pradeesh, Assistant Professor & Head (M.C.A., M.Phil.)",
        "hod_tamil": "திரு. எஸ். பிரதீஷ் (Mr. S. Pradeesh), உதவிப் பேராசிரியர் மற்றும் துறைத் தலைவர்",
        "faculty": [
            "Mr. S. Pradeesh - Assistant Professor & Head (M.C.A., M.Phil.)",
            "Dr. I. Vinurajan - Assistant Professor (M.Sc., M.Phil., Ph.D)",
            "Dr. T. J. Benedict Jose - Temporary Assistant Professor (M.Sc., M.Phil., Ph.D)",
            "Mrs. C. Meenakshi - Temporary Assistant Professor (MCA., M.Phil., SET)",
            "Dr. D. Sharmila - Temporary Assistant Professor (MCA., M.Phil., Ph.D)"
        ],
        "lab": "Modern air-conditioned Computer Laboratory with high-speed internet and PC workstations",
        "scope": "Software Engineering, Full-Stack Development, Data Analytics, Cloud Computing, System Administration",
        "syllabus": """OFFICIAL BCA (BACHELOR OF COMPUTER APPLICATIONS) SYLLABUS - MANONMANIAM SUNDARANAR UNIVERSITY (MSU / GASCKK):
- Semester I:
  1. Part-I: Language (Tamil / Malayalam)
  2. Part-II: General English
  3. Core Course 1 (CC1): Python Programming
  4. Core Course 2 (CC2): Python Programming Lab
  5. Elective Course 1 (EC1): Discrete Mathematics-I / Numerical Methods
  6. Skill Enhancement Course 1 (SEC1): Office Automation Lab
  7. Foundation Course (FC): Fundamentals of Information Technology
- Semester II:
  1. Part-I: Language (Tamil / Malayalam)
  2. Part-II: General English
  3. Core Course 3 (CC3): Object Oriented Programming Concepts using C++
  4. Core Course 4 (CC4): C++ Programming Lab
  5. Elective Course 2 (EC2): Digital Logic Fundamentals / Optimization Techniques
  6. Skill Enhancement Course 2 (SEC2): Web Designing
  7. Skill Enhancement Course 3 (SEC3): HTML Lab
  8. Naan Mudhalvan Course
- Semester III:
  1. Part-I: Language & Part-II: English
  2. Core Course 5 (CC5): Data Structures and Algorithms
  3. Core Course 6 (CC6): Data Structures and Algorithms using C++ Lab
  4. Elective Course 3 (EC3): Computer Architecture / Cyber Forensics
  5. Skill Enhancement Course (SEC4): PHP Programming Lab
  6. Environmental Studies (EVS)
  7. Naan Mudhalvan Course
- Semester IV:
  1. Part-I: Language & Part-II: English
  2. Core Course 7 (CC7): Java Programming
  3. Core Course 8 (CC8): Java Programming Lab
  4. Elective Course 4 (EC4): Financial Accounting / Cloud Computing
  5. Skill Enhancement Course (SEC5): Multimedia Systems Lab
  6. Value Education
  7. Naan Mudhalvan Course
- Semester V:
  1. Core Course 9 (CC9): ASP .NET Programming
  2. Core Course 10 (CC10): Operating Systems
  3. Core Course 11 (CC11): Software Project Management
  4. Core Course 12 (CC12): ASP .NET Programming Lab
  5. Core Course 13 (CC13): Mini Project
  6. Elective Course 5 (EC5): Artificial Intelligence / Machine Learning
  7. Internship / Industrial Training
  8. Naan Mudhalvan Course
- Semester VI:
  1. Core Course 14 (CC14): RDBMS with PL/SQL
  2. Core Course 15 (CC15): Computer Networks
  3. Core Course 16 (CC16): Image Processing
  4. Core Course 17 (CC17): PL/SQL (SQL) Lab
  5. Core Course 18 (CC18): Major Project with Viva-Voce
  6. Elective Course 6 (EC6): Introduction to Data Science / Robotics and Its Applications
  7. Extension Activity & Naan Mudhalvan Course"""
    },
    "tamil": {
        "dept_name": "Department of Tamil",
        "dept_name_tamil": "தமிழ்த்துறையியல் துறை (Tamil)",
        "established": 2012,
        "hod": "Dr. C. Amuthan, Associate Professor & Head (M.A., B.Ed., M.Phil., Ph.D)",
        "hod_tamil": "முனைவர் சி. அமுதன் (Dr. C. Amuthan), இணைப் பேராசிரியர் மற்றும் துறைத் தலைவர்",
        "faculty": [
            "Dr. C. Amuthan - Associate Professor & Head (M.A., B.Ed., M.Phil., Ph.D)",
            "Dr. Y. Burgmonds - Assistant Professor (M.A., NET., M.Phil., B.Ed., Ph.D)",
            "Dr. N. K. Hemlin Ida - Assistant Professor (M.A., M.Phil., B.Ed., Ph.D)",
            "Dr. S. Kavin - Temporary Assistant Professor (M.A., M.Phil., Ph.D)",
            "Dr. S. Sundar - Temporary Assistant Professor (M.A., M.Phil., Ph.D., NET)",
            "Dr. R. Santhi - Temporary Assistant Professor (M.A., M.Phil., Ph.D., NET)",
            "Dr. N. Bama - Temporary Assistant Professor (M.A., M.Phil., B.Ed., SET., Ph.D)"
        ],
        "scope": "Tamil Literature, Higher Education & Research, TNPSC / Civil Services, Media, Journalism, Content Writing"
    },
    "english": {
        "dept_name": "Department of English",
        "dept_name_tamil": "ஆங்கிலத்துறை (English)",
        "established": 2012,
        "hod": "Dr. K. Vaikunda Raja, Assistant Professor & Incharge (M.A., B.Ed., M.Phil., Ph.D)",
        "hod_tamil": "முனைவர் கே. வைகுண்ட ராஜா (Dr. K. Vaikunda Raja), உதவிப் பேராசிரியர் மற்றும் துறைப் பொறுப்பாளர்",
        "faculty": [
            "Dr. K. Vaikunda Raja - Temporary Assistant Professor & Incharge (M.A., B.Ed., M.Phil., Ph.D)",
            "Dr. B. Bexel - Temporary Assistant Professor (M.A., MA(Socio)., M.Phil., Ph.D)",
            "Dr. S. Johny - Temporary Assistant Professor (M.A., M.Phil., Ph.D., PGDELT)",
            "Dr. S. K. Jincy - Temporary Assistant Professor (M.A., B.Ed., SET., Ph.D., NET)",
            "Dr. Dialin J. Dev - Temporary Assistant Professor (M.A., M.Phil., Ph.D)",
            "Dr. F. A. Binu Josy - Temporary Assistant Professor (M.A., M.Phil., Ph.D)",
            "Dr. R. S. Suji - Guest Lecturer (M.A., M.Phil., Ph.D)",
            "Dr. V. Sumitha Binil - Guest Lecturer (MA., M.Phil., Ph.D., NET., SET.)"
        ],
        "scope": "Corporate Communication, English Teaching & Research, Content Strategy, Public Relations, Translation"
    },
    "physics": {
        "dept_name": "Department of Physics",
        "dept_name_tamil": "இயற்பியல் துறை / பிசிக்ஸ் துறை (Physics)",
        "established": 2017,
        "hod": "Dr. N. Angel Benseera, Associate Professor & HOD Incharge (M.Sc., M.Phil., Ph.D., M.Ed., PGDCA., SET., NET)",
        "hod_tamil": "முனைவர் என். ஏஞ்சல் பென்சீரா (Dr. N. Angel Benseera), இணைப் பேராசிரியர் மற்றும் துறைப் பொறுப்பாளர்",
        "faculty": [
            "Dr. N. Angel Benseera - Associate Professor & HOD Incharge",
            "Dr. G. Janita Christobel - Temporary Assistant Professor (M.Sc., B.Ed., Ph.D., PDF(UGC))",
            "Dr. M. Nagarajan - Temporary Assistant Professor (M.Sc., Ph.D)",
            "Dr. M. J. Jarald Brigit Gilda - Temporary Assistant Professor (M.Sc., M.Phil., Ph.D)",
            "Dr. S. Siva Bala Solanki - Temporary Assistant Professor (M.Sc., Ph.D)"
        ],
        "lab": "Comprehensive Physics practical labs equipped for Optics, Mechanics, Electromagnetism, Quantum Physics, and Electronics",
        "scope": "Scientific Research (ISRO, DRDO, BARC), Defense Laboratories, Electronics Industry, Higher Academics"
    },
    "chemistry": {
        "dept_name": "Department of Chemistry",
        "dept_name_tamil": "வேதியியல் துறை / கெமிஸ்ட்ரி துறை (Chemistry)",
        "established": 2017,
        "hod": "Dr. N. Manonmani, Associate Professor & Head (M.Sc., M.Phil., B.Ed., Ph.D)",
        "hod_tamil": "முனைவர் என். மனோன்மணி (Dr. N. Manonmani), இணைப் பேராசிரியர் மற்றும் துறைத் தலைவர்",
        "faculty": [
            "Dr. N. Manonmani - Associate Professor & Head (M.Sc., M.Phil., B.Ed., Ph.D)",
            "Dr. K. Muthuraja - Temporary Assistant Professor (M.Sc., Ph.D)",
            "Dr. K. Jemila Rose - Temporary Assistant Professor (M.Sc., M.Phil., Ph.D)",
            "Dr. Jaslin J Christopher - Temporary Assistant Professor (M.Sc., M.Phil., Ph.D)"
        ],
        "lab": "State-of-the-art Organic, Inorganic, and Physical Chemistry Practical Laboratories",
        "scope": "Pharmaceutical Industries, Chemical Analysis, Quality Control, Petrochemicals, Environmental Research"
    },
    "bba": {
        "dept_name": "Department of Business Administration (BBA)",
        "dept_name_tamil": "வணிக மேலாண்மைத் துறை (BBA)",
        "established": 2012,
        "hod": "Dr. P. R. Shini, Associate Professor & Head (MA., MBA., MTM., Ph.D.)",
        "hod_tamil": "முனைவர் பி. ஆர். ஷினி (Dr. P. R. Shini), இணைப் பேராசிரியர் மற்றும் துறைத் தலைவர்",
        "faculty": [
            "Dr. P. R. Shini - Associate Professor & Head (MA., MBA., MTM., Ph.D.)",
            "Dr. K. Saravanan - Assistant Professor (MBA., M.Phil., Ph.D., DLLA)",
            "Dr. T. Babu Rajendra Prasad - Temporary Assistant Professor (MBA., NET., M.Phil., Ph.D., M.Com(F&C)., M.Sc(Psy))",
            "Dr. D. Jenisha - Temporary Assistant Professor (MBM., MBA., M.Phil.(Mgt), NET., Ph.D)",
            "Dr. A. R. Sindhu - Temporary Assistant Professor (MBA., M.Phil., Ph.D., SET)"
        ],
        "scope": "Business Management, Marketing Management, HR Leadership, Financial Analysis, Entrepreneurship"
    },
    "bcom": {
        "dept_name": "Department of Commerce (B.Com & M.Com)",
        "dept_name_tamil": "வணிகவியல் துறை / காமர்ஸ் துறை (B.Com & M.Com)",
        "established": 2012,
        "hod": "Dr. D. Andrews Scott, Associate Professor & Head",
        "hod_tamil": "முனைவர் டி. ஆண்ட்ரூஸ் ஸ்காட் (Dr. D. Andrews Scott), இணைப் பேராசிரியர் மற்றும் துறைத் தலைவர்",
        "faculty": [
            "Dr. D. Andrews Scott - Associate Professor & Head",
            "Dr. S. Lakshmanan - Temporary Assistant Professor (M.Com., M.Phil., MBA., Ph.D)",
            "Dr. S. Premalatha - Temporary Assistant Professor (M.Com., M.Phil., MBA., Ph.D)",
            "Dr. A. Elango - Temporary Assistant Professor (M.Com., M.Phil., SET., Ph.D)",
            "Dr. A. Vijayalekshmi - Temporary Assistant Professor (M.Com., M.Phil., MBA., SET., Ph.D)",
            "Dr. N. Suthendran - Temporary Assistant Professor (M.Com., M.Phil., MBA., MCA., Ph.D)",
            "Dr. T. K. Suvitha - Temporary Assistant Professor (M.Com., M.Phil., MBA., NET., Ph.D)",
            "Dr. K. Jemila - Temporary Assistant Professor (M.Com., M.Phil., Ph.D)"
        ],
        "scope": "Chartered Accountancy (CA), Banking & Insurance, Auditing, Tax Consultancy, Corporate Accounting"
    },
    "maths": {
        "dept_name": "Department of Mathematics (B.Sc Mathematics)",
        "dept_name_tamil": "கணிதவியல் துறை / மேக்ஸ் துறை (Mathematics)",
        "established": 2012,
        "hod": "Dr. C. Rajeswari, Associate Professor & Head (M.Sc., M.Phil., Ph.D)",
        "hod_tamil": "முனைவர் சி. ராஜேஸ்வரி (Dr. C. Rajeswari), இணைப் பேராசிரியர் மற்றும் துறைத் தலைவர்",
        "faculty": [
            "Dr. C. Rajeswari - Associate Professor & Head (M.Sc., M.Phil., Ph.D)",
            "Dr. V. Pazhani - Associate Professor (M.Sc., M.Phil., Ph.D)",
            "Dr. N. Angel Benseera - Associate Professor (M.Sc., M.Phil., Ph.D)",
            "Dr. L. T. Saji - Temporary Assistant Professor (M.Sc., M.Phil., Ph.D)",
            "Dr. S. Santha Kumari - Temporary Assistant Professor (M.Sc., M.Phil., Ph.D., SET)",
            "Dr. V. Jebarani - Temporary Assistant Professor (M.Sc., M.Phil., Ph.D., SET)"
        ],
        "scope": "Data Science & Analytics, Actuarial Science, Statistics, Operations Research, Banking & Civil Services"
    }
}

def get_department_details(query_text: str) -> str:
    q = query_text.lower()

    # 1. Comprehensive English & Tamil synonyms for every department
    physics_keywords = [
        "physics", "physic", "இயற்பியல்", "பிசிக்ஸ்", "பிசிக்", "பௌதிகம்", "பௌதிக", "இயற்பியல்துறை"
    ]
    chem_keywords = [
        "chemistry", "chemist", "வேதியியல்", "கெமிஸ்ட்ரி", "கெமிஸ்டரி", "ரசாயனம்", "வேதியியல்துறை"
    ]
    maths_keywords = [
        "math", "maths", "mathematics", "கணிதம்", "மேக்ஸ்", "மேத்ஸ்", "மேத்தமேடிக்ஸ்", "கணிதவியல்", "கணிதத்துறை"
    ]
    bca_keywords = [
        "bca", "computer", "application", "applications", "பிசிஏ", "கணினி", "கம்ப்யூட்டர்", "கணிப்பொறி"
    ]
    commerce_keywords = [
        "commerce", "bcom", "b.com", "mcom", "m.com", "வணிகவியல்", "காமர்ஸ்", "வணிகம்", "வணிகத்துறை"
    ]
    bba_keywords = [
        "bba", "business", "administration", "மேலாண்மை", "பிபிஏ", "பி.பி.ஏ", "வணிக மேலாண்மை"
    ]
    tamil_keywords = [
        "tamil", "தமிழ்", "தமிழ்த்துறை", "தமிழ்மொழி"
    ]
    english_keywords = [
        "english", "ஆங்கிலம்", "ஆங்கில", "இங்கிலீஷ்", "ஆங்கிலத்துறை"
    ]

    matched_dept_key = None
    if any(k in q for k in physics_keywords):
        matched_dept_key = "physics"
    elif any(k in q for k in chem_keywords):
        matched_dept_key = "chemistry"
    elif any(k in q for k in maths_keywords):
        matched_dept_key = "maths"
    elif any(k in q for k in bca_keywords):
        matched_dept_key = "bca"
    elif any(k in q for k in commerce_keywords):
        matched_dept_key = "bcom"
    elif any(k in q for k in bba_keywords):
        matched_dept_key = "bba"
    elif any(k in q for k in tamil_keywords):
        matched_dept_key = "tamil"
    elif any(k in q for k in english_keywords):
        matched_dept_key = "english"

    if matched_dept_key and matched_dept_key in GASCKK_FACULTY_DIRECTORY:
        d = GASCKK_FACULTY_DIRECTORY[matched_dept_key]
        faculty_lines = "\n".join(f"  * {f}" for f in d["faculty"])
        res = (
            f"VERIFIED OFFICIAL DEPARTMENT & HOD DIRECTORY DATA (GASCKK PALKULAM):\n"
            f"- Department: {d['dept_name']} / {d.get('dept_name_tamil', '')}\n"
            f"- Established: {d['established']}\n"
            f"- Head of Department (HOD - English): {d['hod']}\n"
            f"- Head of Department (HOD - Tamil): {d.get('hod_tamil', d['hod'])}\n"
            f"- Faculty & Teaching Staff Members:\n{faculty_lines}\n"
        )
        if "lab" in d:
            res += f"- Lab Facilities: {d['lab']}\n"
        res += f"- Career Scope: {d['scope']}\n"
        if "syllabus" in d:
            res += f"\n{d['syllabus']}\n"
        return res

    # 2. Check for general / all departments, HODs, or staff query
    is_general_dept_query = any(k in q for k in [
        "hod", "head", "staff", "faculty", "department", "departments", 
        "பேராசிரியர்", "துறை", "துறைத் தலைவர்", "துறைகள்", "teachers", "staffs", 
        "ஹெச்ஓடி", "ஹச்ஓடி", "தலைவர்", "details", "detaills"
    ])
    
    if is_general_dept_query:
        lines = ["Official Directory of All 8 Departments, HODs & Faculty at GASCKK Palkulam:"]
        for key, d in GASCKK_FACULTY_DIRECTORY.items():
            faculty_names = ", ".join(f.split(" - ")[0] for f in d["faculty"])
            lines.append(
                f"\n📌 **{d['dept_name']}** ({d.get('dept_name_tamil', '')})\n"
                f"- **Head of Department (HOD)**: {d['hod']} / {d.get('hod_tamil', '')}\n"
                f"- **Faculty / Staff**: {faculty_names}"
            )
        return "\n".join(lines)

    return ""

# --- 5b. LOCAL QUESTION BANK CATALOG LOOKUP ---
CATALOG_PATH = os.path.join(os.path.dirname(__file__), "college_question_bank_catalog.json")
college_catalog = {}
if os.path.exists(CATALOG_PATH):
    try:
        with open(CATALOG_PATH, "r", encoding="utf-8") as f:
            college_catalog = json.load(f)
    except Exception as e:
        print(f"⚠️ Catalog load warning: {e}")

def find_college_question_papers(query_text: str, limit: int = 4) -> list:
    """Searches the local question bank catalog for matching question paper PDFs."""
    if not college_catalog:
        return []

    stop_words = {"give", "the", "for", "paper", "question", "pepar", "pdf", "available", "download", "what", "show", "tell", "need", "exam", "want", "this"}
    query_lower = query_text.lower()
    words = [w for w in re.findall(r'[a-zA-Z0-9]+', query_lower) if len(w) > 1 and w not in stop_words]

    if not words:
        return []

    scored_papers = []
    for dept, papers in college_catalog.items():
        dept_lower = dept.lower()
        for p in papers:
            subject_lower = p.get("subject", "").lower()
            year = str(p.get("year", "")).lower()
            sem = p.get("semester", "").lower()
            full_haystack = f"{dept_lower} {subject_lower} {year} {sem}"

            score = 0
            if len(words) >= 2 and " ".join(words[:2]) in full_haystack:
                score += 10
            for w in words:
                if w in subject_lower:
                    score += 4
                elif w in dept_lower:
                    score += 3
                elif w == year:
                    score += 3
                elif w in sem:
                    score += 2

            if score > 0:
                scored_papers.append((score, p))

    scored_papers.sort(key=lambda x: x[0], reverse=True)
    seen = set()
    unique_results = []
    for score, p in scored_papers:
        rel = p.get("rel_path")
        if rel and rel not in seen:
            seen.add(rel)
            unique_results.append(p)
            if len(unique_results) >= limit:
                break

    return unique_results

# --- 6. AGENTIC QUERY RUNNER ---
def run_agentic_flow(user_input, extra_context: str = "", memory_context: str = "", language: str = "ta-IN", chat_history_str: str = ""):
    lang_clean = (language or "ta-IN").lower()
    is_tamil = "ta" in lang_clean or "tamil" in lang_clean or any('\u0b80' <= c <= '\u0bff' for c in user_input)

    if is_tamil:
        lang_rule = """1. LANGUAGE REQUIREMENT — STRICT TAMIL (தமிழ்) (CRITICAL):
   - Active Selected Language: TAMIL (தமிழ்).
   - You MUST generate your ENTIRE response in natural, fluent, and comprehensive TAMIL (தமிழ்).
   - EVEN IF the user's prompt, question, or department name is in English (e.g. "Tell me about the BCA department courses, lab facilities, and scope", "BBA key subjects", "my details give"), you MUST answer completely in TAMIL.
   - You may include technical acronyms or course titles in English in parentheses for clarity (e.g. "கணினி பயன்பாட்டியல் துறை (Department of Computer Applications - BCA)", "ஆய்வக வசதிகள் (Lab Facilities)"), but ALL explanations, course descriptions, subjects, headings, and tables MUST be in TAMIL.
   - NEVER reply in pure English when the selected language is Tamil."""
    else:
        lang_rule = """1. LANGUAGE REQUIREMENT — ENGLISH:
   - Active Selected Language: ENGLISH.
   - Reply in clean, professional, academic ENGLISH. If the question is explicitly in Tamil script, you may provide bilingual assistance."""
    # 1. Day Order Check
    parsed_dt = parse_date_from_query(user_input)
    date_keywords = ["day", "order", "date", "holiday", "நாள்", "வரிசை", "வரிஜை", "விடுமுறை", "காலண்டர்", "calendar", "reopen", "கிழமை", "schedule", "work"]
    is_day_query = any(w in user_input.lower() for w in date_keywords) or "day order" in user_input.lower() or (parsed_dt is not None and parsed_dt in DAY_ORDERS)
    if is_day_query:
        q_l = user_input.lower()
        # Month overview table queries
        if any(m in q_l for m in ["june", "ஜூன்"]) and any(w in q_l for w in ["day", "order", "list", "table", "all", "மாத", "வரிசை", "வரிஜை", "அட்டவணை"]):
            return get_month_day_orders_table(6, 2026, is_tamil=is_tamil)
        if any(m in q_l for m in ["july", "ஜூலை"]) and any(w in q_l for w in ["day", "order", "list", "table", "all", "மாத", "வரிசை", "வரிஜை", "அட்டவணை"]):
            return get_month_day_orders_table(7, 2026, is_tamil=is_tamil)
        if any(m in q_l for m in ["august", "ஆகஸ்ட்"]) and any(w in q_l for w in ["day", "order", "list", "table", "all", "மாத", "வரிசை", "வரிஜை", "அட்டவணை"]):
            return get_month_day_orders_table(8, 2026, is_tamil=is_tamil)
        if any(m in q_l for m in ["september", "செப்டம்பர்", "sep"]) and any(w in q_l for w in ["day", "order", "list", "table", "all", "மாத", "வரிசை", "வரிஜை", "அட்டவணை"]):
            return get_month_day_orders_table(9, 2026, is_tamil=is_tamil)
        if any(m in q_l for m in ["october", "அக்டோபர்", "oct"]) and any(w in q_l for w in ["day", "order", "list", "table", "all", "மாத", "வரிசை", "வரிஜை", "அட்டவணை"]):
            return get_month_day_orders_table(10, 2026, is_tamil=is_tamil)

        if parsed_dt:
            return format_day_order_response(parsed_dt, is_tamil=is_tamil)
        elif any(w in q_l for w in ["reopen", "தொடங்கும்", "திறப்பு"]):
            return format_day_order_response("2026-06-15", is_tamil=is_tamil)

    # 2. Extract Context
    vector_res = search_vector_database.invoke(user_input)
    embedded_dept = get_department_details(user_input)

    if embedded_dept:
        vector_res = f"{embedded_dept}\n\n{vector_res}"
    if extra_context:
        vector_res = f"{extra_context}\n\n{vector_res}"
    # 3. Inject persistent user memory (from mem0) if available
    if memory_context:
        vector_res = f"{memory_context}\n\n{vector_res}"

    prompt = f"""You are the official multilingual Academic AI Assistant for Government Arts and Science College Palkulam (GASCKK), affiliated with Manonmaniam Sundaranar University (MSU).

SYSTEM INSTRUCTIONS:
{lang_rule}
2. QUESTION PAPERS (CRITICAL):
   - When the user asks for a "question paper", "exam paper", "question pepar", or questions for ANY department/subject:
   - If matching archived papers from college files are noted in the context, inform the user:
     "Original examination question paper found in the college archives (college_files/Question_bank). You can download the original PDF or formatted PDF using the download buttons below."
   - ALWAYS PROVIDE THE COMPLETE UNIVERSITY EXAMINATION QUESTIONS IN TEXT FORMAT following the MSU university pattern:
     * Header with Subject, Semester, Time: 3 Hours, Maximum Marks: 75
     * **PART A (10 × 2 = 20 Marks)**: 10 direct short answer questions.
     * **PART B (5 × 5 = 25 Marks)**: 5 conceptual / analytical questions.
     * **PART C (3 × 10 = 30 Marks)**: 3 detailed essay / derivation / programming questions.
3. VIBE CODING & APPLICATION GENERATION:
   - When the user asks to build, code, or create any web app, tool, game, algorithm, or script (e.g. "build a game", "create a calculator", "vibe code a website", "write Python code", "HTML/CSS"):
   - ALWAYS provide COMPLETE, BEAUTIFUL, PRODUCTION-READY, SINGLE-FILE code in standard markdown code blocks (e.g. ```html ... ``` or ```python ... ```).
   - Include modern CSS, interactive JavaScript, and clean responsive layout so students can run and preview it immediately.
4. PRESENTATION:
   - Use clear bold section headers and cleanly numbered questions or code explanations.
   - Base your answer on the context below and official academic syllabus knowledge.
   - NEVER output raw HTML tags like `<br>`, `<p>`, or `<div>`. Use pure Markdown line breaks or bulleted lists. In Markdown tables, put each subject/item on a separate row instead of using `<br>` inside a single table cell.
5. COLLEGE DEPARTMENTS, HOD & FACULTY INQUIRIES (CRITICAL):
   - You MUST ALWAYS state the official HOD name from the verified college directory:
     * Physics (இயற்பியல் / பிசிக்ஸ்): Dr. N. Angel Benseera (முனைவர் என். ஏஞ்சல் பென்சீரா)
     * Computer Applications / BCA (கணினி பயன்பாட்டியல் / பிசிஏ): Mr. S. Pradeesh (திரு. எஸ். பிரதீஷ்)
     * Tamil (தமிழ் / தமிழ்த்துறை): Dr. C. Amuthan (முனைவர் சி. அமுதன்)
     * English (ஆங்கிலம் / ஆங்கிலத்துறை): Dr. K. Vaikunda Raja (முனைவர் கே. வைகுண்ட ராஜா)
     * Chemistry (வேதியியல் / கெமிஸ்ட்ரி): Dr. N. Manonmani (முனைவர் என். மனோன்மணி)
     * Business Administration / BBA (வணிக மேலாண்மை / பிபிஏ): Dr. P. R. Shini (முனைவர் பி. ஆர். ஷினி)
     * Commerce / B.Com (வணிகவியல் / காமர்ஸ்): Dr. D. Andrews Scott (முனைவர் டி. ஆண்ட்ரூஸ் ஸ்காட்)
     * Mathematics (கணிதம் / மேக்ஸ்): Dr. C. Rajeswari (முனைவர் சி. ராஜேஸ்வரி)
   - NEVER SAY the HOD name is not available or not known. The official directory above contains the 100% verified names.
   - When asked in Tamil (e.g. "பிசிக்ஸ் துறை HOD யார்", "துறை தலைவர் யார்"), immediately state the HOD's name in Tamil and English (e.g. "இயற்பியல் (Physics) துறையின் தலைவர் முனைவர் என். ஏஞ்சல் பென்சீரா (Dr. N. Angel Benseera) ஆவார்.").
   - In Live Voice, speak concisely, directly, and naturally in 1-2 clear sentences.

6. STUDENT PROFILE & PERSONAL MEMORY (CRITICAL):
   - When the user asks about their own identity or details (e.g. "my details", "my details give", "who am I", "what is my name", "what is my department", "tell my details", "about me", "என் விவரங்கள்", "என் பெயர் என்ன", "நான் யார்") and 'STUDENT PERSONAL CONTEXT' is present in the context:
   - GREET the student warmly by name (e.g. "Hello Manikandan! / வணக்கம் மணிகண்டன்!").
   - IMMEDIATELY PRESENT all their stored details in a neat, professional bulleted list:
     * Name / பெயர்
     * Department / துறை
     * Year & Course / ஆண்டு & படிப்பு
     * College / கல்லூரி
     * Affiliated University / பல்கலைக்கழகம்
     * Email / மின்னஞ்சல்
     * Preferences / விருப்பங்கள்
   - NEVER ask clarifying questions when student details are asked and personal context is available.

Context:
{vector_res}

{f"Previous Conversation:\n{chat_history_str}\n" if chat_history_str.strip() else ""}Question: {user_input}
Answer:"""

    # 1. Primary LLM: Groq (openai/gpt-oss-120b)
    groq_err = None
    if groq_llm:
        try:
            res = groq_llm.invoke(prompt)
            return _format_content(res.content)
        except Exception as e:
            groq_err = str(e)
            print(f"❌ Groq Runtime Error: {groq_err}")

    # 2. Secondary LLM: NVIDIA NIM (meta/llama-3.2-11b-vision-instruct)
    try:
        nvidia_ans = call_nvidia(prompt)
        if nvidia_ans:
            return _format_content(nvidia_ans)
    except Exception as e_nv:
        print(f"❌ NVIDIA Runtime Error: {e_nv}")

    # 3. Tertiary LLM: OpenRouter (DeepSeek V4 / Nex-AGI Free)
    try:
        openrouter_ans = call_openrouter(prompt)
        if openrouter_ans:
            return _format_content(openrouter_ans)
    except Exception as e_or:
        print(f"❌ OpenRouter Runtime Error: {e_or}")

    # 4. Quaternary LLM: Gemini 2.5 Flash
    if gemini_llm:
        try:
            res = gemini_llm.invoke(prompt)
            return _format_content(res.content)
        except Exception as e_gem:
            gem_err = str(e_gem)
            print(f"❌ Gemini Runtime Error: {gem_err}")
            return f"⚠️ **Engine Error:**\n\n* **Groq:** `{groq_err}`\n* **Gemini:** `{gem_err}`"

    return f"⚠️ **Groq Error:** `{groq_err}`"

# --- 7. MAIN RAG QUERY HANDLER ---
def process_rag_query(user_email, user_input, chat_history_str, scanned_files_dict, language: str = "ta-IN"):
    matched_docs = []
    try:
        matched_docs = retriever.invoke(user_input)
    except Exception:
        pass

    # Lookup local question papers in college_files/Question_bank
    qb_matches = find_college_question_papers(user_input)
    extra_context = ""
    if qb_matches:
        extra_context = "EXACT MATCHING QUESTION PAPERS IN COLLEGE ARCHIVE (college_files/Question_bank):\n"
        for qp in qb_matches:
            extra_context += f"- {qp['subject']} ({qp.get('semester', '')}, {qp.get('year', '')}) | File: {qp['filename']} | Path: {qp['rel_path']}\n"
            # Insert document into matched_docs so api_server returns it in sources
            matched_docs.insert(0, Document(
                page_content=f"College Question Paper: {qp['subject']} ({qp['filename']})",
                metadata={"source": qp["rel_path"]}
            ))

    # --- Recall personal memories for this user (mem0) ---
    memory_context = ""
    try:
        memory_context = recall_memories(user_email, user_input, top_k=5)
    except Exception as mem_err:
        print(f"⚠️  Memory recall skipped: {mem_err}")

    answer = run_agentic_flow(user_input, extra_context=extra_context, memory_context=memory_context, language=language, chat_history_str=chat_history_str)
    save_prompt_to_db(user_email, user_input, answer)

    # --- If the response is a day order result, point sources directly to Academic Calendar ---
    if any(k in answer for k in ["Day Order", "நாள் வரிசை", "Holiday", "விடுமுறை", "நாள் வரிசை அட்டவணை"]):
        matched_docs = [Document(
            page_content="GASCKK College Academic Day Order Calendar (June - August 2026)",
            metadata={"source": "GASCKK Academic Calendar 2026-2027"}
        )]

    # --- Save this exchange as a new memory (async-safe: errors are swallowed) ---
    try:
        save_memory(user_email, user_input, answer)
    except Exception as mem_save_err:
        print(f"⚠️  Memory save skipped: {mem_save_err}")

    return answer, matched_docs

# --- 8. SYNC WEBSITE & PDF INGESTION ---
def sync_website_data():
    urls = [
        "https://www.gasckk.org.in/",
        "https://www.gasckk.org.in/bca.php",
        "https://www.gasckk.org.in/tamil.php",
        "https://www.gasckk.org.in/physics.php",
        "https://www.gasckk.org.in/chemistry.php",
        "https://www.gasckk.org.in/bba.php",
        "https://www.gasckk.org.in/english.php",
        "https://www.gasckk.org.in/bcom.php",
        "https://www.gasckk.org.in/maths.php",
        "https://www.gasckk.org.in/#rules"
    ]
    all_docs = []
    headers = {"User-Agent": "Mozilla/5.0"}
    for url in urls:
        try:
            r = requests.get(url, headers=headers, timeout=5)
            if r.status_code == 200:
                soup = BeautifulSoup(r.content, 'html.parser')
                for s in soup(["script", "style"]): 
                    s.extract()
                text = soup.get_text(separator="\n")
                clean = "\n".join(chunk for chunk in (line.strip() for line in text.splitlines()) if chunk)
                all_docs.append(Document(page_content=f"Source: {url}\n\n{clean}", metadata={"source": url}))
        except Exception:
            pass
    if all_docs:
        chunks = RecursiveCharacterTextSplitter(chunk_size=2500, chunk_overlap=300).split_documents(all_docs)
        vectorstore.add_documents(chunks)

def process_pdf_document(uploaded_file, scanned_files_registry):
    file_name = uploaded_file.name
    temp_path = os.path.join("./", file_name)
    with open(temp_path, "wb") as f:
        f.write(uploaded_file.getbuffer())
    try:
        extracted = ""
        with pdfplumber.open(temp_path) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t: 
                    extracted += t + "\n"
        if extracted.strip():
            chunks = RecursiveCharacterTextSplitter(chunk_size=2500, chunk_overlap=300).split_documents(
                [Document(page_content=extracted, metadata={"source": file_name})]
            )
            vectorstore.add_documents(chunks)
            return "text"
        return "empty"
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)