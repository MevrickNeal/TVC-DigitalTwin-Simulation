"""
PROJECT NEAL — TVC Digital Twin
Standalone EXE launcher with animated splash screen + embedded server.
"""
import sys, os, threading, time, socket, webbrowser, subprocess, tkinter as tk

def _res(rel):
    if getattr(sys, "_MEIPASS", None):
        return os.path.join(sys._MEIPASS, rel)
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), rel)

BACKEND_DIR = _res("backend")
STATIC_DIR  = _res("dist")
PORT        = 8765

# ─── Splash Screen ─────────────────────────────────────────────────────────────
class Splash:
    W, H   = 580, 340
    BG     = "#090d16"
    ACCENT = "#e8121c"
    DIM    = "#334155"
    LT     = "#f1f5f9"

    def __init__(self):
        self.root = tk.Tk()
        self.root.overrideredirect(True)
        self.root.attributes("-topmost", True)
        self.root.configure(bg=self.BG)
        sw, sh = self.root.winfo_screenwidth(), self.root.winfo_screenheight()
        self.root.geometry(f"{self.W}x{self.H}+{(sw-self.W)//2}+{(sh-self.H)//2}")

        self.cv = tk.Canvas(self.root, width=self.W, height=self.H,
                            bg=self.BG, highlightthickness=0)
        self.cv.pack(fill="both", expand=True)
        self._draw_bg()

        # ── Progress bar ──
        self.BAR_X1, self.BAR_Y, self.BAR_X2 = 48, 258, self.W - 48
        self.BAR_H = 5
        self.cv.create_rectangle(self.BAR_X1, self.BAR_Y, self.BAR_X2,
                                 self.BAR_Y + self.BAR_H, fill="#1a2130", outline="")
        self.bar_rect = self.cv.create_rectangle(self.BAR_X1, self.BAR_Y,
                                                  self.BAR_X1, self.BAR_Y + self.BAR_H,
                                                  fill=self.ACCENT, outline="")
        # ── Glow effect on bar (slightly taller, semi-transparent via layering) ──
        self.bar_glow = self.cv.create_rectangle(self.BAR_X1, self.BAR_Y - 1,
                                                  self.BAR_X1, self.BAR_Y + self.BAR_H + 1,
                                                  fill="#ff4444", outline="")

        self.status_text_id = self.cv.create_text(48, 278, anchor="w", text="INITIALIZING RUNTIME...",
                            fill="#475569", font=("Courier New", 8))
        self.pct_text_id = self.cv.create_text(self.W - 48, 278, anchor="e", text="0%",
                            fill=self.ACCENT, font=("Courier New", 9, "bold"))

        self.cv.create_text(self.W // 2, self.H - 18, anchor="center",
                            text="MEVRICK NEAL  \u2022  AEROSPACE ENGINEERING  \u2022  2026",
                            fill="#1e293b", font=("Courier New", 7))

    def _draw_bg(self):
        c, W, H = self.cv, self.W, self.H
        # Top red accent stripe
        c.create_rectangle(0, 0, W, 3, fill=self.ACCENT, outline="")
        # Grid
        for i in range(0, W, 30): c.create_line(i, 0, i, H, fill="#0c1122", width=1)
        for j in range(0, H, 30): c.create_line(0, j, W, j, fill="#0c1122", width=1)
        # Diagonal accent lines
        c.create_line(0, H, W*0.4, 0, fill="#0f1830", width=40)
        # PROJECT text
        c.create_text(W//2, 88, anchor="center", text="PROJECT",
                      fill="#c8d5e8", font=("Courier New", 28, "bold"))
        # NEAL in red
        c.create_text(W//2, 132, anchor="center", text="NEAL",
                      fill=self.ACCENT, font=("Courier New", 40, "bold"))
        # Tagline
        c.create_text(W//2, 172, anchor="center",
                      text="TVC  DIGITAL  TWIN  \u2014  MISSION  CONTROL",
                      fill="#2a3a52", font=("Courier New", 9))
        # Separator
        c.create_rectangle(48, 200, W-48, 201, fill="#1e293b", outline="")
        c.create_text(48, 223, anchor="w", text="SYSTEM LOADING",
                      fill="#2a3a52", font=("Courier New", 8))

    def set(self, pct, status):
        def _u():
            x2 = self.BAR_X1 + (self.BAR_X2 - self.BAR_X1) * min(pct, 1.0)
            self.cv.coords(self.bar_rect,  self.BAR_X1, self.BAR_Y, x2, self.BAR_Y + self.BAR_H)
            self.cv.coords(self.bar_glow,  self.BAR_X1, self.BAR_Y - 1, x2, self.BAR_Y + self.BAR_H + 1)
            self.cv.itemconfigure(self.status_text_id, text=status.upper())
            self.cv.itemconfigure(self.pct_text_id, text=f"{int(pct*100)}%")
        self.root.after(0, _u)

    def close(self):
        self.root.after(0, self.root.destroy)

    def run(self): self.root.mainloop()

