%% nonlinear_eom.m
% 6-DOF Nonlinear Equations of Motion for Project NEAL
% Pitch/Yaw decoupled (small angle, symmetry), full translational dynamics
%
% State vector:  x = [theta; theta_dot; phi; phi_dot; h; h_dot]
%   theta     = pitch angle (rad)
%   theta_dot = pitch rate (rad/s)
%   phi       = yaw angle (rad)
%   phi_dot   = yaw rate (rad/s)
%   h         = altitude (m)
%   h_dot     = vertical velocity (m/s)
%
% Inputs: u = [delta_pitch; delta_yaw] (rad, gimbal angles)
% =====================================================

function xdot = nonlinear_eom(t, x, u, p)

% Unpack states
theta     = x(1);
theta_dot = x(2);
phi       = x(3);
phi_dot   = x(4);
h         = x(5);
h_dot     = x(6);

% Unpack controls (clamp to limits)
delta_p = clamp(u(1), deg2rad(-p.max_gimbal), deg2rad(p.max_gimbal));
delta_y = clamp(u(2), deg2rad(-p.max_gimbal), deg2rad(p.max_gimbal));

%% --- Time-varying parameters ---
[m, J_pitch, xcg] = mass_model(t, p);
T = thrust_curve(t, p);
rho = atmosphere(h);

%% --- Total velocity (approximate, dominated by vertical during powered) ---
v_total = abs(h_dot) + 0.5;       % m/s, floor at 0.5 to avoid /0 at t=0

%% --- Aerodynamic Forces ---
AoA = abs(theta);                  % rad, pitch angle ≈ angle of attack (small angle)
q_dyn = 0.5 * rho * v_total^2;    % dynamic pressure (Pa)
Cd = p.Cd0 + p.Cd_slope * rad2deg(AoA);
Drag = q_dyn * p.ref_area * Cd;   % N (axial drag, opposes motion)

% Normal aerodynamic force (restoring for stable rocket)
% F_aero_restore ~ Cn_alpha * q * A * AoA (restoring moment)
Cn = p.Cn_alpha;
N_aero = q_dyn * p.ref_area * Cn * AoA; % N (restoring normal force)

% Aerodynamic restoring moment about CG
% Moment arm = xcp - xcg  (positive → stable)
xcp = p.xcp_nom;                   % simplified (constant)
M_aero_restore = -N_aero * (xcp - xcg);  % N·m (restoring, negative sign)

%% --- TVC Thrust Moments ---
% Gimbal angle creates moment about CG
% Moment arm = distance from nozzle to CG ≈ length - xcg
L_nozzle_to_cg = (p.length - xcg);     % m (approx nozzle at tail)
M_tvc_pitch = T * sin(delta_p) * L_nozzle_to_cg;   % N·m
M_tvc_yaw   = T * sin(delta_y) * L_nozzle_to_cg;   % N·m

% TVC lateral force component (on attitude dynamics)
F_lat_pitch = T * sin(delta_p);   % N (lateral force from gimbal, pitch)
F_lat_yaw   = T * sin(delta_y);   % N

%% --- Pitch Equation of Motion ---
% J * theta_ddot = M_tvc_pitch + M_aero_restore - damping
theta_ddot = (M_tvc_pitch + M_aero_restore) / J_pitch;

%% --- Yaw Equation of Motion ---
% Symmetric: same structure
phi_ddot = (M_tvc_yaw   + M_aero_restore) / J_pitch;
% (using same J_pitch for yaw - axisymmetric rocket)

%% --- Translational Dynamics (vertical) ---
% F_thrust_vertical = T * cos(theta) * cos(phi) ≈ T (small angle)
F_thrust_vertical = T * cos(delta_p) * cos(delta_y);
F_drag_vertical   = -sign(h_dot) * Drag;
F_gravity         = -m * p.g;

h_ddot = (F_thrust_vertical + F_drag_vertical + F_gravity) / m;

%% --- State Derivative ---
xdot = zeros(6,1);
xdot(1) = theta_dot;
xdot(2) = theta_ddot;
xdot(3) = phi_dot;
xdot(4) = phi_ddot;
xdot(5) = h_dot;
xdot(6) = h_ddot;

end

%% --- Helper: clamp ---
function y = clamp(x, lo, hi)
    y = max(lo, min(hi, x));
end
