%% lqr_tvc.m
% LQR (Linear Quadratic Regulator) for TVC
%
% Linearized about hover/vertical flight (theta=0, theta_dot=0)
% State: [theta; theta_dot]   Input: [delta]
%
% Plant (linearized pitch channel):
%   theta_ddot = (T * L_arm / J) * delta + (M_aero / J) * theta
%
% where M_aero = -N_aero*(xcp-xcg) / J * theta (restoring)
% =====================================================

function [delta_cmd, lqr_state] = lqr_tvc(theta_ref, theta, theta_dot, ...
                                            lqr_state, t, p)

%% --- Time-varying linearized model (update gains at each step) ---
[m, J, xcg] = mass_model(t, p);
T = thrust_curve(t, p);
if T < 1.0, T = 1.0; end  % avoid divide-by-zero before ignition

% Thrust moment arm (nozzle to CG)
L_arm = p.length - xcg;

% Aerodynamic stability derivative (a22 entry in A matrix)
% theta_ddot from aero = (Cn_alpha * q * A * (xcp-xcg)) / J * theta
% Simplified at low speed (early flight), use nominal q
q_nom = 0.5 * 1.225 * 30^2;   % dynamic pressure at ~30 m/s
a22   = -(p.Cn_alpha * q_nom * p.ref_area * (p.xcp_nom - xcg)) / J;
% Note: negative = restoring (stable)

% State matrix A = [0, 1; a22, 0]
% Input matrix B = [0; T*L_arm/J]
b2 = T * L_arm / J;

%% --- LQR Gain (computed analytically for 2-state system) ---
% Cost matrices: Q penalizes angle error, R penalizes gimbal use
Q11 = 100;   % theta penalty
Q22 = 10;    % theta_dot penalty
R11 = 1;     % gimbal angle penalty

% Solve Riccati analytically for 2x2 system or use stored gains
% For simplicity: use pole placement equivalent gains
% Target poles: -5 ± 3j (fast, damped)
% LQR gains computed offline for nominal params:
K1 = sqrt(Q11 / R11);                    % angle gain
K2 = sqrt((2*K1 + Q22) / R11) * 0.5;   % rate gain
% Scale by current B to account for varying thrust
K1_scaled = K1 / max(b2, 0.01);
K2_scaled = K2 / max(b2, 0.01);

% Clamp gains to reasonable range
K1_scaled = clamp(K1_scaled, 0.01, 5.0);
K2_scaled = clamp(K2_scaled, 0.001, 1.0);

%% --- Control Law ---
e_theta    = theta_ref - theta;
e_rate     = 0 - theta_dot;      % reference rate = 0 (hold attitude)

delta_cmd  = K1_scaled * e_theta + K2_scaled * e_rate;
delta_cmd  = clamp(delta_cmd, deg2rad(-p.max_gimbal), deg2rad(p.max_gimbal));

lqr_state  = [];  % LQR is memoryless (no integrator state)

end

function y = clamp(x, lo, hi)
    y = max(lo, min(hi, x));
end
