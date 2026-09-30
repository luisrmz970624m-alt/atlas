# ATLAS FINAL UI — PHASE A.5
## SPECIFICATION: ORCHESTRATION VORTEX (MULTI-AGENT WORKFLOW & INTENT ENGINE)

| Metadata Field | Value |
|---|---|
| **PHASE** | ATLAS FINAL UI — PHASE A.5 |
| **PROPOSED CODENAME** | Orchestration Vortex |
| **SPEC_VERSION** | DRAFT 0.2 |
| **SPEC_STATUS** | READY_FOR_FINAL_SPEC_REVIEW |
| **BASELINE** | Phase A.4 GREEN (Unified Communications Vortex, 80/80 test files PASS, 1015/1015 tests PASS) |
| **DATE** | 2026-09-27 |
| **AUTHOR / ROLE** | Antigravity (Architecture / Multi-Agent Systems / UX Specification Agent) |
| **TARGET REVIEWERS** | ChatGPT / Atlas Orchestrator, Claude (Security & Verification), Codex (Implementation) |
| **OWNER** | Atlas Orchestrator / User |
| **REVISION** | Draft 0.1 → Draft 0.2 (Mandatory Corrections Applied) |

> [!IMPORTANT]
> **GOVERNANCE & LIFECYCLE NOTICE:** This document is the canonical Specification Draft 0.2 for Phase A.5. Its status is `READY_FOR_FINAL_SPEC_REVIEW`. It does NOT authorize or imply `APPROVED_FOR_IMPLEMENTATION_SPEC`—final implementation authorization is reserved strictly for ChatGPT / Atlas Orchestrator and the User following formal independent security review. No product code, test code, or datasets have been modified in this specification task.

> [!NOTE]
> **DRAFT 0.2 REVISION SUMMARY:** This revision resolves 1 blocker + 5 required corrections + 7 hardening items identified during independent specification review. Key changes: `ProtectedResourceScope.defaultPolicy` changed from `STRICT_DENY` to `DEFAULT_DENY` with explicit scoped authorization model; `ApprovalRequirement` interface introduced; `validatorAgentId != builderAgentId` identity invariant formalized; `STATUS != EVIDENCE` non-negotiable invariant added; cryptographic wording corrected ("signed" → "attested"); `authorizationSource` enum added; routing tier abstraction enforced; invalid transition tables added; open questions resolved; acceptance criteria expanded (A5-AC-33 through A5-AC-40); test plan expanded with 16 new behavioral tests; Green Gate updated.

---

## 1. Executive Summary & Core Product Concept

Phase A.3 established the **Operational Vortex** (system health, registered agents, task lists, privilege tiers) and Phase A.4 delivered the **Unified Communications Vortex** (provider-neutral conversations, priority notifications, mock-first approvals, and strict transport/verification decoupling).

Phase A.5 introduces the **Orchestration Vortex**. The objective is to design the UI surfaces, data contracts, multi-tier state machines, and safety boundaries that enable Atlas to convert an incoming user communication into an auditable, structured multi-agent workflow:

```
+===================================================================================+
|                                    USER                                           |
+===================================================================================+
                                         |
                                         v
+===================================================================================+
|                      COMMUNICATION CENTER (Phase A.4)                             |
|                           (Prompt / Request Ingest)                               |
+===================================================================================+
                                         |
                                         v
+===================================================================================+
|                         STRUCTURED INTENT (Invariant: MESSAGE != COMMAND)         |
+===================================================================================+
                                         |
                                         v
+===================================================================================+
|                          ATLAS ORCHESTRATOR ENGINE                                |
|       (TaskPlan Synthesis, Dependency Graphing, Free-First Routing)               |
+===================================================================================+
                                         |
                                         v
+===================================================================================+
|                     CAPABILITY & PRIVILEGE GATEWAY                                |
|  - Intelligence != Privilege              - Capability != Privilege               |
|  - Protected Resources: DEFAULT_DENY + Explicit Scoped Authorization Required     |
+===================================================================================+
                                         |
                                         v
+===================================================================================+
|                      EXECUTION PROPOSAL & AGENT WORK                              |
|           (Assigned Builder Agent: determined by routing policy)                  |
+===================================================================================+
                                         |
                                         v
+===================================================================================+
|                        INDEPENDENT VALIDATION GATEWAY                             |
|          (Validator Agent: independent of Builder; identity invariant enforced)   |
|                 Builder output NEVER self-validates                               |
+===================================================================================+
                                         |
                                         v
+===================================================================================+
|                       AGENT RESULT & ARTIFACT SYNTHESIS                           |
|        (Audit Invariant: If changes made, CHANGES_MADE != NONE)                   |
+===================================================================================+
                                         |
                                         v
+===================================================================================+
|                      ORCHESTRATION VORTEX UI PRESENTATION                         |
|              (Progressive Disclosure: Simple Flow -> Deep Provenance)             |
+===================================================================================+
```

### Core Product Questions
Every view in the Orchestration Vortex must allow an operator (expert or non-expert) to answer unambiguously:
1. **What is Atlas doing?** (Active objective and current step).
2. **Which agent is doing it?** (Agent role, routing tier, and locality).
3. **Why was that agent selected?** (Concise policy explanation).
4. **What project does the task belong to?** (Isolated project context).
5. **What privileges would it require?** (`L0`–`L4` and exact fine-grained capabilities).
6. **What stage is the workflow in?** (Explicit state machine position).
7. **What did the agent produce?** (Artifacts, diffs, summary metrics).
8. **Has another agent validated it?** (Independent validator attestation, with `validatorAgentId != builderAgentId`).
9. **Does the user need to approve anything?** (Clear, mock-first approval status with explicit `ApprovalRequirement`).

---

## 2. Backward Compatibility & Surface Integration

### 2.1 Preservation of the Canonical 8-Sector Vortex
Phase A.5 preserves the canonical 8-sector Vortex established in Phase A.3 and extended in Phase A.4:
- The `#canonical-vortex` SVG element, its exact `viewBox`, class names, ARIA bindings, and 9 orbital layers remain the persistent centerpiece.
- The 8 operational sectors (`CORE`, `AGENTS`, `TASKS`, `SYSTEM`, `KNOWLEDGE`, `SECURITY`, `ACTIVITY`, `FREE_FIRST`) are maintained without fragmentation.

### 2.2 Orchestration Center Surface Placement
Following architectural evaluation, the **Orchestration Center** is integrated as:
$$\text{Orchestration Center} = \text{Contextual Cross-Module Workspace bridging TASKS, AGENTS, and COMMUNICATIONS}$$

```
+-----------------------------------------------------------------------------------+
|                        CANONICAL VORTEX CENTERPIECE                               |
|                                                                                   |
|  [CORE]       [AGENTS] -----> (Agent Registry / Capability Inspector)             |
|  [TASKS] --------------------> (Workflow Lifecycle / Step Timeline)               |
|  [SYSTEM]     [KNOWLEDGE]                                                         |
|  [SECURITY]   [ACTIVITY]                                                          |
|  [FREE_FIRST] [COMMUNICATIONS] -> (Structured Intent / Approval Inbox Tab)        |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                     CONTEXTUAL ORCHESTRATION WORKSPACE                            |
|  - Active Workflow Deck               - Step Execution Graph (DAG)                |
|  - Builder/Validator Handoff Matrix   - Free-First Routing & Privilege Badge      |
+-----------------------------------------------------------------------------------+
```

- When the user selects `TASKS`, the view expands to show active and historical multi-agent workflows.
- When the user selects `AGENTS`, the view highlights active agent assignments, capabilities, and handoff flows.
- When initiated from `COMMUNICATIONS`, a message's task intent opens a contextual drawer directly linking the thread to its generated workflow.

---

## 3. Structured Intent & The Invariant `MESSAGE != COMMAND`

### 3.1 The Inviolable Invariant
$$\text{MESSAGE} \neq \text{COMMAND}$$
Incoming user messages from chat adapters or Web clients are human-language requests. They must **never** be piped directly to shell interpreters, subprocess runners, or evaluation engines.

Every user communication requesting an operational action must first be normalized into a typed, validated `StructuredIntent` entity.

### 3.2 StructuredIntent Anatomy
```typescript
export interface StructuredIntent extends SourceMeta {
  intentId: string;              // UUIDv7 ("int_01H...")
  conversationId: string;        // UUIDv7
  messageId: string;             // UUIDv7
  projectId: string;             // e.g. "atlas-remote", "trading-lab"
  userId: string;                // "usr_luisangel"
  taskType: 'ANALYSIS' | 'IMPLEMENTATION' | 'REVIEW' | 'VERIFICATION' | 'SYSTEM_QUERY';
  objective: string;             // High-level normalized goal
  constraints: string[];         // Hard boundaries (e.g. "Do not touch /home/luisangel/atlas")
  requestedOutput: 'REPORT' | 'DIFF' | 'METRICS' | 'CONFIRMATION';
  riskClass: 'READ_ONLY' | 'REVERSIBLE' | 'PERSISTENT_CHANGE' | 'CRITICAL';
  requiresExecution: boolean;
  requiresNetwork: boolean;
  requiresUserApproval: boolean;
  createdAt: string;             // ISO-8601
  verificationState: 'VERIFIED_ORIGIN' | 'UNVERIFIED_ORIGIN' | 'MOCK_ORIGIN';
}
```

