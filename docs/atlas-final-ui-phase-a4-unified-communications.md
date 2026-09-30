# ATLAS FINAL UI — PHASE A.4
## SPECIFICATION: UNIFIED COMMUNICATIONS & NOTIFICATION VORTEX

| Metadata Field | Value |
|---|---|
| **PHASE** | ATLAS FINAL UI — PHASE A.4 |
| **CODENAME** | Unified Communications Vortex |
| **SPEC_VERSION** | 1.0 |
| **SPEC_STATUS** | READY_FOR_ORCHESTRATOR_APPROVAL |
| **BASELINE** | Phase A.3 GREEN (Operational Vortex, 77/77 test files PASS, 959/959 tests PASS) |
| **DATE** | 2026-09-27 |
| **AUTHOR / ROLE** | Antigravity (Architecture / UX / Systems Specification Agent) |
| **TARGET REVIEWERS** | ChatGPT / Atlas Orchestrator, Claude (Security), Codex (Implementation) |
| **OWNER** | Atlas Orchestrator / User |

> [!IMPORTANT]
> **GOVERNANCE & LIFECYCLE NOTICE:** This document is the canonical Specification Version 1.0, revised following independent security and architectural review (`APPROVE_WITH_REQUIRED_CORRECTIONS`). Its status is `READY_FOR_ORCHESTRATOR_APPROVAL`. It does NOT claim `APPROVED_FOR_IMPLEMENTATION_SPEC`—final implementation authorization is reserved strictly for ChatGPT / Atlas Orchestrator and the User. No product code, test code, or datasets have been modified in this specification task.

---

## 1. Executive Summary & Core Product Concept

Phase A.3 established the Canonical Vortex as an **Operational Vortex**, introducing read-only, mock-first visibility into core system health, registered agents, task queues, and security privilege tiers.

Phase A.4 extends this foundation into the **Unified Communications & Notification Vortex**. The objective is to provide a unified, provider-independent communication and notification surface that brings together:
1. Multi-turn human-to-Atlas conversations across channels (Web/Mobile, Telegram, Discord, WhatsApp).
2. Transparent agent-to-agent and agent-to-orchestrator collaboration streams.
3. Priority-tiered notification queues (system alerts, task completions, security warnings).
4. Informational, mock-first approval inboxes for proposed actions.
5. Real-time provider connectivity truthfulness with strict separation between connection state and verification state.

```
+===================================================================================+
|                                    USER                                           |
|       (Atlas Web / Mobile Client, Telegram, Discord, WhatsApp, Local Desktop)     |
+===================================================================================+
                                         |
                                         v
+===================================================================================+
|                         ATLAS FINAL UI (PHASE A.4)                                |
|  - Canonical Vortex Centerpiece          - Unified Communication Surface          |
|  - Priority Notification Center          - Informational Approval Inbox (Tab)     |
|  - Truthfulness & Verification Badges    - Isolated Project Context Switcher      |
+===================================================================================+
                                         |
                                         v
+===================================================================================+
|                     UNIFIED CONVERSATION & EVENT LAYER                            |
|             (Provider-Agnostic Canonical Envelope & Task Linker)                  |
+===================================================================================+
                                         |
                                         v
+===================================================================================+
|                              ATLAS ORCHESTRATOR                                   |
|                      (Policy, Task Planning, Arbitration)                         |
+===================================================================================+
                                         |
            +----------------------------+----------------------------+
            |                            |                            |
            v                            v                            v
   [Codex Implementer]          [Claude Validator]         [Antigravity Architect]
```

### Inviolable Invariant
$$\text{MESSAGING\_IS\_NOT\_A\_TERMINAL}$$
Under no circumstances may a message entered in the chat interface bypass structured task scheduling, policy engines, and capability checks to execute as a raw operating system shell command. Messages are semantic requests for intent resolution—never shell commands.

---

## 2. Backward Compatibility with Phase A.3 Baseline

Phase A.4 is strictly additive and must preserve all validated guarantees of Phase A.3 without regressions:

1. **Canonical Vortex Centerpiece:** The `#canonical-vortex` SVG element, its exact `viewBox`, class names, ARIA accessibility bindings, nine visual layers, and smooth orbital animations remain the central visual and functional anchor of the interface.
2. **Operational Sector Navigation:** The eight operational sectors introduced in Phase A.3 (`CORE`, `AGENTS`, `TASKS`, `SYSTEM`, `KNOWLEDGE`, `SECURITY`, `ACTIVITY`, `FREE_FIRST`) remain intact. Communications and Notifications are integrated as dedicated contextual surfaces radiating from or docking alongside the Vortex.
3. **Truthfulness and Provenance Standard:** Every single piece of data continues to carry explicit provenance and freshness tags (`source: REAL | VERIFIED | MOCK | SIMULATED | UNAVAILABLE` and `freshness: FRESH | STALE | OFFLINE | UNAVAILABLE`).
4. **Offline and Security Baseline:**
   - Strict loopback binding: `127.0.0.1` only. Zero public IP listeners.
   - Network isolation: `ATLAS_SIN_RED=true` fully supported.
   - Financial safety: Real trading remains strictly `BLOCKED`.
   - OS safety: Zero host shell execution paths, zero PTY spawns, zero privilege escalations.
   - Deterministic dataset integrity: Dataset SHA-256 (`d9beb0a6e9c8f366f89403534daae3bb7754dc343e3d17eb148dc45eba3f627a`) remains identical.

---

## 3. Communication Center Surface

The Communication Center provides an ergonomic, high-density conversational interface embedded within the expanded Vortex layout.

### 3.1 Structural Components
- **Conversation Selector / Thread List:** Displays active and historical conversation threads, sorted by recent activity:
  - Thread Title / Active Goal.
  - Active Project Badge (e.g. `[ATLAS REMOTE]`, `[TRADING LAB]`).
  - Originating / Primary Channel Icon (Web, Telegram, Discord, WhatsApp).
  - Unread Message Counter.
  - Timestamp of latest activity.
