# Project Neal — Building the EXE

## Prerequisites
- Python 3.10+ with pip
- Node.js 18+
- (Optional) Inno Setup 6 for creating installer: https://jrsoftware.org/isdl.php

## Quick Build

```bat
build.bat
```

This runs all 5 steps automatically:
1. `npx vite build` — compiles the React dashboard to `dist/`
2. Converts `logo.png` → `logo.ico`
3. `pip install pyinstaller uvicorn fastapi ...`
4. `pyinstaller project_neal.spec` → `dist/ProjectNeal/ProjectNeal.exe`
5. `ISCC.exe installer.iss` → `installer_out/ProjectNeal_Setup_v2.0.exe`

## Output Files

| File | Description |
|------|-------------|
| `dist/ProjectNeal/ProjectNeal.exe` | Standalone EXE (run directly) |
| `installer_out/ProjectNeal_Setup_v2.0.exe` | Windows installer |

## How It Works

```
ProjectNeal.exe
  ├─ Shows dark splash screen with animated progress bar
  ├─ Starts embedded FastAPI server on port 8765
  ├─ Serves React dashboard at http://127.0.0.1:8765/
  └─ Opens default browser → Mission Control dashboard
```

## Distribute

Share `installer_out/ProjectNeal_Setup_v2.0.exe`.
No Python, Node.js, or any other dependency needed on the target machine.
