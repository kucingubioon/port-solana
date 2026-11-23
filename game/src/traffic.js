// Traffic AI: cars loop the road grid on right-hand lanes, brake for the
// car ahead and pause at some intersections; pedestrians walk sidewalks.
import * as THREE from 'three';
import { Car } from './vehicles.js';
import { PITCH, GRID, CITY, mulberry } from './world.js';

const LANE = 3.4;

export class TrafficCar extends Car {
  constructor(scene, rand) {
    const horizontal = rand() > 0.5;
    const line = (Math.floor(rand() * (GRID * 2 + 1)) - GRID) * PITCH;
    const dir = rand() > 0.5 ? 1 : -1;
    const along = (rand() * 2 - 1) * CITY * 0.9;
    // Right-hand traffic: lane offset depends on direction of travel.
    const x = horizontal ? along : line + dir * LANE;
    const z = horizontal ? line - dir * LANE : along;
    const angle = horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    super(scene, x, z, angle, [0x9e4fd9, 0x30a8c8, 0xe0e4e8, 0xc23b2e, 0x3fae62][Math.floor(rand() * 5)]);
    this.horizontal = horizontal; this.dir = dir; this.line = line;
    this.cruise = 8 + rand() * 5;
    this.pauseT = 0;
    this.rand = rand;
  }
  update(dt, others, playerPos) {
    // Brake for anything ahead in our lane.
    let blocked = false;
    const fx = Math.sin(this.angle), fz = Math.cos(this.angle);
    for (const o of others) {
      if (o === this) continue;
      const dx = o.pos.x - this.pos.x, dz = o.pos.z - this.pos.z;
      const ahead = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && ahead < 8 && side < 2.4) { blocked = true; break; }
    }
    if (playerPos) {
      const dx = playerPos.x - this.pos.x, dz = playerPos.z - this.pos.z;
      const ahead = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && ahead < 7 && side < 2.4) blocked = true;
    }
    // Occasionally pause at intersections.
    const nearCross = Math.abs(((this.horizontal ? this.pos.x : this.pos.z) % PITCH + PITCH) % PITCH) < 3;
    if (nearCross && this.pauseT <= 0 && this.rand() > 0.996) this.pauseT = 0.8 + this.rand();
    if (this.pauseT > 0) this.pauseT -= dt;
    const target = (blocked || this.pauseT > 0) ? 0 : this.cruise;
    this.speed += Math.max(-22 * dt, Math.min(10 * dt, target - this.speed));
    this.pos.x += fx * this.speed * dt;
    this.pos.z += fz * this.speed * dt;
    // Wrap around the city edge and keep the lane.
    if (this.horizontal) {
      if (this.pos.x > CITY + 16) this.pos.x = -CITY - 16;
      if (this.pos.x < -CITY - 16) this.pos.x = CITY + 16;
      this.pos.z = this.line - this.dir * LANE;
    } else {
      if (this.pos.z > CITY + 16) this.pos.z = -CITY - 16;
      if (this.pos.z < -CITY - 16) this.pos.z = CITY + 16;
      this.pos.x = this.line + this.dir * LANE;
    }
    this.syncMesh();
  }
}

export function spawnTraffic(scene, seed = 1, count = 9) {
  const rand = mulberry(seed * 977 + 31);
  const cars = [];
  for (let i = 0; i < count; i++) cars.push(new TrafficCar(scene, rand));
  return cars;
}

// ---- Pedestrians ----
const PED_COLORS = [0xffd23e, 0x4fc3f7, 0xff8a65, 0xa5d6a7, 0xf48fb1, 0xfff59d];

export function makePedMesh(color) {
  const g = new THREE.Group();
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.3), new THREE.MeshLambertMaterial({ color }));
  shirt.position.y = 1.05; g.add(shirt);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 10), new THREE.MeshLambertMaterial({ color: 0xe8b98d }));
  head.position.y = 1.68; g.add(head);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x2c3242 });
  const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.22), legMat); l1.position.set(-0.14, 0.33, 0); g.add(l1);
  const l2 = l1.clone(); l2.position.x = 0.14; g.add(l2);
  g.userData.legs = [l1, l2];
  return g;
}

export class Pedestrian {
  constructor(scene, rand) {
    this.mesh = makePedMesh(PED_COLORS[Math.floor(rand() * PED_COLORS.length)]);
    // Walk a sidewalk rectangle around one block.
    this.cx = (Math.floor(rand() * 5) - 2) * PITCH - PITCH / 2;
    this.cz = (Math.floor(rand() * 5) - 2) * PITCH - PITCH / 2;
    this.half = 17;
    this.t = rand();
    this.speed = 0.012 + rand() * 0.012;
    this.fleeT = 0; this.fleeFrom = new THREE.Vector3();
    this.knocked = 0;
    scene.add(this.mesh);
    this.pos = this.mesh.position;
    this.place();
  }
  place() {
    const p = (this.t % 1) * 4, h = this.half;
    let x, z, a;
    if (p < 1) { x = -h + p * 2 * h; z = -h; a = Math.PI / 2; }
    else if (p < 2) { x = h; z = -h + (p - 1) * 2 * h; a = 0; }
    else if (p < 3) { x = h - (p - 2) * 2 * h; z = h; a = -Math.PI / 2; }
    else { x = -h; z = h - (p - 3) * 2 * h; a = Math.PI; }
    this.pos.set(this.cx + x, 0, this.cz + z);
    this.mesh.rotation.y = a;
  }
  scare(from) { this.fleeT = 2.2; this.fleeFrom.copy(from); }
  update(dt, dangerPos, dangerRadius) {
    if (this.knocked > 0) { this.knocked -= dt; this.mesh.rotation.z = Math.PI / 2.4; return; }
    this.mesh.rotation.z = 0;
    if (dangerPos && this.pos.distanceTo(dangerPos) < dangerRadius) this.scare(dangerPos);
    if (this.fleeT > 0) {
      this.fleeT -= dt;
      const dx = this.pos.x - this.fleeFrom.x, dz = this.pos.z - this.fleeFrom.z;
      const len = Math.hypot(dx, dz) || 1;
      this.pos.x += (dx / len) * 6.4 * dt; this.pos.z += (dz / len) * 6.4 * dt;
      this.mesh.rotation.y = Math.atan2(dx, dz);
    } else {
      this.t += this.speed * dt * 3.2;
      this.place();
    }
    const swing = Math.sin(performance.now() * 0.012) * 0.4;
    this.mesh.userData.legs[0].rotation.x = swing;
    this.mesh.userData.legs[1].rotation.x = -swing;
  }
}

export function spawnPedestrians(scene, seed = 1, count = 16) {
  const rand = mulberry(seed * 613 + 3);
  const peds = [];
  for (let i = 0; i < count; i++) peds.push(new Pedestrian(scene, rand));
  return peds;
}
