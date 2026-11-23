// Story missions for Port Solana: a six-mission chain for fixer Marisol Vega.
// Each mission: intro dialogue lines, an objective kind, a target, a reward.
// Kinds: goto | deliverCar | escape | checkpoints | pickup | finale
import * as THREE from 'three';
import { PITCH, PIER } from './world.js';

export const MISSIONS = [
  {
    title: 'First Tide',
    reward: 150,
    kind: 'goto',
    target: new THREE.Vector3(PITCH, 0, PITCH),
    dialog: [
      ['Marisol Vega', 'Rio. You found my duffel, so now you work for me until the debt smells less.'],
      ['Rio Valdez', 'I found trouble, is what I found. What do you need?'],
      ['Marisol Vega', 'Walk the marina ledger to my cousin at the east market. Legs first, wheels later.'],
    ],
    objective: 'Reach the east market marker',
    done: 'Ledger delivered. Marisol is pleased — for her.',
  },
  {
    title: 'Borrowed Wheels',
    reward: 300,
    kind: 'deliverCar',
    target: new THREE.Vector3(-PITCH, 0, PITCH),
    dialog: [
      ['Marisol Vega', 'A client left a car across town and lost the keys. And the paperwork. And ownership.'],
      ['Rio Valdez', 'So I am stealing it.'],
      ['Marisol Vega', 'You are RELOCATING it. Bring any car to my garage on the west side.'],
    ],
    objective: 'Steal any car (E) and deliver it to the west garage',
    done: 'Car relocated. The garage door closes very, very fast.',
  },
  {
    title: 'Hot Water',
    reward: 350,
    kind: 'escape',
    target: null,
    dialog: [
      ['Marisol Vega', 'Bad news: the duffel was police bait. They are already rolling.'],
      ['Rio Valdez', 'You knew?!'],
      ['Marisol Vega', 'Lose them, Rio. Break line of sight and keep it broken.'],
    ],
    objective: 'Lose the police: get your wanted level to zero',
    done: 'Gone like sea mist. The Solana PD files a very confused report.',
  },
  {
    title: 'Four Corners',
    reward: 400,
    kind: 'checkpoints',
    target: null,
    checkpoints: [
      new THREE.Vector3(PITCH * 2, 0, -PITCH * 2),
      new THREE.Vector3(-PITCH * 2, 0, -PITCH * 2),
      new THREE.Vector3(-PITCH * 2, 0, PITCH * 2),
      new THREE.Vector3(PITCH * 2, 0, PITCH * 2),
    ],
    dialog: [
      ['Marisol Vega', 'A buyer is timing couriers today. Four corners of Solana, quick as you can.'],
      ['Rio Valdez', 'A race. Against the clock and the law.'],
      ['Marisol Vega', 'Against the clock. The law is your own hobby.'],
    ],
    objective: 'Drive through all 4 corner checkpoints',
    done: 'Fastest courier of the day. The buyer tips in cash.',
  },
  {
    title: 'The Pickup',
    reward: 500,
    kind: 'pickup',
    target: new THREE.Vector3(0, 0, -PITCH * 2),
    dialog: [
      ['Marisol Vega', 'A package waits by the north depot. On foot, quiet, no heroics.'],
      ['Rio Valdez', 'Quiet is my middle name.'],
      ['Marisol Vega', 'Your middle name is Trouble, Rio. I have seen the paperwork.'],
    ],
    objective: 'Pick up the package at the north depot (on foot)',
    done: 'Package secured. It is heavier than money and ticks slightly.',
  },
  {
    title: 'Low Tide, Full Speed',
    reward: 1200,
    kind: 'finale',
    target: PIER.clone(),
    dialog: [
      ['Marisol Vega', 'Last job. The boat leaves from Pier 9 in minutes — drive, Rio, DRIVE.'],
      ['Rio Valdez', 'And the duffel?'],
      ['Marisol Vega', 'Keep it. You earned the trouble. Now earn the way out.'],
    ],
    objective: 'Reach Pier 9 and catch the boat out of Port Solana',
    done: 'The boat clears the harbour as sirens fade behind the breakwater. Rio Valdez is gone — richer, sunburnt, and free.',
  },
];

export class MissionManager {
  constructor() {
    this.index = 0;
    this.phase = 'dialog'; // dialog | active | done | storyDone
    this.checkpointIdx = 0;
    this.dialogIdx = 0;
    this.deliveredCar = false;
  }
  get current() { return this.index < MISSIONS.length ? MISSIONS[this.index] : null; }
  get storyDone() { return this.index >= MISSIONS.length; }

  /** Marker position for the minimap / world pillar, or null. */
  targetPos(state) {
    const m = this.current;
    if (!m || this.phase !== 'active') return null;
    if (m.kind === 'checkpoints') return m.checkpoints[this.checkpointIdx];
    if (m.kind === 'escape') return null;
    return m.target;
  }

  objectiveText(state) {
    const m = this.current;
    if (!m) return 'Story complete — Port Solana is yours to roam.';
    if (this.phase === 'dialog') return `New job: ${m.title} — read the briefing`;
    if (m.kind === 'checkpoints') return `${m.objective} (${this.checkpointIdx}/${m.checkpoints.length})`;
    if (m.kind === 'deliverCar' && !state.inCar) return m.objective + ' — you are on foot';
    return m.objective;
  }

  /**
   * Check completion against the live game state.
   * state: { playerPos, inCar, wanted }
   * Returns the finished mission or null.
   */
  check(state) {
    const m = this.current;
    if (!m || this.phase !== 'active') return null;
    let done = false;
    if (m.kind === 'goto' || m.kind === 'pickup' || m.kind === 'finale') {
      const needCar = m.kind === 'finale';
      if (state.playerPos.distanceTo(m.target) < 4.2 && (!needCar || state.inCar)) done = true;
      if (m.kind === 'pickup' && state.inCar) done = false;
    } else if (m.kind === 'deliverCar') {
      if (state.inCar && state.playerPos.distanceTo(m.target) < 5.5) done = true;
    } else if (m.kind === 'escape') {
      if (state.wanted === 0 && state.escapedOnce) done = true;
    } else if (m.kind === 'checkpoints') {
      const cp = m.checkpoints[this.checkpointIdx];
      if (state.playerPos.distanceTo(cp) < 7) {
        this.checkpointIdx++;
        if (this.checkpointIdx >= m.checkpoints.length) done = true;
      }
    }
    if (!done) return null;
    this.phase = 'done';
    return m;
  }

  advance() {
    this.index++;
    this.phase = this.storyDone ? 'storyDone' : 'dialog';
    this.dialogIdx = 0;
    this.checkpointIdx = 0;
    this.deliveredCar = false;
  }
}
