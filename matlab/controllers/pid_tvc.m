%% pid_tvc.m
% Cascaded PID Controller for TVC (Pitch channel)
%
% Architecture:
%   Outer loop (attitude):  θ_ref → θ̇_cmd   via PD+I
%   Inner loop (rate):      θ̇_cmd → δ_cmd   via PD+I
%
% Gains tuned for Project NEAL (J ≈ 0.205 kg·m², T ≈ 60 N, L_arm ≈ 0.245 m)
% Input gain: b = T·L/J ≈ 60·0.245/0.205 ≈ 71.7 rad/s² per rad
% Target closed-loop bandwidth ≈ 6 rad/s (well within 200 Hz sample rate)
% =====================================================================

function [delta_cmd, cs] = pid_tvc(theta_ref, theta, theta_dot, cs, dt, p)

%% Outer loop gains  (position → rate command)
Kp_o = 8.0;     % proportional
Ki_o = 2.0;     % integral  (eliminates steady-state error)
Kd_o = 1.0;     % derivative (damps oscillation)

%% Inner loop gains  (rate error → gimbal angle)
Kp_i = 1.5;
Ki_i = 0.20;
Kd_i = 0.04;

%% Outer loop ---------------------------------------------------
e_o = theta_ref - theta;

cs.int_outer    = cs.int_outer + e_o * dt;
cs.int_outer    = max(-0.8, min(0.8, cs.int_outer));   % anti-windup

d_o             = (e_o - cs.e_theta_prev) / dt;
cs.e_theta_prev = e_o;

theta_dot_cmd = Kp_o * e_o + Ki_o * cs.int_outer + Kd_o * d_o;
theta_dot_cmd = max(-deg2rad(45), min(deg2rad(45), theta_dot_cmd));

%% Inner loop ---------------------------------------------------
e_i = theta_dot_cmd - theta_dot;

cs.int_inner   = cs.int_inner + e_i * dt;
cs.int_inner   = max(-0.5, min(0.5, cs.int_inner));    % anti-windup

d_i            = (e_i - cs.e_rate_prev) / dt;
cs.e_rate_prev = e_i;

delta_cmd = Kp_i * e_i + Ki_i * cs.int_inner + Kd_i * d_i;
delta_cmd = max(deg2rad(-p.max_gimbal), min(deg2rad(p.max_gimbal), delta_cmd));

end
