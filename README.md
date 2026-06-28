# Thrust Vector Control (TVC) Digital Twin & Multi-Controller Benchmark

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MATLAB](https://img.shields.io/badge/MATLAB-R2023b%2B-blue.svg)](https://www.mathworks.com/products/matlab.html)

An open-source, high-fidelity **Digital Twin** and comparative benchmark framework for low-altitude, small-scale Thrust Vector Controlled (TVC) rockets. Built on physical parameters extracted from OpenRocket telemetry (**Project NEAL**), this repository provides a non-linear 6-DOF simulation environment and evaluates four distinct attitude control algorithms under time-varying plant dynamics, aerodynamic restoring forces, and parametric uncertainties.

---

## 🚀 Key Features

- **High-Fidelity 6-DOF Non-Linear EOM**: Captures dynamic mass decay, time-varying pitch moment of inertia ($J_y$), center of gravity ($x_{cg}$) shifts, and non-linear dynamic pressure ($Q_{\text{dyn}}$).
- **Multi-Controller Comparison**:
  - **Cascaded PID**: Baseline dual-loop posture controller.
  - **Time-Varying LQR**: Linear quadratic regulator updating feedback gains based on instantaneous thrust and inertia.
  - **Model Reference Adaptive Control (MRAC)**: Online gradient-descent adaptation law compensating for rapid mass loss during motor burn.
  - **Active Disturbance Rejection Control (ADRC)**: Extended State Observer (ESO) estimating total internal and external disturbances.
- **Monte Carlo Robustness UQ**: Built-in 200+ run stochastic simulation framework evaluating performance across parametric uncertainty envelopes ($\pm 5\%$ mass, $\pm 8\%$ inertia, $\pm 10\%$ thrust, servo lag variations, sensor noise).
- **Publication-Ready Exports**: Automatic generation of IEEE double-column vector graphics (`.pdf`).

---

## 📊 Benchmark Results Summary

### Powered Flight Tracking (+5° Step Response)

| Controller | RMSE (deg) | Overshoot (%) | Settling Time $T_s$ (s) | Control Effort ($\int |\delta| dt$) |
| :--- | :---: | :---: | :---: | :---: |
| **Cascaded PID** | 2.214 | 2.0% | NaN (steady-state offset) | 0.0107 |
| **LQR** | 2.974 | 25.9% | NaN (no integral action) | 0.0193 |
| **MRAC (Adaptive)** | **1.999** | **0.0%** | **1.170 s** | **0.0141** |
| **ADRC (ESO)** | 2.646 | 0.0% | NaN (bandwidth limited) | 0.0161 |

### Monte Carlo Stochastic Evaluation ($N=200$ Runs)

| Controller | Mean RMSE (deg) | Std Dev (deg) | 95th Percentile (deg) | Robustness Profile |
| :--- | :---: | :---: | :---: | :--- |
| **MRAC (Adaptive)** | **2.343** | 0.049 | **2.422** | **Best overall tracking accuracy** |
| **Cascaded PID** | 2.547 | 0.021 | 2.585 | Fixed baseline performance |
| **ADRC (ESO)** | 2.834 | **0.007** | 2.842 | **Highest parametric consistency** |
| **LQR** | 3.538 | 0.047 | 3.612 | Sensitive to model variations |

---

## 🛠️ Repository Architecture

```
.
├── matlab/
│   ├── rocket_params.m      # Project NEAL physical parameters
│   ├── nonlinear_eom.m      # 6-DOF non-linear equations of motion
│   ├── mass_model.m         # Time-varying mass & inertia interpolation
│   ├── thrust_curve.m       # Solid motor thrust curve interpolation
│   ├── atmosphere.m         # ISA air density model
│   ├── servo_model.m        # Actuator lag & rate/position limits
│   ├── sensor_model.m       # IMU noise model & complementary filter
│   └── controllers/
│       ├── pid_tvc.m        # Cascaded PID controller
│       ├── lqr_tvc.m        # Time-varying LQR controller
│       ├── mrac_tvc.m       # Model Reference Adaptive Controller
│       └── adrc_tvc.m       # Active Disturbance Rejection Controller
├── simulation/
│   ├── run_simulation.m     # Master simulation runner script
│   ├── plot_comparison.m    # Plotting utility for IEEE vector figures
│   └── monte_carlo.m        # Monte Carlo uncertainty quantification script
├── results/                 # Generated PDF plots & data files
├── ProjectNeal1.2.ork       # Ground truth OpenRocket design file
└── newplotdata.csv          # High-resolution simulation export data
```

---

## 💻 Quickstart (MATLAB)

1. Clone this repository:
   ```bash
   git clone https://github.com/MevrickNeal/TVC-DigitalTwin-Simulation.git
   cd TVC-DigitalTwin-Simulation
   ```

2. Open MATLAB and run the nominal simulation benchmark:
   ```matlab
   addpath('matlab'); addpath('matlab/controllers'); addpath('simulation');
   run_simulation('nominal');
   ```

3. Run disturbance and uncertainty scenarios:
   ```matlab
   run_simulation('wind');   % Sinusoidal wind gust scenario
   run_simulation('cg');     % +15% CG shift scenario
   monte_carlo(200);          % Run 200-iteration Monte Carlo analysis
   ```

---

## 📜 Citation & License

This project is released under the [MIT License](LICENSE). 

If you use this benchmark or framework in your academic research, please cite this repository.
