%% servo_model.m
% First-order servo dynamics + rate limiter + position limiter
% Discretized with Euler forward method
%
% Usage: [delta_actual, delta_rate] = servo_model(delta_cmd, delta_prev, dt, p)
% =====================================================

function [delta_out, delta_rate] = servo_model(delta_cmd, delta_prev, dt, p)

% Clamp command to position limits
max_rad = deg2rad(p.max_gimbal);
delta_cmd = max(-max_rad, min(max_rad, delta_cmd));

% First-order lag: delta_dot = (cmd - actual) / tau
delta_dot = (delta_cmd - delta_prev) / p.servo_tau;

% Rate limiter
max_rate_rad = deg2rad(p.max_gimbal_rate);
delta_dot = max(-max_rate_rad, min(max_rate_rad, delta_dot));

% Euler integration
delta_out = delta_prev + delta_dot * dt;

% Final clamp
delta_out = max(-max_rad, min(max_rad, delta_out));
delta_rate = delta_dot;

end