- **Active Thread Header:**
  - Conversation Title & Logical ID (`cnv_01H...`).
  - Active Task Association (e.g., `Task: #AR-204 (RUNNING)`).
  - Participant Badges: Human user, Orchestrator, active assigned agents.
  - Verification & Security State indicator.
- **Message Stream Viewport:** High-density conversation timeline supporting multi-role envelopes with distinct visual treatment for Human, Orchestrator, Agent, and System messages.
- **Semantic Message Input Bar:**
  - Placeholder: `"Ask Atlas or describe a task..."`
  - Explicit visual reminder: `"Messages create structured tasks. Shell execution is blocked."`
  - Attachment preview chip (for mock/future files).
  - Quick action chips: `[Status]`, `[Review Active Tasks]`, `[Summarize Decisions]`.

### 3.2 Dual-Axis Lifecycle Architecture: DeliveryStatus vs. ProcessingStatus
To prevent conflating network transport states with agent orchestration progress, Phase A.4 formally separates message lifecycle tracking into two independent, orthogonal state machines:

```
[TRANSPORT LIFECYCLE: DeliveryStatus]
      +-------------------------------------------------------------+
      |                                                             |
      v (Client draft / Offline)                                    |
 [LOCAL_ONLY] ---------> [OUTBOUND_QUEUED]                          |
                             |                                      |
                             v (Network dispatch)                   |
                         [SENDING]                                  |
                             |                                      |
               +-------------+-------------+                        |
               |                           |                        |
               v (Provider ACK)            v (Transport failure)    |
          [DELIVERED]                   [FAILED]                    |
                                           |                        |
                                           v                        |
                                      [RETRYING] -------------------+

[ORCHESTRATION LIFECYCLE: ProcessingStatus]
 [RECEIVED] (Ingested by Orchestrator)
     |
     v
  [QUEUED] (Decomposed; awaiting agent assignment)
     |
     v
[PROCESSING] (Agent actively reasoning / running tool)
     |
     +------------+------------+
     |                         |
     v (Result generated)      v (Validation rejection / policy breach / timeout)
[RESPONDED]                 [FAILED]
```

#### Transition Invariants & Rules:
1. **DeliveryStatus Invariants:**
   - `LOCAL_ONLY` is a valid terminal state when `ATLAS_SIN_RED=true` is enabled. It may only transition to `OUTBOUND_QUEUED` if network connectivity is verified.
   - `OUTBOUND_QUEUED` $\rightarrow$ `SENDING` $\rightarrow$ `DELIVERED` represents the normal delivery flow.
   - Direct transitions from `LOCAL_ONLY` to `DELIVERED` without a verified network transport are strictly **FORBIDDEN**.
   - Direct transitions from `FAILED` to `DELIVERED` without passing through `RETRYING` or `SENDING` are **FORBIDDEN**.
2. **ProcessingStatus Invariants:**
   - `RECEIVED` $\rightarrow$ `QUEUED` $\rightarrow$ `PROCESSING` $\rightarrow$ `RESPONDED` represents normal forward execution.
   - A task cannot reach `RESPONDED` directly from `RECEIVED` without passing through `PROCESSING`.
   - A message whose `deliveryStatus` is `FAILED` may still reach `processingStatus: RESPONDED` locally if local execution succeeded but external outbound relay failed.

---

## 4. Notification Center Surface

The Notification Center is a high-visibility, filtered event stream designed to capture attention for critical events without causing alert fatigue.

### 4.1 Notification Categories & Severity Matrix
Notifications are strictly classified into categories and severity tiers:

| Category | Typical Trigger | Default Severity | Actionable? | Example UI Summary |
| :--- | :--- | :--- | :--- | :--- |
| `APPROVAL_REQUIRED` | Task requests Level 2–4 action | **CRITICAL** | Yes (Review in Inbox) | *"Task #AR-104 requests Level 3 permission: Update package config"* |
| `SECURITY_WARNING` | Path access violation or replay | **CRITICAL** | Yes (Acknowledge) | *"Blocked unauthorized access attempt to /home/luisangel/atlas"* |
| `TASK_FAILED` | Agent timeout or validation fail | **WARNING** | Yes (Inspect / Retry) | *"Task #TL-082 failed: Walkforward test divergence"* |
| `KNOWLEDGE_CONFLICT`| Contradictory operational facts | **WARNING** | Yes (Arbitrate) | *"Contradiction detected between Decision D-12 and Report R-44"* |
| `SYSTEM_WARNING` | High RAM or storage disconnect | **WARNING** | No (Informational) | *"Storage buffer free space below 15%"* |
| `AGENT_OFFLINE` | Agent missed 3 heartbeats | **WARNING** | No (Informational) | *"Local agent Ollama-7B unresponsive; falling back to micro tier"* |
| `TASK_COMPLETE` | Task completed & validated | **INFO** | No (View Result) | *"Task #AR-201 completed successfully. 12 files verified."* |
| `PROJECT_UPDATE` | Project state baseline shifted | **INFO** | No (Dismiss) | *"Trading Lab baseline updated to Phase 3B.3"* |
| `AGENT_AVAILABLE` | New agent registered on node | **INFO** | No (Dismiss) | *"Agent Codex-Local registered on node_ws_01"* |
| `ROUTING_ESCALATION`| Task escalated across tiers | **INFO** | No (Informational) | *"Task #AR-209 escalated from LOCAL_MICRO to CLOUD_STANDARD"* |

### 4.2 Tri-Partite Event Demarcation
To avoid cognitive clutter and redundant UI surfaces, Phase A.4 establishes crisp boundaries between three operational views:
1. **Conversation Center:** Focused exclusively on *human-readable dialog*, user prompts, and agent explanations.
2. **Activity Timeline (Phase A.3):** Continuous, chronological *operational telemetry* (e.g. process heartbeats, CPU checks, routine task state updates).
3. **Notification Center (Phase A.4):** Filtered, *attention-demanding exceptions* and completions requiring awareness or human decision.

---

## 5. Informational Approval Inbox (Dedicated Tab Surface)

### 5.1 UX Architectural Decision
Following independent architectural review, the Approval Inbox is formally resolved as:
$$\text{Approval Inbox} = \text{Dedicated Tab / Sub-surface inside the Communication Center}$$

