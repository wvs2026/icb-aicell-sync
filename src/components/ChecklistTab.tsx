import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import {
  createChecklistItem,
  deleteChecklistItem,
  updateChecklistItem,
  updateChecklistStatus,
} from '../services/projectService';
import {
  addDaysDateStr,
  CHECKLIST_MODULE_LABELS,
  CHECKLIST_STATUS_LABELS,
  ChecklistItem,
  ChecklistModule,
  ChecklistStatus,
  INTERFACE_PAIRS,
  LIMITS,
  ROLE_LABELS,
  TeamMember,
  TeamRole,
} from '../types';

interface ChecklistTabProps {
  projectId: string;
  members: TeamMember[];
  checklists: ChecklistItem[];
  initialModule?: ChecklistModule;
  openCreateTrigger: number;
  onToast: (msg: string) => void;
}

const MODULES: ChecklistModule[] = ['VISION', 'ROBOT', 'PLC', 'UI'];
const ROLES: TeamRole[] = ['PM', 'VISION', 'ROBOT', 'PLC', 'UI'];

const DEFAULT_STAGES: Record<ChecklistModule, string[]> = {
  VISION: ['1. 카메라 3대 광학 및 조명', '2. 캘리브레이션 및 알고리즘', '3. 외부 트리거 및 통신 연동'],
  ROBOT: ['1. 기구 세팅 및 TCP 정의', '2. 경로 티칭 및 사이클 최적화', '3. PLC 인터페이스 및 안전'],
  PLC: ['1. 전장 및 I/O 맵', '2. 자동 시퀀스 및 핸드셰이크', '3. 신뢰성 및 원점 복귀'],
  UI: ['1. 실시간 검사 뷰어', '2. 레시피 및 이력 관리', '3. 알람 및 작업자 권한'],
};