---

## 4. Task Plan & Step Representation

A `StructuredIntent` is decomposed by the Orchestrator into a deterministic, step-wise `TaskPlan`.

### 4.1 Step Decomposition Pattern
Each step in a plan represents an isolated unit of execution assigned to a specific role:
- **Step 1 (Ingest):** Inspect target project files and environment context.
- **Step 2 (Analyze):** Perform static analysis and model reasoning.
- **Step 3 (Draft):** Produce proposed patch or synthetic artifact.
- **Step 4 (Gate):** Request user approval if privilege $> \text{L1}$ or risk class is elevated.
- **Step 5 (Execute):** Execute authorized action within an isolated sandbox.
- **Step 6 (Validate):** Submit outputs to an independent validator agent.

### 4.2 TaskPlan Data Contract
```typescript
export interface TaskStep {
  stepId: string;                // "stp_01"
  stepIndex: number;             // 1, 2, 3...
  title: string;
  description: string;
  assignedRole: AgentRole;
  assignedAgentId?: string | null;
  requiredCapabilities: string[];
  requiredPrivilegeLevel: PrivilegeLevel;
  dependencies: string[];        // Array of prerequisite stepIds
  status: StepStatus;
  executionProposal?: string | null;
  artifactOutputs: ArtifactUri[]; // Atlas logical URIs: "atlas://artifact/<artifact-id>"
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface TaskPlan extends SourceMeta {
  planId: string;                // "pln_01H..."
  intentId: string;
  projectId: string;
  objective: string;
  steps: TaskStep[];
  dependencies: string[];
  estimatedRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requiredCapabilities: string[];
  maxPrivilegeLevel: PrivilegeLevel;
  networkRequirement: 'OFFLINE_ONLY' | 'LOOPBACK_ONLY' | 'EXTERNAL_AUTHORIZED';
  validationRequired: boolean;
  userApprovalRequired: boolean;
  approvalRequirement?: ApprovalRequirement;
  status: 'PROPOSED' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
  createdAt: string;
}
```

---

## 5. Multi-Tier State Machine Architecture

To eliminate ambiguity, Phase A.5 strictly separates the workflow lifecycle, the task container lifecycle, and atomic step execution into three independent state machines.

```
[WORKFLOW STATE MACHINE: WorkflowStatus]
  [INTAKE]
     |
     v
  [PLANNING]
     |
     v
  [WAITING_FOR_AGENT]
     |
     v
  [READY] ---------------------------------------+
     |                                           |
     +---> [WAITING_FOR_APPROVAL]                | (User Pauses)
     |          |                                v
     |          v (User Approves)            [PAUSED]
     v          |                                |
  [RUNNING] <---+                                | (User Resumes)
     |                                           |
     +---> [WAITING_FOR_VALIDATION]              |
     |          |                                |
     |          v (Validator engages)            |
     |     [VALIDATING]                          |
     |          |                                |
     +----------+--------------------------------+
     |                     |                     |
     v                     v                     v
[COMPLETED]             [FAILED]            [CANCELLED]
(Terminal Success)     (Terminal Error)     (Terminal Abort)
```

### 5.1 Orthogonal State Taxonomy

| Lifecycle Level | State Enum Name | Permitted States | Primary Governance |
| :--- | :--- | :--- | :--- |
| **Workflow Level** | `WorkflowStatus` | `INTAKE`, `PLANNING`, `WAITING_FOR_AGENT`, `READY`, `WAITING_FOR_APPROVAL`, `RUNNING`, `WAITING_FOR_VALIDATION`, `VALIDATING`, `COMPLETED`, `FAILED`, `PAUSED`, `CANCELLED` | High-level orchestration, multi-step sequencing, and lifecycle bounds |
| **Task Container Level** | `TaskStatus` | `PENDING`, `READY`, `RUNNING`, `BLOCKED`, `COMPLETED`, `FAILED`, `CANCELLED` | Atomic unit of work assigned to a specific builder agent |
| **Step Execution Level** | `StepStatus` | `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `SKIPPED`, `BLOCKED` | Granular sub-operation within a multi-step plan |

### 5.2 Transition Invariants & Guardrails
1. **Approval Guardrail:** A workflow requiring Level 2–4 privileges or elevated capabilities **CANNOT** transition from `READY` to `RUNNING` without visiting `WAITING_FOR_APPROVAL` and receiving an explicit approval event. Exception: an L2 task may proceed without a fresh approval event ONLY IF it carries `ApprovalRequirement.preAuthorizable: true` AND an active pre-authorization policy covers its exact capability/resource scope. The invariant `APPROVAL_REQUIREMENT != PRIVILEGE_NUMBER_ONLY` holds: approval policy is determined by `ApprovalRequirement.source`, not the privilege number alone.
2. **Validation Guardrail:** A workflow marked `validationRequired: true` **CANNOT** transition from `RUNNING` directly to `COMPLETED`. It must transition to `WAITING_FOR_VALIDATION` $\rightarrow$ `VALIDATING` $\rightarrow$ `COMPLETED`.
3. **Builder Self-Validation Ban (Identity Invariant):** The agent that was assigned as `BUILDER` for a step is strictly forbidden from serving as validator for that same step. This is a formal identity invariant: `validatorAgentId != builderAgentId`. A deterministic test suite PASS is evidence of correctness — it is NOT a substitute for an independent validator identity. The correct model is: `Builder → Result → Tests → Evidence → Independent Validator → ValidationSummary`.
4. **Terminal State Immutability:** `COMPLETED`, `FAILED`, and `CANCELLED` are immutable terminal states. No agent or system event may mutate a terminal state directly. Re-running a failed workflow requires synthesizing a **new** workflow instance with incremented lineage. The original terminal record is preserved as-is for audit integrity.

### 5.3 Invalid Transition Tables

The following transitions are **EXPLICITLY FORBIDDEN** and must raise a policy error at the state machine boundary:

#### WorkflowStatus — Invalid Transitions
| From State | To State | Reason |
| :--- | :--- | :--- |
| `CANCELLED` | `RUNNING` | Terminal state is immutable. Create a new workflow instance. |
| `CANCELLED` | `READY` | Terminal state is immutable. Create a new workflow instance. |
| `CANCELLED` | `PLANNING` | Terminal state is immutable. Create a new workflow instance. |
| `COMPLETED` | `RUNNING` | Terminal state is immutable. |
| `COMPLETED` | `READY` | Terminal state is immutable. |
| `COMPLETED` | `FAILED` | Terminal state is immutable. |
| `FAILED` | `COMPLETED` | Terminal state is immutable. Recovery creates a new attempt. |
| `READY` | `RUNNING` | Only permitted if `approvalRequired = false` OR approval event received. Bypassing approval gate is forbidden. |
| `RUNNING` | `COMPLETED` | Only permitted if `validationRequired = false` OR validation cycle completed. Bypassing validation is forbidden. |
| `INTAKE` | `COMPLETED` | Must traverse the full lifecycle. |

> [!IMPORTANT]
> **FAILED Recovery Model:** `WorkflowStatus.FAILED` is a terminal state. Recovery from a failed workflow requires creating a NEW workflow instance (new `workflowId`, incremented `lineage`) that references the original. The FAILED record must not be mutated. The new attempt begins at `INTAKE`.

#### TaskStatus — Invalid Transitions
| From State | To State | Reason |
| :--- | :--- | :--- |
| `COMPLETED` | `RUNNING` | Terminal. Create new task instance. |
| `COMPLETED` | `PENDING` | Terminal. |
| `CANCELLED` | `RUNNING` | Terminal. |
| `CANCELLED` | `READY` | Terminal. |
| `FAILED` | `COMPLETED` | Terminal. Recovery requires a new task instance. |

#### StepStatus — Invalid Transitions
| From State | To State | Reason |
| :--- | :--- | :--- |
| `COMPLETED` | `RUNNING` | Terminal step. |
| `COMPLETED` | `PENDING` | Terminal step. |
| `FAILED` | `COMPLETED` | Terminal step. |
| `SKIPPED` | `RUNNING` | A skipped step cannot resume. |

---

## 6. Agent Assignment, Roles & Dynamic Registry

### 6.1 Extensible Agent Roles
Atlas defines standardized operational roles that decouple functional responsibility from specific AI models or providers:

```typescript
export type AgentRole =
  | 'ORCHESTRATOR'       // Macro-planning, task decomposition, arbitration
  | 'BUILDER'            // Procedural code generation, test authoring, workspace edits
  | 'VALIDATOR'          // Invariant verification, test execution inspection
  | 'SECURITY_REVIEWER'  // Threat modeling, secret leakage scans, privilege audits
  | 'RESEARCHER'         // Documentation indexing, architectural synthesis
  | 'DOCUMENTATION'      // Markdown generation, contract documentation, API specs
  | 'MONITOR'            // Telemetry inspection, health checks, storage monitoring
  | 'SPECIALIST'         // Domain-specific persistent expert
  | 'TEMPORARY_SPECIALIST'; // Ephemeral single-task expert (spawned on demand, released upon completion)
