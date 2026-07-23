import * as THREE from "three";

const black = new THREE.MeshLambertMaterial({ color: 0x17141b });
const white = new THREE.MeshLambertMaterial({ color: 0xf3eee4 });
const pink = new THREE.MeshLambertMaterial({ color: 0xd88995 });
const eye = new THREE.MeshBasicMaterial({ color: 0x090609 });

function mesh(geometry, material, position, scale, parent) {
  const part = new THREE.Mesh(geometry, material);
  part.position.set(...position);
  part.scale.set(...scale);
  parent.add(part);
  return part;
}

function makeEar(x, parent) {
  const shape = new THREE.BufferGeometry();
  const side = Math.sign(x);
  const vertices = new Float32Array([
    x - side * 0.03, 0.78, 0.03,
    x + side * 0.34, 1.26, -0.01,
    x + side * 0.39, 0.67, -0.02,
    x - side * 0.03, 0.78, 0.03,
    x + side * 0.39, 0.67, -0.02,
    x + side * 0.12, 0.72, -0.19,
  ]);
  shape.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  shape.computeVertexNormals();
  const ear = new THREE.Mesh(shape, black);
  parent.add(ear);

  const inner = mesh(
    new THREE.CircleGeometry(0.15, 3),
    pink,
    [x + side * 0.18, 0.86, 0.035],
    [0.7, 1.3, 1],
    parent,
  );
  inner.rotation.z = -side * 0.28;
}

export function createBostonTerrier() {
  const dog = new THREE.Group();
  const lowSphere = new THREE.SphereGeometry(1, 8, 6);

  // A compact body with a broad white Boston-terrier chest.
  mesh(lowSphere, black, [0, 0.05, 0.02], [0.48, 0.55, 0.55], dog);
  mesh(lowSphere, white, [0, 0.13, 0.46], [0.27, 0.4, 0.08], dog);

  // Short legs and oversized pale paws keep the silhouette readable in motion.
  for (const x of [-0.3, 0.3]) {
    mesh(lowSphere, black, [x, -0.38, 0.3], [0.14, 0.31, 0.14], dog);
    mesh(lowSphere, white, [x, -0.62, 0.36], [0.17, 0.12, 0.24], dog);
    mesh(lowSphere, black, [x, -0.36, -0.29], [0.16, 0.29, 0.16], dog);
    mesh(lowSphere, white, [x, -0.59, -0.26], [0.18, 0.11, 0.2], dog);
  }

  const head = new THREE.Group();
  head.position.set(0, 0.49, 0.14);
  dog.add(head);

  mesh(lowSphere, black, [0, 0.16, 0.04], [0.52, 0.48, 0.45], head);
  makeEar(-0.3, head);
  makeEar(0.3, head);

  // White blaze, cheeks, and the flat muzzle are the breed's main identifiers.
  mesh(lowSphere, white, [0, 0.29, 0.43], [0.12, 0.33, 0.07], head);
  mesh(lowSphere, white, [-0.18, 0.05, 0.43], [0.25, 0.22, 0.12], head);
  mesh(lowSphere, white, [0.18, 0.05, 0.43], [0.25, 0.22, 0.12], head);
  mesh(lowSphere, black, [0, 0.1, 0.57], [0.16, 0.11, 0.1], head);

  for (const x of [-0.22, 0.22]) {
    mesh(lowSphere, white, [x, 0.3, 0.42], [0.14, 0.14, 0.07], head);
    mesh(lowSphere, eye, [x, 0.3, 0.49], [0.075, 0.085, 0.04], head);
    mesh(lowSphere, white, [x - 0.025, 0.33, 0.525], [0.018, 0.018, 0.01], head);
  }

  const tail = mesh(
    new THREE.ConeGeometry(0.09, 0.34, 5),
    black,
    [0, 0.02, -0.53],
    [1, 1, 1],
    dog,
  );
  tail.rotation.x = -1.2;

  dog.scale.setScalar(0.76);
  dog.userData.head = head;
  dog.userData.paws = dog.children.filter((part) => part.material === white).slice(2, 6);
  return dog;
}
