import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import "./style.css";
import { createCheckerboard } from "./checkerboard.js";
import { createBostonTerrier } from "./dog.js";
import { accelerateHorizontal } from "./movement.js";

await RAPIER.init({});

const BALL_RADIUS = 1.28;
const START = new THREE.Vector3(0, BALL_RADIUS + 0.08, 7);
const MAX_SPEED = 26;
const CONTROL_ACCELERATION = 12;
const CAMERA_OFFSET = new THREE.Vector3(0, 8.85, 13.2);
const PHYSICS_TIMESTEP = 1 / 120;
const MAX_FRAME_DELTA = 1 / 20;

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.querySelector("#app").appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xad0f8f);
scene.fog = new THREE.Fog(0xad0f8f, 35, 84);

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 120);
camera.position.set(0, 6.2, 15);

scene.add(new THREE.HemisphereLight(0xffffff, 0x740661, 2.25));
const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(-6, 12, 8);
scene.add(sun);
scene.add(createCheckerboard());

const world = new RAPIER.World({ x: 0, y: -22, z: 0 });
world.timestep = PHYSICS_TIMESTEP;
const groundBody = world.createRigidBody(
  RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.625, 0),
);
world.createCollider(
  RAPIER.ColliderDesc.cuboid(40, 0.625, 40).setFriction(1.35),
  groundBody,
);

const ballBody = world.createRigidBody(
  RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(START.x, START.y, START.z)
    .setLinearDamping(0.35)
    .setAngularDamping(0.72)
    .setCcdEnabled(true),
);
world.createCollider(
  RAPIER.ColliderDesc.ball(BALL_RADIUS)
    .setDensity(0.7)
    .setFriction(1.45)
    .setRestitution(0.08),
  ballBody,
);

const ballVisual = new THREE.Group();
const shell = new THREE.Mesh(
  new THREE.SphereGeometry(BALL_RADIUS, 20, 14),
  new THREE.MeshPhongMaterial({
    color: 0xeafcff,
    transparent: true,
    opacity: 0.2,
    shininess: 90,
    specular: 0xffffff,
    depthWrite: false,
    side: THREE.DoubleSide,
  }),
);
shell.renderOrder = 2;
ballVisual.add(shell);

const ringMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.32,
  depthWrite: false,
});
const RING_TUBE_RADIUS = 0.012;
const RING_RADIUS = BALL_RADIUS - RING_TUBE_RADIUS - 0.004;
for (const rotation of [
  [0, 0, 0],
  [Math.PI / 2, 0, 0],
  [0, Math.PI / 2, 0],
]) {
  const ring = new THREE.Mesh(
    // Keep the seams inside the physics sphere so they cannot look like
    // protruding ridges as the ball rolls along the ground.
    new THREE.TorusGeometry(RING_RADIUS, RING_TUBE_RADIUS, 4, 40),
    ringMaterial,
  );
  ring.rotation.set(...rotation);
  ring.renderOrder = 3;
  ballVisual.add(ring);
}
scene.add(ballVisual);

const dog = createBostonTerrier();
scene.add(dog);

const shadow = new THREE.Mesh(
  new THREE.CircleGeometry(1.15, 18),
  new THREE.MeshBasicMaterial({
    color: 0x5e0450,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  }),
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = 0.025;
scene.add(shadow);

const pressed = new Set();
const movement = new THREE.Vector3();
const heading = new THREE.Vector3(0, 0, -1);
const cameraTarget = new THREE.Vector3();
const cameraAnchor = START.clone();
const previousPhysicsPosition = START.clone();
const currentPhysicsPosition = START.clone();
const renderPosition = START.clone();
const previousPhysicsRotation = new THREE.Quaternion();
const currentPhysicsRotation = new THREE.Quaternion();
const renderRotation = new THREE.Quaternion();
let dogYaw = Math.PI;
let physicsAccumulator = 0;

const controlledKeys = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyR",
]);

window.addEventListener("keydown", (event) => {
  if (controlledKeys.has(event.code)) event.preventDefault();
  pressed.add(event.code);
  if (event.code === "KeyR") resetBall();
});

window.addEventListener("keyup", (event) => {
  pressed.delete(event.code);
});

window.addEventListener("blur", () => pressed.clear());

