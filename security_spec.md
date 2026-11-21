# CELL-SYNC Firestore Security Specification (Phase 0 TDD — Extended for ICB-AICell)

## 1. Data Invariants

1. **Workspace Membership Master Gate**: Every subcollection document (`members`, `checklists`, `rocChanges`, `issues`, `decisions`, `machines`, `qualityGates`) MUST belong to an existing parent `/projects/{projectId}` whose `memberUids` array contains `request.auth.uid`.
2. **Invite-Gated Join Integrity**: Joining requires `lastJoinCode == existing().inviteCode`, `< 10` members, and appending only `request.auth.uid`.
3. **Atomic Project + Invite Creation**: Creating a project MUST atomically create `/invites/{inviteCode}` (`existsAfter`).
4. **Atomic Issue-to-Decision Conversion & Terminal Lock**: Once `Issue.status == 'resolved'`, updates and deletes are permanently locked. `externalRef` (optional, max 64 chars) is immutable after creation.
5. **Hardware Inventory Safety (`machines`)**: Fixed machine codes (`WS-01`, `EC1`..`PLC-01`), bounded string lengths, no credential fields, and `machineCode` immutable after creation.
6. **Immutable QA Gate Audit Log & `securityLocalOnly` Enforcement (`qualityGates`)**:
   - `qualityGates` documents are append-only (`allow update: if false`).
   - `gate1Checks` is a strict 4-key map (`ruff`, `ruffFormat`, `mypy`, `pytest`); `findingCounts` is a strict 5-key map (`critical`, `high`, `medium`, `low`, `info`) — no unbounded arrays of maps.
   - When `securityLocalOnly == true`, server-side rules enforce `summary.size() <= 200` to block leakage of detailed local security code reviews.
   - Internal server endpoints (`base_url`) are rejected by strict `hasOnly()` key enforcement in `isValidQualityGate`.

## 2. Adversarial Payloads (Must Return PERMISSION_DENIED)

1. **Shadow Field Injection (`base_url` in `qualityGates`)**: Attempting to store `base_url: "http://100.x.y.z:8000"` in a `QualityGateRun` document → blocked by `hasOnly()`.
2. **Security-Local-Only Detail Leak**: Creating a `QualityGateRun` with `securityLocalOnly: true` and a 500-char detailed code summary → blocked by `(!data.securityLocalOnly || data.summary.size() <= 200)`.
3. **Tampering with QA Audit History**: Updating an existing `QualityGateRun` to flip `gate2Verdict` from `'FAIL'` to `'PASS'` → blocked by `allow update: if false`.
4. **Oversized `externalRef` Injection**: Creating an `Issue` with `externalRef` length 120 (> 64) → blocked by `isValidIssue`.
5. **Mutating `externalRef` on Update**: Updating an existing `Issue`'s `externalRef` → blocked by `affectedKeys().hasOnly(...)`.
6. **Machine Code Hijack on Update**: Changing `machineCode` of `EC1` to `PLC-01` → blocked by `incoming().machineCode == existing().machineCode`.
7. **Unbounded `gate1Checks` Key Injection**: Adding an arbitrary 5th key to `gate1Checks` → blocked by `hasOnly(['ruff', 'ruffFormat', 'mypy', 'pytest'])`.
8. **Negative/Extreme `findingCounts` Poisoning**: Setting `findingCounts.critical = -5` or `999999` → blocked by `0..10000` range check.
9. **Identity Spoofing**: Setting `createdBy` or `updatedBy` to another UID → blocked by `== request.auth.uid`.
10. **Client Timestamp Forgery**: Setting `createdAt`/`updatedAt` to a client timestamp → blocked by `== request.time`.
11. **Terminal State Violation**: Reopening a `resolved` Issue → blocked by `existing().status != 'resolved'`.
12. **Unverified Email Write**: Any create/update/delete when `email_verified == false` → blocked by `isVerified()`.