```

> [!NOTE]
> **NON-NORMATIVE FIXTURE EXAMPLES (informational only, not normative):** In a reference deployment, `ORCHESTRATOR` might be filled by a conversational planning model, `BUILDER` by a code-specialized model, and `VALIDATOR` by a reasoning/audit model. Specific model names, parameter sizes, or provider identities are not part of this specification and must not appear in normative contracts. See Section 7 for the routing tier abstraction.

### 6.2 AgentAssignment Data Contract
```typescript
export interface AgentAssignment extends SourceMeta {
  assignmentId: string;          // UUIDv7
  taskId: string;
  stepId?: string;
  agentId: string;               // e.g. "agent_builder_01", "agent_validator_01"
  agentRole: AgentRole;
  routingTier: RoutingTier;      // See Section 7.1 — NEVER a specific model name here
  location: 'LOCAL' | 'CLOUD' | 'EDGE_NODE';
  assignedCapabilities: string[];
  availability: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
  assignmentReason: string;      // Concise policy rationale
  assignedAt: string;
  sourceState: SourceClassification;
}
```

### 6.3 Dynamic Agent Registry (Mock-First UI Representation)
The UI surfaces registered agents with their current status, capability profiles, and locality:
- **Registry Badge:** Displays active/idle status and current task binding.
- **Locality Indicator:** Clearly distinguishes `LOCAL` from `CLOUD`.
- **Health & Heartbeat:** Renders last observed ping and truthfulness classification (`VERIFIED`, `MOCK`, `UNAVAILABLE`).

---

## 7. Free-First Intelligence Routing & Cost Transparency

### 7.1 The Free-First Priority Cascade
When resolving an intent, the Orchestrator evaluates the capability requirements across 5 abstract cost tiers. **The routing tier is an abstract policy concept — it is NOT a specific model name or provider identity.**

$$\text{ROUTING\_TIER} \neq \text{PROVIDER\_IDENTITY}$$

```typescript
export type RoutingTier =
  | 'DETERMINISTIC_TOOL'  // Tier 0: Zero LLM overhead (regex, AST, git, file checks)
  | 'LOCAL_SMALL'         // Tier 1: Local micro-model (<2B params, <1 GiB RAM)
  | 'LOCAL_LARGE'         // Tier 2: Local standard model (>3B params, moderate RAM)
  | 'CLOUD_STANDARD'      // Tier 3: Metered cloud coding/reasoning capacity
  | 'CLOUD_SPECIALIST';   // Tier 4: Frontier reasoning, security veto authority
```

```
[Intent Input]
      |
      v
+-----------------------------------------------------------------------------------+
| TIER 0: DETERMINISTIC_TOOL ($0 Cost, Instant, Zero LLM Overhead)                 |
| (Regex parsing, git status, file existence check, AST linting)                   |
+-----------------------------------------------------------------------------------+
      | [Generative reasoning required]
      v
+-----------------------------------------------------------------------------------+
| TIER 1: LOCAL_SMALL ($0 Cost, <1 GiB RAM)                                        |
| (Task classification, token sanitization, simple JSON formatting)                |
+-----------------------------------------------------------------------------------+
      | [Code synthesis or moderate reasoning required]
      v
+-----------------------------------------------------------------------------------+
| TIER 2: LOCAL_LARGE ($0 Cost, Moderate RAM)                                      |
| (Local script implementation, test harness generation, log analysis)             |
+-----------------------------------------------------------------------------------+
      | [Local capacity exceeded or complex multi-file task]
      v
+-----------------------------------------------------------------------------------+
| TIER 3: CLOUD_STANDARD (Metered Cost, High Coding Capacity)                      |
| (Complex procedural implementation, multi-file refactoring)                      |
+-----------------------------------------------------------------------------------+
      | [Deep architectural synthesis, formal security audit, multi-agent dispute]
      v
+-----------------------------------------------------------------------------------+
| TIER 4: CLOUD_SPECIALIST (Frontier Reasoning, Security Veto Authority)           |
| (Formal verification, privilege boundary audit, high-stakes arbitration)         |
+-----------------------------------------------------------------------------------+
```

> [!NOTE]
> **NON-NORMATIVE FIXTURE EXAMPLES (informational only):** Tier 0 examples: ripgrep, git-status, eslint. Tier 1 examples: sub-2B local models. Tier 2 examples: 7B–8B local models. Tier 3/4: cloud API models. These are non-binding deployment examples. The normative contract is the `RoutingTier` enum only.

### 7.2 Routing Decision Transparency
The UI explicitly surfaces the policy rationale behind routing decisions without exposing raw prompts or specific model names to end users in normative displays:
- *Example Local:* `"Selected: LOCAL_LARGE. Reason: Code analysis within local memory budget; no external research required."`
- *Example Escalation:* `"Escalated: CLOUD_SPECIALIST. Reason: Security review of privilege boundary requires formal verification tier."`

---

## 8. Privilege, Capability & Protected Resource Boundaries

### 8.1 The Core Invariant
$$\text{INTELLIGENCE\_LEVEL} \neq \text{SYSTEM\_PRIVILEGE\_LEVEL}$$
A cloud-based frontier model (`CLOUD_SPECIALIST`) operates by default with zero host privileges. It possesses the exact same Level 0/1 ambient restrictions as a local micro-model. Model intelligence never grants ambient execution authority.

### 8.2 Capability Model vs. Privilege Level
Privilege levels (`L0`–`L4`) define the broad operational envelope, while **Capabilities** specify fine-grained operational permissions:
$$\text{Privilege Level} + \text{Specific Capability Grant} + \text{Resource Scope} = \text{Authorized Execution}$$

```typescript
export interface CapabilityRequirement {
  capability:
    | 'filesystem.read'
    | 'filesystem.write'
    | 'process.inspect'
    | 'network.loopback'
    | 'project.modify'
    | 'dataset.read'
    | 'repository.modify';
  resourceScope: string;         // e.g. "src/panel-vortice/**", "/tmp/scratch/**"
  reason: string;
  isMandatory: boolean;
}

export interface PrivilegeRequirement {
  requiredLevel: PrivilegeLevel; // 'L0' | 'L1' | 'L2' | 'L3' | 'L4'
  justification: string;
  requiresDualConfirmation: boolean; // True for L4 or protected resources
  ttlSeconds?: number;
}
```

### 8.3 The Protected Resource Model — DEFAULT_DENY + Scoped Authorization

**BLOCKER RESOLUTION:** The `defaultPolicy` for protected resources is `DEFAULT_DENY`, not `STRICT_DENY`. `DEFAULT_DENY` means access is denied in the absence of explicit, scoped, user-or-policy-authorized access grants. Unlike an absolute prohibition, `DEFAULT_DENY` supports a formal authorization pathway — but general privilege level alone never constitutes authorization.

$$\text{L4 Privilege} \not\implies \text{Access to Protected Resources}$$

An approved Level 4 administrative grant does **NOT** grant access to protected resources in the absence of an explicit `ScopedAuthorization`. Every protected resource access requires a separate, task-scoped, user-or-policy-authorized grant with an explicit `authorizationSource` and expiration.

```typescript
export type AuthorizationSource =
  | 'USER_EXPLICIT'              // User issued explicit authorization for this task
  | 'USER_PREAUTHORIZED_POLICY'  // User previously approved a standing policy covering this scope
  | 'SYSTEM_POLICY'              // Automated policy (e.g. CI gate, read-only audit)
  | 'PROJECT_POLICY';            // Project-level policy defined by authorized admin

// Invariant: AGENT_SELF_AUTHORIZED is FORBIDDEN.
// Agents may NEVER authorize their own access to protected resources.

export interface ScopedAuthorization {
  authorizationId: string;       // UUIDv7
  agentId: string;               // Agent receiving the grant
  taskId: string;                // Strictly scoped to this task
  capability: string;            // e.g. "filesystem.read"
  resourceScope: string;         // e.g. "docs/**" within the protected resource
  authorizationSource: AuthorizationSource;
  authorizedBy: string;          // Identity of the authorizing principal (user or policy id)
  authorizedAt: string;          // ISO-8601
  expiresAt: string;             // ISO-8601 — all grants have an explicit expiry
  ttlSeconds: number;
  sourceMeta: SourceMeta;
}

