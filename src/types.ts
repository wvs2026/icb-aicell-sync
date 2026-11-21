import { Timestamp } from 'firebase/firestore';

export type TeamRole = 'PM' | 'VISION' | 'ROBOT' | 'PLC' | 'UI';
export type ChecklistModule = 'VISION' | 'ROBOT' | 'PLC' | 'UI';
export type ImpactModule = 'VISION' | 'ROBOT' | 'PLC' | 'UI' | 'MECH';
export type IssueModule = 'VISION' | 'ROBOT' | 'PLC' | 'UI' | 'SYSTEM';

export type ChecklistStatus = 'todo' | 'in_progress' | 'done';
export type RocStatus = 'pending' | 'approved' | 'on_hold' | 'rejected';
export type IssuePriority = 'blocker' | 'high' | 'medium';
export type IssueStatus = 'open' | 'in_review' | 'resolved';

export type ActiveTab = 'dashboard' | 'roc' | 'checklist' | 'issues';

export interface Project {
  id: string;
  name: string;
  description: string;
  targetDate: string;
  inviteCode: string;
  lastJoinCode: string;
  ownerId: string;
  memberUids: string[];
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface TeamMember {
  id: string;
  projectId: string;
  uid: string;
  displayName: string;
  role: TeamRole;
  specialty: string;
  isClaimed: boolean;
  updatedAt?: Timestamp | null;
}

export interface ChecklistItem {
  id: string;
  projectId: string;
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
  createdBy: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface RocChange {
  id: string;
  projectId: string;
  code: string;
  title: string;
  asIs: string;
  toBe: string;
  reason: string;
  impactModules: ImpactModule[];
  status: RocStatus;
  requesterName: string;
  requesterRole: TeamRole;
  reviewerName: string;
  reviewComment: string;
  targetApplyDate: string;
  createdBy: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface Issue {
  id: string;
  projectId: string;
  code: string;
  title: string;
  description: string;
  module: IssueModule;
  priority: IssuePriority;
  status: IssueStatus;
  assigneeName: string;
  assigneeRole: TeamRole;
  dueDate: string;
  linkedDecisionId: string;
  linkedDecisionCode: string;
  createdBy: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface Decision {
  id: string;
  projectId: string;
  code: string;
  title: string;
  decisionSummary: string;
  rationale: string;
  impactModules: ImpactModule[];
  decidedByName: string;
  decidedDate: string;
  sourceIssueId: string;
  sourceIssueCode: string;
  createdBy: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

// Validation limits synchronized verbatim with firebase-blueprint.json & firestore.rules
export const LIMITS = {
  PROJECT_NAME_MAX: 100,
  PROJECT_DESC_MAX: 500,
  DISPLAY_NAME_MAX: 60,
  SPECIALTY_MAX: 120,
  STAGE_MAX: 80,
  INTERFACE_PAIR_MAX: 60,
  TITLE_MAX: 160,
  NOTES_MAX: 1000,
  ROC_TEXT_MAX: 1000,
  ISSUE_DESC_MAX: 1500,
  DECISION_TEXT_MAX: 1500,
  DATE_PATTERN: /^\d{4}-\d{2}-\d{2}$/,
  INVITE_CODE_PATTERN: /^[A-Z0-9]{6}$/,
} as const;

export const ROLE_LABELS: Record<TeamRole, string> = {
  PM: 'PM / 시스템 통합',
  VISION: '비전 (3-Cam)',
  ROBOT: '다관절 로봇',
  PLC: 'PLC / 전장',
  UI: '모니터링 PC / UI',
};

export const ROLE_SHORT_LABELS: Record<TeamRole, string> = {
  PM: 'PM',
  VISION: '비전',
  ROBOT: '로봇',
  PLC: 'PLC',
  UI: 'UI',
};

export const CHECKLIST_MODULE_LABELS: Record<ChecklistModule, string> = {
  VISION: '비전 (Cam 1·2·3)',
  ROBOT: '다관절 로봇',
  PLC: 'PLC / 전장',
  UI: '모니터링 UI',
};

export const IMPACT_MODULE_LABELS: Record<ImpactModule, string> = {
  VISION: '비전',
  ROBOT: '로봇',
  PLC: 'PLC',
  UI: 'UI',
  MECH: '기구',
};

export const ISSUE_MODULE_LABELS: Record<IssueModule, string> = {
  VISION: '비전',
  ROBOT: '로봇',
  PLC: 'PLC',
  UI: 'UI',
  SYSTEM: '통합/공통',
};

export const CHECKLIST_STATUS_LABELS: Record<ChecklistStatus, string> = {
  todo: '미시작',
  in_progress: '진행중',
  done: '검증완료',
};

export const ROC_STATUS_LABELS: Record<RocStatus, string> = {
  pending: '검토중',
  approved: '승인됨',
  on_hold: '보류',
  rejected: '반려',
};

export const ISSUE_PRIORITY_LABELS: Record<IssuePriority, string> = {
  blocker: '긴급 (Blocker)',
  high: '높음',
  medium: '보통',
};

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  open: '미결',
  in_review: '검토중',
  resolved: '결정완료',
};

export const INTERFACE_PAIRS = [
  '비전 ↔ 로봇',
  'PLC ↔ 로봇',
  '비전 ↔ PC',
  'PLC ↔ PC',
] as const;

export function getTodayDateStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysDateStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDDay(targetDate: string): { label: string; isOverdue: boolean; days: number } {
  const today = new Date(getTodayDateStr() + 'T00:00:00');
  const target = new Date(targetDate + 'T00:00:00');
  const diffMs = target.getTime() - today.getTime();
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (days > 0) return { label: `D-${days}`, isOverdue: false, days };
  if (days === 0) return { label: 'D-Day', isOverdue: false, days: 0 };
  return { label: `D+${Math.abs(days)}`, isOverdue: true, days };
}
