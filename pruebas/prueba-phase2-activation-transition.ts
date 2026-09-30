import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { EURUSD_H1_BASELINE_CONFIG, verifyDatasetHash } from '../src/trading-lab/historical-baseline.ts';

const leer = (f: string) => readFileSync(new URL(`../src/panel-vortice/${f}`, import.meta.url), 'utf8');
const html = leer('index.html');
const css = leer('app.css') + '\n' + leer('premium.css');
const js = leer('app.js');

test('Phase 2: Markup declares initial data-activation-state="closed" and accessibility semantics', () => {
  assert.ok(html.includes('<body class="vortex-entry-intro" data-activation-state="closed">'), 'body must start closed');
  assert.ok(html.includes('<main id="app" data-mode="simple" data-view="inicio" data-activation-state="closed">'), 'app must start closed');
  assert.ok(html.includes('<section id="vortex-core"') && html.includes('data-activation-state="closed"'), 'vortex-core must start closed');
  assert.ok(html.includes('id="canonical-vortex"'), 'canonical-vortex element exists');
  assert.ok(html.includes('role="button"'), 'canonical-vortex has role button');
  assert.ok(html.includes('tabindex="0"'), 'canonical-vortex has tabindex 0 for keyboard focus');
  assert.ok(html.includes('aria-label="ATLAS Canonical Vortex Core"'), 'canonical-vortex has semantic aria-label');
  assert.ok(html.includes('aria-expanded="false"'), 'canonical-vortex has aria-expanded false in closed state');
});

test('Phase 2: State machine constants and transition function exist in app.js', () => {
  assert.ok(js.includes("CLOSED:'closed'"), 'ACTIVATION_STATES defines closed');
  assert.ok(js.includes("ACTIVATING:'activating'"), 'ACTIVATION_STATES defines activating');
  assert.ok(js.includes("ACTIVE_CORE:'active_core'"), 'ACTIVATION_STATES defines active_core');
  assert.ok(js.includes('function setActivationState('), 'setActivationState function exists');
  assert.ok(js.includes('function activateVortex('), 'activateVortex function exists');
  assert.ok(js.includes("setActivationState(ACTIVATION_STATES.CLOSED)"), 'app.js initializes closed state at startup');
});

