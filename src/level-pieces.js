import RAPIER from "@dimforge/rapier3d-compat";
import {
  createCheckerboardPlatform,
  createCheckerboardQuarterTurn,
  createCheckerboardRamp,
  getQuarterTurnSegmentVertices,
  getRampVertices,
} from "./checkerboard.js";

const SURFACE_FRICTION = 1.35;
const WALL_FRICTION = SURFACE_FRICTION / 10;
const SURFACE_SEPARATION = 0.01;
const QUAD_INDICES = [0, 1, 2, 0, 2, 3];

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

function addCollider(
  world,
  body,
  descriptor,
  friction = SURFACE_FRICTION,
  combineRule,
) {
  if (!descriptor) throw new Error("Could not create level-piece collider.");
  descriptor.setFriction(friction);
  if (combineRule !== undefined) {
    descriptor.setFrictionCombineRule(combineRule);
  }
  world.createCollider(descriptor, body);
}

function addWallCollider(world, body, height, createDescriptor) {
  const wallDescriptor = createDescriptor(height - SURFACE_SEPARATION);
  if (wallDescriptor) wallDescriptor.setTranslation(0, -SURFACE_SEPARATION / 2, 0);
  addCollider(
    world,
    body,
    wallDescriptor,
    WALL_FRICTION,
    RAPIER.CoefficientCombineRule.Min,
  );
}

function addSurfaceCollider(world, body, vertices, indices = QUAD_INDICES) {
  addCollider(
    world,
    body,
    RAPIER.ColliderDesc.trimesh(
      new Float32Array(vertices.flat()),
      new Uint32Array(indices),
      RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES,
    ),
  );
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
    addWallCollider(
      world,
      body,
      size[1],
      (height) => RAPIER.ColliderDesc.convexHull(new Float32Array(
        getRampVertices(size[0], height, size[2], piece.rise).flat(),
      )),
    );
    addSurfaceCollider(
      world,
      body,
      getRampVertices(...size, piece.rise).slice(0, 4),
    );
  } else {
    addWallCollider(
      world,
      body,
      size[1],
      (height) => RAPIER.ColliderDesc.cuboid(
        size[0] / 2,
        height / 2,
        size[2] / 2,
      ),
    );
    const halfWidth = size[0] / 2;
    const top = size[1] / 2;
    const halfDepth = size[2] / 2;
    addSurfaceCollider(world, body, [
      [-halfWidth, top, halfDepth],
      [halfWidth, top, halfDepth],
      [halfWidth, top, -halfDepth],
      [-halfWidth, top, -halfDepth],
    ]);
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
  const surfaceVertices = [];
  const surfaceIndices = [];

  for (let index = 0; index < piece.segments; index += 1) {
    const angle = piece.startAngle + index * angleStep;
    addWallCollider(
      world,
      body,
      height,
      (colliderHeight) => RAPIER.ColliderDesc.convexHull(new Float32Array(
        getQuarterTurnSegmentVertices(
          innerRadius,
          outerRadius,
          colliderHeight,
          angle,
          angle + angleStep,
        ).flat(),
      )),
    );
    const topVertices = getQuarterTurnSegmentVertices(
      innerRadius,
      outerRadius,
      height,
      angle,
      angle + angleStep,
    ).slice(0, 4);
    const vertexOffset = surfaceVertices.length;
    surfaceVertices.push(...topVertices);
    surfaceIndices.push(...QUAD_INDICES.map((vertex) => vertex + vertexOffset));
  }
  addSurfaceCollider(world, body, surfaceVertices, surfaceIndices);

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