function resetBall() {
  pressed.clear();
  ballBody.resetForces(true);
  ballBody.resetTorques(true);
  ballBody.setTranslation({ x: START.x, y: START.y, z: START.z }, true);
  ballBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
  ballBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
  movement.set(0, 0, 0);
  heading.set(0, 0, -1);
  previousPhysicsPosition.copy(START);
  currentPhysicsPosition.copy(START);
  renderPosition.copy(START);
  previousPhysicsRotation.identity();
  currentPhysicsRotation.identity();
  renderRotation.identity();
  physicsAccumulator = 0;
  cameraAnchor.copy(START);
  camera.position.copy(cameraAnchor).add(CAMERA_OFFSET);
  camera.lookAt(cameraAnchor.x, cameraAnchor.y + 0.15, cameraAnchor.z);
  dogYaw = Math.PI;
}

function shortestAngle(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function updateControls(delta) {
  const x = Number(pressed.has("KeyD") || pressed.has("ArrowRight"))
    - Number(pressed.has("KeyA") || pressed.has("ArrowLeft"));
  const z = Number(pressed.has("KeyW") || pressed.has("ArrowUp"))
    - Number(pressed.has("KeyS") || pressed.has("ArrowDown"));

  movement.set(x, 0, -z);

  const velocity = ballBody.linvel();

  if (movement.lengthSq() > 0) {
    movement.normalize();
    const nextVelocity = accelerateHorizontal(
      velocity,
      movement,
      CONTROL_ACCELERATION,
      delta,
      MAX_SPEED,
    );
    ballBody.setLinvel({ x: nextVelocity.x, y: velocity.y, z: nextVelocity.z }, true);

    // Match the sphere's spin to its linear motion so traction cannot fight steering.
    const angular = ballBody.angvel();
    ballBody.setAngvel(
      {
        x: nextVelocity.z / BALL_RADIUS,
        y: angular.y * Math.exp(-4 * delta),
        z: -nextVelocity.x / BALL_RADIUS,
      },
      true,
    );
    heading.lerp(movement, 1 - Math.exp(-delta * 7)).normalize();
  }
}

function updateVisuals(delta, position, rotation) {
  ballVisual.position.set(position.x, position.y, position.z);
  ballVisual.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);

  dog.position.set(position.x, position.y - 0.38, position.z);
  // Point the dog's head in the direction of travel.
  const desiredDogYaw = Math.atan2(heading.x, heading.z);
  dogYaw += shortestAngle(dogYaw, desiredDogYaw) * (1 - Math.exp(-delta * 6));
  dog.rotation.y = dogYaw;

  const speed = Math.hypot(ballBody.linvel().x, ballBody.linvel().z);
  dog.rotation.x = Math.min(speed / MAX_SPEED, 1) * -0.1;

  shadow.position.x = position.x;
  shadow.position.z = position.z;
  const height = Math.max(position.y - BALL_RADIUS, 0);
  shadow.scale.setScalar(THREE.MathUtils.clamp(1 - height * 0.16, 0.45, 1));
  shadow.material.opacity = THREE.MathUtils.clamp(0.38 - height * 0.08, 0.08, 0.38);
}

function updateCamera(delta, position) {
  cameraTarget.set(position.x, position.y, position.z);
  cameraAnchor.lerp(cameraTarget, 1 - Math.exp(-delta * 5.5));
  camera.position.copy(cameraAnchor).add(CAMERA_OFFSET);
  camera.lookAt(cameraAnchor.x, cameraAnchor.y + 0.15, cameraAnchor.z);
}

let previousTime = performance.now();

function frame(time) {
  requestAnimationFrame(frame);
  const delta = Math.min((time - previousTime) / 1000, MAX_FRAME_DELTA);
  previousTime = time;
  physicsAccumulator += delta;

  while (physicsAccumulator >= PHYSICS_TIMESTEP) {
    previousPhysicsPosition.copy(currentPhysicsPosition);
    previousPhysicsRotation.copy(currentPhysicsRotation);
    updateControls(PHYSICS_TIMESTEP);
    world.step();

    const position = ballBody.translation();
    const rotation = ballBody.rotation();
    currentPhysicsPosition.set(position.x, position.y, position.z);
    currentPhysicsRotation.set(rotation.x, rotation.y, rotation.z, rotation.w);
    physicsAccumulator -= PHYSICS_TIMESTEP;
  }

  const interpolation = physicsAccumulator / PHYSICS_TIMESTEP;
  renderPosition.lerpVectors(previousPhysicsPosition, currentPhysicsPosition, interpolation);
  renderRotation.slerpQuaternions(
    previousPhysicsRotation,
    currentPhysicsRotation,
    interpolation,
  );
  updateVisuals(delta, renderPosition, renderRotation);
  updateCamera(delta, renderPosition);

  if (ballBody.translation().y < -8) resetBall();
  renderer.render(scene, camera);
}

requestAnimationFrame(frame);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
  renderer.setSize(window.innerWidth, window.innerHeight);
});
