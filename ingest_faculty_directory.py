"""
GASCKK Department, HOD & Faculty Directory Ingestion
===================================================
Indexes all 8 official departments, HODs, faculty members, qualifications,
and lab facilities into the Chroma vector database and creates a local json reference.
"""

import os
import json
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.documents import Document

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CHROMA_DB_DIR = os.path.join(BASE_DIR, "gasckk_db")

DEPARTMENTS_DATA = {
    "BCA": {
        "name": "Department of Computer Applications (BCA)",
        "established": 2012,
        "hod": "Mr. S. Pradeesh (Assistant Professor & Head)",
        "faculty": [
            {"name": "Mr. S. Pradeesh", "designation": "Assistant Professor & Head", "qualification": "M.C.A., M.Phil."},
            {"name": "Dr. I. Vinurajan", "designation": "Assistant Professor", "qualification": "M.Sc., M.Phil., Ph.D"},
            {"name": "Dr. T. J. Benedict Jose", "designation": "Temporary Assistant Professor", "qualification": "M.Sc., M.Phil., Ph.D"},
            {"name": "Dr. D. Sharmila", "designation": "Temporary Assistant Professor", "qualification": "MCA., M.Phil., Ph.D"}
        ],
        "lab": "Modern air-conditioned Computer Laboratory with high-speed internet connectivity and networked PC workstations",
        "programs": "3-Year Bachelor of Computer Applications (BCA), affiliated with Manonmaniam Sundaranar University (MSU)",
        "career_scope": "Software Developer, Full-Stack Engineer, Web Developer, Database Administrator, Cloud Engineer, System Analyst"
    },
    "Tamil": {
        "name": "Department of Tamil",
        "established": 2012,
        "hod": "Dr. C. Amuthan (Associate Professor & Head)",
        "faculty": [
            {"name": "Dr. C. Amuthan", "designation": "Associate Professor & Head", "qualification": "M.A., B.Ed., M.Phil., Ph.D"},
            {"name": "Dr. Y. Burgmonds", "designation": "Assistant Professor", "qualification": "M.A., NET., M.Phil., B.Ed., Ph.D"},
            {"name": "Dr. N. K. Hemlin Ida", "designation": "Assistant Professor", "qualification": "M.A., M.Phil., B.Ed., Ph.D"},
            {"name": "Dr. S. Kavin", "designation": "Temporary Assistant Professor", "qualification": "M.A., M.Phil., Ph.D"},
            {"name": "Dr. S. Sundar", "designation": "Temporary Assistant Professor", "qualification": "M.A., M.Phil., Ph.D., NET"},
            {"name": "Dr. R. Santhi", "designation": "Temporary Assistant Professor", "qualification": "M.A., M.Phil., Ph.D., NET"},
            {"name": "Dr. N. Bama", "designation": "Temporary Assistant Professor", "qualification": "M.A., M.Phil., B.Ed., SET., Ph.D"}
        ],
        "programs": "B.A. Tamil & Foundation Tamil Course",
        "career_scope": "Tamil Teacher, College Professor, Civil Services (UPSC/TNPSC), Journalism, Media & Publishing, Content Writing"
    },
    "English": {
        "name": "Department of English",
        "established": 2012,
        "hod": "Dr. S. Bama / Dr. K. Vaikunda Raja (Assistant Professor & Incharge)",
        "faculty": [
            {"name": "Dr. K. Vaikunda Raja", "designation": "Temporary Assistant Professor & Incharge", "qualification": "M.A., B.Ed., M.Phil., Ph.D"},
            {"name": "Dr. B. Bexel", "designation": "Temporary Assistant Professor", "qualification": "M.A., MA(Socio)., M.Phil., Ph.D"},
            {"name": "Dr. S. Johny", "designation": "Temporary Assistant Professor", "qualification": "M.A., M.Phil., Ph.D., PGDELT"},
            {"name": "Dr. S. K. Jincy", "designation": "Temporary Assistant Professor", "qualification": "M.A., B.Ed., SET., Ph.D., NET"},
            {"name": "Dr. Dialin J. Dev", "designation": "Temporary Assistant Professor", "qualification": "M.A., M.Phil., Ph.D"},
            {"name": "Dr. F. A. Binu Josy", "designation": "Temporary Assistant Professor", "qualification": "M.A., M.Phil., Ph.D"},
            {"name": "Dr. R. S. Suji", "designation": "Guest Lecturer", "qualification": "M.A., M.Phil., Ph.D"},
            {"name": "Dr. V. Sumitha Binil", "designation": "Guest Lecturer", "qualification": "MA., M.Phil., Ph.D., NET., SET."}
        ],
        "programs": "B.A. English Language & Literature, Part-II Foundation English",
        "career_scope": "Corporate Communication, English Faculty, Public Relations, Translation, Digital Marketing, International Business"
    },
    "Physics": {
        "name": "Department of Physics",
        "established": 2017,
        "hod": "Dr. N. Angel Benseera (Associate Professor & HOD Incharge)",
        "faculty": [
            {"name": "Dr. N. Angel Benseera", "designation": "Associate Professor & HOD Incharge", "qualification": "M.Sc., M.Phil., Ph.D., M.Ed., PGDCA., SET., NET"},
            {"name": "Dr. G. Janita Christobel", "designation": "Temporary Assistant Professor", "qualification": "M.Sc., B.Ed., Ph.D., PDF(UGC)"},
            {"name": "Dr. M. Nagarajan", "designation": "Temporary Assistant Professor", "qualification": "M.Sc., Ph.D"},
            {"name": "Dr. M. J. Jarald Brigit Gilda", "designation": "Temporary Assistant Professor", "qualification": "M.Sc., M.Phil., Ph.D"},
            {"name": "Dr. S. Siva Bala Solanki", "designation": "Temporary Assistant Professor", "qualification": "M.Sc., Ph.D"}
        ],
        "lab": "Comprehensive Physics Laboratory equipped for Mechanics, Optics, Electromagnetism, Quantum Physics, and Electronics",
        "programs": "3-Year B.Sc Physics with Allied Mathematics and Chemistry",
        "career_scope": "Scientific Research (ISRO, DRDO, BARC), Defense Laboratories, Electronics & Semiconductor Industry, Higher Academics"
    },
    "Chemistry": {
        "name": "Department of Chemistry",
        "established": 2017,
        "hod": "Dr. N. Manonmani (Associate Professor & Head)",
        "faculty": [
            {"name": "Dr. N. Manonmani", "designation": "Associate Professor & Head", "qualification": "M.Sc., M.Phil., B.Ed., Ph.D"},
            {"name": "Dr. K. Muthuraja", "designation": "Temporary Assistant Professor", "qualification": "M.Sc., Ph.D"},
            {"name": "Dr. K. Jemila Rose", "designation": "Temporary Assistant Professor", "qualification": "M.Sc., M.Phil., Ph.D"},
            {"name": "Dr. Jaslin J Christopher", "designation": "Temporary Assistant Professor", "qualification": "M.Sc., M.Phil., Ph.D"}
        ],
        "lab": "State-of-the-art Organic, Inorganic, and Physical Chemistry Practical Laboratories with modern safety apparatus",
        "programs": "3-Year B.Sc Chemistry Degree",
        "career_scope": "Pharmaceutical Industries, Chemical Analysis, Quality Control, Petrochemicals, Polymer Industry, Environmental Research"
    },
    "BBA": {
        "name": "Department of Business Administration (BBA)",
        "established": 2012,
        "hod": "Dr. P. R. Shini (Associate Professor & Head)",
        "faculty": [
            {"name": "Dr. P. R. Shini", "designation": "Associate Professor & Head", "qualification": "MA., MBA., MTM., Ph.D."},
            {"name": "Dr. K. Saravanan", "designation": "Assistant Professor", "qualification": "MBA., M.Phil., Ph.D., DLLA"},
            {"name": "Dr. T. Babu Rajendra Prasad", "designation": "Temporary Assistant Professor", "qualification": "MBA., NET., M.Phil., Ph.D., M.Com(F&C)., M.Sc(Psy)"},
            {"name": "Dr. D. Jenisha", "designation": "Temporary Assistant Professor", "qualification": "MBM., MBA., M.Phil.(Mgt), NET., Ph.D"},
            {"name": "Dr. A. R. Sindhu", "designation": "Temporary Assistant Professor", "qualification": "MBA., M.Phil., Ph.D., SET"}
        ],
        "programs": "3-Year Bachelor of Business Administration (BBA)",
        "career_scope": "Business Management, Marketing Manager, HR Executive, Operations Analyst, Financial Consultant, Startup Founder"
    },
    "Commerce": {
        "name": "Department of Commerce (B.Com & M.Com)",
        "established": 2012,
        "hod": "Dr. D. Andrews Scott (Associate Professor & Head)",
        "faculty": [
            {"name": "Dr. D. Andrews Scott", "designation": "Associate Professor & Head", "qualification": "M.Com., M.Phil., Ph.D"},
            {"name": "Dr. S. Lakshmanan", "designation": "Temporary Assistant Professor", "qualification": "M.Com., M.Phil., MBA., Ph.D"},
            {"name": "Dr. S. Premalatha", "designation": "Temporary Assistant Professor", "qualification": "M.Com., M.Phil., MBA., Ph.D"},
            {"name": "Dr. A. Elango", "designation": "Temporary Assistant Professor", "qualification": "M.Com., M.Phil., SET., Ph.D"},
            {"name": "Dr. A. Vijayalekshmi", "designation": "Temporary Assistant Professor", "qualification": "M.Com., M.Phil., MBA., SET., Ph.D"},
            {"name": "Dr. N. Suthendran", "designation": "Temporary Assistant Professor", "qualification": "M.Com., M.Phil., MBA., MCA., Ph.D"},
            {"name": "Dr. T. K. Suvitha", "designation": "Temporary Assistant Professor", "qualification": "M.Com., M.Phil., MBA., NET., Ph.D"},
            {"name": "Dr. K. Jemila", "designation": "Temporary Assistant Professor", "qualification": "M.Com., M.Phil., Ph.D"}
        ],
        "programs": "3-Year B.Com and 2-Year M.Com (Postgraduate course introduced in 2017)",
        "career_scope": "Chartered Accountant (CA), Cost & Management Accountant (CMA), Banking, Tax Consultant, Auditing, Corporate Finance"
    },
    "Mathematics": {
        "name": "Department of Mathematics (B.Sc Mathematics)",
        "established": 2012,
        "hod": "Dr. C. Rajeswari (Associate Professor & Head)",
        "faculty": [
            {"name": "Dr. C. Rajeswari", "designation": "Associate Professor & Head", "qualification": "M.Sc., M.Phil., Ph.D"},
            {"name": "Dr. V. Pazhani", "designation": "Associate Professor", "qualification": "M.Sc., M.Phil., Ph.D"},
            {"name": "Dr. N. Angel Benseera", "designation": "Associate Professor", "qualification": "M.Sc., M.Phil., Ph.D"},
            {"name": "Dr. L. T. Saji", "designation": "Temporary Assistant Professor", "qualification": "M.Sc., M.Phil., Ph.D"},
            {"name": "Dr. S. Santha Kumari", "designation": "Temporary Assistant Professor", "qualification": "M.Sc., M.Phil., Ph.D., SET"},
            {"name": "Dr. V. Jebarani", "designation": "Temporary Assistant Professor", "qualification": "M.Sc., M.Phil., Ph.D., SET"}
        ],
        "programs": "3-Year B.Sc Mathematics with Allied Statistics and Physics",
        "career_scope": "Data Science & Analytics, Actuarial Analyst, Operations Research, Statistical Analyst, Higher Mathematical Research"
    }
}