export function ChecklistTab({
  projectId,
  members,
  checklists,
  initialModule,
  openCreateTrigger,
  onToast,
}: ChecklistTabProps) {
  const [activeModule, setActiveModule] = useState<ChecklistModule>(initialModule || 'VISION');
  const [statusFilter, setStatusFilter] = useState<'all' | ChecklistStatus>('all');
  const [onlyInterface, setOnlyInterface] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  // Create / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [formModule, setFormModule] = useState<ChecklistModule>('VISION');
  const [formStage, setFormStage] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formStatus, setFormStatus] = useState<ChecklistStatus>('todo');
  const [formIsInterface, setFormIsInterface] = useState(false);
  const [formInterfacePair, setFormInterfacePair] = useState<string>(INTERFACE_PAIRS[0]);
  const [formAssigneeRole, setFormAssigneeRole] = useState<TeamRole>('VISION');
  const [formDueDate, setFormDueDate] = useState(addDaysDateStr(7));
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialModule) {
      setActiveModule(initialModule);
    }
  }, [initialModule]);

  useEffect(() => {
    if (openCreateTrigger > 0) {
      openCreateModal(activeModule);
    }
  }, [openCreateTrigger]);

  const moduleMetrics = useMemo(() => {
    return MODULES.map((mod) => {
      const items = checklists.filter((c) => c.module === mod);
      const done = items.filter((c) => c.status === 'done').length;
      const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0;
      return { module: mod, total: items.length, done, pct };
    });
  }, [checklists]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return checklists
      .filter((c) => {
        if (c.module !== activeModule) return false;
        if (statusFilter !== 'all' && c.status !== statusFilter) return false;
        if (onlyInterface && !c.isInterface) return false;
        if (q) {
          const hay = `${c.title} ${c.stage} ${c.notes} ${c.assigneeName} ${c.interfacePair}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [checklists, activeModule, statusFilter, onlyInterface, search]);

  const groupedByStage = useMemo(() => {
    const map = new Map<string, ChecklistItem[]>();
    for (const item of filteredItems) {
      const list = map.get(item.stage) || [];
      list.push(item);
      map.set(item.stage, list);
    }
    return Array.from(map.entries());
  }, [filteredItems]);

  const getAssigneeNameByRole = (role: TeamRole): string => {
    const found = members.find((m) => m.role === role);
    return found ? found.displayName : ROLE_LABELS[role];
  };

  const openCreateModal = (mod: ChecklistModule) => {
    setEditingItem(null);
    setFormModule(mod);
    setFormStage(DEFAULT_STAGES[mod][0]);
    setFormTitle('');
    setFormStatus('todo');
    setFormIsInterface(false);
    setFormInterfacePair(INTERFACE_PAIRS[0]);
    setFormAssigneeRole(mod as TeamRole);
    setFormDueDate(addDaysDateStr(7));
    setFormNotes('');
    setModalOpen(true);
  };

  const openEditModal = (item: ChecklistItem) => {
    setEditingItem(item);
    setFormModule(item.module);
    setFormStage(item.stage);
    setFormTitle(item.title);
    setFormStatus(item.status);
    setFormIsInterface(item.isInterface);
    setFormInterfacePair(item.interfacePair || INTERFACE_PAIRS[0]);
    setFormAssigneeRole(item.assigneeRole);
    setFormDueDate(item.dueDate);
    setFormNotes(item.notes);
    setModalOpen(true);
  };

  const handleQuickToggle = async (item: ChecklistItem) => {
    const nextStatus: ChecklistStatus = item.status === 'done' ? 'todo' : 'done';
    await updateChecklistStatus(projectId, item.id, nextStatus);
    onToast(
      nextStatus === 'done'
        ? '검증 완료로 표시되었습니다. 대시보드 진척률에 자동 반영됩니다.'
        : '미시작 상태로 변경되었습니다.'
    );
  };

  const handleStatusChange = async (item: ChecklistItem, nextStatus: ChecklistStatus) => {
    if (item.status === nextStatus) return;
    await updateChecklistStatus(projectId, item.id, nextStatus);
    onToast(`상태가 '${CHECKLIST_STATUS_LABELS[nextStatus]}'으로 변경되었습니다.`);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;
    setSaving(true);
    try {
      const assigneeName = getAssigneeNameByRole(formAssigneeRole);
      if (editingItem) {
        await updateChecklistItem(projectId, editingItem.id, {
          module: formModule,
          stage: formStage,
          isInterface: formIsInterface,
          interfacePair: formIsInterface ? formInterfacePair : '',
          title: formTitle,
          status: formStatus,
          assigneeRole: formAssigneeRole,
          assigneeName,
          dueDate: formDueDate,
          notes: formNotes,
        });
        onToast('체크리스트 항목이 수정되었습니다.');
      } else {
        const maxSort = checklists.reduce((acc, c) => Math.max(acc, c.sortOrder), 0);
        await createChecklistItem(projectId, {
          module: formModule,
          stage: formStage,
          isInterface: formIsInterface,
          interfacePair: formIsInterface ? formInterfacePair : '',
          title: formTitle,
          status: formStatus,
          assigneeRole: formAssigneeRole,
          assigneeName,
          dueDate: formDueDate,
          notes: formNotes,
          sortOrder: maxSort + 10,
        });
        setActiveModule(formModule);
        onToast('새 체크리스트 항목이 추가되었습니다.');
      }
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: ChecklistItem) => {
    await deleteChecklistItem(projectId, item.id);
    onToast('체크리스트 항목이 삭제되었습니다.');
  };

  const activeMetric = moduleMetrics.find((m) => m.module === activeModule);

  return (
    <div className="space-y-5">
      {/* 4-Module Switcher with Live Completion Rollup */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {moduleMetrics.map((m) => {
          const isActive = m.module === activeModule;
          return (
            <button
              key={m.module}
              type="button"
              onClick={() => setActiveModule(m.module)}
              className={`text-left p-4 rounded-lg border transition-colors cursor-pointer ${
                isActive
                  ? 'bg-white border-[#1D4ED8] ring-1 ring-[#1D4ED8]/15'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span
                  className={`text-sm font-semibold truncate ${
                    isActive ? 'text-[#1D4ED8]' : 'text-slate-900'
                  }`}
                >
                  {CHECKLIST_MODULE_LABELS[m.module]}
                </span>
                <span
                  className={`text-sm font-mono tabular-nums font-semibold shrink-0 ${
                    m.pct === 100 ? 'text-[#16A34A]' : 'text-slate-800'
                  }`}
                >
                  {m.pct}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-sm overflow-hidden mb-1.5">
                <div
                  className={`h-full transition-all duration-200 ${
                    m.pct === 100 ? 'bg-[#16A34A]' : 'bg-[#1D4ED8]'
                  }`}
                  style={{ width: `${m.pct}%` }}
                />
              </div>
              <div className="text-xs font-mono tabular-nums text-slate-500">
                완료 {m.done} / 전체 {m.total}
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            {(
              [
                { value: 'all', label: '전체' },
                { value: 'todo', label: '미시작' },
                { value: 'in_progress', label: '진행중' },
                { value: 'done', label: '검증완료' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  statusFilter === opt.value
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyInterface}
              onChange={(e) => setOnlyInterface(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-300 text-[#1D4ED8] focus:ring-[#1D4ED8]"
            />
            파트 간 연동 항목만 보기
          </label>
        </div>

        <div className="relative w-full lg:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="항목명, 공정 단계, 메모 검색"
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
          />
        </div>
      </div>

      {/* Stage-Grouped Checklist Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50/50">
          <div className="text-xs text-slate-600">
            <strong className="font-semibold text-slate-900">
              {CHECKLIST_MODULE_LABELS[activeModule]}
            </strong>
            <span className="mx-2 text-slate-300">|</span>
            <span>
              표시 항목 <strong className="font-mono tabular-nums">{filteredItems.length}</strong>건
              {activeMetric ? ` (모듈 전체 완료율 ${activeMetric.pct}%)` : ''}
            </span>
          </div>
          <button
            type="button"
            onClick={() => openCreateModal(activeModule)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#1D4ED8] hover:underline cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            이 모듈에 항목 추가
          </button>
        </div>

        {groupedByStage.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <p className="text-sm font-medium text-slate-700 mb-1">
              조건에 맞는 체크리스트 항목이 없습니다
            </p>
            <p className="text-xs text-slate-500 mb-4">
              필터를 초기화하거나 {CHECKLIST_MODULE_LABELS[activeModule]} 파트의 신규 검증 항목을
              등록하세요.
            </p>
            <button
              type="button"
              onClick={() => openCreateModal(activeModule)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-[#1D4ED8] rounded-md hover:bg-[#1E40AF] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              체크 항목 추가
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {groupedByStage.map(([stageName, items]) => {
              const stageDone = items.filter((i) => i.status === 'done').length;
              return (
                <div key={stageName}>
                  <div className="px-5 py-2.5 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">{stageName}</span>
                    <span className="text-xs font-mono tabular-nums text-slate-500">
                      {stageDone}/{items.length} 완료
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {items.map((item) => {
                      const isDone = item.status === 'done';
                      const hasNotes = Boolean(item.notes?.trim());
                      const isExpanded = Boolean(expandedNotes[item.id]);

                      return (
                        <div key={item.id} className="px-5 py-3 hover:bg-slate-50/60 transition-colors">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <button
                                type="button"
                                aria-label={isDone ? '완료 해제' : '완료 표시'}
                                onClick={() => handleQuickToggle(item)}
                                className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                                  isDone
                                    ? 'bg-[#16A34A] border-[#16A34A] text-white'
                                    : 'bg-white border-slate-300 hover:border-[#1D4ED8]'
                                }`}
                              >
                                {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                              </button>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className={`text-sm font-medium leading-snug ${
                                      isDone ? 'line-through text-slate-400' : 'text-slate-900'
                                    }`}
                                  >
                                    {item.title}
                                  </span>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-500">
                                  <span>{item.assigneeName}</span>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono tabular-nums">목표 {item.dueDate}</span>
                                  {item.isInterface && item.interfacePair && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="font-medium text-[#1D4ED8]">
                                        연동 {item.interfacePair}
                                      </span>
                                    </>
                                  )}
                                  {hasNotes && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setExpandedNotes((prev) => ({
                                            ...prev,
                                            [item.id]: !prev[item.id],
                                          }))
                                        }
                                        className="inline-flex items-center gap-0.5 text-slate-600 hover:text-slate-900 cursor-pointer"
                                      >
                                        {isExpanded ? (
                                          <ChevronDown className="w-3 h-3" />
                                        ) : (
                                          <ChevronRight className="w-3 h-3" />
                                        )}
                                        기술 메모
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pl-7 md:pl-0 shrink-0">
                              <select
                                aria-label="항목 진행 상태"
                                value={item.status}
                                onChange={(e) =>
                                  handleStatusChange(item, e.target.value as ChecklistStatus)
                                }
                                className={`px-2.5 py-1 text-xs font-medium border border-slate-200 rounded bg-white focus:outline-none focus:border-[#1D4ED8] cursor-pointer ${
                                  item.status === 'done'
                                    ? 'text-[#16A34A]'
                                    : item.status === 'in_progress'
                                    ? 'text-[#D97706]'
                                    : 'text-slate-600'
                                }`}
                              >
                                <option value="todo">미시작</option>
                                <option value="in_progress">진행중</option>
                                <option value="done">검증완료</option>
                              </select>

                              <button
                                type="button"
                                title="항목 편집"
                                onClick={() => openEditModal(item)}
                                className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                title="항목 삭제"
                                onClick={() => handleDelete(item)}
                                className="p-1.5 text-slate-400 hover:text-[#DC2626] hover:bg-red-50 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {hasNotes && isExpanded && (
                            <div className="mt-2.5 ml-7 p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                              {item.notes}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Checklist Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
              <h3 className="text-base font-semibold text-slate-900">
                {editingItem ? '체크리스트 항목 편집' : '새 체크리스트 항목 추가'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">모듈</label>
                  <select
                    value={formModule}
                    onChange={(e) => {
                      const nextMod = e.target.value as ChecklistModule;
                      setFormModule(nextMod);
                      if (!editingItem) {
                        setFormStage(DEFAULT_STAGES[nextMod][0]);
                        setFormAssigneeRole(nextMod as TeamRole);
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:border-[#1D4ED8]"
                  >
                    {MODULES.map((m) => (
                      <option key={m} value={m}>
                        {CHECKLIST_MODULE_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    공정 / 검증 단계
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={LIMITS.STAGE_MAX}
                    list="checklist-stage-suggestions"
                    value={formStage}
                    onChange={(e) => setFormStage(e.target.value)}
                    placeholder="예: 2. 캘리브레이션 및 알고리즘"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
                  />
                  <datalist id="checklist-stage-suggestions">
                    {DEFAULT_STAGES[formModule].map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  검증 항목명 <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={LIMITS.TITLE_MAX}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="예: Cam 1-3 트리거 지연 시간 1ms 이하 검증"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">상태</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as ChecklistStatus)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:border-[#1D4ED8]"
                  >
                    <option value="todo">미시작</option>
                    <option value="in_progress">진행중</option>
                    <option value="done">검증완료</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">담당 파트</label>
                  <select
                    value={formAssigneeRole}
                    onChange={(e) => setFormAssigneeRole(e.target.value as TeamRole)}
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">목표 완료일</label>
                  <input
                    type="date"
                    required
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono tabular-nums border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
                  />
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md space-y-2.5">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsInterface}
                    onChange={(e) => setFormIsInterface(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-[#1D4ED8]"
                  />
                  하드웨어 파트 간 연동 검증 항목 (대시보드 연동 준비도 자동 반영)
                </label>

                {formIsInterface && (
                  <select
                    value={formInterfacePair}
                    onChange={(e) => setFormInterfacePair(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:border-[#1D4ED8]"
                  >
                    {INTERFACE_PAIRS.map((pair) => (
                      <option key={pair} value={pair}>
                        연동 구간: {pair}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  기술 메모 / 계측 기준치
                </label>
                <textarea
                  rows={3}
                  maxLength={LIMITS.NOTES_MAX}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="허용 공차, 통신 프로토콜 버전, 테스트 시료 조건 등을 기록하세요."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-medium text-white bg-[#1D4ED8] rounded-md hover:bg-[#1E40AF] disabled:opacity-60 cursor-pointer"
                >
                  {saving ? '저장 중...' : editingItem ? '수정 저장' : '항목 추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
