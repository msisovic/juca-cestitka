import * as THREE from "three";

export function createCheckerboard(size = 80, squareSize = 4) {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 2;

  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, 2, 2);
  context.fillStyle = "#d027ad";
  context.fillRect(0, 0, 1, 1);
  context.fillRect(1, 1, 1, 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  const repeats = size / (squareSize * 2);
  texture.repeat.set(repeats, repeats);

  const group = new THREE.Group();

  const top = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshLambertMaterial({ map: texture }),
  );
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.01;
  group.add(top);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(size, 1.25, size),
    new THREE.MeshLambertMaterial({ color: 0x8e0876 }),
  );
  base.position.y = -0.625;
  group.add(base);

  return group;
}
