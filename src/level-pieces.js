import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  createCheckerboardCurvedTrack,
  createCheckerboardPlatform,
  createCheckerboardRamp,
  getQuarterTurnSegmentVertices,
  getRampVertices,
} from "./checkerboard.js";

const SURFACE_FRICTION = 1.35;
const WALL_FRICTION = SURFACE_FRICTION / 10;
const SPIRAL_WALL_FRICTION = 0;
const SURFACE_SEPARATION = 0.01;
const QUAD_INDICES = [0, 1, 2, 0, 2, 3];
const REVERSED_QUAD_INDICES = [0, 2, 1, 0, 3, 2];
const BOUND_HEIGHT_CELLS = 0.36;
const BOUND_THICKNESS_CELLS = 0.12;
const FULL_TURN = Math.PI * 2;
const CARDINAL_DIRECTIONS = {
  north: Math.PI,
  east: -Math.PI / 2,
  south: 0,
  west: Math.PI / 2,
};

export function platform(options) {
  return { type: "platform", ...options };
}

export function ramp(options) {
  return { type: "ramp", ...options };
}

export function quarterTurn(options) {
  return {
    type: "quarterTurn",
    widthCells: 2,
    segments: 12,
    ...options,
    sweepAngle: options.sweepAngle
      ?? (options.clockwise === false ? -Math.PI / 2 : Math.PI / 2),
  };
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

export function resolveSpiralAngles({
  startDirection,
  endDirection,
  clockwise = true,
  turns = 1,
}) {
  if (!(startDirection in CARDINAL_DIRECTIONS)) {
    throw new Error(`Unknown spiral start direction: ${startDirection}`);
  }
  if (!(endDirection in CARDINAL_DIRECTIONS)) {
    throw new Error(`Unknown spiral end direction: ${endDirection}`);
  }
  if (!Number.isInteger(turns) || turns < 0) {
    throw new Error("Spiral turns must be a non-negative whole number.");
  }

  const sweepSign = clockwise ? 1 : -1;
  const startAngle = CARDINAL_DIRECTIONS[startDirection]
    + (clockwise ? 0 : Math.PI);
  const endAngle = CARDINAL_DIRECTIONS[endDirection]
    + (clockwise ? 0 : Math.PI);
  const directionalDifference = sweepSign > 0
    ? positiveModulo(endAngle - startAngle, FULL_TURN)
    : positiveModulo(startAngle - endAngle, FULL_TURN);
  const sweepMagnitude = turns * FULL_TURN + directionalDifference;
  if (sweepMagnitude === 0) {
    throw new Error("A spiral must cover part of a turn.");
  }

  return {
    startAngle,
    sweepAngle: sweepSign * sweepMagnitude,
  };
}

export function spiral(options) {
  const piece = {
    type: "spiral",
    widthCells: 2,
    turns: 1,
    clockwise: true,
    segmentsPerTurn: 32,
    bounds: { inner: true, outer: true },
    ...options,
  };
  if (!Number.isFinite(piece.slope) || piece.slope <= 0) {
    throw new Error("Spiral slope must be a positive number.");
  }
  const angles = resolveSpiralAngles(piece);
  const sweepTurns = Math.abs(angles.sweepAngle) / FULL_TURN;
  // Slope is the vertical drop per radian, making the spiral pitch explicit.
  const drop = Math.abs(angles.sweepAngle) * piece.slope;
  return {
    ...piece,
    ...angles,
    drop,
    segments: piece.segments ?? Math.ceil(sweepTurns * piece.segmentsPerTurn),
  };
}

// Rectangle/ramp edges: north, south, east, west.
// Quarter-turn edges: inner, outer, start, end.
export function resolveBoundUnits(bounds, edge, unitCount) {
  const edgeSetting = bounds === true
    ? true
    : bounds?.[edge] ?? bounds?.all ?? false;

  if (edgeSetting === true) return Array(unitCount).fill(true);
  if (edgeSetting === false) return Array(unitCount).fill(false);
  if (
    !Array.isArray(edgeSetting)
    || edgeSetting.length !== unitCount
    || edgeSetting.some((enabled) => typeof enabled !== "boolean")
  ) {
    throw new Error(
      `Boundary edge "${edge}" must be a boolean or ${unitCount} booleans.`,
    );
  }
  return edgeSetting;
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

function createBoundaryBuilder(
  world,
  body,
  position,
  squareSize,
  color,
  heightScale = 1,
) {
  const group = new THREE.Group();
  group.position.set(...position);
  const height = squareSize * BOUND_HEIGHT_CELLS * heightScale;
  const thickness = squareSize * BOUND_THICKNESS_CELLS;
  let material;
  const getMaterial = () => {
    material ??= new THREE.MeshLambertMaterial({
      color,
      side: THREE.DoubleSide,
    });
    return material;
  };

  return {
    group,
    height,
    thickness,
    add(start, end, normal, inward, visible = true) {
      const startPoint = new THREE.Vector3(...start);
      const endPoint = new THREE.Vector3(...end);
      const length = startPoint.distanceTo(endPoint);
      const yAxis = new THREE.Vector3(...normal).normalize();
      const zAxis = new THREE.Vector3(...inward).normalize();
      const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();
      const rotation = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis),
      );
      const center = startPoint.clone()
        .add(endPoint)
        .multiplyScalar(0.5)
        .addScaledVector(yAxis, height / 2)
        .addScaledVector(zAxis, -thickness / 2);

      if (visible) {
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(length, height, thickness),
          getMaterial(),
        );
        wall.position.copy(center);
        wall.quaternion.copy(rotation);
        group.add(wall);
      }

      const descriptor = RAPIER.ColliderDesc.cuboid(
        length / 2,
        height / 2,
        thickness / 2,
      )
        .setTranslation(center.x, center.y, center.z)
        .setRotation(rotation);
      addCollider(
        world,
        body,
        descriptor,
        WALL_FRICTION,
        RAPIER.CoefficientCombineRule.Min,
      );
    },
    addGeometry(geometry) {
      group.add(new THREE.Mesh(geometry, getMaterial()));
    },
    addTrimesh(vertices, indices, friction = WALL_FRICTION) {
      addCollider(
        world,
        body,
        RAPIER.ColliderDesc.trimesh(
          new Float32Array(vertices),
          new Uint32Array(indices),
          RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES,
        ),
        friction,
        RAPIER.CoefficientCombineRule.Min,
      );
    },
  };
}

