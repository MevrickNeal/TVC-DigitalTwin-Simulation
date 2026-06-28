%% mrac_tvc.m
% Model Reference Adaptive Control (MRAC) — Pitch Channel TVC
%
% Reference Model (2nd-order desired response):
%   θ̈_m + 2ζω_n θ̇_m + ω_n² θ_m = ω_n² θ_ref
%   ω_n = 8 rad/s, ζ = 0.9  → T_s ≈ 0.55 s (fast enough for 1.2 s burn)
%
% Adaptation Law (MIT Gradient Descent):
%   Control law: u = K_θ·(θ_ref - θ) + K_r·(-θ̇) + K_ff·θ_ref
%   The MIT rule is: ∂K/∂t = -γ · e_m · (∂u/∂K) · sgn(b)
%   Since b(t) > 0, we have:
%     K̇_θ  = -γ_θ · e_m · (θ_ref - θ)
%     K̇_r  = -γ_r · e_m · (-θ̇)
%     K̇_ff = -γ_ff · e_m · θ_ref
%
%   where e_m = θ - θ_m  (plant vs reference model tracking error)
% =====================================================================

function [delta_cmd, cs] = mrac_tvc(theta_ref, theta, theta_dot, cs, dt, p)

%% Reference model parameters
wn   = 8.0;     % rad/s  (target closed-loop natural frequency)
zeta = 0.90;    % damping ratio (well-damped, <5% overshoot expected)

%% Propagate reference model (trapezoidal Euler)
theta_ddot_m = wn^2*(theta_ref - cs.theta_m) - 2*zeta*wn*cs.theta_dot_m;
cs.theta_dot_m = cs.theta_dot_m + theta_ddot_m * dt;
cs.theta_m     = cs.theta_m     + cs.theta_dot_m * dt;

%% Tracking error (plant vs reference model)
e_m = theta - cs.theta_m;

%% Adaptation rates
gamma_theta = 5.0;    % angle gain
gamma_rate  = 1.0;    % rate gain
gamma_ff    = 5.0;    % feedforward gain

%% MIT Rule gain updates (using proper partial derivatives of u w.r.t K)
cs.K_theta = cs.K_theta + (-gamma_theta * e_m * (theta_ref - theta)) * dt;
cs.K_rate  = cs.K_rate  + (-gamma_rate  * e_m * (-theta_dot))        * dt;
cs.K_ff    = cs.K_ff    + (-gamma_ff    * e_m * theta_ref)           * dt;

%% Anti-windup: clamp adaptive gains to physically meaningful range
cs.K_theta = max(0.1, min(15, cs.K_theta));
cs.K_rate  = max(0.1, min(8,  cs.K_rate ));
cs.K_ff    = max(-5,  min(10, cs.K_ff   ));

%% Control output: PD structure + feedforward
delta_cmd = cs.K_ff    * theta_ref        ...
          + cs.K_theta * (theta_ref - theta) ...
          + cs.K_rate  * (0 - theta_dot);

delta_cmd = max(deg2rad(-p.max_gimbal), min(deg2rad(p.max_gimbal), delta_cmd));

end
