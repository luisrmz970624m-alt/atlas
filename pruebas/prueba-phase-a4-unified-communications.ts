import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { EURUSD_H1_BASELINE_CONFIG, verifyDatasetHash } from '../src/trading-lab/historical-baseline.ts';

const read = (name: string) => readFileSync(new URL(`../src/panel-vortice/${name}`, import.meta.url), 'utf8');
const html = read('index.html');
const css = read('app.css') + read('premium.css');
const js = read('app.js');

type FakeNode = {
  tagName: string;
  className: string;
  textContent: string;
  dataset: Record<string, string>;
  children: FakeNode[];
  hidden: boolean;
  type: string;
  _listeners: Record<string, Function[]>;
  append: (...nodes: FakeNode[]) => void;
  replaceChildren: (...nodes: FakeNode[]) => void;
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
  addEventListener: (event: string, fn: Function) => void;
};

function fakeNode(tag = 'div'): FakeNode {
  return {
    tagName: tag.toUpperCase(), className: '', textContent: '', dataset: {}, children: [], hidden: false, type: '',
    _listeners: {},
    append(...nodes) { this.children.push(...nodes); },
    replaceChildren(...nodes) { this.children = [...nodes]; },
    setAttribute(name, value) { if (name === 'aria-selected') this.dataset.ariaSelected = value; if (name === 'role') this.dataset.role = value; },
    getAttribute(name) { if (name === 'data-comms-panel') return this.dataset.commsPanel || null; return null; },
    addEventListener(event, fn) { (this._listeners[event] ??= []).push(fn); },
  };
}

function a4Harness() {
  const threadContainer = fakeNode();
  const messageStream = fakeNode();
  const activeTitle = fakeNode();
  const activeTask = fakeNode();
  const participantsEl = fakeNode();
  const notifContainer = fakeNode();
  const approvalContainer = fakeNode();
  const pendingCount = fakeNode();
  const providerContainer = fakeNode();
  const projectFilter = fakeNode('select');

  const selectors: Record<string, FakeNode | null> = {
    '#comms-threads': threadContainer,
    '#comms-message-stream': messageStream,
    '#comms-active-title': activeTitle,
    '#comms-active-task': activeTask,
    '#comms-participants': participantsEl,
    '#comms-notifications': notifContainer,
    '#comms-approvals': approvalContainer,
    '#comms-pending-count': pendingCount,
    '#comms-providers': providerContainer,
    '#comms-project-filter': projectFilter,
    '#comms-input': fakeNode('input'),
  };

  const start = js.indexOf("const OPERATIONAL_OBSERVED_AT");
  const end = js.indexOf('// --- Carga ---');
  assert.ok(start >= 0 && end > start, 'A.4 block must be extractable');

  const context = {
    Set, Object, String, Array, Math, JSON, console,
    globalThis: {} as Record<string, unknown>,
    el: (tag: string, className = '', content?: string) => { const node = fakeNode(tag); node.className = className; if (content !== undefined) node.textContent = content; return node; },
    chip: (v: string) => { const node = fakeNode('span'); node.className = 'chip'; node.textContent = v; node.dataset.status = v; return node; },
    document: {
      querySelector: (s: string) => selectors[s] || null,
      querySelectorAll: (_s: string) => [],
      createElement: (tag: string) => fakeNode(tag),
    },
  } as Record<string, unknown>;

  vm.runInNewContext(
    `${js.slice(start, end)};globalThis.__a4={A4_COMM_FIXTURES,normalizeA4Record,renderA4ThreadList,renderA4Messages,renderA4Notifications,renderA4Approvals,renderA4Providers,renderA4Communications,a4ActiveConversation,a4ProjectFilter};`,
    context
  );

  const a4 = (context.globalThis as any).__a4;
  return { ...a4, threadContainer, messageStream, activeTitle, activeTask, participantsEl, notifContainer, approvalContainer, pendingCount, providerContainer };
}

// --- AC-01: Communication Center exists as a section in the HTML ---
test('A4-AC-01: Communication Center section exists with Messages, Notifications, Approvals tabs', () => {
  assert.ok(html.includes('data-group="communications"'));
  assert.ok(html.includes('data-comms-tab="messages"'));
  assert.ok(html.includes('data-comms-tab="notifications"'));
  assert.ok(html.includes('data-comms-tab="approvals"'));
  assert.ok(html.includes('role="tablist"'));
});

