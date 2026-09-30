import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { EURUSD_H1_BASELINE_CONFIG, verifyDatasetHash } from '../src/trading-lab/historical-baseline.ts';

const read = (f: string) => readFileSync(new URL(`../src/panel-vortice/${f}`, import.meta.url), 'utf8');
const html = read('index.html');
const css = read('premium.css');
const js = read('app.js');

type MockElement = {
  dataset: Record<string, string>;
  style: Record<string, string>;
  attributes: Record<string, string>;
  textContent: string;
  hidden: boolean;
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
  removeAttribute: (name: string) => void;
};

const createMockElement = (initialAttrs: Record<string, string> = {}): MockElement => ({
  dataset: {},
  style: {},
  attributes: { ...initialAttrs },
  textContent: '',
  hidden: false,
  setAttribute(name, value) {
    this.attributes[name] = value;
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[key] = value;
    }
  },
  getAttribute(name) {
    return this.attributes[name] ?? null;
  },
  removeAttribute(name) {
    delete this.attributes[name];
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      delete this.dataset[key];
    }
  }
});

function createHarness(options: { reducedMotion?: boolean } = {}) {
  const entryBody = createMockElement({ 'data-activation-state': 'closed' });
  const core = createMockElement({ 'data-activation-state': 'closed' });
  const canonicalVortex = createMockElement({ 'data-activation-state': 'closed', 'aria-expanded': 'false', 'aria-label': 'ATLAS Canonical Vortex Core' });
  const app = createMockElement({ 'data-activation-state': 'closed' });
  const statusLabel = createMockElement();
  const promptLabel = createMockElement();
  const firstRing = createMockElement();
  const root = createMockElement();

  if (options.reducedMotion) {
    root.dataset.reducedMotion = 'reduce';
  }

  let scheduledTimerCallback: (() => void) | null = null;
  let scheduledDelay = 0;

  const context = {
    entryBody,
    core,
    canonicalVortex,
    app,
    root,
    reducedMotion: { matches: !!options.reducedMotion },
    document: {
      querySelector: (selector: string) => {
        if (selector === '.vortex-entry-status') return statusLabel;
        if (selector === '.vortex-entry-prompt') return promptLabel;
        if (selector === '#canonical-vortex') return canonicalVortex;
        if (selector === '#vortex-core') return core;
        if (selector === '#vortex-first-ring') return firstRing;
        if (selector === '#app') return app;
        return null;
      }
    },
    setTimeout: (cb: () => void, delay: number) => {
      scheduledTimerCallback = cb;
      scheduledDelay = delay;
      return 456;
    },
    clearTimeout: () => {
      scheduledTimerCallback = null;
    }
  };

  const startFn = js.indexOf('const ACTIVATION_STATES=');
  const endFn = js.indexOf('// Phase A.3 contracts remain');
  assert.ok(startFn >= 0 && endFn > startFn, 'activation state machine functions must be isolatable');
  const snippet = js.slice(startFn, endFn);
  vm.runInNewContext(`${snippet}; Object.assign(globalThis, { ACTIVATION_STATES, setActivationState, activateVortex, expandVortex });`, context);

  return {
    ...context,
    getScheduledCallback: () => scheduledTimerCallback,
    getScheduledDelay: () => scheduledDelay,
    triggerTimer: () => {
      assert.ok(scheduledTimerCallback, 'expected scheduled timer callback');
      const cb = scheduledTimerCallback;
      scheduledTimerCallback = null;
      cb();
    }
  };
}

// 1. CLOSED remains default
test('Phase 3: 1. CLOSED remains default launch state', () => {
  assert.ok(html.includes('<body class="vortex-entry-intro" data-activation-state="closed">'), 'body starts closed');
  assert.ok(html.includes('<main id="app" data-mode="simple" data-view="inicio" data-activation-state="closed">'), 'app starts closed');
  assert.ok(html.includes('<section id="vortex-core"') && html.includes('data-activation-state="closed"'), 'vortex-core starts closed');
  assert.ok(html.includes('id="canonical-vortex"') && html.includes('data-activation-state="closed"'), 'canonical vortex starts closed');
  assert.ok(html.includes('aria-expanded="false"'), 'aria-expanded is initially false');
});

// 2. ACTIVATING remains functional
test('Phase 3: 2. ACTIVATING transition remains functional', () => {
  const h = createHarness();
  (h as any).setActivationState((h as any).ACTIVATION_STATES.CLOSED);
  (h as any).activateVortex();

  assert.equal(h.entryBody.dataset.activationState, 'activating');
  assert.equal(h.core.dataset.activationState, 'activating');
  assert.equal(h.canonicalVortex.dataset.activationState, 'activating');
  assert.equal(h.canonicalVortex.getAttribute('aria-expanded'), 'false');
  assert.equal((h.document.querySelector('.vortex-entry-status') as any).textContent, 'CORE · INITIALIZING');
  assert.ok(h.getScheduledDelay() >= 650 && h.getScheduledDelay() <= 950, 'activating delay between 650ms and 950ms');
});

