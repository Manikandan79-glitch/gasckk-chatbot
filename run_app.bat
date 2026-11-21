@echo off
title GASCKK Multilingual Academic AI Launcher
color 0B
cls
echo ================================================================
echo   🎓 GASCKK Multilingual Academic AI - One-Click Launcher
echo   Government Arts and Science College, Palkulam
echo ================================================================
echo.

cd /d "%~dp0"

echo [1/3] Launching FastAPI Backend on http://127.0.0.1:8000...
start "GASCKK Backend Engine (Port 8000)" cmd /k "cd /d %~dp0 && python api_server.py"

echo [2/3] Launching Next.js Frontend on http://localhost:3000...
start "GASCKK Frontend UI (Port 3000)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo [3/3] Opening Chatbot in your web browser...
timeout /t 5 /nobreak >nul
start http://localhost:3000

echo.
echo ================================================================
echo   ✅ Both Backend and Frontend are running!
echo.
echo   🌐 Chatbot:     http://localhost:3000
echo   🔒 Admin Panel: http://localhost:3000/admin
echo   ⚡ API Docs:    http://127.0.0.1:8000/docs
echo ================================================================
echo.
echo You can minimize this window. Press any key to close this launcher window.
pause >nul
