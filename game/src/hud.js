// HUD: health / bust bars, cash, wanted stars, objective text, dialog box,
// hints, speedometer and the 2D canvas minimap (roads, player arrow,
// gold mission marker, red police blips, blue parked-car dots).
import { PITCH, GRID, CITY } from './world.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.root = $('hud'); this.cash = $('cash'); this.wantedEl = $('wanted');
    this.healthFill = $('healthfill'); this.bustFill = $('bustfill');
    this.objective = $('objective'); this.hint = $('hint'); this.speedo = $('speedo');
    this.dialog = $('dialog'); this.dialogName = $('dialogName'); this.dialogText = $('dialogText');
    this.map = $('minimap').getContext('2d');
    this.lastStars = -1;
  }
  show() { this.root.classList.remove('hidden'); }
  update(state) {
    this.cash.textContent = '$' + Math.round(state.cash).toLocaleString('en-US');
    this.healthFill.style.width = Math.max(0, state.health) + '%';
    this.bustFill.style.width = Math.round(state.bust * 100) + '%';
    if (state.wanted !== this.lastStars) {
      this.lastStars = state.wanted;
      let html = '';
      for (let i = 0; i < 5; i++) html += i < state.wanted ? '★' : '<span class="off">★</span>';
      this.wantedEl.innerHTML = html;
    }
    this.objective.textContent = state.objective || '';
    this.objective.style.display = state.objective ? 'block' : 'none';
    this.hint.classList.toggle('hidden', !state.showEnterHint);
    this.speedo.classList.toggle('hidden', !state.inCar);
    if (state.inCar) this.speedo.textContent = Math.round(state.speedKmh) + ' km/h';
  }
  showDialog(name, text) {
    this.dialog.classList.remove('hidden');
    this.dialogName.textContent = name; this.dialogText.textContent = text;
  }
  hideDialog() { this.dialog.classList.add('hidden'); }

  drawMinimap(state) {
    const g = this.map, S = 190, scale = S / (CITY * 2 + 30);
    const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];
    g.fillStyle = '#77815e'; g.fillRect(0, 0, S, S);
    // blocks
    g.fillStyle = '#8f986f';
    for (let bx = -GRID; bx <= GRID; bx++) for (let bz = -GRID; bz <= GRID; bz++) {
      const [x, y] = toMap(bx * PITCH - PITCH / 2, bz * PITCH - PITCH / 2);
      g.fillRect(x - 19 * scale, y - 19 * scale, 38 * scale, 38 * scale);
    }
    // roads
    g.strokeStyle = '#3c3f45'; g.lineWidth = Math.max(3, 14 * scale);
    for (let k = -GRID; k <= GRID; k++) {
      const [rx] = toMap(k * PITCH, 0); const [, ry] = toMap(0, k * PITCH);
      g.beginPath(); g.moveTo(rx, 0); g.lineTo(rx, S); g.stroke();
      g.beginPath(); g.moveTo(0, ry); g.lineTo(S, ry); g.stroke();
    }
    // police station
    const [sx, sy] = toMap(state.policeStation.x, state.policeStation.z);
    g.fillStyle = '#4da3ff'; g.fillRect(sx - 4, sy - 4, 8, 8);
    // mission marker
    if (state.marker) {
      const [mx, my] = toMap(state.marker.x, state.marker.z);
      g.fillStyle = '#ffd23e'; g.beginPath(); g.arc(mx, my, 6, 0, 6.29); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
    }
    // police blips
    g.fillStyle = '#ff4040';
    for (const p of state.police) { const [x, y] = toMap(p.x, p.z); g.beginPath(); g.arc(x, y, 3.4, 0, 6.29); g.fill(); }
    // player arrow
    const [px, py] = toMap(state.playerPos.x, state.playerPos.z);
    g.save(); g.translate(px, py); g.rotate(state.playerAngle);
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -8); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath(); g.fill();
    g.strokeStyle = '#e8641e'; g.lineWidth = 1.6; g.stroke(); g.restore();
  }
}
