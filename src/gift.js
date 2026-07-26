import * as THREE from "three";

const STORAGE_KEY = "boston-ball:gift:v1";

export function giftStorageKey() {
  return STORAGE_KEY;
}

export function hasClaimedGift() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "claimed";
  } catch {
    return false;
  }
}

export function claimGift() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "claimed");
  } catch {
    // The reveal still works when storage is unavailable.
  }
}

export function resetGift() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable in private browsing modes.
  }
}

function createBow(material) {
  const bow = new THREE.Group();
  for (const side of [-1, 1]) {
    const loop = new THREE.Mesh(
      new THREE.TorusGeometry(0.25, 0.07, 5, 10, Math.PI * 1.55),
      material,
    );
    loop.scale.x = 1.25;
    loop.rotation.set(Math.PI / 2, 0, side * 0.3);
    loop.position.set(side * 0.2, 0.16, 0);
    bow.add(loop);
  }
  return bow;
}

export function createPresent() {
  const present = new THREE.Group();
  const boxMaterial = new THREE.MeshLambertMaterial({ color: 0xe94373 });
  const ribbonMaterial = new THREE.MeshLambertMaterial({ color: 0xffd447 });
  const wallThickness = 0.1;
  const wallHeight = 1.15;
  const halfSize = 0.75;
  const bottom = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, wallThickness, 1.5),
    boxMaterial,
  );
  bottom.position.y = -wallHeight / 2 + wallThickness / 2;
  present.add(bottom);
  for (const z of [-1, 1]) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, wallHeight, wallThickness),
      boxMaterial,
    );
    wall.position.z = z * (halfSize - wallThickness / 2);
    present.add(wall);
    const ribbon = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, wallHeight + 0.02, 0.025),
      ribbonMaterial,
    );
    ribbon.position.z = z * (halfSize + 0.012);
    present.add(ribbon);
  }
  for (const x of [-1, 1]) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, wallHeight, 1.3),
      boxMaterial,
    );
    wall.position.x = x * (halfSize - wallThickness / 2);
    present.add(wall);
    const ribbon = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, wallHeight + 0.02, 0.22),
      ribbonMaterial,
    );
    ribbon.position.x = x * (halfSize + 0.012);
    present.add(ribbon);
  }

  const lid = new THREE.Group();
  lid.position.y = 0.7;
  lid.add(new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.24, 1.68), boxMaterial));
  const lidRibbon = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.27, 1.72),
    ribbonMaterial,
  );
  lid.add(lidRibbon);
  const crossedRibbon = lidRibbon.clone();
  crossedRibbon.rotation.y = Math.PI / 2;
  lid.add(crossedRibbon);
  lid.add(createBow(ribbonMaterial));
  present.add(lid);
  present.userData.lid = lid;
  present.userData.lidStartY = lid.position.y;
  return present;
}

function createLens(frameMaterial, lensMaterial, x) {
  const group = new THREE.Group();
  group.position.x = x;
  const radiusX = 0.72;
  const radiusY = 0.41;
  const points = Array.from({ length: 24 }, (_, index) => {
    const angle = index / 24 * Math.PI * 2;
    return new THREE.Vector3(
      Math.cos(angle) * radiusX,
      Math.sin(angle) * radiusY,
      0,
    );
  });
  const frameCurve = new THREE.CatmullRomCurve3(points, true, "catmullrom", 0.25);
  group.add(new THREE.Mesh(
    new THREE.TubeGeometry(frameCurve, 32, 0.075, 6, true),
    frameMaterial,
  ));
  const lensShape = new THREE.Shape();
  lensShape.absellipse(0, 0, radiusX * 0.91, radiusY * 0.89, 0, Math.PI * 2);
  const lens = new THREE.Mesh(new THREE.ShapeGeometry(lensShape, 20), lensMaterial);
  lens.position.z = -0.025;
  group.add(lens);
  return group;
}

