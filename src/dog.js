import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

const DOG_HEIGHT = 1.65;

function getPawCenter(model, bounds) {
  const size = bounds.getSize(new THREE.Vector3());
  const contactHeight = bounds.min.y + size.y * 0.045;
  const center = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  let count = 0;

  model.traverse((child) => {
    if (!child.isMesh) return;
    const positions = child.geometry.getAttribute("position");
    for (let index = 0; index < positions.count; index += 1) {
      vertex.fromBufferAttribute(positions, index).applyMatrix4(child.matrixWorld);
      if (vertex.y > contactHeight) continue;
      center.x += vertex.x;
      center.z += vertex.z;
      count += 1;
    }
  });

  if (count > 0) center.multiplyScalar(1 / count);
  return center;
}

export function createBostonTerrier() {
  const dog = new THREE.Group();

  Promise.all([
    new OBJLoader().loadAsync("/assets/boston-terrier.obj"),
    new THREE.TextureLoader().loadAsync("/assets/boston-terrier.png"),
  ]).then(([model, texture]) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;

    const material = new THREE.MeshLambertMaterial({ map: texture });
    model.traverse((child) => {
      if (!child.isMesh) return;
      child.material = material;
      child.frustumCulled = false;
    });

    model.updateMatrixWorld(true);
    let bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    model.scale.multiplyScalar(DOG_HEIGHT / size.y);
    model.updateMatrixWorld(true);

    bounds = new THREE.Box3().setFromObject(model);
    const pawCenter = getPawCenter(model, bounds);
    model.position.x -= pawCenter.x;
    model.position.y += -0.72 - bounds.min.y;
    model.position.z -= pawCenter.z;

    dog.add(model);
  }).catch((error) => {
    console.error("Unable to load Boston terrier model", error);
  });

  return dog;
}
