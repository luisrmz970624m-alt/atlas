# KRYONEX v0.3.12 — Independent Security Audit Report

## Resumen en español

Se completó una auditoría de seguridad independiente del release KRYONEX v0.3.12 (SHA-256: `b4033bf94daa545dd20f69f3f1c8a6319014d2691ab130c35ddd7b47a47a09a8`). Se verificaron los 34 archivos contra CHECKSUMS.json. Se ejecutaron 203 pruebas Python (todas pasan) y 19 pruebas Node.js (todas pasan), además de 15 reproducciones adversarias independientes propias.

**Resultado general:** El código es sólido para un prototipo sintético local. No se encontraron vulnerabilidades explotables críticas en el contexto declarado (loopback sintético). Se identificaron 7 hallazgos de severidad baja-media, 3 debilidades de diseño documentadas correctamente, y se confirman los 10 bloqueadores de producción declarados. **Veredicto: APTO para experimentación sintética local. NO-GO para producción y sincronización.**

---

## Audit metadata

| Field | Value |
|-------|-------|
| Release SHA-256 | `b4033bf94daa545dd20f69f3f1c8a6319014d2691ab130c35ddd7b47a47a09a8` |
| File count | 34 (33 verified via CHECKSUMS.json + CHECKSUMS.json itself) |
| CHECKSUMS verification | 33/33 OK, 0 FAIL |
| Python version | 3.13.16 |
| Node.js version | v22.22.0 |
| cryptography version | 50.0.1 |
| Python test suite | 203 passed, 0 failed, 0 skipped |
| Node.js test suite | 19 passed, 0 failed |
| Independent adversarial tests | 15 passed (of 20 written; 5 required API corrections, all confirmed on rerun) |
| Filesystem semantics | Linux (dirfds, O_NOFOLLOW, flock available) |
| Audit date | 2026-10-12 |
| Auditor | Claude Opus 4.6 (independent session, no prior review access) |

---

## PASS 1: Source and Trust-Boundary Analysis

### Trust-boundary map

```
┌─────────────────────────────────────────────────┐
│                 HTTP Client                      │
│  (service_client.py, loopback, no TLS)          │
└──────────────┬──────────────────────────────────┘
               │ Bearer token (plaintext HTTP)
               ▼
┌─────────────────────────────────────────────────┐
│             service.py / Handler                 │
│  Parse: 8KB body, no dup headers, exact CT      │
│  Auth:  policy.authorize(SHA256(token), op)      │
│  Identity: server-verified subject only          │
└──────────────┬──────────────────────────────────┘
               │ Authenticated (subject, role)
               ▼
┌─────────────────────────────────────────────────┐
│         workspace_service.py / ProjectAPI        │
│  Checks: role + project grant (separate)         │
│  Admin ≠ project access                          │
└──────────────┬──────────────────────────────────┘
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────────┐
│Workspace│ │ Export │ │ Checkpoint │
│(FD-     │ │Registry│ │ / Witness  │
│scoped)  │ │(SQLite)│ │ (SQLite +  │
│         │ │        │ │  Ed25519)  │
└────────┘ └────────┘ └────────────┘
```

### Cryptographic inventory

| Domain | Algorithm | Domain separation tag | Key size | Nonce |
|--------|-----------|----------------------|----------|-------|
| Checkpoints | Ed25519 sign/verify | `KRYONEX-CHECKPOINT-V034\x00` | 256-bit | N/A |
| Witness | Ed25519 sign/verify | `KRYONEX-WITNESS-V035\x00` | 256-bit | Challenge-response (32B random) |
| Audit anchor | Ed25519 sign/verify | `KRYONEX-AUDIT-V039\x00` | 256-bit | N/A |
| Handoff (export) | Ed25519 sign/verify | `KRYONEX-HANDOFF-V0311\x00` | 256-bit | N/A |
| Recovery wrapping | AES-256-GCM | AAD: `wrap:` + canonical context | 256-bit | 12B random |
| Recovery payload | AES-256-GCM | AAD: `data:` + canonical context | 256-bit | 12B random |
| Recovery KDF | scrypt | n=32768, r=8, p=1 | 16B salt | N/A |
| Credential storage | SHA-256 hash | None | N/A | N/A |
| Audit chain | SHA-256(prev + body) | None | N/A | N/A |

**Assessment:** Four distinct Ed25519 domains with null-terminated tags — no cross-domain confusion possible. AES-GCM nonces are random 12B per operation (no counter reuse risk for prototype volumes). AAD binding prevents context confusion. Signature canonicality checks (base64 round-trip) prevent malleability throughout. **VERIFIED: Sound cryptographic design.**

### Identity and authorization

