import * as THREE from "three";
import {
  createLevelPiece,
  platform,
  quarterTurn,
  ramp,
  spiral,
} from "./level-pieces.js";

const FINAL_SPIRAL = spiral({
  center: [-2, -19],
  innerRadiusCells: 2,
  widthCells: 2,
  startDirection: "west",
  endDirection: "east",
  turns: 1,
  clockwise: true,
  slope: 1.3,
  elevation: 0.6,
  boundHeightScale: 2,
  capStart: false,
  capEnd: false,
  bounds: {
    inner: true,
    outer: true,
  },
});
const FINAL_TRACK_ELEVATION = FINAL_SPIRAL.elevation - FINAL_SPIRAL.drop;

const LEVELS = [
  {
    id: 0,
    name: "DEV PLANE",
    start: { grid: [0, 3], y: 1.36 },
    colors: ["#ffffff", "#d027ad", 0x8e0876],
    pieces: [
      platform({
        cells: [32, 32],
        at: [0, 0],
        height: 1.25,
        elevation: -0.625,
      }),
    ],
  },
  {
    id: 1,
    name: "FIRST RUN",
    start: { grid: [0, 6], y: 1.36 },
    fallY: FINAL_TRACK_ELEVATION - 5,
    colors: ["#fff9b8", "#f6c744", 0xaa6e16],
    finish: {
      grid: [14.5, -23],
      y: FINAL_TRACK_ELEVATION + 0.51,
      radius: 2.3,
    },
    pieces: [
      platform({
        cells: [5, 5],
        at: [0.5, 4.5],
        height: 1.25,
        elevation: -0.625,
        bounds: {
          all: true,
          // Leave the curved-track entrance and its neighboring cells open.
          north: [true, false, false, false, true],
        },
      }),
      quarterTurn({
        center: [6, 2],
        innerRadiusCells: 5,
        widthCells: 1,
        startAngle: Math.PI,
        elevation: -0.5,
        capStart: false,
        capEnd: false,
      }),
      platform({
        cells: [2, 2],
        at: [7, -4],
        elevation: -0.5,
      }),
      platform({
        cells: [2, 4],
        at: [7, -7],
        elevation: -0.5,
      }),
      ramp({
        cells: [2, 4],
        at: [7, -11],
        elevation: 0.05,
        rise: 1.1,
      }),
      platform({
        cells: [3, 2],
        at: [7.5, -14],
        elevation: 0.6,
      }),
      platform({
        cells: [10, 2],
        at: [3, -16],
        elevation: 0.6,
      }),
      FINAL_SPIRAL,
      platform({
        cells: [4, 1],
        at: [0, -22.5],
        elevation: FINAL_TRACK_ELEVATION,
      }),
      quarterTurn({
        center: [2, -20],
        innerRadiusCells: 2,
        widthCells: 1,
        startAngle: Math.PI * 1.5,
        clockwise: true,
        elevation: FINAL_TRACK_ELEVATION,
        capStart: false,
        capEnd: false,
      }),
      quarterTurn({
        center: [7, -20],
        innerRadiusCells: 2,
        widthCells: 1,
        startAngle: Math.PI,
        clockwise: false,
        elevation: FINAL_TRACK_ELEVATION,
        capStart: false,
        capEnd: false,
      }),
      quarterTurn({
        center: [7, -20],
        innerRadiusCells: 2,
        widthCells: 1,
        startAngle: Math.PI / 2,
        clockwise: false,
        elevation: FINAL_TRACK_ELEVATION,
        capStart: false,
        capEnd: false,
      }),
      quarterTurn({
        center: [12, -20],
        innerRadiusCells: 2,
        widthCells: 1,
        startAngle: Math.PI,
        clockwise: true,
        elevation: FINAL_TRACK_ELEVATION,
        capStart: false,
        capEnd: false,
      }),
      platform({
        cells: [5, 4],
        at: [14.5, -23],
        elevation: FINAL_TRACK_ELEVATION,
      }),
    ],
  },
];

function resolvePoint(point, squareSize) {
  return new THREE.Vector3(
    point.grid[0] * squareSize,
    point.y,
    point.grid[1] * squareSize,
  );
}

function createFinishTarget(finish) {
  const target = new THREE.Group();
  const [x, y, z] = finish.position;
  const rings = [
    [finish.radius, 0xd62828],
    [finish.radius * 0.72, 0xffffff],
    [finish.radius * 0.44, 0xd62828],
    [finish.radius * 0.18, 0xffffff],
  ];

  rings.forEach(([radius, color], index) => {
    const circle = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 32),
      new THREE.MeshBasicMaterial({ color }),
    );
    circle.position.set(x, y + index * 0.003, z);
    circle.rotation.x = -Math.PI / 2;
    target.add(circle);
  });

  return target;
}

export function createLevel(world, levelId, squareSize) {
  const definition = LEVELS[levelId] ?? LEVELS[0];
  const group = new THREE.Group();
  const bodies = [];

  for (const pieceDefinition of definition.pieces) {
    const piece = createLevelPiece(
      world,
      pieceDefinition,
      squareSize,
      definition.colors,
    );
    group.add(piece.visual);
    bodies.push(...piece.bodies);
  }

  const finish = definition.finish
    ? {
        position: resolvePoint(definition.finish, squareSize),
        radius: definition.finish.radius,
      }
    : null;
  if (finish) group.add(createFinishTarget({
    position: finish.position.toArray(),
    radius: finish.radius,
  }));

  return {
    id: definition.id,
    name: definition.name,
    start: resolvePoint(definition.start, squareSize),
    fallY: definition.fallY ?? -8,
    finish,
    group,
    bodies,
  };
}

export function destroyLevel(world, level) {
  for (const body of level.bodies) world.removeRigidBody(body);

  level.group.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of new Set(materials)) {
      material.map?.dispose();
      material.dispose();
    }
  });
}

export function getLevelCount() {
  return LEVELS.length;
}
