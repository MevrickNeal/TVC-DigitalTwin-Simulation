"""
Embedded server entry point — bundles FastAPI backend + React static files.
Called by launcher.py as a subprocess.
"""
import sys, os, argparse

ap = argparse.ArgumentParser()
ap.add_argument("--port",    type=int, default=8765)
ap.add_argument("--static",  default="dist")
ap.add_argument("--backend", default="backend")
args = ap.parse_args()

# Add backend to path so "import main" works
sys.path.insert(0, args.backend)

# Patch uvicorn reload=False (no reload in bundle)
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Import the actual backend app
try:
    from main import app as backend_app
except Exception as e:
    print(f"Backend import error: {e}")
    # Fallback minimal app
    backend_app = FastAPI()
    backend_app.add_middleware(CORSMiddleware, allow_origins=["*"],
                               allow_methods=["*"], allow_headers=["*"])

# Mount static files LAST so API routes take priority
if os.path.isdir(args.static):
    backend_app.mount("/", StaticFiles(directory=args.static, html=True), name="static")

if __name__ == "__main__":
    uvicorn.run(backend_app, host="127.0.0.1", port=args.port, log_level="error")