function addConfiguredBounds(bounds, edge, unitCount, addUnit) {
  resolveBoundUnits(bounds, edge, unitCount).forEach((enabled, index) => {
    if (enabled) addUnit(index);
  });
}

function addRectangleBounds(builder, piece, size, squareSize) {
  const [width, height, depth] = size;
  const [widthCells, depthCells] = piece.cells;
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const slope = piece.type === "ramp" ? piece.rise / depth : 0;
  const surfaceNormal = new THREE.Vector3(0, 1, slope).normalize().toArray();
  const topAtZ = (z) => height / 2 - slope * z;

  for (const [edge, z, inwardZ] of [
    ["north", -halfDepth, 1],
    ["south", halfDepth, -1],
  ]) {
    addConfiguredBounds(piece.bounds, edge, widthCells, (index) => {
      const startX = -halfWidth + index * squareSize;
      const endX = startX + squareSize;
      builder.add(
        [startX, topAtZ(z), z],
        [endX, topAtZ(z), z],
        surfaceNormal,
        [0, -slope * inwardZ, inwardZ],
      );
    });
  }

  for (const [edge, x, inwardX] of [
    ["west", -halfWidth, 1],
    ["east", halfWidth, -1],
  ]) {
    addConfiguredBounds(piece.bounds, edge, depthCells, (index) => {
      const startZ = -halfDepth + index * squareSize;
      const endZ = startZ + squareSize;
      builder.add(
        [x, topAtZ(startZ), startZ],
        [x, topAtZ(endZ), endZ],
        surfaceNormal,
        [inwardX, 0, 0],
      );
    });
  }
}

