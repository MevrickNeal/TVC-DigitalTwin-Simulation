%% mass_model.m
% Time-varying mass, inertia, CG for Project NEAL
% Linear burn model (constant mass flow rate)
% =====================================================

function [m, J, xcg] = mass_model(t, p)

% Propellant fraction burned (0 at ignition, 1 at burnout)
frac = min(t / p.t_burn, 1.0);

% Mass: linear from wet to dry
m = p.m_wet - p.m_prop * frac;

% Inertia: linear interpolation
J = p.J_pitch_wet - (p.J_pitch_wet - p.J_pitch_dry) * frac;

% CG: stays approximately constant for this motor size
% (propellant is small fraction, 39g out of 2047g)
xcg = p.xcg_wet;

end