#### Rationale:
1. **Preservation of the Canonical 8-Sector Vortex:** The 8 operational sectors established in Phase A.3 are maintained without architectural fragmentation.
2. **Context Co-Location:** Approvals are naturally paired with active conversation threads, task drawers, and agent proposals. Operators can review code diffs and conversational explanations without context switching.
3. **Non-Disruptive Workflow:** Avoids forced modal popups that interrupt operational monitoring. Operators navigate between `[Messages]`, `[Notifications]`, and `[Approval Inbox]` via clean, keyboard-accessible tabs.

### 5.2 Architecture & Safety Mandate
> [!CAUTION]
> **SAFETY INVARIANT:** In Phase A.4, the Approval Inbox is **MOCK-FIRST, INFORMATIONAL, and NON-EXECUTING**. Clicking "Approve" or "Deny" in this phase updates local UI state fixtures and records a mock audit event. An Approval card **must never directly grant host privileges, execute shell commands, alter operating system permissions, or trigger live backend executions**.

### 5.3 Approval Record Anatomy
Each approval card in the inbox renders:
- **Approval ID:** `app_01H...` (UUIDv7 format).
- **Associated Task:** `#AR-104` with clickable reference to the task drawer.
- **Requesting Agent:** Identity badge (e.g., `Codex (MOCK)` or `Claude (SIMULATED)`).
- **Target Project:** Isolated badge (`ATLAS REMOTE` or `TRADING LAB`).
- **Requested Privilege Level:** Distinct visual tag (`L0`, `L1`, `L2`, `L3`, or `L4` with color-coded warning).
- **Requested Capability & Resource:** Exact operation and target path (e.g., `capability: write_file`, `resource: /tmp/scratch/build.log`).
- **Safety Pre-Check Verdict:** Static verification result (e.g., `"Target path outside /home/luisangel/atlas: PASS"`).
- **Rationale:** Natural language explanation submitted by the proposing agent.
- **Time-to-Live / Expiration:** Active countdown timer (e.g., `Expires in 12m 45s`).
- **Action Buttons:** `[Approve (UI Mock)]`, `[Deny (UI Mock)]`, `[Inspect Full Diff]`.

---

## 6. Unified Conversations & Cross-Channel Continuity

Atlas must maintain a single, coherent conversation state regardless of the physical device or chat service utilized by the user.

```
+-----------------------------------------------------------------------------------+
|                            CANONICAL CONVERSATION THREAD                          |
|                            ID: cnv_01H9Y78PQ4Z...                                 |
|                            Project: ATLAS REMOTE                                  |
+-----------------------------------------------------------------------------------+
       |                                      |                               |
       v                                      v                               v
[Event 1: Atlas Web]               [Event 2: Telegram Bot]         [Event 3: Atlas Web]
User: "Run unit tests              Atlas: "Tests running.          User: "Show failure
       for parser."                 1 failure detected."                  diff."
Provider: ATLAS_WEB                Provider: TELEGRAM              Provider: ATLAS_WEB
Sender: usr_luisangel              Sender: agent_orchestrator      Sender: usr_luisangel
Channel: Web Session               Channel: @AtlasControlBot       Channel: Web Session
```

### 6.1 State Reconciliation Rules
1. **Single Source of Truth:** The logical thread (`conversation_id`) is stored in the local control plane. Provider-specific message IDs (`telegram_msg_4590`, `discord_msg_1048`) are mapped as external reference pointers.
2. **Channel Switching:** When a user switches from Desktop Web to Telegram, sending a message automatically appends to the active project conversation thread.
3. **Context Hydration:** Opening the Atlas Web UI retrieves all messages across all providers associated with that thread, rendering them in strict chronological sequence.

---

## 7. Provider Truthfulness & State Separation

### 7.1 The Blocker Resolution: Decoupled Connection & Verification Dimensions
In Draft 0.1, transport connectivity (`CONNECTED`) was conflated with security verification (`VERIFIED`). This created a dangerous vulnerability where an unverified network socket could be visually rendered as trusted.

Phase A.4 Spec 1.0 strictly decouples provider status into three independent dimensions:

```typescript
export interface ProviderStatus extends SourceMeta {
  provider: ChannelProviderType;
  displayName: string;
  connectionState: 'MOCK' | 'SIMULATED' | 'OFFLINE' | 'UNAVAILABLE' | 'CONNECTING' | 'CONNECTED';
  verificationState: 'MOCK' | 'UNKNOWN' | 'UNVERIFIED' | 'VERIFIED';
  endpointMode: 'LOOPBACK' | 'UNAVAILABLE';
  activeWebhook: boolean;
  lastHeartbeat: string | null;
  unacknowledgedCount: number;
}
```

### 7.2 The Non-Escalation Invariant
$$\text{connectionState} = \text{CONNECTED} \centernot\implies \text{verificationState} = \text{VERIFIED}$$

#### Mandatory Rules:
1. **Independent State Evaluation:** A provider where `connectionState = CONNECTED` and `verificationState = UNVERIFIED` (e.g. an active raw connection with an untrusted external endpoint) must be visually rendered with an Amber/Warning badge: `CONNECTED (UNVERIFIED)`. It must **NEVER** inherit trusted status.
2. **No False Offline Verification:** `verificationState = VERIFIED` (e.g. valid cryptographic token on disk) does NOT imply network connectivity. If the network is down, it renders as `OFFLINE (CREDENTIAL_VERIFIED)`.
3. **Prohibited Escalations:** No UI transformation or mock adapter may silently escalate:
   - `MOCK` $\rightarrow$ `VERIFIED` (FORBIDDEN)
   - `SIMULATED` $\rightarrow$ `REAL` (FORBIDDEN)
   - `CONNECTED` $\rightarrow$ `VERIFIED` (FORBIDDEN)
   - `UNAVAILABLE` $\rightarrow$ `ONLINE` (FORBIDDEN)