# Save JSON file for easy reference
json_path = os.path.join(BASE_DIR, "gasckk_faculty_directory.json")
with open(json_path, "w", encoding="utf-8") as f:
    json.dump(DEPARTMENTS_DATA, f, indent=2, ensure_ascii=False)
print(f"Saved directory JSON to {json_path}")

# Ingest into Chroma Vector Database
embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
vectorstore = Chroma(persist_directory=CHROMA_DB_DIR, embedding_function=embeddings)

docs = []
for key, dept in DEPARTMENTS_DATA.items():
    faculty_list = "\n".join([f"- {f['name']} ({f['designation']} - {f['qualification']})" for f in dept['faculty']])
    doc_text = f"""Government Arts and Science College Palkulam (GASCKK)
{dept['name']} (Established: {dept['established']})
Head of Department (HOD): {dept['hod']}

Faculty & Staff Members:
{faculty_list}

Programs Offered: {dept['programs']}
{f"Laboratories: {dept['lab']}" if 'lab' in dept else ""}
Career Opportunities & Scope: {dept['career_scope']}
"""
    docs.append(Document(page_content=doc_text, metadata={"source": f"GASCKK Faculty Directory - {key}"}))

# Also add a master document of all HODs
master_hods = """Government Arts and Science College Palkulam (GASCKK) - Complete List of Department HODs:
1. Department of Computer Applications (BCA): Mr. S. Pradeesh (Assistant Professor & Head)
2. Department of Tamil: Dr. C. Amuthan (Associate Professor & Head - M.A., B.Ed., M.Phil., Ph.D)
3. Department of English: Dr. S. Bama / Dr. K. Vaikunda Raja (Assistant Professor & Incharge)
4. Department of Physics: Dr. N. Angel Benseera (Associate Professor & HOD Incharge - M.Sc., M.Phil., Ph.D., M.Ed., PGDCA., SET., NET)
5. Department of Chemistry: Dr. N. Manonmani (Associate Professor & Head - M.Sc., M.Phil., B.Ed., Ph.D)
6. Department of Business Administration (BBA): Dr. P. R. Shini (Associate Professor & Head - MA., MBA., MTM., Ph.D.)
7. Department of Commerce (B.Com & M.Com): Dr. D. Andrews Scott (Associate Professor & Head)
8. Department of Mathematics: Dr. C. Rajeswari (Associate Professor & Head - M.Sc., M.Phil., Ph.D)
"""
docs.append(Document(page_content=master_hods, metadata={"source": "GASCKK Master HOD Directory"}))

vectorstore.add_documents(docs)
print("Successfully indexed all 8 departments, HODs, and staff members into Chroma DB!")