# ─── Port helpers ───────────────────────────────────────────────────────────────
def _port_open(port):
    try:
        s = socket.create_connection(("127.0.0.1", port), timeout=0.3); s.close(); return True
    except OSError: return False

def _free_port(port):
    """Kill any process holding port via netstat + taskkill."""
    try:
        out = subprocess.check_output(
            ["netstat", "-ano"],
            creationflags=subprocess.CREATE_NO_WINDOW,
            stderr=subprocess.DEVNULL
        ).decode(errors="ignore")
        for line in out.splitlines():
            if f":{port} " in line and "LISTENING" in line:
                pid = line.strip().split()[-1]
                if pid.isdigit() and int(pid) != os.getpid():
                    _log(f"Port {port} held by PID {pid} — killing it")
                    subprocess.run(
                        ["taskkill", "/F", "/PID", pid],
                        creationflags=subprocess.CREATE_NO_WINDOW,
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
                    )
                    time.sleep(0.8)
                    return
    except Exception as e:
        _log(f"_free_port error: {e}")

# ─── Server start ───────────────────────────────────────────────────────────────
_LOG_PATH = os.path.join(os.path.expanduser("~"), "ProjectNeal", "launcher_debug.log")
def _log(msg):
    try:
        os.makedirs(os.path.dirname(_LOG_PATH), exist_ok=True)
        with open(_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}\n")
    except:
        pass

def _prepare_server(splash, ready, prepared_app):
    _log("--- START SERVER PREPARATION ---")
    _log(f"BACKEND_DIR: {BACKEND_DIR}")
    _log(f"STATIC_DIR: {STATIC_DIR}")
    _log(f"PORT: {PORT}")

    splash.set(0.08, "Checking for port conflicts...")

    # Free port if something else is holding it
    if _port_open(PORT):
        _log(f"Port {PORT} already in use — attempting to free...")
        _free_port(PORT)
        time.sleep(0.5)
        if _port_open(PORT):
            _log(f"WARNING: Port {PORT} still in use after kill attempt")

    splash.set(0.12, "Starting embedded API server...")

    # Load FastAPI backend and mount static files
    sys.path.insert(0, BACKEND_DIR)
    backend_app = None
    try:
        _log("Importing backend main...")
        from main import app as b_app
        backend_app = b_app
        _log("Backend imported successfully.")
        
        from fastapi.staticfiles import StaticFiles
        if os.path.isdir(STATIC_DIR):
            _log("Mounting static files...")
            backend_app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
            _log("Static files mounted successfully.")
        else:
            _log(f"WARNING: STATIC_DIR does not exist: {STATIC_DIR}")
    except Exception as e:
        import traceback
        err_msg = traceback.format_exc()
        _log(f"ERROR during backend import:\n{err_msg}")
        
        # Fallback minimal app
        _log("Falling back to minimal FastAPI app...")
        from fastapi import FastAPI
        from fastapi.middleware.cors import CORSMiddleware
        backend_app = FastAPI()
        backend_app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

    prepared_app[0] = backend_app
    _log("Backend preparation complete.")
    ready.set()

