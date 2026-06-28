%% sensor_model.m
% IMU sensor noise model + complementary filter for state estimation
% Models realistic STM32 IMU (MPU6050-class)
%
% Noise specs (MPU6050):
%   Gyro noise:  0.005 deg/s/sqrt(Hz) → σ ≈ 0.01 deg/s at 200Hz
%   Accel noise: 400 μg/sqrt(Hz)      → σ ≈ 0.004 m/s^2 at 200Hz
%   Gyro bias:   ±0.1 deg/s (slowly drifting)
% =====================================================

function [theta_est, theta_dot_est] = sensor_model(theta_true, theta_dot_true, ...
                                                     theta_est_prev, dt, noise_scale)
% noise_scale: 1.0 = nominal, >1 = stress test

if nargin < 5, noise_scale = 1.0; end

%% --- Gyro measurement ---
sigma_gyro   = noise_scale * deg2rad(0.01);  % rad/s
bias_gyro    = noise_scale * deg2rad(0.05);  % rad/s (constant bias)
gyro_meas    = theta_dot_true + sigma_gyro * randn() + bias_gyro;

%% --- Accelerometer-based angle (for filter correction) ---
sigma_accel  = noise_scale * 0.004;          % m/s^2
accel_meas   = sin(theta_true) * 9.792 + sigma_accel * randn();
theta_accel  = asin(clamp(accel_meas / 9.792, -1, 1));

%% --- Complementary Filter ---
% alpha = high-pass weight on gyro, (1-alpha) = low-pass on accel
alpha = 0.98;
theta_est     = alpha * (theta_est_prev + gyro_meas * dt) + (1 - alpha) * theta_accel;
theta_dot_est = gyro_meas;

end

function y = clamp(x, lo, hi)
    y = max(lo, min(hi, x));
end
