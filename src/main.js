import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import "./style.css";
import { createBostonTerrier } from "./dog.js";
import {
  claimGift,
  createPresent,
  GiftReveal,
  hasClaimedGift,
  resetGift,
} from "./gift.js";
import { createLevel, destroyLevel, getLevelCount } from "./levels.js";
import { accelerateHorizontal, boostHorizontal } from "./movement.js";
import { formatTime, reachesFinish } from "./timer.js";

await RAPIER.init({});

const BALL_RADIUS = 1.28;
const levelStart = new THREE.Vector3(0, BALL_RADIUS + 0.08, 7);
const MAX_SPEED = 26;
const CONTROL_ACCELERATION = 15;
const CAMERA_OFFSET = new THREE.Vector3(0, 8.85, 13.2);
const PHYSICS_TIMESTEP = 1 / 120;
const MAX_FRAME_DELTA = 1 / 20;
const timerElement = document.querySelector("#timer");
const giftReveal = new GiftReveal();
const shouldResetGift = import.meta.env.DEV
  || new URLSearchParams(window.location.search).has("resetGift");

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

const world = new RAPIER.World({ x: 0, y: -22, z: 0 });
world.timestep = PHYSICS_TIMESTEP;

const ballBody = world.createRigidBody(
  RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(levelStart.x, levelStart.y, levelStart.z)
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
const cameraAnchor = levelStart.clone();
const previousPhysicsPosition = levelStart.clone();
const currentPhysicsPosition = levelStart.clone();
const renderPosition = levelStart.clone();
const previousPhysicsRotation = new THREE.Quaternion();
const currentPhysicsRotation = new THREE.Quaternion();
const renderRotation = new THREE.Quaternion();
const shadowRay = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
let dogYaw = Math.PI;
let physicsAccumulator = 0;
let activeLevel;
let activeGiftPickup;
let timerStartedAt = null;
let timerElapsed = 0;
let timerFinished = false;
let timerReadyToStart = true;
let levelAnimationTime = 0;
const occupiedBoostPads = new Set();

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
  if (giftReveal.active) {
    event.preventDefault();
    if (
      giftReveal.elapsed > 2
      && ["Enter", "Space", "Escape"].includes(event.code)
    ) giftReveal.dismiss();
    return;
  }
  const requestedLevel = Number(event.code.replace("Digit", ""));
  if (
    event.code.startsWith("Digit")
    && Number.isInteger(requestedLevel)
    && requestedLevel < getLevelCount()
  ) {
    event.preventDefault();
    if (!event.repeat) switchLevel(requestedLevel);
    return;
  }

  if (controlledKeys.has(event.code)) event.preventDefault();
  pressed.add(event.code);
  if (event.code === "KeyR") resetBall();
});

window.addEventListener("keyup", (event) => {
  pressed.delete(event.code);
});

window.addEventListener("blur", () => pressed.clear());

function resetBall() {
  const spawn = activeLevel?.start ?? levelStart;
  pressed.clear();
  ballBody.resetForces(true);
  ballBody.resetTorques(true);
  ballBody.setTranslation({ x: spawn.x, y: spawn.y, z: spawn.z }, true);
  ballBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
  ballBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
  movement.set(0, 0, 0);
  heading.set(0, 0, -1);
  previousPhysicsPosition.copy(spawn);
  currentPhysicsPosition.copy(spawn);
  renderPosition.copy(spawn);
  previousPhysicsRotation.identity();
  currentPhysicsRotation.identity();
  renderRotation.identity();
  physicsAccumulator = 0;
  cameraAnchor.copy(spawn);
  camera.position.copy(cameraAnchor).add(CAMERA_OFFSET);
  camera.lookAt(cameraAnchor.x, cameraAnchor.y + 0.15, cameraAnchor.z);
  dogYaw = Math.PI;
  occupiedBoostPads.clear();
  prepareTimer();
}

function prepareTimer() {
  if (timerStartedAt !== null) {
    timerElapsed = performance.now() - timerStartedAt;
    timerElement.textContent = formatTime(timerElapsed);
  }
  timerStartedAt = null;
  timerReadyToStart = true;
  timerElement.hidden = !activeLevel?.finish;
}

