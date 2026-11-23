// Vehicles: mesh factory, parked cars, and arcade driving physics
// (accelerate / brake / reverse / steer, handbrake, building collision).
import * as THREE from 'three';
import { PITCH, ROAD_W, GRID, collide, mulberry } from './world.js';

const CAR_COLORS = [0xd94f30, 0x2e7fd9, 0xf2c230, 0x39b56a, 0xe8e8e8, 0x8a5fc0, 0x30343c, 0xff7d9c];

export function makeCarMesh(color, isPolice = false) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: isPolice ? 0xf0f2f5 : color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.62, 4.3), paint);
  body.position.y = 0.55; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), new THREE.MeshLambertMaterial({ color: isPolice ? 0x22262e : 0x1d2733 }));
  cabin.position.set(0, 1.1, -0.2); g.add(cabin);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.36, wz); g.add(w); wheels.push(w);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const s of [-0.6, 0.6]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.08), lightMat);
    hl.position.set(s, 0.62, 2.16); g.add(hl);
  }
  if (isPolice) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.3, 4.34), new THREE.MeshLambertMaterial({ color: 0x2456c8 }));
    stripe.position.y = 0.6; g.add(stripe);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.2, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff4040 }));
    bar.position.set(0, 1.48, -0.2); g.add(bar); g.userData.lightBar = bar;
  }
  g.userData.wheels = wheels;
  return g;
}

export class Car {
  constructor(scene, x, z, angle, color, isPolice = false) {
    this.mesh = makeCarMesh(color, isPolice);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = angle;
    scene.add(this.mesh);
    this.pos = this.mesh.position;
    this.angle = angle;
    this.speed = 0;
    this.isPolice = isPolice;
    this.occupied = false;
    this.damage = 0;
    this.honked = 0;
  }
  syncMesh() {
    this.mesh.position.x = this.pos.x; this.mesh.position.z = this.pos.z;
    this.mesh.rotation.y = this.angle;
    const spin = this.speed * 0.12;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
    if (this.mesh.userData.lightBar) {
      this.mesh.userData.lightBar.material.color.setHex(Math.floor(performance.now() / 280) % 2 ? 0xff4040 : 0x4080ff);
    }
  }
}

/** Parked cars along road edges plus a few on the pier. */
export function spawnParkedCars(scene, seed = 1) {
  const rand = mulberry(seed * 331 + 7);
  const cars = [];
  for (let k = -GRID; k <= GRID; k++) {
    for (let i = 0; i < 4; i++) {
      const along = (rand() * 2 - 1) * (PITCH * GRID - 8);
      const side = rand() > 0.5 ? 1 : -1;
      const vertical = rand() > 0.5;
      const x = vertical ? k * PITCH + side * (ROAD_W / 2 - 1.4) : along;
      const z = vertical ? along : k * PITCH + side * (ROAD_W / 2 - 1.4);
      const angle = vertical ? (side > 0 ? Math.PI : 0) : (side > 0 ? Math.PI / 2 : -Math.PI / 2);
      cars.push(new Car(scene, x, z, angle, CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)]));
    }
  }
  return cars;
}

/**
 * Arcade drive step for the player-driven car.
 * input: {throttle -1..1, steer -1..1, handbrake}
 * Returns speed in km/h. Hits against buildings use world colliders.
 */
export function driveCar(car, dt, input, colliders, onHit) {
  const accel = input.throttle > 0 ? 15 : input.throttle < 0 ? (car.speed > 0.5 ? -26 : -9) : 0;
  car.speed += accel * dt;
  const drag = input.handbrake ? 3.2 : 0.55;
  car.speed -= car.speed * drag * dt;
  if (!input.throttle) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 4 * dt);
  car.speed = Math.max(-11, Math.min(30, car.speed));
  if (Math.abs(car.speed) > 0.2) {
    const steerPower = input.steer * (input.handbrake ? 1.25 : 0.85);
    car.angle -= steerPower * dt * (car.speed > 0 ? 1 : -1) * Math.min(1, Math.abs(car.speed) / 7 + 0.25);
  }
  car.pos.x += Math.sin(car.angle) * car.speed * dt;
  car.pos.z += Math.cos(car.angle) * car.speed * dt;
  const probe = { x: car.pos.x, z: car.pos.z };
  collide(colliders, probe, 1.7);
  if (Math.abs(probe.x - car.pos.x) > 0.01 || Math.abs(probe.z - car.pos.z) > 0.01) {
    if (Math.abs(car.speed) > 6 && onHit) onHit(Math.abs(car.speed));
    car.pos.x = probe.x; car.pos.z = probe.z;
    car.speed *= -0.25; car.damage += 1;
  }
  car.syncMesh();
  return Math.abs(car.speed) * 3.6;
}
