import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import "./style.css";
import { touchesCheckpoint } from "./checkpoint.js";
import { createBostonTerrier } from "./dog.js";
import {
  claimGift,
  createPresent,
  GiftReveal,
  hasClaimedGift,
  resetGift,
} from "./gift.js";
import { isCrashLanding } from "./impact.js";
import {
  hasSeenIntro,
  IntroCutscene,
  resetIntro,
} from "./intro.js";
import { createCourse } from "./course.js";
import {
  accelerateHorizontal,
  boostHorizontal,
  rollingAngularVelocity,
} from "./movement.js";
import { formatTime, reachesFinish } from "./timer.js";
import soundtrackUrl from "../soundtrack-loop.mp3?url";

await RAPIER.init({});

const BALL_RADIUS = 1.28;
const courseStart = new THREE.Vector3(0, BALL_RADIUS + 0.08, 7);
const MAX_SPEED = 26;
const CONTROL_ACCELERATION = 15;
const CAMERA_OFFSET = new THREE.Vector3(0, 8.85, 13.2);
const PHYSICS_TIMESTEP = 1 / 120;
const MAX_FRAME_DELTA = 1 / 20;
const CRASH_DURATION = 0.9;
const SKY_COLOR = 0x67c8ff;
const timerElement = document.querySelector("#timer");
const giftReveal = new GiftReveal();
const introCutscene = new IntroCutscene();
const soundtrack = new Audio(soundtrackUrl);
soundtrack.loop = true;
soundtrack.preload = "none";
soundtrack.volume = 0.5;
let soundtrackStarted = false;
const shouldResetProgress = import.meta.env.DEV
  || new URLSearchParams(window.location.search).has("resetGift");