function startTimer() {
  if (!activeLevel?.finish || !timerReadyToStart) return;
  timerElapsed = 0;
  timerFinished = false;
  timerReadyToStart = false;
  timerElement.textContent = formatTime(0);
  timerStartedAt = performance.now();
}

function stopTimer() {
  if (timerStartedAt === null || timerFinished) return;
  timerElapsed = performance.now() - timerStartedAt;
  timerStartedAt = null;
  timerFinished = true;
  timerReadyToStart = false;
  timerElement.textContent = formatTime(timerElapsed);
}

function updateTimer(time) {
  if (timerStartedAt === null) return;
  timerElapsed = time - timerStartedAt;
  timerElement.textContent = formatTime(timerElapsed);
}

function switchLevel(levelId) {
  if (activeLevel?.id === levelId) {
    resetBall();
    return;
  }

  if (activeLevel) {
    giftReveal.dismiss();
    scene.remove(activeLevel.group);
    destroyLevel(world, activeLevel);
  }

  activeLevel = createLevel(world, levelId, BALL_RADIUS * 2);
  levelAnimationTime = 0;
  levelStart.copy(activeLevel.start);
  activeGiftPickup = null;
  if (activeLevel.finish && shouldResetGift) resetGift(activeLevel.id);
  if (activeLevel.finish && !hasClaimedGift(activeLevel.id)) {
    activeGiftPickup = createPresent();
    activeGiftPickup.position.copy(activeLevel.finish.position);
    activeGiftPickup.position.y += 1.25;
    activeGiftPickup.userData.baseY = activeGiftPickup.position.y;
    activeLevel.group.add(activeGiftPickup);
  }
  scene.add(activeLevel.group);
  document.querySelector("#level-name").textContent = `LEVEL ${activeLevel.id}: ${activeLevel.name}`;

  const url = new URL(window.location.href);
  url.searchParams.set("level", activeLevel.id);
  window.history.replaceState(null, "", url);
  resetBall();
}

