import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Link2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import {
  convertIssueToDecisionAtomic,
  createDecision,
  createIssue,
  deleteDecision,
  deleteIssue,
  updateIssue,
} from '../services/projectService';
import {
  addDaysDateStr,
  Decision,
  getTodayDateStr,
  IMPACT_MODULE_LABELS,
  ImpactModule,
  Issue,
  ISSUE_MODULE_LABELS,
  ISSUE_PRIORITY_LABELS,
  ISSUE_STATUS_LABELS,
  IssueModule,
  IssuePriority,
  IssueStatus,
  LIMITS,
  ROLE_LABELS,
  TeamMember,
  TeamRole,
} from '../types';

interface IssuesDecisionsTabProps {
  projectId: string;
  projectOwnerId: string;
  currentUid: string;
  currentMember: TeamMember | undefined;
  fallbackName: string;
  members: TeamMember[];
  issues: Issue[];
  decisions: Decision[];
  openCreateIssueTrigger: number;
  onToast: (msg: string) => void;
}

const ISSUE_MODULES: IssueModule[] = ['VISION', 'ROBOT', 'PLC', 'UI', 'SYSTEM'];
const ALL_IMPACT_MODULES: ImpactModule[] = ['VISION', 'ROBOT', 'PLC', 'UI', 'MECH'];
const ROLES: TeamRole[] = ['PM', 'VISION', 'ROBOT', 'PLC', 'UI'];