4. **Baseline Invariant:** In Phase A.4, all external chat providers (Telegram, Discord, WhatsApp) default visibly to `connectionState: UNAVAILABLE` (or `MOCK`) and `verificationState: UNVERIFIED` (or `MOCK`).

---

## 8. Message Safety, Trust & Secret Redaction Boundaries

### 8.1 Architectural Secret Boundary: Defense-in-Depth
> [!IMPORTANT]
> **MANDATORY SECURITY DIRECTIVE:** Client-side sanitization is **DEFENSE-IN-DEPTH ONLY**. The UI is NOT the primary secret-protection boundary. 
>
> The system must enforce that secret detection, redaction, and sanitization occur upstream at the Provider Adapter and Backend Persistence boundary before any message is committed to storage:

```
Provider Adapter / Ingress Boundary
             ↓
     Input Validation
             ↓
[Upstream Secret Detection & Redaction Engine]
 - Scans for API keys, bearer tokens, passwords, cookies,
   private keys, recovery codes, session tokens/JWTs
             ↓
  Canonical Sanitized Message Envelope
             ↓
     Safe Persistence (Encrypted Local WAL)
             ↓
  [Atlas Final UI Rendering Layer]
   - Output Escaping (HTML entities)
   - Sanitized Markdown subset parser
   - Secondary Client-Side Redaction (Defense-in-Depth)
```

#### Protected Secret Classes:
The upstream boundary must actively redact:
- API keys (OpenAI, Anthropic, Google, AWS, Stripe).
- Bearer authorization headers and OAuth access tokens.
- Unix passwords, hash strings, and sudo credentials.
- Browser session cookies, PASETOs, and JWTs.
- Private keys (Ed25519, RSA, ECDSA, SSH, TLS, PGP).
- Account recovery codes and multi-factor seed strings.
- Embedded credentials inside code blocks, attachments, or diffs.

*Note: No production database persistence is implemented in Phase A.4; this specification establishes the mandatory data contract and boundary invariants for future implementation.*

### 8.2 Ingress Adversarial Protections (UI Contracts)
- **Replay Window Enforcement:** Visual tag `STALE_REPLAY` if message timestamp differs from arrival time by $> 300\text{s}$.
- **Duplicate Detection:** Duplicate message IDs render with a warning badge: `[DUPLICATE IGNORED]`.
- **Sender/Provider Mismatch:** If an external user ID does not match the canonical identity binding, render: `[UNTRUSTED SENDER MISMATCH]`.

### 8.3 Provider Markup Normalization Boundary
To prevent script injection, CSS exploits, and provider-specific markup leakage into the UI layer, Phase A.4 mandates that all provider formatting is normalized upstream before reaching the UI:

```
Telegram HTML / Discord Markdown / WhatsApp Text
                      ↓
  [Provider Adapter Normalization Filter]
   - Strips raw HTML (<script>, <iframe>, <style>, <div>)
   - Validates URI protocols (blocks javascript:, data:, file:)
   - Translates bold/italic/code into Canonical Markdown
                      ↓
     Canonical Safe Markdown Subset
                      ↓
        [Atlas Final UI Renderer]
```

#### Selected Representation: Constrained Sanitized Markdown Subset
Phase A.4 adopts a **tightly constrained sanitized Markdown subset** (`CanonicalMarkdownSubset`):
- **Why Constrained Markdown?** Markdown is declarative, vendor-neutral, deterministic, and natively supported across desktop, terminal, and mobile viewports. Unlike raw HTML or complex custom JSON ASTs, a constrained subset can be rendered safely via deterministic tokenization without risking DOM-based script injection or unexpected CSS reflows.
- **Allowed Elements:** Bold (`**text**`), Italic (`*text*`), Code spans (`` `code` ``), Fenced code blocks with language identifiers (```` ```python ... ``` ````), Unordered lists (`- item`), Ordered lists (`1. item`), Blockquotes (`> text`), and Sanitized HTTPS links (`[label](https://...)`).
- **Strictly Prohibited:** Raw HTML tags, `javascript:` URLs, `data:` base64 URIs, inline CSS styles, external image inclusions, and unescaped entity sequences.

---

## 9. Transparent Multi-Agent Communication

Phase A.4 makes multi-agent collaboration visible to the user without overwhelming the interface with uncurated raw internal reasoning:

```
+-----------------------------------------------------------------------------------+
| User                                                                              |
| "Optimize the historical dataset loader for memory efficiency."                   |
+-----------------------------------------------------------------------------------+
       |
       v
+-----------------------------------------------------------------------------------+
| Atlas Orchestrator                                                                |
| "Decomposed into 2 subtasks: [1] Memory profiling (Codex), [2] Security review   |
| (Claude). Assigning Task #AR-301."                                                |
+-----------------------------------------------------------------------------------+
       |
       v
+-----------------------------------------------------------------------------------+
| Codex [IMPLEMENTER]                                                               |
| "Proposed Patch: Stream chunks in 64KB buffers. Reduced peak RAM by 42%.          |
|  Artifact: patch_v1.diff (SHA: 8f2a...)"                                          |
+-----------------------------------------------------------------------------------+
       |
       v
+-----------------------------------------------------------------------------------+
| Claude [VALIDATOR]                                                                |
| "Verification: Buffer bounds checked. No path traversal risks detected.           |
|  All 77 test suites PASS. Verdict: APPROVED."                                     |
+-----------------------------------------------------------------------------------+
```

### Presentation Guidelines
- **Hidden Chain-of-Thought:** Internal token scratchpads and system prompts are withheld from the primary viewport to maintain clean readability.
- **Visible Artifacts:** Artifact summaries, diff links, execution logs, exit codes, and validation signatures are rendered as clean, expandable cards.

---

## 10. Project Context & Strict Boundary Isolation

Atlas manages multiple concurrent initiatives (e.g., `ATLAS REMOTE`, `TRADING LAB`, `BUSINESS LAB`). Cross-project contamination must be visually and logically prevented.

### 10.1 Visual Context Demarcation
- Every conversation thread, notification, task, and approval carries a prominent **Project Badge**:
  - `[ATLAS REMOTE]` (Blue-Cyan accent border)
  - `[TRADING LAB]` (Violet-Magenta accent border)
  - `[CORE SYSTEM]` (Cool-White accent border)
