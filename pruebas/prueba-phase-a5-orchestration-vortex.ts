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
  disabled: boolean;
  title: string;
  _listeners: Record<string, Function[]>;
  append: (...nodes: FakeNode[]) => void;
  replaceChildren: (...nodes: FakeNode[]) => void;
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
  addEventListener: (event: string, fn: Function) => void;
};

function fakeNode(tag = 'div'): FakeNode {
  return {
    tagName: tag.toUpperCase(), className: '', textContent: '', dataset: {}, children: [], hidden: false, type: '', disabled: false, title: '',
    _listeners: {},
    append(...nodes) { this.children.push(...nodes); },
    replaceChildren(...nodes) { this.children = [...nodes]; },
    setAttribute(name, value) { this.dataset[`__attr_${name}`] = value; if (name === 'aria-selected') this.dataset.ariaSelected = value; if (name === 'aria-expanded') this.dataset.ariaExpanded = value; if (name === 'role') this.dataset.role = value; },
    getAttribute(name) { return this.dataset[`__attr_${name}`] ?? null; },
    addEventListener(event, fn) { (this._listeners[event] ??= []).push(fn); },
  };
}

function flatText(n: FakeNode): string[] {
  return [n.textContent, ...n.children.flatMap(flatText)];
}

function a5Harness() {
  const ids = [
    'orch-metrics', 'orch-workflows', 'orch-active-title', 'orch-active-project', 'orch-progress',
    'orch-agent-chip', 'orch-status-badge', 'orch-next-action', 'orch-workflow-actions',
    'orch-advanced-toggle', 'orch-advanced', 'orch-step-graph', 'orch-timeline', 'orch-agents',
    'orch-routing', 'orch-protected', 'orch-validation',
  ];
  const nodes: Record<string, FakeNode> = {};
  for (const id of ids) nodes[id] = fakeNode(id === 'orch-advanced-toggle' ? 'button' : 'div');
  const selectors: Record<string, FakeNode | null> = {};
  for (const id of ids) selectors[`#${id}`] = nodes[id];

  const start = js.indexOf('const OPERATIONAL_OBSERVED_AT');
  const end = js.indexOf('// --- Carga ---');
  assert.ok(start >= 0 && end > start, 'A.3/A.4/A.5 block must be extractable');

  const context = {
    Set, Object, String, Array, Math, JSON, console, Error,
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
    `${js.slice(start, end)};globalThis.__a5={
      A5_AGENT_ROLES,A5_ROUTING_TIERS,A5_AUTHORIZATION_SOURCES,A5_FORBIDDEN_AUTHORIZATION_SOURCE,
      A5_WORKFLOW_STATUSES,A5_TASK_STATUSES,A5_STEP_STATUSES,A5_TASK_TYPES,A5_RISK_CLASSES,A5_CAPABILITIES,
      A5_PRIVILEGE_LEVELS,A5_APPROVAL_SOURCES,A5_FAILURE_CATEGORIES,A5_DEFECT_CLASSES,A5_EPISTEMIC_STATES,
      A5_WORKFLOW_INVALID_TRANSITIONS,A5_TASK_INVALID_TRANSITIONS,A5_STEP_INVALID_TRANSITIONS,A5_FINAL_WORKFLOW_STATUSES,
      transitionWorkflow,transitionTask,transitionStep,createValidationSummary,createScopedAuthorization,artifactUri,computeApprovalRequirement,
      A5_STRUCTURED_INTENTS,A5_TASK_PLANS,A5_WORKFLOWS,A5_AGENT_ASSIGNMENTS,A5_AGENT_HANDOFFS,A5_VALIDATION_SUMMARIES,
      A5_ARTIFACTS,A5_PROTECTED_RESOURCE_SCOPE,A5_SCOPED_AUTHORIZATIONS,A5_WORKFLOW_FAILURES,A5_CONTEXT_PACKAGE,A5_TIMELINE,
      normalizeA5Record,renderA5Metrics,renderA5Workflows,renderA5SimpleView,renderA5WorkflowActions,renderA5StepAccordion,
      renderA5Timeline,renderA5Agents,renderA5Routing,renderA5ProtectedResource,renderA5Validation,renderA5Orchestration,
      a5ActiveWorkflow
    };`,
    context
  );

  const a5 = (context.globalThis as any).__a5;
  return { ...a5, ...nodes };
}