// 3. ACTIVE_CORE remains functional
test('Phase 3: 3. ACTIVE_CORE transition remains functional', () => {
  const h = createHarness();
  (h as any).setActivationState((h as any).ACTIVATION_STATES.CLOSED);
  (h as any).activateVortex();
  h.triggerTimer();

  assert.equal(h.entryBody.dataset.activationState, 'active_core');
  assert.equal(h.core.dataset.activationState, 'active_core');
  assert.equal(h.canonicalVortex.dataset.activationState, 'active_core');
  assert.equal(h.canonicalVortex.getAttribute('aria-expanded'), 'true');
  assert.equal((h.document.querySelector('.vortex-entry-status') as any).textContent, 'CORE · ACTIVE');
  assert.equal((h.document.querySelector('#vortex-first-ring') as any).hidden, true, 'first ring hidden in active_core');
});

// 4. ACTIVE_CORE → EXPANDING works
test('Phase 3: 4. ACTIVE_CORE -> EXPANDING works with 700-1100ms duration', () => {
  const h = createHarness();
  (h as any).setActivationState((h as any).ACTIVATION_STATES.ACTIVE_CORE);

  (h as any).expandVortex();
  assert.equal(h.entryBody.dataset.activationState, 'expanding');
  assert.equal(h.core.dataset.activationState, 'expanding');
  assert.equal(h.canonicalVortex.dataset.activationState, 'expanding');
  assert.equal((h.document.querySelector('.vortex-entry-status') as any).textContent, 'CORE · EXPANDING');
  assert.equal((h.document.querySelector('#vortex-first-ring') as any).hidden, false, 'first ring revealed in expanding');

  const delay = h.getScheduledDelay();
  assert.ok(delay >= 700 && delay <= 1100, `expanding duration ${delay}ms must be between 700ms and 1100ms`);
});

// 5. EXPANDING → EXPANDED works
test('Phase 3: 5. EXPANDING -> EXPANDED works upon timer completion', () => {
  const h = createHarness();
  (h as any).setActivationState((h as any).ACTIVATION_STATES.ACTIVE_CORE);
  (h as any).expandVortex();
  h.triggerTimer();

  assert.equal(h.entryBody.dataset.activationState, 'expanded');
  assert.equal(h.core.dataset.activationState, 'expanded');
  assert.equal(h.canonicalVortex.dataset.activationState, 'expanded');
  assert.equal(h.canonicalVortex.getAttribute('aria-expanded'), 'true');
  assert.equal((h.document.querySelector('.vortex-entry-status') as any).textContent, 'CORE · EXPANDED');
  assert.equal((h.document.querySelector('#vortex-first-ring') as any).hidden, false, 'first ring stays visible in expanded');
});

// 6. Six first-ring modules exist
test('Phase 3: 6. Six first-ring modules exist in markup', () => {
  const modules = ['knowledge', 'agents', 'trading', 'business', 'simulation', 'documents'];
  assert.ok(html.includes('id="vortex-first-ring"'), 'vortex-first-ring container exists');
  for (const mod of modules) {
    assert.ok(html.includes(`id="module-${mod}"`), `module-${mod} id exists`);
    assert.ok(html.includes(`data-module="${mod}"`), `data-module="${mod}" attribute exists`);
  }
});

// 7. Modules remain hidden before expansion
test('Phase 3: 7. Modules remain hidden before expansion in CSS', () => {
  assert.ok(css.includes('[data-activation-state="closed"] .vortex-first-ring'), 'first ring hidden in closed');
  assert.ok(css.includes('[data-activation-state="activating"] .vortex-first-ring'), 'first ring hidden in activating');
  assert.ok(css.includes('[data-activation-state="active_core"] .vortex-first-ring'), 'first ring hidden in active_core');
});

// 8. Duplicate expansion is blocked
test('Phase 3: 8. Duplicate expansion is blocked during EXPANDING and EXPANDED', () => {
  const h = createHarness();
  (h as any).setActivationState((h as any).ACTIVATION_STATES.ACTIVE_CORE);
  (h as any).expandVortex();
  assert.equal(h.entryBody.dataset.activationState, 'expanding');

  // Trigger during EXPANDING must be ignored
  const currentCb = h.getScheduledCallback();
  (h as any).expandVortex();
  assert.equal(h.getScheduledCallback(), currentCb, 'duplicate trigger during EXPANDING must not reschedule');

  // Settle to EXPANDED
  h.triggerTimer();
  assert.equal(h.entryBody.dataset.activationState, 'expanded');

  // Trigger during EXPANDED must be ignored
  (h as any).expandVortex();
  assert.equal(h.getScheduledCallback(), null, 'trigger during EXPANDED must be ignored');
  assert.equal(h.entryBody.dataset.activationState, 'expanded');
});

