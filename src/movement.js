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

export function boostHorizontal(velocity, direction, minimumForwardSpeed) {
  const forwardSpeed = velocity.x * direction.x + velocity.z * direction.z;
  const addedSpeed = Math.max(minimumForwardSpeed - forwardSpeed, 0);
  return {
    x: velocity.x + direction.x * addedSpeed,
    z: velocity.z + direction.z * addedSpeed,
  };
}

export function rollingAngularVelocity(velocity, surfaceNormal, radius, twist = 0) {
  const normalVelocity = velocity.x * surfaceNormal.x
    + velocity.y * surfaceNormal.y
    + velocity.z * surfaceNormal.z;
  const tangent = {
    x: velocity.x - surfaceNormal.x * normalVelocity,
    y: velocity.y - surfaceNormal.y * normalVelocity,
    z: velocity.z - surfaceNormal.z * normalVelocity,
  };

  return {
    x: (surfaceNormal.y * tangent.z - surfaceNormal.z * tangent.y) / radius
      + surfaceNormal.x * twist,
    y: (surfaceNormal.z * tangent.x - surfaceNormal.x * tangent.z) / radius
      + surfaceNormal.y * twist,
    z: (surfaceNormal.x * tangent.y - surfaceNormal.y * tangent.x) / radius
      + surfaceNormal.z * twist,
  };
}
