from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import math
import asyncio

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Try to import matlab.engine, but provide a fallback if it fails.
HAS_MATLAB = False
try:
    import matlab.engine
    eng = matlab.engine.start_matlab()
    HAS_MATLAB = True
    print("MATLAB Engine started successfully.")
except ImportError:
    print("WARNING: matlab.engine not found. Using mock simulation mode.")
except Exception as e:
    print(f"WARNING: Failed to start MATLAB engine: {e}. Using mock simulation mode.")

class SimParams(BaseModel):
    scenario: str = "nominal"
    controller_idx: int = 1
    m_wet: float = 2.055
    thrust_N: float = 75.0

@app.post("/api/simulate")
async def run_simulation(params: SimParams):
    if HAS_MATLAB:
        try:
            # We must use asyncio.to_thread because matlab engine calls are blocking
            # Assuming MATLAB is launched in the directory containing run_sim_api
            # We'll configure that in the production startup or add path here.
            eng.addpath(r'..\..\simulation', nargout=0)
            
            res = await asyncio.to_thread(
                eng.run_sim_api, 
                params.scenario, 
                float(params.controller_idx), 
                {"m_wet": float(params.m_wet), "thrust_N": float(params.thrust_N)}
            )
            
            # Convert MATLAB arrays to Python lists
            def m2list(arr):
                return [val[0] for val in arr]
                
            return {
                "t": m2list(res["t"]),
                "theta": m2list(res["theta"]),
                "delta": m2list(res["delta"]),
                "altitude": m2list(res["altitude"]),
                "drift_x": m2list(res["drift_x"])
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    else:
        # MOCK MODE (For UI Development when MATLAB engine is not available)
        await asyncio.sleep(0.5) # simulate some processing delay
        dt = 0.01
        N = 120
        t = [i * dt for i in range(N)]
        
        theta = []
        delta = []
        alt = []
        drift_x = []
        
        # Fake physics
        current_alt = 0
        current_drift = 0
        current_v = 0
        
        for i, time in enumerate(t):
            # Target is 5 degrees
            if params.controller_idx == 4: # ADRC is perfect
                th = 5.0 * (1 - math.exp(-3*time))
            else: # PID has some overshoot
                th = 5.0 * (1 - math.exp(-2*time) * math.cos(8*time))
                
            theta.append(th)
            delta.append(math.sin(10*time) * 2 * math.exp(-time))
            
            current_v += (params.thrust_N / params.m_wet - 9.81) * dt
            current_alt += current_v * dt
            alt.append(current_alt)
            
            current_drift += current_v * math.sin(math.radians(th)) * dt
            drift_x.append(current_drift)
            
        return {
            "t": t,
            "theta": theta,
            "delta": delta,
            "altitude": alt,
            "drift_x": drift_x
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