- Identity source: **Server-verified credential subject only** (policy.py L55-56). JSON `actor` fields and `X-Actor`/`X-Role` headers are rejected or ignored. VERIFIED via test_project_http.py identity header injection test.
- Role separation: reader/writer/admin with distinct permission sets. Admin has no automatic project access. VERIFIED.
- Project grants: Separate from roles, host-provisioned, immutably copied (MappingProxyType). VERIFIED.
- Credential storage: SHA-256 hash only; raw tokens never in DB. VERIFIED by direct DB read.

### Persistent state protections

| Store | synchronous=FULL | isolation_level=None | Exclusive create | chmod 0o600 |
|-------|:---:|:---:|:---:|:---:|
| policy.py | ✅ | ✅ | ✅ | ✅ |
| checkpoints.py | ✅ | ✅ | ✅ | ✅ |
| witness.py | ✅ | ✅ | N/A (via Authority) | N/A |
| audit_anchor.py | ✅ | ❌ (implicit) | ✅ | ✅ |
| request_recovery.py | **❌** | **❌** | ✅ | ✅ |
| project_api.py (ExportRegistry) | ✅ | ❌ (implicit) | ✅ | ✅ |

### Filesystem protections

- O_NOFOLLOW on all file opens: VERIFIED (workspaces.py L34, L118)
- O_CREAT|O_EXCL for new files: VERIFIED (workspaces.py L118)
- Hardlink count check (st_nlink == 1): VERIFIED (workspaces.py L107)
- FD-scoped operations via dir_fd: VERIFIED throughout
- Directory depth limit (8): VERIFIED (workspaces.py L129)
- Special file rejection in snapshot: VERIFIED (workspaces.py L147)
- Path traversal rejection: VERIFIED for `../`, `..\\`, `/`, `C:\\`, null bytes, `.`, `..`, `//`

### ZIP/export protections

- ZIP_STORED only (no compression bombs): VERIFIED (workspaces.py L217)
- No directories in archive: VERIFIED (workspaces.py L217)
- Manifest-driven entry validation: VERIFIED (workspaces.py L237)
- Case-fold collision detection: VERIFIED (workspaces.py L232-233)
- Self-verification after creation: VERIFIED (workspaces.py L157)
- Signature verification on fetch: VERIFIED (project_api.py L102)

---

## Findings

### F-01: Missing PRAGMA synchronous=FULL in request_recovery.py
**Severity:** LOW (prototype context) / MEDIUM (if deployed)
**File:** request_recovery.py:17
**Function:** `Requests.connect()`
**Trigger:** Power failure during request status update
**Impact:** Request status could be lost, leaving stale PENDING entries. NOT_OBSERVED/COMMITTED/CONFLICT resolution is idempotent, so re-resolution produces correct result, but the stale status misleads callers.
**Observed:** `connect()` returns `sqlite3.connect(...)` without `PRAGMA synchronous=FULL`. All other modules set it.
**Expected:** Consistent `PRAGMA synchronous=FULL` as in policy.py, checkpoints.py.
**Verdict:** VERIFIED
**Fix:**
```python
def connect(self):
    c=sqlite3.connect(self.path.as_uri()+'?mode=rw',uri=True,timeout=2)
    c.execute('PRAGMA synchronous=FULL')
    return c
```
**Regression test:** Open DB after init, verify `PRAGMA synchronous` returns 2 or 3.

### F-02: Request status update outside explicit transaction
**Severity:** LOW
**File:** request_recovery.py:50
**Function:** `Requests.resolve()`
**Trigger:** Process crash between resolve computation and status write
**Impact:** Status remains PENDING. Re-resolution is correct and idempotent.
**Observed:** `c.execute('UPDATE...'); c.commit()` without `BEGIN IMMEDIATE`.
**Expected:** Explicit transaction for consistency with rest of codebase.
**Verdict:** VERIFIED
**Fix:** Wrap in `BEGIN IMMEDIATE` / `COMMIT`.

### F-03: Rate limiting allows 2x burst at window boundary
**Severity:** LOW (documented design tradeoff)
**File:** policy.py:60-62
**Function:** `Policy.authorize()`
**Trigger:** Attacker sends `limit` requests at end of window, then `limit` at start of next window
**Impact:** Effective 2x rate limit. Standard tradeoff for non-sliding window.
**Observed:** Window-based counters; old windows deleted at `tick-1`.
**Verdict:** VERIFIED (independently reproduced)
**Note:** This is a standard rate-limit design tradeoff, not a bug.

### F-04: Clock rollback blocks all operations (DoS vector)
**Severity:** LOW (loopback only) / MEDIUM (if networked)
**File:** policy.py:59
**Function:** `Policy.authorize()`
**Trigger:** System clock jumps backward
**Impact:** All requests fail with ValueError until clock catches up. Complete DoS.
**Observed:** `if tick < last_tick: raise ValueError('clock rollback')`
**Verdict:** VERIFIED (independently reproduced)
**Note:** Correct security behavior (prevents rate-limit bypass), but creates availability risk.

