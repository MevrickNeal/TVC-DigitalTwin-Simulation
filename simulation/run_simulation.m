%% run_simulation.m
% Master simulation script — Project NEAL Digital Twin
% Runs all 4 controllers under the same scenario and plots comparison
%
% Usage:
%   run_simulation          % nominal flight, step disturbance
%   run_simulation('wind')  % wind gust scenario
%   run_simulation('cg')    % CG uncertainty scenario
% =====================================================

function run_simulation(scenario)

if nargin < 1, scenario = 'nominal'; end

addpath(fullfile(fileparts(mfilename('fullpath')), '..', 'matlab'));
addpath(fullfile(fileparts(mfilename('fullpath')), '..', 'matlab', 'controllers'));

p = rocket_params();

%% --- Simulation Setup ---
t_span = 0 : p.dt : p.tvc_active_end;
N      = length(t_span);

% Reference: single step +5° at t=0.3s (held for rest of powered flight)
theta_ref_fcn = @(t) deg2rad(5) * (t >= 0.3);
STEP_AMP_DEG  = 5.0;   % step amplitude for overshoot/settling calculation
STEP_TIME     = 0.3;   % when step occurs

% Scenario modifications
switch scenario
    case 'wind'
        wind_amp = deg2rad(3);    % wind → equivalent 3° disturbance angle
        wind_fcn = @(t) wind_amp * sin(2*pi*0.5*t) .* (t > 0.2);
    case 'cg'
        p.xcg_wet = p.xcg_wet * 1.15;  % +15% CG shift
        wind_fcn  = @(t) 0;
    otherwise  % nominal
        wind_fcn  = @(t) 0;
end

%% --- Controller Names ---
ctrl_names = {'PID', 'LQR', 'MRAC', 'ADRC'};
n_ctrl     = length(ctrl_names);

%% --- Storage ---
theta_hist   = zeros(N, n_ctrl);
thetad_hist  = zeros(N, n_ctrl);
delta_hist   = zeros(N, n_ctrl);
h_hist       = zeros(N, 1);

%% === Run Each Controller ===
for ic = 1:n_ctrl
    fprintf('Running %s ...\n', ctrl_names{ic});

    % Initial state: [theta, theta_dot, phi, phi_dot, h, h_dot]
    x = zeros(6,1);

    % Initial actuator state
    delta_p_actual = 0;
    delta_y_actual = 0;

    % Controller states
    switch ic
        case 1  % PID
            cs.int_outer = 0; cs.int_inner = 0;
            cs.e_theta_prev = 0; cs.e_rate_prev = 0;
        case 2  % LQR
            cs = [];
        case 3  % MRAC
            cs.theta_m = 0; cs.theta_dot_m = 0;
            cs.K_theta = 2.0; cs.K_rate = 0.5;
        case 4  % ADRC
            cs.z1 = 0; cs.z2 = 0; cs.z3 = 0; cs.u_prev = 0;
    end

    % Sensor state
    theta_est_prev = 0;

    for k = 1:N
        t = t_span(k);

        % Sense (with noise)
        [theta_est, theta_dot_est] = sensor_model(x(1), x(2), theta_est_prev, p.dt);
        theta_est_prev = theta_est;

        % Reference
        theta_ref = theta_ref_fcn(t) + wind_fcn(t);

        % TVC only during powered flight
        if t > p.tvc_active_end
            delta_cmd_p = 0;
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

        % Servo dynamics (pitch channel only for 2D sim)
        [delta_p_actual, ~] = servo_model(delta_cmd_p, delta_p_actual, p.dt, p);

        % EOM integration (RK4)
        u_ctrl = [delta_p_actual; 0];  % pitch only
        x = rk4_step(t, x, u_ctrl, p, p.dt);
        x(5) = max(x(5), 0);           % altitude floor

        % Store
        theta_hist(k, ic)  = x(1);
        thetad_hist(k, ic) = x(2);
        delta_hist(k, ic)  = delta_p_actual;
    end

    if ic == 1
        % Store altitude from first run (same for all controllers, open-loop altitude)
        for k2 = 1:N
            h_hist(k2) = 0; % placeholder (altitude tracked separately)
        end
    end
end

%% === Compute Metrics ===
fprintf('\n=== Performance Metrics (Pitch Channel) ===\n');
fprintf('%-8s | %-12s | %-10s | %-12s | %-14s\n', ...
        'Ctrl', 'RMSE (deg)', 'OS (%)', 'Ts (s)', 'Ctrl Effort');
fprintf('%s\n', repmat('-', 1, 65));

theta_ref_vec = arrayfun(theta_ref_fcn, t_span)';
metrics = zeros(n_ctrl, 4);

% Only evaluate after step occurs
step_idx = find(t_span >= STEP_TIME, 1);

for ic = 1:n_ctrl
    th_deg  = rad2deg(theta_hist(:,ic));
    ref_deg = rad2deg(theta_ref_vec);
    err     = th_deg - ref_deg;

    % RMSE (post-step only)
    rmse = sqrt(mean(err(step_idx:end).^2));

    % Overshoot: max deviation above step amplitude, as % of step
    peak      = max(th_deg(step_idx:end));
    overshoot = max(0, (peak - STEP_AMP_DEG) / STEP_AMP_DEG * 100);

    % Settling time: first time error stays within ±2% of step amp
    tol2pct = 0.02 * STEP_AMP_DEG;   % 0.1°
    post_err = err(step_idx:end);
    post_t   = t_span(step_idx:end);
    % Find last time error EXCEEDS tolerance → settling = next point
    unsettled = find(abs(post_err) > tol2pct, 1, 'last');
    if isempty(unsettled)
        ts = post_t(1);    % already settled at step
    elseif unsettled >= length(post_t)
        ts = NaN;          % never settled
    else
        ts = post_t(unsettled + 1);
    end

    % Control effort (integral |delta|)
    ctrl_eff = sum(abs(delta_hist(:,ic))) * p.dt;

    metrics(ic, :) = [rmse, overshoot, ts, ctrl_eff];
    fprintf('%-8s | %-12.3f | %-10.1f | %-12.3f | %-14.4f\n', ...
            ctrl_names{ic}, rmse, overshoot, ts, ctrl_eff);
end

%% === Plot ===
plot_comparison(t_span, theta_hist, delta_hist, theta_ref_vec, ctrl_names, scenario, p);

end

%% --- RK4 Integrator ---
function x_new = rk4_step(t, x, u, p, dt)
    k1 = nonlinear_eom(t,        x,            u, p);
    k2 = nonlinear_eom(t+dt/2,   x + dt/2*k1,  u, p);
    k3 = nonlinear_eom(t+dt/2,   x + dt/2*k2,  u, p);
    k4 = nonlinear_eom(t+dt,     x + dt*k3,    u, p);
    x_new = x + (dt/6) * (k1 + 2*k2 + 2*k3 + k4);
end