- **Project Switcher:** The Communication Center header includes an explicit Project Scope dropdown (`All Projects`, `Atlas Remote`, `Trading Lab`). Selecting a project filters conversations, notifications, and tasks strictly to that namespace.
- **Cross-Project Linking Warning:** If a task in `ATLAS REMOTE` references an artifact from `TRADING LAB`, the UI displays a yellow warning chip: `[CROSS-PROJECT REFERENCE]`.

---

## 11. Free-First & Adaptive Routing Visibility

The UI reflects the underlying intelligence routing engine without confusing intelligence tiers with system permissions.

### 11.1 Routing Visual Indicators
For every agent-generated response or active task, the UI displays a compact informational chip:
- `[ROUTE: LOCAL_MICRO (0.5B)]` — Local, zero-cost, instant triage.
- `[ROUTE: LOCAL_LARGE (7B)]` — Local Ollama execution, zero-cost.
- `[ROUTE: CLOUD_STANDARD]` — Cloud Codex/Sonnet inference, metered cost.
- `[ROUTE: CLOUD_SPECIALIST]` — Cloud Claude Opus high-reasoning, security audit.
- `[FREE_FIRST: ACTIVE]` — Visual badge indicating free/local preference is enforced.

### 11.2 Core Architectural Axiom
$$\text{INTELLIGENCE LEVEL} \neq \text{SYSTEM PRIVILEGE LEVEL}$$
A cloud-based frontier model (`CLOUD_SPECIALIST`) displays the same strict Level 0/1 ambient permissions as a local 0.5B model. Selecting a higher intelligence tier in the UI never increases system execution privileges.

---

## 12. Rich Media & Attachment Contracts (Future Support)

While Phase A.4 does not implement binary media decoders, it establishes standard data contracts for rendering attachment cards:

### 12.1 Supported Media Classes
- **Voice Message Capsule:** Renders waveform placeholder, duration indicator (e.g. `0:42`), transcription preview, and provenance badge (`Whisper-Local (MOCK)`).
- **Code Snippet / Diff Card:** Syntax-highlighted block with copy button, line count, language identifier, and SHA-256 integrity hash.
- **Document / Report Capsule:** File icon, filename (e.g. `audit-report.md`), byte size, MIME type, and quarantine security status (`QUARANTINED`, `SCANNED_SAFE`, `UNVERIFIED`).
- **Data Capsule:** Structured tabular data or JSON preview with expandable schema inspector.

---

## 13. Offline-First UX & Network Degradation

When the host environment runs with `ATLAS_SIN_RED=true` or loses external network access:

1. **Explicit Offline Status:** The top status bar renders `OFFLINE MODE (ATLAS_SIN_RED)`.
2. **Outbox Staging:** Outgoing messages to external providers display state `[OUTBOUND_QUEUED (LOCAL)]` or `[LOCAL_ONLY]`.
3. **No False Delivery Invariant:** A message **NEVER** transitions to `DELIVERED` or `SENT` for Telegram/Discord while offline or operating under `ATLAS_SIN_RED=true`.
4. **Local Responsiveness:** Local conversations, task browsing, approval inspections, and local agent interactions function seamlessly without latency or error modals.

---

## 14. Responsive Layout & Ergonomics

Rather than imposing arbitrary fixed percentage constraints, Phase A.4 specifies **content-driven responsive breakpoints** that maintain canonical Vortex visibility while optimizing ergonomics across form factors:

### 14.1 Desktop Command Layout ($\ge 1180\text{px}$)
- **Vortex Centerpiece:** Centered canonical Vortex with a dynamic bounding box ($380\text{px} \times 380\text{px}$ to $480\text{px} \times 480\text{px}$), maintaining orbital layer depth.
- **Left Panel (280px–320px):** Conversation thread list, Project Switcher, Channel Filters.
- **Right Panel (320px–360px):** Priority Alerts, Approval Inbox Tab, Active Task Context, Routing State.
- **Lower Viewport:** High-density conversation timeline and semantic input bar.

### 14.2 Tablet Intermediate Layout ($761\text{px}$ – $1179\text{px}$)
- **Vortex Centerpiece:** Scales to a compact bounding box ($260\text{px} \times 260\text{px}$ to $320\text{px} \times 320\text{px}$).
- **Collapsible Drawers:** Left thread selector and right approval panels collapse into swipeable overlay drawers.
- **Central Focus:** Conversation stream expands to full content width with docked input controls.

### 14.3 Mobile Viewport ($\le 760\text{px}$, e.g. $390 \times 844$)
- **Vortex Adaptation:** Compact bounding box ($200\text{px} \times 200\text{px}$ to $240\text{px} \times 240\text{px}$) anchored at the upper-center, remaining visible without pushing conversation controls below the fold.
- **Tabbed Segmented Navigation:** Seamless switching between `[Chat]`, `[Alerts]`, `[Approvals]`, and `[Vortex View]`.
- **Ergonomic Standards:** Minimum touch target height of **48px** for all interactive elements; strict prevention of horizontal scrolling (`overflow-x: hidden`).

---

## 15. Accessibility & Readability (WCAG 2.1 AA)

- **Keyboard Navigation:** Full tab order cycling through conversation selector $\rightarrow$ message viewport $\rightarrow$ input bar $\rightarrow$ approval actions.
- **ARIA Semantics:**
  - `role="log"` on message streams with `aria-live="polite"`.
  - `role="alert"` on Critical notifications.
  - `aria-expanded` and `aria-controls` on approval inspection drawers.
  - Distinct ARIA labels for connection status vs verification status.
- **Color Contrast:** All text elements exceed 4.5:1 contrast against `#02050A` background.
- **Reduced Motion:** If `prefers-reduced-motion: reduce` is detected, orbital message particle animations and expansion transitions are suppressed, replacing transitions with instant opacity fades.

---

## 16. UI Data Contracts (TypeScript Interfaces)

The following interfaces define the canonical UI contract for Phase A.4:

