// Save / load progress in localStorage: cash, mission progress, position, health.
const KEY = 'port-solana-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      cash: Number(data.cash) || 0,
      missionIndex: Math.max(0, Math.min(99, Number(data.missionIndex) || 0)),
      storyDone: Boolean(data.storyDone),
      x: Number(data.x) || 0,
      z: Number(data.z) || 8,
      health: Math.max(10, Math.min(100, Number(data.health) || 100)),
    };
  } catch { return null; }
}

export function storeSave(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      cash: Math.round(state.cash),
      missionIndex: state.missionIndex,
      storyDone: state.storyDone,
      x: Math.round(state.playerPos.x * 10) / 10,
      z: Math.round(state.playerPos.z * 10) / 10,
      health: Math.round(state.health),
    }));
  } catch { /* storage unavailable: game still plays */ }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function hasSave() { return loadSave() !== null; }
