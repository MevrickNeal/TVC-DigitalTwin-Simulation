%% atmosphere.m
% Simple ISA atmosphere model (density vs altitude)
% =====================================================

function rho = atmosphere(h)
% International Standard Atmosphere (troposphere, T0=288.15K)
T0   = 288.15;    % K
P0   = 101325;    % Pa
L    = 0.0065;    % K/m lapse rate
R    = 287.05;    % J/(kg·K)
g0   = 9.807;

h = max(h, 0);    % clamp at sea level

T   = T0 - L * h;
P   = P0 * (T/T0)^(g0/(R*L));
rho = P / (R * T);

end