function addSmoothSpiralBound(
  builder,
  piece,
  edge,
  radius,
  inwardSign,
  unitCount,
  point,
  normalAt,
) {
  const enabledUnits = resolveBoundUnits(piece.bounds, edge, unitCount);
  const enabledAt = (progress) => enabledUnits[Math.min(
    unitCount - 1,
    Math.floor(progress * unitCount),
  )];
  const positions = [];
  const indices = [];

  function addQuad(a, b, c, d) {
    const offset = positions.length / 3;
    positions.push(...a.toArray(), ...b.toArray(), ...c.toArray(), ...d.toArray());
    indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
  }

  const visualSegments = Math.max(piece.segments * 2, unitCount * 3);
  for (let index = 0; index < visualSegments; index += 1) {
    const startProgress = index / visualSegments;
    const endProgress = (index + 1) / visualSegments;
    if (!enabledAt((startProgress + endProgress) / 2)) continue;

    const startAngle = piece.startAngle + piece.sweepAngle * startProgress;
    const endAngle = piece.startAngle + piece.sweepAngle * endProgress;
    const startPoint = new THREE.Vector3(...point(
      radius,
      startAngle,
      startProgress,
    ));
    const endPoint = new THREE.Vector3(...point(
      radius,
      endAngle,
      endProgress,
    ));
    const startNormal = new THREE.Vector3(...normalAt(startAngle));
    const endNormal = new THREE.Vector3(...normalAt(endAngle));
    const startOutward = new THREE.Vector3(
      -Math.cos(startAngle) * inwardSign,
      0,
      -Math.sin(startAngle) * inwardSign,
    ).multiplyScalar(builder.thickness);
    const endOutward = new THREE.Vector3(
      -Math.cos(endAngle) * inwardSign,
      0,
      -Math.sin(endAngle) * inwardSign,
    ).multiplyScalar(builder.thickness);
    const startTop = startPoint.clone().addScaledVector(
      startNormal,
      builder.height,
    );
    const endTop = endPoint.clone().addScaledVector(endNormal, builder.height);
    const startOuter = startPoint.clone().add(startOutward);
    const endOuter = endPoint.clone().add(endOutward);
    const startOuterTop = startTop.clone().add(startOutward);
    const endOuterTop = endTop.clone().add(endOutward);

    addQuad(startPoint, endPoint, endTop, startTop);
    addQuad(startTop, endTop, endOuterTop, startOuterTop);
    addQuad(startOuterTop, endOuterTop, endOuter, startOuter);
    addQuad(startOuter, endOuter, endPoint, startPoint);
  }

  if (positions.length > 0) {
    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.computeVertexNormals();
    builder.addGeometry(geometry);
    builder.addTrimesh(positions, indices, SPIRAL_WALL_FRICTION);
  }
}

function addCurvedBounds(
  builder,
  piece,
  height,
  innerRadius,
  outerRadius,
  squareSize,
) {
  const sweepMagnitude = Math.abs(piece.sweepAngle);
  const sweepSign = Math.sign(piece.sweepAngle);
  const drop = piece.drop ?? 0;
  const centerRadius = (innerRadius + outerRadius) / 2;
  const dropPerRadian = drop / sweepMagnitude;
  const point = (radius, angle, progress) => [
    Math.cos(angle) * radius,
    height / 2 - drop * progress,
    Math.sin(angle) * radius,
  ];
  const normalAt = (angle) => {
    const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const angleTangent = new THREE.Vector3(
      -Math.sin(angle) * centerRadius,
      -drop / piece.sweepAngle,
      Math.cos(angle) * centerRadius,
    );
    return angleTangent.cross(radial).normalize().toArray();
  };

  for (const [edge, radius, inwardSign] of [
    ["inner", innerRadius, 1],
    ["outer", outerRadius, -1],
  ]) {
    const unitCount = Math.max(
      1,
      Math.ceil((sweepMagnitude * radius) / squareSize),
    );
    if (piece.type === "spiral") {
      addSmoothSpiralBound(
        builder,
        piece,
        edge,
        radius,
        inwardSign,
        unitCount,
        point,
        normalAt,
      );
      continue;
    }
    const angleStep = piece.sweepAngle / unitCount;
    addConfiguredBounds(piece.bounds, edge, unitCount, (index) => {
      const startProgress = index / unitCount;
      const endProgress = (index + 1) / unitCount;
      const startAngle = piece.startAngle + index * angleStep;
      const endAngle = startAngle + angleStep;
      const middleAngle = (startAngle + endAngle) / 2;
      builder.add(
        point(radius, startAngle, startProgress),
        point(radius, endAngle, endProgress),
        normalAt(middleAngle),
        [
          Math.cos(middleAngle) * inwardSign,
          0,
          Math.sin(middleAngle) * inwardSign,
        ],
      );
    });
  }

  for (const [edge, angle, progress, travelDirection] of [
    ["start", piece.startAngle, 0, 1],
    ["end", piece.startAngle + piece.sweepAngle, 1, -1],
  ]) {
    addConfiguredBounds(piece.bounds, edge, piece.widthCells, (index) => {
      const startRadius = innerRadius + index * squareSize;
      const endRadius = startRadius + squareSize;
      const travel = [
        -Math.sin(angle) * sweepSign * travelDirection * centerRadius,
        -dropPerRadian * travelDirection,
        Math.cos(angle) * sweepSign * travelDirection * centerRadius,
      ];
      builder.add(
        point(startRadius, angle, progress),
        point(endRadius, angle, progress),
        normalAt(angle),
        travel,
      );
    });
  }
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
  const surfaceVisual = piece.type === "ramp"
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

  const visual = new THREE.Group();
  visual.add(surfaceVisual);
  const boundaryBuilder = createBoundaryBuilder(
    world,
    body,
    position,
    squareSize,
    sideColor,
    piece.boundHeightScale,
  );
  addRectangleBounds(boundaryBuilder, piece, size, squareSize);
  visual.add(boundaryBuilder.group);

  return { visual, bodies: [body] };
}

