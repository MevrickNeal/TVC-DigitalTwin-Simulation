%% monte_carlo.m
% Monte Carlo Uncertainty Quantification — Project NEAL TVC Digital Twin
%
% Samples N_runs combinations of parametric uncertainty and evaluates
% each of the 4 controllers. Reports mean, std, 95th-percentile RMSE
% and steady-state RMSE, plus Wilcoxon signed-rank test (MRAC vs PID)
% as required for Q1 statistical rigour.
%
% Uncertainty bounds (physically motivated):
%   Mass      ±5%   (fuel slump, fill variation)
%   Inertia   ±8%   (CG uncertainty → J uncertainty)
%   Thrust    ±10%  (motor-to-motor propellant variation)
%   CG        ±3%   (propellant load position)
%   Servo τ   ±20%  (temperature, supply voltage)
%   Noise     1×–3× (vibration, EMI scaling)
%
% Usage:  monte_carlo()         — default 500 runs
%         monte_carlo(200)      — custom run count
% =====================================================================

function results = monte_carlo(N_runs)

if nargin < 1, N_runs = 500; end
rng(42);   % reproducible seed (reported in paper)

addpath(fullfile(fileparts(mfilename('fullpath')), '..', 'matlab'));
addpath(fullfile(fileparts(mfilename('fullpath')), '..', 'matlab', 'controllers'));

p_nom = rocket_params();
ctrl_names = {'PID', 'LQI', 'MRAC', 'ADRC'};
n_ctrl = 4;

t_span = 0 : p_nom.dt : p_nom.t_burn_end;
N_t    = length(t_span);
ss_idx = round(0.75 * N_t);       % last 25%: steady-state window
STEP_AMP = 5.0;                    % deg

% Storage: [n_ctrl × N_runs] for RMSE and SS-RMSE
rmse_all    = zeros(n_ctrl, N_runs);
ss_rmse_all = zeros(n_ctrl, N_runs);

theta_ref_fcn = @(t) deg2rad(STEP_AMP);

fprintf('Monte Carlo: %d runs × %d controllers ...\n', N_runs, n_ctrl);

for r = 1:N_runs
    if mod(r, 50) == 0
        fprintf('  Run %d / %d\n', r, N_runs);
    end

    %% Sample perturbed parameters
    p = p_nom;
    p.m_wet       = p_nom.m_wet      * (1 + 0.05*(2*rand()-1));
    p.m_dry       = p_nom.m_dry      * (1 + 0.05*(2*rand()-1));
    p.m_prop      = max(0, p.m_wet - p.m_dry);
    p.J_pitch_wet = p_nom.J_pitch_wet* (1 + 0.08*(2*rand()-1));
    p.J_pitch_dry = p_nom.J_pitch_dry* (1 + 0.08*(2*rand()-1));
    p.thrust_N    = p_nom.thrust_N   * (1 + 0.10*(2*rand()-1));
    p.xcg_wet     = p_nom.xcg_wet    * (1 + 0.03*(2*rand()-1));
    p.xcg_dry     = p_nom.xcg_dry    * (1 + 0.03*(2*rand()-1));
    p.servo_tau   = p_nom.servo_tau  * (1 + 0.20*(2*rand()-1));
    noise_scale   = 1 + 2*rand();    % uniform [1, 3]

    for ic = 1:n_ctrl
        x          = zeros(6,1);
        delta_p    = 0;
        th_est_prv = 0;
        p.w_dist   = 0;

        switch ic
            case 1
                cs.int_outer=0; cs.int_inner=0;
                cs.e_theta_prev=0; cs.e_rate_prev=0;
            case 2, cs.int_e = 0;
            case 3
                cs.theta_m=0; cs.theta_dot_m=0;
                cs.K_theta=3.0; cs.K_rate=0.8; cs.K_ff=1.0;
            case 4
                cs.z1=0; cs.z2=0; cs.z3=0; cs.u_prev=0;
        end

        theta_log = zeros(N_t, 1);

        for k = 1:N_t
            t     = t_span(k);
            T_now = thrust_curve(t, p);

            [th_est, thd_est] = sensor_model(x(1), x(2), th_est_prv, ...
                                              p.dt, noise_scale, T_now);
            th_est_prv = th_est;

            theta_ref = theta_ref_fcn(t);

            if T_now < 0.5
                delta_cmd = 0;
            else
                switch ic
                    case 1
                        [delta_cmd, cs] = pid_tvc( theta_ref, th_est, thd_est, cs, p.dt, p);
                    case 2
                        [delta_cmd, cs] = lqr_tvc( theta_ref, th_est, thd_est, cs, t,    p);
                    case 3
                        [delta_cmd, cs] = mrac_tvc(theta_ref, th_est, thd_est, cs, p.dt, p);
                    case 4
                        [delta_cmd, cs] = adrc_tvc(theta_ref, th_est, thd_est, cs, t, p.dt, p);
                end
            end

            [delta_p, ~] = servo_model(delta_cmd, delta_p, p.dt, p);
            u_ctrl = [delta_p; 0];
            x = rk4_step(t, x, u_ctrl, p, p.dt);
            x(5) = max(x(5), 0);

            theta_log(k) = x(1);
        end

        ref_deg = STEP_AMP;
        th_deg  = rad2deg(theta_log);
        err     = th_deg - ref_deg;

        rmse_all(ic, r)    = sqrt(mean(err.^2));
        ss_rmse_all(ic, r) = sqrt(mean(err(ss_idx:end).^2));
    end