export interface ProtectedResourceScope {
  resourceId: string;            // e.g. "production-atlas"
  resourceType: string;          // e.g. "PROJECT_REPOSITORY"
  resourcePath: string;          // e.g. "/home/luisangel/atlas"
  classification: 'RESTRICTED_CORE' | 'EXTERNAL_STORAGE' | 'HOST_ROOT';
  defaultPolicy: 'DEFAULT_DENY';
  requiredCapability: string;    // Minimum capability required to request a grant
  taskScope: boolean;            // True: authorization is scoped to a single task
  authorizationRequired: true;   // Explicit out-of-band authorization is always required
  authorizationSource: AuthorizationSource; // The source class for any active grant
  authorizedBy?: string | null;  // Populated when a grant is active
  expiresAt?: string | null;     // Populated when a grant is active
  sourceMeta: SourceMeta;
}
```

**Non-negotiable invariants for protected resources:**
- `AGENT_SELF_AUTHORIZED` is categorically forbidden — an agent cannot grant itself access to a protected resource.
- General privilege (`L4`) alone is NOT sufficient. Both `PrivilegeRequirement` AND `ScopedAuthorization` must be present.
- In Phase A.5 (mock-first), no active `ScopedAuthorization` records are populated. All protected resource access remains `DEFAULT_DENY` with no active grants.
- The `ApprovalStatus=APPROVED` field in a mock approval record does NOT constitute `ScopedAuthorization`. Mock approval records carry `source: MOCK` in their `SourceMeta`.

---

## 9. Agent Handoffs & Builder/Validator Separation

### 9.1 Independent Validation Mandate & Identity Invariant

In Atlas, **no builder agent may validate its own output**. This is a formal identity invariant:

$$\text{validatorAgentId} \neq \text{builderAgentId}$$

Quality assurance and security audits must be performed and attested by an independent validator whose identity is distinct from the builder:

```
[Builder Agent: agent_builder_01]
        |
        v (Produces candidate code patch)
[Candidate Patch Artifact (integrity hash: SHA-256: 8f2a...)]
        |
        v (Formal AgentHandoff)
[Validator Agent: agent_validator_01]  ← MUST be a different agentId than builder
        |
        v (Executes static analysis, invariant check, test suite)
[ValidationSummary (PASS / CONDITIONS / FAIL)]
        |
        v (Issues attestation)
[Validator Attestation (integrity hash verified)]
```

**Clarification — Test Evidence vs. Validator Identity:**
A deterministic automated test suite (e.g. 80/80 test files PASS) provides **evidence** that outputs conform to defined criteria. This test result is evidence — it is NOT a validator identity, and it is NOT equivalent to independent validation by a distinct agent. The following model applies:

```
Builder  →  Result  →  Tests  →  Evidence  →  Independent Validator  →  ValidationSummary
                                                   (validatorAgentId != builderAgentId)
```

A builder who runs tests on their own output and reports PASS has produced test evidence, not an independent validation. An independent validator with a distinct `agentId` must consume that evidence and issue a `ValidationSummary` with `validatorAgentId` set to their own distinct identifier.

### 9.2 AgentHandoff Contract
```typescript
export interface AgentHandoff extends SourceMeta {
  handoffId: string;             // UUIDv7
  taskId: string;
  fromAgentId: string;
  toAgentId: string;
  handoffType: 'IMPLEMENTATION' | 'REVIEW' | 'SECURITY' | 'VALIDATION' | 'RESEARCH' | 'DOCUMENTATION';
  transferReason: string;
  artifactPayloads: Array<{
    artifactId: string;
    integrityHash: string;       // SHA-256 content hash (integrity only, see Note below)
    description: string;
  }>;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED';
  createdAt: string;
  completedAt?: string | null;
}
```

### 9.3 ValidationSummary Contract
```typescript
export interface ValidationSummary extends SourceMeta {
  validationId: string;          // UUIDv7
  taskId: string;
  validatorAgentId: string;      // MUST be distinct from the builder's agentId
  builderAgentId: string;        // Recorded for explicit non-equality assertion
  // Invariant enforced at construction: validatorAgentId != builderAgentId
  status: 'PASS' | 'CONDITIONS_REQUIRED' | 'FAIL';
  findings: Array<{
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    message: string;
    codeRef?: string;
  }>;
  regressionsDetected: number;
  testResults: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  testEvidenceSummary: string;    // Description of automated evidence; NOT a substitute for validator identity
  artifactIntegrityHash: string;  // SHA-256 of validated artifact (content integrity only — see Note)
  attestedBy: string;             // validatorAgentId (attestation of review, not cryptographic non-repudiation)
  attestedAt: string;
}
```

> [!NOTE]
> **Integrity Hash Clarification (Correction 5):** SHA-256 hashes in Atlas contracts represent **content integrity verification** only. They confirm that an artifact's content has not been altered since it was hashed. SHA-256 does NOT constitute: cryptographic identity authentication of the signing agent, non-repudiation proof, or a digital signature. The term "attested by" indicates that the named validator agent performed the review and issued the summary — it is NOT equivalent to a PKI-based digital signature. Wording such as "signed by", "cryptographically signed handoff", or "signed validation" must not be used in Atlas specification documents.

---

## 10. Epistemic Status & Knowledge Quality Model

To prevent unverified agent outputs from corrupting operational memory, Atlas implements a formal epistemic ladder:

```
[Agent Output] ---> [AGENT_PROPOSAL] (Confidence: 0.3 - 0.5)
                          |
                          v (Validated by automated test / linter)
                   [VALIDATED_RESULT] (Confidence: 0.7 - 0.8)
                          |
                          v (Reviewed and approved by operator in production)
                   [USER_DECISION] / [OPERATIONAL_FACT] (Confidence: 1.0)
```

### Allowed Epistemic States
- `AGENT_PROPOSAL`: Draft output generated by an agent. Unvalidated.
- `HYPOTHESIS`: Theoretical conjecture proposed during research.
- `VALIDATED_RESULT`: Output that has passed independent verification or automated test suites.
- `USER_DECISION`: Explicit directive or preference confirmed by the human operator.
- `FACT`: Empirically verified observation about host environment or codebase.
- `MEASUREMENT`: Deterministic benchmark or hardware telemetry reading.
- `FAILED_EXPERIMENT`: Failed run preserved as negative knowledge to prevent repeated errors.
- `LESSON_LEARNED`: Synthesized post-mortem guideline derived from an incident.
- `DEPRECATED`: Superseded historical knowledge.

*Invariant:* Agent proposals and raw completions **NEVER** silently promote to `FACT` or `USER_DECISION` without validation and human consent.

---

## 11. The STATUS != EVIDENCE Invariant

> [!IMPORTANT]
> **Non-Negotiable Invariant:** `STATUS != EVIDENCE`
>
> An operational status field (e.g. `WorkflowStatus`, `ApprovalStatus`, `ValidationStatus`) is a runtime state descriptor. It is NOT evidence of the underlying truth, authorization, or real execution. This invariant is inviolable across all Phase A.5 contracts.

### 11.1 Formal Statement
$$\text{WorkflowStatus} \neq \text{ExecutionEvidence}$$
$$\text{ApprovalStatus} \neq \text{HostAuthorization}$$

### 11.2 Concrete Invariant Examples

| Status Field | Value | What It Means | What It Does NOT Mean |
| :--- | :--- | :--- | :--- |
| `WorkflowStatus` | `RUNNING` + `source: MOCK` | The workflow is in running state in mock mode | Real execution is occurring on the host |
| `ApprovalStatus` | `APPROVED` + `source: MOCK` | A mock approval event was recorded | The host OS has granted any capability or permission |
| `ValidationStatus` | `PASS` + `source: MOCK` | Mock validation passed | An independent validator with a distinct agentId has reviewed the output |
| `ProviderStatus.connectionState` | `CONNECTED` | Transport-layer connectivity indicated | The remote provider has been authenticated or verified |
| `StepStatus` | `COMPLETED` | The step lifecycle state is terminal-success | The step produced correct, validated output |

### 11.3 Source Metadata Requirement
Every status-bearing contract MUST include a `SourceMeta` with a `source: SourceClassification` field. UI rendering MUST display the source classification alongside the status — a status badge without its source classification is an incomplete and potentially misleading display.

```typescript
// From Phase A.3/A.4 SourceMeta contract:
export type SourceClassification =
  | 'REAL'         // Confirmed real system data
  | 'MOCK'         // Simulated test or placeholder data
  | 'ESTIMATED'    // Derived or inferred
  | 'UNAVAILABLE'; // Data source offline or unreachable
