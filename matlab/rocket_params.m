%% rocket_params.m
% Project NEAL - Physical Parameters
% Extracted from: ProjectNeal1.2.ork / newplotdata.csv
% Units: SI unless stated
% =====================================================

function p = rocket_params()

%% --- Geometry ---
p.diameter    = 0.0762;          % m (3 in)
p.length      = 0.785;           % m (estimated from CG/CP positions)
p.ref_area    = 45.604e-4;       % m^2 (from OR: 45.604 cm^2)
p.ref_length  = 0.0762;          % m (diameter = ref length)

%% --- Mass Properties ---
p.m_wet       = 2.047;           % kg (launch mass from OR: 2047 g)
p.m_dry       = 2.00776;         % kg (post-burnout: 2007.76 g)
p.m_prop      = p.m_wet - p.m_dry; % kg (propellant mass = 0.0392 kg)

%% --- Inertia (at launch, about CG) ---
p.J_pitch_wet = 0.205;           % kg·m^2 (from OR, col 24)
p.J_roll_wet  = 0.002;           % kg·m^2 (from OR, col 25)
p.J_pitch_dry = 0.197;           % kg·m^2 (post-burnout, from OR)
p.J_roll_dry  = 0.002;           % kg·m^2

%% --- CG / CP Locations (from nose tip) ---
p.xcg_wet     = 0.6252;          % m (62.52 cm from OR)
p.xcg_dry     = 0.6252;          % m (stays ~constant, small motor)
p.xcp_nom     = 0.790;           % m (79.0 cm at burnout from OR ~78-79 cm)

%% --- Motor / Thrust ---
p.t_burn      = 1.10;            % s (burnout from OR ~t=1.1s, thrust→0)
p.T_peak      = 75.0;            % N (approx peak from OR col 30)
p.T_avg       = 45.0;            % N (rough average during burn)
% Time-thrust table (from OR col 30 at key points)
p.thrust_t    = [0, 0.05, 0.1, 0.2, 0.4, 0.6, 0.8, 1.0, 1.1, 1.2];
p.thrust_N    = [0, 22,   40,  63,  72,  68,  58,  30,  5,   0  ];

%% --- Aerodynamics (from OR) ---
p.Cd0         = 0.45;            % drag coefficient (from OR at low AoA)
p.Cd_slope    = 0.012;           % Cd increase per degree AoA (approx)
p.Cn_alpha    = 0.45;            % normal force slope (from OR)
p.rho0        = 1.225;           % kg/m^3 (sea-level air density)

%% --- Stability ---
p.stability_cal = 1.9;           % calibers (from OR during burn)
% Static margin (m) = stability_cal * diameter
p.static_margin = p.stability_cal * p.diameter; % ~0.145 m

%% --- TVC / Actuator ---
p.max_gimbal  = 10.0;            % deg (max gimbal angle)
p.max_gimbal_rate = 200.0;       % deg/s (servo speed limit)
p.servo_tau   = 0.05;            % s (first-order servo time constant)
p.gimbal_arm  = 0.02;            % m (distance from thrust axis to gimbal pivot)

%% --- Environment ---
p.g           = 9.792;           % m/s^2 (from OR)

%% --- Simulation ---
p.t_end       = 4.2;             % s (simulate through apogee at 4.127s)
p.dt          = 0.005;           % s (200 Hz)

%% --- Controller Phase ---
% TVC is active only during powered flight (0 to t_burn)
% After burnout, aerodynamic stability provides passive stabilisation
p.tvc_active_end = p.t_burn + 0.1; % small margin

end
