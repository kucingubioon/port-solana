// All sound is synthesised with WebAudio: engine hum, police siren, pickup and
// mission jingles, gunshot / punch thumps and a warm ambient music loop.
// No audio files, no network.
let ctx = null, master = null, muted = false;
let engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null, musicTimer = null;

function ensure() {
  if (ctx) return true;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    return true;
  } catch { return false; }
}

export function initAudio() {
  if (!ensure()) return;
  if (ctx.state === 'suspended') ctx.resume();
  startAmbient();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

function tone(freq, dur, type = 'sine', vol = 0.2, when = 0, slideTo = 0) {
  if (!ensure() || muted) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}

export function playPickup() { tone(880, 0.09, 'square', 0.12); tone(1320, 0.14, 'square', 0.12, 0.07); }
export function playMissionDone() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.22, i * 0.11)); }
export function playMissionStart() { tone(392, 0.15, 'triangle', 0.18); tone(587, 0.2, 'triangle', 0.18, 0.1); }
export function playShot() { tone(160, 0.12, 'sawtooth', 0.3, 0, 40); tone(900, 0.05, 'square', 0.1); }
export function playPunch() { tone(110, 0.1, 'sine', 0.35, 0, 55); }
export function playBusted() { [440, 415, 392, 370].forEach((f, i) => tone(f, 0.3, 'triangle', 0.2, i * 0.16)); }
export function playHorn() { tone(370, 0.25, 'square', 0.12); tone(466, 0.25, 'square', 0.1, 0.02); }

/** Engine hum follows the driven car's speed; call every frame, 0 when on foot. */
export function setEngine(speed01) {
  if (!ensure()) return;
  if (speed01 > 0.02) {
    if (!engineOsc) {
      engineOsc = ctx.createOscillator(); engineGain = ctx.createGain();
      engineOsc.type = 'sawtooth'; engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 420;
      engineOsc.connect(filter); filter.connect(engineGain); engineGain.connect(master); engineOsc.start();
    }
    engineOsc.frequency.value = 55 + speed01 * 130;
    engineGain.gain.value = muted ? 0 : 0.05 + speed01 * 0.06;
  } else if (engineGain) engineGain.gain.value = 0;
}

/** Two-tone siren while police are close and the player is wanted. */
export function setSiren(active) {
  if (!ensure()) return;
  if (active && !sirenOsc) {
    sirenOsc = ctx.createOscillator(); sirenGain = ctx.createGain();
    sirenOsc.type = 'triangle'; sirenGain.gain.value = 0.0;
    sirenOsc.connect(sirenGain); sirenGain.connect(master); sirenOsc.start();
  }
  if (sirenOsc) {
    sirenGain.gain.value = muted ? 0 : (active ? 0.045 : 0);
    if (active) sirenOsc.frequency.value = 650 + Math.sin(ctx.currentTime * 5.2) * 190;
  }
}

// Warm ambient loop: a slow I–vi–IV–V pad progression, one chord every 4 s.
const CHORDS = [[261.6, 329.6, 392], [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7]];
let chordIdx = 0;
function startAmbient() {
  if (musicTimer || !ctx) return;
  const playChord = () => {
    if (!muted) for (const f of CHORDS[chordIdx % CHORDS.length]) tone(f, 3.8, 'sine', 0.035);
    chordIdx++;
  };
  playChord();
  musicTimer = setInterval(playChord, 4000);
}
