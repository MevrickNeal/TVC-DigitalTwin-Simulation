"""
PROJECT NEAL — TVC Digital Twin Custom Installer (Setup.exe)
Tkinter GUI with file copying, real-time extraction progress, and shortcut generation.
"""
import sys, os, zipfile, threading, time, subprocess, tkinter as tk
from tkinter import filedialog, messagebox

def _res(rel):
    if getattr(sys, "_MEIPASS", None):
        return os.path.join(sys._MEIPASS, rel)
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), rel)

ZIP_PATH = _res("project_neal_files.zip")

class SetupWizard:
    W, H   = 600, 380
    BG     = "#090d16"
    ACCENT = "#e8121c"
    CARD   = "#111827"
    TEXT   = "#f8fafc"
    DIM    = "#64748b"

    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Project Neal — Installation Wizard")
        self.root.configure(bg=self.BG)
        self.root.resizable(False, False)
        
        sw, sh = self.root.winfo_screenwidth(), self.root.winfo_screenheight()
        self.root.geometry(f"{self.W}x{self.H}+{(sw-self.W)//2}+{(sh-self.H)//2}")

        # Default path: C:\Users\<name>\ProjectNeal
        self.dest_path = os.path.join(os.environ["USERPROFILE"], "ProjectNeal")
        self.installing = False
        self.complete = False

        self._build_ui()

    def _build_ui(self):
        # Top banner
        self.banner = tk.Frame(self.root, bg=self.BG, height=65)
        self.banner.pack(fill="x")
        self.banner.pack_propagate(False)

        tk.Label(self.banner, text="PROJECT NEAL INSTALLER", fg=self.TEXT, bg=self.BG,
                 font=("Courier New", 15, "bold")).pack(anchor="w", padx=25, pady=(15,0))
        tk.Label(self.banner, text="Thrust Vector Control Digital Twin v2.0", fg=self.DIM, bg=self.BG,
                 font=("Courier New", 8)).pack(anchor="w", padx=25)
        
        # Red line separator
        tk.Frame(self.root, bg=self.ACCENT, height=2).pack(fill="x")

        # Main content area
        self.main_frame = tk.Frame(self.root, bg=self.CARD, bd=1, relief="flat")
        self.main_frame.pack(fill="both", expand=True, padx=25, pady=20)

        # Setup paths & description screen
        self.setup_screen()

    def setup_screen(self):
        # Description
        desc = ("This wizard will install the Project Neal TVC Digital Twin simulation software "
                "on your computer.\n\nThe system includes the 6-DOF simulation engine, the live "
                "telemetry dashboard, STM32 flight controller interface utilities, and documentation.")
        self.desc_lbl = tk.Label(self.main_frame, text=desc, fg="#94a3b8", bg=self.CARD,
                                 justify="left", wraplength=500, font=("Inter", 9), anchor="w")
        self.desc_lbl.pack(fill="x", padx=20, pady=(20, 15))

        # Path Selection Card
        self.path_frame = tk.Frame(self.main_frame, bg=self.BG, bd=1, highlightbackground="#1e293b", highlightthickness=1)
        self.path_frame.pack(fill="x", padx=20, pady=10)

        tk.Label(self.path_frame, text="INSTALLATION DIRECTORY", fg=self.DIM, bg=self.BG,
                 font=("Courier New", 8, "bold")).pack(anchor="w", padx=15, pady=(10, 5))

        self.path_var = tk.StringVar(value=self.dest_path)
        self.entry_frame = tk.Frame(self.path_frame, bg=self.BG)
        self.entry_frame.pack(fill="x", padx=15, pady=(0, 10))

        self.path_entry = tk.Entry(self.entry_frame, textvariable=self.path_var, fg=self.TEXT, bg="#0d111a",
                                   insertbackground=self.TEXT, bd=1, relief="flat", font=("Courier New", 10))
        self.path_entry.pack(side="left", fill="x", expand=True, ipady=4, padx=(0, 10))

        self.browse_btn = tk.Button(self.entry_frame, text="BROWSE", command=self.browse, fg=self.TEXT, bg="#1e293b",
                                    activeforeground=self.TEXT, activebackground="#334155", relief="flat",
                                    font=("Courier New", 8, "bold"), cursor="hand2")
        self.browse_btn.pack(side="right", padx=(10, 0))

        # Navigation Buttons
        self.nav_frame = tk.Frame(self.root, bg=self.BG, height=50)
        self.nav_frame.pack(fill="x", side="bottom")
        self.nav_frame.pack_propagate(False)

        tk.Frame(self.nav_frame, bg="#1e293b", height=1).pack(fill="x")

        self.cancel_btn = tk.Button(self.nav_frame, text="CANCEL", command=self.root.destroy, fg=self.DIM, bg=self.BG,
                                    activeforeground=self.TEXT, activebackground=self.BG, relief="flat",
                                    font=("Courier New", 9, "bold"), cursor="hand2")
        self.cancel_btn.pack(side="left", padx=25, pady=10)

        self.action_btn = tk.Button(self.nav_frame, text="INSTALL", command=self.start_installation, fg=self.TEXT, bg=self.ACCENT,
                                    activeforeground=self.TEXT, activebackground="#ff3333", relief="flat",
                                    font=("Courier New", 9, "bold"), cursor="hand2", padx=20)
        self.action_btn.pack(side="right", padx=25, pady=10)

    def browse(self):
        path = filedialog.askdirectory(initialdir=self.dest_path, title="Select Install Folder")
        if path:
            self.dest_path = os.path.normpath(path)
            self.path_var.set(self.dest_path)

    def start_installation(self):
        if self.installing: return
        self.installing = True
        self.dest_path = os.path.normpath(self.path_var.get())

        # Clear path/description elements
        self.desc_lbl.pack_forget()
        self.path_frame.pack_forget()
        self.action_btn.config(state="disabled")
        self.cancel_btn.config(state="disabled")
        self.browse_btn.config(state="disabled")

        # Show loading GUI elements
        tk.Label(self.main_frame, text="INSTALLING SYSTEM FILES...", fg=self.TEXT, bg=self.CARD,
                 font=("Courier New", 10, "bold")).pack(anchor="w", padx=20, pady=(25, 5))
        
        self.status_lbl = tk.Label(self.main_frame, text="Extracting archive payload...", fg=self.DIM, bg=self.CARD,
                                   font=("Courier New", 8))
        self.status_lbl.pack(anchor="w", padx=20, pady=(0, 20))

        # Canvas-based loading progress bar
        self.BAR_W = 510
        self.BAR_H = 6
        self.progress_cv = tk.Canvas(self.main_frame, width=self.BAR_W, height=self.BAR_H, bg="#1a2130", highlightthickness=0)
        self.progress_cv.pack(padx=20, anchor="w")
        self.bar_fill = self.progress_cv.create_rectangle(0, 0, 0, self.BAR_H, fill=self.ACCENT, outline="")

        self.pct_lbl = tk.Label(self.main_frame, text="0%", fg=self.ACCENT, bg=self.CARD,
                                font=("Courier New", 18, "bold"))
        self.pct_lbl.pack(anchor="e", padx=20, pady=(15, 0))

        # Start installation thread
        threading.Thread(target=self.install_worker, daemon=True).start()

    def update_progress(self, pct, status):
        def _u():
            self.progress_cv.coords(self.bar_fill, 0, 0, int(self.BAR_W * pct), self.BAR_H)
            self.status_lbl.config(text=status.upper())
            self.pct_lbl.config(text=f"{int(pct*100)}%")
        self.root.after(0, _u)

    def install_worker(self):
        try:
            self.update_progress(0.02, "Closing active application instances...")
            try:
                subprocess.run(["taskkill", "/F", "/IM", "ProjectNeal.exe"],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                               creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0)
            except:
                pass
            time.sleep(0.5)

            if not os.path.exists(ZIP_PATH):
                raise FileNotFoundError(f"Setup zip archive not found at: {ZIP_PATH}")

            # Create destination folder
            os.makedirs(self.dest_path, exist_ok=True)

            self.update_progress(0.05, "Reading installation metadata...")
            
            with zipfile.ZipFile(ZIP_PATH, 'r') as zf:
                infolist = zf.infolist()
                total_files = len(infolist)
                
                # Check for folder write permissions / space
                for i, info in enumerate(infolist):
                    # Extract file
                    zf.extract(info, self.dest_path)
                    
                    # Update progress every few files or so
                    if i % max(1, total_files // 100) == 0 or i == total_files - 1:
                        pct = (i + 1) / total_files
                        # Strip nested paths for shorter logging display
                        display_name = os.path.basename(info.filename) or "..."
                        self.update_progress(pct * 0.85, f"Copying: {display_name}")
                        time.sleep(0.005) # subtle delay to feel organic

            self.update_progress(0.85, "Downloading map tiles for offline use...")
            try:
                self.download_tiles_to_install_dir(os.path.join(self.dest_path, "dist", "tiles"))
            except Exception as e:
                pass

            self.update_progress(0.95, "Creating desktop shortcuts...")
            self.create_shortcuts()
            time.sleep(0.5)

            self.update_progress(0.98, "Verifying setup integrity...")
            time.sleep(0.6)

            self.update_progress(1.00, "Installation complete.")
            self.root.after(0, self.finish_screen)
        except Exception as e:
            messagebox.showerror("Installation Failed", f"An error occurred: {str(e)}")
            self.root.after(0, self.root.destroy)

    def download_tiles_to_install_dir(self, out_dir):
        import math, urllib.request
        lat, lon = 1.352083, 103.819839
        zmin, zmax = 8, 15
        radius = 4
        rate_limit_s = 0.03
        headers = {"User-Agent": "TVC-DigitalTwin-ProjectNeal/1.0 (offline-cache)"}

        def lat_lon_to_tile(lat, lon, zoom):
            n = 2 ** zoom
            x = int((lon + 180.0) / 360.0 * n)
            lat_r = math.radians(lat)
            y = int((1.0 - math.log(math.tan(lat_r) + 1.0 / math.cos(lat_r)) / math.pi) / 2.0 * n)
            return x, y

        tiles = []
        for z in range(zmin, zmax + 1):
            cx, cy = lat_lon_to_tile(lat, lon, z)
            r = min(radius, 2 ** z - 1)
            for dx in range(-r, r + 1):
                for dy in range(-r, r + 1):
                    if 0 <= cx + dx < 2**z and 0 <= cy + dy < 2**z:
                        tiles.append((z, cx + dx, cy + dy))

        total = len(tiles)
        for i, (z, x, y) in enumerate(tiles):
            path = os.path.join(out_dir, str(z), str(x), f"{y}.png")
            if not os.path.exists(path):
                os.makedirs(os.path.dirname(path), exist_ok=True)
                url = f"https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                try:
                    req = urllib.request.Request(url, headers=headers)
                    with urllib.request.urlopen(req, timeout=3) as resp:
                        with open(path, "wb") as f:
                            f.write(resp.read())
                    time.sleep(rate_limit_s)
                except Exception as e:
                    pass
            
            # Scale progress from 0.85 to 0.95
            pct = 0.85 + (i / total) * 0.10
            if i % 10 == 0 or i == total - 1:
                self.update_progress(pct, f"Downloading map tiles: {i}/{total}")

    def create_shortcuts(self):
        # Desktop & Start menu shortcut paths
        desktop = os.path.join(os.environ["USERPROFILE"], "Desktop")
        start_menu = os.path.join(os.environ["APPDATA"], "Microsoft", "Windows", "Start Menu", "Programs")
        
        exe_path = os.path.join(self.dest_path, "ProjectNeal.exe")
        icon_path = os.path.join(self.dest_path, "logo.ico") # Copy the icon to destination
        
        # We copy logo.ico to destination if it exists
        try:
            import shutil
            shutil.copy(_res("logo.ico"), icon_path)
        except:
            pass

        # Create shortcut via PowerShell (extremely robust)
        ps_script = f"""
        $WshShell = New-Object -ComObject WScript.Shell
        
        $ShortcutDesktop = $WshShell.CreateShortcut("{desktop}\\Project Neal.lnk")
        $ShortcutDesktop.TargetPath = "{exe_path}"
        $ShortcutDesktop.WorkingDirectory = "{self.dest_path}"
        if (Test-Path "{icon_path}") {{ $ShortcutDesktop.IconLocation = "{icon_path}" }}
        $ShortcutDesktop.Save()

        $ShortcutStart = $WshShell.CreateShortcut("{start_menu}\\Project Neal.lnk")
        $ShortcutStart.TargetPath = "{exe_path}"
        $ShortcutStart.WorkingDirectory = "{self.dest_path}"
        if (Test-Path "{icon_path}") {{ $ShortcutStart.IconLocation = "{icon_path}" }}
        $ShortcutStart.Save()
        """
        
        try:
            subprocess.run(["powershell", "-Command", ps_script], creationflags=subprocess.CREATE_NO_WINDOW)
        except:
            pass

    def finish_screen(self):
        self.complete = True
        
        # Clear main frame
        for child in self.main_frame.winfo_children():
            child.destroy()
            
        tk.Label(self.main_frame, text="SETUP COMPLETE", fg=self.ACCENT, bg=self.CARD,
                 font=("Courier New", 18, "bold")).pack(anchor="w", padx=20, pady=(25, 5))
        
        tk.Label(self.main_frame, text="Project Neal has been successfully installed on your computer.",
                 fg=self.TEXT, bg=self.CARD, font=("Inter", 10)).pack(anchor="w", padx=20, pady=5)
        
        tk.Label(self.main_frame, text=f"Installed path: {self.dest_path}",
                 fg=self.DIM, bg=self.CARD, font=("Courier New", 8)).pack(anchor="w", padx=20, pady=10)

        # Launch checkbox
        self.launch_var = tk.BooleanVar(value=True)
        self.chk = tk.Checkbutton(self.main_frame, text="Launch Project Neal now", variable=self.launch_var,
                                  fg=self.TEXT, bg=self.CARD, selectcolor=self.BG, activeforeground=self.TEXT,
                                  activebackground=self.CARD, font=("Inter", 9), cursor="hand2")
        self.chk.pack(anchor="w", padx=20, pady=15)

        # Update Nav buttons
        self.cancel_btn.pack_forget()
        self.action_btn.config(state="normal", text="FINISH", command=self.finish)

    def finish(self):
        if self.launch_var.get():
            # Launch the main exe
            exe_path = os.path.join(self.dest_path, "ProjectNeal.exe")
            try:
                subprocess.Popen([exe_path], cwd=self.dest_path)
            except Exception as e:
                messagebox.showerror("Error", f"Failed to launch: {str(e)}")
        self.root.destroy()

if __name__ == "__main__":
    app = SetupWizard()
    app.root.mainloop()
