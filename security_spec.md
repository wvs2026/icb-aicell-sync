# CELL-SYNC Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants

1. **Workspace Membership Master Gate**: Every subcollection document (`members`, `checklists`, `rocChanges`, `issues`, `decisions`) MUST belong to an existing parent `/projects/{projectId}` whose `memberUids` array contains `request.auth.uid`. Revoking a user from `projects/{projectId}.memberUids` immediately terminates access to all sub-resources.
2. **Invite-Gated Join Integrity**: Users can only join an existing project if they supply `lastJoinCode == existing().inviteCode`, are not already a member, `memberUids.size() < 10`, and only append their own `request.auth.uid` without removing existing members.
3. **Atomic Project + Invite Creation**: Creating a project MUST atomically create its corresponding `/invites/{inviteCode}` lookup record in the same write batch (`existsAfter`).
4. **Atomic Issue-to-Decision Conversion & Terminal Lock**: Once an `Issue` reaches `status == 'resolved'`, no further updates are permitted (terminal state lock). Transitioning an issue to `resolved` with a `linkedDecisionId` MUST atomically create the target `Decision` document in the same batch (`existsAfter`).
5. **Strict Schema & Server Timestamps**: Every document write must pass its standalone `isValid[Entity]()` validator enforcing `hasAll`/`hasOnly` keys, exact regex patterns and `maxLength` bounds from `firebase-blueprint.json`, `createdBy == request.auth.uid` on creation, immutability of `projectId`/`ownerId`/`createdBy`/`createdAt`, and server timestamps (`request.time`).
6. **Zero PII Exposure**: No email addresses, phone numbers, or private contact data are stored in shared project collections (`members` stores only engineering role, display name, and specialty).
7. **Verified Identity Only**: All write operations require `request.auth != null && request.auth.token.email_verified == true`.

## 2. The "Dirty Dozen" Adversarial Payloads

All 12 payloads below MUST evaluate to `PERMISSION_DENIED`:

1. **Shadow Field Injection (Project)**: Creating `/projects/proj-1` with an extra ghost key `isAdmin: true`.
2. **Identity Spoofing (Checklist Create)**: Creating `/projects/proj-1/checklists/chk-1` where `createdBy` is `"other-uid"` instead of `request.auth.uid`.
3. **Client Timestamp Forgery**: Creating a `RocChange` where `createdAt` is a client-fabricated timestamp instead of `request.time`.
4. **Path Variable ID Poisoning**: Creating a document at `/projects/proj-1/issues/../../../evil$id!` with invalid characters or length > 128.
5. **Denial-of-Wallet Oversized String**: Creating an `Issue` with `description` length of 2,500 chars (exceeding `maxLength: 1500`).
6. **Unauthorized Invite Scraping (`list` on `/invites`)**: Executing a collection `list` query on `/invites` to harvest team invite codes.
7. **Invite Code Bypass on Join**: Updating `/projects/proj-1` `memberUids` to append attacker UID while supplying a wrong `lastJoinCode: "WRONG1"`.
8. **Member Removal Hijack on Join**: Joining `/projects/proj-1` while overwriting `memberUids` to drop the original `ownerId`.
9. **Terminal State Violation (Reopen Resolved Issue)**: Updating an `Issue` whose `existing().status == 'resolved'` back to `'open'`.
10. **Non-Atomic Decision Link**: Updating an `Issue` to `status: 'resolved'` with `linkedDecisionId: 'fake-dec-99'` without creating that `Decision` in the same batch.
11. **Value Poisoning on Whitelisted Update Key**: Updating `ChecklistItem.status` to `"hacked_state"` (not in `['todo', 'in_progress', 'done']`).
12. **Unverified Email Spoof Write**: Attempting any create/update when `request.auth.token.email_verified == false`.
