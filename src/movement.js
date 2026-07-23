export function accelerateHorizontal(velocity, direction, acceleration, delta, maxSpeed) {
  let x = velocity.x + direction.x * acceleration * delta;
  let z = velocity.z + direction.z * acceleration * delta;
  const speed = Math.hypot(x, z);

  if (speed > maxSpeed) {
    const scale = maxSpeed / speed;
    x *= scale;
    z *= scale;
  }

  return { x, z };
}
