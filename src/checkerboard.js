import * as THREE from "three";

function createCheckerTexture(
  width,
  depth,
  position,
  squareSize,
  lightColor,
  darkColor,
) {
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
  const [centerX, , centerZ] = position;
  const period = squareSize * 2;
  const minX = centerX - width / 2;
  const maxZ = centerZ + depth / 2;
  texture.offset.set(
    THREE.MathUtils.euclideanModulo(minX / period, 1),
    THREE.MathUtils.euclideanModulo(-maxZ / period, 1),
  );
  return texture;
}

export function getRampVertices(width, height, depth, rise) {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const topNear = height / 2 - rise / 2;
  const topFar = height / 2 + rise / 2;
  const bottomNear = -height / 2 - rise / 2;
  const bottomFar = -height / 2 + rise / 2;

  return [
    [-halfWidth, topNear, halfDepth],
    [halfWidth, topNear, halfDepth],
    [halfWidth, topFar, -halfDepth],
    [-halfWidth, topFar, -halfDepth],
    [-halfWidth, bottomNear, halfDepth],
    [halfWidth, bottomNear, halfDepth],
    [halfWidth, bottomFar, -halfDepth],
    [-halfWidth, bottomFar, -halfDepth],
  ];
}

function createPlatformMaterials(
  width,
  depth,
  position,
  squareSize,
  lightColor,
  darkColor,
  sideColor,
) {
  const texture = createCheckerTexture(
    width,
    depth,
    position,
    squareSize,
    lightColor,
    darkColor,
  );
  return {
    top: new THREE.MeshLambertMaterial({ map: texture }),
    side: new THREE.MeshLambertMaterial({ color: sideColor }),
  };
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
  const materials = createPlatformMaterials(
    width,
    depth,
    position,
    squareSize,
    lightColor,
    darkColor,
    sideColor,
  );
  const boxMaterials = [
    materials.side,
    materials.side,
    materials.top,
    materials.side,
    materials.side,
    materials.side,
  ];

  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    boxMaterials,
  );
  platform.position.set(...position);
  platform.rotation.set(...rotation);
  return platform;
}

export function createCheckerboardRamp({
  size,
  position,
  rise,
  squareSize,
  lightColor = "#ffffff",
  darkColor = "#d027ad",
  sideColor = 0x8e0876,
}) {
  const [width, height, depth] = size;
  const corners = getRampVertices(width, height, depth, rise);
  const positions = [];
  const uvs = [];
  const indices = [];
  const geometry = new THREE.BufferGeometry();

  function addFace(cornerIndices, materialIndex, faceUvs) {
    const startVertex = positions.length / 3;
    const startIndex = indices.length;
    for (let index = 0; index < 4; index += 1) {
      positions.push(...corners[cornerIndices[index]]);
      uvs.push(...faceUvs[index]);
    }
    indices.push(
      startVertex,
      startVertex + 1,
      startVertex + 2,
      startVertex,
      startVertex + 2,
      startVertex + 3,
    );
    geometry.addGroup(startIndex, 6, materialIndex);
  }

  const standardUvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
  addFace([0, 1, 2, 3], 1, standardUvs);
  addFace([4, 7, 6, 5], 0, standardUvs);
  addFace([4, 5, 1, 0], 0, standardUvs);
  addFace([7, 3, 2, 6], 0, standardUvs);
  addFace([4, 0, 3, 7], 0, standardUvs);
  addFace([5, 6, 2, 1], 0, standardUvs);

  geometry.setIndex(indices);
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();

  const materials = createPlatformMaterials(
    width,
    depth,
    position,
    squareSize,
    lightColor,
    darkColor,
    sideColor,
  );
  const ramp = new THREE.Mesh(geometry, [materials.side, materials.top]);
  ramp.position.set(...position);
  return ramp;
}

export function getQuarterTurnSegmentVertices(
  innerRadius,
  outerRadius,
  height,
  startAngle,
  endAngle,
  startDrop = 0,
  endDrop = 0,
) {
  const startTop = height / 2 - startDrop;
  const endTop = height / 2 - endDrop;
  const point = (radius, angle, y) => [
    Math.cos(angle) * radius,
    y,
    Math.sin(angle) * radius,
  ];

  return [
    point(innerRadius, startAngle, startTop),
    point(innerRadius, endAngle, endTop),
    point(outerRadius, endAngle, endTop),
    point(outerRadius, startAngle, startTop),
    point(innerRadius, startAngle, startTop - height),
    point(innerRadius, endAngle, endTop - height),
    point(outerRadius, endAngle, endTop - height),
    point(outerRadius, startAngle, startTop - height),
  ];
}

