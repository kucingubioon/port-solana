// Port Solana — main entry: renderer, game loop, camera, car entry, combat,
// crime, busted / respawn, mission flow, pause, save, and screenshot scenes.
import * as THREE from 'three';
import { buildWorld, POLICE_STATION, PIER, CITY } from './world.js';
import { Player } from './player.js';
import { spawnParkedCars, driveCar } from './vehicles.js';
import { spawnTraffic, spawnPedestrians } from './traffic.js';
import { PoliceSystem } from './police.js';
import { MissionManager, MISSIONS } from './missions.js';
import { Hud } from './hud.js';
import { initInput, keys, mouse, justPressed, endFrameInput, moveAxis } from './input.js';
import { initAudio, toggleMute, playPickup, playMissionDone, playMissionStart, playShot, playPunch, playBusted, setEngine, setSiren } from './audio.js';
import { loadSave, storeSave, clearSave } from './save.js';

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const seed = Number(params.get('seed')) || 1;

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 600);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
initInput(canvas);

const world = buildWorld(scene, seed);
const player = new Player(scene);
const parked = spawnParkedCars(scene, seed);
const traffic = spawnTraffic(scene, seed);
const peds = spawnPedestrians(scene, seed);
const police = new PoliceSystem(scene, world.colliders);
const missions = new MissionManager();
const hud = new Hud();

const state = {
  mode: 'title', // title | dialog | playing | paused | banner
  cash: 0, inCar: null, speedKmh: 0, camYaw: Math.PI,
  escapedOnce: false, saveT: 0, bannerNext: null, shotMode: Boolean(shot),
};
let lastMouseX = null;

const $ = (id) => document.getElementById(id);
const titleScreen = $('titleScreen'), pauseScreen = $('pauseScreen'), bannerScreen = $('bannerScreen');

function playerPos() { return state.inCar ? state.inCar.pos : player.pos; }
function playerSpeed() { return state.inCar ? Math.abs(state.inCar.speed) : lastFootSpeed; }
let lastFootSpeed = 0;

function crime(points, reason) {
  if (points <= 0) return;
  police.addCrime(points);
}

function startGame(fromSave) {
  const save = fromSave ? loadSave() : null;
  if (!fromSave) clearSave();
  state.cash = save ? save.cash : 0;
  missions.index = save ? Math.min(save.missionIndex, MISSIONS.length) : 0;
  missions.phase = missions.storyDone ? 'storyDone' : 'dialog';
  missions.dialogIdx = 0; missions.checkpointIdx = 0;
  player.health = save ? save.health : 100;
  if (save) player.pos.set(save.x, 0, save.z);
  titleScreen.classList.add('hidden');
  hud.show();
  initAudio();
  if (missions.storyDone) { state.mode = 'playing'; }
  else { state.mode = 'dialog'; showDialogLine(); playMissionStart(); }
  persist();
}

function showDialogLine() {
  const m = missions.current;
  if (!m) { state.mode = 'playing'; hud.hideDialog(); return; }
  const line = m.dialog[missions.dialogIdx];
  hud.showDialog(line[0], line[1]);
  $('objective') && null;
}
function advanceDialog() {
  const m = missions.current;
  if (!m) return;
  missions.dialogIdx++;
  if (missions.dialogIdx >= m.dialog.length) {
    hud.hideDialog();
    missions.phase = 'active';
    state.mode = 'playing';
    if (m.kind === 'escape') { police.wanted = 3; state.escapedOnce = true; }
    if (m.kind === 'pickup') playPickup();
  } else showDialogLine();
}

function completeMission(m) {
  state.cash += m.reward;
  playMissionDone();
  persist();
  state.mode = 'banner';
  $('bannerTitle').textContent = m.kind === 'finale' ? 'STORY COMPLETE' : 'MISSION COMPLETE';
  $('bannerText').textContent = `${m.title} — +$${m.reward}. ${m.done}`;
  titleScreen.classList.add('hidden');
  bannerScreen.classList.remove('hidden');
}
function bannerContinue() {
  bannerScreen.classList.add('hidden');
  missions.advance();
  persist();
  if (missions.storyDone) { state.mode = 'playing'; }
  else { state.mode = 'dialog'; missions.dialogIdx = 0; showDialogLine(); playMissionStart(); }
}

