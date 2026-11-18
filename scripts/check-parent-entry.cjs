const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const source = fs.readFileSync(process.env.PARENT_ENTRY_BASELINE || path.join(__dirname, '../dist/game.js'), 'utf8');

function setup() {
  const handlers = { document: {}, window: {}, app: {} }, timers = new Map();
  let clock = 100000, nextTimer = 1;
  const on = scope => (type, fn) => (handlers[scope][type] ||= []).push(fn);
  const root = { innerHTML: '', addEventListener: on('app'),
    setPointerCapture(id) { root.capture = id; button.capture = null; } };
  const classes = new Set();
  const button = {
    dataset: { action: 'parent' }, isConnected: true,
    classList: { add: x => classes.add(x), remove: x => classes.delete(x) },
    closest: selector => ['.parent-entry', 'button', '[data-action],.overlay,[data-phase]'].includes(selector) ? button : null,
    getBoundingClientRect: () => ({ left: 100, top: 100, right: 220, bottom: 150 }),
    setPointerCapture: id => { button.capture = id; },
    hasPointerCapture: id => button.capture === id,
    releasePointerCapture: () => { button.capture = null; }
  };
  const context = {
    console, Date: class extends Date { static now() { return clock; } },
    document: { hidden: false, querySelector: s => s === '#app' ? root : null, querySelectorAll: () => [], addEventListener: on('document') },
    window: { addEventListener: on('window') }, requestAnimationFrame() {},
    setTimeout(fn, ms) { const id = nextTimer++; timers.set(id, { at: clock + ms, fn }); return id; },
    clearTimeout(id) { timers.delete(id); }
  };
  vm.createContext(context); vm.runInContext(source, context);
  function emit(type, extra = {}) {
    const e = { type, button: 0, pointerId: 1, isPrimary: true, clientX: 160, clientY: 125, target: button,
      preventDefault() { this.defaultPrevented = true; }, ...extra };
    for (const scope of ['document', 'app', 'window']) for (const fn of handlers[scope][type] || []) fn(e);
    return e;
  }
  function advance(ms) {
    const end = clock + ms;
    for (;;) {
      const due = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      clock = due[1].at; timers.delete(due[0]); due[1].fn();
    }
    clock = end;
  }
  return { emit, advance, button, classes, context, root, run: s => vm.runInContext(s, context) };
}

// Regression: Android may omit click after a long press. Open while held,
// independently of pointerup/click, and do not advance the children's game.
for (const screen of ['home()', 'phaseView()', 'S.phase=1;startLevel(0)', 'S.phase=3;startLevel(0)', 'S.phase=1;startLevel(0);setOverlay("menu")']) {
  const t = setup(); t.run(screen); const previous = t.run('S.overlay');
  t.emit('pointerdown'); t.advance(999); assert.equal(t.run('S.overlay'), previous);
  t.advance(1); assert.equal(t.run('S.overlay'), 'parent', 'holding must open without a click');
  assert.equal(t.root.capture, 1, 'keep release outside the new iframe');
  assert.equal(t.run('S.round'), 0);
  t.emit('pointerup'); t.emit('click'); assert.equal(t.run('S.overlay'), 'parent');
  t.run('closeParent()'); assert.equal(t.run('S.overlay'), previous);
  t.emit('pointerdown'); t.advance(1000); assert.equal(t.run('S.overlay'), 'parent', 'can reopen');
}
for (const cancel of ['pointerup', 'pointercancel', 'lostpointercapture', 'outside', 'blur', 'hidden', 'nativePause', 'render', 'secondFinger']) {
  const t = setup(); t.emit('pointerdown'); t.advance(500);
  if (cancel === 'outside') t.emit('pointermove', { clientX: 240 });
  else if (cancel === 'hidden') { t.context.document.hidden = true; t.emit('visibilitychange'); }
  else if (cancel === 'nativePause') t.run('window.microstarAndroidPause()');
  else if (cancel === 'render') t.run('render()');
  else if (cancel === 'secondFinger') t.emit('pointerdown', { pointerId: 2, isPrimary: false });
  else t.emit(cancel);
  t.advance(1500); t.emit('click');
  assert.notEqual(t.run('S.overlay'), 'parent', cancel + ' must cancel the gesture');
  assert.equal(t.classes.has('holding'), false, cancel + ' clears feedback');
}
{
  const t = setup(); t.emit('pointerdown'); t.advance(400);
  assert.equal(t.emit('contextmenu').defaultPrevented, true, 'suppress native long-press menu on this button');
  t.emit('pointermove', { clientX: 168 }); t.emit('pointerup', { pointerId: 2 });
  t.advance(600); assert.equal(t.run('S.overlay'), 'parent', 'small movement and unrelated pointerup do not cancel');
  t.emit('click', { target: { closest: () => ({ dataset: { action: 'parent-return' } }) } });
  assert.equal(t.run('S.overlay'), 'parent', 'release click cannot activate the newly rendered dialog');
  t.emit('pointerdown', { target: { closest: () => null } });
  t.emit('click', { target: { closest: () => ({ dataset: { action: 'parent-return' } }) } });
  assert.equal(t.run('S.overlay'), null, 'next deliberate click works even if Android omitted the release click');
}
{
  const t = setup(), frameHandlers = {};
  t.emit('pointerdown'); t.advance(1000);
  t.emit('load', { target: { matches: s => s === '.parent-frame', contentDocument: {
    addEventListener(type, fn) { frameHandlers[type] = fn; }
  } } });
  const release = { preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
  frameHandlers.click(release);
  assert.equal(release.prevented, true); assert.equal(release.stopped, true, 'iframe must not handle the old release');
  // Some Android devices omit that click entirely; the next press still works.
  t.run('parentClickBlocked=true'); frameHandlers.pointerdown();
  const next = { preventDefault() { throw Error('new tap blocked'); }, stopImmediatePropagation() {} };
  frameHandlers.click(next);
}
console.log('PASS: parent hold opens without click; 5 screens, short tap, cancellation, multitouch, context menu and release-click protection.');
