export const CRASH_FALL_DISTANCE = 3.5;
export const CRASH_VERTICAL_SPEED = 11.5;

export function isCrashLanding(fallDistance, velocity) {
  return fallDistance >= CRASH_FALL_DISTANCE
    && velocity.y <= -CRASH_VERTICAL_SPEED;
}