export function createCheckerboardCurvedTrack({
  position,
  height,
  innerRadius,
  width,
  startAngle,
  sweepAngle = Math.PI / 2,
  drop = 0,
  segments = 12,
  capStart = true,
  capEnd = true,
  squareSize,
  lightColor = "#ffffff",
  darkColor = "#d027ad",
  sideColor = 0x8e0876,
}) {
  const outerRadius = innerRadius + width;
  const angleStep = sweepAngle / segments;
  const segmentCorners = [];
  const boundsPoints = [];

  for (let index = 0; index < segments; index += 1) {
    const angle = startAngle + index * angleStep;
    const nextAngle = angle + angleStep;
    const startDrop = drop * index / segments;
    const endDrop = drop * (index + 1) / segments;
    segmentCorners.push(getQuarterTurnSegmentVertices(
      innerRadius,
      outerRadius,
      height,
      angle,
      nextAngle,
      startDrop,
      endDrop,
    ));
    for (const radius of [innerRadius, outerRadius]) {
      boundsPoints.push([
        position[0] + Math.cos(angle) * radius,
        position[2] + Math.sin(angle) * radius,
      ]);
      if (index === segments - 1) {
        boundsPoints.push([
          position[0] + Math.cos(nextAngle) * radius,
          position[2] + Math.sin(nextAngle) * radius,
        ]);
      }
    }
  }

  const worldXs = boundsPoints.map(([x]) => x);
  const worldZs = boundsPoints.map(([, z]) => z);
  const minX = Math.min(...worldXs);
  const maxX = Math.max(...worldXs);
  const minZ = Math.min(...worldZs);
  const maxZ = Math.max(...worldZs);
  const texturePosition = [(minX + maxX) / 2, position[1], (minZ + maxZ) / 2];
  const materials = createPlatformMaterials(
    maxX - minX,
    maxZ - minZ,
    texturePosition,
    squareSize,
    lightColor,
    darkColor,
    sideColor,
  );

  const positions = [];
  const uvs = [];
  const indices = [];
  const geometry = new THREE.BufferGeometry();

  function topUv(vertex) {
    const worldX = position[0] + vertex[0];
    const worldZ = position[2] + vertex[2];
    return [
      (worldX - minX) / (maxX - minX),
      (maxZ - worldZ) / (maxZ - minZ),
    ];
  }

  function addFace(vertices, materialIndex, faceUvs) {
    const startVertex = positions.length / 3;
    const startIndex = indices.length;
    for (let index = 0; index < 4; index += 1) {
      positions.push(...vertices[index]);
      uvs.push(...faceUvs[index]);
    }
    indices.push(
      startVertex,
      startVertex + 1,
      startVertex + 2,
      startVertex,
      startVertex + 2,
      startVertex + 3,
    );
    geometry.addGroup(startIndex, 6, materialIndex);
  }

  const standardUvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
  segmentCorners.forEach((corners) => {
    const topFace = [corners[0], corners[1], corners[2], corners[3]];
    const faces = [
      [topFace, 1, topFace.map(topUv)],
      [[corners[4], corners[7], corners[6], corners[5]], 0, standardUvs],
      [[corners[4], corners[5], corners[1], corners[0]], 0, standardUvs],
      [[corners[7], corners[3], corners[2], corners[6]], 0, standardUvs],
    ];
    for (const [vertices, materialIndex, faceUvs] of faces) {
      addFace(
        sweepAngle > 0 ? vertices : [...vertices].reverse(),
        materialIndex,
        sweepAngle > 0 ? faceUvs : [...faceUvs].reverse(),
      );
    }
  });
  const first = segmentCorners[0];
  const last = segmentCorners.at(-1);
  if (capStart) {
    const vertices = [first[4], first[0], first[3], first[7]];
    addFace(
      sweepAngle > 0 ? vertices : [...vertices].reverse(),
      0,
      sweepAngle > 0 ? standardUvs : [...standardUvs].reverse(),
    );
  }
  if (capEnd) {
    const vertices = [last[5], last[6], last[2], last[1]];
    addFace(
      sweepAngle > 0 ? vertices : [...vertices].reverse(),
      0,
      sweepAngle > 0 ? standardUvs : [...standardUvs].reverse(),
    );
  }

  geometry.setIndex(indices);
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();

  const turn = new THREE.Mesh(geometry, [materials.side, materials.top]);
  turn.position.set(...position);
  return turn;
}

export function createCheckerboardQuarterTurn(options) {
  return createCheckerboardCurvedTrack(options);
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
