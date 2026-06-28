%% adrc_tvc.m
% Active Disturbance Rejection Control (ADRC) with ESO
% Based on Han (2009) / Gao (2003) framework
%
% Extended State Observer (ESO) estimates:
%   z1 = theta (angle)
%   z2 = theta_dot (rate)
%   z3 = total disturbance (model uncertainty + wind + unmodeled dynamics)
%
% Controller cancels estimated disturbance → robust to parameter changes
% This is the most novel controller in the comparison
% =====================================================

function [delta_cmd, adrc_state] = adrc_tvc(theta_ref, theta, theta_dot, ...
                                              adrc_state, t, dt, p)

%% --- ESO Bandwidth (observer poles placed at w_obs) ---
w_obs = 50;     % rad/s (increased from 30 — faster observer)
b0    = 1.0;    % estimated input gain

% Update b0 from current thrust/inertia estimate
[~, J, xcg] = mass_model(t, p);
T = thrust_curve(t, p);
if T > 1.0
    L_arm = p.length - xcg;
    b0 = T * L_arm / J;
else
    b0 = 1.0;   % pre-ignition default
end
b0 = clamp(b0, 0.5, 50);

%% --- ESO Gains (pole placement at -w_obs) ---
beta1 = 3 * w_obs;
beta2 = 3 * w_obs^2;
beta3 = w_obs^3;

%% --- ESO Update (Euler) ---
z1 = adrc_state.z1;
z2 = adrc_state.z2;
z3 = adrc_state.z3;
u_prev = adrc_state.u_prev;

% ESO error
e_obs = z1 - theta;

% ESO dynamics (uses control input from previous step)
z1_dot = z2 - beta1 * e_obs;
z2_dot = z3 - beta2 * e_obs + b0 * u_prev;
z3_dot =    - beta3 * e_obs;

z1 = z1 + z1_dot * dt;
z2 = z2 + z2_dot * dt;
z3 = z3 + z3_dot * dt;

adrc_state.z1 = z1;
adrc_state.z2 = z2;
adrc_state.z3 = z3;

%% --- State Error Feedback ---
w_ctrl = 5.0;   % controller bandwidth (increased from 3.0)
kp = w_ctrl^2;
kd = 2 * w_ctrl;

% PD on estimated states
u0 = kp * (theta_ref - z1) - kd * z2;

% Cancel estimated disturbance
delta_cmd = (u0 - z3) / b0;

adrc_state.u_prev = delta_cmd;

delta_cmd = clamp(delta_cmd, deg2rad(-p.max_gimbal), deg2rad(p.max_gimbal));

end

function y = clamp(x, lo, hi)
    y = max(lo, min(hi, x));
end
