%% mrac_tvc.m
% Model Reference Adaptive Control (MRAC) for TVC
% MIT Gradient Descent adaptation law
%
% Reference model: theta_ref_m satisfies
%   theta_ddot_m + 2*zeta*wn*theta_dot_m + wn^2*theta_m = wn^2*theta_cmd
%
% Adaptation law (MIT rule):
%   dK_theta/dt = -gamma * e_m * theta        (angle gain)
%   dK_rate/dt  = -gamma * e_m * theta_dot    (rate gain)
%
% This adapts to changing mass/inertia during burn — KEY NOVELTY vs PID/LQR
% =====================================================

function [delta_cmd, mrac_state] = mrac_tvc(theta_ref, theta, theta_dot, ...
                                              mrac_state, dt, p)

%% --- Reference Model Parameters ---
wn   = 5.0;     % rad/s (desired natural frequency)
zeta = 0.8;     % damping ratio (slightly underdamped)

%% --- Reference Model Propagation (Euler) ---
% theta_m: what ideal response should look like
theta_m      = mrac_state.theta_m;
theta_dot_m  = mrac_state.theta_dot_m;

theta_ddot_m = wn^2 * (theta_ref - theta_m) - 2*zeta*wn * theta_dot_m;
theta_dot_m  = theta_dot_m  + theta_ddot_m  * dt;
theta_m      = theta_m      + theta_dot_m   * dt;

mrac_state.theta_m     = theta_m;
mrac_state.theta_dot_m = theta_dot_m;

%% --- Tracking Error ---
e_m = theta - theta_m;           % error: actual vs reference model

%% --- Adaptive Gains (MIT Rule) ---
gamma_theta = 15.0;              % adaptation rate (angle)
gamma_rate  = 5.0;               % adaptation rate (rate)

% Update gains (gradient descent on e_m^2)
dK_theta = -gamma_theta * e_m * theta;
dK_rate  = -gamma_rate  * e_m * theta_dot;

mrac_state.K_theta = mrac_state.K_theta + dK_theta * dt;
mrac_state.K_rate  = mrac_state.K_rate  + dK_rate  * dt;

% Clamp adaptive gains (prevent windup)
mrac_state.K_theta = clamp(mrac_state.K_theta, -10, 10);
mrac_state.K_rate  = clamp(mrac_state.K_rate,  -5,  5);

%% --- Control Output ---
delta_cmd = mrac_state.K_theta * (theta_ref - theta) ...
          + mrac_state.K_rate  * (0 - theta_dot);

delta_cmd = clamp(delta_cmd, deg2rad(-p.max_gimbal), deg2rad(p.max_gimbal));

end

function y = clamp(x, lo, hi)
    y = max(lo, min(hi, x));
end
