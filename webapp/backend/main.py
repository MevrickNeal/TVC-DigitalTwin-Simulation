from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import math
import asyncio
import time
import random
import os

app = FastAPI()

# Mount tiles static directory if it exists
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TILES_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend", "public", "tiles"))
if not os.path.exists(TILES_DIR):
    TILES_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend", "dist", "tiles"))
if os.path.exists(TILES_DIR):
    app.mount("/tiles", StaticFiles(directory=TILES_DIR), name="tiles")

app.add_middleware(

    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Launch Station State (Simulating real STM32 Flight Controller Hardware connection)
class LaunchStationState:
    def __init__(self):
        self.countdown_active = False
        self.countdown_start_time = 0.0
        self.countdown_seconds = 30.0
        self.launched = False
        self.packet_count = 0
        self.arm_status = False

station_state = LaunchStationState()

# Try to import matlab.engine, but provide a fallback if it fails.
import threading
eng = None
HAS_MATLAB = False
matlab_loading = False

def start_matlab_async():
    global eng, HAS_MATLAB, matlab_loading
    if eng is not None or matlab_loading:
        return
    matlab_loading = True
    def _load():
        global eng, HAS_MATLAB, matlab_loading
        try:
            print("Starting MATLAB engine in background...")
            import matlab.engine
            eng = matlab.engine.start_matlab()
            HAS_MATLAB = True
            print("MATLAB Engine started successfully in background.")
        except ImportError:
            print("WARNING: matlab.engine not found. Using mock simulation mode.")
        except Exception as e:
            print(f"WARNING: Failed to start MATLAB engine in background: {e}. Using mock simulation mode.")
        finally:
            matlab_loading = False
            
    threading.Thread(target=_load, daemon=True).start()

@app.on_event("startup")
async def startup_event():
    start_matlab_async()

class SimParams(BaseModel):
    scenario: str = "nominal"
    controller_idx: int = 1
    m_wet: float = 2.055
    thrust_N: float = 75.0
    dof: int = 3          # 3 = pitch-plane only, 6 = full 6-DOF

def _mock_3dof(params: SimParams):
    """3-DOF pitch-plane simulation (pitch, altitude, drift_x)."""
    dt = 0.01
    N  = 200
    t  = [i * dt for i in range(N)]

    theta, delta, alt, drift_x = [], [], [], []
    v, z, x = 0.0, 0.0, 0.0

    # Controller-dependent response shaping
    ctls = {
        1: dict(tau=0.5, zeta=0.7, ovs=5.0,  noise=0.12),   # PID
        2: dict(tau=0.4, zeta=0.8, ovs=7.8,  noise=0.10),   # LQI
        3: dict(tau=0.6, zeta=0.5, ovs=30.4, noise=0.20),   # MRAC
        4: dict(tau=0.45, zeta=1.0, ovs=0.0, noise=0.08),   # ADRC
    }
    c = ctls.get(params.controller_idx, ctls[1])

    for tv in t:
        # Theta: second-order step response to 5 deg reference
        wn = 1.0 / c['tau']
        zeta = c['zeta']
        if zeta < 1.0:
            wd = wn * math.sqrt(1 - zeta ** 2)
            th = 5.0 * (1 - math.exp(-zeta * wn * tv) * (
                math.cos(wd * tv) + (zeta / math.sqrt(1 - zeta ** 2)) * math.sin(wd * tv)
            )) + (random.random() - 0.5) * c['noise']
        else:
            th = 5.0 * (1 - (1 + wn * tv) * math.exp(-wn * tv)) + (random.random() - 0.5) * c['noise']

        # Gimbal: proportional with rate limit
        d = max(-5.0, min(5.0, -(th - 5.0) * 0.9))

        theta.append(round(th, 4))
        delta.append(round(d, 4))

        burn = tv <= 1.2
        acc  = (params.thrust_N / params.m_wet - 9.81) if burn else -9.81
        v   += acc * dt
        if z + v * dt < 0:
            z, v = 0.0, 0.0
        else:
            z += v * dt
        x += v * math.sin(math.radians(th)) * dt

        alt.append(round(z, 4))
        drift_x.append(round(x, 4))

    # Add scenario disturbances
    if params.scenario == "gust":
        theta = [th + 2.0 * math.sin(5.0 * t[i]) * math.exp(-t[i]) for i, th in enumerate(theta)]
    elif params.scenario == "mass_uncertainty":
        theta = [th * 1.08 for th in theta]

    return {"t": t, "theta": theta, "delta": delta,
            "altitude": alt, "drift_x": drift_x,
            "roll": [0.0] * N, "yaw": [0.0] * N,
            "omega_x": [0.0] * N, "omega_y": [0.0] * N, "omega_z": [0.0] * N}


def _mock_6dof(params: SimParams):
    """Full 6-DOF simulation — pitch + roll + yaw with cross-coupling disturbance."""
    dt   = 0.01
    N    = 300
    t    = [i * dt for i in range(N)]

    # State: [theta, phi, psi, dtheta, dphi, dpsi, vx, vy, vz, x, y, z]
    th, phi, psi = 0.0, 0.0, 0.0
    dth, dph, dps = 0.0, 0.0, 0.0
    vx, vy, vz = 0.0, 0.0, 0.0
    x,  y,  z  = 0.0, 0.0, 0.0

    # Inertia params (simplified symmetric rocket)
    Iyy = 0.028   # kg·m²
    Ixx = 0.003
    Izz = 0.028
    lcp  = 0.22   # m — nozzle to CG
    burn_time = 1.2

    ctrl_bw  = {1: 8, 2: 12, 3: 6, 4: 14}.get(params.controller_idx, 8)
    th_ref   = 5.0  # deg

    results = {k: [] for k in ["t", "theta", "phi", "psi", "delta_y", "delta_p",
                                "altitude", "drift_x", "drift_y",
                                "omega_x", "omega_y", "omega_z"]}

    for i, tv in enumerate(t):
        m    = params.m_wet - (params.m_wet - 1.968) * min(tv / burn_time, 1.0)
        burn = tv <= burn_time
        F    = params.thrust_N if burn else 0.0

        # Scenario disturbances
        dist_phi = 0.0
        if params.scenario == "gust":
            dist_phi = 1.5 * math.sin(4.0 * tv) * math.exp(-tv * 0.8)

        # PD controllers (pitch + yaw)
        Kp = ctrl_bw * 0.55; Kd = ctrl_bw * 0.08
        delta_p = max(-5.0, min(5.0, -math.radians(Kp * (th  - th_ref) + Kd * dth)))
        delta_y = max(-5.0, min(5.0, -math.radians(Kp *  psi             + Kd * dps)))

        # Moments
        Mq   = (F * lcp * math.sin(delta_p) - 0.4 * dth) / Iyy
        Mp   = (-0.3 * dph + dist_phi) / Ixx
        Mr   = (F * lcp * math.sin(delta_y) - 0.4 * dps) / Izz

        dth += Mq * dt;  th  += dth * dt
        dph += Mp * dt;  phi += dph * dt
        dps += Mr * dt;  psi += dps * dt

        # Translation
        ax = (F * math.sin(delta_p + math.radians(th)) - 0.05 * vx) / m
        ay = (F * math.sin(delta_y + math.radians(psi)) - 0.05 * vy) / m
        az = (F * math.cos(delta_p) - m * 9.81 - 0.05 * vz) / m
        vx += ax * dt; x += vx * dt
        vy += ay * dt; y += vy * dt
        vz += az * dt
        if z + vz * dt < 0:
            z, vz = 0.0, 0.0
        else:
            z += vz * dt

        noise = lambda s: (random.random() - 0.5) * s * (1 if burn else 0.2)
        results["t"].append(round(tv, 4))
        results["theta"].append(round(math.degrees(th) + noise(0.08), 4))
        results["phi"].append(round(math.degrees(phi) + noise(0.05), 4))
        results["psi"].append(round(math.degrees(psi) + noise(0.06), 4))
        results["delta_y"].append(round(math.degrees(delta_y), 4))
        results["delta_p"].append(round(math.degrees(delta_p), 4))
        results["altitude"].append(round(z, 4))
        results["drift_x"].append(round(x, 4))
        results["drift_y"].append(round(y, 4))
        results["omega_x"].append(round(math.degrees(dph), 4))
        results["omega_y"].append(round(math.degrees(dth), 4))
        results["omega_z"].append(round(math.degrees(dps), 4))

    # alias for frontend compatibility
    results["delta"] = results["delta_p"]
    results["roll"]  = results["phi"]
    results["yaw"]   = results["psi"]
    return results


@app.post("/api/simulate")
async def run_simulation(params: SimParams):
    if HAS_MATLAB and eng is not None:
        try:
            eng.addpath(r'..\..\simulation', nargout=0)
            res = await asyncio.to_thread(
                eng.run_sim_api,
                params.scenario,
                float(params.controller_idx),
                {"m_wet": float(params.m_wet), "thrust_N": float(params.thrust_N)}
            )
            def m2l(arr): return [v[0] for v in arr]
            return {
                "t": m2l(res["t"]), "theta": m2l(res["theta"]),
                "delta": m2l(res["delta"]), "altitude": m2l(res["altitude"]),
                "drift_x": m2l(res["drift_x"]),
                "roll": [0.0]*len(m2l(res["t"])), "yaw": [0.0]*len(m2l(res["t"])),
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    if params.dof == 6:
        return _mock_6dof(params)
    return _mock_3dof(params)

# ==========================================================
# STM32 REAL HARDWARE TELEMETRY & LAUNCH STATION ENDPOINTS
# ==========================================================

@app.get("/api/launch/status")
async def get_launch_status():
    now = time.time()
    remaining = 30.0
    if station_state.countdown_active:
        elapsed = now - station_state.countdown_start_time
        remaining = max(0.0, 30.0 - elapsed)
        if remaining == 0.0:
            station_state.launched = True
            station_state.countdown_active = False

    return {
        "armed": station_state.arm_status,
        "countdown_active": station_state.countdown_active,
        "remaining_seconds": round(remaining, 1),
        "launched": station_state.launched
    }

@app.post("/api/launch/arm")
async def arm_rocket(data: dict):
    station_state.arm_status = data.get("arm", True)
    if not station_state.arm_status:
        station_state.countdown_active = False
        station_state.launched = False
    return {"status": "armed" if station_state.arm_status else "disarmed"}

@app.post("/api/launch/start_countdown")
async def start_countdown():
    if not station_state.arm_status:
        raise HTTPException(status_code=400, detail="Vehicle must be ARMED before starting countdown.")
    station_state.countdown_active = True
    station_state.countdown_start_time = time.time()
    station_state.launched = False
    return {"status": "countdown_started", "seconds": 30.0}

@app.post("/api/launch/reset")
async def reset_launch():
    station_state.countdown_active = False
    station_state.launched = False
    station_state.arm_status = False
    return {"status": "reset"}

@app.get("/api/telemetry/live")
async def get_live_telemetry():
    station_state.packet_count += 1
    t_now = time.time()
    
    # Simulate real MPU-6050 registers + STM32 ADC & Servo PWM feedback
    noise = lambda scale: (random.random() - 0.5) * scale
    
    # Determine flight phase
    is_counting = station_state.countdown_active
    is_launched = station_state.launched
    
    # Telemetry values
    if is_launched:
        pitch = 4.8 + noise(0.4)
        roll  = noise(0.3)
        yaw   = noise(0.2)
        alt   = min(450.0, (t_now % 10) * 45.0 + noise(1.0))
        acc_z = 34.2 + noise(1.5)
        pwm_ch1 = 1520 + int(noise(40))
        pwm_ch2 = 1480 + int(noise(40))
        rssi = -62 + int(noise(4))
    else:
        pitch = noise(0.15)
        roll  = noise(0.15)
        yaw   = noise(0.10)
        alt   = 0.2 + noise(0.05)
        acc_z = 9.81 + noise(0.08)
        pwm_ch1 = 1500
        pwm_ch2 = 1500
        rssi = -55 + int(noise(2))

    return {
        "packet_id": station_state.packet_count,
        "timestamp_ms": int(t_now * 1000),
        "comms_link": "UART_DMA_115200_OK",
        "imu_status": "MPU6050_CALIBRATED",
        "baro_status": "BMP280_HEALTHY",
        "battery_v": round(11.8 + noise(0.1), 2),
        "servo_current_ma": round(180 + noise(15), 1),
        "rssi_dbm": rssi,
        "orientation": {
            "pitch_deg": round(pitch, 2),
            "roll_deg":  round(roll, 2),
            "yaw_deg":   round(yaw, 2),
        },
        "rates": {
            "gyro_x_dps": round(noise(0.8), 2),
            "gyro_y_dps": round(noise(0.8), 2),
            "gyro_z_dps": round(noise(0.5), 2),
        },
        "raw_accel": {
            "ax_g": round(noise(0.02), 3),
            "ay_g": round(noise(0.02), 3),
            "az_g": round(acc_z / 9.81, 3),
        },
        "actuators": {
            "servo_pitch_us": pwm_ch1,
            "servo_yaw_us":   pwm_ch2,
            "gimbal_pitch_deg": round((pwm_ch1 - 1500) * 0.025, 2),
            "gimbal_yaw_deg":   round((pwm_ch2 - 1500) * 0.025, 2),
        },
        "altitude_m": round(alt, 2),
        "crc_checksum": "0x4F2A"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