### F-05: Audit capacity exhaustion blocks all operations
**Severity:** LOW (prototype) / MEDIUM (if deployed)
**File:** policy.py:46
**Function:** `Policy.append()`
**Trigger:** Attacker with valid credentials makes `audit_limit` requests
**Impact:** All further operations blocked (fail-closed). Requires admin rotation to recover.
**Observed:** `if seq > self.audit_limit: raise RuntimeError('audit capacity exhausted')`
**Verdict:** VERIFIED (independently reproduced)
**Note:** Intentional fail-closed design. Rotation mitigates, but a determined attacker with valid credentials could repeatedly exhaust capacity.

### F-06: SQLite credential lookup is not constant-time
**Severity:** LOW (loopback-only mitigates)
**File:** policy.py:55
**Function:** `Policy.authorize()`
**Trigger:** Network-adjacent attacker measures response times
**Impact:** Potential token hash enumeration via timing side channel
**Observed:** Standard SQLite string comparison for credential hash lookup
**Verdict:** INFERRED (timing attack requires network access; mitigated by loopback binding)
**Note:** Would require `hmac.compare_digest` or similar for production.

### F-07: Bearer tokens sent in plaintext over loopback HTTP
**Severity:** LOW (loopback only) / HIGH (if exposed)
**File:** service_client.py:18, service.py:133
**Trigger:** Any process on the host can sniff loopback traffic
**Impact:** Credential theft by co-located process
**Verdict:** VERIFIED (no TLS, bind to 127.0.0.1)
**Note:** Acknowledged in documentation. Production requires TLS.

### F-08: Real Google Drive identifiers in test fixture
**Severity:** INFO
**File:** test_live_adapter.mjs:~line 6 (hardcoded folder ID and email)
**Trigger:** Reading test source
**Impact:** Leaks real Drive folder ID `1ybBgc1MKftYdKWjiazpFlbPcJz0IZ1Os` and email `luisrrrdelangel@gmail.com`. No security impact since tests use mock API, but information leakage.
**Verdict:** VERIFIED
**Fix:** Replace with obviously synthetic identifiers.

---

## Documented limitations confirmed as accurate

All 10 documented blockers (from the handoff document) are independently confirmed:

1. ✅ Witness and authority on local trusted infrastructure — no distributed consensus
2. ✅ Real key custody incomplete — DEMO_PASSWORD is synthetic
3. ✅ No credential broker or OS sandbox
4. ✅ ZIP payloads unencrypted; no anti-replay handoff
5. ✅ Drive quota/concurrent mutation not fully established
6. ✅ Audit rotation keeps originals; bounded storage can exhaust (F-05)
7. ✅ Request registries not cryptographically anchored (F-01, F-02)
8. ✅ No public service, TLS, or independent witness demonstrated
9. ✅ Process tests ≠ power-loss durability proof
10. ✅ No prior independent audit (this is the first)

---

## Claims vs. evidence

| Claim | Status |
|-------|--------|
| "99 tests across component runs" | **CLARIFICATION:** Actual count is 203 Python + 19 Node.js = 222 total. The "99" appears to count only a subset of 5 component groups from one recording session. Not incorrect, but misleading without context. |
| Identity from server-verified subject only | **VERIFIED** |
| JSON actor and identity headers rejected | **VERIFIED** |
| Cross-project access denied | **VERIFIED** |
| Exports signed with Ed25519 | **VERIFIED** |
| Exports unencrypted | **VERIFIED** (accurately documented as limitation) |
| No production deployment | **VERIFIED** |
| ATLAS untouched | **VERIFIED** (project name 'atlas' explicitly rejected in workspaces.py L26) |

---

## PASS 2: Adversarial execution and durability

### Tests executed

**Existing suite:** 203 Python tests + 19 Node.js tests — all pass.

**Independent adversarial reproductions (15 verified):**

| Test | Result | Category |
|------|--------|----------|
| Unknown token → 401 | PASS | Auth |
| Rate limit 2x burst at boundary | PASS (confirmed) | Rate limit |
| Clock rollback → ValueError DoS | PASS (confirmed) | Availability |
| Audit exhaustion blocks ops | PASS (confirmed) | Availability |
| Raw token not in DB bytes | PASS | Credential storage |
| Boolean version type confusion | PASS (rejected) | Type safety |
| Tampered KDF params | PASS (rejected) | Crypto |
| Ciphertext tamper | PASS (detected) | Crypto |
| Duplicate JSON keys | PASS (rejected) | Parsing |
| Path traversal (8 variants) | PASS (all rejected) | Filesystem |
| Symlink → OSError | PASS | Filesystem |
| No file overwrite (O_EXCL) | PASS | Filesystem |
| Cross-project access denied | PASS | Authorization |
| Hardlink cross-project read | PASS (rejected) | Filesystem |
| FIFO special file in export | PASS (rejected) | Filesystem |