```

---

## 12. Approval Requirement Model

**Correction 2 Resolution:** Approval policy is not derived from privilege number alone. It is determined by an explicit `ApprovalRequirement` record.

$$\text{APPROVAL\_REQUIREMENT} \neq \text{PRIVILEGE\_NUMBER\_ONLY}$$

```typescript
export interface ApprovalRequirement {
  required: boolean;                    // Is approval required at all?
  source:
    | 'PRIVILEGE_POLICY'                // Required because privilege level >= threshold
    | 'RISK_CLASS'                      // Required because riskClass is PERSISTENT_CHANGE or CRITICAL
    | 'PROTECTED_RESOURCE'              // Required because a protected resource is in scope
    | 'USER_POLICY';                    // Required because user has explicitly configured approval for this task type
  preAuthorizable: boolean;             // May proceed without fresh approval if pre-authorization policy is active
  dualConfirmation: boolean;            // Requires two distinct confirmation events (L4 or protected resources)
}
```

### 12.1 Pre-Authorization Pathway
An L2 workflow with `ApprovalRequirement.preAuthorizable: true` MAY bypass the `WAITING_FOR_APPROVAL` state IF:
1. An active pre-authorization policy (`authorizationSource: USER_PREAUTHORIZED_POLICY`) covers the exact capability and resource scope.
2. The pre-authorization has not expired (`expiresAt > now`).
3. The `riskClass` is `REVERSIBLE` or lower.
4. No protected resource is in scope (protected resources always require explicit non-pre-authorized approval).

### 12.2 Approval Record SourceMeta Requirement
All approval records carry `SourceMeta`. An `ApprovalStatus=APPROVED` record with `source: MOCK` is a mock approval — it produces NO real host capability grant, NO real `ScopedAuthorization`, and NO real privilege elevation.

---

## 13. Artifact Contracts & Provenance

Artifacts generated by workflows are tracked with content integrity hashes and strict security metadata. All artifact references in UI and contracts use **logical Atlas URIs** to prevent arbitrary filesystem exposure.

### 13.1 Artifact URI Model

```typescript
export type ArtifactUri = `atlas://artifact/${string}`;
// Format: atlas://artifact/<artifact-id>
// Example: atlas://artifact/art_01H9X2K...
//
// Invariant: The UI MUST NOT auto-resolve ArtifactUri to filesystem reads or execution.
// ArtifactUri is a logical reference only.
// Resolution to an authorized filesystem path (if ever needed) requires an explicit,
// scoped authorization and a user-approved workflow step.
```

```typescript
export interface ArtifactSummary extends SourceMeta {
  artifactId: string;            // UUIDv7
  taskId: string;
  projectId: string;
  type: 'DOCUMENT' | 'REPORT' | 'DIFF' | 'TEST_RESULTS' | 'DATASET' | 'LOG' | 'CONFIG_PROPOSAL';
  filename: string;
  logicalUri: ArtifactUri;       // atlas://artifact/<artifact-id> — always logical
  authorizedResourceReference?: string | null; // Populated ONLY when scoped authorization active
  sha256: string;                // Content integrity hash (NOT a signature — see Section 9 Note)
  createdByAgentId: string;
  validationStatus: 'UNVALIDATED' | 'VALIDATED' | 'REJECTED';
  sensitivity: 'PUBLIC' | 'INTERNAL' | 'RESTRICTED';
  createdAt: string;
}
```

*Invariant:* Artifacts are passive data objects. The UI **NEVER** automatically executes or applies an artifact without an explicit, approved workflow step. The UI must NOT auto-resolve `logicalUri` to filesystem reads or command execution.

---

## 14. Standard AgentResult Contract & Audit Invariant

Every agent task completes by submitting a standard `AgentResult` envelope modeled after Atlas's proven audit conventions:

```typescript
export interface AgentResult extends SourceMeta {
  taskId: string;
  agentId: string;
  agentRole: AgentRole;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'REJECTED';
  objective: string;
  actionType: 'RESEARCH_ONLY' | 'SPECIFICATION_ONLY' | 'CODE_MODIFICATION' | 'VALIDATION_AUDIT';
  changesMade: string;           // Descriptive summary; NEVER "NONE" if files changed
  filesCreated: string[];
  filesModified: string[];
  filesDeleted: string[];
  commandsExecuted: string[];    // Log of proposed/executed commands
  testResultsSummary: string;
  findings: string[];
  risks: string[];
  errors: string[];
  rollbackSteps: string[];       // Explicit compensating actions
  recommendedNextStep: string;
  requiresUserApproval: boolean;
  approvalRequirement?: ApprovalRequirement;
  submittedAt: string;
}
```

### The Audit Invariant
$$\text{filesCreated.length} + \text{filesModified.length} + \text{filesDeleted.length} > 0 \implies \text{changesMade} \neq \text{"NONE"}$$
If any filesystem modification occurred, `changesMade` must contain a detailed descriptive summary of the modifications. Reporting `CHANGES_MADE: NONE` when files were altered is an audit violation.

---

## 15. Test Results & Failure Classification Taxonomy

### 15.1 Defect Classification Model
When a task or verification fails, Atlas distinguishes between the underlying failure causes:
- `PRODUCT_REGRESSION`: A previously passing feature broke due to recent changes.
- `TEST_DEFECT`: The test itself is faulty, stale, or poorly constructed.
- `ENVIRONMENT_RESTRICTION`: Execution failed due to intentional sandbox constraints (e.g. `ATLAS_SIN_RED=true` blocking external WAN). *Environment restrictions must NEVER silently become GREEN.*
- `PREEXISTING_FAILURE`: Defect identified as existing prior to the current task run.

### 15.2 WorkflowFailure Contract
```typescript
export interface WorkflowFailure extends SourceMeta {
  failureId: string;             // UUIDv7
  taskId: string;
  stepId?: string;
  category:
    | 'AGENT_TIMEOUT'
    | 'TOOL_ERROR'
    | 'VALIDATION_REJECTION'
    | 'POLICY_DENIAL'
    | 'APPROVAL_DENIED'
    | 'RESOURCE_EXHAUSTED'
    | 'NETWORK_UNAVAILABLE';
  severity: 'WARNING' | 'CRITICAL' | 'FATAL';
  message: string;
  recoverable: boolean;
  retryAllowed: boolean;
  requiresUserAction: boolean;
  occurredAt: string;
}
```

### 15.3 Safe Retry Policy
- **Read-Only Tasks (Level 0–1):** Automatic retry with exponential backoff is permitted (up to 2 retries).
- **Persistent Change Tasks (Level 2–4):** Automatic retries are strictly **FORBIDDEN**. Retrying a failed Level 3/4 operation requires re-evaluating policy, verifying system state, obtaining fresh human approval, and creating a new workflow instance.

---

## 16. Context Compiler & Resource Awareness

### 16.1 The Context Compiler Architecture
To avoid context bloat and token waste, the Orchestrator compiles a lean, scoped package for each agent rather than transmitting full conversation histories:

```typescript
export interface ContextPackageSummary {
  packageId: string;
  targetAgentId: string;
  targetRole: AgentRole;
  projectId: string;
  scopedObjective: string;
  hardConstraints: string[];
  relevantDecisions: string[];   // Top-3 semantic past decisions
  relevantFailures: string[];    // Negative knowledge (top known mistakes)
  requiredInterfaces: string[];  // AST-extracted symbol definitions
  tokenBudget: number;           // Clamped to agent tier ceiling
  compiledAt: string;
}
```

### 16.2 Local Host Resource Awareness (Mock-First UI)
The UI provides high-level visibility into host resource availability classes to explain routing decisions:
- **CPU Load Class:** `LOW (< 25%)` | `MODERATE (25-70%)` | `HIGH (> 70%)`.
- **RAM Availability Class:** `ABUNDANT (> 12 GiB)` | `CONSTRAINED (4-12 GiB)` | `CRITICAL (< 4 GiB)`.
- **Local Model Residency:** Identifies which routing tier is currently active in local RAM (abstract tier, not specific model identity in normative display).
- **Network State:** `LOOPBACK_ONLY (ATLAS_SIN_RED)` | `OFFLINE` | `UNAVAILABLE`.

---

## 17. Orchestration Timeline & Observability

### 17.1 Human-Readable Workflow Timeline
The Orchestration Center renders a clean, chronological event timeline for each workflow, hiding internal model scratchpads while exposing concrete operational milestones:

```text
[21:10:02] INTAKE: StructuredIntent int_01H... received from User (@AtlasWeb)
[21:10:05] PLANNING: TaskPlan pln_01H... generated (6 steps decomposed)
[21:10:08] ROUTING: Assigned agent_builder_01 [BUILDER] via FREE_FIRST (LOCAL_LARGE)
[21:10:12] RUNNING: Step 1 (Inspect project files) COMPLETED
[21:10:45] RUNNING: Step 2 (Draft memory optimization patch) COMPLETED -> atlas://artifact/art_01H9...
[21:10:50] HANDOFF: Transferred artifact to agent_validator_01 [VALIDATOR]
[21:11:15] VALIDATING: Step 3 (Invariant & test suite check) -> 80/80 test files PASS [EVIDENCE]
[21:11:20] VALIDATION_PASS: Attested by agent_validator_01 (Verdict: PASS) [source: MOCK]
[21:11:22] COMPLETED: Workflow finished successfully. 1 artifact produced.
```

> [!NOTE]
> **Timeline Display Rules:** (1) The source classification (`[source: MOCK]`) MUST appear alongside any status event in mock mode. (2) Test results are labeled `[EVIDENCE]` to distinguish them from independent validator attestation. (3) Agent IDs (not model names) are shown in the normative timeline. Specific model names may appear as informational annotations in the advanced inspector view only.

### 17.2 Operational Observability Metrics
The top of the Orchestration surface provides aggregate metrics:
- **Active Workflows:** Count of workflows in `RUNNING` or `VALIDATING`.
- **Queued Tasks:** Workflows awaiting agent assignment or scheduling.
- **Pending Approvals:** Workflows held at `WAITING_FOR_APPROVAL`.
- **Pending Validation:** Workflows awaiting validator attestation.
- **Routing Efficiency:** Ratio of Local/Free tasks vs. Cloud tasks.

---

## 18. UX Design & Progressive Disclosure

To remain intuitive for non-expert users while providing full depth for systems engineers, Phase A.5 adheres to **Progressive Disclosure**:

```
+-----------------------------------------------------------------------------------+
| SIMPLE VIEW (Default / Non-Expert)                                                |
| - Workflow Title & Project Badge                                                  |
| - High-level Progress Bar (e.g. "Step 3 of 6: Validating Changes")               |
| - Active Agent Chip ("agent_validator_01 [Validator]")                            |
| - Primary Status Badge ("RUNNING [MOCK]", "WAITING FOR APPROVAL")                |
| - Next Action / Recommended Step                                                  |
+-----------------------------------------------------------------------------------+
                                         | [Toggle "Inspect Workflow Details"]
                                         v
