%% sensor_model.m
% IMU sensor noise model + complementary filter
% Models MPU6050-class IMU on STM32 TVC board
%
% KEY PHYSICS: During powered flight, the accelerometer measures
%   specific force = (thrust + gravity)/m — NOT pure gravity.
%   Therefore accel-based tilt is invalid during burn.
%   Use gyro-only integration (alpha=1) during thrust phase.
%   After burnout, re-enable accelerometer correction.
%
% Noise specs (MPU6050 @ 200 Hz):
%   Gyro noise:  sigma ≈ 0.01 deg/s
%   Gyro bias:   0.05 deg/s (modelled constant per flight)
%   Accel noise: sigma ≈ 0.004 m/s²
% =====================================================

function [theta_est, theta_dot_est] = sensor_model(theta_true, theta_dot_true, ...
                                                     theta_est_prev, dt, noise_scale, thrust)
% thrust: current thrust (N) — accel correction disabled when thrust > 0
if nargin < 5, noise_scale = 1.0; end
if nargin < 6, thrust = 0; end

%% --- Gyro measurement ---
sigma_gyro = noise_scale * deg2rad(0.01);   % rad/s RMS noise
bias_gyro  = noise_scale * deg2rad(0.05);   % rad/s constant bias
gyro_meas  = theta_dot_true + sigma_gyro * randn() + bias_gyro;

%% --- Complementary Filter ---
% During thrust: alpha = 1 (gyro only — accel unusable)
% After burnout: alpha = 0.98 (gyro HPF + accel LPF)
if thrust > 1.0
    alpha = 1.0;    % powered phase: gyro-only, no accel drift correction
else
    % Post-burnout: accel reliable again
    sigma_accel = noise_scale * 0.004;
    accel_meas  = sin(theta_true) * 9.792 + sigma_accel * randn();
    theta_accel = asin(clamp(accel_meas / 9.792, -1, 1));
    alpha = 0.98;
    theta_est = alpha * (theta_est_prev + gyro_meas * dt) + (1 - alpha) * theta_accel;
    theta_dot_est = gyro_meas;
    return;
end

theta_est     = theta_est_prev + gyro_meas * dt;   % pure gyro integration
theta_dot_est = gyro_meas;

end

function y = clamp(x, lo, hi)
    y = max(lo, min(hi, x));
end
