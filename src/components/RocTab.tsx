import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import {
  createRocChange,
  deleteRocChange,
  updateRocContent,
  updateRocReview,
} from '../services/projectService';
import {
  addDaysDateStr,
  IMPACT_MODULE_LABELS,
  ImpactModule,
  LIMITS,
  ROC_STATUS_LABELS,
  RocChange,
  RocStatus,
  TeamMember,
  TeamRole,
} from '../types';

interface RocTabProps {
  projectId: string;
  projectOwnerId: string;
  currentUid: string;
  currentMember: TeamMember | undefined;
  fallbackName: string;
  rocChanges: RocChange[];
  initialSelectedRocId?: string | null;
  openCreateTrigger: number;
  onToast: (msg: string) => void;
}

const ALL_IMPACT_MODULES: ImpactModule[] = ['VISION', 'ROBOT', 'PLC', 'UI', 'MECH'];
const ROC_STATUSES: Array<{ value: 'all' | RocStatus; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '검토중' },
  { value: 'approved', label: '승인됨' },
  { value: 'on_hold', label: '보류' },
  { value: 'rejected', label: '반려' },
];

export function RocTab({
  projectId,
  projectOwnerId,
  currentUid,
  currentMember,
  fallbackName,
  rocChanges,
  initialSelectedRocId,
  openCreateTrigger,
  onToast,
}: RocTabProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RocStatus>('all');
  const [moduleFilter, setModuleFilter] = useState<'all' | ImpactModule>('all');

  const [selectedRocId, setSelectedRocId] = useState<string | null>(initialSelectedRocId || null);
  const [modalMode, setModalMode] = useState<'closed' | 'create' | 'edit'>('closed');

  // Form state for create/edit
  const [title, setTitle] = useState('');
  const [asIs, setAsIs] = useState('');
  const [toBe, setToBe] = useState('');
  const [reason, setReason] = useState('');
  const [impactModules, setImpactModules] = useState<ImpactModule[]>(['VISION']);
  const [targetApplyDate, setTargetApplyDate] = useState(addDaysDateStr(7));
  const [saving, setSaving] = useState(false);

  // Review state in detail drawer
  const [reviewStatus, setReviewStatus] = useState<RocStatus>('pending');
  const [reviewComment, setReviewComment] = useState('');
  const [savingReview, setSavingReview] = useState(false);

  useEffect(() => {
    if (initialSelectedRocId) {
      setSelectedRocId(initialSelectedRocId);
    }
  }, [initialSelectedRocId]);

  useEffect(() => {
    if (openCreateTrigger > 0) {
      openCreateModal();
    }
  }, [openCreateTrigger]);

  const selectedRoc = useMemo(
    () => rocChanges.find((r) => r.id === selectedRocId) || null,
    [rocChanges, selectedRocId]
  );

  useEffect(() => {
    if (selectedRoc) {
      setReviewStatus(selectedRoc.status);
      setReviewComment(selectedRoc.reviewComment || '');
    }
  }, [selectedRoc]);

  const filteredRocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...rocChanges]
      .filter((r) => {
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        if (moduleFilter !== 'all' && !r.impactModules.includes(moduleFilter)) return false;
        if (q) {
          const hay = `${r.code} ${r.title} ${r.asIs} ${r.toBe} ${r.requesterName}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.code.localeCompare(a.code));
  }, [rocChanges, search, statusFilter, moduleFilter]);

  const openCreateModal = () => {
    setTitle('');
    setAsIs('');
    setToBe('');
    setReason('');
    setImpactModules(
      currentMember && currentMember.role !== 'PM' ? [currentMember.role] : ['VISION', 'ROBOT']
    );
    setTargetApplyDate(addDaysDateStr(7));
    setModalMode('create');
  };

  const openEditModal = (roc: RocChange) => {
    setTitle(roc.title);
    setAsIs(roc.asIs);
    setToBe(roc.toBe);
    setReason(roc.reason);
    setImpactModules([...roc.impactModules]);
    setTargetApplyDate(roc.targetApplyDate);
    setModalMode('edit');
  };

  const toggleImpactModule = (mod: ImpactModule) => {
    setImpactModules((prev) => {
      if (prev.includes(mod)) {
        return prev.length > 1 ? prev.filter((m) => m !== mod) : prev;
      }
      return [...prev, mod];
    });
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !asIs.trim() || !toBe.trim() || !reason.trim()) return;
    setSaving(true);
    try {
      if (modalMode === 'create') {
        await createRocChange(
          projectId,
          rocChanges.map((r) => r.code),
          {
            title,
            asIs,
            toBe,
            reason,
            impactModules,
            requesterName: currentMember?.displayName || fallbackName,
            requesterRole: (currentMember?.role || 'PM') as TeamRole,
            targetApplyDate,
          }
        );
        onToast('새 ROC 사양 변경 이력이 등록되었습니다.');
      } else if (modalMode === 'edit' && selectedRoc) {
        await updateRocContent(projectId, selectedRoc.id, {
          title,
          asIs,
          toBe,
          reason,
          impactModules,
          targetApplyDate,
        });
        onToast(`${selectedRoc.code} 사양 내용이 수정되었습니다.`);
      }
      setModalMode('closed');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoc) return;
    setSavingReview(true);
    try {
      await updateRocReview(projectId, selectedRoc.id, {
        status: reviewStatus,
        reviewerName: currentMember?.displayName || fallbackName,
        reviewComment,
      });
      onToast(`${selectedRoc.code} 상태가 '${ROC_STATUS_LABELS[reviewStatus]}'으로 반영되었습니다.`);
    } finally {
      setSavingReview(false);
    }
  };

  const handleDelete = async (roc: RocChange) => {
    await deleteRocChange(projectId, roc.id);
    if (selectedRocId === roc.id) setSelectedRocId(null);
    onToast(`${roc.code} 이력이 삭제되었습니다.`);
  };

  const statusColor = (status: RocStatus) => {
    if (status === 'approved') return 'text-[#16A34A]';
    if (status === 'pending') return 'text-[#D97706]';
    if (status === 'rejected') return 'text-[#DC2626]';
    return 'text-slate-500';
  };

  return (
    <div className="space-y-5">
      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            {ROC_STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setStatusFilter(s.value)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  statusFilter === s.value
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <select
            aria-label="영향 모듈 필터"
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value as 'all' | ImpactModule)}
            className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:border-[#1D4ED8]"
          >
            <option value="all">영향 모듈: 전체</option>
            {ALL_IMPACT_MODULES.map((m) => (
              <option key={m} value={m}>
                영향 모듈: {IMPACT_MODULE_LABELS[m]}
              </option>
            ))}
          </select>
        </div>

        <div className="relative w-full lg:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ROC 코드, 제목, 내용 검색"
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
          />
        </div>
      </div>

      {/* Main Split: High-Density Table + Optional Right Detail Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div
          className={`${
            selectedRoc ? 'xl:col-span-7' : 'xl:col-span-12'
          } bg-white border border-slate-200 rounded-lg overflow-hidden`}
        >
          {filteredRocs.length === 0 ? (
            <div className="py-16 px-6 text-center">
              <p className="text-sm font-medium text-slate-700 mb-1">
                조건에 해당하는 ROC/사양 변경 이력이 없습니다
              </p>
              <p className="text-xs text-slate-500 mb-4">
                검색 조건을 초기화하거나 새로운 사양 변경 요청(ROC)을 등록하세요.
              </p>
              <div className="flex items-center justify-center gap-2">
                {(search || statusFilter !== 'all' || moduleFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setStatusFilter('all');
                      setModuleFilter('all');
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
                  >
                    필터 초기화
                  </button>
                )}
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-[#1D4ED8] rounded-md hover:bg-[#1E40AF] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  ROC 등록
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-4 whitespace-nowrap w-24">코드</th>
                    <th className="py-2.5 px-4">사양 변경 제목</th>
                    <th className="py-2.5 px-4 whitespace-nowrap">영향 모듈</th>
                    <th className="py-2.5 px-4 whitespace-nowrap">요청자</th>
                    <th className="py-2.5 px-4 whitespace-nowrap text-right">적용일</th>
                    <th className="py-2.5 px-4 whitespace-nowrap text-right">승인 상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredRocs.map((roc) => {
                    const isSelected = selectedRoc?.id === roc.id;
                    return (
                      <tr
                        key={roc.id}
                        onClick={() => setSelectedRocId(roc.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#1D4ED8]/[0.05]' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3 px-4 font-mono tabular-nums text-xs font-semibold text-slate-700 whitespace-nowrap">
                          {roc.code}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900 line-clamp-1">{roc.title}</div>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                          {roc.impactModules.map((m) => IMPACT_MODULE_LABELS[m]).join(' · ')}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                          {roc.requesterName}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono tabular-nums text-slate-500 text-right whitespace-nowrap">
                          {roc.targetApplyDate}
                        </td>
                        <td
                          className={`py-3 px-4 text-xs font-semibold text-right whitespace-nowrap ${statusColor(
                            roc.status
                          )}`}
                        >
                          {ROC_STATUS_LABELS[roc.status]}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail & Approval Slide Panel */}
        {selectedRoc && (
          <aside className="xl:col-span-5 bg-white border border-slate-200 rounded-lg p-6 space-y-5">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                  <span className="font-mono tabular-nums font-semibold text-slate-800">
                    {selectedRoc.code}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className={`font-semibold ${statusColor(selectedRoc.status)}`}>
                    {ROC_STATUS_LABELS[selectedRoc.status]}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">적용 {selectedRoc.targetApplyDate}</span>
                </div>
                <h3 className="text-base font-semibold text-slate-900 leading-snug">
                  {selectedRoc.title}
                </h3>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {selectedRoc.status !== 'rejected' && (
                  <button
                    type="button"
                    title="사양 내용 수정"
                    onClick={() => openEditModal(selectedRoc)}
                    className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
                {(selectedRoc.createdBy === currentUid || projectOwnerId === currentUid) && (
                  <button
                    type="button"
                    title="ROC 삭제"
                    onClick={() => handleDelete(selectedRoc)}
                    className="p-1.5 text-slate-400 hover:text-[#DC2626] hover:bg-red-50 rounded cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  title="상세 패널 닫기"
                  onClick={() => setSelectedRocId(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Metadata row */}
            <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                요청자: <strong className="font-medium text-slate-900">{selectedRoc.requesterName}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                영향 모듈:{' '}
                <strong className="font-medium text-slate-900">
                  {selectedRoc.impactModules.map((m) => IMPACT_MODULE_LABELS[m]).join(' / ')}
                </strong>
              </span>
            </div>

            {/* As-Is vs To-Be comparison */}
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5">
                <div className="text-xs font-semibold text-slate-500 mb-1">변경 전 (As-Is)</div>
                <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {selectedRoc.asIs}
                </p>
              </div>
              <div className="bg-blue-50/50 border border-blue-200/80 rounded-md p-3.5">
                <div className="text-xs font-semibold text-[#1D4ED8] mb-1">변경 후 (To-Be)</div>
                <p className="text-xs text-slate-900 leading-relaxed whitespace-pre-wrap">
                  {selectedRoc.toBe}
                </p>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">변경 사유 및 기술 근거</div>
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {selectedRoc.reason}
                </p>
              </div>
            </div>

            {/* Approval Workflow Form */}
            <form onSubmit={handleSaveReview} className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-900">승인 상태 및 검토 의견</label>
                {selectedRoc.reviewerName && (
                  <span className="text-xs text-slate-500">
                    최근 검토: {selectedRoc.reviewerName}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-md">
                {(['pending', 'approved', 'on_hold', 'rejected'] as RocStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setReviewStatus(st)}
                    className={`py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                      reviewStatus === st
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {ROC_STATUS_LABELS[st]}
                  </button>
                ))}
              </div>

              <textarea
                rows={3}
                maxLength={LIMITS.ROC_TEXT_MAX}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="파트별 검토 의견, 일정 영향, 도면/시퀀스 반영 조건을 기록하세요."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
              />

              <button
                type="submit"
                disabled={savingReview}
                className="w-full py-2 text-xs font-medium text-white bg-[#1D4ED8] rounded-md hover:bg-[#1E40AF] disabled:opacity-60 transition-colors cursor-pointer"
              >
                {savingReview ? '저장 중...' : '승인 상태 및 검토 의견 저장'}
              </button>
            </form>
          </aside>
        )}
      </div>

      {/* Create / Edit ROC Modal */}
      {modalMode !== 'closed' && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
              <h3 className="text-base font-semibold text-slate-900">
                {modalMode === 'create' ? '새 ROC / 사양 변경 등록' : `${selectedRoc?.code} 사양 내용 수정`}
              </h3>
              <button
                type="button"
                onClick={() => setModalMode('closed')}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  변경 제목 <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={LIMITS.TITLE_MAX}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: Cam 2 렌즈 초점거리 변경 및 브라켓 위치 조정"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    변경 전 (As-Is) <span className="text-[#DC2626]">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    maxLength={LIMITS.ROC_TEXT_MAX}
                    value={asIs}
                    onChange={(e) => setAsIs(e.target.value)}
                    placeholder="기존 사양 및 인터페이스 기준"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    변경 후 (To-Be) <span className="text-[#DC2626]">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    maxLength={LIMITS.ROC_TEXT_MAX}
                    value={toBe}
                    onChange={(e) => setToBe(e.target.value)}
                    placeholder="변경 적용될 신규 사양"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  변경 사유 <span className="text-[#DC2626]">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  maxLength={LIMITS.ROC_TEXT_MAX}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="사양 변경이 필요한 기술적·공정적 배경"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    영향 모듈 (복수 선택)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_IMPACT_MODULES.map((mod) => {
                      const active = impactModules.includes(mod);
                      return (
                        <button
                          key={mod}
                          type="button"
                          onClick={() => toggleImpactModule(mod)}
                          className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors cursor-pointer whitespace-nowrap ${
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
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    적용 예정일
                  </label>
                  <input
                    type="date"
                    required
                    value={targetApplyDate}
                    onChange={(e) => setTargetApplyDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm font-mono tabular-nums border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalMode('closed')}
                  className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-medium text-white bg-[#1D4ED8] rounded-md hover:bg-[#1E40AF] disabled:opacity-60 cursor-pointer"
                >
                  {saving ? '저장 중...' : modalMode === 'create' ? 'ROC 등록' : '수정 저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
