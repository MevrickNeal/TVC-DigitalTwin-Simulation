%% run_sim_api.m
% Wrapper for Python FastAPI backend.
% Returns trajectory and control data as a struct.
function res = run_sim_api(scenario, ctrl_idx, p_override)

addpath('matlab'); addpath('matlab/controllers');

p = rocket_params();
% Apply overrides (if provided by webapp)
if nargin > 2
    if isfield(p_override, 'm_wet'), p.m_wet = p_override.m_wet; end
    if isfield(p_override, 'thrust_N'), p.thrust_N = p_override.thrust_N; end
    % Add others as needed
end

%% Scenario modifications
switch scenario
    case 'wind'
        wind_moment_fcn = @(t) deg2rad(2.0) * sin(2*pi*0.8*t) .* (t > 0.1);
    case 'cg'
        p.xcg_wet = p.xcg_wet * 1.15;
        p.xcg_dry = p.xcg_dry * 1.15;
        wind_moment_fcn = @(t) 0;
    otherwise  % nominal
        wind_moment_fcn = @(t) 0;
end

t_span = 0 : p.dt : p.t_burn_end;
N = length(t_span);

theta_ref_fcn = @(t) deg2rad(5.0);

% 1=PID, 2=LQI, 3=MRAC, 4=ADRC
ic = ctrl_idx;

x = zeros(6,1);          % [θ, θ̇, φ, φ̇, h, ḣ]
delta_p_act = 0;          
theta_est_prev = 0;       
drift_x = 0;             % horizontal drift

% Storage
res.t = t_span;
res.theta = zeros(1, N);
res.delta = zeros(1, N);
res.altitude = zeros(1, N);
res.drift_x = zeros(1, N);

switch ic
    case 1, cs.int_outer = 0; cs.int_inner = 0; cs.e_theta_prev = 0; cs.e_rate_prev = 0;
    case 2, cs.int_e = 0;
    case 3, cs.theta_m = 0; cs.theta_dot_m = 0; cs.K_theta = 1.0; cs.K_rate = 0.2; cs.K_ff = 1.0;
    case 4, cs.z1 = 0; cs.z2 = 0; cs.z3 = 0; cs.u_prev = 0;
end

for k = 1:N
    t = t_span(k);
    p.w_dist = wind_moment_fcn(t);
    T_now = thrust_curve(t, p);
    
    [theta_est, theta_dot_est] = sensor_model(x(1), x(2), theta_est_prev, p.dt, 1.0, T_now);
    theta_est_prev = theta_est;
    
    theta_ref = theta_ref_fcn(t);
    
    if T_now < 0.5
        delta_cmd_p = 0;
    else
        switch ic
            case 1, [delta_cmd_p, cs] = pid_tvc(theta_ref, theta_est, theta_dot_est, cs, p.dt, p);
            case 2, [delta_cmd_p, cs] = lqr_tvc(theta_ref, theta_est, theta_dot_est, cs, t, p);
            case 3, [delta_cmd_p, cs] = mrac_tvc(theta_ref, theta_est, theta_dot_est, cs, p.dt, p);
            case 4, [delta_cmd_p, cs] = adrc_tvc(theta_ref, theta_est, theta_dot_est, cs, t, p.dt, p);
        end
    end
    
    [delta_p_act, ~] = servo_model(delta_cmd_p, delta_p_act, p.dt, p);
    
    u_ctrl = [delta_p_act; 0];
    k1 = nonlinear_eom(t, x, u_ctrl, p);
    k2 = nonlinear_eom(t+p.dt/2, x+p.dt/2*k1, u_ctrl, p);
    k3 = nonlinear_eom(t+p.dt/2, x+p.dt/2*k2, u_ctrl, p);
    k4 = nonlinear_eom(t+p.dt, x+p.dt*k3, u_ctrl, p);
    x = x + (p.dt/6)*(k1 + 2*k2 + 2*k3 + k4);
    x(5) = max(x(5), 0);
    
    % Simple horizontal drift kinematics (drift = integral of horizontal velocity component)
    % V_horiz ≈ V_vert * tan(pitch) for small pitch
    v_vert = x(6);
    drift_x = drift_x + v_vert * sin(x(1)) * p.dt;
    
    res.theta(k) = rad2deg(x(1));
    res.delta(k) = rad2deg(delta_p_act);
    res.altitude(k) = x(5);
    res.drift_x(k) = drift_x;
end
end
