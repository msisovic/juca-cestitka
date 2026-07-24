import RAPIER from "@dimforge/rapier3d-compat";
import {
  createCheckerboardPlatform,
  createCheckerboardQuarterTurn,
  createCheckerboardRamp,
  getQuarterTurnSegmentVertices,
  getRampVertices,
} from "./checkerboard.js";

export function platform(options) {
  return { type: "platform", ...options };
}

export function ramp(options) {
  return { type: "ramp", ...options };
}

export function quarterTurn(options) {
  return { type: "quarterTurn", widthCells: 2, segments: 12, ...options };
}

function createFixedBody(world, position) {
  return world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(...position),
  );
}

function addCollider(world, body, descriptor) {
  if (!descriptor) throw new Error("Could not create level-piece collider.");
  world.createCollider(descriptor.setFriction(1.35), body);
}

function validateGridRectangle(piece) {
  const [widthCells, depthCells] = piece.cells;
  if (!Number.isInteger(widthCells) || !Number.isInteger(depthCells)) {
    throw new Error("Platform dimensions must use whole checker cells.");
  }

  const [gridX, gridZ] = piece.at;
  if (
    !Number.isInteger(gridX - widthCells / 2)
    || !Number.isInteger(gridZ - depthCells / 2)
  ) {
    throw new Error("Platform borders must align to the shared checker grid.");
  }
}

function createRectanglePiece(world, piece, squareSize, colors) {
  validateGridRectangle(piece);
  const [widthCells, depthCells] = piece.cells;
  const size = [
    widthCells * squareSize,
    piece.height ?? 1,
    depthCells * squareSize,
  ];
  const position = [
    piece.at[0] * squareSize,
    piece.elevation,
    piece.at[1] * squareSize,
  ];
  const [lightColor, darkColor, sideColor] = colors;
  const visualOptions = {
    size,
    position,
    squareSize,
    lightColor,
    darkColor,
    sideColor,
  };
  const visual = piece.type === "ramp"
    ? createCheckerboardRamp({ ...visualOptions, rise: piece.rise })
    : createCheckerboardPlatform(visualOptions);
  const body = createFixedBody(world, position);

  if (piece.type === "ramp") {
    addCollider(
      world,
      body,
      RAPIER.ColliderDesc.convexHull(new Float32Array(
        getRampVertices(...size, piece.rise).flat(),
      )),
    );
  } else {
    addCollider(
      world,
      body,
      RAPIER.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2),
    );
  }

  return { visual, bodies: [body] };
}

function createQuarterTurnPiece(world, piece, squareSize, colors) {
  if (
    !Number.isInteger(piece.innerRadiusCells)
    || !Number.isInteger(piece.widthCells)
  ) {
    throw new Error("Quarter-turn radii must use whole checker cells.");
  }

  const position = [
    piece.center[0] * squareSize,
    piece.elevation,
    piece.center[1] * squareSize,
  ];
  const height = piece.height ?? 1;
  const innerRadius = piece.innerRadiusCells * squareSize;
  const width = piece.widthCells * squareSize;
  const outerRadius = innerRadius + width;
  const [lightColor, darkColor, sideColor] = colors;
  const visual = createCheckerboardQuarterTurn({
    position,
    height,
    innerRadius,
    width,
    startAngle: piece.startAngle,
    segments: piece.segments,
    capStart: piece.capStart,
    capEnd: piece.capEnd,
    squareSize,
    lightColor,
    darkColor,
    sideColor,
  });
  const body = createFixedBody(world, position);
  const angleStep = Math.PI / 2 / piece.segments;

  for (let index = 0; index < piece.segments; index += 1) {
    const angle = piece.startAngle + index * angleStep;
    addCollider(
      world,
      body,
      RAPIER.ColliderDesc.convexHull(new Float32Array(
        getQuarterTurnSegmentVertices(
          innerRadius,
          outerRadius,
          height,
          angle,
          angle + angleStep,
        ).flat(),
      )),
    );
  }

  return { visual, bodies: [body] };
}

export function createLevelPiece(world, piece, squareSize, colors) {
  if (piece.type === "platform" || piece.type === "ramp") {
    return createRectanglePiece(world, piece, squareSize, colors);
  }
  if (piece.type === "quarterTurn") {
    return createQuarterTurnPiece(world, piece, squareSize, colors);
  }
  throw new Error(`Unknown level piece: ${piece.type}`);
}
