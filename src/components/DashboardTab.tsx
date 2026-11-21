import React, { useMemo } from 'react';
import { ArrowUpRight } from 'lucide-react';
import {
  ActiveTab,
  CHECKLIST_MODULE_LABELS,
  ChecklistItem,
  ChecklistModule,
  Decision,
  formatDDay,
  IMPACT_MODULE_LABELS,
  INTERFACE_PAIRS,
  Issue,
  ISSUE_MODULE_LABELS,
  ISSUE_PRIORITY_LABELS,
  MACHINE_STATUS_LABELS,
  MachineInventory,
  MachineStatus,
  Project,
  QualityGateRun,
  ROC_STATUS_LABELS,
  RocChange,
  ROLE_SHORT_LABELS,
  TeamMember,
} from '../types';

interface DashboardTabProps {
  project: Project;
  members: TeamMember[];
  checklists: ChecklistItem[];
  rocChanges: RocChange[];
  issues: Issue[];
  decisions: Decision[];
  machines: MachineInventory[];
  qualityGates: QualityGateRun[];
  onNavigateTab: (tab: ActiveTab, options?: { checklistModule?: ChecklistModule; rocId?: string }) => void;
}

const MODULES: ChecklistModule[] = ['VISION', 'ROBOT', 'PLC', 'UI'];

