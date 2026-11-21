import React, { useMemo, useState } from 'react';
import {
  FileText,
  Pencil,
  Plus,
  Search,
  Server,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  deleteMachine,
  deleteQualityGateRun,
  seedDefaultMachines,
  upsertMachine,
} from '../services/projectService';
import {
  buildMachineInventoryMarkdown,
  triggerFileDownload,
} from '../services/pipelineSync';
import {
  Gate1CheckEntry,
  getTodayDateStr,
  LIMITS,
  MACHINE_CATEGORY_LABELS,
  MACHINE_STATUS_LABELS,
  MachineCategory,
  MachineInventory,
  MachineStatus,
  QualityGateRun,
} from '../types';

interface InventoryQaTabProps {
  projectId: string;
  projectName: string;
  projectOwnerId: string;
  currentUid: string;
  machines: MachineInventory[];
  qualityGates: QualityGateRun[];
  onOpenSyncModal: (mode: 'import' | 'export') => void;
  onToast: (msg: string) => void;
}

const CATEGORIES: MachineCategory[] = [
  'WORKSTATION',
  'LAPTOP',
  'MINI_PC',
  'EDGE_VISION',
  'ROBOT',
  'PLC',
  'MONITORING',
];

const STATUSES: MachineStatus[] = ['planned', 'mock', 'commissioning', 'deployed', 'maintenance'];