test('Phase 2: State machine execution harness verifies CLOSED -> ACTIVATING -> ACTIVE_CORE transitions', () => {
  type MockElement = {
    dataset: Record<string, string>;
    style: Record<string, string>;
    attributes: Record<string, string>;
    textContent: string;
    setAttribute: (name: string, value: string) => void;
    getAttribute: (name: string) => string | null;
  };

  const createMockElement = (initialAttrs: Record<string, string> = {}): MockElement => ({
    dataset: {},
    style: {},
    attributes: { ...initialAttrs },
    textContent: '',
    setAttribute(name: string, value: string) {
      this.attributes[name] = value;
      if (name.startsWith('data-')) {
        const key = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        this.dataset[key] = value;
      }
    },
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    }
  });

  const entryBody = createMockElement();
  const core = createMockElement();
  const canonicalVortex = createMockElement({ 'aria-expanded': 'false', 'aria-label': 'ATLAS Canonical Vortex Core' });
  const app = createMockElement();
  const statusLabel = createMockElement();
  const promptLabel = createMockElement();
  const root = createMockElement();

  let scheduledTimerCallback: (() => void) | null = null;
  let scheduledDelay = 0;

  const context = {
    entryBody,
    core,
    canonicalVortex,
    app,
    root,
    reducedMotion: { matches: false },
    document: {
      querySelector: (selector: string) => {
        if (selector === '.vortex-entry-status') return statusLabel;
        if (selector === '.vortex-entry-prompt') return promptLabel;
        if (selector === '#canonical-vortex') return canonicalVortex;
        if (selector === '#vortex-core') return core;
        if (selector === '#app') return app;
        return null;
      }
    },
    setTimeout: (cb: () => void, delay: number) => {
      scheduledTimerCallback = cb;
      scheduledDelay = delay;
      return 123;
    }
  };

  const startFn = js.indexOf('const ACTIVATION_STATES=');
  const endFn = js.indexOf('// Phase A.3 contracts remain');
  assert.ok(startFn >= 0 && endFn > startFn, 'activation state machine functions must be isolatable');
  const snippet = js.slice(startFn, endFn);
  vm.runInNewContext(`${snippet}; Object.assign(globalThis, { ACTIVATION_STATES, setActivationState, activateVortex });`, context);

  // 1. Initial set to CLOSED
  (context as any).setActivationState((context as any).ACTIVATION_STATES.CLOSED);
  assert.equal(entryBody.dataset.activationState, 'closed');
  assert.equal(core.dataset.activationState, 'closed');
  assert.equal(canonicalVortex.dataset.activationState, 'closed');
  assert.equal(canonicalVortex.getAttribute('aria-expanded'), 'false');
  assert.equal(statusLabel.textContent, 'CORE · DORMANT');

  // 2. Trigger activation -> ACTIVATING
  (context as any).activateVortex();
  assert.equal(entryBody.dataset.activationState, 'activating');
  assert.equal(core.dataset.activationState, 'activating');
  assert.equal(canonicalVortex.dataset.activationState, 'activating');
  assert.equal(canonicalVortex.getAttribute('aria-expanded'), 'false');
  assert.equal(statusLabel.textContent, 'CORE · INITIALIZING');
  assert.equal(promptLabel.style.display, 'none');

  // Verify transition duration is between 650ms and 950ms
  assert.ok(scheduledDelay >= 650 && scheduledDelay <= 950, `activation duration ${scheduledDelay}ms must be between 650ms and 950ms`);

  // 3. Idempotent guard: duplicate click during ACTIVATING must be ignored
  const initialCallback = scheduledTimerCallback;
  (context as any).activateVortex();
  assert.equal(scheduledTimerCallback, initialCallback, 'duplicate trigger during ACTIVATING must not reschedule or reset');
  assert.equal(entryBody.dataset.activationState, 'activating');

  // 4. Complete transition timer -> ACTIVE_CORE
  assert.ok(scheduledTimerCallback, 'timer callback must have been scheduled');
  scheduledTimerCallback!();

  assert.equal(entryBody.dataset.activationState, 'active_core');
  assert.equal(core.dataset.activationState, 'active_core');
  assert.equal(canonicalVortex.dataset.activationState, 'active_core');
  assert.equal(canonicalVortex.getAttribute('aria-expanded'), 'true');
  assert.equal(statusLabel.textContent, 'CORE · ACTIVE');
  assert.equal(core.dataset.vortexState, 'active');

  // 5. Idempotent guard: duplicate click during ACTIVE_CORE must be ignored
  scheduledTimerCallback = null;
  (context as any).activateVortex();
  assert.equal(scheduledTimerCallback, null, 'trigger during ACTIVE_CORE must be ignored');
  assert.equal(entryBody.dataset.activationState, 'active_core');
});

test('Phase 2: Reduced motion executes an accelerated/calm transition', () => {
  const entryBody = { dataset: { activationState: 'closed' } };
  const core = { dataset: {} as Record<string, string> };
  const canonicalVortex = {
    dataset: {} as Record<string, string>,
    setAttribute: () => {},
    getAttribute: () => 'false'
  };
  const root = { dataset: { reducedMotion: 'reduce' } };
  let scheduledDelay = 0;

  const context = {
    entryBody,
    core,
    canonicalVortex,
    app: null,
    root,
    reducedMotion: { matches: true },
    document: { querySelector: () => null },
    setTimeout: (_cb: () => void, delay: number) => {
      scheduledDelay = delay;
      return 1;
    }
  };

  const startFn = js.indexOf('const ACTIVATION_STATES=');
  const endFn = js.indexOf('// Phase A.3 contracts remain');
  const snippet = js.slice(startFn, endFn);
  vm.runInNewContext(`${snippet}; Object.assign(globalThis, { ACTIVATION_STATES, setActivationState, activateVortex });`, context);

  (context as any).activateVortex();
  assert.ok(scheduledDelay <= 300, `reduced motion delay ${scheduledDelay}ms should be accelerated/calm`);
});

test('Phase 2: Keyboard interaction attaches Enter and Space with preventDefault', () => {
  assert.ok(js.includes("canonicalVortex.addEventListener('click',activateVortex)"), 'click listener attached');
  assert.ok(js.includes("canonicalVortex.addEventListener('keydown'"), 'keydown listener attached');
  assert.ok(js.includes("event.key==='Enter'||event.key===' '"), 'handles Enter and Space');
  assert.ok(js.includes("event.preventDefault();activateVortex()"), 'prevents default scroll and triggers activation');
});