function shortestAngle(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function updateControls(delta) {
  if (giftReveal.active) return;
  const x = Number(pressed.has("KeyD") || pressed.has("ArrowRight"))
    - Number(pressed.has("KeyA") || pressed.has("ArrowLeft"));
  const z = Number(pressed.has("KeyW") || pressed.has("ArrowUp"))
    - Number(pressed.has("KeyS") || pressed.has("ArrowDown"));

  movement.set(x, 0, -z);

  const velocity = ballBody.linvel();

  if (movement.lengthSq() > 0) {
    startTimer();
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

function revealGift() {
  if (!activeGiftPickup?.visible || giftReveal.active) return;
  const position = new THREE.Vector3();
  activeGiftPickup.getWorldPosition(position);
  giftReveal.start(position, camera);
  claimGift(activeLevel.id);
  activeGiftPickup.visible = false;
  pressed.clear();
  ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
  ballBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

function updateBoostPads() {
  const position = ballBody.translation();
  for (const pad of activeLevel.boostPads ?? []) {
    const offsetX = position.x - pad.position.x;
    const offsetZ = position.z - pad.position.z;
    const forwardDistance = offsetX * pad.direction.x + offsetZ * pad.direction.z;
    const lateralDistance = -offsetX * pad.direction.z + offsetZ * pad.direction.x;
    const isInside = Math.abs(forwardDistance) <= pad.halfLength
      && Math.abs(lateralDistance) <= pad.halfWidth
      && Math.abs(position.y - (pad.position.y + BALL_RADIUS)) <= BALL_RADIUS * 0.6;

    if (!isInside) {
      occupiedBoostPads.delete(pad);
      continue;
    }
    if (occupiedBoostPads.has(pad)) continue;
    occupiedBoostPads.add(pad);

    const velocity = ballBody.linvel();
    const boostedVelocity = boostHorizontal(velocity, pad.direction, pad.speed);
    ballBody.setLinvel(
      { x: boostedVelocity.x, y: velocity.y, z: boostedVelocity.z },
      true,
    );
    const angular = ballBody.angvel();
    ballBody.setAngvel({
      x: boostedVelocity.z / BALL_RADIUS,
      y: angular.y,
      z: -boostedVelocity.x / BALL_RADIUS,
    }, true);
    heading.set(pad.direction.x, 0, pad.direction.z);
  }
}

function updateLevelAnimations(delta) {
  levelAnimationTime += delta;
  for (const obstacle of activeLevel.animatedBodies ?? []) {
    const angle = obstacle.swingAngle * Math.sin(
      levelAnimationTime * obstacle.angularSpeed + obstacle.phase,
    ) * obstacle.spinDirection;
    const halfSine = Math.sin(angle / 2);
    const rotation = {
      x: obstacle.axis === "x" ? halfSine : 0,
      y: 0,
      z: obstacle.axis === "z" ? halfSine : 0,
      w: Math.cos(angle / 2),
    };
    obstacle.body.setNextKinematicRotation(rotation);
    obstacle.visual.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
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
  shadowRay.origin.x = position.x;
  shadowRay.origin.y = position.y;
  shadowRay.origin.z = position.z;
  const shadowHit = world.castRay(
    shadowRay,
    20,
    true,
    undefined,
    undefined,
    undefined,
    ballBody,
  );
  shadow.visible = Boolean(shadowHit);
  if (!shadowHit) return;

  shadow.position.y = position.y - shadowHit.timeOfImpact + 0.025;
  const height = Math.max(shadowHit.timeOfImpact - BALL_RADIUS, 0);
  shadow.scale.setScalar(THREE.MathUtils.clamp(1 - height * 0.16, 0.45, 1));
  shadow.material.opacity = THREE.MathUtils.clamp(0.38 - height * 0.08, 0.08, 0.38);
}

function updateCamera(delta, position) {
  cameraTarget.set(position.x, position.y, position.z);
  cameraAnchor.lerp(cameraTarget, 1 - Math.exp(-delta * 5.5));
  camera.position.copy(cameraAnchor).add(CAMERA_OFFSET);
  camera.lookAt(cameraAnchor.x, cameraAnchor.y + 0.15, cameraAnchor.z);
}

function updateGiftPickup(time) {
  if (!activeGiftPickup?.visible) return;
  activeGiftPickup.rotation.y = time * 0.0012;
  activeGiftPickup.position.y = activeGiftPickup.userData.baseY
    + Math.sin(time * 0.0025) * 0.18;
}

let previousTime = performance.now();

const requestedLevel = Number(new URLSearchParams(window.location.search).get("level"));
switchLevel(Number.isInteger(requestedLevel) ? requestedLevel : 0);

function frame(time) {
  requestAnimationFrame(frame);
  const delta = Math.min((time - previousTime) / 1000, MAX_FRAME_DELTA);
  previousTime = time;
  physicsAccumulator += delta;

  while (physicsAccumulator >= PHYSICS_TIMESTEP) {
    previousPhysicsPosition.copy(currentPhysicsPosition);
    previousPhysicsRotation.copy(currentPhysicsRotation);
    updateLevelAnimations(PHYSICS_TIMESTEP);
    updateControls(PHYSICS_TIMESTEP);
    updateBoostPads();
    world.step();

    const position = ballBody.translation();
    const rotation = ballBody.rotation();
    currentPhysicsPosition.set(position.x, position.y, position.z);
    currentPhysicsRotation.set(rotation.x, rotation.y, rotation.z, rotation.w);
    if (
      timerStartedAt !== null
      && reachesFinish(previousPhysicsPosition, currentPhysicsPosition, activeLevel.finish)
    ) {
      stopTimer();
      revealGift();
    }
    physicsAccumulator -= PHYSICS_TIMESTEP;
  }

  if (ballBody.translation().y < activeLevel.fallY) resetBall();

  const interpolation = physicsAccumulator / PHYSICS_TIMESTEP;
  renderPosition.lerpVectors(previousPhysicsPosition, currentPhysicsPosition, interpolation);
  renderRotation.slerpQuaternions(
    previousPhysicsRotation,
    currentPhysicsRotation,
    interpolation,
  );
  updateVisuals(delta, renderPosition, renderRotation);
  updateCamera(delta, renderPosition);
  updateTimer(time);
  updateGiftPickup(time);
  giftReveal.update(delta);

  renderer.render(scene, camera);
  if (giftReveal.active) {
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(giftReveal.scene, giftReveal.camera);
    renderer.autoClear = true;
  }
}

requestAnimationFrame(frame);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
  renderer.setSize(window.innerWidth, window.innerHeight);
  giftReveal.resize(window.innerWidth, window.innerHeight);
});