export function InventoryQaTab({
  projectId,
  projectName,
  projectOwnerId,
  currentUid,
  machines,
  qualityGates,
  onOpenSyncModal,
  onToast,
}: InventoryQaTabProps) {
  const [subView, setSubView] = useState<'machines' | 'qa'>('machines');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | MachineStatus>('all');
  const [seeding, setSeeding] = useState(false);

  // Machine Create / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<MachineInventory | null>(null);
  const [mCode, setMCode] = useState('');
  const [mCategory, setMCategory] = useState<MachineCategory>('EDGE_VISION');
  const [mHost, setMHost] = useState('');
  const [mOs, setMOs] = useState('');
  const [mEnv, setMEnv] = useState('');
  const [mNet, setMNet] = useState('');
  const [mNas, setMNas] = useState('');
  const [mBackupDate, setMBackupDate] = useState('');
  const [mGitRef, setMGitRef] = useState('');
  const [mRecipe, setMRecipe] = useState('');
  const [mStatus, setMStatus] = useState<MachineStatus>('mock');
  const [mNotes, setMNotes] = useState('');
  const [savingMachine, setSavingMachine] = useState(false);

  const filteredMachines = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...machines]
      .filter((m) => {
        if (statusFilter !== 'all' && m.status !== statusFilter) return false;
        if (q) {
          const hay =
            `${m.machineCode} ${m.hostnameModel} ${m.osFirmware} ${m.gitCommitRef} ${m.recipeVersion} ${m.notes}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || a.machineCode.localeCompare(b.machineCode));
  }, [machines, search, statusFilter]);

  const sortedGates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...qualityGates]
      .filter((g) => {
        if (!q) return true;
        const hay = `${g.runCode} ${g.gitRef} ${g.gate2Model} ${g.summary}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => b.runCode.localeCompare(a.runCode));
  }, [qualityGates, search]);

  const latestGate = sortedGates[0] || null;

  const openAddMachine = () => {
    setEditingMachine(null);
    setMCode('');
    setMCategory('EDGE_VISION');
    setMHost('');
    setMOs('Ubuntu 22.04 LTS');
    setMEnv('');
    setMNet('Cell-LAN');
    setMNas('03_machines/');
    setMBackupDate('');
    setMGitRef('');
    setMRecipe('default_recipe v1.0');
    setMStatus('planned');
    setMNotes('');
    setModalOpen(true);
  };

  const openEditMachine = (m: MachineInventory) => {
    setEditingMachine(m);
    setMCode(m.machineCode);
    setMCategory(m.category);
    setMHost(m.hostnameModel);
    setMOs(m.osFirmware);
    setMEnv(m.runtimeEnv);
    setMNet(m.networkLabel);
    setMNas(m.nasBackupPath);
    setMBackupDate(m.lastBackupDate);
    setMGitRef(m.gitCommitRef);
    setMRecipe(m.recipeVersion);
    setMStatus(m.status);
    setMNotes(m.notes);
    setModalOpen(true);
  };

  const handleSaveMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = mCode.trim().toUpperCase();
    if (!LIMITS.MACHINE_CODE_PATTERN.test(cleanCode) || !mHost.trim()) return;
    setSavingMachine(true);
    try {
      await upsertMachine(
        projectId,
        {
          machineCode: cleanCode,
          category: mCategory,
          hostnameModel: mHost,
          osFirmware: mOs || 'TBD',
          runtimeEnv: mEnv,
          networkLabel: mNet,
          nasBackupPath: mNas,
          lastBackupDate: mBackupDate,
          gitCommitRef: mGitRef,
          recipeVersion: mRecipe,
          status: mStatus,
          notes: mNotes,
          sortOrder: editingMachine ? editingMachine.sortOrder : (machines.length + 1) * 10,
        },
        Boolean(editingMachine)
      );
      onToast(`${cleanCode} 장비 정보가 저장되었습니다.`);
      setModalOpen(false);
    } finally {
      setSavingMachine(false);
    }
  };

  const handleSeed8Machines = async () => {
    setSeeding(true);
    try {
      await seedDefaultMachines(projectId);
      onToast('ICB-AICell 기본 장비 8종(WS-01~PLC-01)이 초기화되었습니다.');
    } finally {
      setSeeding(false);
    }
  };

  const handleExportMd = () => {
    const md = buildMachineInventoryMarkdown(projectName, machines);
    const filename = `machine_inventory_${getTodayDateStr()}.md`;
    triggerFileDownload(filename, md, 'text/markdown;charset=utf-8');
    onToast(`${filename} 파일이 다운로드되었습니다.`);
  };

  const statusColor = (status: MachineStatus) => {
    if (status === 'deployed') return 'text-[#16A34A]';
    if (status === 'commissioning') return 'text-[#1D4ED8]';
    if (status === 'maintenance') return 'text-[#DC2626]';
    if (status === 'mock') return 'text-[#D97706]';
    return 'text-slate-500';
  };

  const formatGate1Check = (label: string, entry: Gate1CheckEntry) => {
    const state = entry.skipped ? 'SKIP' : entry.returncode === 0 ? 'PASS' : `FAIL(${entry.returncode})`;
    const color = entry.skipped
      ? 'text-slate-400'
      : entry.returncode === 0
      ? 'text-[#16A34A]'
      : 'text-[#DC2626]';
    return (
      <div className="bg-slate-50 border border-slate-200 rounded px-3 py-2 flex items-center justify-between gap-2 text-xs">
        <span className="font-mono text-slate-600">{label}</span>
        <div className="flex items-center gap-2 font-mono tabular-nums">
          {!entry.skipped && <span className="text-[11px] text-slate-400">{entry.durationS}s</span>}
          <span className={`font-semibold ${color}`}>{state}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Toolbar & Sub-View Switcher */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            <button
              type="button"
              onClick={() => setSubView('machines')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                subView === 'machines'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              장비 인벤토리 <span className="font-mono tabular-nums ml-1">({machines.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSubView('qa')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                subView === 'qa'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              품질 게이트 Gate 1/2{' '}
              <span className="font-mono tabular-nums ml-1">({qualityGates.length})</span>
            </button>
          </div>

          {subView === 'machines' && (
            <select
              aria-label="장비 상태 필터"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | MachineStatus)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:border-[#1D4ED8]"
            >
              <option value="all">상태: 전체</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  상태: {MACHINE_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={subView === 'machines' ? '장비 코드, Git 커밋 검색' : '커밋, 요약 검색'}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
            />
          </div>

          {subView === 'machines' ? (
            <>
              <button
                type="button"
                onClick={handleExportMd}
                disabled={machines.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <FileText className="w-3.5 h-3.5" />
                MD 내보내기
              </button>
              <button
                type="button"
                onClick={openAddMachine}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                장비 추가
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onOpenSyncModal('import')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              Gate 1/2 JSON 업로드
            </button>
          )}
        </div>
      </div>

      {/* View 1: Machine Inventory (8 units) */}
      {subView === 'machines' ? (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {filteredMachines.length === 0 ? (
            <div className="py-16 px-6 text-center">
              <Server className="w-6 h-6 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-700 mb-1">
                등록된 장비 인벤토리가 없습니다
              </p>
              <p className="text-xs text-slate-500 mb-5">
                ICB-AICell 기본 장비 8종(WS-01, NB-01, MINI-01, EC1~3, MON-01, PLC-01)을 바로
                초기화하거나 JSON으로 Import하세요.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={seeding}
                  onClick={handleSeed8Machines}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1D4ED8] rounded-md hover:bg-[#1E40AF] disabled:opacity-60 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {seeding ? '초기화 중...' : 'ICB-AICell 기본 장비 8종 초기화'}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenSyncModal('import')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  JSON Import
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-4 whitespace-nowrap">장비 코드</th>
                    <th className="py-2.5 px-4">호스트명 / 모델 및 OS</th>
                    <th className="py-2.5 px-4 whitespace-nowrap">네트워크 / NAS 백업</th>
                    <th className="py-2.5 px-4 whitespace-nowrap">Git 커밋 / 레시피</th>
                    <th className="py-2.5 px-4 whitespace-nowrap text-right">상태</th>
                    <th className="py-2.5 px-4 whitespace-nowrap text-right w-20">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredMachines.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 align-top whitespace-nowrap">
                        <div className="font-mono font-semibold text-slate-900">{m.machineCode}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {MACHINE_CATEGORY_LABELS[m.category]}
                        </div>
                      </td>
                      <td className="py-3 px-4 align-top">
                        <div className="font-medium text-slate-900">{m.hostnameModel}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {m.osFirmware}
                          {m.runtimeEnv ? ` · ${m.runtimeEnv}` : ''}
                        </div>
                        {m.notes && (
                          <div className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                            {m.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 align-top whitespace-nowrap">
                        <div className="text-slate-700">{m.networkLabel || '-'}</div>
                        <div className="font-mono tabular-nums text-[11px] text-slate-500 mt-0.5">
                          {m.nasBackupPath || '-'}
                          {m.lastBackupDate ? ` · ${m.lastBackupDate}` : ' · 백업 미기록'}
                        </div>
                      </td>
                      <td className="py-3 px-4 align-top whitespace-nowrap font-mono tabular-nums">
                        <div className="text-slate-800">{m.gitCommitRef || '-'}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {m.recipeVersion || '-'}
                        </div>
                      </td>
                      <td
                        className={`py-3 px-4 align-top text-right font-semibold whitespace-nowrap ${statusColor(
                          m.status
                        )}`}
                      >
                        {MACHINE_STATUS_LABELS[m.status]}
                      </td>
                      <td className="py-3 px-4 align-top text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            title="장비 수정"
                            onClick={() => openEditMachine(m)}
                            className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {projectOwnerId === currentUid && (
                            <button
                              type="button"
                              title="장비 삭제"
                              onClick={async () => {
                                await deleteMachine(projectId, m.id);
                                onToast(`${m.machineCode} 장비가 삭제되었습니다.`);
                              }}
                              className="p-1 text-slate-400 hover:text-[#DC2626] hover:bg-red-50 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* View 2: Gate 1/2 Quality Gate Audit History */
        <div className="space-y-4">
          {latestGate && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="text-xs text-slate-500 mb-1">최근 검증 커밋</div>
                <div className="text-sm font-mono font-semibold text-slate-900 truncate">
                  {latestGate.gitRef}
                </div>
                <div className="text-xs font-mono tabular-nums text-slate-400 mt-1">
                  {latestGate.runCode} · {latestGate.reportedAt}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="text-xs text-slate-500 mb-1">Gate 1 (정적·단위)</div>
                <div
                  className={`text-lg font-mono font-bold ${
                    latestGate.gate1Status === 'PASS'
                      ? 'text-[#16A34A]'
                      : latestGate.gate1Status === 'FAIL'
                      ? 'text-[#DC2626]'
                      : 'text-slate-500'
                  }`}
                >
                  {latestGate.gate1Status}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  ruff-check · mypy · pytest
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="text-xs text-slate-500 mb-1">Gate 2 (로컬 vLLM)</div>
                <div
                  className={`text-lg font-mono font-bold ${
                    latestGate.gate2Verdict === 'PASS'
                      ? 'text-[#16A34A]'
                      : latestGate.gate2Verdict === 'FAIL'
                      ? 'text-[#DC2626]'
                      : latestGate.gate2Verdict === 'WARN'
                      ? 'text-[#D97706]'
                      : 'text-slate-500'
                  }`}
                >
                  {latestGate.gate2Verdict}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 truncate">
                  {latestGate.gate2Model || '미실행'}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="text-xs text-slate-500 mb-1">지적 건수 (C / H / M)</div>
                <div className="text-lg font-mono tabular-nums font-bold text-slate-900">
                  <span className={latestGate.findingCounts.critical > 0 ? 'text-[#DC2626]' : ''}>
                    {latestGate.findingCounts.critical}
                  </span>{' '}
                  /{' '}
                  <span className={latestGate.findingCounts.high > 0 ? 'text-[#D97706]' : ''}>
                    {latestGate.findingCounts.high}
                  </span>{' '}
                  / {latestGate.findingCounts.medium}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                  검토 파일 {latestGate.reviewedFileCount}건
                </div>
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            {sortedGates.length === 0 ? (
              <div className="py-16 px-6 text-center">
                <ShieldCheck className="w-6 h-6 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-700 mb-1">
                  기록된 Gate 1/2 품질 검증 이력이 없습니다
                </p>
                <p className="text-xs text-slate-500 mb-4">
                  gate1.py / gate2_vllm_review.py JSON 결과를 업로드해 커밋별 품질 추이를 추적하세요.
                </p>
                <button
                  type="button"
                  onClick={() => onOpenSyncModal('import')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-[#1D4ED8] rounded-md hover:bg-[#1E40AF] cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Gate 1/2 JSON 업로드
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {sortedGates.map((run) => (
                  <div key={run.id} className="p-5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                        <span className="font-mono tabular-nums font-semibold text-slate-900">
                          {run.runCode}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="font-mono text-[#1D4ED8] font-medium">{run.gitRef}</span>
                        <span className="text-slate-300">·</span>
                        <span className="font-mono tabular-nums text-slate-500">
                          {run.reportedAt}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-600">
                          Gate 1{' '}
                          <strong
                            className={`font-mono ${
                              run.gate1Status === 'PASS'
                                ? 'text-[#16A34A]'
                                : run.gate1Status === 'FAIL'
                                ? 'text-[#DC2626]'
                                : 'text-slate-500'
                            }`}
                          >
                            {run.gate1Status}
                          </strong>
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-600">
                          Gate 2{' '}
                          <strong
                            className={`font-mono ${
                              run.gate2Verdict === 'PASS'
                                ? 'text-[#16A34A]'
                                : run.gate2Verdict === 'FAIL'
                                ? 'text-[#DC2626]'
                                : run.gate2Verdict === 'WARN'
                                ? 'text-[#D97706]'
                                : 'text-slate-500'
                            }`}
                          >
                            {run.gate2Verdict}
                          </strong>
                        </span>
                        {run.securityLocalOnly && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span className="font-mono font-semibold text-[#D97706]">
                              security_local_only
                            </span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-xs font-mono tabular-nums text-slate-500">
                        <span>
                          C:{run.findingCounts.critical} H:{run.findingCounts.high} M:
                          {run.findingCounts.medium} L:{run.findingCounts.low} I:
                          {run.findingCounts.info}
                        </span>
                        {(run.createdBy === currentUid || projectOwnerId === currentUid) && (
                          <button
                            type="button"
                            title="검증 기록 삭제"
                            onClick={async () => {
                              await deleteQualityGateRun(projectId, run.id);
                              onToast(`${run.runCode} 품질 기록이 삭제되었습니다.`);
                            }}
                            className="p-1 text-slate-400 hover:text-[#DC2626] hover:bg-red-50 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                      {formatGate1Check('ruff-check', run.gate1Checks.ruff)}
                      {formatGate1Check('ruff-format', run.gate1Checks.ruffFormat)}
                      {formatGate1Check('mypy', run.gate1Checks.mypy)}
                      {formatGate1Check('pytest', run.gate1Checks.pytest)}
                    </div>

                    {run.summary && (
                      <p className="text-xs text-slate-700 leading-relaxed bg-slate-50/70 border border-slate-100 rounded p-3">
                        {run.summary}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Machine Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
              <h3 className="text-base font-semibold text-slate-900">
                {editingMachine ? `${editingMachine.machineCode} 장비 정보 수정` : '새 장비 등록'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMachine} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    장비 코드 <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingMachine)}
                    maxLength={LIMITS.MACHINE_CODE_MAX}
                    value={mCode}
                    onChange={(e) => setMCode(e.target.value.toUpperCase())}
                    placeholder="예: EC1, PLC-01"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-md disabled:bg-slate-50 focus:outline-none focus:border-[#1D4ED8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">분류</label>
                  <select
                    value={mCategory}
                    onChange={(e) => setMCategory(e.target.value as MachineCategory)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:border-[#1D4ED8]"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {MACHINE_CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">진행 상태</label>
                  <select
                    value={mStatus}
                    onChange={(e) => setMStatus(e.target.value as MachineStatus)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:border-[#1D4ED8]"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {MACHINE_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  호스트명 / 하드웨어 모델 <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={LIMITS.MACHINE_HOST_MAX}
                  value={mHost}
                  onChange={(e) => setMHost(e.target.value)}
                  placeholder="예: Jetson Orin Nano 8GB · 부품 피킹 비전"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">OS / 펌웨어</label>
                  <input
                    type="text"
                    required
                    maxLength={LIMITS.MACHINE_OS_MAX}
                    value={mOs}
                    onChange={(e) => setMOs(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">런타임 / 환경</label>
                  <input
                    type="text"
                    maxLength={LIMITS.MACHINE_ENV_MAX}
                    value={mEnv}
                    onChange={(e) => setMEnv(e.target.value)}
                    placeholder="예: Python 3.11 / Conda / TensorRT"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    네트워크 라벨 (계정·비밀번호 기재 금지)
                  </label>
                  <input
                    type="text"
                    maxLength={LIMITS.MACHINE_NET_MAX}
                    value={mNet}
                    onChange={(e) => setMNet(e.target.value)}
                    placeholder="예: Cell-LAN · Tailscale"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    NAS 상대 백업 경로
                  </label>
                  <input
                    type="text"
                    maxLength={LIMITS.MACHINE_NAS_MAX}
                    value={mNas}
                    onChange={(e) => setMNas(e.target.value)}
                    placeholder="예: 03_machines/EC1/"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">최근 백업일</label>
                  <input
                    type="date"
                    value={mBackupDate}
                    onChange={(e) => setMBackupDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono tabular-nums border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Git 커밋 / 태그</label>
                  <input
                    type="text"
                    maxLength={LIMITS.MACHINE_GIT_MAX}
                    value={mGitRef}
                    onChange={(e) => setMGitRef(e.target.value)}
                    placeholder="예: main@a4f9c21"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">레시피 버전</label>
                  <input
                    type="text"
                    maxLength={LIMITS.MACHINE_RECIPE_MAX}
                    value={mRecipe}
                    onChange={(e) => setMRecipe(e.target.value)}
                    placeholder="예: default_recipe v1.0"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">비고</label>
                <textarea
                  rows={2}
                  maxLength={LIMITS.MACHINE_NOTES_MAX}
                  value={mNotes}
                  onChange={(e) => setMNotes(e.target.value)}
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
                  disabled={savingMachine}
                  className="px-4 py-2 text-xs font-medium text-white bg-[#1D4ED8] rounded-md hover:bg-[#1E40AF] disabled:opacity-60 cursor-pointer"
                >
                  {savingMachine ? '저장 중...' : '장비 정보 저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