const initialUrl = new URL(window.location.href);
if (initialUrl.searchParams.has("level")) {
  initialUrl.searchParams.delete("level");
  window.history.replaceState(null, "", initialUrl);
}

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.querySelector("#app").appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY_COLOR);
scene.fog = new THREE.Fog(SKY_COLOR, 35, 84);

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
    .setTranslation(courseStart.x, courseStart.y, courseStart.z)
    .setLinearDamping(0.35)
    .setAngularDamping(0.72)
    .setCcdEnabled(true),
);
const ballCollider = world.createCollider(
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

function createStarGeometry() {
  const shape = new THREE.Shape();
  for (let point = 0; point < 10; point += 1) {
    const angle = Math.PI / 2 + point * Math.PI / 5;
    const radius = point % 2 === 0 ? 0.28 : 0.12;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (point === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

const crashEffect = new THREE.Group();
const crashStarGeometry = createStarGeometry();
for (let index = 0; index < 6; index += 1) {
  const star = new THREE.Mesh(
    crashStarGeometry,
    new THREE.MeshBasicMaterial({
      color: index % 2 === 0 ? 0xffdf3e : 0xffffff,
      side: THREE.DoubleSide,
      depthTest: false,
    }),
  );
  star.userData.angle = index / 6 * Math.PI * 2;
  star.renderOrder = 5;
  crashEffect.add(star);
}
crashEffect.visible = false;
scene.add(crashEffect);

const pressed = new Set();
const movement = new THREE.Vector3();
const heading = new THREE.Vector3(0, 0, -1);
const cameraTarget = new THREE.Vector3();
const cameraAnchor = courseStart.clone();
const previousPhysicsPosition = courseStart.clone();
const currentPhysicsPosition = courseStart.clone();
const renderPosition = courseStart.clone();
const railClosestPoint = new THREE.Vector3();
const railNormal = new THREE.Vector3();
const railOffset = new THREE.Vector3();
const previousPhysicsRotation = new THREE.Quaternion();
const currentPhysicsRotation = new THREE.Quaternion();
const renderRotation = new THREE.Quaternion();
const shadowRay = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
let dogYaw = Math.PI;
let physicsAccumulator = 0;
let course;
let activeGiftPickup;
let timerStartedAt = null;
let timerElapsed = 0;
let timerFinished = false;
let timerReadyToStart = true;
let courseAnimationTime = 0;
let checkpointActive = false;
let crashActive = false;
let crashElapsed = 0;
let wasSupported = true;
let airbornePeakY = courseStart.y;
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

function startSoundtrack() {
  if (soundtrackStarted) return;
  soundtrackStarted = true;
  soundtrack.play().catch(() => {
    soundtrackStarted = false;
  });
}

window.addEventListener("pointerdown", startSoundtrack, { passive: true });

window.addEventListener("keydown", (event) => {
  startSoundtrack();
  if (introCutscene.active) {
    event.preventDefault();
    if (!event.repeat) introCutscene.dismiss();
    return;
  }
  if (giftReveal.active) {
    event.preventDefault();
    if (giftReveal.elapsed > 2 && !event.repeat) giftReveal.dismiss();
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

function resetBall({ fromFall = false } = {}) {
  const useCheckpoint = Boolean(fromFall && checkpointActive && course?.checkpoint);
  const spawn = useCheckpoint ? course.checkpoint.spawn : course?.start ?? courseStart;
  if (!useCheckpoint) checkpointActive = false;
  crashActive = false;
  crashElapsed = 0;
  crashEffect.visible = false;
  ballBody.setEnabled(true);
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
  wasSupported = true;
  airbornePeakY = spawn.y;
  occupiedBoostPads.clear();
  if (!useCheckpoint) prepareTimer();
}

function prepareTimer() {
  if (timerStartedAt !== null) {
    timerElapsed = performance.now() - timerStartedAt;
    timerElement.textContent = formatTime(timerElapsed);
  }
  timerStartedAt = null;
  timerReadyToStart = true;
  timerElement.hidden = !course?.finish;
}

function startTimer() {
  if (!course?.finish || !timerReadyToStart) return;
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

function loadCourse() {
  course = createCourse(world, BALL_RADIUS * 2);
  courseAnimationTime = 0;
  courseStart.copy(course.start);
  activeGiftPickup = null;
  if (shouldResetProgress) {
    resetGift();
    resetIntro();
  }
  if (!hasClaimedGift()) {
    activeGiftPickup = createPresent();
    activeGiftPickup.position.copy(course.finish.position);
    activeGiftPickup.position.y += 1.25;
    activeGiftPickup.userData.baseY = activeGiftPickup.position.y;
    course.group.add(activeGiftPickup);
  }
  scene.add(course.group);
  resetBall();
  if (!hasSeenIntro()) introCutscene.start();
}

function shortestAngle(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function getRailSurfaceNormal(position) {
  for (const rail of course.rails) {
    let touching = false;
    world.contactPair(ballCollider, rail.collider, (manifold) => {
      if (manifold.numSolverContacts() > 0) touching = true;
    });
    if (!touching) continue;

    railOffset.set(position.x, position.y, position.z).sub(rail.center);
    const axisDistance = THREE.MathUtils.clamp(
      railOffset.dot(rail.axis),
      -rail.halfLength,
      rail.halfLength,
    );
    railClosestPoint.copy(rail.axis).multiplyScalar(axisDistance).add(rail.center);
    railNormal.set(position.x, position.y, position.z).sub(railClosestPoint);
    if (railNormal.lengthSq() > 1e-8) return railNormal.normalize();
  }
  return null;
}

function isBallSupported() {
  let supported = false;
  world.contactPairsWith(ballCollider, (collider) => {
    world.contactPair(ballCollider, collider, (manifold) => {
      if (
        manifold.numSolverContacts() > 0
        && Math.abs(manifold.normal().y) >= 0.35
      ) supported = true;
    });
  });
  return supported;
}

function startCrash(position, rotation) {
  crashActive = true;
  crashElapsed = 0;
  pressed.clear();
  ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
  ballBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
  ballBody.setEnabled(false);
  previousPhysicsPosition.set(position.x, position.y, position.z);
  currentPhysicsPosition.copy(previousPhysicsPosition);
  renderPosition.copy(previousPhysicsPosition);
  previousPhysicsRotation.set(rotation.x, rotation.y, rotation.z, rotation.w);
  currentPhysicsRotation.copy(previousPhysicsRotation);
  renderRotation.copy(previousPhysicsRotation);
  crashEffect.position.set(position.x, position.y + 0.45, position.z);
  crashEffect.visible = true;
}

function updateCrashEffect(delta) {
  if (!crashActive) return;
  crashElapsed += delta;
  const progress = Math.min(crashElapsed / CRASH_DURATION, 1);
  for (let index = 0; index < crashEffect.children.length; index += 1) {
    const star = crashEffect.children[index];
    const angle = star.userData.angle + progress * Math.PI * 1.4;
    const radius = 0.35 + progress * 1.65;
    star.position.set(
      Math.cos(angle) * radius,
      0.2 + Math.sin(progress * Math.PI) * (0.8 + index % 2 * 0.25),
      Math.sin(angle) * 0.35,
    );
    star.rotation.z = angle + progress * Math.PI * 2;
    star.scale.setScalar(1 - progress * 0.35);
  }
  if (progress >= 1) resetBall({ fromFall: true });
}

function updateControls(delta) {
  if (giftReveal.active || crashActive) return;
  const x = Number(pressed.has("KeyD") || pressed.has("ArrowRight"))
    - Number(pressed.has("KeyA") || pressed.has("ArrowLeft"));
  const z = Number(pressed.has("KeyW") || pressed.has("ArrowUp"))
    - Number(pressed.has("KeyS") || pressed.has("ArrowDown"));

  movement.set(x, 0, -z);

  const velocity = ballBody.linvel();
  let rollingVelocity = velocity;
  const hasInput = movement.lengthSq() > 0;

  if (hasInput) {
    startTimer();
    movement.normalize();
    const nextVelocity = accelerateHorizontal(
      velocity,
      movement,
      CONTROL_ACCELERATION,
      delta,
      MAX_SPEED,
    );
    rollingVelocity = { x: nextVelocity.x, y: velocity.y, z: nextVelocity.z };
    ballBody.setLinvel(rollingVelocity, true);

    heading.lerp(movement, 1 - Math.exp(-delta * 7)).normalize();
  }

  const surfaceNormal = getRailSurfaceNormal(ballBody.translation());
  if (surfaceNormal) {
    const angular = ballBody.angvel();
    const twist = (
      angular.x * surfaceNormal.x
      + angular.y * surfaceNormal.y
      + angular.z * surfaceNormal.z
    ) * Math.exp(-4 * delta);
    ballBody.setAngvel(
      rollingAngularVelocity(rollingVelocity, surfaceNormal, BALL_RADIUS, twist),
      true,
    );
  } else if (hasInput) {
    // Match the sphere's spin to its linear motion so traction cannot fight steering.
    const angular = ballBody.angvel();
    ballBody.setAngvel(
      {
        x: rollingVelocity.z / BALL_RADIUS,
        y: angular.y * Math.exp(-4 * delta),
        z: -rollingVelocity.x / BALL_RADIUS,
      },
      true,
    );
  }
}

function revealGift() {
  if (!activeGiftPickup?.visible || giftReveal.active) return;
  const position = new THREE.Vector3();
  activeGiftPickup.getWorldPosition(position);
  giftReveal.start(position, camera);
  claimGift();
  activeGiftPickup.visible = false;
  pressed.clear();
  ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
  ballBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

function updateBoostPads() {
  const position = ballBody.translation();
  for (const pad of course.boostPads ?? []) {
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

function updateCourseAnimations(delta) {
  courseAnimationTime += delta;
  for (const obstacle of course.animatedBodies ?? []) {
    const angle = obstacle.swingAngle * Math.sin(
      courseAnimationTime * obstacle.angularSpeed + obstacle.phase,
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

function updateIntroCamera(position) {
  camera.position.set(position.x + 5, position.y + 2.6, position.z - 5.5);
  camera.lookAt(position.x + 3, position.y + 0.15, position.z);
  dog.rotation.set(0, Math.PI, 0);
}

function updateGiftPickup(time) {
  if (!activeGiftPickup?.visible) return;
  activeGiftPickup.rotation.y = time * 0.0012;
  activeGiftPickup.position.y = activeGiftPickup.userData.baseY
    + Math.sin(time * 0.0025) * 0.18;
}

let previousTime = performance.now();

loadCourse();

function frame(time) {
  requestAnimationFrame(frame);
  const delta = Math.min((time - previousTime) / 1000, MAX_FRAME_DELTA);
  previousTime = time;
  if (crashActive || introCutscene.active) physicsAccumulator = 0;
  else physicsAccumulator += delta;

  while (
    !crashActive
    && !introCutscene.active
    && physicsAccumulator >= PHYSICS_TIMESTEP
  ) {
    previousPhysicsPosition.copy(currentPhysicsPosition);
    previousPhysicsRotation.copy(currentPhysicsRotation);
    updateCourseAnimations(PHYSICS_TIMESTEP);
    updateControls(PHYSICS_TIMESTEP);
    updateBoostPads();
    const stepVelocity = ballBody.linvel();
    const velocityBeforeStep = {
      x: stepVelocity.x,
      y: stepVelocity.y,
      z: stepVelocity.z,
    };
    world.step();

    const position = ballBody.translation();
    const rotation = ballBody.rotation();
    currentPhysicsPosition.set(position.x, position.y, position.z);
    currentPhysicsRotation.set(rotation.x, rotation.y, rotation.z, rotation.w);
    const supported = isBallSupported();
    if (supported) {
      const fallDistance = airbornePeakY - position.y;
      if (
        !wasSupported
        && isCrashLanding(fallDistance, velocityBeforeStep)
      ) {
        startCrash(position, rotation);
        wasSupported = true;
        airbornePeakY = position.y;
        physicsAccumulator = 0;
        break;
      }
      airbornePeakY = position.y;
    } else {
      airbornePeakY = Math.max(airbornePeakY, position.y);
    }
    wasSupported = supported;
    if (
      !checkpointActive
      && touchesCheckpoint(position, course.checkpoint, BALL_RADIUS)
    ) checkpointActive = true;
    if (
      timerStartedAt !== null
      && reachesFinish(previousPhysicsPosition, currentPhysicsPosition, course.finish)
    ) {
      checkpointActive = false;
      stopTimer();
      revealGift();
    }
    physicsAccumulator -= PHYSICS_TIMESTEP;
  }

  if (
    !crashActive
    && !introCutscene.active
    && ballBody.translation().y < course.fallY
  ) {
    resetBall({ fromFall: true });
  }
  updateCrashEffect(delta);

  const interpolation = physicsAccumulator / PHYSICS_TIMESTEP;
  renderPosition.lerpVectors(previousPhysicsPosition, currentPhysicsPosition, interpolation);
  renderRotation.slerpQuaternions(
    previousPhysicsRotation,
    currentPhysicsRotation,
    interpolation,
  );
  updateVisuals(delta, renderPosition, renderRotation);
  if (introCutscene.active) updateIntroCamera(renderPosition);
  else updateCamera(delta, renderPosition);
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