function cylinderBetween(start, end, radius, material) {
  const direction = end.clone().sub(start);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, direction.length(), 6),
    material,
  );
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  return mesh;
}

export function createGlasses() {
  const glasses = new THREE.Group();
  const frameMaterial = new THREE.MeshPhongMaterial({
    color: 0x241916,
    shininess: 85,
    specular: 0xffc78a,
  });
  const lensMaterial = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.18,
    shininess: 100,
    specular: 0xffffff,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  glasses.add(createLens(frameMaterial, lensMaterial, -0.86));
  glasses.add(createLens(frameMaterial, lensMaterial, 0.86));
  glasses.add(cylinderBetween(
    new THREE.Vector3(-0.18, 0.08, 0),
    new THREE.Vector3(0.18, 0.08, 0),
    0.055,
    frameMaterial,
  ));
  for (const side of [-1, 1]) {
    const templeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 1.55, 0.1, -0.02),
      new THREE.Vector3(side * 1.78, 0.06, -0.35),
      new THREE.Vector3(side * 1.84, 0.02, -1.35),
      new THREE.Vector3(side * 1.79, -0.18, -1.75),
      new THREE.Vector3(side * 1.7, -0.38, -1.83),
    ]);
    glasses.add(new THREE.Mesh(
      new THREE.TubeGeometry(templeCurve, 20, 0.045, 6, false),
      frameMaterial,
    ));
  }
  glasses.rotation.x = -0.12;
  return glasses;
}

function createShine() {
  const shine = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: 0xffec78,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const radius = 14;
  for (let index = 0; index < 24; index += 1) {
    if (index % 2 !== 0) continue;
    const start = index / 24 * Math.PI * 2;
    const end = (index + 1) / 24 * Math.PI * 2;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([
      0, 0, -2,
      Math.cos(start) * radius, Math.sin(start) * radius, -2,
      Math.cos(end) * radius, Math.sin(end) * radius, -2,
    ], 3));
    geometry.setIndex([0, 1, 2]);
    shine.add(new THREE.Mesh(geometry, material));
  }
  shine.userData.material = material;
  return shine;
}

