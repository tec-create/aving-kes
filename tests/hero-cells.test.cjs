const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../assets/app.js'), 'utf8');
const code = source.slice(source.indexOf('  function mountHeroCells('), source.indexOf('  /* ---------- helpers ---------- */'));
function target() {
  return { listeners: {}, addEventListener(k, f) { this.listeners[k] = f; }, removeEventListener(k) { delete this.listeners[k]; } };
}
const hero = target(), document = target(), motion = target();
motion.matches = true;
let now = 0, sequence = 0, observer, resizeObserver, fills = [];
const pending = new Map();
const ctx = { clearRect() { fills = []; }, setTransform() {}, fillRect() { fills.push(this.fillStyle); } };
const canvas = { getContext: () => ctx };
hero.querySelector = () => canvas;
hero.getBoundingClientRect = () => ({ width: 1200, height: 900, left: 0, top: 76 });
const env = {
  document, matchMedia: () => motion, performance: { now: () => now }, devicePixelRatio: 3,
  requestAnimationFrame(f) { pending.set(++sequence, f); return sequence; },
  cancelAnimationFrame(id) { pending.delete(id); },
  IntersectionObserver: class { constructor(cb) { this.cb = cb; observer = this; } observe() {} disconnect() { this.disconnected = true; } },
  ResizeObserver: class { constructor(cb) { this.cb = cb; resizeObserver = this; } observe() {} disconnect() { this.disconnected = true; } },
};
const mount = vm.runInNewContext(code + '; mountHeroCells', env);
const cleanup = mount(hero);
assert.equal(canvas.width, 2400, 'DPR capped at 2');
assert(fills.length > 100, 'static cells drawn without motion');
const baseline = fills.join('|');
observer.cb([{ isIntersecting: true }]);
const move = (pointerType = 'mouse') => hero.listeners.pointermove({ clientX: 170, clientY: 400, pointerType });
const advance = ms => { now += ms; const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(f => f(now)); };
move(); advance(40);
assert.notEqual(fills.join('|'), baseline, 'pointer illuminates cells');
advance(1300);
assert.equal(pending.size, 0, 'trail stops scheduling after it fades');
assert.equal(fills.join('|'), baseline, 'cells return to baseline');
move(); observer.cb([{ isIntersecting: false }]);
assert.equal(pending.size, 0, 'offscreen cancels work');
observer.cb([{ isIntersecting: true }]);
motion.matches = false; motion.listeners.change(); move();
assert.equal(pending.size, 0, 'reduced motion/coarse pointer stays static');
motion.matches = true; move('touch');
assert.equal(pending.size, 0, 'touch scrolling never starts a trail');
move(); document.hidden = true; document.listeners.visibilitychange();
assert.equal(pending.size, 0, 'hidden document cancels work');
document.hidden = false; move(); cleanup();
assert.equal(pending.size, 0, 'route cleanup cancels work');
assert.equal(Object.keys(hero.listeners).length, 0);
assert.equal(Object.keys(document.listeners).length, 0);
assert.equal(Object.keys(motion.listeners).length, 0);
assert(observer.disconnected && resizeObserver.disconnected);
console.log('PASS: cell response, decay, reduced motion, touch, visibility and cleanup');
