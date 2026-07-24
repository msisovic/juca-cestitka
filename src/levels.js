import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  createCheckerboardPlatform,
  createCheckerboardRamp,
  getRampVertices,
} from "./checkerboard.js";

const LEVELS = [
  {
    id: 0,
    name: "DEV PLANE",
    start: { grid: [0, 3], y: 1.36 },
    colors: ["#ffffff", "#d027ad", 0x8e0876],
    platforms: [
      {
        cells: [32, 32],
        gridPosition: [0, 0],
        height: 1.25,
        elevation: -0.625,
      },
    ],
  },
  {
    id: 1,
    name: "FIRST RUN",
    start: { grid: [0, 6], y: 1.36 },
    fallY: -3,
    colors: ["#fff9b8", "#f6c744", 0xaa6e16],
    finish: {
      grid: [-2.5, -20.5],
      y: 1.11,
      radius: 2.3,
    },
    platforms: [
      {
        cells: [4, 5],
        gridPosition: [0, 4.5],
        height: 1.25,
        elevation: -0.625,
      },
      {
        cells: [2, 3],
        gridPosition: [0, 0.5],
        height: 1,
        elevation: -0.5,
      },
      {
        cells: [6, 2],
        gridPosition: [2, -2],
        height: 1,
        elevation: -0.5,
      },
      {
        cells: [2, 4],
        gridPosition: [4, -5],
        height: 1,
        elevation: -0.5,
      },
      {
        cells: [2, 4],
        gridPosition: [4, -9],
        height: 1,
        elevation: 0.05,
        rise: 1.1,
      },
      {
        cells: [3, 2],
        gridPosition: [4.5, -12],
        height: 1,
        elevation: 0.6,
      },
      {
        cells: [7, 2],
        gridPosition: [1.5, -14],
        height: 1,
        elevation: 0.6,
      },
      {
        cells: [2, 3],
        gridPosition: [-2, -16.5],
        height: 1,
        elevation: 0.6,
      },
      {
        cells: [5, 4],
        gridPosition: [-2.5, -20],
        height: 1,
        elevation: 0.6,
      },
    ],
  },
];

function resolvePlatform(platform, squareSize, colors) {
  const [widthCells, depthCells] = platform.cells;
  if (!Number.isInteger(widthCells) || !Number.isInteger(depthCells)) {
    throw new Error("Platform dimensions must use whole checker cells.");
  }

  const [gridX, gridZ] = platform.gridPosition;
  const minGridX = gridX - widthCells / 2;
  const minGridZ = gridZ - depthCells / 2;
  if (!Number.isInteger(minGridX) || !Number.isInteger(minGridZ)) {
    throw new Error("Platform borders must align to the shared checker grid.");
  }

  return {
    size: [widthCells * squareSize, platform.height, depthCells * squareSize],
    position: [gridX * squareSize, platform.elevation, gridZ * squareSize],
    rise: platform.rise,
    colors,
  };
}

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

function createPlatformBody(world, platform) {
  const [width, height, depth] = platform.size;
  const [x, y, z] = platform.position;
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed()
      .setTranslation(x, y, z),
  );
  const collider = platform.rise
    ? RAPIER.ColliderDesc.convexHull(new Float32Array(
        getRampVertices(width, height, depth, platform.rise).flat(),
      ))
    : RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2);
  if (!collider) throw new Error("Could not create ramp collider.");
  world.createCollider(collider.setFriction(1.35), body);
  return body;
}

export function createLevel(world, levelId, squareSize) {
  const definition = LEVELS[levelId] ?? LEVELS[0];
  const group = new THREE.Group();
  const bodies = [];

  for (const platformDefinition of definition.platforms) {
    const platform = resolvePlatform(
      platformDefinition,
      squareSize,
      definition.colors,
    );
    const [lightColor, darkColor, sideColor] = platform.colors;
    const createPlatform = platform.rise
      ? createCheckerboardRamp
      : createCheckerboardPlatform;
    group.add(createPlatform({
      ...platform,
      squareSize,
      lightColor,
      darkColor,
      sideColor,
    }));
    bodies.push(createPlatformBody(world, platform));
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