export class GiftReveal {
  constructor() {
    this.root = document.querySelector("#gift-reveal");
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 30);
    this.camera.position.z = 10;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x7d174f, 3));
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(-4, 6, 8);
    this.scene.add(light);
    this.backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 18),
      new THREE.MeshBasicMaterial({ color: 0x1976b8, transparent: true, opacity: 0 }),
    );
    this.backdrop.position.z = -3;
    this.scene.add(this.backdrop);
    this.shine = createShine();
    this.scene.add(this.shine);
    this.present = createPresent();
    this.scene.add(this.present);
    this.glasses = createGlasses();
    this.glasses.visible = false;
    this.scene.add(this.glasses);
    this.confetti = [];
    this.active = false;
    this.elapsed = 0;
    this.startPosition = new THREE.Vector2();
    this.root.addEventListener("click", () => {
      if (this.elapsed > 2) this.dismiss();
    });
    this.resize(window.innerWidth, window.innerHeight);
  }

  resize(width, height) {
    const halfHeight = 5;
    const halfWidth = halfHeight * width / height;
    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
    this.halfWidth = halfWidth;
  }

  start(worldPosition, mainCamera) {
    const screen = worldPosition.clone().project(mainCamera);
    this.startPosition.set(screen.x * this.halfWidth, screen.y * 5);
    this.active = true;
    this.elapsed = 0;
    document.body.classList.add("gift-active");
    this.root.classList.add("visible");
    this.root.classList.remove("ready");
    this.root.setAttribute("aria-hidden", "false");
    this.present.visible = true;
    this.present.position.set(this.startPosition.x, this.startPosition.y, 0);
    this.present.scale.setScalar(0.25);
    this.present.rotation.set(0.15, 0, -0.08);
    const lid = this.present.userData.lid;
    lid.visible = true;
    lid.position.set(0, this.present.userData.lidStartY, 0);
    lid.rotation.set(0, 0, 0);
    this.glasses.visible = false;
    this.glasses.scale.setScalar(0.001);
    this.glasses.position.set(0, 0.3, 0.3);
    this.backdrop.material.opacity = 0;
    this.shine.userData.material.opacity = 0;
    this.clearConfetti();
  }

  spawnConfetti() {
    const colors = [0xff4f87, 0xffd447, 0x33d17a, 0x45a3ff, 0xffffff];
    const geometry = new THREE.PlaneGeometry(0.1, 0.22);
    for (let index = 0; index < 72; index += 1) {
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color: colors[index % colors.length],
          side: THREE.DoubleSide,
        }),
      );
      mesh.position.set((Math.random() - 0.5) * 0.8, -0.1, 1);
      this.scene.add(mesh);
      this.confetti.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 8,
          3.5 + Math.random() * 5,
          (Math.random() - 0.5) * 2,
        ),
        spin: (Math.random() - 0.5) * 12,
      });
    }
  }

  clearConfetti() {
    for (const particle of this.confetti) {
      this.scene.remove(particle.mesh);
      particle.mesh.material.dispose();
    }
    this.confetti.length = 0;
  }

  update(delta) {
    if (!this.active) return;
    this.elapsed += delta;
    const zoom = Math.min(this.elapsed / 0.8, 1);
    const easedZoom = 1 - (1 - zoom) ** 3;
    this.present.position.x = THREE.MathUtils.lerp(this.startPosition.x, 0, easedZoom);
    this.present.position.y = THREE.MathUtils.lerp(this.startPosition.y, -1.35, easedZoom);
    this.present.scale.setScalar(THREE.MathUtils.lerp(0.25, 1.25, easedZoom));
    this.present.rotation.y += delta * 2.2;
    this.backdrop.material.opacity = easedZoom * 0.88;

    const opened = Math.max(0, Math.min((this.elapsed - 0.72) / 0.5, 1));
    const lid = this.present.userData.lid;
    const lidFlight = opened * opened * (3 - 2 * opened);
    lid.position.y = this.present.userData.lidStartY + lidFlight * 6;
    lid.position.x = lidFlight * (this.halfWidth + 2.5) / 1.25;
    lid.rotation.x = -lidFlight * 0.35;
    lid.rotation.z = -lidFlight * 2.4;
    lid.visible = opened < 0.98;
    this.shine.userData.material.opacity = opened * 0.52;
    this.shine.rotation.z += delta * 0.32;

    if (opened > 0.15 && this.confetti.length === 0) this.spawnConfetti();
    const reveal = Math.max(0, Math.min((this.elapsed - 0.95) / 0.65, 1));
    if (reveal > 0) {
      this.glasses.visible = true;
      const scale = (1 - (1 - reveal) ** 3) * 0.92;
      this.glasses.scale.setScalar(scale);
      this.glasses.position.y = THREE.MathUtils.lerp(-0.35, 0.55, reveal);
      this.glasses.rotation.y += delta * 1.25;
      this.glasses.rotation.z = Math.sin(this.elapsed * 1.8) * 0.08;
    }

    for (const particle of this.confetti) {
      particle.velocity.y -= 7 * delta;
      particle.mesh.position.addScaledVector(particle.velocity, delta);
      particle.mesh.rotation.z += particle.spin * delta;
      particle.mesh.rotation.y += particle.spin * delta * 0.6;
    }
    if (this.elapsed > 2) this.root.classList.add("ready");
  }

  dismiss() {
    if (!this.active) return;
    this.active = false;
    document.body.classList.remove("gift-active");
    this.root.classList.remove("visible", "ready");
    this.root.setAttribute("aria-hidden", "true");
    this.present.visible = false;
    this.glasses.visible = false;
    this.clearConfetti();
  }
}
