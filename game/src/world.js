// Port Solana: city layout, buildings with lit windows, roads, sidewalks,
// street lights, palms and props. Warm sunset lighting over a 5x5 road grid.
import * as THREE from 'three';

export const PITCH = 52;            // distance between road centrelines
export const ROAD_W = 14;           // road width
export const GRID = 2;              // roads at -2..2 * PITCH
export const CITY = PITCH * 2 + 34; // playable half-extent
export const POLICE_STATION = new THREE.Vector3(-PITCH, 0, -PITCH * 2);
export const PIER = new THREE.Vector3(PITCH * 2, 0, PITCH * 2 + 18);

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function isOnRoad(x, z) {
  const near = (v) => { const m = ((v % PITCH) + PITCH) % PITCH; return m < ROAD_W / 2 || m > PITCH - ROAD_W / 2; };
  return near(x) || near(z);
}

function windowTexture(rand, base) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 120; y += 12) for (let x = 6; x < 56; x += 12) {
    g.fillStyle = rand() > 0.45 ? '#ffd98a' : '#2c3542';
    g.fillRect(x, y, 7, 8);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildWorld(scene, seed = 1) {
  const rand = mulberry(seed * 7919 + 13);
  const colliders = []; // {minX,maxX,minZ,maxZ}
  scene.background = new THREE.Color(0xf2a65e);
  scene.fog = new THREE.Fog(0xe8905a, 120, 340);
  scene.add(new THREE.HemisphereLight(0xffe0b3, 0x54402a, 0.95));
  const sun = new THREE.DirectionalLight(0xffc98a, 1.9);
  sun.position.set(-60, 80, -40); scene.add(sun);
  const fill = new THREE.DirectionalLight(0x88aaff, 0.35); fill.position.set(50, 40, 60); scene.add(fill);

  // Ground: warm sand-grass base, sea to the south-east corner.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshLambertMaterial({ color: 0x9aa063 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; scene.add(ground);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 90), new THREE.MeshLambertMaterial({ color: 0x2e7fa8 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(60, 0.02, CITY + 62); scene.add(sea);

  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3c3f45 });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0xcbb99a });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5e9c9 });
  for (let k = -GRID; k <= GRID; k++) {
    for (const horizontal of [false, true]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(horizontal ? 2 * CITY + 20 : ROAD_W, horizontal ? ROAD_W : 2 * CITY + 20), roadMat);
      road.rotation.x = -Math.PI / 2; road.position.y = 0.01;
      if (horizontal) road.position.z = k * PITCH; else road.position.x = k * PITCH;
      scene.add(road);
      for (let d = -CITY; d < CITY; d += 8) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(horizontal ? 3.4 : 0.35, horizontal ? 0.35 : 3.4), dashMat);
        dash.rotation.x = -Math.PI / 2; dash.position.y = 0.03;
        if (horizontal) { dash.position.x = d; dash.position.z = k * PITCH; } else { dash.position.x = k * PITCH; dash.position.z = d; }
        scene.add(dash);
      }
    }
  }

  // Buildings fill each block, set back behind sidewalks.
  const palettes = ['#b5654a', '#c98a5a', '#8a6f9e', '#5a8a9e', '#c2b280', '#a85a6e', '#6e9e7a', '#d9a05a'];
  const textures = palettes.map((p) => windowTexture(rand, p));
  for (let bx = -GRID; bx < GRID + 1; bx++) for (let bz = -GRID; bz < GRID + 1; bz++) {
    const cx = bx * PITCH - PITCH / 2, cz = bz * PITCH - PITCH / 2;
    if (cx < -CITY || cz < -CITY) continue;
    // sidewalk slab per block
    const slab = new THREE.Mesh(new THREE.BoxGeometry(PITCH - ROAD_W + 4, 0.24, PITCH - ROAD_W + 4), walkMat);
    slab.position.set(cx + (bx === GRID ? -6 : 0), 0.1, cz); if (slab.position.x < -CITY || slab.position.x > CITY) continue;
    scene.add(slab);
    const perBlock = 2;
    for (let i = 0; i < perBlock; i++) {
      const w = 13 + rand() * 5, d = 13 + rand() * 5, h = 14 + rand() * 30;
      const x = slab.position.x + (i === 0 ? -9 : 9) + (rand() * 2 - 1), z = cz + (rand() * 8 - 4);
      if (Math.abs(x - POLICE_STATION.x) < 12 && Math.abs(z - POLICE_STATION.z) < 12) continue;
      const tex = textures[Math.floor(rand() * textures.length)];
      const mat = new THREE.MeshLambertMaterial({ map: tex });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(x, h / 2, z); scene.add(b);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.7, d + 0.6), new THREE.MeshLambertMaterial({ color: 0x5a4632 }));
      roof.position.set(x, h + 0.3, z); scene.add(roof);
      colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    }
  }

  // Police station: pale block with a blue band and a sign board.
  const station = new THREE.Group();
  const sBody = new THREE.Mesh(new THREE.BoxGeometry(22, 10, 14), new THREE.MeshLambertMaterial({ color: 0xd8dde2 }));
  sBody.position.y = 5; station.add(sBody);
  const sBand = new THREE.Mesh(new THREE.BoxGeometry(22.3, 2, 14.3), new THREE.MeshLambertMaterial({ color: 0x2456c8 }));
  sBand.position.y = 8; station.add(sBand);
  station.position.copy(POLICE_STATION); scene.add(station);
  colliders.push({ minX: POLICE_STATION.x - 11, maxX: POLICE_STATION.x + 11, minZ: POLICE_STATION.z - 7, maxZ: POLICE_STATION.z + 7 });

  // Street lights, palms and crates as props.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x444a50 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe6a3 });
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8a4f });
  const crateMat = new THREE.MeshLambertMaterial({ color: 0xa8793e });
  for (let k = -GRID; k <= GRID; k++) for (let d = -2; d <= 2; d++) {
    for (const [lx, lz] of [[k * PITCH + 9, d * PITCH + 20], [k * PITCH - 9, d * PITCH - 20]]) {
      if (Math.abs(lx) > CITY || Math.abs(lz) > CITY) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 5.6), poleMat);
      pole.position.set(lx, 2.8, lz); scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 8), lampMat);
      lamp.position.set(lx, 5.7, lz); scene.add(lamp);
    }
    const px = k * PITCH + 26 + (rand() * 4 - 2), pz = d * PITCH + 12;
    if (Math.abs(px) < CITY && Math.abs(pz) < CITY && !isOnRoad(px, pz)) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 4.6), trunkMat);
      trunk.position.set(px, 2.3, pz); scene.add(trunk);
      for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.4, 5), leafMat);
        leaf.position.set(px + Math.cos(i * 1.26) * 1.1, 5, pz + Math.sin(i * 1.26) * 1.1);
        leaf.rotation.z = Math.cos(i * 1.26) * 1.1; leaf.rotation.x = -Math.sin(i * 1.26) * 1.1;
        scene.add(leaf);
      }
    }
    if (rand() > 0.4) {
      const cx = k * PITCH + 18, cz = d * PITCH + 26;
      if (!isOnRoad(cx, cz) && Math.abs(cx) < CITY && Math.abs(cz) < CITY) {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), crateMat);
        crate.position.set(cx, 0.7, cz); crate.rotation.y = rand(); scene.add(crate);
      }
    }
  }

  // Gold mission marker: a glowing pillar the player can see across town.
  const marker = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 26, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }),
  );
  marker.position.set(0, 13, 30); scene.add(marker);
  const markerRing = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.18, 8, 28), new THREE.MeshBasicMaterial({ color: 0xffd23e }));
  markerRing.rotation.x = Math.PI / 2; markerRing.position.y = 0.3; marker.add ? null : null;
  scene.add(markerRing);

  return { colliders, marker, markerRing };
}

/** Push a point (with radius) out of every building collider and the city edge. */
export function collide(colliders, pos, radius) {
  for (const c of colliders) {
    if (pos.x > c.minX - radius && pos.x < c.maxX + radius && pos.z > c.minZ - radius && pos.z < c.maxZ + radius) {
      const left = pos.x - (c.minX - radius), right = (c.maxX + radius) - pos.x;
      const top = pos.z - (c.minZ - radius), bottom = (c.maxZ + radius) - pos.z;
      const m = Math.min(left, right, top, bottom);
      if (m === left) pos.x = c.minX - radius; else if (m === right) pos.x = c.maxX + radius;
      else if (m === top) pos.z = c.minZ - radius; else pos.z = c.maxZ + radius;
    }
  }
  pos.x = Math.max(-CITY, Math.min(CITY + 20, pos.x));
  pos.z = Math.max(-CITY, Math.min(CITY + 26, pos.z));
}
