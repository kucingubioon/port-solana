// Keyboard and mouse state. One shared object the whole game reads.
export const keys = Object.create(null);
export const mouse = { down: false, clicked: false, x: 0, y: 0 };
const pressed = new Set();

export function initInput(target) {
  addEventListener('keydown', (e) => {
    if (!keys[e.code]) pressed.add(e.code);
    keys[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = false; });
  target.addEventListener('mousedown', (e) => { if (e.button === 0) { mouse.down = true; mouse.clicked = true; } });
  addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
  addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
}

/** True only on the first frame a key goes down. */
export function justPressed(code) { return pressed.has(code); }

export function endFrameInput() { pressed.clear(); mouse.clicked = false; }

export function moveAxis() {
  const x = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const z = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
  return { x, z };
}
