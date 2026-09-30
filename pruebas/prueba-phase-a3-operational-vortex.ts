import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { EURUSD_H1_BASELINE_CONFIG, verifyDatasetHash } from '../src/trading-lab/historical-baseline.ts';
import { AtlasLocalApi } from '../src/api-local/servidor.ts';

const read = (name: string) => readFileSync(new URL(`../src/panel-vortice/${name}`, import.meta.url), 'utf8');
const html = read('index.html');
const css = read('app.css') + read('premium.css');
const js = read('app.js');

type FakeNode = {
  className: string;
  textContent: string;
  dataset: Record<string, string>;
  children: FakeNode[];
  append: (...nodes: FakeNode[]) => void;
  replaceChildren: (...nodes: FakeNode[]) => void;
  setAttribute: (name: string, value: string) => void;
};

function fakeNode(): FakeNode {
  return {
    className: '', textContent: '', dataset: {}, children: [],
    append(...nodes) { this.children.push(...nodes); },
    replaceChildren(...nodes) { this.children = nodes; },
    setAttribute(name, value) { if (name === 'aria-selected') this.dataset.ariaSelected = value; }
  };
}

function operationalHarness() {
  const panel = fakeNode(), source = fakeNode();
  const sectors = ['core', 'agents', 'tasks', 'system', 'knowledge', 'security', 'activity', 'routing'].map(id => ({ dataset: { vortexSector: id }, setAttribute(name: string, value: string) { if (name === 'aria-selected') this.dataset.ariaSelected = value; } }));
  const start = js.indexOf("const OPERATIONAL_OBSERVED_AT");
  const end = js.indexOf('// --- Tarjetas genéricas ---');
  assert.ok(start >= 0 && end > start, 'el bloque operacional debe ser evaluable de forma aislada');
  const context = {
    Set, Object, String, Array,
    el: (tag: string, className = '', content?: string) => { const node = fakeNode(); node.className = className; if (content !== undefined) node.textContent = content; return node; },
    document: { querySelector: (selector: string) => selector === '#operational-panel' ? panel : selector === '#operational-source' ? source : null, querySelectorAll: () => sectors },
  } as Record<string, unknown>;
  vm.runInNewContext(`${js.slice(start, end)};globalThis.__a3={OPERATIONAL_FIXTURES,OPERATIONAL_SECTORS,normalizeOperationalRecord,selectOperationalSector};`, context);
  return { ...context.__a3 as any, panel, source, sectors };
}

test('A.3 preserves the canonical Vortex and exposes eight contextual sectors', () => {
  assert.ok(html.includes('id="canonical-vortex"'));
  for (const sector of ['core', 'agents', 'tasks', 'system', 'knowledge', 'security', 'activity', 'routing']) assert.ok(html.includes(`data-vortex-sector="${sector}"`), sector);
  assert.ok(js.includes('selectOperationalSector'));
  assert.ok(js.includes("canonicalVortex.addEventListener('click',activateVortex)"));
  for (const layer of ['axis', 'helices', 'containment', 'orbits', 'satellite-nodes', 'major-orbs', 'particles', 'core-light']) assert.ok(html.includes(`vortex-layer-${layer}`), layer);
});

test('A.3 declares all UI contracts with deterministic source and freshness metadata', () => {
  for (const contract of ['AtlasStatus', 'AgentSummary', 'TaskSummary', 'SystemTelemetry', 'KnowledgeSummary', 'SecuritySummary', 'ActivityEvent', 'RoutingSummary']) assert.ok(js.includes(`contract:'${contract}'`), contract);
  for (const field of ["source:'MOCK'", "source:'SIMULATED'", "source:'UNAVAILABLE'", "freshness:'STALE'", "freshness:'UNAVAILABLE'", 'observedAt:']) assert.ok(js.includes(field), field);
  assert.ok(js.includes("atlasSinRed:true"));
  assert.ok(js.includes("realTrading:'BLOCKED'"));
});