+-----------------------------------------------------------------------------------+
| ADVANCED VIEW (Engineer / Auditor Mode)                                           |
| - Complete Step Graph (DAG) with dependency lines [Desktop/Tablet only]           |
| - Exact Capability Requirements (filesystem.read, process.inspect)                |
| - Privilege Level & Protected Resource Scope (DEFAULT_DENY status shown)          |
| - Routing Policy Rationale & Local Model Tier & Memory Footprint                  |
| - Builder / Validator Attestation Records & Artifact SHA-256 Integrity Hashes    |
| - Epistemic Status Badges & Test Result Evidence Diagnostics                      |
| - Source Classification visible on ALL status fields                              |
+-----------------------------------------------------------------------------------+
```

---

## 19. Responsive Layout & Ergonomics

### 19.1 Desktop Command Layout ($\ge 1180\text{px}$)
- **Vortex Centerpiece:** Centered canonical Vortex ($380\text{px} \times 380\text{px}$ to $480\text{px} \times 480\text{px}$) acting as visual anchor.
- **Left Column (300px):** Active & Queued Workflow List, Filtered by Project.
- **Center-Right Stage:** Split-screen showing the Step Execution DAG and live Orchestration Timeline.
- **Right Column (320px):** Active Agent Card, Routing Breakdown, and Pending Approval Drawer.

### 19.2 Tablet Layout ($761\text{px}$ – $1179\text{px}$)
- **Vortex Centerpiece:** Scales to $260\text{px} \times 260\text{px}$.
- **Collapsible Panes:** Workflow list docks as a slide-out drawer; main stage presents active workflow execution graph and summary timeline.
- **DAG Visualization:** Step execution DAG is displayed in simplified form on large tablets ($\ge 900\text{px}$); linearized accordion on smaller tablets.

### 19.3 Mobile Viewport ($\le 760\text{px}$, e.g. $390 \times 844$)
- **Vortex Adaptation:** Compact bounding box ($200\text{px} \times 200\text{px}$ to $240\text{px} \times 240\text{px}$) anchored at upper viewport.
- **Card-Driven Navigation:** Workflows presented as stacked swipeable cards.
- **Step Accordion (DAG Linearization):** Complex branchable DAGs are strictly linearized into an expandable step accordion on mobile. Each step item displays status badge, agent role, capability badge, and action button. **No interactive panning canvas on mobile viewports.** This eliminates touch usability and accessibility issues with complex graph interactions on small screens.
- **Ergonomics:** Minimum touch target height of **48px** for all interactive buttons; strict `overflow-x: hidden`.

---

## 20. Accessibility (WCAG 2.1 AA)

- **Keyboard Navigation:** Full tab order cycling through workflow selector $\rightarrow$ step accordion/DAG $\rightarrow$ timeline items $\rightarrow$ action controls.
- **ARIA Semantics:**
  - `role="feed"` on workflow timelines with `aria-busy` indicators during active state transitions.
  - `role="status"` on workflow state changes announced via `aria-live="polite"`.
  - `role="alert"` on workflow failures or required approvals.
- **Non-Color-Only Indicators:** Statuses pair color with distinct icons (e.g. Checkmark for `COMPLETED`, Warning triangle for `BLOCKED`, Hourglass for `WAITING_FOR_APPROVAL`).
- **Reduced Motion:** If `prefers-reduced-motion: reduce` is active, step transitions and orbital pulse accelerations are suppressed, using instant opacity switches.
- **Mobile DAG Accessibility:** The linearized step accordion on mobile ($\le 760\text{px}$) is fully keyboard-navigable and screen-reader compatible. Each step is a distinct focusable region with explicit ARIA labels.

---

## 21. Phase A.5 Safety & Exclusion Boundaries

Phase A.5 explicitly and strictly excludes:
- **NO Real Shell or Subprocess Execution:** No `child_process.exec`, `spawn`, `forkpty`, or bash command calls.
- **NO Privilege Escalation:** The UI cannot grant real OS permissions (`sudo`, `root`, filesystem writes outside lab).
- **NO Public Network Listeners:** Network binding strictly restricted to `127.0.0.1`.
- **NO Real Financial Trading:** Broker bridges, MT5 connections, and order executions remain strictly `BLOCKED`.
- **NO External Production Messaging:** Zero production credentials or live connections to Telegram/Discord.
- **NO Unscoped Protected Resource Access:** `/home/luisangel/atlas` policy is `DEFAULT_DENY`. In Phase A.5, no active `ScopedAuthorization` is populated — effective access is denied.
- **NO Agent Self-Authorization:** No agent may create or approve its own `ScopedAuthorization` record.
- **NO Automatic Artifact Resolution:** `ArtifactUri` values are logical references; the UI does not auto-resolve them to filesystem paths or execute their contents.

---

## 22. Proposed Future Test Plan

When implementation is authorized in a subsequent phase, the test file `pruebas/prueba-phase-a5-orchestration-vortex.ts` will validate:

1. **Orchestration Surface Rendering:** Verify contextual workspace renders within TASKS and AGENTS sectors.
2. **StructuredIntent Normalization:** Validate user text normalizes into `StructuredIntent` without shell command exposure.
3. **TaskPlan Step Decomposition:** Assert multi-step plans render with dependencies and capability scopes.
4. **Workflow State Transitions:** Exercise all 12 `WorkflowStatus` transitions.
5. **Invalid Transition Rejections:** Assert all invalid transitions defined in Section 5.3 tables throw policy errors (`CANCELLED → RUNNING`, `COMPLETED → RUNNING`, `COMPLETED → READY`, `CANCELLED → READY`, etc.).
6. **TaskStatus vs. StepStatus Decoupling:** Assert container status transitions independently from granular step status.
7. **Agent Assignment Rendering:** Validate assignment cards display role, routing tier, and locality.
8. **Builder / Validator Identity Separation:** Assert `validatorAgentId != builderAgentId` is enforced at `ValidationSummary` construction. Assert a builder agentId cannot be used as `validatorAgentId` for the same task.
9. **Test Evidence != Validator Identity:** Assert that a `testResults.passed == total` record in `ValidationSummary` does NOT satisfy the independent validator identity requirement if `validatorAgentId == builderAgentId`.
10. **Agent Handoff Integrity Verification:** Validate `AgentHandoff` records transfer artifacts with SHA-256 content integrity hash. Assert hash mismatch raises artifact integrity error.
11. **Free-First Routing Cascade:** Validate Tier 0 → Tier 4 waterfall selection and policy rationale rendering. Assert tier labels (not model names) appear in normative routing display.
12. **Intelligence != Privilege Invariant:** Assert high routing tiers operate under Level 0/1 ambient restrictions.
13. **Capability != Privilege Invariant:** Assert privilege levels require fine-grained capability grants.
14. **Protected Resource DEFAULT_DENY:** Assert access to `/home/luisangel/atlas` is denied in the absence of an active `ScopedAuthorization`. Assert no `ScopedAuthorization` records exist in Phase A.5 mock data. Assert `L4 privilege alone` does NOT populate a `ScopedAuthorization`.
15. **Agent Self-Authorization Forbidden:** Assert any attempt to create a `ScopedAuthorization` where `authorizedBy == agentId` (of the requesting agent) is rejected.
16. **AuthorizationSource Enum Validation:** Assert all `ScopedAuthorization` records carry a valid `authorizationSource` from the defined enum. Assert `AGENT_SELF_AUTHORIZED` is not a valid value.
17. **Approval Pause State:** Assert workflows pause at `WAITING_FOR_APPROVAL` without executing commands.
18. **ApprovalRequirement Model:** Assert `ApprovalRequirement.source` is present and not derived from privilege number alone. Assert L2 pre-authorized bypass only applies when `preAuthorizable: true` AND valid pre-authorization policy exists AND `riskClass` is `REVERSIBLE` or lower.
19. **Validation Gate:** Assert workflows pause at `WAITING_FOR_VALIDATION` until a `ValidationSummary` with distinct `validatorAgentId` is issued.
20. **STATUS != EVIDENCE — Workflow:** Assert `WorkflowStatus=RUNNING + source=MOCK` does NOT produce real command execution.
21. **STATUS != EVIDENCE — Approval:** Assert `ApprovalStatus=APPROVED + source=MOCK` does NOT produce a real `ScopedAuthorization` or real host capability grant.
22. **STATUS != EVIDENCE — Validation:** Assert `ValidationStatus=PASS + source=MOCK` does NOT satisfy the independent validator identity requirement.
23. **Source Classification Display:** Assert all status-bearing UI elements render their `SourceMeta.source` classification alongside the status value.
24. **Failure & Defect Taxonomy:** Validate classification of `PRODUCT_REGRESSION` vs `ENVIRONMENT_RESTRICTION`.
25. **Safe Retry Policy:** Assert Level 3/4 tasks cannot auto-retry without re-approval and a new workflow instance.
26. **Project Context Isolation:** Assert workflows filter strictly by `projectId`.
27. **Artifact Logical URI:** Assert all artifact references use `atlas://artifact/<id>` URIs. Assert no `file://` paths appear in normative artifact displays. Assert UI does NOT auto-resolve `ArtifactUri` to filesystem reads.
28. **Artifact Integrity:** Validate artifact summaries carry SHA-256 content hashes without auto-execution.
29. **Routing Tier != Provider Identity:** Assert no specific model names appear in normative `AgentAssignment.routingTier` field. Assert tier labels from `RoutingTier` enum are used.
30. **Epistemic Quality Ladder:** Assert agent proposals do not silently become `FACT` or `USER_DECISION`.
31. **Audit Invariant:** Assert `changesMade` is never `NONE` if files were altered.
32. **Context Package Summary:** Validate compiled context bundles enforce token budget ceilings.
33. **No Hidden Prompt Exposure:** Assert internal system prompts are withheld from client DOM.
34. **Truthfulness Invariant:** Assert no unverified `RUNNING` or `VALIDATED` states render without source classification.
35. **No Shell Execution:** Verify zero execution paths to host shell or PTY.
36. **Loopback Only:** Verify daemon strictly binds to `127.0.0.1`.
37. **Offline Invariant:** Verify full local responsiveness under `ATLAS_SIN_RED=true`.
38. **Real Trading Blocked:** Assert trading actions remain `BLOCKED`.
39. **Dataset Integrity:** Assert canonical dataset SHA-256 remains unaltered.
40. **Phase A.4 Regressions Absent:** Assert all 28 A.4 acceptance criteria remain verified.
41. **Phase A.3 Regressions Absent:** Assert all A.3 operational sectors remain functional.
42. **Canonical Vortex Preserved:** Verify SVG centerpiece, 9 layers, and orbital animations remain intact.
43. **Mobile DAG Linearization:** Assert no interactive panning canvas renders on viewports $\le 760\text{px}$. Assert step accordion renders with full accessibility.
44. **Keyboard Accessibility:** Validate full WCAG 2.1 AA keyboard tab traversal including mobile accordion.
45. **Reduced Motion:** Validate immediate suppression of orbital animations when requested.
46. **Responsive Integrity:** Assert zero horizontal overflow across 390px, 768px, and 1200px viewports.
47. **Git Hygiene:** Verify zero unauthorized file changes.
48. **Invalid Transition Table Completeness:** Assert each forbidden transition in Section 5.3 tables raises a policy error, not a silent no-op.

