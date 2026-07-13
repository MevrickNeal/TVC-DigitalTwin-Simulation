@echo off
title Project Neal — Setup Builder
color 0C
echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║    PROJECT NEAL — TVC DIGITAL TWIN              ║
echo  ║    BUILD SYSTEM & INSTALLER GENERATOR           ║
echo  ╚══════════════════════════════════════════════════╝
echo.

:: ── Step 1: Build React frontend ───────────────────────────────────────────────
echo [1/6] Building React frontend...
cd webapp\frontend
call npx vite build
if errorlevel 1 (echo ERROR: Frontend build failed && pause && exit /b 1)
cd ..\..

:: ── Step 2: Convert logo to ICO ────────────────────────────────────────────────
echo [2/6] Converting logo to ICO...
python tools\png_to_ico.py "Project Neal.png" logo.ico
if errorlevel 1 (echo WARNING: ICO conversion failed, using default icon)

:: ── Step 3: Install packaging dependencies ─────────────────────────────────────
echo [3/6] Installing python packages...
pip install pyinstaller uvicorn[standard] fastapi pydantic starlette python-multipart pillow --quiet
if errorlevel 1 (echo ERROR: Package installation failed && pause && exit /b 1)

:: ── Step 4: Package main application into a folder ─────────────────────────────
echo [4/6] Packaging main application files...
if exist dist rmdir /s /q dist
python -m PyInstaller project_neal.spec --distpath dist --workpath build_cache --noconfirm
if errorlevel 1 (echo ERROR: PyInstaller main build failed && pause && exit /b 1)

:: ── Step 5: Compress main application folder into zip ──────────────────────────
echo [5/6] Creating setup payload archive...
python tools\zip_dist.py
if errorlevel 1 (echo ERROR: Compression failed && pause && exit /b 1)

:: ── Step 6: Package Setup.exe installer ────────────────────────────────────────
echo [6/6] Packaging Setup_ProjectNeal.exe installer...
python -m PyInstaller --onefile --noconsole --icon=logo.ico --add-data "project_neal_files.zip;." --add-data "logo.ico;." --name=Setup_ProjectNeal installer_gui.py
if errorlevel 1 (echo ERROR: PyInstaller setup build failed && pause && exit /b 1)

echo.
echo  ╔═════════════════════════════════════════════════════╗
echo  ║  BUILD SYSTEM COMPLETE                              ║
echo  ║                                                     ║
echo  ║  Setup installer: dist\Setup_ProjectNeal.exe        ║
echo  ║  Main EXE:        dist\ProjectNeal\ProjectNeal.exe  ║
echo  ╚═════════════════════════════════════════════════════╝
echo.
pause
