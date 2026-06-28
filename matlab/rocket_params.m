%% rocket_params.m
% Project NEAL — Physical Parameters (Ground Truth)
% Source: ProjectNeal1.2.ork + newplotdata.csv
% All SI units unless noted.
%
% Key OR derivations:
%   CG = 62.52 cm (col 28), CP = 79.0 cm (col 27)
%   Inertia pitch: col 24 = 0.205 kg·m² (wet), 0.197 kg·m² (dry)
%   Mass wet: col 22 = 2047 g; dry: 2007.76 g (post-burnout row)
%   Motor burnout: t ≈ 1.10 s (thrust → 0, col 30)
%   Reference area: col 54 = 45.604 cm²; ref length: col 53 = 7.62 cm
% =====================================================================

function p = rocket_params()

%% Geometry
p.diameter   = 0.0762;       % m (3.00 in body tube)
p.ref_area   = 45.604e-4;    % m² (π·d²/4, matches OR col 54)
p.ref_length = 0.0762;       % m (diameter used as ref length in OR)

% Total length derived: nose-tip to nozzle
% xcg_wet = 0.6252 m, xcp = 0.790 m, static margin = 2.16 cal = 0.165 m
% Body extends ~0.08 m aft of CP (fin span + nozzle protrusion)
p.length = 0.870;            % m (nose tip → nozzle exit plane, calibrated
                              %    so L - xcg_wet ≈ 0.245 m moment arm)

%% Mass Properties
p.m_wet  = 2.047;            % kg  (2047 g, OR col 22 at t=0)
p.m_dry  = 2.00776;          % kg  (2007.76 g, OR col 22 post-burnout)
p.m_prop = p.m_wet - p.m_dry; % kg (39.24 g propellant)

%% Inertia (pitch axis, about CG) — from OR col 24
p.J_pitch_wet = 0.205;       % kg·m²  (launch)
p.J_pitch_dry = 0.197;       % kg·m²  (burnout, Δ = 0.008 kg·m²)
p.J_roll      = 0.002;       % kg·m²  (axial, col 25)

%% CG / CP (from nose tip)
p.xcg_wet = 0.6252;          % m  (62.52 cm, OR col 28 at t=0)
p.xcg_dry = 0.6252;          % m  (nearly constant: propellant is 1.9%)
p.xcp_nom = 0.790;           % m  (79.0 cm, OR col 27, conservative estimate)

%% Motor — Thrust Curve
% Extracted from OR col 30; t_burn observed at last non-zero thrust
p.t_burn   = 1.10;           % s
p.T_peak   = 75.0;           % N
% Piecewise-linear thrust table (t, N)
p.thrust_t = [0.00, 0.05, 0.10, 0.20, 0.40, 0.60, 0.80, 1.00, 1.10, 1.20];
p.thrust_N = [0,    22,   40,   63,   72,   68,   58,   30,   5,    0  ];

%% Aerodynamics (OR, small-angle linearised)
p.Cd0      = 0.45;           % axial drag (low AoA, from OR col 33)
p.Cd_slope = 0.012;          % ΔCd per degree AoA
p.Cn_alpha = 0.45;           % normal-force slope dCn/dα (from OR col 38)
p.rho0     = 1.225;          % kg/m³ sea-level density

%% Stability
% Static margin ≈ 2.16 cal from OR: (xcp−xcg)/d = (0.790−0.6252)/0.0762
p.static_margin_cal = (p.xcp_nom - p.xcg_wet) / p.diameter; % ~2.16

%% TVC / Actuator
p.max_gimbal      = 10.0;    % deg  (hardware limit)
p.max_gimbal_rate = 200.0;   % deg/s (servo slew rate)
p.servo_tau       = 0.05;    % s    (first-order servo time constant)

%% Environment
p.g  = 9.792;                % m/s² (from OR col 26)

%% Simulation time grid
p.dt              = 0.005;   % s    (200 Hz — matches STM32 control loop)
p.t_burn_end      = p.t_burn + 0.10;  % s, TVC active window (burn + margin)

end
