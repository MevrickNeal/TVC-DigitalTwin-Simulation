%% pid_tvc.m
% Cascaded PID Controller for TVC
% Outer loop: attitude (theta → theta_dot_cmd)
% Inner loop: rate    (theta_dot_cmd → delta_cmd)
%
% Tuned for Project NEAL: settling ~1.6s, overshoot ~8% (matches thesis)
% =====================================================

function [delta_cmd, pid_state] = pid_tvc(theta_ref, theta, theta_dot, ...
                                           pid_state, dt, p)

%% --- Gains (tuned for NEAL parameters) ---
% Outer loop (position → rate)
Kp_outer = 6.0;    % increased from 4.0
Ki_outer = 1.5;    % increased from 0.2 (main fix for SS error)
Kd_outer = 0.8;    % increased from 0.5

% Inner loop (rate → gimbal)
Kp_inner = 1.2;    % increased from 0.8
Ki_inner = 0.15;   % increased from 0.05
Kd_inner = 0.03;   % slightly increased

%% --- Outer loop: theta error → theta_dot command ---
e_theta         = theta_ref - theta;
pid_state.int_outer = pid_state.int_outer + e_theta * dt;
pid_state.int_outer = clamp(pid_state.int_outer, -0.5, 0.5);  % anti-windup

d_theta = (e_theta - pid_state.e_theta_prev) / dt;
pid_state.e_theta_prev = e_theta;

theta_dot_cmd = Kp_outer * e_theta ...
              + Ki_outer * pid_state.int_outer ...
              + Kd_outer * d_theta;
theta_dot_cmd = clamp(theta_dot_cmd, -deg2rad(30), deg2rad(30));

%% --- Inner loop: theta_dot error → gimbal angle ---
e_rate          = theta_dot_cmd - theta_dot;
pid_state.int_inner = pid_state.int_inner + e_rate * dt;
pid_state.int_inner = clamp(pid_state.int_inner, -0.3, 0.3);  % anti-windup

d_rate = (e_rate - pid_state.e_rate_prev) / dt;
pid_state.e_rate_prev = e_rate;

delta_cmd = Kp_inner * e_rate ...
          + Ki_inner * pid_state.int_inner ...
          + Kd_inner * d_rate;

% Clamp gimbal command
delta_cmd = clamp(delta_cmd, deg2rad(-p.max_gimbal), deg2rad(p.max_gimbal));

end

function y = clamp(x, lo, hi)
    y = max(lo, min(hi, x));
end
