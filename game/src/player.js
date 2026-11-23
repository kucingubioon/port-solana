// Rio Valdez, the player character on foot: walk / run with a follow camera
// heading, punch and pistol combat, health and pedestrian reactions.
import * as THREE from 'three';
import { collide } from './world.js';
import { makePedMesh } from './traffic.js';

export class Player {
  constructor(scene) {
    this.mesh = makePedMesh(0xe8641e); // orange shirt: Rio
    // A cap so Rio reads differently from pedestrians.
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.25, 0.12, 10), new THREE.MeshLambertMaterial({ color: 0x20304a }));
    cap.position.y = 1.86; this.mesh.add(cap);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.42), new THREE.MeshLambertMaterial({ color: 0x191c20 }));
    gun.position.set(0.36, 1.15, 0.25); gun.visible = false; this.mesh.add(gun);
    this.gunMesh = gun;
    scene.add(this.mesh);
    this.pos = this.mesh.position;
    this.pos.set(0, 0, 8);
    this.angle = Math.PI; // facing the camera start
    this.health = 100;
    this.walkPhase = 0;
    this.punchT = 0;
  }
  /** Move on foot. move {x,z} is camera-relative input; returns speed. */
  update(dt, move, running, colliders) {
    const len = Math.hypot(move.x, move.z);
    let speed = 0;
    if (len > 0.05) {
      const nx = move.x / len, nz = move.z / len;
      this.angle = Math.atan2(nx, nz);
      speed = running ? 9.2 : 5.2;
      this.pos.x += nx * speed * dt;
      this.pos.z += nz * speed * dt;
      const probe = { x: this.pos.x, z: this.pos.z };
      collide(colliders, probe, 0.55);
      this.pos.x = probe.x; this.pos.z = probe.z;
      this.walkPhase += dt * (running ? 13 : 9);
    }
    this.mesh.rotation.y = this.angle;
    const swing = Math.sin(this.walkPhase) * (len > 0.05 ? 0.55 : 0);
    this.mesh.userData.legs[0].rotation.x = swing;
    this.mesh.userData.legs[1].rotation.x = -swing;
    if (this.punchT > 0) {
      this.punchT -= dt;
      this.mesh.rotation.x = -Math.sin(Math.max(0, this.punchT) * 14) * 0.18;
    } else this.mesh.rotation.x = 0;
    this.gunMesh.visible = this.aiming;
    return speed;
  }
  punch() { this.punchT = 0.28; }
  hurt(amount) { this.health = Math.max(0, this.health - amount); }
  heal(amount) { this.health = Math.min(100, this.health + amount); }
}
