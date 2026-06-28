%% lqr_tvc.m
% LQR with Integral Augmentation (LQI) — Pitch Channel TVC
%
% Augmented state:  xa = [θ;  θ̇;  ∫(θ_ref−θ)dt]
% Plant (linearised, time-varying):
%   θ̈ = b(t)·δ + a22·θ
%   b(t) = T(t)·L_arm(t)/J(t)       [time-varying input gain]
%   a22  = −Cₙα·q·S·(xcp−xcg)/J     [aerodynamic stability, linearised]
%
% ARE solved via MATLAB lqr() at each timestep to track b(t) variations.
% K is re-computed only when b changes by >5% (caches for speed).
% =====================================================================

function [delta_cmd, cs] = lqr_tvc(theta_ref, theta, theta_dot, cs, t, p)

dt = p.dt;

%% Time-varying plant
[~, J, xcg] = mass_model(t, p);
T           = max(thrust_curve(t, p), 1.0);    % floor: avoids b=0

L_arm = p.length - xcg;             % nozzle → CG moment arm
b     = T * L_arm / J;              % input gain [rad/s² / rad]

% Aero restoring (linearised at representative mid-burn q)
q_est = 0.5 * 1.225 * 25.0^2;      % Pa  (~25 m/s at mid-burn)
a22   = -(p.Cn_alpha * q_est * p.ref_area * (p.xcp_nom - xcg)) / J;

%% Augmented system
A = [0,   1,  0;
     a22, 0,  0;
     -1,  0,  0];
B = [0; b; 0];

Q = diag([300, 30, 80]);    % Weights: θ errors penalised most
R = 1.5;                    % Gimbal penalty (controls aggression)

%% Solve ARE — use cached K if b hasn't changed significantly
persistent K_cache b_cache
if isempty(K_cache) || abs(b - b_cache)/max(abs(b_cache),1e-3) > 0.05
    try
        K_cache = lqr(A, B, Q, R);
    catch
        % Fallback during very-low-thrust transient
        omega_c = 7.0;
        K_cache = [omega_c^2/max(b,1), 2*omega_c/max(b,1), omega_c^2*0.6/max(b,1)];
    end
    b_cache = b;
end
K = K_cache;

%% Integrator update (anti-windup)
cs.int_e = cs.int_e + (theta_ref - theta) * dt;
cs.int_e = max(-0.8, min(0.8, cs.int_e));

%% Control law (LQI tracking formulation)
xa        = [theta; theta_dot; cs.int_e];
xa_ref    = [theta_ref; 0; 0];
delta_cmd = -K * (xa - xa_ref);
delta_cmd = max(deg2rad(-p.max_gimbal), min(deg2rad(p.max_gimbal), delta_cmd));

end
