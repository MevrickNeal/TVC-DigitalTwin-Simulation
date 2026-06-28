%% thrust_curve.m
% Thrust vs time for Project NEAL motor
% Data extracted from OpenRocket simulation (col 30: Thrust N)
% Motor: approximate Estes D/E class (burn time ~1.1s, peak ~75N)
% =====================================================

function T = thrust_curve(t, p)

if t >= p.t_burn
    T = 0;
    return;
end

% Piecewise linear interpolation from OR thrust data
T = interp1(p.thrust_t, p.thrust_N, t, 'linear', 0);
T = max(T, 0);  % no negative thrust

end