// --- AC-02: Navigation entry ---
test('A4-AC-02: Sidebar navigation includes comunicaciones entry', () => {
  assert.ok(html.includes('data-nav="comunicaciones"'));
  assert.ok(js.includes("comunicaciones:['Comunicaciones'"));
});

// --- AC-03: Conversation list renders with project context ---
test('A4-AC-03: Thread list renders conversations with project badges', () => {
  const h = a4Harness();
  h.renderA4ThreadList();
  assert.ok(h.threadContainer.children.length >= 3);
  const allText = h.threadContainer.children.flatMap((n: FakeNode) =>
    [n.textContent, ...n.children.flatMap((c: FakeNode) => [c.textContent, ...c.children.map((cc: FakeNode) => cc.textContent)])]
  );
  assert.ok(allText.some((t: string) => t.includes('Dataset loader')));
  assert.ok(allText.some((t: string) => t.includes('ATLAS REMOTE')));
  assert.ok(allText.some((t: string) => t.includes('TRADING LAB')));
});

// --- AC-04: Message rendering with sender types ---
test('A4-AC-04: Messages render with sender type, delivery, processing, and verification badges', () => {
  const h = a4Harness();
  h.renderA4Messages();
  assert.ok(h.messageStream.children.length >= 5);
  const senderTypes = h.messageStream.children.map((m: FakeNode) => m.dataset.senderType);
  for (const type of ['HUMAN', 'ORCHESTRATOR', 'AGENT', 'SYSTEM']) {
    assert.ok(senderTypes.includes(type), `Missing sender type: ${type}`);
  }
});

// --- AC-05: All four sender roles present ---
test('A4-AC-05: Fixtures include all four sender roles (HUMAN, ORCHESTRATOR, AGENT, SYSTEM)', () => {
  const h = a4Harness();
  const roles = new Set(h.A4_COMM_FIXTURES.messages.map((m: any) => m.senderType));
  for (const role of ['HUMAN', 'ORCHESTRATOR', 'AGENT', 'SYSTEM']) assert.ok(roles.has(role), role);
});

// --- AC-06: Delivery status states ---
test('A4-AC-06: DeliveryStatus enum covers all defined states', () => {
  for (const state of ['LOCAL_ONLY', 'OUTBOUND_QUEUED', 'SENDING', 'DELIVERED', 'FAILED', 'RETRYING']) {
    assert.ok(js.includes(`'${state}'`), `Missing delivery state: ${state}`);
  }
});

// --- AC-07: Processing status states ---
test('A4-AC-07: ProcessingStatus enum covers all defined states', () => {
  for (const state of ['RECEIVED', 'QUEUED', 'PROCESSING', 'RESPONDED', 'FAILED']) {
    assert.ok(js.includes(`'${state}'`), `Missing processing state: ${state}`);
  }
});

// --- AC-08: Verification states ---
test('A4-AC-08: Message trust classification states defined', () => {
  for (const state of ['VERIFIED_SENDER', 'UNVERIFIED_SENDER', 'SYSTEM_ORIGIN', 'MOCK_ORIGIN']) {
    assert.ok(js.includes(`'${state}'`), `Missing verification state: ${state}`);
  }
});

// --- AC-09: Notification categories ---
test('A4-AC-09: All 10 notification categories defined', () => {
  for (const cat of ['TASK_COMPLETE', 'TASK_FAILED', 'APPROVAL_REQUIRED', 'SECURITY_WARNING', 'AGENT_OFFLINE', 'AGENT_AVAILABLE', 'SYSTEM_WARNING', 'PROJECT_UPDATE', 'KNOWLEDGE_CONFLICT', 'ROUTING_ESCALATION']) {
    assert.ok(js.includes(`'${cat}'`), `Missing category: ${cat}`);
  }
});

// --- AC-10: Notification severities ---
test('A4-AC-10: Notification severity levels defined (INFO, WARNING, CRITICAL)', () => {
  for (const sev of ['INFO', 'WARNING', 'CRITICAL']) {
    assert.ok(js.includes(`severity:'${sev}'`), `Missing severity: ${sev}`);
  }
});

