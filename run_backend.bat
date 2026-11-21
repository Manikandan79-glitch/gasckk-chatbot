@echo off
title GASCKK AI Backend (FastAPI)
echo Starting GASCKK FastAPI Backend on http://127.0.0.1:8000...
python -m uvicorn api_server:app --host 127.0.0.1 --port 8000 --reload
pause