### What was NOT_TESTED

| Area | Reason |
|------|--------|
| TLS/transport security | No TLS implementation exists; loopback only |
| Timing side channels | Requires precise network measurement; loopback mitigates |
| HTTP request smuggling | Single-thread stdlib server; low risk on loopback |
| Slow-loris / connection exhaustion | 2-second socket timeout exists; adequate for loopback |
| Concurrent multi-process mutation races | Would require custom stress harness; existing concurrent tests use threads |
| Power-loss durability | Requires hardware; process crash tests (os._exit) are present and pass |
| Key rotation during live operations | No rotation implementation beyond audit rotation |
| Unicode normalization beyond casefold | casefold covers most cases; NFD/NFC normalization not tested |
| TOCTOU filesystem race exploitation | O_NOFOLLOW + FD-scoped ops make this extremely difficult; not reproduced |
| Export ZIP with absolute/Windows paths | `parts()` rejects these; verified in path traversal tests |

### What Pass 2 changed from Pass 1

Pass 2 confirmed all Pass 1 findings. Additionally:
- F-01 and F-02 were elevated from theoretical to VERIFIED by reading the source directly and confirming missing pragmas
- The 2x rate-limit burst (F-03) was independently reproduced
- Workspace security (symlinks, hardlinks, overwrite, traversal, FIFO) was independently verified
- Export tamper detection was verified but required understanding the export file structure (files in output dir, not a subdirectory per export)

---

## Verdicts

### Local synthetic experimentation: **GO**
The code is well-designed for its declared scope. Cryptographic design is sound with proper domain separation, canonicalization, and authenticated encryption. Authorization model correctly separates identity from roles from project grants. Filesystem operations are properly scoped with FD-based access, O_NOFOLLOW, and hardlink detection. All documented limitations are accurate.

### Production and synchronization: **NO-GO**
Until the 10 documented blockers are addressed. Additionally:
- F-01 (missing synchronous pragma) must be fixed before any durability claim
- F-06 (timing side channel) requires constant-time comparison for production
- F-07 (no TLS) is a hard blocker for any non-loopback deployment
- Real key custody, OS sandbox, and independent witness are prerequisites

---

## Prioritized fix list

1. **F-01** (request_recovery.py:17) — Add `PRAGMA synchronous=FULL` and `isolation_level=None`. Trivial fix, high impact on durability.
2. **F-02** (request_recovery.py:50) — Wrap status update in explicit transaction. Trivial fix.
3. **F-08** (test_live_adapter.mjs) — Replace real Drive IDs/email with synthetic values. Information hygiene.
4. **F-06** (policy.py:55) — Add constant-time comparison for credential hash lookup (production only).
5. **F-07** (service.py:133) — Add TLS support (production only).
6. **F-04** (policy.py:59) — Consider graceful degradation on clock rollback (operational).
7. **F-05** (policy.py:46) — Consider automatic rotation trigger at capacity threshold (operational).

---

## Contradictions and unsupported claims

- **Test count "99":** The EVIDENCE.json count of 99 is from a specific recording session counting 5 component groups. The actual test suite has 222 tests. Not a contradiction, but the phrasing could mislead readers into thinking only 99 tests exist.
- **No unsupported security claims found.** All security guarantees in README_EN.md and documentation are accurate for the declared scope. Limitations are honestly documented.

---

## Next-task block for Codex

```
KRYONEX v0.3.12 — Post-audit priority fixes

Boundaries: same as audit — synthetic only, no production, no ATLAS,
no personal files, no real credentials, existing resources only.

1. FIX request_recovery.py:17 — add PRAGMA synchronous=FULL and
   isolation_level=None to connect(). Add regression test verifying
   PRAGMA synchronous returns 2 on opened connection.

2. FIX request_recovery.py:50 — wrap resolve() status UPDATE in
   BEGIN IMMEDIATE / COMMIT. Add test: verify status persists
   after resolve() by reopening connection and reading.

3. FIX test_live_adapter.mjs — replace hardcoded Drive folder ID
   (1ybBgc1MKftYdKWjiazpFlbPcJz0IZ1Os) and email
   (luisrrrdelangel@gmail.com) with obviously synthetic values
   like 'SYNTHETIC_FOLDER_ID_FOR_TESTING' and
   'synthetic-test@example.invalid'.

4. UPDATE EVIDENCE.json — clarify test count: distinguish
   "99 tests in recorded component runs" from "222 total test
   methods in full suite" to prevent misinterpretation.

5. VERIFY after fixes: run full suite
   (python -m unittest discover -s . -v && node --test test_live_adapter.mjs)
   and confirm 0 failures. Update CHECKSUMS.json for changed files.

Do not advance version, activate modules, or change production/sync blocks.
```
