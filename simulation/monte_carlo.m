%% monte_carlo.m
% Monte Carlo robustness analysis — 500 runs per controller
% Randomizes: mass, inertia, CG, thrust, servo tau, sensor noise
%
% Outputs: violin plots + success rate table
% =====================================================

function monte_carlo(N_runs)

if nargin < 1, N_runs = 500; end

addpath(fullfile(fileparts(mfilename('fullpath')), '..', 'matlab'));
addpath(fullfile(fileparts(mfilename('fullpath')), '..', 'matlab', 'controllers'));

p_nom = rocket_params();
ctrl_names = {'PID', 'LQR', 'MRAC', 'ADRC'};
n_ctrl = length(ctrl_names);

% Storage: RMSE per controller per run
rmse_all = zeros(N_runs, n_ctrl);

fprintf('Running Monte Carlo: %d runs x %d controllers...\n', N_runs, n_ctrl);
rng(42);   % reproducible seed (IMPORTANT for paper)

for n = 1:N_runs
    if mod(n, 50) == 0
        fprintf('  Run %d / %d\n', n, N_runs);
    end

    %% --- Sample uncertain parameters ---
    p = p_nom;
    p.m_wet       = p_nom.m_wet       * (1 + 0.05 * randn());   % ±5%
    p.J_pitch_wet = p_nom.J_pitch_wet * (1 + 0.08 * randn());   % ±8%
    p.xcg_wet     = p_nom.xcg_wet     * (1 + 0.03 * randn());   % ±3%
    p.T_peak      = p_nom.T_peak      * (1 + 0.10 * randn());   % ±10%
    p.thrust_N    = p_nom.thrust_N    * (1 + 0.10 * randn());   % thrust curve scale
    p.servo_tau   = p_nom.servo_tau   * (1 + 0.20 * randn());   % ±20%
    noise_scale   = 1 + 0.5 * abs(randn());                     % 1x to 3x sensor noise

    t_span = 0 : p.dt : p.tvc_active_end;
    N_t    = length(t_span);
    theta_ref_fcn = @(t) deg2rad(5) * (t >= 0.3) - deg2rad(5) * (t >= 0.8);

    for ic = 1:n_ctrl
        x      = zeros(6,1);
        dp_act = 0;
        theta_est_prev = 0;

        switch ic
            case 1, cs.int_outer=0; cs.int_inner=0; cs.e_theta_prev=0; cs.e_rate_prev=0;
            case 2, cs=[];
            case 3, cs.theta_m=0; cs.theta_dot_m=0; cs.K_theta=2.0; cs.K_rate=0.5;
            case 4, cs.z1=0; cs.z2=0; cs.z3=0; cs.u_prev=0;
        end

        theta_vec = zeros(N_t, 1);

        for k = 1:N_t
            t = t_span(k);
            [th_est, thd_est] = sensor_model(x(1), x(2), theta_est_prev, p.dt, noise_scale);
            theta_est_prev = th_est;
            theta_ref = theta_ref_fcn(t);

            if t > p.tvc_active_end
                dcmd = 0;
            else
                switch ic
                    case 1, [dcmd, cs] = pid_tvc(theta_ref, th_est, thd_est, cs, p.dt, p);
                    case 2, [dcmd, cs] = lqr_tvc(theta_ref, th_est, thd_est, cs, t, p);
                    case 3, [dcmd, cs] = mrac_tvc(theta_ref, th_est, thd_est, cs, p.dt, p);
                    case 4, [dcmd, cs] = adrc_tvc(theta_ref, th_est, thd_est, cs, t, p.dt, p);
                end
            end

            [dp_act, ~] = servo_model(dcmd, dp_act, p.dt, p);
            x = rk4_step(t, x, [dp_act; 0], p, p.dt);
            x(5) = max(x(5), 0);
            theta_vec(k) = x(1);
        end

        theta_ref_vec = arrayfun(theta_ref_fcn, t_span)';
        err = rad2deg(theta_vec) - rad2deg(theta_ref_vec);
        rmse_all(n, ic) = sqrt(mean(err.^2));
    end
end

%% --- Results ---
fprintf('\n=== Monte Carlo Results (N=%d) ===\n', N_runs);
fprintf('%-8s | %-12s | %-12s | %-14s | %-10s\n', ...
        'Ctrl', 'Mean RMSE', 'Std RMSE', 'P(RMSE<2°)%%', '95th pct');
fprintf('%s\n', repmat('-', 1, 65));

for ic = 1:n_ctrl
    r = rmse_all(:, ic);
    fprintf('%-8s | %-12.3f | %-12.3f | %-14.1f | %-10.3f\n', ...
            ctrl_names{ic}, mean(r), std(r), sum(r < 2)/N_runs*100, prctile(r, 95));
end

%% --- Save Data ---
save_dir = fullfile(fileparts(mfilename('fullpath')), '..', 'results');
if ~exist(save_dir, 'dir'), mkdir(save_dir); end
save(fullfile(save_dir, 'monte_carlo_results.mat'), 'rmse_all', 'ctrl_names', 'N_runs');

%% --- Violin / Box Plot ---
figure('Position', [100 100 700 450]);
boxplot(rmse_all, ctrl_names, 'Colors', 'brgm', 'Symbol', '+');
grid on;
ylabel('RMSE (degrees)', 'FontSize', 12);
title(sprintf('Monte Carlo Robustness (N=%d runs)', N_runs), 'FontSize', 13);
xlabel('Controller', 'FontSize', 12);
yline(2, 'r--', '2° threshold', 'LineWidth', 1.5);
set(gca, 'FontSize', 11);
exportgraphics(gcf, fullfile(save_dir, 'monte_carlo_boxplot.pdf'), 'ContentType', 'vector');
fprintf('Monte Carlo complete. Results in: %s\n', save_dir);

end

function x_new = rk4_step(t, x, u, p, dt)
    k1 = nonlinear_eom(t,       x,           u, p);
    k2 = nonlinear_eom(t+dt/2,  x+dt/2*k1,  u, p);
    k3 = nonlinear_eom(t+dt/2,  x+dt/2*k2,  u, p);
    k4 = nonlinear_eom(t+dt,    x+dt*k3,    u, p);
    x_new = x + (dt/6)*(k1+2*k2+2*k3+k4);
end
