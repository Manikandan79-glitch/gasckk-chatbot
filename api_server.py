import os
import io
import sys

# Ensure UTF-8 encoding on Windows to support emojis and Tamil characters without UnicodeEncodeError
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass
from typing import Optional, List
import re
import gtts
from fastapi import FastAPI, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from gasckk_rag import (
    process_rag_query,
    authenticate_or_register_user,
    is_user_registered,
    save_otp_to_db,
    verify_otp_in_db,
    get_user_prompt_history,
    sync_website_data,
    process_pdf_document,
    check_college_day_order,
    GASCKK_FACULTY_DIRECTORY
)

# Memory layer (graceful fallback if not available)
try:
    from gasckk_memory import get_all_memories, delete_all_memories, delete_single_memory, add_direct_memory
    _MEMORY_API_ENABLED = True
except Exception:
    _MEMORY_API_ENABLED = False
    def get_all_memories(email): return []
    def delete_all_memories(email): pass
    def delete_single_memory(memory_id): return False
    def add_direct_memory(email, text): return False

app = FastAPI(
    title="GASCKK Academic AI API",
    description="Backend API powering the Next.js Multilingual Academic Assistant",
    version="1.0.0"
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows requests from Next.js dev server or production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session registry for scanned files
scanned_files_registry = {}

# --- Request / Response Models ---
class LoginRequest(BaseModel):
    email: str
    password: str

class ChatRequest(BaseModel):
    email: str
    query: str
    language: Optional[str] = "ta-IN"
    chat_history: Optional[str] = ""

class StreamlitFileAdapter:
    """Adapts FastAPI UploadFile to match Streamlit UploadedFile interface expected by gasckk_rag."""
    def __init__(self, name: str, content: bytes):
        self.name = name
        self._content = content

    def getbuffer(self):
        return self._content


# --- Endpoints ---
@app.get("/")
def root():
    return {
        "status": "online",
        "app": "GASCKK Multilingual Academic AI Backend",
        "version": "1.0.0"
    }

@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    logo_path = os.path.join(os.path.dirname(__file__), "college_logo.png")
    if os.path.exists(logo_path):
        from fastapi.responses import FileResponse
        return FileResponse(logo_path)
    from fastapi.responses import Response
    return Response(status_code=204)

@app.post("/api/auth/login")
def login(req: LoginRequest):
    if not req.email or not req.password:
        raise HTTPException(status_code=400, detail="Email and password are required.")
    
    email_clean = req.email.strip().lower()
    # Always allow guest login
    if email_clean in ["student@gasckk.edu.in", "guest", "student"]:
        return {
            "success": True,
            "email": "student@gasckk.edu.in",
            "message": "Guest login successful"
        }

    success = authenticate_or_register_user(req.email.strip(), req.password.strip())
    if not success:
        raise HTTPException(status_code=401, detail="Invalid credentials. Please enter the correct password.")
    
    return {
        "success": True,
        "email": req.email.strip(),
        "message": "Authentication successful"
    }

class OTPRequest(BaseModel):
    email: str

class OTPVerifyRequest(BaseModel):
    email: str
    code: str

# -----------------
# BREVO SMTP CREDENTIALS
# -----------------
BREVO_SMTP_LOGIN = "ba3281001@smtp-brevo.com"   # Brevo SMTP login (from Brevo SMTP settings)
BREVO_SMTP_KEY   = "your_brevo_smtp_key_here"
SENDER_EMAIL     = "kandamani179@gmail.com"   # From address shown to users

@app.post("/api/auth/request-otp")
def request_otp(req: OTPRequest):
    import random
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    email_clean = req.email.strip().lower()
    if not email_clean:
        raise HTTPException(status_code=400, detail="Email is required.")

    # Generate 6-digit code
    code = f"{random.randint(100000, 999999)}"
    save_otp_to_db(email_clean, code)

    # Guest accounts don't need real emails
    if email_clean in ["student@gasckk.edu.in", "guest", "student"]:
        print(f"[DEV MODE] OTP for {email_clean} is {code}")
        return {"success": True, "message": "Development OTP generated. Check server console.", "is_guest": True}

    # If the user has already verified previously (one-time verification already completed),
    # log them in automatically without asking for OTP again!
    if is_user_registered(email_clean):
        print(f"[AUTO-LOGIN] User {email_clean} is already verified in database. Bypassing OTP.")
        return {
            "success": True,
            "already_verified": True,
            "message": f"Welcome back, {email_clean}! Automatically logged in.",
            "email": email_clean
        }

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Your GASCKK Login Code"
        msg["From"]    = f"GASCKK AI Portal <{SENDER_EMAIL}>"
        msg["To"]      = email_clean

        html_body = f"""
        <div style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 30px; background: #f9f9f9; border-radius: 12px;">
            <h2 style="color: #1e40af;">GASCKK AI Portal Login</h2>
            <p style="font-size: 15px;">Hello! Your login verification code is:</p>
            <div style="font-size: 36px; font-weight: bold; letter-spacing: 10px; color: #3b82f6; padding: 15px 0;">{code}</div>
            <p style="font-size: 13px; color: #666;">This code expires in 10 minutes. If you did not request this, please ignore this email.</p>
        </div>
        """
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP("smtp-relay.brevo.com", 587) as server:
            server.starttls()
            server.login(BREVO_SMTP_LOGIN, BREVO_SMTP_KEY)
            server.sendmail(SENDER_EMAIL, email_clean, msg.as_string())

        return {"success": True, "message": f"Verification code sent to {email_clean}"}
    except Exception as e:
        print(f"Failed to send email via Brevo SMTP: {e}")
        print(f"[FALLBACK] OTP for {email_clean} is {code}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

@app.post("/api/auth/verify-otp")
def verify_otp(req: OTPVerifyRequest):
    email_clean = req.email.strip().lower()
    code_clean = req.code.strip()
    
    if verify_otp_in_db(email_clean, code_clean):
        return {
            "success": True,
            "email": email_clean,
            "message": "Authentication successful"
        }
    
    raise HTTPException(status_code=401, detail="Invalid or expired verification code.")

@app.post("/api/chat")
def chat(req: ChatRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    
    try:
        answer, matched_docs = process_rag_query(
            user_email=req.email,
            user_input=req.query,
            chat_history_str=req.chat_history or "",
            scanned_files_dict=scanned_files_registry,
            language=req.language or "ta-IN"
        )
        sources = [
            getattr(doc, "metadata", {}).get("source", "Internal Knowledge Base")
            for doc in (matched_docs or [])
        ]
        # De-duplicate sources
        sources = list(dict.fromkeys(sources))
        return {
            "answer": answer,
            "sources": sources
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating response: {str(e)}")

@app.get("/api/history")
def get_history(email: str = Query(..., description="Student / User Email")):
    if not email:
        raise HTTPException(status_code=400, detail="Email query parameter is required.")
    history = get_user_prompt_history(email)
    return {"history": history}

@app.get("/api/day-order")
def get_day_order(date_query: str = Query(..., description="Date to check, e.g., 2026-06-15")):
    result = check_college_day_order.invoke(date_query)
    return {"result": result}

@app.post("/api/sync-website")
def sync_website():
    try:
        sync_website_data()
        return {"success": True, "message": "College website data synced into Vector Store."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Website sync failed: {str(e)}")

@app.post("/api/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    content = await file.read()
    adapter = StreamlitFileAdapter(name=file.filename, content=content)
    try:
        doc_type = process_pdf_document(adapter, scanned_files_registry)
        return {
            "success": True,
            "filename": file.filename,
            "indexed_as": doc_type,
            "message": f"Successfully processed and indexed {file.filename} as {doc_type}."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF ingestion failed: {str(e)}")


# --- Question Bank Sync state ---
_qb_sync_status = {"running": False, "done": False, "indexed": 0, "total": 0, "message": "Not started"}

@app.post("/api/sync-questionbank")
def sync_questionbank():
    """
    Start scraping all department question papers from gasckk.org.in/questionbank.php
    and index them into the Chroma vector store. Runs in background thread.
    """
    global _qb_sync_status
    if _qb_sync_status["running"]:
        return {"success": False, "message": "Sync already in progress.", "status": _qb_sync_status}
    
    import threading
    from sync_question_bank import sync_question_bank

    def _run():
        global _qb_sync_status
        _qb_sync_status = {"running": True, "done": False, "indexed": 0, "total": 0, "message": "Scraping question bank..."}
        def progress(indexed, total, paper):
            _qb_sync_status["indexed"] = indexed
            _qb_sync_status["total"] = total
            _qb_sync_status["message"] = f"Indexing: {paper['subject']} ({paper['year']})"
        try:
            result = sync_question_bank(progress_callback=progress)
            _qb_sync_status = {
                "running": False, "done": True,
                "indexed": result["indexed"],
                "total": result["total_papers"],
                "message": f"Done! Indexed {result['indexed']} question papers from all departments."
            }
        except Exception as e:
            _qb_sync_status = {"running": False, "done": False, "indexed": 0, "total": 0, "message": f"Error: {str(e)}"}

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    return {"success": True, "message": "Question bank sync started in background.", "status": _qb_sync_status}

@app.get("/api/sync-questionbank/status")
def sync_questionbank_status():
    """Returns the current status of the question bank sync operation."""
    return {"status": _qb_sync_status}


# --- Question Paper PDF Export & File Download ---
class ExportPdfRequest(BaseModel):
    title: Optional[str] = "University Examination Question Paper"
    content: str
    filename: Optional[str] = "GASCKK_Question_Paper.pdf"

def generate_question_paper_pdf(content: str, title: str = "Question Paper") -> bytes:
    import re
    import html
    from reportlab.lib.pagesizes import A4
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=40,
        leftMargin=40,
        topMargin=35,
        bottomMargin=35
    )

    styles = getSampleStyleSheet()

    header_style = ParagraphStyle(
        'CollegeHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        alignment=1,
        textColor=colors.HexColor('#0f172a'),
        spaceAfter=3
    )
    sub_header = ParagraphStyle(
        'CollegeSubHeader',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        alignment=1,
        textColor=colors.HexColor('#475569'),
        spaceAfter=8
    )
    section_style = ParagraphStyle(
        'SectionHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        textColor=colors.HexColor('#1e40af'),
        spaceBefore=10,
        spaceAfter=4
    )
    question_style = ParagraphStyle(
        'QuestionText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#1e293b'),
        spaceAfter=4
    )
    meta_style = ParagraphStyle(
        'MetaText',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        textColor=colors.HexColor('#334155'),
        spaceAfter=6
    )

    story = []
    story.append(Paragraph("GOVERNMENT ARTS AND SCIENCE COLLEGE, PALKULAM", header_style))
    story.append(Paragraph("(Affiliated to Manonmaniam Sundaranar University, Tirunelveli)", sub_header))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#1e40af'), spaceAfter=10))

    lines = content.split('\n')
    for line in lines:
        trimmed = line.strip()
        if not trimmed:
            story.append(Spacer(1, 4))
            continue

        safe_line = html.escape(trimmed)
        safe_line = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', safe_line)
        safe_line = re.sub(r'\*(.*?)\*', r'<i>\1</i>', safe_line)

        upper = trimmed.upper()
        if any(h in upper for h in ["PART - A", "PART - B", "PART - C", "PART A", "PART B", "PART C", "SECTION A", "SECTION B", "SECTION C"]):
            story.append(Paragraph(safe_line, section_style))
        elif any(m in upper for m in ["MAXIMUM MARKS", "MAX MARKS", "TIME:", "SEMESTER:", "SUBJECT:"]):
            story.append(Paragraph(safe_line, meta_style))
        elif trimmed.startswith("#"):
            clean_head = safe_line.lstrip('#').strip()
            story.append(Paragraph(clean_head, section_style))
        else:
            story.append(Paragraph(safe_line, question_style))

    story.append(Spacer(1, 15))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#94a3b8'), spaceAfter=6))
    footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontName='Helvetica-Oblique', fontSize=8, alignment=1, textColor=colors.HexColor('#64748b'))
    story.append(Paragraph("GASCKK Academic AI Portal • Manonmaniam Sundaranar University Examination Material", footer_style))

    doc.build(story)
    return buffer.getvalue()

@app.post("/api/export-question-paper-pdf")
def export_pdf(req: ExportPdfRequest):
    """Generates and downloads a clean, university-formatted PDF from question paper text."""
    try:
        from fastapi.responses import Response
        pdf_bytes = generate_question_paper_pdf(req.content, req.title or "Question Paper")
        filename = req.filename or "GASCKK_Question_Paper.pdf"
        if not filename.endswith(".pdf"):
            filename += ".pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

@app.get("/api/download-college-file")
def download_college_file(file_path: str = Query(..., description="Path or filename in college_files")):
    """Downloads an original archived PDF from the college_files folder."""
    import glob
    from fastapi.responses import FileResponse
    base_dir = os.path.dirname(os.path.abspath(__file__))
    college_dir = os.path.join(base_dir, "college_files")

    clean_rel = file_path.replace("/", os.sep).replace("\\", os.sep).lstrip(os.sep)
    candidate_paths = [
        os.path.join(college_dir, clean_rel),
        os.path.join(base_dir, clean_rel),
        os.path.join(college_dir, "Question_bank", clean_rel),
    ]

    found_path = None
    for cp in candidate_paths:
        if os.path.exists(cp) and os.path.isfile(cp):
            found_path = cp
            break

    if not found_path:
        filename = os.path.basename(clean_rel)
        matches = glob.glob(os.path.join(college_dir, "**", filename), recursive=True)
        if matches:
            found_path = matches[0]

    if not found_path:
        raise HTTPException(status_code=404, detail="File not found in college archives.")

    filename = os.path.basename(found_path)
    return FileResponse(
        found_path,
        media_type="application/pdf",
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# --- Admin Panel Endpoints ---
ADMIN_EMAIL    = "admin@gasckk.edu.in"
ADMIN_PASSWORD = "gasckk@admin2024"
ADMIN_DB_FILE  = "gasckk_users_history.db"   # same SQLite as gasckk_rag

class AdminLoginRequest(BaseModel):
    email: str
    password: str

@app.post("/api/admin/login")
def admin_login(req: AdminLoginRequest):
    if req.email.strip().lower() == ADMIN_EMAIL and req.password.strip() == ADMIN_PASSWORD:
        return {"success": True, "message": "Admin login successful", "role": "admin"}
    raise HTTPException(status_code=401, detail="Invalid admin credentials.")

@app.get("/api/admin/stats")
def admin_stats():
    """Returns total users, total prompts, and today's active user count."""
    try:
        import sqlite3 as _sq
        from datetime import datetime as _dt
        conn = _sq.connect(ADMIN_DB_FILE, timeout=10)
        cur  = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM users")
        total_users = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM prompt_history")
        total_prompts = cur.fetchone()[0]
        today = _dt.now().strftime("%Y-%m-%d")
        cur.execute("SELECT COUNT(DISTINCT email) FROM prompt_history WHERE timestamp LIKE ?", (f"{today}%",))
        active_today = cur.fetchone()[0]
        conn.close()
        return {
            "total_users": total_users,
            "total_prompts": total_prompts,
            "active_today": active_today
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stats error: {str(e)}")

@app.get("/api/admin/users")
def admin_users():
    """Returns all registered users (email + join date)."""
    try:
        import sqlite3 as _sq
        conn = _sq.connect(ADMIN_DB_FILE, timeout=10)
        cur  = conn.cursor()
        cur.execute("SELECT id, email, created_at FROM users ORDER BY id DESC")
        rows = cur.fetchall()
        conn.close()
        return {"users": [{"id": r[0], "email": r[1], "joined": r[2]} for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Users error: {str(e)}")

@app.get("/api/admin/history")
def admin_history(page: int = Query(1, ge=1), limit: int = Query(30, ge=1, le=100)):
    """Returns paginated full prompt history across all users."""
    try:
        import sqlite3 as _sq
        conn = _sq.connect(ADMIN_DB_FILE, timeout=10)
        cur  = conn.cursor()
        offset = (page - 1) * limit
        cur.execute("SELECT COUNT(*) FROM prompt_history")
        total = cur.fetchone()[0]
        cur.execute(
            "SELECT id, email, user_query, bot_response, timestamp FROM prompt_history ORDER BY id DESC LIMIT ? OFFSET ?",
            (limit, offset)
        )
        rows = cur.fetchall()
        conn.close()
        return {
            "total": total,
            "page": page,
            "limit": limit,
            "pages": max(1, (total + limit - 1) // limit),
            "history": [
                {"id": r[0], "email": r[1], "query": r[2], "response": r[3][:300], "time": r[4]}
                for r in rows
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"History error: {str(e)}")

@app.get("/api/admin/model-status")
def admin_model_status():
    """Returns current active model engine status."""
    return {
        "engines": [
            {"name": "Groq (openai/gpt-oss-120b)",         "status": "online", "color": "green"},
            {"name": "NVIDIA NIM (llama-3.2-11b-vision)",  "status": "online", "color": "green"},
            {"name": "OpenRouter (DeepSeek V4 Flash Free)", "status": "online", "color": "green"},
            {"name": "Gemini 2.5 Flash",                   "status": "online", "color": "green"},
        ]
    }


# --- Camera / Image Analysis Endpoint ---
class ImageAnalyzeRequest(BaseModel):
    image_base64: str       # base64-encoded image (e.g. from camera capture)
    prompt: Optional[str] = "Please read and answer the question shown in this image. If it is a question paper, provide complete answers."
    email: Optional[str] = "student@gasckk.edu.in"

@app.post("/api/analyze-image")
def analyze_image(req: ImageAnalyzeRequest):
    """
    Accepts a base64-encoded image from the camera.
    Sends it directly to Gemini 2.5 Flash Vision REST API for ultra-fast OCR + answer generation.
    Returns the AI answer.
    """
    import base64
    import requests

    GEMINI_KEY = "your_gemini_api_key_here".strip()

    try:
        # Extract clean base64 data and mime type
        raw_b64 = req.image_base64
        mime_type = "image/jpeg"
        if "," in raw_b64:
            header, raw_b64 = raw_b64.split(",", 1)
            if "image/png" in header:
                mime_type = "image/png"
            elif "image/webp" in header:
                mime_type = "image/webp"
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image format: {str(e)}")

    system_prompt = (
        "You are the official AI Academic Assistant for Government Arts and Science College Palkulam (GASCKK). "
        "A student has uploaded a photo of a textbook, question, or question paper. "
        "1. Read all text, equations, or questions visible in the photo (OCR). "
        "2. Provide complete, accurate, well-structured answers to all questions visible. "
        "3. If the image contains Tamil text or the user asked in Tamil, respond in Tamil. "
        "Format clearly with bold headers and cleanly numbered points."
    )

    full_prompt = f"{system_prompt}\n\nStudent Instructions: {req.prompt}"

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_KEY}"

    payload = {
        "contents": [{
            "parts": [
                {"text": full_prompt},
                {
                    "inline_data": {
                        "mime_type": mime_type,
                        "data": raw_b64
                    }
                }
            ]
        }],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 2048
        }
    }

    try:
        res = requests.post(url, json=payload, timeout=35)
        if res.status_code == 200:
            res_json = res.json()
            candidates = res_json.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                answer_text = "".join(p.get("text", "") for p in parts)
                if answer_text:
                    return {
                        "success": True,
                        "answer": answer_text,
                        "source": "gemini-2.5-flash-fast-rest"
                    }
            raise Exception("Empty response returned from vision engine.")
        else:
            raise Exception(f"Gemini Vision API status {res.status_code}: {res.text}")

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Image analysis failed: {str(e)}"
        )


class TTSRequest(BaseModel):
    text: str
    lang: Optional[str] = "ta-IN"

@app.post("/api/tts")
def generate_speech(req: TTSRequest):
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    # 1. Clean markdown formatting, code blocks, links, math, and headers
    cleaned = re.sub(r'```[\s\S]*?```', 'Code block omitted.', req.text)
    cleaned = re.sub(r'`([^`]+)`', r'\1', cleaned)
    cleaned = re.sub(r'[*#_~>|]', ' ', cleaned)
    cleaned = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', cleaned)
    cleaned = re.sub(r'https?://\S+', '', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()

    # Trim to 1200 characters for snappy streaming
    if len(cleaned) > 1200:
        cleaned = cleaned[:1200].rsplit('.', 1)[0] + '.'

    if not cleaned:
        cleaned = "No readable text."

    # Detect if Tamil characters are present
    has_tamil = any('\u0b80' <= c <= '\u0bff' for c in cleaned)
    target_lang = "ta" if has_tamil or (req.lang and "ta" in req.lang.lower()) else "en"

    try:
        tts = gtts.gTTS(text=cleaned, lang=target_lang, slow=False)
        fp = io.BytesIO()
        tts.write_to_fp(fp)
        fp.seek(0)
        return StreamingResponse(fp, media_type="audio/mpeg")
    except Exception as e:
        print(f"TTS generation error: {e}")
        raise HTTPException(status_code=500, detail=f"TTS error: {str(e)}")



# Memory API Endpoints (mem0)
class AddMemoryRequest(BaseModel):
    email: str
    text: str


@app.get("/api/memories")
def list_memories(email: str = Query(..., description="User email")):
    if not email:
        raise HTTPException(status_code=400, detail="email query param required")
    try:
        memories = get_all_memories(email)
        return {"email": email, "memories": memories, "count": len(memories)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Memory fetch error: {str(e)}")


@app.post("/api/memories")
def create_memory(req: AddMemoryRequest):
    if not req.email or not req.text.strip():
        raise HTTPException(status_code=400, detail="email and text are required")
    try:
        success = add_direct_memory(req.email, req.text)
        if success:
            return {"success": True, "message": "Memory added successfully"}
        raise HTTPException(status_code=500, detail="Failed to save memory")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Memory creation error: {str(e)}")


@app.delete("/api/memories/item/{memory_id}")
def delete_memory_item(memory_id: str):
    if not memory_id:
        raise HTTPException(status_code=400, detail="memory_id is required")
    try:
        success = delete_single_memory(memory_id)
        return {"success": success, "message": f"Memory {memory_id} deleted."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Memory delete error: {str(e)}")


@app.delete("/api/memories")
def clear_memories(email: str = Query(..., description="User email")):
    if not email:
        raise HTTPException(status_code=400, detail="email query param required")
    try:
        items_before = get_all_memories(email)
        delete_all_memories(email)
        return {"success": True, "deleted_count": len(items_before),
                "message": f"All memories deleted for {email}."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Memory delete error: {str(e)}")


@app.get("/api/faculty-directory")
def get_faculty_directory_api(dept: Optional[str] = Query(None, description="Optional department key")):
    """Returns official verified faculty & staff directory for all 8 departments at GASCKK."""
    if dept and dept.lower() in GASCKK_FACULTY_DIRECTORY:
        return {"success": True, "departments": {dept.lower(): GASCKK_FACULTY_DIRECTORY[dept.lower()]}}
    return {"success": True, "departments": GASCKK_FACULTY_DIRECTORY}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api_server:app", host="127.0.0.1", port=8000, reload=True)



