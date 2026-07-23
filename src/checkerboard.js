import * as THREE from "three";

function createCheckerTexture(width, depth, squareSize, lightColor, darkColor) {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 2;

  const context = canvas.getContext("2d");
  context.fillStyle = lightColor;
  context.fillRect(0, 0, 2, 2);
  context.fillStyle = darkColor;
  context.fillRect(0, 0, 1, 1);
  context.fillRect(1, 1, 1, 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(width / (squareSize * 2), depth / (squareSize * 2));
  return texture;
}

export function createCheckerboardPlatform({
  size,
  position,
  rotation = [0, 0, 0],
  squareSize,
  lightColor = "#ffffff",
  darkColor = "#d027ad",
  sideColor = 0x8e0876,
}) {
  const [width, height, depth] = size;
  const texture = createCheckerTexture(
    width,
    depth,
    squareSize,
    lightColor,
    darkColor,
  );
  const topMaterial = new THREE.MeshLambertMaterial({ map: texture });
  const sideMaterial = new THREE.MeshLambertMaterial({ color: sideColor });
  const materials = [
    sideMaterial,
    sideMaterial,
    topMaterial,
    sideMaterial,
    sideMaterial,
    sideMaterial,
  ];

  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    materials,
  );
  platform.position.set(...position);
  platform.rotation.set(...rotation);
  return platform;
}

export function createCheckerboard(size = 80, squareSize = 4) {
  const group = new THREE.Group();
  group.add(createCheckerboardPlatform({
    size: [size, 1.25, size],
    position: [0, -0.625, 0],
    squareSize,
  }));
  return group;
}