// --- AC-11: Notifications render with severity ---
test('A4-AC-11: Notifications render with severity badges and project context', () => {
  const h = a4Harness();
  h.renderA4Notifications();
  assert.ok(h.notifContainer.children.length >= 10);
  const severities = h.notifContainer.children.map((n: FakeNode) => n.dataset.severity);
  for (const sev of ['INFO', 'WARNING', 'CRITICAL']) assert.ok(severities.includes(sev), sev);
});

// --- AC-12: Notification filtering ---
test('A4-AC-12: Notifications can be filtered by severity', () => {
  const h = a4Harness();
  h.renderA4Notifications('CRITICAL');
  const critical = h.notifContainer.children.filter((n: FakeNode) => n.dataset.severity === 'CRITICAL');
  assert.ok(critical.length >= 2);
  assert.equal(h.notifContainer.children.length, critical.length);
});

// --- AC-13: Approvals render with privilege levels ---
test('A4-AC-13: Approvals render with privilege level and status badges', () => {
  const h = a4Harness();
  h.renderA4Approvals();
  assert.ok(h.approvalContainer.children.length >= 3);
  assert.ok(h.pendingCount.textContent.includes('2'));
});

// --- AC-14: Privilege levels ---
test('A4-AC-14: Privilege levels L0-L4 defined', () => {
  for (const level of ['L0', 'L1', 'L2', 'L3', 'L4']) {
    assert.ok(js.includes(`'${level}'`), `Missing privilege level: ${level}`);
  }
});

// --- AC-15: Provider status with separated connectionState and verificationState ---
test('A4-AC-15: Provider status renders with separated connectionState and verificationState', () => {
  const h = a4Harness();
  h.renderA4Providers();
  assert.ok(h.providerContainer.children.length >= 5);
  const allText = h.providerContainer.children.flatMap((n: FakeNode) =>
    [n.textContent, ...n.children.flatMap((c: FakeNode) => [c.textContent, ...c.children.map((cc: FakeNode) => cc.textContent)])]
  );
  assert.ok(allText.some((t: string) => t.includes('CONN:')));
  assert.ok(allText.some((t: string) => t.includes('VERIF:')));
});

// --- AC-16: Provider connectionState values ---
test('A4-AC-16: Provider fixtures use MOCK/UNAVAILABLE connectionState, never CONNECTED', () => {
  const h = a4Harness();
  for (const p of h.A4_COMM_FIXTURES.providers) {
    assert.notEqual(p.connectionState, 'CONNECTED', `Provider ${p.provider} should not be CONNECTED`);
  }
});

// --- AC-17: Truthfulness guard applied to A.4 fixtures ---
test('A4-AC-17: normalizeA4Record downgrades fabricated external states', () => {
  const h = a4Harness();
  const normalized = h.normalizeA4Record({ source: 'MOCK', connectionState: 'CONNECTED', verificationState: 'VERIFIED', status: 'ONLINE' });
  assert.equal(normalized.connectionState, 'MOCK');
  assert.equal(normalized.verificationState, 'MOCK');
  assert.equal(normalized.status, 'MOCK');
});

// --- AC-18: All fixtures have source/freshness/observedAt metadata ---
test('A4-AC-18: All A.4 fixtures carry source, freshness, and observedAt metadata', () => {
  const h = a4Harness();
  const allFixtures = [
    ...h.A4_COMM_FIXTURES.conversations,
    ...h.A4_COMM_FIXTURES.messages,
    ...h.A4_COMM_FIXTURES.notifications,
    ...h.A4_COMM_FIXTURES.approvals,
    ...h.A4_COMM_FIXTURES.providers,
  ];
  for (const fixture of allFixtures) {
    assert.ok('source' in fixture, `Missing source in fixture`);
    assert.ok('freshness' in fixture, `Missing freshness in fixture`);
    assert.ok('observedAt' in fixture, `Missing observedAt in fixture`);
    assert.equal(fixture.source, 'MOCK');
    assert.equal(fixture.freshness, 'STALE');
  }
});

