import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { createCheckerboardPlatform } from "./checkerboard.js";

const LEVELS = [
  {
    id: 0,
    name: "DEV PLANE",
    start: [0, 1.36, 7],
    platforms: [
      {
        size: [80, 1.25, 80],
        position: [0, -0.625, 0],
        colors: ["#ffffff", "#d027ad", 0x8e0876],
      },
    ],
  },
  {
    id: 1,
    name: "FIRST RUN",
    start: [0, 1.36, 15],
    fallY: -3,
    finish: [-4, 3.4, -53],
    platforms: [
      {
        size: [10, 1.25, 12],
        position: [0, -0.625, 12],
        colors: ["#fff6fd", "#d027ad", 0x8e0876],
      },
      {
        size: [6, 1, 8],
        position: [0, -0.5, 2],
        colors: ["#fff6fd", "#d027ad", 0x8e0876],
      },
      {
        size: [16, 1, 5.2],
        position: [5, -0.5, -4.6],
        colors: ["#fff7d6", "#f05a9d", 0xa61b65],
      },
      {
        size: [6, 1, 9.8],
        position: [10, -0.5, -12.1],
        colors: ["#fff7d6", "#f05a9d", 0xa61b65],
      },
      {
        size: [6, 1, 10],
        position: [10, 0.1, -22],
        rotation: [0.12, 0, 0],
        colors: ["#fff2c2", "#f08b32", 0xa84a25],
      },
      {
        size: [8, 1, 6],
        position: [10, 0.6, -30],
        colors: ["#ecffff", "#23bed2", 0x087989],
      },
      {
        size: [16, 1, 5.2],
        position: [2, 0.6, -35.6],
        colors: ["#ecffff", "#23bed2", 0x087989],
      },
      {
        size: [5.2, 1, 7.6],
        position: [-4, 0.6, -42],
        colors: ["#f5edff", "#8c68dd", 0x50358f],
      },
      {
        size: [12, 1, 11],
        position: [-4, 0.6, -52.3],
        colors: ["#fff9b8", "#f6c744", 0xaa6e16],
      },
    ],
  },
];

function createFinishGate(position) {
  const material = new THREE.MeshBasicMaterial({ color: 0xffef69 });
  const gate = new THREE.Mesh(
    new THREE.TorusGeometry(2.3, 0.14, 6, 28),
    material,
  );
  gate.position.set(...position);
  return gate;
}

function createPlatformBody(world, platform) {
  const [width, height, depth] = platform.size;
  const [x, y, z] = platform.position;
  const [rotationX, rotationY, rotationZ] = platform.rotation ?? [0, 0, 0];
  const quaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(rotationX, rotationY, rotationZ),
  );
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed()
      .setTranslation(x, y, z)
      .setRotation(quaternion),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2).setFriction(1.35),
    body,
  );
  return body;
}

export function createLevel(world, levelId, squareSize) {
  const definition = LEVELS[levelId] ?? LEVELS[0];
  const group = new THREE.Group();
  const bodies = [];

  for (const platform of definition.platforms) {
    const [lightColor, darkColor, sideColor] = platform.colors;
    group.add(createCheckerboardPlatform({
      ...platform,
      squareSize,
      lightColor,
      darkColor,
      sideColor,
    }));
    bodies.push(createPlatformBody(world, platform));
  }

  if (definition.finish) group.add(createFinishGate(definition.finish));

  return {
    id: definition.id,
    name: definition.name,
    start: new THREE.Vector3(...definition.start),
    fallY: definition.fallY ?? -8,
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
