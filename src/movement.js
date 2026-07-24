export function accelerateHorizontal(velocity, direction, acceleration, delta, maxSpeed) {
  const currentSpeed = Math.hypot(velocity.x, velocity.z);
  let x = velocity.x + direction.x * acceleration * delta;
  let z = velocity.z + direction.z * acceleration * delta;
  const speed = Math.hypot(x, z);
  const inputSpeedLimit = Math.max(currentSpeed, maxSpeed);

  if (speed > inputSpeedLimit) {
    const scale = inputSpeedLimit / speed;
    x *= scale;
    z *= scale;
  }

  return { x, z };
}