```typescript
export type SourceClassification = 'REAL' | 'VERIFIED' | 'MOCK' | 'SIMULATED' | 'UNAVAILABLE';
export type FreshnessState = 'FRESH' | 'STALE' | 'OFFLINE' | 'UNAVAILABLE';
export type PrivilegeLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';
export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type ChannelProviderType = 'ATLAS_WEB' | 'ATLAS_MOBILE' | 'TELEGRAM' | 'DISCORD' | 'WHATSAPP' | 'LOCAL_SYSTEM';

/**
 * Dedicated Transport/Delivery Lifecycle Status
 */
export type DeliveryStatus = 
  | 'LOCAL_ONLY' 
  | 'OUTBOUND_QUEUED' 
  | 'SENDING' 
  | 'DELIVERED' 
  | 'FAILED' 
  | 'RETRYING';

/**
 * Dedicated Orchestration/Task Processing Lifecycle Status
 */
export type ProcessingStatus = 
  | 'RECEIVED' 
  | 'QUEUED' 
  | 'PROCESSING' 
  | 'RESPONDED' 
  | 'FAILED';

export interface SourceMeta {
  source: SourceClassification;
  freshness: FreshnessState;
  observedAt: string | null;     // ISO-8601
  provenance: string;            // Safe descriptive origin; never credentials
}

export interface AttachmentSummary {
  attachmentId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256?: string;
  securityScanStatus: 'PENDING' | 'CLEAN' | 'QUARANTINED' | 'UNCHECKED';
  previewUrl?: string;
}

export interface MessageEnvelope extends SourceMeta {
  messageId: string;             // UUIDv7
  conversationId: string;        // UUIDv7
  senderType: 'HUMAN' | 'ORCHESTRATOR' | 'AGENT' | 'SYSTEM';
  senderId: string;              // "usr_luisangel", "agent_codex", etc.
  senderDisplayName: string;
  channelType: ChannelProviderType;
  externalMessageId?: string;    // Raw ID from Telegram/Discord
  content: string;               // Normalized CanonicalMarkdownSubset
  contentType: 'TEXT' | 'MARKDOWN' | 'DIFF' | 'STATUS_CARD';
  attachments: AttachmentSummary[];
  deliveryStatus: DeliveryStatus;
  processingStatus: ProcessingStatus;
  verificationState: 'VERIFIED_SENDER' | 'UNVERIFIED_SENDER' | 'SYSTEM_ORIGIN' | 'MOCK_ORIGIN';
  projectId: string;
  associatedTaskId?: string | null;
  correlationId?: string;
  replyToMessageId?: string | null;
  timestamp: string;             // ISO-8601
}

export interface ConversationSummary extends SourceMeta {
  conversationId: string;
  title: string;
  projectId: string;
  primaryChannel: ChannelProviderType;
  activeTaskId?: string | null;
  unreadCount: number;
  lastMessagePreview: string;
  lastMessageTimestamp: string;
  participantIds: string[];
  isPinned: boolean;
}

export interface NotificationSummary extends SourceMeta {
  notificationId: string;
  category: 
    | 'TASK_COMPLETE' 
    | 'TASK_FAILED' 
    | 'APPROVAL_REQUIRED' 
    | 'SECURITY_WARNING' 
    | 'AGENT_OFFLINE' 
    | 'AGENT_AVAILABLE' 
    | 'SYSTEM_WARNING' 
    | 'PROJECT_UPDATE' 
    | 'KNOWLEDGE_CONFLICT' 
    | 'ROUTING_ESCALATION';
  severity: NotificationSeverity;
  title: string;
  summary: string;
  projectId: string;
  associatedTaskId?: string | null;
  associatedAgentId?: string | null;
  isRead: boolean;
  actionable: boolean;
  actionType?: 'REVIEW_APPROVAL' | 'INSPECT_TASK' | 'DISMISS' | 'ARBITRATE';
  actionTargetId?: string;
  timestamp: string;
}

export interface ApprovalSummary extends SourceMeta {
  approvalId: string;
  taskId: string;
  requestingAgentId: string;
  projectId: string;
  requestedCapability: string;
  requestedPrivilegeLevel: PrivilegeLevel;
  targetResource: string;
  rationale: string;
  preCheckVerdict: 'PASS' | 'WARN' | 'FAIL';
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED' | 'CANCELLED';
  createdAt: string;
  expiresAt: string;
  reviewedAt?: string | null;
  reviewerId?: string | null;
}

/**
 * Provider Status with Decoupled Connection and Verification State
 */
export interface ProviderStatus extends SourceMeta {
  provider: ChannelProviderType;
  displayName: string;
  connectionState: 'MOCK' | 'SIMULATED' | 'OFFLINE' | 'UNAVAILABLE' | 'CONNECTING' | 'CONNECTED';
  verificationState: 'MOCK' | 'UNKNOWN' | 'UNVERIFIED' | 'VERIFIED';
  endpointMode: 'LOOPBACK' | 'UNAVAILABLE';
  activeWebhook: boolean;
  lastHeartbeat: string | null;
  unacknowledgedCount: number;
}

export interface CommunicationContext {
  activeProjectId: string;
  activeConversationId: string | null;
  unreadNotificationsCount: number;
  pendingApprovalsCount: number;
  offlineMode: boolean;
  loopbackOnly: boolean;
  freeFirstActive: boolean;
  activeRoutingTier: 'LOCAL_MICRO' | 'LOCAL_LARGE' | 'CLOUD_STANDARD' | 'CLOUD_SPECIALIST' | 'MOCK';
}
```

---

## 17. Phase A.4 Safety & Exclusion Boundaries

To maintain strict alignment with project governance, Phase A.4 explicitly excludes:
- **NO Real Shell or PTY Execution:** No terminal processes, pseudo-terminals, or command executions.
- **NO Privilege Escalation:** The UI cannot grant real OS permissions (`sudo`, `root`, file writes).
- **NO Public Network Listeners:** No ports opened outside `127.0.0.1`.
- **NO Real Broker Connections:** Zero MT5, broker, or financial API interactions.
- **NO Real Production Messaging Credentials:** Zero production Telegram tokens, Discord bot secrets, or WhatsApp API credentials stored or utilized.
- **NO Unrestricted Chat Command Execution:** The chat interface strictly formats semantic task requests; it never acts as a bash conduit.