export function DashboardTab({
  project,
  members,
  checklists,
  rocChanges,
  issues,
  decisions,
  machines,
  qualityGates,
  onNavigateTab,
}: DashboardTabProps) {
  const stats = useMemo(() => {
    const total = checklists.length;
    const done = checklists.filter((c) => c.status === 'done').length;
    const inProgress = checklists.filter((c) => c.status === 'in_progress').length;
    const overallPct = total > 0 ? Math.round((done / total) * 100) : 0;

    const byModule = MODULES.map((mod) => {
      const items = checklists.filter((c) => c.module === mod);
      const mDone = items.filter((c) => c.status === 'done').length;
      const mInProg = items.filter((c) => c.status === 'in_progress').length;
      const pct = items.length > 0 ? Math.round((mDone / items.length) * 100) : 0;
      return {
        module: mod,
        label: CHECKLIST_MODULE_LABELS[mod],
        total: items.length,
        done: mDone,
        inProgress: mInProg,
        pct,
      };
    });

    const interfaceMatrix = INTERFACE_PAIRS.map((pair) => {
      const items = checklists.filter((c) => c.isInterface && c.interfacePair === pair);
      const pDone = items.filter((c) => c.status === 'done').length;
      const pct = items.length > 0 ? Math.round((pDone / items.length) * 100) : 0;
      return { pair, total: items.length, done: pDone, pct };
    });

    const pendingRocs = rocChanges.filter((r) => r.status === 'pending');
    const approvedRocs = rocChanges.filter((r) => r.status === 'approved');
    const openIssues = issues.filter((i) => i.status !== 'resolved');
    const criticalIssues = openIssues.filter(
      (i) => i.priority === 'blocker' || i.priority === 'high'
    );

    return {
      total,
      done,
      inProgress,
      overallPct,
      byModule,
      interfaceMatrix,
      pendingRocs,
      approvedRocs,
      openIssues,
      criticalIssues,
    };
  }, [checklists, rocChanges, issues]);

  const dday = formatDDay(project.targetDate);

  const memberWorkload = useMemo(() => {
    return members.map((m) => {
      const assigned = checklists.filter((c) => c.assigneeRole === m.role);
      const done = assigned.filter((c) => c.status === 'done').length;
      const openIss = issues.filter((i) => i.status !== 'resolved' && i.assigneeRole === m.role).length;
      return {
        ...m,
        totalChecks: assigned.length,
        doneChecks: done,
        openIssues: openIss,
        pct: assigned.length > 0 ? Math.round((done / assigned.length) * 100) : 0,
      };
    });
  }, [members, checklists, issues]);

  const pipelineSummary = useMemo(() => {
    const sortedGates = [...qualityGates].sort((a, b) => b.runCode.localeCompare(a.runCode));
    const latestGate = sortedGates[0] || null;

    const sortedMachines = [...machines].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.machineCode.localeCompare(b.machineCode)
    );
    const counts: Record<MachineStatus, number> = {
      deployed: 0,
      commissioning: 0,
      mock: 0,
      planned: 0,
      maintenance: 0,
    };
    for (const m of sortedMachines) {
      counts[m.status] += 1;
    }

    return { latestGate, totalGateRuns: sortedGates.length, sortedMachines, counts };
  }, [qualityGates, machines]);

  return (
    <div className="space-y-6">
      {/* Top 4-Column KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500 mb-2">전체 장비 통합 진척률</div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-3xl font-bold font-mono tabular-nums text-slate-900">
              {stats.overallPct}%
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {stats.done} / {stats.total} 완료
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full bg-slate-100 rounded-sm overflow-hidden">
            <div
              className="h-full bg-[#1D4ED8] transition-all duration-200"
              style={{ width: `${stats.overallPct}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-slate-500">
            진행중 <span className="font-mono tabular-nums text-slate-700">{stats.inProgress}</span>건 · 체크리스트 자동 연동
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500 mb-2">목표 FAT / 납기 일정</div>
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={`text-3xl font-bold font-mono tabular-nums ${
                dday.isOverdue ? 'text-[#DC2626]' : dday.days <= 7 ? 'text-[#D97706]' : 'text-slate-900'
              }`}
            >
              {dday.label}
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {project.targetDate}
            </span>
          </div>
          <div className="mt-4 pt-2 border-t border-slate-100 text-xs text-slate-500 truncate">
            {project.description || '3-Cam 비전 · 로봇 · PLC · 모니터링 PC'}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigateTab('roc')}
          className="text-left bg-white border border-slate-200 rounded-lg p-5 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
            <span>승인 대기 ROC 변경</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={`text-3xl font-bold font-mono tabular-nums ${
                stats.pendingRocs.length > 0 ? 'text-[#D97706]' : 'text-slate-900'
              }`}
            >
              {stats.pendingRocs.length}
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              전체 {rocChanges.length}건
            </span>
          </div>
          <div className="mt-4 pt-2 border-t border-slate-100 text-xs text-slate-500">
            승인 완료 <span className="font-mono tabular-nums text-[#16A34A] font-medium">{stats.approvedRocs.length}</span>건
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('issues')}
          className="text-left bg-white border border-slate-200 rounded-lg p-5 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
            <span>미결 이슈 (긴급·높음)</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={`text-3xl font-bold font-mono tabular-nums ${
                stats.criticalIssues.length > 0 ? 'text-[#DC2626]' : 'text-slate-900'
              }`}
            >
              {stats.criticalIssues.length}
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              총 미결 {stats.openIssues.length}건
            </span>
          </div>
          <div className="mt-4 pt-2 border-t border-slate-100 text-xs text-slate-500">
            확정 결정사항 <span className="font-mono tabular-nums text-slate-800 font-medium">{decisions.length}</span>건 기록됨
          </div>
        </button>
      </section>

      {/* Main Focal Section: Module Progress + Cross-Module Hardware Interface Matrix */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">모듈별 검증 진척률</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                모듈별 체크리스트 상태가 실시간 집계됩니다. 항목을 클릭하면 해당 모듈로 이동합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('checklist')}
              className="text-xs font-medium text-[#1D4ED8] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              체크리스트 전체 보기
            </button>
          </div>

          <div className="divide-y divide-slate-100 mt-2">
            {stats.byModule.map((m) => (
              <button
                key={m.module}
                type="button"
                onClick={() => onNavigateTab('checklist', { checklistModule: m.module })}
                className="w-full py-4 text-left hover:bg-slate-50/80 transition-colors px-2 -mx-2 rounded cursor-pointer"
              >
                <div className="flex items-center justify-between gap-4 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-sm font-semibold text-slate-900 truncate">
                      {m.label}
                    </span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      진행중 <span className="font-mono tabular-nums">{m.inProgress}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums">
                    <span className="text-xs text-slate-500">
                      {m.done}/{m.total}
                    </span>
                    <span
                      className={`text-sm font-semibold w-11 text-right ${
                        m.pct === 100
                          ? 'text-[#16A34A]'
                          : m.pct >= 50
                          ? 'text-slate-900'
                          : 'text-[#D97706]'
                      }`}
                    >
                      {m.pct}%
                    </span>
                  </div>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-sm overflow-hidden">
                  <div
                    className={`h-full transition-all duration-200 ${
                      m.pct === 100 ? 'bg-[#16A34A]' : 'bg-[#1D4ED8]'
                    }`}
                    style={{ width: `${m.pct}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between">
          <div>
            <div className="pb-4 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">하드웨어 인터페이스 연동 준비도</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                체크리스트의 파트 간 연동(통신·좌표·핸드셰이크) 항목 완료 현황입니다.
              </p>
            </div>

            <div className="divide-y divide-slate-100 mt-2">
              {stats.interfaceMatrix.map((row) => (
                <div key={row.pair} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900">{row.pair}</div>
                    <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                      {row.total > 0
                        ? `연동 항목 ${row.done}/${row.total} 검증 완료`
                        : '등록된 연동 항목 없음'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-20 h-1.5 bg-slate-100 rounded-sm overflow-hidden">
                      <div
                        className={`h-full ${
                          row.pct === 100 && row.total > 0
                            ? 'bg-[#16A34A]'
                            : row.pct > 0
                            ? 'bg-[#1D4ED8]'
                            : 'bg-slate-300'
                        }`}
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                    <span
                      className={`text-xs font-mono tabular-nums font-semibold w-10 text-right ${
                        row.pct === 100 && row.total > 0
                          ? 'text-[#16A34A]'
                          : row.total === 0
                          ? 'text-slate-400'
                          : 'text-slate-700'
                      }`}
                    >
                      {row.total > 0 ? `${row.pct}%` : '-'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="text-xs font-medium text-slate-700 mb-2.5">5인 파트별 담당 현황</div>
            <div className="space-y-2">
              {memberWorkload.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between text-xs gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-slate-400 w-9 shrink-0">
                      {ROLE_SHORT_LABELS[m.role]}
                    </span>
                    <span className="text-slate-800 font-medium truncate">{m.displayName}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums text-slate-500">
                    <span>
                      체크 {m.doneChecks}/{m.totalChecks}
                    </span>
                    <span className={m.openIssues > 0 ? 'text-[#DC2626] font-medium' : 'text-slate-400'}>
                      이슈 {m.openIssues}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pipeline QA Gate 1/2 & 8-Machine Inventory Summary */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 pb-3.5 border-b border-slate-200">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  최근 Gate 1/2 품질 게이트 요약
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  ICB-AICell 정적 검증(ruff-check·mypy·pytest) 및 로컬 vLLM 리뷰 집계
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('inventory')}
                className="text-xs font-medium text-[#1D4ED8] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                품질 이력 ({pipelineSummary.totalGateRuns})
              </button>
            </div>

            {pipelineSummary.latestGate ? (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 font-mono tabular-nums">
                    <span className="font-semibold text-slate-900">
                      {pipelineSummary.latestGate.runCode}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-[#1D4ED8] font-medium">
                      {pipelineSummary.latestGate.gitRef}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-500">{pipelineSummary.latestGate.reportedAt}</span>
                  </div>
                  {pipelineSummary.latestGate.securityLocalOnly && (
                    <span className="font-mono text-[11px] font-semibold text-[#D97706]">
                      security_local_only
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs">
                  <div>
                    <div className="text-slate-400">Gate 1 (정적·단위)</div>
                    <div
                      className={`font-mono font-bold text-base mt-0.5 ${
                        pipelineSummary.latestGate.gate1Status === 'PASS'
                          ? 'text-[#16A34A]'
                          : pipelineSummary.latestGate.gate1Status === 'FAIL'
                          ? 'text-[#DC2626]'
                          : 'text-slate-500'
                      }`}
                    >
                      {pipelineSummary.latestGate.gate1Status}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Gate 2 (vLLM)</div>
                    <div
                      className={`font-mono font-bold text-base mt-0.5 ${
                        pipelineSummary.latestGate.gate2Verdict === 'PASS'
                          ? 'text-[#16A34A]'
                          : pipelineSummary.latestGate.gate2Verdict === 'FAIL'
                          ? 'text-[#DC2626]'
                          : pipelineSummary.latestGate.gate2Verdict === 'WARN'
                          ? 'text-[#D97706]'
                          : 'text-slate-500'
                      }`}
                    >
                      {pipelineSummary.latestGate.gate2Verdict}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">지적 (C / H / M)</div>
                    <div className="font-mono tabular-nums font-bold text-base text-slate-900 mt-0.5">
                      <span
                        className={
                          pipelineSummary.latestGate.findingCounts.critical > 0
                            ? 'text-[#DC2626]'
                            : ''
                        }
                      >
                        {pipelineSummary.latestGate.findingCounts.critical}
                      </span>{' '}
                      /{' '}
                      <span
                        className={
                          pipelineSummary.latestGate.findingCounts.high > 0 ? 'text-[#D97706]' : ''
                        }
                      >
                        {pipelineSummary.latestGate.findingCounts.high}
                      </span>{' '}
                      / {pipelineSummary.latestGate.findingCounts.medium}
                    </div>
                  </div>
                </div>

                <div className="text-xs font-mono tabular-nums text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 border-t border-slate-100">
                  <span>
                    ruff-check:{' '}
                    <strong
                      className={
                        pipelineSummary.latestGate.gate1Checks.ruff.skipped
                          ? 'text-slate-400'
                          : pipelineSummary.latestGate.gate1Checks.ruff.returncode === 0
                          ? 'text-[#16A34A]'
                          : 'text-[#DC2626]'
                      }
                    >
                      {pipelineSummary.latestGate.gate1Checks.ruff.skipped
                        ? 'SKIP'
                        : pipelineSummary.latestGate.gate1Checks.ruff.returncode === 0
                        ? 'PASS'
                        : 'FAIL'}
                    </strong>
                  </span>
                  <span>
                    mypy:{' '}
                    <strong
                      className={
                        pipelineSummary.latestGate.gate1Checks.mypy.skipped
                          ? 'text-slate-400'
                          : pipelineSummary.latestGate.gate1Checks.mypy.returncode === 0
                          ? 'text-[#16A34A]'
                          : 'text-[#DC2626]'
                      }
                    >
                      {pipelineSummary.latestGate.gate1Checks.mypy.skipped
                        ? 'SKIP'
                        : pipelineSummary.latestGate.gate1Checks.mypy.returncode === 0
                        ? 'PASS'
                        : 'FAIL'}
                    </strong>
                  </span>
                  <span>
                    pytest:{' '}
                    <strong
                      className={
                        pipelineSummary.latestGate.gate1Checks.pytest.skipped
                          ? 'text-slate-400'
                          : pipelineSummary.latestGate.gate1Checks.pytest.returncode === 0
                          ? 'text-[#16A34A]'
                          : 'text-[#DC2626]'
                      }
                    >
                      {pipelineSummary.latestGate.gate1Checks.pytest.skipped
                        ? 'SKIP'
                        : pipelineSummary.latestGate.gate1Checks.pytest.returncode === 0
                        ? 'PASS'
                        : 'FAIL'}
                    </strong>
                  </span>
                </div>

                {pipelineSummary.latestGate.summary && (
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 border border-slate-100 rounded p-2.5 line-clamp-2">
                    {pipelineSummary.latestGate.summary}
                  </p>
                )}
              </div>
            ) : (
              <div className="py-10 text-center text-xs text-slate-500">
                기록된 Gate 1/2 품질 검증 이력이 없습니다. JSON Import로 첫 실행 결과를 등록하세요.
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 pb-3.5 border-b border-slate-200">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  장비 인벤토리 현황 ({pipelineSummary.sortedMachines.length}종)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  WS-01 · EC1~3 · MON-01 · PLC-01 배포 상태 및 Git 기준선 추적
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('inventory')}
                className="text-xs font-medium text-[#1D4ED8] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                인벤토리 관리
              </button>
            </div>

            {pipelineSummary.sortedMachines.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                등록된 장비가 없습니다. 장비 인벤토리 탭에서 기본 8종을 초기화할 수 있습니다.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono tabular-nums text-slate-600 pb-2.5 border-b border-slate-100">
                  <span>
                    현장 적용{' '}
                    <strong className="text-[#16A34A]">{pipelineSummary.counts.deployed}</strong>
                  </span>
                  <span>
                    시운전{' '}
                    <strong className="text-[#1D4ED8]">
                      {pipelineSummary.counts.commissioning}
                    </strong>
                  </span>
                  <span>
                    Mock <strong className="text-[#D97706]">{pipelineSummary.counts.mock}</strong>
                  </span>
                  <span>
                    도입 예정{' '}
                    <strong className="text-slate-700">{pipelineSummary.counts.planned}</strong>
                  </span>
                  {pipelineSummary.counts.maintenance > 0 && (
                    <span>
                      점검{' '}
                      <strong className="text-[#DC2626]">
                        {pipelineSummary.counts.maintenance}
                      </strong>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 divide-y sm:divide-y-0 divide-slate-100">
                  {pipelineSummary.sortedMachines.slice(0, 8).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onNavigateTab('inventory')}
                      className="py-1.5 flex items-center justify-between gap-2 text-xs hover:bg-slate-50/80 px-1.5 -mx-1.5 rounded text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-semibold text-slate-900 w-14 shrink-0">
                          {m.machineCode}
                        </span>
                        <span className="text-slate-500 font-mono text-[11px] truncate">
                          {m.gitCommitRef || m.hostnameModel}
                        </span>
                      </div>
                      <span
                        className={`font-medium shrink-0 ${
                          m.status === 'deployed'
                            ? 'text-[#16A34A]'
                            : m.status === 'commissioning'
                            ? 'text-[#1D4ED8]'
                            : m.status === 'mock'
                            ? 'text-[#D97706]'
                            : m.status === 'maintenance'
                            ? 'text-[#DC2626]'
                            : 'text-slate-500'
                        }`}
                      >
                        {MACHINE_STATUS_LABELS[m.status]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Bottom 2-Column Operational Queues: Pending ROCs & Priority Open Issues */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">승인 대기 / 최근 ROC 변경</h2>
            <button
              type="button"
              onClick={() => onNavigateTab('roc')}
              className="text-xs font-medium text-[#1D4ED8] hover:underline cursor-pointer whitespace-nowrap"
            >
              전체 ROC 이력
            </button>
          </div>

          {rocChanges.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              등록된 ROC 사양 변경 이력이 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 mt-1">
              {rocChanges.slice(0, 5).map((roc) => (
                <button
                  key={roc.id}
                  type="button"
                  onClick={() => onNavigateTab('roc', { rocId: roc.id })}
                  className="w-full py-3 text-left hover:bg-slate-50/80 transition-colors px-2 -mx-2 rounded cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-mono tabular-nums font-semibold text-slate-700 shrink-0">
                        {roc.code}
                      </span>
                      <span className="text-sm font-medium text-slate-900 truncate">
                        {roc.title}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-medium shrink-0 ${
                        roc.status === 'approved'
                          ? 'text-[#16A34A]'
                          : roc.status === 'pending'
                          ? 'text-[#D97706]'
                          : roc.status === 'rejected'
                          ? 'text-[#DC2626]'
                          : 'text-slate-500'
                      }`}
                    >
                      {ROC_STATUS_LABELS[roc.status]}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                    <span>
                      영향: {roc.impactModules.map((m) => IMPACT_MODULE_LABELS[m]).join(' / ')}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{roc.requesterName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{roc.targetApplyDate}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">주요 미결 이슈</h2>
            <button
              type="button"
              onClick={() => onNavigateTab('issues')}
              className="text-xs font-medium text-[#1D4ED8] hover:underline cursor-pointer whitespace-nowrap"
            >
              이슈 및 결정사항
            </button>
          </div>

          {stats.openIssues.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              현재 미결 이슈가 없습니다. 모든 안건이 해결되었습니다.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 mt-1">
              {[...stats.openIssues]
                .sort((a, b) => {
                  const rank = { blocker: 0, high: 1, medium: 2 };
                  return rank[a.priority] - rank[b.priority];
                })
                .slice(0, 5)
                .map((iss) => (
                  <button
                    key={iss.id}
                    type="button"
                    onClick={() => onNavigateTab('issues')}
                    className="w-full py-3 text-left hover:bg-slate-50/80 transition-colors px-2 -mx-2 rounded cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-mono tabular-nums font-semibold text-slate-700 shrink-0">
                          {iss.code}
                        </span>
                        <span className="text-sm font-medium text-slate-900 truncate">
                          {iss.title}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-medium shrink-0 ${
                          iss.priority === 'blocker'
                            ? 'text-[#DC2626]'
                            : iss.priority === 'high'
                            ? 'text-[#D97706]'
                            : 'text-slate-600'
                        }`}
                      >
                        {ISSUE_PRIORITY_LABELS[iss.priority]}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                      <span>{ISSUE_MODULE_LABELS[iss.module]}</span>
                      <span aria-hidden="true">·</span>
                      <span>{iss.assigneeName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">목표 {iss.dueDate}</span>
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
