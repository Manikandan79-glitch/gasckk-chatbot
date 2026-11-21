"""
GASCKK Local Question Bank Ingestion Script
============================================
Crawls all 2,047+ local question papers from:
C:\\Users\\MANIKANDAN\\OneDrive\\Attachments\\Desktop\\chatbot\\college_files

Extracts text, metadata, builds JSON catalog, and indexes into Chroma DB (gasckk_db).
"""

import os
import sys
import glob
import json
import re
import time
import pdfplumber
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
COLLEGE_FILES_DIR = os.path.join(BASE_DIR, "college_files")
CHROMA_DB_DIR = os.path.join(BASE_DIR, "gasckk_db")
CATALOG_FILE = os.path.join(BASE_DIR, "college_question_bank_catalog.json")

def clean_subject_name(filename_no_ext: str) -> str:
    """Cleans year and trailing semester tags to leave the readable subject name."""
    name = re.sub(r'[\-_ ]*(?:20\d\d)[\-_ ]*', ' ', filename_no_ext)
    name = re.sub(r'[\-_ ]+(?:semester\s+[IV1-6]+|[IVX1-6]+)[\-_ ]*$', '', name, flags=re.IGNORECASE)
    name = ' '.join(name.split()).strip()
    return name or filename_no_ext

def parse_metadata(filepath: str):
    """Extracts department, year, semester, and subject from the directory structure."""
    rel = os.path.relpath(filepath, COLLEGE_FILES_DIR)
    parts = rel.split(os.sep)
    filename = os.path.basename(filepath)
    filename_no_ext = os.path.splitext(filename)[0]

    # Department
    dept = "General"
    if len(parts) > 1 and parts[0].lower() == "question_bank":
        dept = parts[1]
    elif len(parts) > 1:
        dept = parts[0]

    # Year (e.g., 2020 - 2026)
    year_match = re.search(r'(20\d\d)', rel)
    year = year_match.group(1) if year_match else "General"

    # Semester (e.g., Semester I, II, III, IV, V, VI)
    sem_match = re.search(r'(?:semester|sem|[\b\-_])(I{1,3}|IV|VI|V|[1-6])(?:[\b\-_]|$)', rel, re.IGNORECASE)
    sem = f"Semester {sem_match.group(1).upper()}" if sem_match else "General"

    # Subject name
    subject = clean_subject_name(filename_no_ext)

    return dept, year, sem, subject, rel

def extract_text_from_pdf(filepath: str) -> str:
    """Extracts text using pdfplumber with timeout/error protection."""
    try:
        with pdfplumber.open(filepath) as pdf:
            parts = []
            for page in pdf.pages[:8]: # Read up to 8 pages per paper
                t = page.extract_text()
                if t:
                    parts.append(t.strip())
            return "\n".join(parts)
    except Exception:
        return ""

def main():
    print("=" * 65)
    print("🎓 GASCKK Local Question Bank Ingestion Engine")
    print("=" * 65)
    print(f"Scanning directory: {COLLEGE_FILES_DIR}")

    pdf_files = glob.glob(os.path.join(COLLEGE_FILES_DIR, "**", "*.pdf"), recursive=True)
    total_files = len(pdf_files)
    print(f"✅ Found {total_files} total PDF documents.\n")

    catalog = {}
    documents_to_index = []
    text_count = 0
    scanned_count = 0

    print("📖 Processing question papers and extracting contents...")
    start_time = time.time()

    for idx, pdf_path in enumerate(pdf_files, 1):
        dept, year, sem, subject, rel_path = parse_metadata(pdf_path)
        extracted_text = extract_text_from_pdf(pdf_path)
        has_text = len(extracted_text.strip()) > 40

        if has_text:
            text_count += 1
            content = (
                f"GOVERNMENT ARTS AND SCIENCE COLLEGE, PALKULAM (GASCKK)\n"
                f"OFFICIAL UNIVERSITY EXAMINATION QUESTION PAPER\n"
                f"Department: {dept}\n"
                f"Subject: {subject}\n"
                f"Semester: {sem}\n"
                f"Year: {year}\n"
                f"File: {os.path.basename(pdf_path)}\n"
                f"Local Path: {rel_path}\n\n"
                f"--- QUESTIONS & PAPER CONTENT ---\n"
                f"{extracted_text[:3500]}"
            )
        else:
            scanned_count += 1
            content = (
                f"GOVERNMENT ARTS AND SCIENCE COLLEGE, PALKULAM (GASCKK)\n"
                f"OFFICIAL UNIVERSITY EXAMINATION QUESTION PAPER (ARCHIVED)\n"
                f"Department: {dept}\n"
                f"Subject: {subject}\n"
                f"Semester: {sem}\n"
                f"Year: {year}\n"
                f"File: {os.path.basename(pdf_path)}\n"
                f"Local Path: {rel_path}\n"
                f"Status: Archived university examination paper for {subject} ({dept}, {sem}, {year})."
            )

        doc = Document(
            page_content=content,
            metadata={
                "source": rel_path,
                "filename": os.path.basename(pdf_path),
                "department": dept,
                "year": year,
                "semester": sem,
                "subject": subject,
                "type": "question_paper",
                "has_text": has_text
            }
        )
        documents_to_index.append(doc)

        # Build JSON catalog
        dept_key = dept
        if dept_key not in catalog:
            catalog[dept_key] = []
        catalog[dept_key].append({
            "subject": subject,
            "year": year,
            "semester": sem,
            "filename": os.path.basename(pdf_path),
            "rel_path": rel_path,
            "has_text": has_text
        })

        if idx % 250 == 0 or idx == total_files:
            print(f"  Processed {idx}/{total_files} files ({text_count} text, {scanned_count} scanned)...")

    # Save JSON catalog
    print(f"\n💾 Saving Master Question Bank Catalog to: {CATALOG_FILE}")
    with open(CATALOG_FILE, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2, ensure_ascii=False)
    print(f"✅ Catalog saved successfully! Departments cataloged: {len(catalog)}")

    # Index into Chroma DB
    print(f"\n⚡ Ingesting {len(documents_to_index)} documents into Chroma Vector DB ({CHROMA_DB_DIR})...")
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    vectorstore = Chroma(persist_directory=CHROMA_DB_DIR, embedding_function=embeddings)
    splitter = RecursiveCharacterTextSplitter(chunk_size=2000, chunk_overlap=200)

    chunks = splitter.split_documents(documents_to_index)
    print(f"Split into {len(chunks)} total text chunks. Committing in batches...")

    batch_size = 100
    total_batches = (len(chunks) + batch_size - 1) // batch_size
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        vectorstore.add_documents(batch)
        batch_num = (i // batch_size) + 1
        if batch_num % 5 == 0 or batch_num == total_batches:
            print(f"  Indexed batch {batch_num}/{total_batches}...")

    elapsed = time.time() - start_time
    print(f"\n🎉 SUCCESS! All {total_files} question papers successfully ingested into chatbot!")
    print(f"⏱️ Total time elapsed: {elapsed:.1f} seconds.")
    print("=" * 65)

if __name__ == "__main__":
    main()
