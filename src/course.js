import * as THREE from "three";
import {
  boostPad,
  createCoursePiece,
  hammer,
  platform,
  quarterTurn,
  rail,
  ramp,
  spiral,
} from "./course-pieces.js";

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
  boundHeightScale: 3,
  capStart: false,
  capEnd: false,
  boosts: {
    intervalAngle: Math.PI / 2,
    speed: 40,
  },
  bounds: {
    inner: true,
    outer: true,
  },
});
const FINAL_TRACK_ELEVATION = FINAL_SPIRAL.elevation - FINAL_SPIRAL.drop;
const FINAL_TRACK_SURFACE = FINAL_TRACK_ELEVATION + 0.5;
const JUMP_RISE = 1.1;

const COURSE = {
    start: { grid: [0, 6], y: 1.36 },
    fallY: FINAL_TRACK_ELEVATION - 5,
    colors: ["#fff9b8", "#f6c744", 0xaa6e16],
    finish: {
      grid: [24.5, -67],
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
      boostPad({
        cells: [1, 2],
        at: [-1.5, -16],
        elevation: 1.1,
        direction: "west",
        speed: 40,
      }),
      FINAL_SPIRAL,
      ramp({
        cells: [2, 2],
        at: [-1, -22],
        direction: "east",
        elevation: FINAL_TRACK_ELEVATION + JUMP_RISE / 2,
        rise: JUMP_RISE,
      }),
      platform({
        cells: [4, 2],
        at: [7, -22],
        elevation: FINAL_TRACK_ELEVATION,
        surfaceFriction: 0,
        surfaceOnly: true,
      }),
      quarterTurn({
        center: [9, -20],
        innerRadiusCells: 2,
        widthCells: 1,
        startAngle: Math.PI * 1.5,
        clockwise: true,
        elevation: FINAL_TRACK_ELEVATION,
        capStart: false,
        capEnd: false,
      }),
      quarterTurn({
        center: [14, -20],
        innerRadiusCells: 2,
        widthCells: 1,
        startAngle: Math.PI,
        clockwise: false,
        elevation: FINAL_TRACK_ELEVATION,
        capStart: false,
        capEnd: false,
      }),
      platform({
        cells: [3, 1],
        at: [15.5, -17.5],
        elevation: FINAL_TRACK_ELEVATION,
      }),
      platform({
        cells: [5, 4],
        at: [19.5, -18],
        elevation: FINAL_TRACK_ELEVATION,
      }),
      platform({
        cells: [4, 4],
        at: [24, -18],
        elevation: FINAL_TRACK_ELEVATION,
      }),
      platform({
        cells: [3, 21],
        at: [24.5, -30.5],
        elevation: FINAL_TRACK_ELEVATION,
      }),
      ...[-23, -26.2, -29.4, -32.6, -35.8, -39].map((z, index) => hammer({
        at: [24.5, z],
        surfaceY: FINAL_TRACK_SURFACE,
        travelDirection: "north",
        spinDirection: index % 2 === 0 ? 1 : -1,
        phase: 0,
        period: 2.6,
      })),
      rail({
        at: [25.5, -44],
        surfaceY: FINAL_TRACK_SURFACE,
        lengthCells: 6,
      }),
      platform({
        cells: [3, 3],
        at: [24.5, -48.5],
        elevation: FINAL_TRACK_ELEVATION,
      }),
      rail({
        at: [23.5, -53],
        surfaceY: FINAL_TRACK_SURFACE,
        lengthCells: 6,
      }),
      platform({
        cells: [3, 3],
        at: [24.5, -57.5],
        elevation: FINAL_TRACK_ELEVATION,
      }),
      rail({
        at: [24.5, -62],
        surfaceY: FINAL_TRACK_SURFACE,
        lengthCells: 6,
      }),
      platform({
        cells: [5, 4],
        at: [24.5, -67],
        elevation: FINAL_TRACK_ELEVATION,
      }),
    ],
};

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

export function createCourse(world, squareSize) {
  const definition = COURSE;
  const group = new THREE.Group();
  const bodies = [];
  const boostPads = [];
  const animatedBodies = [];

  for (const pieceDefinition of definition.pieces) {
    const piece = createCoursePiece(
      world,
      pieceDefinition,
      squareSize,
      definition.colors,
    );
    group.add(piece.visual);
    bodies.push(...piece.bodies);
    boostPads.push(...(piece.boostPads ?? []));
    animatedBodies.push(...(piece.animatedBodies ?? []));
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
    start: resolvePoint(definition.start, squareSize),
    fallY: definition.fallY ?? -8,
    finish,
    group,
    bodies,
    boostPads,
    animatedBodies,
  };
}
