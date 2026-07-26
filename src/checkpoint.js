export function touchesCheckpoint(position, checkpoint, ballRadius) {
  if (!checkpoint) return false;
  const isInside = Math.abs(position.x - checkpoint.center.x) <= checkpoint.halfWidth
    && Math.abs(position.z - checkpoint.center.z) <= checkpoint.halfDepth;
  const ballBottom = position.y - ballRadius;
  const isOnSurface = Math.abs(ballBottom - checkpoint.center.y) <= ballRadius * 0.25;
  return isInside && isOnSurface;
}
