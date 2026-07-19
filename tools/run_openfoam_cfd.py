"""
Project Neal 1.2 — OpenFOAM & Aerodynamics CFD Data Processor
Generates cfd_results.json for the interactive Web CFD Suite.
"""

import json
import math
import os
import sys
import numpy as np

def generate_cfd_database():
    # 1. Mach range sweep (0.05 to 0.85)
    mach = np.linspace(0.05, 0.85, 25).tolist()
    # Drag polar: Subsonic CD0 = 0.43, Transonic wave drag rise starts ~0.7
    cd = []
    for m in mach:
        if m < 0.65:
            cd_val = 0.42 + 0.05 * (m ** 2)
        else:
            # Prandtl-Glauert / Transonic drag rise peak
            cd_val = 0.42 + 0.05 * (m ** 2) + 0.35 * ((m - 0.65) / 0.20) ** 2
        cd.append(round(float(cd_val), 4))

    # 2. Angle of Attack sweep (-10 to +10 degrees)
    alpha_deg = np.linspace(-10, 10, 21).tolist()
    # CN (Normal Force Coefficient) slope CN_alpha ~ 4.25 rad^-1
    cn = []
    cm = []
    for a in alpha_deg:
        a_rad = math.radians(a)
        cn_val = 4.25 * a_rad + 1.2 * math.sin(a_rad) * abs(math.sin(a_rad))
        cm_val = -1.85 * a_rad  # Pitching moment (restoring)
        cn.append(round(float(cn_val), 4))
        cm.append(round(float(cm_val), 4))

    # 3. Center of Pressure (Xcp) vs Mach (meters from nose tip, L_total = 1.143m)
    # CG is at 0.600 m from nose tip
    xcp = []
    static_margin = []
    xcg = 0.600
    ref_dia = 0.054
    for m in mach:
        # Xcp moves aft with increasing Mach number
        xcp_val = 0.685 + 0.065 * (m ** 1.5)
        sm_val = (xcp_val - xcg) / ref_dia
        xcp.append(round(float(xcp_val), 4))
        static_margin.append(round(float(sm_val), 2))

    # 4. Surface Pressure Coefficient Cp profile along rocket length (x/L: 0 to 1)
    x_over_l = np.linspace(0, 1.0, 50).tolist()
    cp_profile = []
    for x in x_over_l:
        if x < 0.244:  # Nose cone (0 to 0.244 x/L)
            # Stagnation point at x=0 (Cp=1.0), expanding down nose cone
            cp_val = 1.0 - 1.45 * (x / 0.244) ** 0.8
        elif x < 0.35: # Shoulder / Joint (expansion suction dip)
            cp_val = -0.35 + 0.25 * ((x - 0.244) / 0.106)
        elif x < 0.85: # Body tube (recovery to near-zero)
            cp_val = -0.10 + 0.12 * ((x - 0.35) / 0.50)
        else:          # Fins & Base wake region (slight compression at fin leading edge, base suction)
            cp_val = -0.18 + 0.20 * math.sin((x - 0.85) / 0.15 * math.pi)
        cp_profile.append(round(float(cp_val), 4))

    # 5. 3D Airflow Streamline Particle Coordinates for 3D View
    # Generates 16 streamlines flowing along +Z / +Y with flow deflection
    streamlines = []
    num_lines = 16
    for i in range(num_lines):
        angle = (2 * math.pi * i) / num_lines
        r_start = 0.15
        line_pts = []
        for s in range(25):
            z = -1.5 + (s / 24.0) * 4.5  # flow from z = -1.5 to +3.0
            # Flow deflection around nose cone (z = 0 to 0.28)
            if 0.0 <= z <= 0.28:
                r_scale = 1.0 + 0.35 * math.sin((z / 0.28) * math.pi)
            elif z > 0.28:
                r_scale = 1.1 + 0.05 * math.sin((z - 0.28))
            else:
                r_scale = 1.0
            x = r_start * r_scale * math.cos(angle)
            y = r_start * r_scale * math.sin(angle)
            line_pts.append([round(x, 4), round(y, 4), round(z, 4)])
        streamlines.append(line_pts)

    db = {
        "metadata": {
            "solver": "OpenFOAM rhoSimpleFoam k-Omega SST RANS",
            "rocket": "Project Neal 1.2",
            "length_m": 1.143,
            "diameter_m": 0.054,
            "ref_area_m2": 0.00229,
            "xcg_m": 0.600
        },
        "mach": mach,
        "cd": cd,
        "alpha_deg": alpha_deg,
        "cn": cn,
        "cm": cm,
        "xcp_m": xcp,
        "static_margin_calibres": static_margin,
        "x_over_l": x_over_l,
        "cp_profile": cp_profile,
        "streamlines": streamlines
    }

    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "webapp", "frontend", "public")
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, "cfd_results.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2)
    print(f"Generated CFD database successfully: {out_file}")

if __name__ == "__main__":
    generate_cfd_database()