end

%% Report Results
fprintf('\n=== Monte Carlo Results (N=%d, seed=42) ===\n', N_runs);
fprintf('%-6s | %-10s | %-9s | %-9s | %-10s | %-9s\n', ...
        'Ctrl','Mean RMSE','Std RMSE','95th pct','Mean SS-RMSE','P(SS<0.5°)');
fprintf('%s\n', repmat('-', 1, 72));

for ic = 1:n_ctrl
    r_vec   = rmse_all(ic,:);
    ss_vec  = ss_rmse_all(ic,:);
    pct95   = prctile(r_vec, 95);
    p_good  = 100 * mean(ss_vec < 0.5);   % P(SS-RMSE < 0.5°)

    fprintf('%-6s | %-10.3f | %-9.3f | %-9.3f | %-12.3f | %-9.1f\n', ...
            ctrl_names{ic}, mean(r_vec), std(r_vec), pct95, mean(ss_vec), p_good);
end

%% Statistical Significance: MRAC vs PID (Wilcoxon signed-rank)
% Non-parametric: no normality assumption required
mrac_ss = ss_rmse_all(3,:)';
pid_ss  = ss_rmse_all(1,:)';
[p_val, ~] = signrank(mrac_ss, pid_ss, 'tail', 'left');
fprintf('\nWilcoxon signed-rank (MRAC SS-RMSE < PID SS-RMSE):\n');
fprintf('  p-value = %.4e  → %s\n', p_val, ...
        ternary(p_val < 0.01, 'SIGNIFICANT (p<0.01)', 'not significant'));

%% Save for paper
out_dir = fullfile(fileparts(mfilename('fullpath')), '..', 'results');
save(fullfile(out_dir, 'monte_carlo_results.mat'), ...
     'rmse_all', 'ss_rmse_all', 'ctrl_names', 'N_runs', 'p_val');
fprintf('\nResults saved to: %s\n', out_dir);

%% Box plot (publication-ready)
fig = figure('Visible','off','Position',[100,100,700,420]);
boxplot(ss_rmse_all', ctrl_names, 'Whisker', 1.5);
hold on;
yline(0.5, '--r', '0.5° threshold', 'LineWidth', 1.2);
ylabel('Steady-State RMSE (deg)', 'FontSize', 12);
xlabel('Controller', 'FontSize', 12);
title(sprintf('MC Steady-State RMSE Distribution (N=%d)', N_runs), 'FontSize', 12);
grid on; set(gca,'FontSize',11);
exportgraphics(fig, fullfile(out_dir, 'mc_ssrmse_boxplot.pdf'), 'ContentType','vector');
close(fig);

results.rmse_all    = rmse_all;
results.ss_rmse_all = ss_rmse_all;
results.p_val       = p_val;

end

%% --------------------------------------------------------
function x_new = rk4_step(t, x, u, p, dt)
k1 = nonlinear_eom(t,      x,         u, p);
k2 = nonlinear_eom(t+dt/2, x+dt/2*k1, u, p);
k3 = nonlinear_eom(t+dt/2, x+dt/2*k2, u, p);
k4 = nonlinear_eom(t+dt,   x+dt*k3,   u, p);
x_new = x + (dt/6)*(k1 + 2*k2 + 2*k3 + k4);
end

function s = ternary(cond, a, b)
if cond, s = a; else, s = b; end
end
