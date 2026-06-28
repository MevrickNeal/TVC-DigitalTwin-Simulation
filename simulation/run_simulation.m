%% run_simulation.m
% Master Simulation Script — Project NEAL Digital Twin
% Compares PID, LQI, MRAC, and ADRC under identical conditions.
%
% Usage:
%   run_simulation            % nominal flight
%   run_simulation('wind')    % sinusoidal wind gust (external moment)
%   run_simulation('cg')      % +15% CG uncertainty
%
% Metrics reported (all post-step, from t=0):
%   RMSE     — full-window RMS tracking error (deg)
%   SS-RMSE  — steady-state RMSE (last 25% of powered flight) (deg)
%   OS       — percent overshoot above 5° reference
%   Ts       — 5% settling time (±0.25°), standard aerospace criterion
%   T90      — 90% rise time (time to first reach 4.5°)
%   Effort   — integrated absolute gimbal angle ∫|δ|dt (rad·s)
% =====================================================================

function run_simulation(scenario)

if nargin < 1, scenario = 'nominal'; end

addpath(fullfile(fileparts(mfilename('fullpath')), '..', 'matlab'));
addpath(fullfile(fileparts(mfilename('fullpath')), '..', 'matlab', 'controllers'));

p = rocket_params();

%% Simulation grid
t_span = 0 : p.dt : p.t_burn_end;
N      = length(t_span);

%% Reference signal: +5° step at t = 0 (full powered phase available)
STEP_AMP_DEG = 5.0;
theta_ref_fcn = @(t) deg2rad(STEP_AMP_DEG);   % constant reference

%% Scenario modifications
switch scenario
    case 'wind'
        % Wind modelled as moment disturbance via p.w_dist (set each step)
        % Peak sinusoidal wind = 8 m/s → equivalent angle ≈ 2° perturbation
        wind_moment_fcn = @(t) deg2rad(2.0) * sin(2*pi*0.8*t) .* (t > 0.1);
    case 'cg'
        p.xcg_wet = p.xcg_wet * 1.15;    % +15% CG shift
        p.xcg_dry = p.xcg_dry * 1.15;
        wind_moment_fcn = @(t) 0;
    otherwise  % nominal
        wind_moment_fcn = @(t) 0;
end

%% Controller definitions
ctrl_names = {'PID', 'LQI', 'MRAC', 'ADRC'};
n_ctrl = 4;

%% Storage
theta_hist = zeros(N, n_ctrl);
delta_hist = zeros(N, n_ctrl);
h_hist     = zeros(N, 1);
v_hist     = zeros(N, 1);

%% Run each controller
for ic = 1:n_ctrl
    fprintf('Running %s ...\n', ctrl_names{ic});

    x = zeros(6,1);          % [θ, θ̇, φ, φ̇, h, ḣ]
    delta_p_act = 0;          % servo state
    theta_est_prev = 0;       % sensor state

    switch ic
        case 1  % PID
            cs.int_outer = 0; cs.int_inner = 0;
            cs.e_theta_prev = 0; cs.e_rate_prev = 0;
        case 2  % LQI
            cs.int_e = 0;
        case 3  % MRAC
            cs.theta_m = 0; cs.theta_dot_m = 0;
            cs.K_theta = 3.0; cs.K_rate = 0.8; cs.K_ff = 1.0;
        case 4  % ADRC
            cs.z1 = 0; cs.z2 = 0; cs.z3 = 0; cs.u_prev = 0;
    end

    for k = 1:N
        t = t_span(k);

        % Wind disturbance as p field (read inside nonlinear_eom)
        p.w_dist = wind_moment_fcn(t);

        % Sensor: gyro-only during thrust (accel contaminated by T/m)
        T_now = thrust_curve(t, p);
        [theta_est, theta_dot_est] = sensor_model(x(1), x(2), ...
            theta_est_prev, p.dt, 1.0, T_now);
        theta_est_prev = theta_est;

        % Reference
        theta_ref = theta_ref_fcn(t);

        % TVC controller (active only during burn)
        if T_now < 0.5
            delta_cmd_p = 0;   % post-burnout: passive aerodynamic stability
        else
            switch ic
                case 1
                    [delta_cmd_p, cs] = pid_tvc(theta_ref, theta_est, theta_dot_est, cs, p.dt, p);
                case 2
                    [delta_cmd_p, cs] = lqr_tvc(theta_ref, theta_est, theta_dot_est, cs, t, p);
                case 3
                    [delta_cmd_p, cs] = mrac_tvc(theta_ref, theta_est, theta_dot_est, cs, p.dt, p);
                case 4
                    [delta_cmd_p, cs] = adrc_tvc(theta_ref, theta_est, theta_dot_est, cs, t, p.dt, p);
            end
        end

        % Servo dynamics
        [delta_p_act, ~] = servo_model(delta_cmd_p, delta_p_act, p.dt, p);

        % RK4 integration
        u_ctrl = [delta_p_act; 0];
        x = rk4_step(t, x, u_ctrl, p, p.dt);
        x(5) = max(x(5), 0);

        % Log
        theta_hist(k, ic) = x(1);
        delta_hist(k, ic) = delta_p_act;
        if ic == 1
            h_hist(k) = x(5);
            v_hist(k) = x(6);
        end
    end