function createCurvedPiece(world, piece, squareSize, colors) {
  if (
    !Number.isInteger(piece.innerRadiusCells)
    || !Number.isInteger(piece.widthCells)
  ) {
    throw new Error("Curved-track radii must use whole checker cells.");
  }
  if (!Number.isInteger(piece.segments) || piece.segments < 1) {
    throw new Error("Curved tracks must use at least one segment.");
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
  const drop = piece.drop ?? 0;
  const [lightColor, darkColor, sideColor] = colors;
  const surfaceVisual = createCheckerboardCurvedTrack({
    position,
    height,
    innerRadius,
    width,
    startAngle: piece.startAngle,
    sweepAngle: piece.sweepAngle,
    drop,
    segments: piece.segments,
    capStart: piece.capStart,
    capEnd: piece.capEnd,
    squareSize,
    lightColor,
    darkColor,
    sideColor,
  });
  const body = createFixedBody(world, position);
  const angleStep = piece.sweepAngle / piece.segments;
  const surfaceVertices = [];
  const surfaceIndices = [];
  const topIndices = piece.sweepAngle > 0
    ? QUAD_INDICES
    : REVERSED_QUAD_INDICES;

  for (let index = 0; index < piece.segments; index += 1) {
    const angle = piece.startAngle + index * angleStep;
    const startDrop = drop * index / piece.segments;
    const endDrop = drop * (index + 1) / piece.segments;
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
          startDrop,
          endDrop,
        ).flat(),
      )),
    );
    const topVertices = getQuarterTurnSegmentVertices(
      innerRadius,
      outerRadius,
      height,
      angle,
      angle + angleStep,
      startDrop,
      endDrop,
    ).slice(0, 4);
    const vertexOffset = surfaceVertices.length;
    surfaceVertices.push(...topVertices);
    surfaceIndices.push(...topIndices.map((vertex) => vertex + vertexOffset));
  }
  addSurfaceCollider(world, body, surfaceVertices, surfaceIndices);

  const visualGroup = new THREE.Group();
  visualGroup.add(surfaceVisual);
  const boundaryBuilder = createBoundaryBuilder(
    world,
    body,
    position,
    squareSize,
    sideColor,
    piece.boundHeightScale,
  );
  addCurvedBounds(
    boundaryBuilder,
    piece,
    height,
    innerRadius,
    outerRadius,
    squareSize,
  );
  visualGroup.add(boundaryBuilder.group);

  return { visual: visualGroup, bodies: [body] };
}

export function createLevelPiece(world, piece, squareSize, colors) {
  if (piece.type === "platform" || piece.type === "ramp") {
    return createRectanglePiece(world, piece, squareSize, colors);
  }
  if (piece.type === "quarterTurn") {
    return createCurvedPiece(world, piece, squareSize, colors);
  }
  if (piece.type === "spiral") {
    return createCurvedPiece(world, piece, squareSize, colors);
  }
  throw new Error(`Unknown level piece: ${piece.type}`);
}
