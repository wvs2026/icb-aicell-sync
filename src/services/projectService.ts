import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  buildSeedChecklists,
  buildSeedDecisions,
  buildSeedIssues,
  buildSeedRocs,
  PRESET_MEMBERS,
} from '../data/seedData';
import {
  addDaysDateStr,
  ChecklistItem,
  ChecklistModule,
  ChecklistStatus,
  Decision,
  ImpactModule,
  Issue,
  IssueModule,
  IssuePriority,
  IssueStatus,
  LIMITS,
  Project,
  RocChange,
  RocStatus,
  TeamRole,
} from '../types';

function clip(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function generateId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}-${ts}-${rand}`;
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function createWorkspaceWithSeed(params: {
  name: string;
  description: string;
  targetDate: string;
  creatorRole: TeamRole;
  creatorDisplayName: string;
  includeSampleData: boolean;
}): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');

  const projectId = generateId('proj');
  const inviteCode = generateInviteCode();
  const projectName = clip(params.name, LIMITS.PROJECT_NAME_MAX) || 'CELL-SYNC 통합 장비 개발';
  const projectDesc = clip(params.description, LIMITS.PROJECT_DESC_MAX);
  const targetDate = LIMITS.DATE_PATTERN.test(params.targetDate)
    ? params.targetDate
    : addDaysDateStr(30);

  // Batch 1: Atomically create /projects/{projectId} and /invites/{inviteCode}
  const batch1 = writeBatch(db);
  const projectRef = doc(db, 'projects', projectId);
  const inviteRef = doc(db, 'invites', inviteCode);

  batch1.set(projectRef, {
    name: projectName,
    description: projectDesc,
    targetDate,
    inviteCode,
    lastJoinCode: inviteCode,
    ownerId: user.uid,
    memberUids: [user.uid],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch1.set(inviteRef, {
    projectId,
    projectName,
    ownerId: user.uid,
    createdAt: serverTimestamp(),
  });

  try {
    await batch1.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `projects/${projectId}`);
  }

  // Batch 2: Seed 5-engineer role roster + optional sample industrial workflow data
  const batch2 = writeBatch(db);
  const displayName = clip(params.creatorDisplayName || user.displayName || '엔지니어', LIMITS.DISPLAY_NAME_MAX);

  for (const preset of PRESET_MEMBERS) {
    const isCreatorSlot = preset.role === params.creatorRole;
    const memberRef = doc(db, 'projects', projectId, 'members', preset.id);
    batch2.set(memberRef, {
      projectId,
      uid: isCreatorSlot ? user.uid : '',
      displayName: isCreatorSlot ? displayName : preset.displayName,
      role: preset.role,
      specialty: preset.specialty,
      isClaimed: isCreatorSlot,
      updatedAt: serverTimestamp(),
    });
  }

  if (params.includeSampleData) {
    for (const item of buildSeedChecklists()) {
      const ref = doc(db, 'projects', projectId, 'checklists', generateId('chk'));
      const assigneeName =
        item.assigneeRole === params.creatorRole ? displayName : item.assigneeName;
      batch2.set(ref, {
        projectId,
        module: item.module,
        stage: clip(item.stage, LIMITS.STAGE_MAX),
        isInterface: item.isInterface,
        interfacePair: clip(item.interfacePair, LIMITS.INTERFACE_PAIR_MAX),
        title: clip(item.title, LIMITS.TITLE_MAX),
        status: item.status,
        assigneeRole: item.assigneeRole,
        assigneeName: clip(assigneeName, LIMITS.DISPLAY_NAME_MAX),
        dueDate: item.dueDate,
        notes: clip(item.notes, LIMITS.NOTES_MAX),
        sortOrder: item.sortOrder,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    for (const roc of buildSeedRocs()) {
      const ref = doc(db, 'projects', projectId, 'rocChanges', generateId('roc'));
      const requesterName =
        roc.requesterRole === params.creatorRole ? displayName : roc.requesterName;
      batch2.set(ref, {
        projectId,
        code: roc.code,
        title: clip(roc.title, LIMITS.TITLE_MAX),
        asIs: clip(roc.asIs, LIMITS.ROC_TEXT_MAX),
        toBe: clip(roc.toBe, LIMITS.ROC_TEXT_MAX),
        reason: clip(roc.reason, LIMITS.ROC_TEXT_MAX),
        impactModules: roc.impactModules,
        status: roc.status,
        requesterName: clip(requesterName, LIMITS.DISPLAY_NAME_MAX),
        requesterRole: roc.requesterRole,
        reviewerName: clip(roc.reviewerName, LIMITS.DISPLAY_NAME_MAX),
        reviewComment: clip(roc.reviewComment, LIMITS.ROC_TEXT_MAX),
        targetApplyDate: roc.targetApplyDate,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    for (const issue of buildSeedIssues()) {
      const ref = doc(db, 'projects', projectId, 'issues', generateId('iss'));
      const assigneeName =
        issue.assigneeRole === params.creatorRole ? displayName : issue.assigneeName;
      batch2.set(ref, {
        projectId,
        code: issue.code,
        title: clip(issue.title, LIMITS.TITLE_MAX),
        description: clip(issue.description, LIMITS.ISSUE_DESC_MAX),
        module: issue.module,
        priority: issue.priority,
        status: issue.status,
        assigneeName: clip(assigneeName, LIMITS.DISPLAY_NAME_MAX),
        assigneeRole: issue.assigneeRole,
        dueDate: issue.dueDate,
        linkedDecisionId: '',
        linkedDecisionCode: '',
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    for (const dec of buildSeedDecisions()) {
      const ref = doc(db, 'projects', projectId, 'decisions', generateId('dec'));
      batch2.set(ref, {
        projectId,
        code: dec.code,
        title: clip(dec.title, LIMITS.TITLE_MAX),
        decisionSummary: clip(dec.decisionSummary, LIMITS.DECISION_TEXT_MAX),
        rationale: clip(dec.rationale, LIMITS.DECISION_TEXT_MAX),
        impactModules: dec.impactModules,
        decidedByName: clip(dec.decidedByName, LIMITS.DISPLAY_NAME_MAX),
        decidedDate: dec.decidedDate,
        sourceIssueId: '',
        sourceIssueCode: '',
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  try {
    await batch2.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `projects/${projectId}/seed`);
  }

  return projectId;
}

export async function joinWorkspaceByCode(rawCode: string): Promise<{ projectId: string; projectName: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');

  const code = rawCode.trim().toUpperCase();
  if (!LIMITS.INVITE_CODE_PATTERN.test(code)) {
    throw new Error('초대 코드는 영문 대문자와 숫자 6자리여야 합니다.');
  }

  const invitePath = `invites/${code}`;
  let inviteSnap;
  try {
    inviteSnap = await getDoc(doc(db, 'invites', code));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, invitePath);
  }

  if (!inviteSnap.exists()) {
    throw new Error('유효하지 않은 초대 코드입니다. 팀원에게 6자리 코드를 다시 확인해 주세요.');
  }

  const inviteData = inviteSnap.data() as { projectId: string; projectName: string };
  const projectRef = doc(db, 'projects', inviteData.projectId);

  // Check if already a member
  try {
    const existingProj = await getDoc(projectRef);
    if (existingProj.exists()) {
      const data = existingProj.data() as Project;
      if (data.memberUids.includes(user.uid)) {
        return { projectId: inviteData.projectId, projectName: data.name };
      }
    }
  } catch {
    // Non-members cannot read the project before joining; proceed to Join action
  }

  // Wait: Because non-members cannot read existing memberUids before joining,
  // Firestore arrayUnion handles appending without reading existing array?
  // Note: Rules check incoming().memberUids.hasAll(existing().memberUids) and size == size + 1.
  // arrayUnion(user.uid) evaluates cleanly on the server!
  const { arrayUnion } = await import('firebase/firestore');
  try {
    await updateDoc(projectRef, {
      memberUids: arrayUnion(user.uid),
      lastJoinCode: code,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `projects/${inviteData.projectId}`);
  }

  return { projectId: inviteData.projectId, projectName: inviteData.projectName };
}

export async function updateProjectMetadata(
  projectId: string,
  updates: { name: string; description: string; targetDate: string }
) {
  const path = `projects/${projectId}`;
  try {
    await updateDoc(doc(db, 'projects', projectId), {
      name: clip(updates.name, LIMITS.PROJECT_NAME_MAX),
      description: clip(updates.description, LIMITS.PROJECT_DESC_MAX),
      targetDate: updates.targetDate,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function claimMemberSlot(
  projectId: string,
  memberId: string,
  displayName: string,
  specialty: string
) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  const path = `projects/${projectId}/members/${memberId}`;
  try {
    await updateDoc(doc(db, 'projects', projectId, 'members', memberId), {
      uid: user.uid,
      displayName: clip(displayName, LIMITS.DISPLAY_NAME_MAX),
      specialty: clip(specialty, LIMITS.SPECIALTY_MAX),
      isClaimed: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function releaseMemberSlot(projectId: string, memberId: string) {
  const path = `projects/${projectId}/members/${memberId}`;
  try {
    await updateDoc(doc(db, 'projects', projectId, 'members', memberId), {
      uid: '',
      isClaimed: false,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ---------------------------------------------------------------------------
// Checklist CRUD
// ---------------------------------------------------------------------------
export async function createChecklistItem(
  projectId: string,
  input: {
    module: ChecklistModule;
    stage: string;
    isInterface: boolean;
    interfacePair: string;
    title: string;
    status: ChecklistStatus;
    assigneeRole: TeamRole;
    assigneeName: string;
    dueDate: string;
    notes: string;
    sortOrder: number;
  }
) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  const itemId = generateId('chk');
  const path = `projects/${projectId}/checklists/${itemId}`;
  try {
    await setDoc(doc(db, 'projects', projectId, 'checklists', itemId), {
      projectId,
      module: input.module,
      stage: clip(input.stage, LIMITS.STAGE_MAX) || '기본 검증',
      isInterface: input.isInterface,
      interfacePair: input.isInterface ? clip(input.interfacePair, LIMITS.INTERFACE_PAIR_MAX) : '',
      title: clip(input.title, LIMITS.TITLE_MAX),
      status: input.status,
      assigneeRole: input.assigneeRole,
      assigneeName: clip(input.assigneeName, LIMITS.DISPLAY_NAME_MAX),
      dueDate: input.dueDate,
      notes: clip(input.notes, LIMITS.NOTES_MAX),
      sortOrder: Math.max(0, Math.min(10000, Math.round(input.sortOrder))),
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateChecklistStatus(
  projectId: string,
  itemId: string,
  status: ChecklistStatus
) {
  const path = `projects/${projectId}/checklists/${itemId}`;
  try {
    await updateDoc(doc(db, 'projects', projectId, 'checklists', itemId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateChecklistItem(
  projectId: string,
  itemId: string,
  input: Pick<
    ChecklistItem,
    | 'module'
    | 'stage'
    | 'isInterface'
    | 'interfacePair'
    | 'title'
    | 'status'
    | 'assigneeRole'
    | 'assigneeName'
    | 'dueDate'
    | 'notes'
  >
) {
  const path = `projects/${projectId}/checklists/${itemId}`;
  try {
    await updateDoc(doc(db, 'projects', projectId, 'checklists', itemId), {
      module: input.module,
      stage: clip(input.stage, LIMITS.STAGE_MAX) || '기본 검증',
      isInterface: input.isInterface,
      interfacePair: input.isInterface ? clip(input.interfacePair, LIMITS.INTERFACE_PAIR_MAX) : '',
      title: clip(input.title, LIMITS.TITLE_MAX),
      status: input.status,
      assigneeRole: input.assigneeRole,
      assigneeName: clip(input.assigneeName, LIMITS.DISPLAY_NAME_MAX),
      dueDate: input.dueDate,
      notes: clip(input.notes, LIMITS.NOTES_MAX),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteChecklistItem(projectId: string, itemId: string) {
  const path = `projects/${projectId}/checklists/${itemId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId, 'checklists', itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------------------------------------------------------------------
// ROC / Spec Change History CRUD
// ---------------------------------------------------------------------------
export function computeNextCode(prefix: 'ROC' | 'ISS' | 'DEC', existingCodes: string[]): string {
  let maxNum = 0;
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  for (const code of existingCodes) {
    const match = code.match(re);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;
}

export async function createRocChange(
  projectId: string,
  existingCodes: string[],
  input: {
    title: string;
    asIs: string;
    toBe: string;
    reason: string;
    impactModules: ImpactModule[];
    requesterName: string;
    requesterRole: TeamRole;
    targetApplyDate: string;
  }
) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  const rocId = generateId('roc');
  const code = computeNextCode('ROC', existingCodes);
  const path = `projects/${projectId}/rocChanges/${rocId}`;
  const modules: ImpactModule[] =
    input.impactModules.length > 0 ? input.impactModules.slice(0, 5) : ['VISION'];

  try {
    await setDoc(doc(db, 'projects', projectId, 'rocChanges', rocId), {
      projectId,
      code,
      title: clip(input.title, LIMITS.TITLE_MAX),
      asIs: clip(input.asIs, LIMITS.ROC_TEXT_MAX),
      toBe: clip(input.toBe, LIMITS.ROC_TEXT_MAX),
      reason: clip(input.reason, LIMITS.ROC_TEXT_MAX),
      impactModules: modules,
      status: 'pending' as RocStatus,
      requesterName: clip(input.requesterName, LIMITS.DISPLAY_NAME_MAX),
      requesterRole: input.requesterRole,
      reviewerName: '',
      reviewComment: '',
      targetApplyDate: input.targetApplyDate,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateRocReview(
  projectId: string,
  rocId: string,
  input: { status: RocStatus; reviewerName: string; reviewComment: string }
) {
  const path = `projects/${projectId}/rocChanges/${rocId}`;
  try {
    await updateDoc(doc(db, 'projects', projectId, 'rocChanges', rocId), {
      status: input.status,
      reviewerName: clip(input.reviewerName, LIMITS.DISPLAY_NAME_MAX),
      reviewComment: clip(input.reviewComment, LIMITS.ROC_TEXT_MAX),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateRocContent(
  projectId: string,
  rocId: string,
  input: Pick<RocChange, 'title' | 'asIs' | 'toBe' | 'reason' | 'impactModules' | 'targetApplyDate'>
) {
  const path = `projects/${projectId}/rocChanges/${rocId}`;
  const modules: ImpactModule[] =
    input.impactModules.length > 0 ? input.impactModules.slice(0, 5) : ['VISION'];
  try {
    await updateDoc(doc(db, 'projects', projectId, 'rocChanges', rocId), {
      title: clip(input.title, LIMITS.TITLE_MAX),
      asIs: clip(input.asIs, LIMITS.ROC_TEXT_MAX),
      toBe: clip(input.toBe, LIMITS.ROC_TEXT_MAX),
      reason: clip(input.reason, LIMITS.ROC_TEXT_MAX),
      impactModules: modules,
      targetApplyDate: input.targetApplyDate,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteRocChange(projectId: string, rocId: string) {
  const path = `projects/${projectId}/rocChanges/${rocId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId, 'rocChanges', rocId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------------------------------------------------------------------
// Issues & Atomic Conversion to Decisions
// ---------------------------------------------------------------------------
export async function createIssue(
  projectId: string,
  existingCodes: string[],
  input: {
    title: string;
    description: string;
    module: IssueModule;
    priority: IssuePriority;
    assigneeName: string;
    assigneeRole: TeamRole;
    dueDate: string;
  }
) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  const issueId = generateId('iss');
  const code = computeNextCode('ISS', existingCodes);
  const path = `projects/${projectId}/issues/${issueId}`;
  try {
    await setDoc(doc(db, 'projects', projectId, 'issues', issueId), {
      projectId,
      code,
      title: clip(input.title, LIMITS.TITLE_MAX),
      description: clip(input.description, LIMITS.ISSUE_DESC_MAX),
      module: input.module,
      priority: input.priority,
      status: 'open' as IssueStatus,
      assigneeName: clip(input.assigneeName, LIMITS.DISPLAY_NAME_MAX),
      assigneeRole: input.assigneeRole,
      dueDate: input.dueDate,
      linkedDecisionId: '',
      linkedDecisionCode: '',
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateIssue(
  projectId: string,
  issueId: string,
  input: Pick<
    Issue,
    'title' | 'description' | 'module' | 'priority' | 'assigneeName' | 'assigneeRole' | 'dueDate'
  > & { status: 'open' | 'in_review' }
) {
  const path = `projects/${projectId}/issues/${issueId}`;
  try {
    await updateDoc(doc(db, 'projects', projectId, 'issues', issueId), {
      title: clip(input.title, LIMITS.TITLE_MAX),
      description: clip(input.description, LIMITS.ISSUE_DESC_MAX),
      module: input.module,
      priority: input.priority,
      status: input.status,
      assigneeName: clip(input.assigneeName, LIMITS.DISPLAY_NAME_MAX),
      assigneeRole: input.assigneeRole,
      dueDate: input.dueDate,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteIssue(projectId: string, issueId: string) {
  const path = `projects/${projectId}/issues/${issueId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId, 'issues', issueId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Atomically converts an open/in_review Issue into a confirmed Decision using a single writeBatch.
 * Enforced by firestore.rules existsAfter() check on the Decision document.
 */
export async function convertIssueToDecisionAtomic(
  projectId: string,
  issue: Issue,
  existingDecisionCodes: string[],
  input: {
    title: string;
    decisionSummary: string;
    rationale: string;
    impactModules: ImpactModule[];
    decidedByName: string;
    decidedDate: string;
  }
): Promise<{ decisionId: string; decisionCode: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');

  const decisionId = generateId('dec');
  const decisionCode = computeNextCode('DEC', existingDecisionCodes);
  const modules: ImpactModule[] =
    input.impactModules.length > 0 ? input.impactModules.slice(0, 5) : ['VISION'];

  const batch = writeBatch(db);
  const decisionRef = doc(db, 'projects', projectId, 'decisions', decisionId);
  const issueRef = doc(db, 'projects', projectId, 'issues', issue.id);

  batch.set(decisionRef, {
    projectId,
    code: decisionCode,
    title: clip(input.title, LIMITS.TITLE_MAX),
    decisionSummary: clip(input.decisionSummary, LIMITS.DECISION_TEXT_MAX),
    rationale: clip(input.rationale, LIMITS.DECISION_TEXT_MAX),
    impactModules: modules,
    decidedByName: clip(input.decidedByName, LIMITS.DISPLAY_NAME_MAX),
    decidedDate: input.decidedDate,
    sourceIssueId: issue.id,
    sourceIssueCode: issue.code,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.update(issueRef, {
    status: 'resolved',
    linkedDecisionId: decisionId,
    linkedDecisionCode: decisionCode,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `projects/${projectId}/issues/${issue.id}`);
  }

  return { decisionId, decisionCode };
}

export async function createDecision(
  projectId: string,
  existingDecisionCodes: string[],
  input: {
    title: string;
    decisionSummary: string;
    rationale: string;
    impactModules: ImpactModule[];
    decidedByName: string;
    decidedDate: string;
  }
) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  const decisionId = generateId('dec');
  const code = computeNextCode('DEC', existingDecisionCodes);
  const modules: ImpactModule[] =
    input.impactModules.length > 0 ? input.impactModules.slice(0, 5) : ['VISION'];
  const path = `projects/${projectId}/decisions/${decisionId}`;

  try {
    await setDoc(doc(db, 'projects', projectId, 'decisions', decisionId), {
      projectId,
      code,
      title: clip(input.title, LIMITS.TITLE_MAX),
      decisionSummary: clip(input.decisionSummary, LIMITS.DECISION_TEXT_MAX),
      rationale: clip(input.rationale, LIMITS.DECISION_TEXT_MAX),
      impactModules: modules,
      decidedByName: clip(input.decidedByName, LIMITS.DISPLAY_NAME_MAX),
      decidedDate: input.decidedDate,
      sourceIssueId: '',
      sourceIssueCode: '',
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateDecision(
  projectId: string,
  decisionId: string,
  input: Pick<Decision, 'title' | 'decisionSummary' | 'rationale' | 'impactModules'>
) {
  const path = `projects/${projectId}/decisions/${decisionId}`;
  const modules: ImpactModule[] =
    input.impactModules.length > 0 ? input.impactModules.slice(0, 5) : ['VISION'];
  try {
    await updateDoc(doc(db, 'projects', projectId, 'decisions', decisionId), {
      title: clip(input.title, LIMITS.TITLE_MAX),
      decisionSummary: clip(input.decisionSummary, LIMITS.DECISION_TEXT_MAX),
      rationale: clip(input.rationale, LIMITS.DECISION_TEXT_MAX),
      impactModules: modules,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteDecision(projectId: string, decisionId: string) {
  const path = `projects/${projectId}/decisions/${decisionId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId, 'decisions', decisionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
