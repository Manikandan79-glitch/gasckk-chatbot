import os
import sys
import time
import subprocess
import webbrowser
import socket

def is_port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.join(base_dir, "frontend")

    print("=" * 65)
    print("🎓 GASCKK Multilingual Academic AI - Automated Launcher")
    print("=" * 65)

    # 1. Start Backend if not already running on port 8000
    if is_port_in_use(8000):
        print("✅ Backend is already running on http://127.0.0.1:8000")
    else:
        print("🚀 [1/2] Starting FastAPI Backend on http://127.0.0.1:8000...")
        if sys.platform == "win32":
            subprocess.Popen(
                ["cmd", "/c", "start", "GASCKK Backend", sys.executable, "api_server.py"],
                cwd=base_dir,
                shell=True
            )
        else:
            subprocess.Popen([sys.executable, "api_server.py"], cwd=base_dir)

        for _ in range(25):
            if is_port_in_use(8000):
                print("✅ Backend is ready!")
                break
            time.sleep(0.5)

    # 2. Start Frontend
    if is_port_in_use(3000):
        print("✅ Frontend is already running on http://localhost:3000")
    else:
        print("🚀 [2/2] Starting Next.js Frontend on http://localhost:3000...")
        if sys.platform == "win32":
            subprocess.Popen(
                ["cmd", "/c", "start", "GASCKK Frontend", "npm", "run", "dev"],
                cwd=frontend_dir,
                shell=True
            )
        else:
            subprocess.Popen(["npm", "run", "dev"], cwd=frontend_dir)

    # 3. Open Web Browser
    time.sleep(4)
    print("\n🌐 Opening Chatbot in your default browser...")
    webbrowser.open("http://localhost:3000")

    print("\n" + "=" * 65)
    print("✅ All services launched successfully!")
    print("• Main Chatbot: http://localhost:3000")
    print("• Admin Panel:  http://localhost:3000/admin")
    print("=" * 65)

if __name__ == "__main__":
    main()