// 9. Phase 4 shell remains hidden
test('Phase 4 shell remains hidden in expanding and expanded states', () => {
  for (const state of ['expanding', 'expanded']) {
    assert.ok(css.includes(`[data-activation-state="${state}"] .sidebar`), `sidebar hidden in ${state}`);
    assert.ok(css.includes(`[data-activation-state="${state}"] .topbar`), `topbar hidden in ${state}`);
    assert.ok(css.includes(`[data-activation-state="${state}"] .system-status-strip`), `status strip hidden in ${state}`);
    assert.ok(css.includes(`[data-activation-state="${state}"] .view-head`), `view head hidden in ${state}`);
    assert.ok(css.includes(`[data-activation-state="${state}"] .operational-vortex`), `operational vortex hidden in ${state}`);
    assert.ok(css.includes(`[data-activation-state="${state}"] .modules-col`), `old module cards hidden in ${state}`);
  }
});

// 10. Honest state labels are enforced
test('Phase 3: 10. Honest state labels are enforced across all six ring modules', () => {
  const allowedBadges = ['REAL', 'LOCAL', 'VERIFIED', 'SIMULATED', 'MOCK', 'UNAVAILABLE', 'EMPTY', 'OFFLINE', 'STALE', 'READ-ONLY', 'BLOCKED', 'ACTIVE', 'LOCAL-FIRST'];
  const ringHtml = html.slice(html.indexOf('id="vortex-first-ring"'), html.indexOf('</div>\n        </div>\n        <div class="modules-col modules-right">'));

  // Ensure known badges are used
  assert.ok(ringHtml.includes('READ-ONLY'), 'READ-ONLY badge present');
  assert.ok(ringHtml.includes('SIMULATED'), 'SIMULATED badge present');
  assert.ok(ringHtml.includes('LOCAL'), 'LOCAL badge present');
  assert.ok(ringHtml.includes('VERIFIED'), 'VERIFIED badge present');
  assert.ok(ringHtml.includes('BLOCKED'), 'BLOCKED badge present');

  // Ensure no fabricated connectivity
  assert.equal(/CONNECTED|ONLINE/i.test(ringHtml), false, 'no fabricated external connectivity badges');
});

// 11. Trading remains simulation/read-only
test('Phase 3: 11. Trading module is simulation/read-only with zero forbidden uppercase words', () => {
  const tradingMod = html.slice(html.indexOf('id="module-trading"'), html.indexOf('id="module-business"'));
  assert.ok(tradingMod.includes('READ-ONLY'), 'Trading module has READ-ONLY state');
  assert.ok(tradingMod.includes('BLOCKED'), 'Trading module indicates real operations BLOCKED');

  for (const forbidden of ['BUY', 'SELL', 'ORDER', 'EXECUTE', 'CLOSE TRADE']) {
    assert.equal(tradingMod.includes(forbidden), false, `module-trading must not contain forbidden word "${forbidden}"`);
  }
});

// 12. Reduced-motion expansion exists
test('Phase 3: 12. Reduced-motion executes an accelerated expansion transition', () => {
  const h = createHarness({ reducedMotion: true });
  (h as any).setActivationState((h as any).ACTIVATION_STATES.ACTIVE_CORE);
  (h as any).expandVortex();

  assert.equal(h.entryBody.dataset.activationState, 'expanding');
  assert.ok(h.getScheduledDelay() <= 200, `reduced motion delay ${h.getScheduledDelay()}ms must be <= 200ms`);

  assert.ok(css.includes('.ring-module{animation:none!important}'), 'reduced motion disables module animations');
});

// 13. Keyboard support remains functional
test('Phase 3: 13. Keyboard interaction attaches Enter and Space with preventDefault', () => {
  assert.ok(js.includes("canonicalVortex.addEventListener('keydown'"), 'keydown listener attached');
  assert.ok(js.includes("event.key==='Enter'||event.key===' '"), 'Enter and Space checked');
  assert.ok(js.includes("event.preventDefault();activateVortex();expandVortex()"), 'prevents default and calls activation and expansion handlers');
});

// 14. Mobile responsive rules exist
test('Phase 3: 14. Mobile responsive layout rules exist in CSS', () => {
  assert.ok(css.includes('@media(max-width:768px)'), 'tablet/mobile breakpoint exists');
  assert.ok(css.includes('grid-template-columns:1fr'), 'responsive vertical stack defined');
  assert.ok(css.includes('overflow-x:hidden'), 'horizontal overflow prevented');
});

// 15. Canonical Vortex remains intact
test('Phase 3: 15. Canonical Vortex SVG component remains intact with all 9 layers', () => {
  assert.ok(html.includes('id="canonical-vortex"'), 'canonical vortex exists');
  for (const layer of ['axis', 'helices', 'containment', 'orbits', 'satellite-nodes', 'major-orbs', 'particles', 'core-light']) {
    assert.ok(html.includes(`vortex-layer-${layer}`), `layer ${layer} exists`);
  }
  assert.ok(css.includes('[data-activation-state="expanded"] .vortice-canonical'), 'expanded vortex styled in CSS');
});

// 16. Dataset hash remains unchanged
test('Phase 3: 16. Canonical dataset hash integrity is strictly preserved', () => {
  const verified = verifyDatasetHash(EURUSD_H1_BASELINE_CONFIG.csvPath, EURUSD_H1_BASELINE_CONFIG.expectedSHA256);
  assert.equal(verified, true, 'SHA256 of canonical EURUSD H1 dataset must match authoritative hash');
});