---

## 23. Acceptance Criteria (A5-AC)

| ID | Criterion Description |
| :--- | :--- |
| **A5-AC-01** | Canonical Vortex from Phase A.2/A.3/A.4 remains the persistent visual and navigation centerpiece. |
| **A5-AC-02** | Orchestration Center is integrated as a contextual cross-module workspace within TASKS, AGENTS, and COMMUNICATIONS. |
| **A5-AC-03** | User communications requesting actions normalize into typed `StructuredIntent` entities; direct shell execution paths are blocked (`MESSAGE != COMMAND`). |
| **A5-AC-04** | Task plans decompose into discrete, dependency-tracked `TaskStep` objects with explicit capability scopes. |
| **A5-AC-05** | Workflow lifecycle enforces the 12-state `WorkflowStatus` state machine (`INTAKE` $\rightarrow$ `COMPLETED` / `FAILED` / `CANCELLED`). |
| **A5-AC-06** | Task container lifecycle (`TaskStatus`) and atomic step execution lifecycle (`StepStatus`) operate as independent, decoupled state machines. |
| **A5-AC-07** | Invalid workflow transitions defined in Section 5.3 are rejected with explicit policy errors. At minimum: `CANCELLED → RUNNING`, `COMPLETED → RUNNING`, `COMPLETED → READY`, `CANCELLED → READY`, `FAILED → COMPLETED` are forbidden. |
| **A5-AC-08** | Agent assignments explicitly record agent ID, functional role, routing tier, locality, and assignment rationale. |
| **A5-AC-09** | System supports extensible agent roles (`ORCHESTRATOR`, `BUILDER`, `VALIDATOR`, `SECURITY_REVIEWER`, `RESEARCHER`, `SPECIALIST`, `TEMPORARY_SPECIALIST`). |
| **A5-AC-10** | Builder/Validator identity separation is strictly enforced: `validatorAgentId != builderAgentId` is a required construction invariant of `ValidationSummary`. |
| **A5-AC-11** | Agent handoffs are recorded as explicit `AgentHandoff` envelopes with artifact content integrity hashes and transfer rationales. |
| **A5-AC-12** | Free-First routing cascade transparently displays `RoutingTier` (Tier 0–4) selection rationale. Normative routing display uses tier labels, not specific model or provider names. |
| **A5-AC-13** | Non-negotiable invariant $\text{INTELLIGENCE\_LEVEL} \neq \text{SYSTEM\_PRIVILEGE\_LEVEL}$ is enforced in contracts and UI badges. |
| **A5-AC-14** | Privilege levels (`L0`–`L4`) require fine-grained capability grants; a privilege level alone does not grant blanket permissions. |
| **A5-AC-15** | Protected resources apply `DEFAULT_DENY` policy. In Phase A.5, no active `ScopedAuthorization` records exist — effective access is denied. `L4 privilege alone` does NOT constitute a `ScopedAuthorization`. |
| **A5-AC-16** | Workflows requiring Level 2–4 privileges pause at `WAITING_FOR_APPROVAL` and integrate with the Phase A.4 Approval Inbox. L2 pre-authorized bypass requires `ApprovalRequirement.preAuthorizable: true` + active non-expired pre-authorization policy. |
| **A5-AC-17** | Approval interactions remain strictly mock-first and informational; clicking approve in mock mode does not grant live OS capabilities or produce a real `ScopedAuthorization`. |
| **A5-AC-18** | User-facing controls for Pause and Cancel update workflow lifecycle state without requiring host process killing. |
| **A5-AC-19** | Standard `AgentResult` envelope enforces the audit invariant: if files were modified, `changesMade` cannot be `NONE`. |
| **A5-AC-20** | Generated artifacts are referenced via `atlas://artifact/<id>` logical URIs; UI does not auto-resolve URIs to filesystem paths or command execution. Artifacts carry SHA-256 content integrity hashes. |
| **A5-AC-21** | Test failures distinguish between `PRODUCT_REGRESSION`, `TEST_DEFECT`, and `ENVIRONMENT_RESTRICTION`; environment restrictions do not silently become GREEN. |
| **A5-AC-22** | Workflow failure models enforce safe retries: read-only tasks may auto-retry; Level 3/4 operations cannot auto-retry without re-approval and a new workflow instance. |
| **A5-AC-23** | Epistemic status ladder ensures agent proposals do not silently promote to `FACT` or `USER_DECISION` without validation. |
| **A5-AC-24** | Context Compiler summaries enforce token budget caps and withhold internal system prompts from client viewports. |
| **A5-AC-25** | Orchestration timeline exposes clean operational milestones (with source classification labels) while hiding private model scratchpads. |
| **A5-AC-26** | Progressive disclosure provides a simplified overview for non-experts and an expandable inspector for systems engineers. |
| **A5-AC-27** | Responsive layout employs content-driven sizing across Desktop ($\ge 1180\text{px}$), Tablet ($761\text{px}$–$1179\text{px}$), and Mobile ($\le 760\text{px}$) with 48px touch targets. |
| **A5-AC-28** | WCAG 2.1 AA accessibility is verified for keyboard navigation, ARIA live feeds, non-color-only status badges, and reduced motion. |
| **A5-AC-29** | Local security baseline is maintained: loopback `127.0.0.1` binding only; `ATLAS_SIN_RED=true` fully operational; real trading `BLOCKED`. |
| **A5-AC-30** | Canonical historical dataset SHA-256 (`d9beb0a6e9c8f366f89403534daae3bb7754dc343e3d17eb148dc45eba3f627a`) remains unaltered. |
| **A5-AC-31** | All 80 existing top-level test files (1015 internal tests) continue passing with zero regressions. |
| **A5-AC-32** | Implementation approval is reserved strictly for ChatGPT / Atlas Orchestrator and the User following independent review. |
| **A5-AC-33** | Protected resource policy is `DEFAULT_DENY` (not `STRICT_DENY`); `ProtectedResourceScope` carries `defaultPolicy: 'DEFAULT_DENY'` with full scoped authorization fields (`taskScope`, `authorizationRequired`, `authorizationSource`, `authorizedBy`, `expiresAt`, `sourceMeta`). |
| **A5-AC-34** | `ScopedAuthorization` records are required for any protected resource access grant; they include `agentId`, `taskId`, `capability`, `resourceScope`, `authorizationSource`, `authorizedBy`, `authorizedAt`, `expiresAt`, and `ttlSeconds`. |
| **A5-AC-35** | `AGENT_SELF_AUTHORIZED` is categorically forbidden; agents cannot create or approve their own `ScopedAuthorization`. |
| **A5-AC-36** | `ApprovalRequirement` interface is present in `TaskPlan` and `AgentResult`; approval policy derives from `ApprovalRequirement.source`, not privilege number alone (`APPROVAL_REQUIREMENT != PRIVILEGE_NUMBER_ONLY`). |
| **A5-AC-37** | Non-negotiable invariant `STATUS != EVIDENCE` is enforced: status fields carry `SourceMeta` and UI renders source classification alongside every status badge. |
| **A5-AC-38** | `ValidationSummary` carries both `validatorAgentId` and `builderAgentId`; system enforces `validatorAgentId != builderAgentId` as a construction precondition. Test evidence (`testResults`) is labeled as evidence, not as validator identity. |
| **A5-AC-39** | All artifact references use `ArtifactUri` (`atlas://artifact/<id>`) logical URIs. No `file://` paths appear in normative artifact references. `authorizationSource` is required in `ScopedAuthorization`. |
| **A5-AC-40** | Mobile viewport ($\le 760\text{px}$) renders a linearized step accordion instead of an interactive panning DAG canvas. Step accordion is keyboard-navigable and screen-reader compatible. |