function busted() {
  playBusted();
  const fine = Math.min(state.cash, 100 + police.wanted * 40);
  state.cash -= fine;
  police.clear();
  exitCar(true);
  player.pos.set(POLICE_STATION.x + 6, 0, POLICE_STATION.z + 12);
  player.health = Math.max(player.health, 60);
  state.mode = 'banner';
  $('bannerTitle').textContent = 'BUSTED';
  $('bannerText').textContent = `The Solana PD caught up with Rio. Fine paid: $${fine}. Released outside the station — the duffel debt still stands.`;
  bannerScreen.classList.remove('hidden');
  state.bannerNext = 'busted';
  persist();
}
function wasted() {
  const fine = Math.min(state.cash, 80);
  state.cash -= fine;
  police.clear(); exitCar(true);
  player.pos.set(POLICE_STATION.x + 6, 0, POLICE_STATION.z + 12);
  player.health = 70;
  state.mode = 'banner';
  $('bannerTitle').textContent = 'WASTED';
  $('bannerText').textContent = `Rio wakes up outside the Solana clinic with a $${fine} bill and a headache shaped like a siren.`;
  bannerScreen.classList.remove('hidden');
  state.bannerNext = 'busted';
}

function nearestCar(maxDist) {
  let best = null, bestD = maxDist;
  for (const c of [...parked, ...traffic, ...police.units]) {
    const d = c.pos.distanceTo(player.pos);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}
function enterCar(car) {
  state.inCar = car; car.occupied = true;
  player.mesh.visible = false;
  const ti = traffic.indexOf(car);
  if (ti >= 0) { traffic.splice(ti, 1); crime(1); }       // stealing a moving car
  else if (!car.isPolice && !car.stolen) { car.stolen = true; crime(1); } // stealing a parked car
  else if (car.isPolice) crime(2);
  for (const p of peds) if (p.pos.distanceTo(car.pos) < 8) p.scare(car.pos);
}
function exitCar(silent = false) {
  if (!state.inCar) return;
  const car = state.inCar;
  car.occupied = false; car.speed = 0;
  if (!parked.includes(car) && !traffic.includes(car) && !car.isPolice) parked.push(car);
  state.inCar = null;
  player.mesh.visible = true;
  player.pos.set(car.pos.x + Math.cos(car.angle) * 2.2, 0, car.pos.z - Math.sin(car.angle) * 2.2);
  if (!silent) setEngine(0);
}

function combat(dt) {
  player.aiming = mouse.down && !state.inCar;
  if (justPressed('KeyF') && !state.inCar) {
    player.punch(); playPunch();
    for (const p of peds) {
      if (p.pos.distanceTo(player.pos) < 1.9) { p.knocked = 2.5; p.scare(player.pos); crime(1); }
    }
    const car = nearestCar(2.6);
    if (car) { car.damage += 1; crime(1); }
  }
  if (mouse.clicked && !state.inCar && state.mode === 'playing') {
    playShot();
    const fx = Math.sin(state.camYaw), fz = Math.cos(state.camYaw);
    player.angle = state.camYaw;
    let hit = false;
    for (const p of peds) {
      const dx = p.pos.x - player.pos.x, dz = p.pos.z - player.pos.z;
      const ahead = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && ahead < 16 && side < 1.1) { p.knocked = 3; p.scare(player.pos); hit = true; }
    }
    const car = nearestCar(14);
    if (car && !hit) {
      const dx = car.pos.x - player.pos.x, dz = car.pos.z - player.pos.z;
      if (dx * fx + dz * fz > 0 && Math.abs(dx * fz - dz * fx) < 2) { car.damage += 2; hit = true; }
    }
    crime(2); // shots fired in public: witnesses call it in
    for (const p of peds) if (p.pos.distanceTo(player.pos) < 11) p.scare(player.pos);
    mouse.clicked = false;
  }
}

