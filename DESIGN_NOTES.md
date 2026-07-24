# Design notes

## Potential movement redesign

The current controls apply directional acceleration directly to the ball's horizontal velocity. A future physics redesign could instead apply torque to the sphere and let surface traction produce movement. This may better reproduce Hamsterball's momentum and material-dependent grip while preventing input from unnaturally driving the ball up walls.

The original game's exact physics constants and formulas do not appear to be public. Its [archived manual](https://archive.org/details/hamsterball_202303) and [community documentation](https://hamsterball.fandom.com/wiki/Hamsterball#Controls) describe full-strength directional keyboard input, variable-strength mouse input, persistent momentum, and surfaces with different traction.