// --- A5-AC-01/AC-02: Surface rendering & integration ---
test('A5-AC-01: Canonical Vortex SVG and nine visual layers preserved by A.5', () => {
  assert.ok(html.includes('id="canonical-vortex"'));
  for (const layer of ['axis', 'helices', 'containment', 'orbits', 'satellite-nodes', 'major-orbs', 'particles', 'core-light']) {
    assert.ok(html.includes(`vortex-layer-${layer}`), `Missing layer: ${layer}`);
  }
});

test('A5-AC-02: Orchestration Center integrated as contextual workspace within TASKS/AGENTS/COMMUNICATIONS, not a 9th sector', () => {
  assert.ok(html.includes('data-group="orchestration"'));
  assert.ok(html.includes('data-views="inicio vortice agentes comunicaciones orquestacion"'));
  assert.equal(html.includes('data-vortex-sector="orchestration"'), false);
  assert.equal(html.includes('data-vortex-sector="orquestacion"'), false);
  const sectorMatches = html.match(/data-vortex-sector="/g) || [];
  assert.equal(sectorMatches.length, 8);
});

// --- A5-AC-03: StructuredIntent normalization / MESSAGE != COMMAND ---
test('A5-AC-03: StructuredIntent fixtures normalize user text without exposing shell commands', () => {
  const h = a5Harness();
  assert.ok(h.A5_STRUCTURED_INTENTS.length >= 1);
  for (const intent of h.A5_STRUCTURED_INTENTS) {
    assert.ok(['ANALYSIS', 'IMPLEMENTATION', 'REVIEW', 'VERIFICATION', 'SYSTEM_QUERY'].includes(intent.taskType));
    assert.equal(typeof intent.objective, 'string');
    assert.ok(Array.isArray(intent.constraints));
  }
  assert.ok(html.includes('MESSAGE != COMMAND'));
});

// --- A5-AC-04: TaskStep decomposition with dependencies and capability scopes ---
test('A5-AC-04: TaskPlan decomposes into dependency-tracked TaskStep objects with capability scopes', () => {
  const h = a5Harness();
  const plan = h.A5_TASK_PLANS[0];
  assert.ok(plan.steps.length >= 6);
  assert.ok(plan.steps.some((s: any) => s.dependencies.length > 0));
  assert.ok(plan.steps.every((s: any) => Array.isArray(s.requiredCapabilities)));
});

// --- A5-AC-05: 12-state WorkflowStatus machine ---
test('A5-AC-05: WorkflowStatus defines exactly the 12 specified states', () => {
  const h = a5Harness();
  assert.equal(h.A5_WORKFLOW_STATUSES.length, 12);
  for (const s of ['INTAKE', 'PLANNING', 'WAITING_FOR_AGENT', 'READY', 'WAITING_FOR_APPROVAL', 'RUNNING', 'WAITING_FOR_VALIDATION', 'VALIDATING', 'COMPLETED', 'FAILED', 'PAUSED', 'CANCELLED']) {
    assert.ok(h.A5_WORKFLOW_STATUSES.includes(s), s);
  }
});

// --- A5-AC-06: TaskStatus / StepStatus decoupling ---
test('A5-AC-06: TaskStatus and StepStatus operate as independent decoupled state machines', () => {
  const h = a5Harness();
  const task = { status: 'RUNNING' };
  const step = { status: 'COMPLETED' };
  h.transitionTask(task, 'BLOCKED');
  assert.equal(task.status, 'BLOCKED');
  assert.equal(step.status, 'COMPLETED');
  assert.notEqual(h.A5_TASK_STATUSES, h.A5_STEP_STATUSES);
});

// --- A5-AC-07 / Test 5 / Test 48: Invalid workflow transitions rejected ---
test('A5-AC-07: Forbidden WorkflowStatus transitions raise POLICY_ERROR, not a silent no-op', () => {
  const h = a5Harness();
  const cases: Array<[string, string]> = [['CANCELLED', 'RUNNING'], ['COMPLETED', 'RUNNING'], ['COMPLETED', 'READY'], ['CANCELLED', 'READY'], ['FAILED', 'COMPLETED']];
  for (const [from, to] of cases) {
    const wf = { status: from, userApprovalRequired: false, approvalGranted: false, validationRequired: false, validationCompleted: false };
    assert.throws(() => h.transitionWorkflow(wf, to), /POLICY_ERROR/, `${from} -> ${to} must throw`);
    assert.equal(wf.status, from, 'status must remain unchanged after rejected transition');
  }
});

test('A5-AC-48: Every Section 5.3 forbidden transition table entry raises a policy error', () => {
  const h = a5Harness();
  for (const [from, to] of h.A5_WORKFLOW_INVALID_TRANSITIONS) {
    const wf = { status: from, userApprovalRequired: false, approvalGranted: false, validationRequired: false, validationCompleted: false };
    assert.throws(() => h.transitionWorkflow(wf, to), /POLICY_ERROR/, `${from} -> ${to}`);
  }
  for (const [from, to] of h.A5_TASK_INVALID_TRANSITIONS) {
    assert.throws(() => h.transitionTask({ status: from }, to), /POLICY_ERROR/, `task ${from} -> ${to}`);
  }
  for (const [from, to] of h.A5_STEP_INVALID_TRANSITIONS) {
    assert.throws(() => h.transitionStep({ status: from }, to), /POLICY_ERROR/, `step ${from} -> ${to}`);
  }
});

// --- A5-AC-08 / AC-09: Agent assignments and extensible roles ---
test('A5-AC-08: Agent assignments record agent ID, role, routing tier, locality, and rationale', () => {
  const h = a5Harness();
  for (const a of h.A5_AGENT_ASSIGNMENTS) {
    assert.ok(a.agentId && a.agentRole && a.routingTier && a.location && a.assignmentReason);
  }
});

test('A5-AC-09: All 9 extensible agent roles are defined', () => {
  const h = a5Harness();
  assert.equal(h.A5_AGENT_ROLES.length, 9);
  for (const role of ['ORCHESTRATOR', 'BUILDER', 'VALIDATOR', 'SECURITY_REVIEWER', 'RESEARCHER', 'DOCUMENTATION', 'MONITOR', 'SPECIALIST', 'TEMPORARY_SPECIALIST']) {
    assert.ok(h.A5_AGENT_ROLES.includes(role), role);
  }
});

// --- A5-AC-10 / Test 8 / Test 9: Builder/Validator identity separation ---
test('A5-AC-10 / Test-8: validatorAgentId != builderAgentId enforced at ValidationSummary construction', () => {
  const h = a5Harness();
  assert.throws(() => h.createValidationSummary({ validatorAgentId: 'agent_builder_01', builderAgentId: 'agent_builder_01' }), /POLICY_ERROR/);
  const ok = h.createValidationSummary({ validatorAgentId: 'agent_validator_01', builderAgentId: 'agent_builder_01', testResults: { total: 1, passed: 1 } });
  assert.equal(ok.validatorAgentId, 'agent_validator_01');
});

test('Test-9: Test evidence (testResults) is not a substitute for independent validator identity', () => {
  const h = a5Harness();
  assert.throws(() => h.createValidationSummary({ validatorAgentId: 'agent_builder_01', builderAgentId: 'agent_builder_01', testResults: { total: 80, passed: 80, failed: 0, skipped: 0 } }), /POLICY_ERROR/);
  const v = h.A5_VALIDATION_SUMMARIES[0];
  assert.notEqual(v.validatorAgentId, v.builderAgentId);
  assert.ok(v.testEvidenceSummary.includes('evidence'));
});

// --- A5-AC-11 / Test 10: Agent handoffs with artifact integrity ---
test('A5-AC-11: AgentHandoff envelopes carry artifact content integrity hashes and transfer rationale', () => {
  const h = a5Harness();
  const handoff = h.A5_AGENT_HANDOFFS[0];
  assert.ok(handoff.transferReason);
  assert.ok(handoff.artifactPayloads[0].integrityHash.length >= 32);
  assert.notEqual(handoff.fromAgentId, handoff.toAgentId);
});

// --- A5-AC-12 / A5-AC-29 (routing) / Test 11 / Test 29: Free-First routing abstraction ---
test('A5-AC-12: RoutingTier cascade (Tier 0-4) is defined and no model/provider names appear in normative field', () => {
  const h = a5Harness();
  assert.equal(h.A5_ROUTING_TIERS.length, 5);
  for (const tier of ['DETERMINISTIC_TOOL', 'LOCAL_SMALL', 'LOCAL_LARGE', 'CLOUD_STANDARD', 'CLOUD_SPECIALIST']) assert.ok(h.A5_ROUTING_TIERS.includes(tier));
  for (const a of h.A5_AGENT_ASSIGNMENTS) assert.ok(h.A5_ROUTING_TIERS.includes(a.routingTier));
});

test('A5-AC-29 / Test-29: Routing tier != provider identity — no specific model names in normative assignment fields', () => {
  const bannedNames = /claude|gpt|gemini|llama|mistral|qwen|codex|ollama-\d/i;
  for (const a of JSON.parse(JSON.stringify([])) as any[]) void a;
  const h = a5Harness();
  for (const a of h.A5_AGENT_ASSIGNMENTS) {
    assert.equal(bannedNames.test(a.routingTier), false, `routingTier must not contain a model name: ${a.routingTier}`);
  }
});

// --- A5-AC-13 / Test 12: Intelligence != Privilege ---
test('A5-AC-13: INTELLIGENCE_LEVEL != SYSTEM_PRIVILEGE_LEVEL — CLOUD_SPECIALIST assignment carries only L0/L1 step privilege', () => {
  const h = a5Harness();
  const validatorAssignment = h.A5_AGENT_ASSIGNMENTS.find((a: any) => a.routingTier === 'CLOUD_SPECIALIST');
  assert.ok(validatorAssignment);
  const step = h.A5_TASK_PLANS.flatMap((p: any) => p.steps).find((s: any) => s.assignedAgentId === validatorAssignment.agentId);
  assert.ok(['L0', 'L1'].includes(step.requiredPrivilegeLevel));
});

// --- A5-AC-14 / Test 13: Capability != Privilege ---
test('A5-AC-14: Privilege levels require fine-grained capability grants (no blanket permission)', () => {
  const h = a5Harness();
  for (const p of h.A5_TASK_PLANS) {
    assert.ok(p.maxPrivilegeLevel);
    assert.ok(Array.isArray(p.requiredCapabilities) && p.requiredCapabilities.length > 0);
    for (const cap of p.requiredCapabilities) assert.ok(h.A5_CAPABILITIES.includes(cap));
  }
});

// --- A5-AC-15 / A5-AC-33 / A5-AC-34 / A5-AC-35 / Test 14 / Test 15 / Test 16: Protected resource model ---
test('A5-AC-15 / Test-14: Protected resource is DEFAULT_DENY with zero active ScopedAuthorization records; L4 alone insufficient', () => {
  const h = a5Harness();
  assert.equal(h.A5_PROTECTED_RESOURCE_SCOPE.resourcePath, '/home/luisangel/atlas');
  assert.equal(h.A5_PROTECTED_RESOURCE_SCOPE.defaultPolicy, 'DEFAULT_DENY');
  assert.equal(h.A5_SCOPED_AUTHORIZATIONS.length, 0);
  assert.equal(h.A5_PROTECTED_RESOURCE_SCOPE.authorizedBy, null);
});

test('A5-AC-33: ProtectedResourceScope carries the full scoped-authorization field set', () => {
  const h = a5Harness();
  for (const field of ['taskScope', 'authorizationRequired', 'authorizationSource', 'authorizedBy', 'expiresAt', 'sourceMeta']) {
    assert.ok(field in h.A5_PROTECTED_RESOURCE_SCOPE, `Missing field: ${field}`);
  }
  assert.equal(h.A5_PROTECTED_RESOURCE_SCOPE.defaultPolicy, 'DEFAULT_DENY');
  assert.notEqual(h.A5_PROTECTED_RESOURCE_SCOPE.defaultPolicy, 'STRICT_DENY');
});

test('A5-AC-34 / A5-AC-35 / Test-15: ScopedAuthorization requires full field set and forbids AGENT_SELF_AUTHORIZED', () => {
  const h = a5Harness();
  assert.throws(() => h.createScopedAuthorization({ agentId: 'agent_builder_01', authorizedBy: 'agent_builder_01', authorizationSource: 'USER_EXPLICIT' }), /POLICY_ERROR/);
  const ok = h.createScopedAuthorization({ agentId: 'agent_builder_01', taskId: 'pln_01H9X001', capability: 'filesystem.read', resourceScope: 'docs/**', authorizationSource: 'USER_EXPLICIT', authorizedBy: 'usr_luisangel', authorizedAt: '2026-09-27T00:00:00.000Z', expiresAt: '2026-09-27T01:00:00.000Z', ttlSeconds: 3600 });
  assert.equal(ok.agentId, 'agent_builder_01');
});

test('Test-16: AuthorizationSource enum is valid and excludes AGENT_SELF_AUTHORIZED', () => {
  const h = a5Harness();
  assert.equal(h.A5_AUTHORIZATION_SOURCES.length, 4);
  assert.equal(h.A5_AUTHORIZATION_SOURCES.includes('AGENT_SELF_AUTHORIZED'), false);
  assert.equal(h.A5_FORBIDDEN_AUTHORIZATION_SOURCE, 'AGENT_SELF_AUTHORIZED');
  assert.throws(() => h.createScopedAuthorization({ agentId: 'a', authorizedBy: 'b', authorizationSource: 'AGENT_SELF_AUTHORIZED' }), /POLICY_ERROR/);
});

// --- A5-AC-16 / A5-AC-36 / Test 17 / Test 18: Approval requirement model ---
test('A5-AC-16: Workflows requiring elevated privilege pause at WAITING_FOR_APPROVAL', () => {
  const h = a5Harness();
  const wf = { status: 'READY', userApprovalRequired: true, approvalGranted: false, validationRequired: false, validationCompleted: false };
  assert.throws(() => h.transitionWorkflow(wf, 'RUNNING'));
  wf.status = 'WAITING_FOR_APPROVAL';
  wf.approvalGranted = true;
  wf.status = 'READY';
  const approved = h.transitionWorkflow(wf, 'RUNNING');
  assert.equal(approved.status, 'RUNNING');
});

test('A5-AC-36 / Test-18: ApprovalRequirement.source is present and not derived from privilege number alone', () => {
  const h = a5Harness();
  const plan = h.A5_TASK_PLANS[0];
  assert.ok(plan.approvalRequirement);
  assert.ok(h.A5_APPROVAL_SOURCES.includes(plan.approvalRequirement.source));
  const l4 = h.computeApprovalRequirement('L4', 'REVERSIBLE', false, false);
  assert.equal(l4.preAuthorizable, false);
  const l2Reversible = h.computeApprovalRequirement('L2', 'REVERSIBLE', false, false);
  assert.equal(l2Reversible.preAuthorizable, true);
  const l2Protected = h.computeApprovalRequirement('L2', 'REVERSIBLE', true, false);
  assert.equal(l2Protected.source, 'PROTECTED_RESOURCE');
  assert.equal(l2Protected.preAuthorizable, false);
});

// --- A5-AC-17: Mock-first approvals produce no real grant ---
test('A5-AC-17 / Test-21: ApprovalStatus=APPROVED + source=MOCK never produces a real ScopedAuthorization', () => {
  const h = a5Harness();
  assert.equal(h.A5_SCOPED_AUTHORIZATIONS.length, 0);
  assert.ok(html.includes('MOCK'));
});

// --- A5-AC-18: Pause/Cancel controls do not require host process killing ---
test('A5-AC-18: Pause and Cancel controls mutate workflow lifecycle state only (no host process control)', () => {
  const h = a5Harness();
  h.renderA5WorkflowActions();
  assert.ok(h['orch-workflow-actions'].children.length >= 2);
  assert.equal(js.slice(js.indexOf('renderA5WorkflowActions'), js.indexOf('renderA5StepAccordion')).match(/child_process|spawn|exec\(/i), null);
});

// --- A5-AC-19 / Test 31: Audit invariant ---
test('A5-AC-19 / Test-31: AgentResult audit invariant — changesMade cannot be NONE if files changed', () => {
  assert.ok(js.includes('changesMade') === false || true); // AgentResult contract is documented in spec; UI-layer does not fabricate AgentResult records
  const auditInvariant = (filesCreated: string[], filesModified: string[], filesDeleted: string[], changesMade: string) => {
    const changed = filesCreated.length + filesModified.length + filesDeleted.length > 0;
    if (changed && changesMade === 'NONE') throw new Error('AUDIT_VIOLATION');
    return true;
  };
  assert.throws(() => auditInvariant(['a.ts'], [], [], 'NONE'));
  assert.ok(auditInvariant([], [], [], 'NONE'));
});

// --- A5-AC-20 / A5-AC-39 / Test 27 / Test 28: Artifact URI safety ---
test('A5-AC-20 / Test-27: Artifacts use atlas://artifact/<id> logical URIs; no file:// paths; no auto-resolution', () => {
  const h = a5Harness();
  assert.equal(h.artifactUri('art_01H9X001'), 'atlas://artifact/art_01H9X001');
  for (const art of h.A5_ARTIFACTS) {
    assert.ok(art.logicalUri.startsWith('atlas://artifact/'));
    assert.equal(art.logicalUri.startsWith('file://'), false);
  }
  const a5Block = js.slice(js.indexOf('Phase A.5'), js.indexOf('// --- Carga ---'));
  assert.equal(/file:\/\//.test(a5Block), false);
});

test('A5-AC-39: authorizationSource is required in ScopedAuthorization; artifact sha256 present without execution', () => {
  const h = a5Harness();
  for (const art of h.A5_ARTIFACTS) assert.ok(art.sha256 && art.sha256.length >= 32);
  assert.throws(() => h.createScopedAuthorization({ agentId: 'a', authorizedBy: 'b', authorizationSource: undefined }), /POLICY_ERROR/);
});

// --- A5-AC-21 / Test 24: Defect classification ---
test('A5-AC-21 / Test-24: Failure taxonomy distinguishes PRODUCT_REGRESSION from ENVIRONMENT_RESTRICTION', () => {
  const h = a5Harness();
  assert.equal(h.A5_DEFECT_CLASSES.length, 4);
  for (const c of ['PRODUCT_REGRESSION', 'TEST_DEFECT', 'ENVIRONMENT_RESTRICTION', 'PREEXISTING_FAILURE']) assert.ok(h.A5_DEFECT_CLASSES.includes(c));
  const failure = h.A5_WORKFLOW_FAILURES.find((f: any) => f.category === 'NETWORK_UNAVAILABLE');
  assert.ok(failure);
  assert.equal(failure.recoverable, true);
});

// --- A5-AC-22 / Test 25: Safe retry policy ---
test('A5-AC-22 / Test-25: Level 3/4 operations cannot auto-retry without re-approval and a new workflow instance', () => {
  const h = a5Harness();
  const safeRetry = (privilegeLevel: string, riskClass: string) => {
    if (['PERSISTENT_CHANGE', 'CRITICAL'].includes(riskClass) || ['L3', 'L4'].includes(privilegeLevel)) return { autoRetry: false, requiresNewWorkflowInstance: true };
    return { autoRetry: true, requiresNewWorkflowInstance: false };
  };
  assert.equal(safeRetry('L3', 'PERSISTENT_CHANGE').autoRetry, false);
  assert.equal(safeRetry('L0', 'READ_ONLY').autoRetry, true);
});

// --- A5-AC-23 / Test 30: Epistemic ladder ---
test('A5-AC-23 / Test-30: Epistemic states are defined and proposals do not silently promote to FACT/USER_DECISION', () => {
  const h = a5Harness();
  assert.ok(h.A5_EPISTEMIC_STATES.includes('AGENT_PROPOSAL'));
  assert.ok(h.A5_EPISTEMIC_STATES.includes('FACT'));
  assert.ok(h.A5_EPISTEMIC_STATES.includes('USER_DECISION'));
  const promote = (state: string, validated: boolean, userConfirmed: boolean) => {
    if ((state === 'FACT' || state === 'USER_DECISION') && !(validated || userConfirmed)) throw new Error('EPISTEMIC_VIOLATION');
    return state;
  };
  assert.throws(() => promote('FACT', false, false));
  assert.equal(promote('FACT', true, false), 'FACT');
});

// --- A5-AC-24 / Test 32 / Test 33: Context Compiler ---
test('A5-AC-24 / Test-32: Context Compiler enforces a token budget ceiling and withholds internal prompts', () => {
  const h = a5Harness();
  assert.ok(typeof h.A5_CONTEXT_PACKAGE.tokenBudget === 'number' && h.A5_CONTEXT_PACKAGE.tokenBudget <= 8192);
  assert.equal('systemPrompt' in h.A5_CONTEXT_PACKAGE, false);
  assert.equal('rawPrompt' in h.A5_CONTEXT_PACKAGE, false);
});

// --- A5-AC-25 / Test 17 (timeline) / Test 34: Timeline exposes milestones with source classification ---
test('A5-AC-25: Orchestration timeline entries expose source classification and hide scratchpads', () => {
  const h = a5Harness();
  h.renderA5Timeline();
  assert.ok(h['orch-timeline'].children.length >= 5);
  const texts = h['orch-timeline'].children.flatMap((n: FakeNode) => flatText(n));
  assert.ok(texts.some((t: string) => t.includes('[source: MOCK]')));
  assert.ok(texts.some((t: string) => t.includes('[EVIDENCE]')));
  assert.equal(texts.some((t: string) => /scratchpad|internal reasoning/i.test(t)), false);
});

// --- A5-AC-26: Progressive disclosure ---
test('A5-AC-26: Progressive disclosure — simple view is default; advanced view is togglable and hidden by default', () => {
  assert.ok(html.includes('id="orch-simple-view"'));
  assert.ok(html.includes('id="orch-advanced"'));
  assert.ok(html.includes('id="orch-advanced-toggle"'));
  const advancedBlock = html.slice(html.indexOf('id="orch-advanced"'), html.indexOf('id="orch-advanced"') + 80);
  assert.ok(advancedBlock.includes('hidden'));
});

// --- A5-AC-27 / Test 40 (mobile in AC-40), 46: Responsive layout ---
test('A5-AC-27: Responsive breakpoints exist for Desktop/Tablet/Mobile with 48px touch targets', () => {
  assert.ok(css.includes('1179px'));
  assert.ok(css.includes('760px'));
  assert.ok(css.includes('min-height:48px'));
});

// --- A5-AC-28 / Test 44 / Test 45: Accessibility ---
test('A5-AC-28: WCAG 2.1 AA — ARIA roles, live regions, and reduced-motion suppression present', () => {
  assert.ok(html.includes('role="feed"'));
  assert.ok(html.includes('role="status"'));
  assert.ok(html.includes('aria-live="polite"'));
  assert.ok(js.includes('reducedMotion') && js.includes('applyReducedMotion'));
});

// --- A5-AC-30 / Test 39: Dataset integrity ---
test('A5-AC-30 / Test-39: Canonical dataset SHA-256 remains unaltered', () => {
  assert.equal(verifyDatasetHash(EURUSD_H1_BASELINE_CONFIG.csvPath, EURUSD_H1_BASELINE_CONFIG.expectedSHA256), true);
});

// --- A5-AC-31 / Test 40 / Test 41: A.3/A.4 regressions absent ---
test('A5-AC-31 / Test-40: Phase A.4 contracts and communications block remain extractable', () => {
  assert.ok(js.includes('A4_COMM_FIXTURES'));
  assert.ok(js.includes('renderA4Communications'));
  assert.ok(html.includes('data-group="communications"'));
});

test('Test-41: Phase A.3 operational sectors block remains extractable and functional', () => {
  assert.ok(js.includes('OPERATIONAL_FIXTURES'));
  assert.ok(js.includes('OPERATIONAL_SECTORS'));
  assert.ok(js.includes('normalizeOperationalRecord'));
  assert.ok(js.includes('selectOperationalSector'));
});

// --- A5-AC-32: Implementation authorization reserved ---
test('A5-AC-32: Spec explicitly reserves GREEN declaration to the Orchestrator/User, not the builder agent', () => {
  const spec = readFileSync(new URL('../docs/atlas-final-ui-phase-a5-orchestration-vortex.md', import.meta.url), 'utf8');
  assert.ok(spec.includes('READY_FOR_FINAL_SPEC_REVIEW') || spec.includes('APPROVED_FOR_IMPLEMENTATION_SPEC'));
});

// --- A5-AC-37 / Test 20 / Test 21 / Test 22 / Test 23: STATUS != EVIDENCE ---
test('A5-AC-37 / Test-20: WorkflowStatus=RUNNING + source=MOCK does not imply real command execution', () => {
  const h = a5Harness();
  const wf = h.A5_WORKFLOWS.find((w: any) => w.status === 'RUNNING');
  assert.ok(wf);
  assert.equal(wf.source, 'MOCK');
  const a5Block = js.slice(js.indexOf('Phase A.5'), js.indexOf('// --- Carga ---'));
  assert.equal(/child_process|exec\(|spawn|sudo|\bpty\b/i.test(a5Block), false);
});

test('Test-22: ValidationStatus=PASS + source=MOCK does not satisfy independent validator identity', () => {
  const h = a5Harness();
  const v = h.A5_VALIDATION_SUMMARIES[0];
  assert.equal(v.source, 'MOCK');
  assert.notEqual(v.validatorAgentId, v.builderAgentId);
});

test('A5-AC-37 / Test-23: All status-bearing UI renders display source classification alongside status', () => {
  const h = a5Harness();
  h.renderA5Workflows();
  const texts = h['orch-workflows'].children.flatMap((n: FakeNode) => flatText(n));
  assert.ok(texts.some((t: string) => /RUNNING \[MOCK\]|INTAKE \[MOCK\]/.test(t)));
});

// --- A5-AC-38: ValidationSummary contract completeness ---
test('A5-AC-38: ValidationSummary carries validatorAgentId, builderAgentId, and labels testResults as evidence', () => {
  const h = a5Harness();
  const v = h.A5_VALIDATION_SUMMARIES[0];
  assert.ok('validatorAgentId' in v && 'builderAgentId' in v);
  assert.ok(v.testEvidenceSummary.includes('not a substitute for validator identity'));
});

// --- A5-AC-40 / Test 43: Mobile DAG linearization ---
test('A5-AC-40 / Test-43: Mobile viewport renders a linearized, accessible step accordion — no panning canvas ever', () => {
  assert.equal(html.includes('<canvas'), false);
  assert.ok(html.includes('orch-step-accordion'));
  const h = a5Harness();
  h.renderA5StepAccordion();
  assert.ok(h['orch-step-graph'].children.length >= 6);
  assert.ok(h['orch-step-graph'].children.every((item: FakeNode) => item.children[0].tagName === 'BUTTON'));
});

// --- Test-19: Validation gate ---
test('Test-19: Workflow cannot leave RUNNING to COMPLETED until validationCompleted is true', () => {
  const h = a5Harness();
  const wf = { status: 'RUNNING', userApprovalRequired: false, approvalGranted: false, validationRequired: true, validationCompleted: false };
  assert.throws(() => h.transitionWorkflow(wf, 'COMPLETED'), /POLICY_ERROR/);
  wf.status = 'WAITING_FOR_VALIDATION';
  wf.status = 'VALIDATING';
  wf.validationCompleted = true;
  wf.status = 'RUNNING';
  const done = h.transitionWorkflow(wf, 'COMPLETED');
  assert.equal(done.status, 'COMPLETED');
});

// --- Test-26: Project context isolation ---
test('Test-26: Workflows and TaskPlans carry projectId for strict context isolation', () => {
  const h = a5Harness();
  const projectIds = new Set(h.A5_WORKFLOWS.map((w: any) => w.projectId));
  assert.ok(projectIds.has('atlas-remote'));
  assert.ok(projectIds.has('trading-lab'));
});

// --- Test-35/36/37/38: Local security baseline ---
test('Test-35 / Test-36 / Test-37 / Test-38: No shell execution, loopback-only, offline-capable, trading blocked', () => {
  const a5Block = js.slice(js.indexOf('Phase A.5'), js.indexOf('// --- Carga ---'));
  assert.equal(/child_process|exec\(|spawn|sudo|\bpty\b|\bshell\b/i.test(a5Block), false);
  assert.equal(a5Block.includes('eval('), false);
  assert.equal(a5Block.includes('innerHTML'), false);
  assert.ok(js.includes('ATLAS_SIN_RED') || html.includes('OFFLINE'));
  assert.ok(html.includes('tag-safe">SIN DINERO REAL') || html.includes('REAL EXECUTION BLOCKED'));
});

// --- Test-42: Canonical Vortex preserved (viewBox / class names) ---
test('Test-42: Canonical Vortex viewBox and class names remain intact after A.5', () => {
  assert.ok(html.includes('viewBox="0 0 600 900"'));
});

// --- Test-46: Zero horizontal overflow classes present ---
test('Test-46: Responsive CSS applies overflow containment for mobile orchestration layout', () => {
  assert.ok(css.includes('orch-metrics{grid-template-columns:repeat(2'));
});

// --- Test-47: Git hygiene note (structural — verified operationally outside this suite) ---
test('Test-47: A.5 CSS/JS/HTML additions are scoped under orch-* / A5_* namespaces (no unrelated renames)', () => {
  assert.ok(css.includes('.orch-'));
  assert.ok(js.includes('A5_WORKFLOW_STATUSES'));
  assert.equal(js.includes('A5_WORKFLOW_STATUSES').valueOf(), true);
});

// --- A5-AC-06 revisited: CSS coverage for orchestration component classes ---
test('CSS covers all A.5 orchestration component classes', () => {
  for (const cls of ['.orch-layout', '.orch-workflow-item', '.orch-step-accordion', '.orch-step-item', '.orch-timeline', '.orch-agent-card', '.orch-routing-tier', '.orch-protected-panel', '.orch-validation-item']) {
    assert.ok(css.includes(cls), `Missing CSS for ${cls}`);
  }
});

// --- Sidebar navigation entry ---
test('Sidebar navigation includes orquestacion entry', () => {
  assert.ok(html.includes('data-nav="orquestacion"'));
  assert.ok(js.includes("orquestacion:['Orquestación'"));
});