# ─── Entry ─────────────────────────────────────────────────────────────────────
def main():
    sp    = Splash()
    ready = threading.Event()
    sp.set(0.04, "Initializing runtime environment...")
    
    prepared_app = [None]
    
    # Start background preparation
    threading.Thread(target=_prepare_server, args=(sp, ready, prepared_app), daemon=True).start()
    
    def _watch():
        if not ready.wait(timeout=20):
            _log("ERROR: Server preparation timed out.")
            sp.set(0.35, "Error: initialization timeout")
            time.sleep(2.0)
            sp.close()
            return
            
        sp.set(0.45, "Loading simulation engine...")
        time.sleep(0.4)
        sp.set(0.70, "Compiling controller models...")
        time.sleep(0.4)
        sp.set(0.85, "Loading dashboard assets...")
        time.sleep(0.3)
        sp.set(1.00, "Starting mission control...")
        time.sleep(0.4)
        sp.close()
        
    threading.Thread(target=_watch, daemon=True).start()
    sp.run()
    
    # Start the server on the main thread if preparation completed successfully
    if ready.is_set() and prepared_app[0] is not None:
        _log("Splash closed. Starting uvicorn on main thread...")
        
        # Spawn thread to open default browser after uvicorn binds the port
        def open_browser():
            _log("Browser thread waiting for port...")
            url = f"http://127.0.0.1:{PORT}/"
            for _ in range(40):
                if _port_open(PORT):
                    _log("Port is active. Launching browser...")
                    time.sleep(0.2)
                    
                    # Try to open Chrome in fullscreen
                    chrome_paths = [
                        os.path.join(os.environ.get("ProgramFiles", "C:\\Program Files"), "Google\\Chrome\\Application\\chrome.exe"),
                        os.path.join(os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)"), "Google\\Chrome\\Application\\chrome.exe"),
                        os.path.join(os.environ.get("LocalAppData", "C:\\Users\\Lian Mollick\\AppData\\Local"), "Google\\Chrome\\Application\\chrome.exe")
                    ]
                    launched = False
                    for path in chrome_paths:
                        if os.path.exists(path):
                            _log(f"Launching Chrome in fullscreen: {path}")
                            try:
                                subprocess.Popen([path, "--start-fullscreen", url])
                                launched = True
                                break
                            except Exception as e:
                                _log(f"Failed to launch Chrome: {e}")

                    # Try to open Edge in fullscreen
                    if not launched:
                        edge_paths = [
                            os.path.join(os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)"), "Microsoft\\Edge\\Application\\msedge.exe"),
                            os.path.join(os.environ.get("ProgramFiles", "C:\\Program Files"), "Microsoft\\Edge\\Application\\msedge.exe")
                        ]
                        for path in edge_paths:
                            if os.path.exists(path):
                                _log(f"Launching Edge in fullscreen: {path}")
                                try:
                                    subprocess.Popen([path, "--start-fullscreen", url])
                                    launched = True
                                    break
                                except Exception as e:
                                    _log(f"Failed to launch Edge: {e}")
                    
                    # Fallback to default browser open
                    if not launched:
                        _log("Fallback to default webbrowser.open")
                        webbrowser.open(url)
                    break
                time.sleep(0.1)
            else:
                _log("ERROR: Browser thread timed out waiting for port.")
                
        threading.Thread(target=open_browser, daemon=True).start()
        
        try:
            import uvicorn
            _log("Starting uvicorn.run()...")
            uvicorn.run(prepared_app[0], host="127.0.0.1", port=PORT, log_config=None)
            _log("uvicorn.run() exited.")
        except Exception as e:
            import traceback
            err_msg = traceback.format_exc()
            _log(f"CRITICAL ERROR in main-thread uvicorn:\n{err_msg}")
    else:
        _log("Launcher exiting: server preparation was unsuccessful.")

if __name__ == "__main__":
    main()