export function IssuesDecisionsTab({
  projectId,
  projectOwnerId,
  currentUid,
  currentMember,
  fallbackName,
  members,
  issues,
  decisions,
  openCreateIssueTrigger,
  onToast,
}: IssuesDecisionsTabProps) {
  const [subView, setSubView] = useState<'issues' | 'decisions'>('issues');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | IssueStatus>('active');
  const [moduleFilter, setModuleFilter] = useState<'all' | IssueModule>('all');
  const [highlightedDecisionId, setHighlightedDecisionId] = useState<string | null>(null);

  // Issue Create / Edit Modal
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const [issTitle, setIssTitle] = useState('');
  const [issDesc, setIssDesc] = useState('');
  const [issModule, setIssModule] = useState<IssueModule>('VISION');
  const [issPriority, setIssPriority] = useState<IssuePriority>('high');
  const [issStatus, setIssStatus] = useState<'open' | 'in_review'>('open');
  const [issAssigneeRole, setIssAssigneeRole] = useState<TeamRole>('VISION');
  const [issDueDate, setIssDueDate] = useState(addDaysDateStr(5));
  const [savingIssue, setSavingIssue] = useState(false);

  // One-Click Convert Issue -> Decision Modal (or Standalone Decision Modal)
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [convertingIssue, setConvertingIssue] = useState<Issue | null>(null);
  const [decTitle, setDecTitle] = useState('');
  const [decSummary, setDecSummary] = useState('');
  const [decRationale, setDecRationale] = useState('');
  const [decImpactModules, setDecImpactModules] = useState<ImpactModule[]>(['VISION']);
  const [decDate, setDecDate] = useState(getTodayDateStr());
  const [savingDecision, setSavingDecision] = useState(false);

  useEffect(() => {
    if (openCreateIssueTrigger > 0) {
      openCreateIssueModal();
    }
  }, [openCreateIssueTrigger]);

  const getAssigneeNameByRole = (role: TeamRole): string => {
    const found = members.find((m) => m.role === role);
    return found ? found.displayName : ROLE_LABELS[role];
  };

  const openCount = useMemo(
    () => issues.filter((i) => i.status !== 'resolved').length,
    [issues]
  );

  const filteredIssues = useMemo(() => {
    const q = search.trim().toLowerCase();
    const priorityRank: Record<IssuePriority, number> = { blocker: 0, high: 1, medium: 2 };
    const statusRank: Record<IssueStatus, number> = { open: 0, in_review: 1, resolved: 2 };

    return [...issues]
      .filter((i) => {
        if (statusFilter === 'active' && i.status === 'resolved') return false;
        if (
          statusFilter !== 'active' &&
          statusFilter !== 'all' &&
          i.status !== statusFilter
        ) {
          return false;
        }
        if (moduleFilter !== 'all' && i.module !== moduleFilter) return false;
        if (q) {
          const hay = `${i.code} ${i.title} ${i.description} ${i.assigneeName}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (statusRank[a.status] !== statusRank[b.status]) {
          return statusRank[a.status] - statusRank[b.status];
        }
        if (priorityRank[a.priority] !== priorityRank[b.priority]) {
          return priorityRank[a.priority] - priorityRank[b.priority];
        }
        return b.code.localeCompare(a.code);
      });
  }, [issues, search, statusFilter, moduleFilter]);

  const filteredDecisions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...decisions]
      .filter((d) => {
        if (!q) return true;
        const hay = `${d.code} ${d.title} ${d.decisionSummary} ${d.rationale} ${d.decidedByName} ${d.sourceIssueCode}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => b.code.localeCompare(a.code));
  }, [decisions, search]);

  const openCreateIssueModal = () => {
    setEditingIssue(null);
    setIssTitle('');
    setIssDesc('');
    setIssModule(
      currentMember && currentMember.role !== 'PM' ? (currentMember.role as IssueModule) : 'VISION'
    );
    setIssPriority('high');
    setIssStatus('open');
    setIssAssigneeRole(currentMember?.role || 'VISION');
    setIssDueDate(addDaysDateStr(5));
    setIssueModalOpen(true);
  };

  const openEditIssueModal = (issue: Issue) => {
    if (issue.status === 'resolved') return;
    setEditingIssue(issue);
    setIssTitle(issue.title);
    setIssDesc(issue.description);
    setIssModule(issue.module);
    setIssPriority(issue.priority);
    setIssStatus(issue.status);
    setIssAssigneeRole(issue.assigneeRole);
    setIssDueDate(issue.dueDate);
    setIssueModalOpen(true);
  };

  const openConvertToDecisionModal = (issue: Issue) => {
    setConvertingIssue(issue);
    setDecTitle(issue.title);
    setDecSummary('');
    setDecRationale('');
    const defaultImpact: ImpactModule[] =
      issue.module === 'SYSTEM'
        ? ['VISION', 'ROBOT', 'PLC', 'UI']
        : [issue.module as ImpactModule];
    setDecImpactModules(defaultImpact);
    setDecDate(getTodayDateStr());
    setDecisionModalOpen(true);
  };

  const openStandaloneDecisionModal = () => {
    setConvertingIssue(null);
    setDecTitle('');
    setDecSummary('');
    setDecRationale('');
    setDecImpactModules(['VISION', 'ROBOT']);
    setDecDate(getTodayDateStr());
    setDecisionModalOpen(true);
  };

  const toggleImpact = (mod: ImpactModule) => {
    setDecImpactModules((prev) => {
      if (prev.includes(mod)) {
        return prev.length > 1 ? prev.filter((m) => m !== mod) : prev;
      }
      return [...prev, mod];
    });
  };

  const handleSaveIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issTitle.trim() || !issDesc.trim()) return;
    setSavingIssue(true);
    try {
      const assigneeName = getAssigneeNameByRole(issAssigneeRole);
      if (editingIssue) {
        await updateIssue(projectId, editingIssue.id, {
          title: issTitle,
          description: issDesc,
          module: issModule,
          priority: issPriority,
          status: issStatus,
          assigneeRole: issAssigneeRole,
          assigneeName,
          dueDate: issDueDate,
        });
        onToast(`${editingIssue.code} 이슈가 수정되었습니다.`);
      } else {
        await createIssue(
          projectId,
          issues.map((i) => i.code),
          {
            title: issTitle,
            description: issDesc,
            module: issModule,
            priority: issPriority,
            assigneeRole: issAssigneeRole,
            assigneeName,
            dueDate: issDueDate,
          }
        );
        onToast('새 미결 이슈가 등록되었습니다.');
      }
      setIssueModalOpen(false);
    } finally {
      setSavingIssue(false);
    }
  };

  const handleSaveDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decTitle.trim() || !decSummary.trim() || !decRationale.trim()) return;
    setSavingDecision(true);
    try {
      const decidedByName = currentMember?.displayName || fallbackName;
      if (convertingIssue) {
        const { decisionId, decisionCode } = await convertIssueToDecisionAtomic(
          projectId,
          convertingIssue,
          decisions.map((d) => d.code),
          {
            title: decTitle,
            decisionSummary: decSummary,
            rationale: decRationale,
            impactModules: decImpactModules,
            decidedByName,
            decidedDate: decDate,
          }
        );
        setDecisionModalOpen(false);
        setSubView('decisions');
        setHighlightedDecisionId(decisionId);
        onToast(
          `${convertingIssue.code} 안건이 확정 결정사항(${decisionCode})으로 원자적 전환되었습니다.`
        );
      } else {
        await createDecision(
          projectId,
          decisions.map((d) => d.code),
          {
            title: decTitle,
            decisionSummary: decSummary,
            rationale: decRationale,
            impactModules: decImpactModules,
            decidedByName,
            decidedDate: decDate,
          }
        );
        setDecisionModalOpen(false);
        setSubView('decisions');
        onToast('새 확정 결정사항이 기록되었습니다.');
      }
    } finally {
      setSavingDecision(false);
    }
  };

  const handleDeleteIssue = async (issue: Issue) => {
    if (issue.status === 'resolved') return;
    await deleteIssue(projectId, issue.id);
    onToast(`${issue.code} 이슈가 삭제되었습니다.`);
  };

  const handleDeleteDecision = async (dec: Decision) => {
    await deleteDecision(projectId, dec.id);
    onToast(`${dec.code} 결정사항이 삭제되었습니다.`);
  };

  const jumpToDecision = (decisionId: string) => {
    setSubView('decisions');
    setSearch('');
    setHighlightedDecisionId(decisionId);
  };

  return (
    <div className="space-y-5">
      {/* Sub-view Switcher & Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            <button
              type="button"
              onClick={() => setSubView('issues')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                subView === 'issues'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              미결 이슈 <span className="font-mono tabular-nums ml-1">({openCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setSubView('decisions')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                subView === 'decisions'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              확정 결정사항 <span className="font-mono tabular-nums ml-1">({decisions.length})</span>
            </button>
          </div>

          {subView === 'issues' && (
            <>
              <select
                aria-label="이슈 상태 필터"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'active' | 'all' | IssueStatus)}
                className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:border-[#1D4ED8]"
              >
                <option value="active">진행 안건 (미결·검토중)</option>
                <option value="all">전체 상태 (결정완료 포함)</option>
                <option value="open">미결만 보기</option>
                <option value="in_review">검토중만 보기</option>
                <option value="resolved">결정완료 이력</option>
              </select>

              <select
                aria-label="모듈 필터"
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value as 'all' | IssueModule)}
                className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:border-[#1D4ED8]"
              >
                <option value="all">모듈: 전체</option>
                {ISSUE_MODULES.map((m) => (
                  <option key={m} value={m}>
                    모듈: {ISSUE_MODULE_LABELS[m]}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        <div className="flex items-center gap-2.5 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={subView === 'issues' ? '이슈 코드, 제목 검색' : '결정 코드, 근거 검색'}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
            />
          </div>

          {subView === 'decisions' && (
            <button
              type="button"
              onClick={openStandaloneDecisionModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              결정 직접 등록
            </button>
          )}
        </div>
      </div>

      {/* View 1: Open Issues List with One-Click Conversion */}
      {subView === 'issues' ? (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {filteredIssues.length === 0 ? (
            <div className="py-16 px-6 text-center">
              <p className="text-sm font-medium text-slate-700 mb-1">
                표시할 이슈가 없습니다
              </p>
              <p className="text-xs text-slate-500 mb-4">
                새로운 기술 이슈나 장비 연동 안건을 등록하고 결정사항으로 추적하세요.
              </p>
              <button
                type="button"
                onClick={openCreateIssueModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-[#1D4ED8] rounded-md hover:bg-[#1E40AF] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                이슈 등록
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredIssues.map((issue) => {
                const isResolved = issue.status === 'resolved';
                return (
                  <div
                    key={issue.id}
                    className={`p-5 transition-colors ${isResolved ? 'bg-slate-50/50' : 'hover:bg-slate-50/60'}`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                          <span className="font-mono tabular-nums font-semibold text-slate-800">
                            {issue.code}
                          </span>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span
                            className={`font-semibold ${
                              issue.priority === 'blocker'
                                ? 'text-[#DC2626]'
                                : issue.priority === 'high'
                                ? 'text-[#D97706]'
                                : 'text-slate-600'
                            }`}
                          >
                            {ISSUE_PRIORITY_LABELS[issue.priority]}
                          </span>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="text-slate-600">{ISSUE_MODULE_LABELS[issue.module]}</span>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span
                            className={`font-medium ${
                              isResolved
                                ? 'text-[#16A34A]'
                                : issue.status === 'in_review'
                                ? 'text-[#1D4ED8]'
                                : 'text-slate-600'
                            }`}
                          >
                            {ISSUE_STATUS_LABELS[issue.status]}
                          </span>
                        </div>

                        <h3
                          className={`text-sm font-semibold leading-snug ${
                            isResolved ? 'text-slate-500 line-through' : 'text-slate-900'
                          }`}
                        >
                          {issue.title}
                        </h3>

                        <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                          {issue.description}
                        </p>

                        <div className="pt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span>담당: {issue.assigneeName}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">목표 해결일 {issue.dueDate}</span>
                          {isResolved && issue.linkedDecisionCode && (
                            <>
                              <span aria-hidden="true">·</span>
                              <button
                                type="button"
                                onClick={() => jumpToDecision(issue.linkedDecisionId)}
                                className="inline-flex items-center gap-1 font-mono font-semibold text-[#1D4ED8] hover:underline cursor-pointer"
                              >
                                <Link2 className="w-3.5 h-3.5" />
                                확정 결정 {issue.linkedDecisionCode} 보기
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!isResolved ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openConvertToDecisionModal(issue)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#1D4ED8] rounded-md hover:bg-[#1E40AF] transition-colors cursor-pointer whitespace-nowrap"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              결정사항으로 확정
                            </button>
                            <button
                              type="button"
                              title="이슈 수정"
                              onClick={() => openEditIssueModal(issue)}
                              className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {(issue.createdBy === currentUid || projectOwnerId === currentUid) && (
                              <button
                                type="button"
                                title="이슈 삭제"
                                onClick={() => handleDeleteIssue(issue)}
                                className="p-1.5 text-slate-400 hover:text-[#DC2626] hover:bg-red-50 rounded cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-xs font-medium text-[#16A34A] whitespace-nowrap">
                            결정 전환 완료 (잠금)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* View 2: Confirmed Decisions Log */
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {filteredDecisions.length === 0 ? (
            <div className="py-16 px-6 text-center">
              <p className="text-sm font-medium text-slate-700 mb-1">
                기록된 확정 결정사항이 없습니다
              </p>
              <p className="text-xs text-slate-500 mb-4">
                미결 이슈에서 &apos;결정사항으로 확정&apos;을 실행하거나 직접 결정 이력을
                기록하세요.
              </p>
              <button
                type="button"
                onClick={openStandaloneDecisionModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-[#1D4ED8] rounded-md hover:bg-[#1E40AF] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                결정 직접 등록
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredDecisions.map((dec) => {
                const isHighlighted = highlightedDecisionId === dec.id;
                return (
                  <div
                    key={dec.id}
                    className={`p-5 transition-colors ${
                      isHighlighted ? 'bg-blue-50/60' : 'hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                          <span className="font-mono tabular-nums font-semibold text-[#16A34A]">
                            {dec.code}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">확정일 {dec.decidedDate}</span>
                          <span aria-hidden="true">·</span>
                          <span>확정자 {dec.decidedByName}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            영향: {dec.impactModules.map((m) => IMPACT_MODULE_LABELS[m]).join(' / ')}
                          </span>
                          {dec.sourceIssueCode && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1 font-mono text-[#1D4ED8] font-medium">
                                <Link2 className="w-3 h-3" />
                                원본 이슈 {dec.sourceIssueCode}
                              </span>
                            </>
                          )}
                        </div>

                        <h3 className="text-sm font-semibold text-slate-900">{dec.title}</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                          <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
                            <div className="text-xs font-semibold text-slate-500 mb-1">
                              최종 확정 내용
                            </div>
                            <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                              {dec.decisionSummary}
                            </p>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
                            <div className="text-xs font-semibold text-slate-500 mb-1">
                              결정 근거 및 배경
                            </div>
                            <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                              {dec.rationale}
                            </p>
                          </div>
                        </div>
                      </div>

                      {projectOwnerId === currentUid && (
                        <button
                          type="button"
                          title="결정사항 삭제"
                          onClick={() => handleDeleteDecision(dec)}
                          className="p-1.5 text-slate-400 hover:text-[#DC2626] hover:bg-red-50 rounded cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Issue Modal */}
      {issueModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
              <h3 className="text-base font-semibold text-slate-900">
                {editingIssue ? `${editingIssue.code} 이슈 수정` : '새 미결 이슈 등록'}
              </h3>
              <button
                type="button"
                onClick={() => setIssueModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveIssue} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  이슈 제목 <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={LIMITS.TITLE_MAX}
                  value={issTitle}
                  onChange={(e) => setIssTitle(e.target.value)}
                  placeholder="예: Cam 1 트리거 신호 노이즈로 인한 오검출 발생"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  현상 및 상세 내용 <span className="text-[#DC2626]">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  maxLength={LIMITS.ISSUE_DESC_MAX}
                  value={issDesc}
                  onChange={(e) => setIssDesc(e.target.value)}
                  placeholder="재현 조건, 계측 수치, 검토 중인 대안을 구체적으로 작성하세요."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">관련 모듈</label>
                  <select
                    value={issModule}
                    onChange={(e) => setIssModule(e.target.value as IssueModule)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:border-[#1D4ED8]"
                  >
                    {ISSUE_MODULES.map((m) => (
                      <option key={m} value={m}>
                        {ISSUE_MODULE_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">우선순위</label>
                  <select
                    value={issPriority}
                    onChange={(e) => setIssPriority(e.target.value as IssuePriority)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:border-[#1D4ED8]"
                  >
                    <option value="blocker">긴급 (Blocker)</option>
                    <option value="high">높음</option>
                    <option value="medium">보통</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">상태</label>
                  <select
                    value={issStatus}
                    onChange={(e) => setIssStatus(e.target.value as 'open' | 'in_review')}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:border-[#1D4ED8]"
                  >
                    <option value="open">미결</option>
                    <option value="in_review">검토중</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">담당자</label>
                  <select
                    value={issAssigneeRole}
                    onChange={(e) => setIssAssigneeRole(e.target.value as TeamRole)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:border-[#1D4ED8]"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {getAssigneeNameByRole(r)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">목표 해결일</label>
                  <input
                    type="date"
                    required
                    value={issDueDate}
                    onChange={(e) => setIssDueDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono tabular-nums border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIssueModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={savingIssue}
                  className="px-4 py-2 text-xs font-medium text-white bg-[#1D4ED8] rounded-md hover:bg-[#1E40AF] disabled:opacity-60 cursor-pointer"
                >
                  {savingIssue ? '저장 중...' : editingIssue ? '수정 저장' : '이슈 등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* One-Click Convert Issue -> Decision Modal (or Standalone Decision) */}
      {decisionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {convertingIssue
                    ? `${convertingIssue.code} → 확정 결정사항 전환`
                    : '새 확정 결정사항 직접 등록'}
                </h3>
                {convertingIssue && (
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                    <span>원본 이슈 자동 종결(잠금)</span>
                    <ArrowRight className="w-3 h-3" />
                    <span>상호 링크된 결정사항 로그 원자적 생성</span>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDecisionModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDecision} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  결정 제목 <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={LIMITS.TITLE_MAX}
                  value={decTitle}
                  onChange={(e) => setDecTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  최종 확정 내용 <span className="text-[#DC2626]">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  maxLength={LIMITS.DECISION_TEXT_MAX}
                  value={decSummary}
                  onChange={(e) => setDecSummary(e.target.value)}
                  placeholder="팀 합의로 확정된 최종 기술 사양·조치 방향을 명확하게 작성하세요."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  결정 근거 및 검토 이력 <span className="text-[#DC2626]">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  maxLength={LIMITS.DECISION_TEXT_MAX}
                  value={decRationale}
                  onChange={(e) => setDecRationale(e.target.value)}
                  placeholder="해당 안을 채택한 이유(테스트 결과, 비용, 납기 영향 등)를 기록하세요."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    영향 모듈
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_IMPACT_MODULES.map((mod) => {
                      const active = decImpactModules.includes(mod);
                      return (
                        <button
                          key={mod}
                          type="button"
                          onClick={() => toggleImpact(mod)}
                          className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#1D4ED8] text-white border-[#1D4ED8]'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {IMPACT_MODULE_LABELS[mod]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">확정일</label>
                  <input
                    type="date"
                    required
                    value={decDate}
                    onChange={(e) => setDecDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono tabular-nums border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setDecisionModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={savingDecision}
                  className="px-4 py-2 text-xs font-medium text-white bg-[#1D4ED8] rounded-md hover:bg-[#1E40AF] disabled:opacity-60 cursor-pointer"
                >
                  {savingDecision
                    ? '처리 중...'
                    : convertingIssue
                    ? '이슈 종결 및 결정 확정'
                    : '결정사항 등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