---

## 24. Full Green Gate Definition

Phase A.5 may only be declared `GREEN` when all of the following conditions are simultaneously verified on the local host:

```text
[PHASE A.5 GREEN GATE]
- Baseline Test Suite:                    80 / 80 test files PASS (1015 / 1015 tests PASS)
- New A.5 Test Suite:                     100% PASS (pruebas/prueba-phase-a5-orchestration-vortex.ts)
- Canonical Vortex Integrity:             PASS (SVG layers, viewBox, orbital animations preserved)
- A.4 Communication Surfaces:             PASS (All Phase A.4 contracts and UI tabs verified)
- A.3 Operational Sectors:               PASS (All 8 sectors operational and reachable)
- Invariant MESSAGE != COMMAND:           PASS (Normalized StructuredIntent enforced)
- Builder/Validator Identity Separation:  PASS (validatorAgentId != builderAgentId enforced at construction)
- TEST_EVIDENCE != VALIDATOR_IDENTITY:    PASS (Automated test PASS != independent validator identity)
- STATUS != EVIDENCE:                     PASS (Source classification visible alongside all status fields)
- Invariant Intelligence != Privilege:    PASS (Model tier does not elevate OS privilege)
- Capability != Privilege:               PASS (Fine-grained capability scoping verified)
- Protected Resource Auth Model:          PASS (DEFAULT_DENY enforced; no active ScopedAuthorization in Phase A.5 mock data)
- Agent Self-Authorization Blocked:       PASS (AGENT_SELF_AUTHORIZED forbidden and rejected)
- Approval Requirement Model:            PASS (ApprovalRequirement.source present; privilege number alone insufficient)
- Artifact URI Safety:                    PASS (atlas://artifact/ URIs only; no auto-resolution to filesystem)
- Routing Tier Abstraction:              PASS (RoutingTier enum used; provider identities absent from normative fields)
- Invalid Transition Enforcement:         PASS (All Section 5.3 forbidden transitions raise policy errors)
- Mobile DAG Linearization:              PASS (No panning canvas on ≤760px; accordion is accessible)
- Offline & Local Isolation:             PASS (ATLAS_SIN_RED=true, 127.0.0.1 only, zero external listeners)
- Financial Safety:                      PASS (Real trading strictly BLOCKED)
- Host Isolation:                        PASS (Zero shell execution, zero PTY, zero host write)
- Dataset SHA-256 Integrity:             MATCH (d9beb0a6e9c8f366f89403534daae3bb7754dc343e3d17eb148dc45eba3f627a)
- Git Hygiene:                           PASS (Zero unauthorized modifications outside scoped task files)
```

---

## 25. Resolved Open Questions

The following open questions from Draft 0.1 have been resolved and incorporated into this Draft 0.2:

| # | Question (Draft 0.1) | Resolution |
| :--- | :--- | :--- |
| **1** | On mobile viewports ($\le 760\text{px}$), should complex branchable DAGs be strictly linearized into an accordion sequence, or should operators be provided with a mini interactive panning canvas? | **Resolved:** Desktop and large tablets ($\ge 761\text{px}$): DAG visualization is displayed. Mobile ($\le 760\text{px}$): DAGs are strictly linearized into an expandable step accordion. No interactive panning canvas on mobile. See Section 19.3 and A5-AC-40. |
| **2** | In multi-step workflows, can a Validator agent begin analyzing Step 1 artifacts while a Builder agent is actively executing Step 2, or must validation strictly block downstream execution? | **Resolved:** Parallel/concurrent validation is conditionally permitted under strict DAG policy: (a) the DAG must explicitly permit parallel execution; (b) the downstream step (Step 2) must NOT depend on Step 1 being in `VALIDATED` status before starting; (c) the artifact being validated must be immutable and versioned with an integrity hash; (d) no privilege boundary may be crossed during parallel inspection; (e) project scope must remain unchanged. If Step B requires Step A = `VALIDATED`, Step B remains `BLOCKED` until validation completes. See Section 5.2, Validation Guardrail. |
| **3** | When mock artifacts are referenced in the UI, should they resolve strictly to relative URIs within the lab workspace, or should they use virtual memory URIs (`mem://artifact-id`) to prevent any host filesystem touching? | **Resolved:** All artifact references use `atlas://artifact/<artifact-id>` logical URIs. The `file://` scheme is NOT used in normative artifact references. `ArtifactSummary.logicalUri` is always an Atlas logical URI. An optional `authorizedResourceReference` field may be populated ONLY when an active `ScopedAuthorization` exists, but the UI must NOT auto-resolve this to filesystem reads or command execution. See Section 13 and A5-AC-20/A5-AC-39. |

---

## 26. Relationship to Atlas Remote Subsystem

Phase A.5 maintains strict architectural separation from the **Atlas Remote Lab Subsystem**:

| Dimension | Atlas Final UI — Phase A.5 | Atlas Remote Lab Subsystem |
| :--- | :--- | :--- |
| **Primary Scope** | Workflow visualization, step DAG rendering, mock-first contracts, task timeline. | Real OS daemon execution (`atlasd`), PTY broker, process sandboxing, remote networking. |
| **Runtime Context** | Browser DOM / Webview on `127.0.0.1`. | Background Linux system service / user daemon. |
| **Approvals & Privileges** | Renders approval state cards and mock consent events. | Enforces kernel-level Landlock LSM and cgroups v2 process constraints. |
| **Execution** | Purely descriptive: displays step intent and candidate diffs. | Executes sandboxed child processes within unshared Linux namespaces. |
| **Integration** | Consumes standard JSON workflow contracts from local backend. | Emits workflow telemetry and artifact hashes to local control plane. |

---

## 27. Implementation Complexity & Subsystem Estimates

| Subsystem | Complexity Rating | Primary Technical Rationale |
| :--- | :--- | :--- |
| **UI Components & Layout** | **MEDIUM** | Requires integrating the multi-pane workflow deck, step accordion (mobile), and DAG (desktop) within the existing responsive layout while preserving canonical Vortex depth. |
| **Data Contracts & Types** | **LOW-MEDIUM** | Clean TypeScript interfaces extending `SourceMeta` taxonomy, with additions for `ApprovalRequirement`, `ScopedAuthorization`, `AuthorizationSource`, `ArtifactUri`, and `RoutingTier`. |
| **State Machine Engine** | **MEDIUM** | Managing 3 orthogonal state machines (`WorkflowStatus`, `TaskStatus`, `StepStatus`) with strict guardrails, invalid transition enforcement (Section 5.3), and terminal state immutability. |
| **Test Suite (`prueba-a5`)** | **HIGH** | Comprehensive test coverage (48 behavioral scenarios) exercising state machines, failure modes, builder/validator identity separation, STATUS!=EVIDENCE, authorization model, routing tier abstraction, and mobile DAG linearization. |
| **Security & Isolation** | **LOW (UI Scope)** | Purely descriptive in Phase A.5; no host execution code written. |
| **Future Backend Integration** | **HIGH (Future Phase)** | Integrating live local model runtimes, cgroups v2 scheduling, and Landlock namespaces (deferred to future implementation phases). |

---

*Specification Draft 0.2 revised and submitted by ANTIGRAVITY.*
*All 1 blocker + 5 required corrections + 7 hardening items from independent review have been applied.*
*This specification is READY_FOR_FINAL_SPEC_REVIEW by ChatGPT / Atlas Orchestrator and Claude.*
*Do NOT mark APPROVED_FOR_IMPLEMENTATION_SPEC — that authorization is reserved for the Orchestrator and User.*