// ---- Screenshot scenes: deterministic staging over the real game state ----
function stageShot(name) {
  hud.show();
  titleScreen.classList.add('hidden');
  missions.phase = 'active'; missions.index = 0;
  state.cash = 2450; player.health = 88;
  if (name === 'play') {
    state.mode = 'playing';
    player.pos.set(6, 0, 20); state.camYaw = Math.PI * 0.92;
    const car = parked[0]; car.pos.set(3.2, 0, 13); car.angle = 0.2; car.syncMesh();
  } else if (name === 'chase') {
    state.mode = 'playing';
    missions.index = 2;
    const car = parked[1];
    car.pos.set(0, 0, -10); car.angle = 0; car.speed = 11; enterCar(car);
    police.wanted = 4; police.bust = 0.35;
    const spots = [[-3.4, -17], [3.4, -19.5], [0, -24]];
    for (let i = 0; i < 3; i++) {
      police.spawnUnit(car.pos);
      const u = police.units[police.units.length - 1];
      u.pos.set(spots[i][0], 0, spots[i][1]); u.angle = 0; u.speed = 13; u.syncMesh();
    }
    state.camYaw = 0;
  } else if (name === 'end') {
    state.mode = 'banner';
    missions.index = 5;
    player.pos.set(PIER.x - 4, 0, PIER.z - 6);
    const car = parked[2]; car.pos.set(PIER.x, 0, PIER.z - 2); car.angle = 0.4; car.syncMesh();
    state.cash = 5350;
    $('bannerTitle').textContent = 'MISSION COMPLETE';
    $('bannerText').textContent = `Low Tide, Full Speed — +$1,200. ${MISSIONS[5].done}`;
    bannerScreen.classList.remove('hidden');
  } else {
    state.mode = 'title';
    titleScreen.classList.remove('hidden');
    hud.root.classList.add('hidden');
    player.pos.set(8, 0, 26); state.camYaw = Math.PI * 0.85;
  }
  // Let traffic / peds settle into natural poses.
  for (let i = 0; i < 40; i++) {
    for (const t of traffic) t.update(1 / 30, traffic, null);
    for (const p of peds) p.update(1 / 30, null, 0);
  }
}

$('btnNew').addEventListener('click', () => startGame(false));
$('btnContinue').addEventListener('click', () => startGame(true));
$('btnResume').addEventListener('click', () => { pauseScreen.classList.add('hidden'); state.mode = 'playing'; });
$('btnRestart').addEventListener('click', () => { pauseScreen.classList.add('hidden'); clearSave(); location.reload(); });
$('btnBanner').addEventListener('click', () => {
  if (state.bannerNext === 'busted') { bannerScreen.classList.add('hidden'); state.bannerNext = null; state.mode = missions.phase === 'dialog' ? 'dialog' : 'playing'; if (state.mode === 'dialog') showDialogLine(); }
  else bannerContinue();
});
hud.dialog.addEventListener('click', () => { if (state.mode === 'dialog') advanceDialog(); });

function persist() {
  storeSave({ cash: state.cash, missionIndex: missions.index, storyDone: missions.storyDone, playerPos: playerPos(), health: player.health });
}

if (shot) stageShot(shot);