end

%% Compute and display metrics
theta_ref_vec = arrayfun(theta_ref_fcn, t_span)';
compute_metrics(t_span, theta_hist, delta_hist, theta_ref_vec, ...
                ctrl_names, STEP_AMP_DEG, scenario);

%% Plot
plot_comparison(t_span, theta_hist, delta_hist, theta_ref_vec, ...
                ctrl_names, scenario, p);

end

%% --------------------------------------------------------
function compute_metrics(t_span, theta_hist, delta_hist, theta_ref_vec, ...
                          ctrl_names, step_amp, scenario)

fprintf('\n=== Tracking Metrics | Scenario: %-8s ===\n', scenario);
fprintf('%-6s | %-9s | %-9s | %-8s | %-8s | %-8s | %-9s\n', ...
        'Ctrl','RMSE(°)','SS-RMSE(°)','OS(%%)','Ts(s)','T90(s)','Effort');
fprintf('%s\n', repmat('-', 1, 72));

N = length(t_span);
ss_idx = round(0.75 * N);    % last 25% = steady-state window
tol5   = 0.05 * step_amp;    % 5% settling band = ±0.25°

for ic = 1:size(theta_hist, 2)
    th_deg  = rad2deg(theta_hist(:, ic));
    ref_deg = rad2deg(theta_ref_vec);
    err     = th_deg - ref_deg;

    rmse    = sqrt(mean(err.^2));
    ss_rmse = sqrt(mean(err(ss_idx:end).^2));

    peak      = max(th_deg);
    overshoot = max(0, (peak - step_amp) / step_amp * 100);

    % 5% settling time
    exceed = find(abs(err) > tol5, 1, 'last');
    if isempty(exceed)
        ts = t_span(1);
    elseif exceed >= N
        ts = NaN;
    else
        ts = t_span(exceed + 1);
    end

    % 90% rise time
    risen = find(th_deg >= 0.90 * step_amp, 1, 'first');
    t90   = t_span(max(risen, 1));
    if isempty(risen), t90 = NaN; end

    effort = sum(abs(delta_hist(:, ic))) * (t_span(2) - t_span(1));

    fprintf('%-6s | %-9.3f | %-10.3f | %-8.1f | %-8.3f | %-8.3f | %-9.4f\n', ...
            ctrl_names{ic}, rmse, ss_rmse, overshoot, ts, t90, effort);
end
end

%% --------------------------------------------------------
function x_new = rk4_step(t, x, u, p, dt)
k1 = nonlinear_eom(t,       x,           u, p);
k2 = nonlinear_eom(t+dt/2,  x+dt/2*k1,  u, p);
k3 = nonlinear_eom(t+dt/2,  x+dt/2*k2,  u, p);
k4 = nonlinear_eom(t+dt,    x+dt*k3,    u, p);
x_new = x + (dt/6)*(k1 + 2*k2 + 2*k3 + k4);
end
