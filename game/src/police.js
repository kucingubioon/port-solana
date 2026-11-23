// Wanted system and police pursuit.
// Crimes raise stars (0-5). Police cars spawn at the station / city edge,
// chase the player, and fill the bust meter at close range. Staying unseen
// drains wanted; a full bust meter respawns the player at the station, fined.
import * as THREE from 'three';
import { Car } from './vehicles.js';
import { POLICE_STATION, CITY, collide } from './world.js';

export class PoliceSystem {
  constructor(scene, colliders) {
    this.scene = scene; this.colliders = colliders;
    this.wanted = 0;
    this.bust = 0;          // 0..1
    this.unseenT = 0;
    this.units = [];
    this.spawnT = 0;
    this.seenByPolice = false;
  }
  addCrime(points) {
    this.wanted = Math.min(5, this.wanted + points);
    this.unseenT = 0;
  }
  desiredUnits() { return this.wanted === 0 ? 0 : Math.min(2 + this.wanted, 6); }

  spawnUnit(targetPos) {
    const spots = [
      POLICE_STATION,
      new THREE.Vector3(-CITY, 0, targetPos.z), new THREE.Vector3(CITY, 0, targetPos.z),
      new THREE.Vector3(targetPos.x, 0, -CITY), new THREE.Vector3(targetPos.x, 0, CITY),
    ];
    const s = spots[Math.floor(Math.random() * spots.length)];
    const unit = new Car(this.scene, s.x + (Math.random() * 8 - 4), s.z + (Math.random() * 8 - 4), Math.random() * 6.28, 0xffffff, true);
    unit.cruise = 15 + this.wanted * 1.6;
    this.units.push(unit);
  }

  /** Returns 'busted' when the bust meter fills, else null. */
  update(dt, playerPos, playerSpeed) {
    this.spawnT -= dt;
    // Spawn / retire units to match wanted level.
    if (this.units.length < this.desiredUnits() && this.spawnT <= 0) { this.spawnUnit(playerPos); this.spawnT = 1.6; }
    while (this.units.length > this.desiredUnits()) {
      const u = this.units.pop(); this.scene.remove(u.mesh);
    }
    this.seenByPolice = false;
    let closeUnits = 0;
    for (const u of this.units) {
      const dx = playerPos.x - u.pos.x, dz = playerPos.z - u.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 42) this.seenByPolice = true;
      if (dist < 9) closeUnits++;
      // Steer toward the player, arcade style.
      const targetAngle = Math.atan2(dx, dz);
      let diff = targetAngle - u.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      u.angle += Math.max(-1.9 * dt, Math.min(1.9 * dt, diff));
      const want = dist > 4 ? u.cruise : 0;
      u.speed += Math.max(-24 * dt, Math.min(12 * dt, want - u.speed));
      u.pos.x += Math.sin(u.angle) * u.speed * dt;
      u.pos.z += Math.cos(u.angle) * u.speed * dt;
      const probe = { x: u.pos.x, z: u.pos.z };
      collide(this.colliders, probe, 1.6);
      u.pos.x = probe.x; u.pos.z = probe.z;
      u.syncMesh();
    }
    // Bust meter: fills when police are close and the player is slow.
    if (closeUnits > 0 && playerSpeed < 3.2) this.bust += dt * 0.34 * closeUnits;
    else this.bust = Math.max(0, this.bust - dt * 0.3);
    if (this.bust >= 1) { this.bust = 0; return 'busted'; }
    // Wanted decays while unseen.
    if (this.wanted > 0 && !this.seenByPolice) {
      this.unseenT += dt;
      if (this.unseenT > 7) { this.wanted -= 1; this.unseenT = 0; }
    } else this.unseenT = 0;
    return null;
  }

  clear() {
    this.wanted = 0; this.bust = 0; this.unseenT = 0;
    for (const u of this.units) this.scene.remove(u.mesh);
    this.units = [];
  }
}
