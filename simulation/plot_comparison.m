%% plot_comparison.m
% Publication-quality comparison plots (IEEE double-column format)
% =====================================================

function plot_comparison(t, theta_hist, delta_hist, theta_ref, ctrl_names, scenario, p)

colors = {'#0072BD', '#D95319', '#77AC30', '#7E2F8E'};  % MATLAB default cycle
lw     = 1.8;
fs     = 11;   % font size

%% --- Figure 1: Attitude Tracking ---
fig1 = figure('Name', 'Attitude Tracking', 'Position', [100 100 800 400]);
hold on; grid on; box on;
plot(t, rad2deg(theta_ref), 'k--', 'LineWidth', 1.2, 'DisplayName', 'Reference');
for ic = 1:length(ctrl_names)
    plot(t, rad2deg(theta_hist(:,ic)), 'Color', colors{ic}, ...
         'LineWidth', lw, 'DisplayName', ctrl_names{ic});
end
xline(p.t_burn, 'k:', 'Burnout', 'LineWidth', 1, 'LabelVerticalAlignment', 'bottom');
xlabel('Time (s)', 'FontSize', fs);
ylabel('Pitch Angle (deg)', 'FontSize', fs);
title(sprintf('Attitude Tracking — %s scenario', scenario), 'FontSize', fs+1);
legend('Location', 'best', 'FontSize', fs-1);
set(gca, 'FontSize', fs);
xlim([0, t(end)]);

%% --- Figure 2: Gimbal Deflection ---
fig2 = figure('Name', 'Gimbal Commands', 'Position', [100 550 800 350]);
hold on; grid on; box on;
for ic = 1:length(ctrl_names)
    plot(t, rad2deg(delta_hist(:,ic)), 'Color', colors{ic}, ...
         'LineWidth', lw, 'DisplayName', ctrl_names{ic});
end
yline( p.max_gimbal, 'r--', '+Limit', 'LineWidth', 1);
yline(-p.max_gimbal, 'r--', '-Limit', 'LineWidth', 1);
xlabel('Time (s)', 'FontSize', fs);
ylabel('Gimbal Angle \delta (deg)', 'FontSize', fs);
title('TVC Gimbal Deflection', 'FontSize', fs+1);
legend('Location', 'best', 'FontSize', fs-1);
set(gca, 'FontSize', fs);
xlim([0, t(end)]);

%% --- Figure 3: Tracking Error ---
fig3 = figure('Name', 'Tracking Error', 'Position', [950 100 800 400]);
hold on; grid on; box on;
for ic = 1:length(ctrl_names)
    err = rad2deg(theta_hist(:,ic)) - rad2deg(theta_ref);
    plot(t, err, 'Color', colors{ic}, 'LineWidth', lw, 'DisplayName', ctrl_names{ic});
end
yline(0, 'k-', 'LineWidth', 0.5);
xlabel('Time (s)', 'FontSize', fs);
ylabel('Tracking Error (deg)', 'FontSize', fs);
title('Pitch Tracking Error', 'FontSize', fs+1);
legend('Location', 'best', 'FontSize', fs-1);
set(gca, 'FontSize', fs);
xlim([0, t(end)]);

%% --- Save Figures ---
save_dir = fullfile(fileparts(mfilename('fullpath')), '..', 'results');
if ~exist(save_dir, 'dir'), mkdir(save_dir); end

exportgraphics(fig1, fullfile(save_dir, sprintf('tracking_%s.pdf', scenario)), ...
               'ContentType', 'vector');
exportgraphics(fig2, fullfile(save_dir, sprintf('gimbal_%s.pdf', scenario)), ...
               'ContentType', 'vector');
exportgraphics(fig3, fullfile(save_dir, sprintf('error_%s.pdf', scenario)), ...
               'ContentType', 'vector');

fprintf('Figures saved to: %s\n', save_dir);

end