// ---- Main loop ----
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (lastMouseX !== null && state.mode === 'playing' && !state.inCar) {
    state.camYaw -= (mouse.x - lastMouseX) * 0.004;
  }
  lastMouseX = mouse.x;

  const frozen = state.mode === 'title' || state.mode === 'paused' || state.mode === 'banner' || state.mode === 'dialog';
  if (!frozen) {
    // Dialog advance / pause keys
    if (state.inCar) {
      const input = {
        throttle: (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0),
        steer: (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0),
        handbrake: Boolean(keys.Space),
      };
      state.speedKmh = driveCar(state.inCar, dt, input, world.colliders, (impact) => {
        crime(impact > 14 ? 2 : 1);
        player.hurt(impact * 0.35);
        for (const p of peds) if (p.pos.distanceTo(state.inCar.pos) < 9) p.scare(state.inCar.pos);
      });
      setEngine(Math.abs(state.inCar.speed) / 30);
      state.camYaw = state.inCar.angle + Math.PI;
      // Running over a pedestrian is a serious crime.
      for (const p of peds) {
        if (p.knocked <= 0 && Math.abs(state.inCar.speed) > 3 && p.pos.distanceTo(state.inCar.pos) < 1.8) {
          p.knocked = 3; crime(2); player.hurt(1);
        }
      }
      // Bumping other cars
      for (const c of [...parked, ...traffic]) {
        if (c !== state.inCar && c.pos.distanceTo(state.inCar.pos) < 3.1 && Math.abs(state.inCar.speed) > 4) {
          state.inCar.speed *= 0.45; c.damage += 1; crime(1);
        }
      }
    } else {
      const axis = moveAxis();
      const move = {
        x: axis.x * Math.cos(state.camYaw) - axis.z * Math.sin(state.camYaw) * -1,
        z: axis.z * Math.cos(state.camYaw) + axis.x * Math.sin(state.camYaw),
      };
      // Camera-relative: forward on screen is away from the camera.
      const fx = Math.sin(state.camYaw), fz = Math.cos(state.camYaw);
      const rx = fz, rz = -fx;
      const wish = {
        x: fx * -axis.z + rx * axis.x,
        z: fz * -axis.z + rz * axis.x,
      };
      lastFootSpeed = player.update(dt, wish, Boolean(keys.ShiftLeft || keys.ShiftRight), world.colliders);
      setEngine(0);
      if (player.aiming) player.angle = state.camYaw;
    }

    if (justPressed('KeyE')) {
      if (state.inCar) exitCar();
      else { const car = nearestCar(3.6); if (car) enterCar(car); }
    }
    combat(dt);

    for (const tr of traffic) tr.update(dt, traffic, playerPos());
    const danger = state.inCar && Math.abs(state.inCar.speed) > 6 ? playerPos() : (mouse.clicked ? player.pos : null);
    for (const p of peds) p.update(dt, danger, 7);

    const result = police.update(dt, playerPos(), playerSpeed());
    setSiren(police.wanted > 0 && police.seenByPolice);
    if (result === 'busted') busted();
    if (player.health <= 0) wasted();
    // Police shove / arrest pressure hurts a cornered player slowly.
    if (!state.inCar && police.bust > 0.55) player.hurt(dt * 4);

    const done = missions.check({ playerPos: playerPos(), inCar: Boolean(state.inCar), wanted: police.wanted, escapedOnce: state.escapedOnce });
    if (done) completeMission(done);

    state.saveT += dt;
    if (state.saveT > 5) { state.saveT = 0; persist(); }
  } else if (state.mode === 'dialog' && (justPressed('Enter') || mouse.clicked)) {
    advanceDialog(); mouse.clicked = false;
  }

  if ((justPressed('KeyP') || justPressed('Escape')) && (state.mode === 'playing' || state.mode === 'paused')) {
    if (state.mode === 'playing') { state.mode = 'paused'; pauseScreen.classList.remove('hidden'); }
    else { state.mode = 'playing'; pauseScreen.classList.add('hidden'); }
  }
  if (justPressed('KeyM')) toggleMute();

  // Mission marker follows the active target.
  const target = missions.targetPos(state);
  const showMarker = target && state.mode === 'playing';
  world.marker.visible = Boolean(showMarker);
  world.markerRing.visible = Boolean(showMarker);
  if (target) {
    world.marker.position.set(target.x, 13, target.z);
    world.markerRing.position.set(target.x, 0.35 + Math.sin(t * 3) * 0.12, target.z);
  }

  // Camera: chase the car, or follow behind Rio.
  const focus = playerPos();
  const camDist = state.inCar ? 10.5 : 7.5;
  const camH = state.inCar ? 4.2 : 3.4;
  const back = state.inCar ? state.inCar.angle + Math.PI : state.camYaw + Math.PI;
  const desired = new THREE.Vector3(
    focus.x + Math.sin(back) * camDist,
    camH,
    focus.z + Math.cos(back) * camDist,
  );
  if (state.mode === 'title' && !shot) {
    // Slow orbit for the title backdrop.
    const a = t * 0.07;
    camera.position.set(Math.sin(a) * 34, 13, 26 + Math.cos(a) * 20);
    camera.lookAt(0, 3, 0);
  } else if (shot === 'start') {
    camera.position.set(30, 17, 58); camera.lookAt(0, 5, 0);
  } else {
    camera.position.lerp(desired, shot ? 1 : 0.12);
    camera.lookAt(focus.x, 1.6, focus.z);
  }

  // HUD
  if (state.mode !== 'title') {
    hud.update({
      cash: state.cash, health: player.health, bust: police.bust, wanted: police.wanted,
      objective: missions.objectiveText(state), inCar: Boolean(state.inCar), speedKmh: state.speedKmh,
      showEnterHint: !state.inCar && Boolean(nearestCar(3.6)) && state.mode === 'playing',
    });
    hud.drawMinimap({
      playerPos: focus, playerAngle: state.inCar ? state.inCar.angle : player.angle,
      marker: target, police: police.units.map((u) => u.pos), policeStation: POLICE_STATION,
    });
  }

  endFrameInput();
  renderer.render(scene, camera);
}
frame();

// Expose a tiny handle for automated checks / screenshots.
window.__portSolana = { state, missions, police, player, parked, traffic };