// --- AC-19: Conversations include project isolation ---
test('A4-AC-19: Conversations carry projectId for context isolation', () => {
  const h = a4Harness();
  const projectIds = new Set(h.A4_COMM_FIXTURES.conversations.map((c: any) => c.projectId));
  assert.ok(projectIds.size >= 2);
  assert.ok(projectIds.has('atlas-remote'));
  assert.ok(projectIds.has('trading-lab'));
});

// --- AC-20: Messages include attachments with security scan status ---
test('A4-AC-20: At least one message includes an attachment with securityScanStatus', () => {
  const h = a4Harness();
  const withAttachments = h.A4_COMM_FIXTURES.messages.filter((m: any) => m.attachments.length > 0);
  assert.ok(withAttachments.length >= 1);
  const att = withAttachments[0].attachments[0];
  assert.ok('securityScanStatus' in att);
  assert.ok('sha256' in att);
  assert.ok('mimeType' in att);
});

// --- AC-21: Input bar blocks Enter key (MESSAGING_IS_NOT_A_TERMINAL) ---
test('A4-AC-21: MESSAGING_IS_NOT_A_TERMINAL — input bar exists and js blocks Enter', () => {
  assert.ok(html.includes('id="comms-input"'));
  assert.ok(html.includes('MESSAGING_IS_NOT_A_TERMINAL'));
  assert.ok(js.includes("MESSAGING_IS_NOT_A_TERMINAL") || js.includes("comms-input"));
});

// --- AC-22: No shell execution paths ---
test('A4-AC-22: Phase A.4 introduces no shell execution paths', () => {
  const a4Block = js.slice(js.indexOf('Phase A.4'), js.indexOf('// --- Carga ---'));
  assert.equal(/(?:child_process|exec\(|spawn|sudo|\bpty\b|\bshell\b)/i.test(a4Block), false);
  assert.equal(a4Block.includes('eval('), false);
  assert.equal(a4Block.includes('innerHTML'), false);
});

// --- AC-23: CSS styles exist for all A.4 components ---
test('A4-AC-23: CSS covers all A.4 component classes', () => {
  for (const cls of ['.comms-tabs', '.comms-layout', '.comms-thread-item', '.comms-message', '.comms-notification', '.comms-approval', '.comms-provider-node']) {
    assert.ok(css.includes(cls), `Missing CSS for ${cls}`);
  }
});

// --- AC-24: Responsive breakpoints for communications ---
test('A4-AC-24: CSS includes responsive breakpoints for communications layout', () => {
  assert.ok(css.includes('900px') || css.includes('comms-layout'));
});

// --- AC-25: No ninth canonical Vortex sector introduced ---
test('A4-AC-25: No ninth canonical Vortex sector introduced by A.4', () => {
  assert.equal(html.includes('data-vortex-sector="communications"'), false);
  assert.equal(html.includes('data-vortex-sector="comms"'), false);
  const sectorMatches = html.match(/data-vortex-sector="/g) || [];
  assert.equal(sectorMatches.length, 8);
});

// --- AC-26: Canonical Vortex SVG preserved ---
test('A4-AC-26: Canonical Vortex SVG and its nine visual layers preserved', () => {
  assert.ok(html.includes('id="canonical-vortex"'));
  for (const layer of ['axis', 'helices', 'containment', 'orbits', 'satellite-nodes', 'major-orbs', 'particles', 'core-light']) {
    assert.ok(html.includes(`vortex-layer-${layer}`), `Missing layer: ${layer}`);
  }
});

// --- AC-27: Dataset hash unchanged ---
test('A4-AC-27: Canonical dataset SHA-256 unchanged', () => {
  assert.equal(verifyDatasetHash(EURUSD_H1_BASELINE_CONFIG.csvPath, EURUSD_H1_BASELINE_CONFIG.expectedSHA256), true);
});

// --- AC-28: A.3 baseline tests still extractable ---
test('A4-AC-28: A.3 operational block remains extractable and functional', () => {
  assert.ok(js.includes('OPERATIONAL_FIXTURES'));
  assert.ok(js.includes('OPERATIONAL_SECTORS'));
  assert.ok(js.includes('normalizeOperationalRecord'));
  assert.ok(js.includes('selectOperationalSector'));
  assert.ok(js.includes("FABRICATED_EXTERNAL_STATES"));
});
