%% nonlinear_eom.m
% 6-DOF Rigid-Body EOM for Project NEAL (Pitch + Vertical channels)
% Decoupled pitch/yaw assumption valid for near-vertical flight (θ < 15°)
%
% State:  x = [θ; θ̇; φ; φ̇; h; ḣ]
%   θ   = pitch angle from vertical (rad), positive nose-forward
%   θ̇   = pitch rate (rad/s)
%   φ   = yaw angle (rad)
%   φ̇   = yaw rate (rad/s)
%   h   = altitude above launch (m)
%   ḣ   = vertical velocity (m/s)
%
% Input: u = [δ_p; δ_y]  gimbal angles (rad)
%
% External disturbance: p.w_dist (rad, effective angle disturbance)
%   Added as pitch moment disturbance: M_ext = (T·L_arm)·w_dist
%   This models cross-wind as an equivalent pitch moment [N·m].
% =====================================================================

function xdot = nonlinear_eom(t, x, u, p)

theta     = x(1);    % pitch angle (rad)
theta_dot = x(2);    % pitch rate  (rad/s)
h         = x(5);    % altitude    (m)
h_dot     = x(6);    % vertical velocity (m/s)

% Clamp gimbal to hard limits
max_rad  = deg2rad(p.max_gimbal);
delta_p  = max(-max_rad, min(max_rad, u(1)));   % pitch gimbal
delta_y  = max(-max_rad, min(max_rad, u(2)));   % yaw gimbal

%% Time-varying plant parameters
[m, J, xcg] = mass_model(t, p);
T           = thrust_curve(t, p);
rho         = atmosphere(max(h, 0));

%% Aerodynamics
v_ax  = abs(h_dot);
v_tot = max(v_ax, 0.5);                         % floor: avoid /0 at launch
q_dyn = 0.5 * rho * v_tot^2;                   % dynamic pressure (Pa)

% Axial drag (opposes vertical motion)
AoA  = abs(theta);                              % rad (small-angle approx)
Cd   = p.Cd0 + p.Cd_slope * rad2deg(AoA);
F_drag = q_dyn * p.ref_area * Cd;              % N (magnitude)

% Aerodynamic restoring moment about CG (stable rocket: xcp > xcg)
% M_aero = -Cn_α · q · S · (xcp − xcg) · θ   [N·m, restoring]
moment_arm_aero = p.xcp_nom - xcg;             % m (positive → stable)
M_aero_pitch    = -(p.Cn_alpha * q_dyn * p.ref_area * moment_arm_aero) * theta;

%% TVC Moments  (nozzle is at tail: moment arm = length − xcg)
L_tvc        = p.length - xcg;                 % m  (nozzle → CG)
M_tvc_pitch  =  T * sin(delta_p) * L_tvc;     % N·m  (pitch)
M_tvc_yaw    =  T * sin(delta_y) * L_tvc;     % N·m  (yaw, symmetric)

%% External wind disturbance moment (if field defined in p)
M_wind = 0;
if isfield(p, 'w_dist')
    M_wind = T * L_tvc * p.w_dist;            % equivalent moment from wind
end

%% Rotational EOM  (axisymmetric: J_yaw ≈ J_pitch)
theta_ddot = (M_tvc_pitch + M_aero_pitch + M_wind) / J;
phi_ddot   = (M_tvc_yaw   + M_aero_pitch          ) / J;

%% Translational EOM (vertical, 1-D)
% Thrust component along vertical ≈ T·cos(δ_p)·cos(δ_y) (small angle)
F_thrust_v  = T * cos(delta_p) * cos(delta_y);
F_grav      = -m * p.g;
F_drag_v    = -sign(h_dot) * F_drag;

h_ddot = (F_thrust_v + F_grav + F_drag_v) / m;

%% Assemble state derivative
xdot    = zeros(6,1);
xdot(1) = theta_dot;
xdot(2) = theta_ddot;
xdot(3) = x(4);          % phi_dot
xdot(4) = phi_ddot;
xdot(5) = h_dot;
xdot(6) = h_ddot;

end