test('Phase 2: CSS implements the activation sequence without changing geometry mode', () => {
  assert.ok(css.includes('@keyframes vortex-activating-sequence'), 'keyframe vortex-activating-sequence defined');
  assert.ok(css.includes('Core Ignition') || css.includes('v-core-flare-ignite'), 'stage 1: core ignition keyframe');
  assert.ok(css.includes('Energy Acceleration') || css.includes('v-axis-intensify'), 'stage 2: energy acceleration keyframe');
  assert.ok(css.includes('Containment Expansion') || css.includes('v-containment-burst'), 'stage 3: containment expansion keyframe');
  assert.ok(css.includes('Core Contraction'), 'stage 4: core refines its glow without shrinking');
  assert.ok(css.includes('v-routing-traces-ignite'), 'stage 5: routing traces initialization keyframe');
  assert.ok(css.includes('@keyframes vortex-active-core-breathe'), 'stage 6: steady active core breathing keyframe');
});

test('Phase 2: Operational transitions preserve the selected reactor geometry', () => {
  assert.equal(css.includes('scale(.66)'), false, 'operational state does not contract the reactor');
  assert.ok(css.includes('data-geometry-mode="compact"') && css.includes('data-geometry-mode="standard"') && css.includes('data-geometry-mode="expanded"'), 'geometry modes independently control scale');
  assert.ok(css.includes('[data-activation-state="active_core"] .vortice-canonical'), 'active_core CSS selector targets canonical vortex');
});

test('Phase 2: Strict Scope Boundary — Dashboard, sidebar, topbar, view-head and module cards remain hidden in all Phase 2 states', () => {
  for (const state of ['closed', 'activating', 'active_core']) {
    assert.ok(css.includes(`[data-activation-state="${state}"] .sidebar`), `sidebar hidden in ${state}`);
    assert.ok(css.includes(`[data-activation-state="${state}"] .topbar`), `topbar hidden in ${state}`);
    assert.ok(css.includes(`[data-activation-state="${state}"] .system-status-strip`), `status strip hidden in ${state}`);
    assert.ok(css.includes(`[data-activation-state="${state}"] .view-head`), `view head hidden in ${state}`);
    assert.ok(css.includes(`[data-activation-state="${state}"] .modules-col`), `module cards hidden in ${state}`);
    assert.ok(css.includes(`[data-activation-state="${state}"] .operational-vortex`), `operational vortex hidden in ${state}`);
  }
});

test('Phase 2: Preparatory routing traces are hidden in closed mode and visible in active core', () => {
  assert.ok(html.includes('class="vortex-layer-routing-traces module-connections"'), 'routing traces group in SVG');
  assert.ok(html.includes('class="v-routing-node node-texto"'), 'terminal node for texto');
  assert.ok(html.includes('class="v-routing-node node-voz"'), 'terminal node for voz');
  assert.ok(html.includes('class="v-routing-node node-imagenes"'), 'terminal node for imagenes');
  assert.ok(html.includes('class="v-routing-node node-video"'), 'terminal node for video');
  assert.ok(html.includes('class="v-routing-node node-datos"'), 'terminal node for datos');
  assert.ok(html.includes('class="v-routing-node node-simulacion"'), 'terminal node for simulacion');

  assert.ok(css.includes('[data-activation-state="closed"] .vortex-layer-routing-traces{opacity:0'), 'traces hidden in closed state');
  assert.ok(css.includes('[data-activation-state="activating"] .vortex-layer-routing-traces{visibility:visible'), 'traces igniting in activating state');
  assert.ok(css.includes('[data-activation-state="active_core"] .vortex-layer-routing-traces{opacity:.75'), 'traces visible in active_core state');
});

test('Phase 2: Accessibility and reduced motion rules exist in CSS', () => {
  assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'), 'prefers-reduced-motion media query');
  assert.ok(css.includes('html[data-reduced-motion="reduce"]'), 'data-reduced-motion attribute selector');
  assert.ok(css.includes('animation:none!important'), 'animations disabled in reduced motion');
});

test('Phase 2: Zero forbidden trading words in uppercase in UI markup and scripts', () => {
  for (const forbidden of ['BUY', 'SELL', 'ORDER', 'EXECUTE', 'CLOSE TRADE']) {
    assert.equal(html.includes(forbidden) || js.includes(forbidden), false, `no debe contener "${forbidden}"`);
  }
});

test('Phase 2: Canonical historical dataset SHA256 integrity strictly preserved', () => {
  const verified = verifyDatasetHash(EURUSD_H1_BASELINE_CONFIG.csvPath, EURUSD_H1_BASELINE_CONFIG.expectedSHA256);
  assert.equal(verified, true, 'SHA256 canónico verificado');
});
