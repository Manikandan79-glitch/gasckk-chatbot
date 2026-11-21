"""
GASCKK Question Bank Scraper & Indexer
=======================================
Crawls all UG/PG department question papers from gasckk.org.in/fetch_questions.php,
downloads PDFs, extracts text (or creates rich metadata), and indexes into Chroma DB.
"""

import os
import sys
import io
import time
import urllib.parse
import urllib.request

import requests
import pdfplumber
from bs4 import BeautifulSoup
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

# UTF-8 console fix for Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

BASE_URL = "https://gasckk.org.in"
FETCH_URL = f"{BASE_URL}/fetch_questions.php"
CHROMA_DB_DIR = "./gasckk_db"
HEADERS = {"User-Agent": "Mozilla/5.0 (GASCKK-QuestionBank-Indexer)"}

# All UG and PG courses and semesters as defined on the website
UG_COURSES = [
    "B.A. English",
    "B.B.A. Business Administration",
    "B.Com. (Commerce)",
    "B.Sc. Mathematics",
    "B.Sc. Physics",
    "B.Sc. Chemistry",
    "B.C.A. Bachelor of Computer Application",
]
PG_COURSES = [
    "M.A English",
    "M.Sc Maths",
    "M.Com",
]
UG_SEMESTERS = ["semester 1", "semester 2", "semester 3", "semester 4", "semester 5", "semester 6"]
PG_SEMESTERS = ["semester 1", "semester 2", "semester 3", "semester 4"]
YEARS = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"]


def fetch_pdf_links(graduation: str, course: str, semester: str, year: str) -> list[dict]:
    """Call fetch_questions.php and extract all PDF links with subject names."""
    try:
        r = requests.post(
            FETCH_URL,
            data={"graduation": graduation, "course": course, "semester": semester, "year": year},
            headers=HEADERS,
            timeout=10,
        )
        if r.status_code != 200 or not r.text.strip():
            return []

        soup = BeautifulSoup(r.text, "html.parser")
        papers = []
        rows = soup.find_all("tr")
        for row in rows:
            cells = row.find_all("td")
            if len(cells) < 3:
                continue
            paper_type = cells[0].get_text(strip=True)
            code = cells[1].get_text(strip=True)
            subject = cells[2].get_text(strip=True)
            a_tag = row.find("a", href=True)
            if a_tag and a_tag["href"].endswith(".pdf"):
                papers.append({
                    "graduation": graduation,
                    "course": course,
                    "semester": semester,
                    "year": year,
                    "paper_type": paper_type,
                    "code": code,
                    "subject": subject,
                    "pdf_path": a_tag["href"],
                    "pdf_url": f"{BASE_URL}/{a_tag['href']}",
                })
        return papers
    except Exception as e:
        print(f"  [WARN] fetch_pdf_links error ({course} {semester} {year}): {e}")
        return []


def extract_pdf_text(pdf_url: str) -> str:
    """Download PDF and extract text with pdfplumber. Returns empty string if image-based."""
    try:
        r = requests.get(pdf_url, headers=HEADERS, timeout=15)
        if r.status_code != 200:
            return ""
        with pdfplumber.open(io.BytesIO(r.content)) as pdf:
            text_parts = []
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    text_parts.append(t.strip())
            return "\n".join(text_parts)
    except Exception as e:
        print(f"  [WARN] PDF extraction error: {e}")
        return ""


def build_paper_document(paper: dict, text: str = "") -> Document:
    """
    Build a LangChain Document for a question paper.
    If no text could be extracted (scanned image PDFs), create a rich metadata record
    so the chatbot knows the paper exists and can provide the download link.
    """
    friendly_sem = paper["semester"].replace("semester ", "Semester ")
    title = (
        f"{paper['graduation']} {paper['course']} - {paper['subject']} "
        f"({friendly_sem}, {paper['year']})"
    )

    if text and len(text) > 50:
        # Text-based PDF — index the actual content
        content = (
            f"QUESTION PAPER: {title}\n"
            f"Paper Type: {paper['paper_type']} | Code: {paper['code']}\n"
            f"Download: {paper['pdf_url']}\n\n"
            f"--- QUESTIONS ---\n{text}"
        )
    else:
        # Image/scanned PDF — index metadata so AI knows the paper exists
        content = (
            f"QUESTION PAPER AVAILABLE (Scanned Image)\n"
            f"Title: {title}\n"
            f"Graduation: {paper['graduation']}\n"
            f"Course: {paper['course']}\n"
            f"Subject: {paper['subject']}\n"
            f"Subject Code: {paper['code']}\n"
            f"Paper Type: {paper['paper_type']}\n"
            f"Semester: {friendly_sem}\n"
            f"Year: {paper['year']}\n"
            f"Download Link: {paper['pdf_url']}\n\n"
            f"This question paper is available as a scanned PDF. "
            f"Students can download it directly from the link above."
        )

    return Document(
        page_content=content,
        metadata={
            "source": paper["pdf_url"],
            "type": "question_paper",
            "graduation": paper["graduation"],
            "course": paper["course"],
            "subject": paper["subject"],
            "semester": paper["semester"],
            "year": paper["year"],
            "code": paper["code"],
        },
    )


def sync_question_bank(progress_callback=None):
    """
    Main function: crawls all courses/semesters/years and indexes into Chroma.
    Returns a dict with stats.
    """
    print("Initializing Vector Store...")
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    vectorstore = Chroma(persist_directory=CHROMA_DB_DIR, embedding_function=embeddings)
    splitter = RecursiveCharacterTextSplitter(chunk_size=2000, chunk_overlap=200)

    total_papers = 0
    indexed_papers = 0
    all_docs = []

    # Collect all combinations
    combos = []
    for course in UG_COURSES:
        for sem in UG_SEMESTERS:
            for year in YEARS:
                combos.append(("UG", course, sem, year))
    for course in PG_COURSES:
        for sem in PG_SEMESTERS:
            for year in YEARS:
                combos.append(("PG", course, sem, year))

    total_combos = len(combos)
    print(f"Scanning {total_combos} course/semester/year combinations...")

    for idx, (grad, course, sem, year) in enumerate(combos):
        papers = fetch_pdf_links(grad, course, sem, year)
        if not papers:
            continue

        print(f"[{idx+1}/{total_combos}] Found {len(papers)} papers: {course} {sem} {year}")
        total_papers += len(papers)

        for paper in papers:
            # Extract text from PDF (handles both text and scanned)
            text = extract_pdf_text(paper["pdf_url"])
            doc = build_paper_document(paper, text)
            all_docs.append(doc)
            indexed_papers += 1

            if progress_callback:
                progress_callback(indexed_papers, total_papers, paper)

        # Brief delay to be polite to the server
        time.sleep(0.3)

    # Batch index into Chroma
    if all_docs:
        print(f"\nIndexing {len(all_docs)} documents into Chroma Vector Store...")
        chunks = splitter.split_documents(all_docs)
        print(f"Split into {len(chunks)} chunks...")
        # Index in batches of 50 to avoid timeouts
        batch_size = 50
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i + batch_size]
            vectorstore.add_documents(batch)
            print(f"  Indexed batch {i // batch_size + 1}/{(len(chunks) + batch_size - 1) // batch_size}")

    print(f"\nDone! Total papers found: {total_papers} | Documents indexed: {indexed_papers}")
    return {
        "total_papers": total_papers,
        "indexed": indexed_papers,
        "chunks": len(all_docs),
    }


if __name__ == "__main__":
    print("=" * 60)
    print("GASCKK Question Bank Scraper & Indexer")
    print("=" * 60)
    result = sync_question_bank()
    print("\nResult:", result)
