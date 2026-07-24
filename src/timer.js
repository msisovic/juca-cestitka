export function formatTime(milliseconds) {
  const totalMilliseconds = Math.max(0, Math.floor(milliseconds));
  const minutes = Math.floor(totalMilliseconds / 60000);
  const seconds = Math.floor((totalMilliseconds % 60000) / 1000);
  const millis = totalMilliseconds % 1000;

  return [
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
  ].join(":") + `.${String(millis).padStart(3, "0")}`;
}

export function reachesFinish(previous, current, finish) {
  if (!finish) return false;

  const deltaX = current.x - previous.x;
  const deltaZ = current.z - previous.z;
  const lengthSquared = deltaX * deltaX + deltaZ * deltaZ;
  const targetX = finish.position.x - previous.x;
  const targetZ = finish.position.z - previous.z;
  const closest = lengthSquared > 0
    ? Math.max(0, Math.min(1, (targetX * deltaX + targetZ * deltaZ) / lengthSquared))
    : 0;
  const closestX = previous.x + deltaX * closest;
  const closestZ = previous.z + deltaZ * closest;

  return Math.hypot(
    closestX - finish.position.x,
    closestZ - finish.position.z,
  ) <= finish.radius;
}