---

## 18. Proposed Future Test Plan

When implementation is authorized in a subsequent phase, the test file `pruebas/prueba-phase-a4-unified-communications.ts` will validate:

1. **Vortex & Canvas Integrity:** Verify Canonical Vortex SVG, layers, and animations remain unregressed.
2. **Communication Center DOM Structure:** Validate conversation selector, message stream, and semantic input presence.
3. **Notification Center Rendering:** Assert all 10 notification categories render with correct severity badges.
4. **Approval Inbox Mock Functionality:** Validate approval cards render `L0`–`L4` tags, countdowns, and pre-checks without host execution.
5. **Provider State Separation Behavioral Tests:**
   - Assert `connectionState: CONNECTED` with `verificationState: UNVERIFIED` renders `CONNECTED (UNVERIFIED)` and does not render as verified or trusted.
   - Assert `MOCK` cannot render `CONNECTED` or `VERIFIED` without backing state.
   - Assert connection state changes do not mutate verification state.
6. **DeliveryStatus vs. ProcessingStatus Tests:**
   - Assert `deliveryStatus` and `processingStatus` transition independently.
   - Assert invalid transitions (e.g. `LOCAL_ONLY` directly to `DELIVERED`) are rejected.
7. **Offline Delivery Truthfulness Tests:**
   - Assert with `ATLAS_SIN_RED=true` that outgoing external messages remain in `LOCAL_ONLY` or `OUTBOUND_QUEUED`.
   - Assert external messages NEVER transition to `DELIVERED` while offline.
8. **Secret Boundary Defense-in-Depth Tests:**
   - Validate contract schemas mandate upstream redaction before persistence.
   - Validate UI output escaping prevents execution of injected token scripts.
9. **Normalized Canonical Markup Tests:**
   - Assert provider-specific markup (Telegram HTML / Discord tags) does not reach UI parser layer.
   - Assert forbidden elements (`<script>`, `javascript:`) are rejected.
10. **Messaging-is-not-a-Terminal Invariant:** Assert raw command strings (`rm -rf`, `curl | sh`) are intercepted as semantic text and never dispatched to shell runners.
11. **Project Isolation:** Assert conversations and notifications filter strictly by project context.
12. **Accessibility & Reduced Motion:** Validate keyboard tab traps, ARIA attributes, and reduced motion toggles.
13. **Data Contract Compliance:** Validate sample fixtures against TypeScript interfaces.

---

## 19. Acceptance Criteria (A4-AC)

| ID | Criterion Description |
| :--- | :--- |
| **A4-AC-01** | The Canonical Vortex from Phase A.2/A.3 remains the persistent centerpiece in both launch and expanded states. |
| **A4-AC-02** | Communication Center surface renders thread list, unread counters, and message stream with zero horizontal overflow. |
| **A4-AC-03** | Messages implement separated transport and orchestration lifecycles: `deliveryStatus` (`LOCAL_ONLY`, `OUTBOUND_QUEUED`, `SENDING`, `DELIVERED`, `FAILED`, `RETRYING`) and `processingStatus` (`RECEIVED`, `QUEUED`, `PROCESSING`, `RESPONDED`, `FAILED`). |
| **A4-AC-04** | Notification Center displays all 10 required categories with explicit severity tags (`INFO`, `WARNING`, `CRITICAL`). |
| **A4-AC-05** | Approval Inbox is implemented as a dedicated sub-surface/tab in the Communication Center and presents informational cards (`L0`–`L4`, target resource, rationale) in a strictly mock-first manner. |
| **A4-AC-06** | Approval actions in the UI DO NOT alter host system permissions, grant OS capabilities, or trigger live shell commands. |
| **A4-AC-07** | Non-negotiable invariant `MESSAGING_IS_NOT_A_TERMINAL` is enforced in UI inputs and semantic prompts. |
| **A4-AC-08** | Provider status strictly separates transport and verification: `connectionState` (`MOCK`, `SIMULATED`, `OFFLINE`, `UNAVAILABLE`, `CONNECTING`, `CONNECTED`) and `verificationState` (`MOCK`, `UNKNOWN`, `UNVERIFIED`, `VERIFIED`); `connectionState = CONNECTED` does not imply `verificationState = VERIFIED`. |
| **A4-AC-09** | Message envelopes support trust states (`VERIFIED_SENDER`, `UNVERIFIED_SENDER`, `SYSTEM_ORIGIN`, `MOCK_ORIGIN`). |
| **A4-AC-10** | Stale messages ($> 300\text{s}$) and duplicates display visible warning badges. |
| **A4-AC-11** | Multi-agent communication stream shows transparent delegation (User $\rightarrow$ Atlas $\rightarrow$ Agent $\rightarrow$ Validator) without raw internal chain-of-thought dump. |
| **A4-AC-12** | Every conversation, task, and notification clearly displays its isolated Project Context Badge. |
| **A4-AC-13** | Activity Timeline (operational), Notification Center (exceptions), and Communication Center (dialog) maintain clean demarcations. |
| **A4-AC-14** | Adaptive routing indicators display active tiers (`LOCAL_MICRO` to `CLOUD_SPECIALIST`) without coupling intelligence to system privilege. |
| **A4-AC-15** | Attachment capsules support future voice, document, diff, and data previews with quarantine status. |
| **A4-AC-16** | System operates 100% locally when `ATLAS_SIN_RED=true`, queueing outbound external messages without false delivery states. |
| **A4-AC-17** | Responsive layout employs content-driven sizing across Desktop ($\ge 1180\text{px}$), Tablet ($761\text{px}$–$1179\text{px}$), and Mobile ($\le 760\text{px}$) rather than fixed percentage heights, preserving Vortex visibility and 48px touch targets. |
| **A4-AC-18** | Keyboard accessibility (Tab/Enter/Space) and ARIA live regions comply with WCAG 2.1 AA standards. |
| **A4-AC-19** | `prefers-reduced-motion` immediately disables orbital particle movements and smooth transitions. |
| **A4-AC-20** | Network binding strictly constrained to `127.0.0.1`. |
| **A4-AC-21** | Real-money trading and broker connections remain strictly `BLOCKED`. |
| **A4-AC-22** | Canonical historical dataset SHA-256 (`d9beb0a6e9c8f366f89403534daae3bb7754dc343e3d17eb148dc45eba3f627a`) remains unaltered. |
| **A4-AC-23** | Zero production secrets, tokens, or private keys exposed in UI fixtures, DOM datasets, or client logs. |
| **A4-AC-24** | All 77 existing top-level test files (959 internal tests) continue passing with zero regressions. |
| **A4-AC-25** | Specification approval remains reserved exclusively for ChatGPT / Atlas Orchestrator and the User. |
| **A4-AC-26** | The UI and data contracts enforce that `connectionState` and `verificationState` are evaluated and rendered independently. An unverified provider with an active connection must visually display `UNVERIFIED` and never inherit trusted status. |
| **A4-AC-27** | The UI data contracts mandate that secret detection/redaction (API keys, tokens, passwords, private keys, cookies, session credentials) is enforced upstream at the backend/adapter boundary before persistence, while the UI enforces output escaping and client-side sanitization strictly as defense-in-depth. |
| **A4-AC-28** | When operating with `ATLAS_SIN_RED=true` or in offline mode, external outbound messages must strictly remain in `LOCAL_ONLY`, `OUTBOUND_QUEUED`, or `PROVIDER_UNAVAILABLE` states and cannot transition to `DELIVERED`. |