test('A.3 renders operational sectors through the runtime interaction path', () => {
  const h = operationalHarness();
  h.selectOperationalSector('agents');
  assert.equal(h.source.textContent, 'MOCK · STALE');
  assert.equal(h.sectors.find((s: any) => s.dataset.vortexSector === 'agents').dataset.ariaSelected, 'true');
  assert.ok(h.panel.children.some((node: FakeNode) => node.children.some(child => child.textContent === 'AGENTS')));
  assert.ok(h.panel.children.some((node: FakeNode) => node.children.some(child => child.textContent === 'SIMULATED')));

  h.selectOperationalSector('tasks');
  const taskText = h.panel.children.flatMap((node: FakeNode) => node.children.map(child => child.textContent));
  for (const state of ['ACTIVE', 'PENDING', 'COMPLETED', 'FAILED']) assert.ok(taskText.includes(state), state);
});

test('A.3 renders Security and System as fixture-backed, informational data', () => {
  const h = operationalHarness();
  h.selectOperationalSector('security');
  assert.equal(h.source.textContent, 'MOCK · STALE');
  const securityText = h.panel.children.flatMap((node: FakeNode) => node.children.map(child => child.textContent));
  assert.ok(securityText.includes('L0'));
  assert.ok(securityText.includes('BLOCKED'));
  assert.equal(securityText.includes('VERIFIED'), false);

  h.selectOperationalSector('system');
  const systemText = h.panel.children.flatMap((node: FakeNode) => node.children.map(child => child.textContent));
  assert.ok(systemText.includes('MOCK'));
  assert.ok(systemText.includes('STALE'));
  h.selectOperationalSector('routing');
  assert.ok(h.panel.children.flatMap((node: FakeNode) => node.children.map(child => child.textContent)).includes('MOCK'));
});

test('A.3 adversarial truthfulness guard downgrades fabricated external states from mock fixtures', () => {
  const { normalizeOperationalRecord } = operationalHarness();
  const normalized = normalizeOperationalRecord({ source: 'MOCK', freshness: 'STALE', providerState: 'CONNECTED', verification: 'VERIFIED', network: 'ONLINE', backing: 'REAL' });
  assert.deepEqual(normalized, { source: 'MOCK', freshness: 'STALE', providerState: 'MOCK', verification: 'MOCK', network: 'MOCK', backing: 'MOCK' });
  assert.deepEqual(normalizeOperationalRecord({ source: 'SIMULATED', providerState: 'CONNECTED' }), { source: 'SIMULATED', providerState: 'SIMULATED' });
});

test('A.3 preserves read-only safety, accessibility, motion and responsive behavior', () => {
  assert.ok(html.includes('role="tablist"') && html.includes('role="tabpanel"'));
  assert.ok(js.includes("prefers-reduced-motion") && js.includes("visibilitychange"));
  assert.ok(css.includes('@media(max-width:560px)'));
  assert.equal(js.includes('eval('), false);
  assert.equal(/(?:child_process|sudo|\bpty\b|terminal)/i.test(js), false);
});

test('A.3 keeps the canonical dataset unchanged', () => {
  assert.equal(verifyDatasetHash(EURUSD_H1_BASELINE_CONFIG.csvPath, EURUSD_H1_BASELINE_CONFIG.expectedSHA256), true);
});

test('A.3 remains loopback-only and keeps the operational surface local', () => {
  const dashboard = () => ({ system: { estado: 'OK', version: 'test' }, vortice: {}, business: {}, simulations: {}, trading: { mt5Real: 'PENDIENTE' }, alerts: [], providers: {}, memory: {} }) as any;
  assert.throws(() => new AtlasLocalApi({ dashboard }, { host: '0.0.0.0', port: 0 }), /prohibido/i);
  assert.doesNotThrow(() => new AtlasLocalApi({ dashboard }, { host: '127.0.0.1', port: 0 }));
  assert.ok(js.includes('OPERATIONAL_FIXTURES'));
});