---

## 20. Full Green Gate Definition

Phase A.4 may only be declared `GREEN` when all of the following conditions are simultaneously verified on the local host:

```text
[PHASE A.4 GREEN GATE]
- Baseline Test Suite:               77 / 77 test files PASS (959 / 959 tests PASS)
- New A.4 Test Suite:                100% PASS (pruebas/prueba-phase-a4-unified-communications.ts)
- Canonical Vortex Integrity:        PASS (SVG layers, viewBox, orbital animations preserved)
- A.3 Operational Sectors:           PASS (All 8 sectors operational and reachable)
- Invariant Validation:              PASS (MESSAGING_IS_NOT_A_TERMINAL verified)
- Provider State Separation:         PASS (connectionState and verificationState decoupled; CONNECTED != VERIFIED)
- Secret Boundary Defense-in-Depth:  PASS (Upstream redaction contract documented; client output escaping verified)
- Offline Delivery Truthfulness:     PASS (No false DELIVERED states under ATLAS_SIN_RED=true)
- Truthfulness Validation:           PASS (No unverified CONNECTED / ONLINE states)
- Network Isolation:                 PASS (ATLAS_SIN_RED=true, 127.0.0.1 only, zero external listeners)
- Trading Safety:                    PASS (Real trading strictly BLOCKED)
- Host Isolation:                    PASS (Zero shell execution, zero PTY, zero host write)
- Dataset SHA-256 Integrity:         MATCH (d9beb0a6e9c8f366f89403534daae3bb7754dc343e3d17eb148dc45eba3f627a)
- Git Hygiene:                       PASS (Zero unauthorized modifications outside scoped task files)
```

---

## 21. Relationship to Atlas Remote Subsystem

It is critical to distinguish between **Atlas Final UI Phase A.4** and the **Atlas Remote Lab Subsystem**:

| Dimension | Atlas Final UI — Phase A.4 | Atlas Remote Lab (Future Messaging Gateway) |
| :--- | :--- | :--- |
| **Primary Focus** | User experience, visual layout, data contracts, mock-first interaction. | Backend network daemons, OS process isolation, cryptographic transport. |
| **Execution Layer** | Runs inside browser / Webview DOM on `127.0.0.1`. | Runs as unprivileged background host daemon (`atlasd`). |
| **Provider Interfaces** | Displays provider status cards, normalized message envelopes, mock fixtures. | Runs actual webhook servers, Telegram Bot API clients, Discord WebSocket gateways. |
| **Approvals** | Renders approval cards, rationale, and mock click feedback. | Enforces cryptographic signature verification and TTL token invalidation. |
| **Coupling** | Loosely coupled via standard JSON data contracts. | Provides upstream data feed once implemented and authorized. |

By maintaining this separation, the visual interface can be fully developed, verified, and refined in Phase A.4 without waiting for or prematurely coupling to complex backend daemon infrastructure.

---

## 22. Architectural & Risk Review

### 22.1 Impacted UI Modules (Future Implementation)
When authorized, implementation will focus strictly on:
- `src/panel-vortice/index.html` — Adding communication and notification container DOM structures.
- `src/panel-vortice/premium.css` — High-density chat styling, notification cards, and approval tab styles.
- `src/panel-vortice/app.js` — State management for active conversation, unread filters, and mock event feeds.
- `pruebas/prueba-phase-a4-unified-communications.ts` — Comprehensive unit and integration verification.

### 22.2 Architectural & Security Risks
1. **Accidental Shell Exposure:** Risk that future implementers wire chat inputs directly to a subprocess runner.  
   *Mitigation:* Architectural invariant `MESSAGING_IS_NOT_A_TERMINAL` enforced at the data contract level; UI schema treats inputs strictly as task intent strings.
2. **Credential Leakage in Chat Logs:** Risk that an agent or external input contains sensitive credentials.  
   *Mitigation:* Architectural rule established: backend/adapter boundary enforces upstream secret detection and redaction prior to persistence. UI output escaping acts as defense-in-depth.
3. **Cognitive Information Overload:** Risk that mixing agent proposals, task logs, and human messages makes the chat unreadable.  
   *Mitigation:* Multi-tiered layout separating operational telemetry (Activity Timeline) from actionable dialog (Communication Center) and alerts (Notification Center).

---

*Specification Version 1.0 submitted by ANTIGRAVITY for review and approval by ChatGPT / Atlas Orchestrator.*
