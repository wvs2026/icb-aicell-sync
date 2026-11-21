import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  FileJson,
  FileText,
  ShieldAlert,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import { commitPipelineImportBatch } from '../services/projectService';
import {
  buildCellSyncExportPayload,
  buildMachineInventoryMarkdown,
  ImportParseResult,
  ParsedCandidateIssue,
  ParsedCandidateMachine,
  parsePipelineImportJson,
  triggerFileDownload,
} from '../services/pipelineSync';
import {
  Decision,
  getTodayDateStr,
  Issue,
  ISSUE_MODULE_LABELS,
  ISSUE_PRIORITY_LABELS,
  MachineInventory,
  Project,
  QualityGateRun,
  RocChange,
  TeamMember,
} from '../types';

interface PipelineSyncModalProps {
  project: Project;
  members: TeamMember[];
  issues: Issue[];
  rocChanges: RocChange[];
  decisions: Decision[];
  machines: MachineInventory[];
  qualityGates: QualityGateRun[];
  initialMode?: 'import' | 'export';
  onClose: () => void;
  onToast: (msg: string) => void;
}

const SAMPLE_ICB_BUNDLE = {
  schema_version: 'icb_import_v1',
  git_ref: 'main@c8e1f04',
  reported_at: getTodayDateStr(),
  gate1: {
    results: [
      { name: 'ruff-check', returncode: 0, duration_s: 0.34, skipped: false, reason: '' },
      { name: 'ruff-format', returncode: 0, duration_s: 0.16, skipped: false, reason: '' },
      { name: 'mypy', returncode: 0, duration_s: 2.41, skipped: false, reason: '' },
      { name: 'pytest', returncode: 0, duration_s: 3.92, skipped: false, reason: '' },
    ],
  },
  gate2: {
    verdict: 'WARN',
    model: 'vllm-local-qwen2.5-coder-32b',
    base_url: 'http://100.64.0.10:8000/v1',
    reviewed_files: [
      'src/icb_aicell/plc/controller.py',
      'src/icb_aicell/vision/ec1_picker.py',
    ],
    security_local_only: false,
    timestamp_utc: `${getTodayDateStr()}T08:30:00Z`,
    summary: 'PLC 10단계 FSM 정상. EC1 파지 재시도 카운트 경계 조건 1건(HIGH) 보완 필요.',
    findings: [
      {
        severity: 'HIGH',
        category: 'error_handling',
        file: 'src/icb_aicell/vision/ec1_picker.py',
        line: 142,
        title: 'EC1 15슬롯 공상자 감지 시 재시도 루프 상한 미검증',
        detail: 'cell_config.json의 max_retry 값을 초과해도 PLC 알람 204를 발생시키지 않고 대기 상태 유지.',
        suggestion: '재시도 초과 시 AlarmCode.EC1_EMPTY_TRAY(204) 반환 후 PLC 안전 정지 전이.',
      },
      {
        severity: 'MEDIUM',
        category: 'handshake_spec',
        file: 'src/icb_aicell/plc/controller.py',
        line: 88,
        title: 'Step 7 퇴피 완료 대기 로그에 seq_no 누락',
        detail: '디버깅 추적성 향상을 위해 CycleRecord seq_no 로깅 추가 권장.',
        suggestion: 'logger.info 포맷에 seq_no 포함.',
      },
    ],
  },
  issues: [
    {
      external_ref: 'handshake-10.4-estop-recovery',
      title: 'E-Stop 해제 후 Fanuc 로봇 원점 복귀 시퀀스 Step 0 초기화 조건 확정',
      description: 'docs/handshake_signals.md §10 미결정 사항: 비상정지 복구 시 로봇 파지 부품 유지 여부 및 PLC Step 0 복귀 조건 합의 필요.',
      module: 'PLC',
      priority: 'high',
      source: 'docs/handshake_signals.md §10',
    },
  ],
};

export function PipelineSyncModal({
  project,
  members,
  issues,
  rocChanges,
  decisions,
  machines,
  qualityGates,
  initialMode = 'import',
  onClose,
  onToast,
}: PipelineSyncModalProps) {
  const [mode, setMode] = useState<'import' | 'export'>(initialMode);
  const [rawJson, setRawJson] = useState('');
  const [parseResult, setParseResult] = useState<ImportParseResult | null>(null);
  const [includeGate, setIncludeGate] = useState(true);
  const [candidateIssues, setCandidateIssues] = useState<ParsedCandidateIssue[]>([]);
  const [candidateMachines, setCandidateMachines] = useState<ParsedCandidateMachine[]>([]);
  const [committing, setCommitting] = useState(false);

  // Export toggles
  const [exportIncludeMachines, setExportIncludeMachines] = useState(true);

  const approvedRocs = useMemo(
    () => rocChanges.filter((r) => r.status === 'approved'),
    [rocChanges]
  );

  const runParse = (text: string) => {
    setRawJson(text);
    if (!text.trim()) {
      setParseResult(null);
      setCandidateIssues([]);
      setCandidateMachines([]);
      return;
    }
    const result = parsePipelineImportJson(text, issues, machines, members);
    setParseResult(result);
    setIncludeGate(Boolean(result.qualityGate));
    setCandidateIssues(result.candidateIssues);
    setCandidateMachines(result.candidateMachines);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      runParse(String(reader.result || ''));
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const handleLoadSample = () => {
    runParse(JSON.stringify(SAMPLE_ICB_BUNDLE, null, 2));
  };

  const toggleIssue = (key: string) => {
    setCandidateIssues((prev) =>
      prev.map((item) => (item.key === key ? { ...item, selected: !item.selected } : item))
    );
  };

  const toggleMachine = (code: string) => {
    setCandidateMachines((prev) =>
      prev.map((m) => (m.machineCode === code ? { ...m, selected: !m.selected } : m))
    );
  };

  const selectedIssues = candidateIssues.filter((i) => i.selected);
  const selectedMachines = candidateMachines.filter((m) => m.selected);
  const canCommit =
    Boolean(parseResult?.ok) &&
    ((includeGate && Boolean(parseResult?.qualityGate)) ||
      selectedIssues.length > 0 ||
      selectedMachines.length > 0);

  const handleCommitImport = async () => {
    if (!parseResult?.ok || !canCommit) return;
    setCommitting(true);
    try {
      const res = await commitPipelineImportBatch({
        projectId: project.id,
        existingIssueCodes: issues.map((i) => i.code),
        existingRunCodes: qualityGates.map((q) => q.runCode),
        qualityGate: parseResult.qualityGate,
        includeQualityGate: includeGate,
        selectedIssues,
        selectedMachines,
      });

      const summaryParts: string[] = [];
      if (res.savedRunCode) summaryParts.push(`QA 게이트 ${res.savedRunCode}`);
      if (res.importedIssueCount > 0) summaryParts.push(`이슈 ${res.importedIssueCount}건`);
      if (res.upsertedMachineCount > 0) summaryParts.push(`장비 ${res.upsertedMachineCount}대`);
      onToast(`ICB-AICell Import 완료: ${summaryParts.join(' · ')} 반영됨`);
      onClose();
    } finally {
      setCommitting(false);
    }
  };

  const handleDownloadExportJson = () => {
    const payload = buildCellSyncExportPayload({
      project,
      rocChanges,
      decisions,
      issues,
      machines,
      includeMachines: exportIncludeMachines,
    });
    const filename = `cell-sync-export-${getTodayDateStr()}.json`;
    triggerFileDownload(filename, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
    onToast(`${filename} 파일이 다운로드되었습니다.`);
  };

  const handleDownloadMachinesMarkdown = () => {
    const md = buildMachineInventoryMarkdown(project.name, machines);
    const filename = `machine_inventory_${getTodayDateStr()}.md`;
    triggerFileDownload(filename, md, 'text/markdown;charset=utf-8');
    onToast(`${filename} 마크다운 인벤토리가 다운로드되었습니다.`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-lg flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              ICB-AICell 파이프라인 JSON 연동
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pre-flight 보안 검사(base_url 제거 · security_local_only 마스킹) 후 안전하게 Import/Export합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="px-6 pt-4 shrink-0">
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-md">
            <button
              type="button"
              onClick={() => setMode('import')}
              className={`inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'import'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              JSON Import (이슈 · Gate 1/2 · 장비)
            </button>
            <button
              type="button"
              onClick={() => setMode('export')}
              className={`inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'export'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              JSON / Markdown Export (ROC · Decision · 장비)
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {mode === 'import' ? (
            <>
              {/* Upload / Paste Controls */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#1D4ED8] rounded-md hover:bg-[#1E40AF] transition-colors cursor-pointer whitespace-nowrap">
                      <FileJson className="w-3.5 h-3.5" />
                      JSON 파일 선택
                      <input
                        type="file"
                        accept=".json,application/json"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleLoadSample}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                    >
                      샘플 ICB 번들 테스트
                    </button>
                  </div>

                  {rawJson && (
                    <button
                      type="button"
                      onClick={() => runParse('')}
                      className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      입력 비우기
                    </button>
                  )}
                </div>

                <textarea
                  rows={5}
                  value={rawJson}
                  onChange={(e) => runParse(e.target.value)}
                  placeholder="icb_import_v1 번들 JSON, gate1.py --json-report 출력, gate2_vllm_review.py ReviewReport JSON, 또는 issues 배열을 붙여넣거나 파일을 선택하세요."
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-md bg-slate-50/50 focus:bg-white focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>

              {/* Pre-flight Blocked Error */}
              {parseResult && !parseResult.ok && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-md flex items-start gap-2.5 text-xs text-[#DC2626]">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold mb-0.5">Pre-flight 검증 차단</div>
                    <p className="leading-relaxed">{parseResult.blockReason}</p>
                  </div>
                </div>
              )}

              {/* Redaction Notices */}
              {parseResult?.ok && parseResult.redactionNotices.length > 0 && (
                <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-md space-y-1 text-xs text-amber-900">
                  <div className="flex items-center gap-1.5 font-semibold text-[#D97706]">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Pre-flight 보안 정화(Sanitization) 적용됨
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5 text-amber-800">
                    {parseResult.redactionNotices.map((n, idx) => (
                      <li key={idx}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Parsed Preview Sections */}
              {parseResult?.ok && (
                <div className="space-y-4">
                  {/* 1. Quality Gate 1/2 Summary Preview */}
                  {parseResult.qualityGate && (
                    <div className="border border-slate-200 rounded-md p-4 space-y-3">
                      <label className="flex items-center justify-between gap-3 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={includeGate}
                            onChange={(e) => setIncludeGate(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-[#1D4ED8]"
                          />
                          <span className="text-xs font-semibold text-slate-900">
                            품질 게이트 실행 요약 저장 (qualityGates)
                          </span>
                        </div>
                        <span className="text-xs font-mono tabular-nums text-slate-500">
                          {parseResult.qualityGate.gitRef} · {parseResult.qualityGate.reportedAt}
                        </span>
                      </label>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-slate-100">
                        <div>
                          <div className="text-slate-400">Gate 1 상태</div>
                          <div
                            className={`font-mono font-semibold mt-0.5 ${
                              parseResult.qualityGate.gate1Status === 'PASS'
                                ? 'text-[#16A34A]'
                                : parseResult.qualityGate.gate1Status === 'FAIL'
                                ? 'text-[#DC2626]'
                                : 'text-slate-500'
                            }`}
                          >
                            {parseResult.qualityGate.gate1Status}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400">Gate 2 판정</div>
                          <div
                            className={`font-mono font-semibold mt-0.5 ${
                              parseResult.qualityGate.gate2Verdict === 'PASS'
                                ? 'text-[#16A34A]'
                                : parseResult.qualityGate.gate2Verdict === 'FAIL'
                                ? 'text-[#DC2626]'
                                : parseResult.qualityGate.gate2Verdict === 'WARN'
                                ? 'text-[#D97706]'
                                : 'text-slate-500'
                            }`}
                          >
                            {parseResult.qualityGate.gate2Verdict}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400">Findings (C/H/M/L/I)</div>
                          <div className="font-mono tabular-nums font-medium text-slate-800 mt-0.5">
                            {parseResult.qualityGate.findingCounts.critical}/
                            {parseResult.qualityGate.findingCounts.high}/
                            {parseResult.qualityGate.findingCounts.medium}/
                            {parseResult.qualityGate.findingCounts.low}/
                            {parseResult.qualityGate.findingCounts.info}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400">보안 로컬 전용</div>
                          <div className="font-mono font-medium text-slate-800 mt-0.5">
                            {parseResult.qualityGate.securityLocalOnly ? 'YES (마스킹)' : 'NO'}
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded p-2.5 leading-relaxed">
                        <div className="font-mono text-[11px] text-slate-500 mb-1">
                          ruff(ruff-check):{' '}
                          {parseResult.qualityGate.gate1Checks.ruff.skipped
                            ? 'SKIP'
                            : parseResult.qualityGate.gate1Checks.ruff.returncode === 0
                            ? 'PASS'
                            : 'FAIL'}{' '}
                          · ruff-format:{' '}
                          {parseResult.qualityGate.gate1Checks.ruffFormat.skipped
                            ? 'SKIP'
                            : parseResult.qualityGate.gate1Checks.ruffFormat.returncode === 0
                            ? 'PASS'
                            : 'FAIL'}{' '}
                          · mypy:{' '}
                          {parseResult.qualityGate.gate1Checks.mypy.skipped
                            ? 'SKIP'
                            : parseResult.qualityGate.gate1Checks.mypy.returncode === 0
                            ? 'PASS'
                            : 'FAIL'}{' '}
                          · pytest:{' '}
                          {parseResult.qualityGate.gate1Checks.pytest.skipped
                            ? 'SKIP'
                            : parseResult.qualityGate.gate1Checks.pytest.returncode === 0
                            ? 'PASS'
                            : 'FAIL'}
                        </div>
                        {parseResult.qualityGate.summary}
                      </div>
                    </div>
                  )}

                  {/* 2. Candidate Issues Table (Open Issues + Non-security Gate 2 CRITICAL/HIGH) */}
                  {candidateIssues.length > 0 && (
                    <div className="border border-slate-200 rounded-md overflow-hidden">
                      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-900">
                          이슈 등록 후보 ({selectedIssues.length}/{candidateIssues.length} 선택)
                        </span>
                        <span className="text-slate-500">
                          externalRef 기준 중복 항목은 자동 제외(체크 해제)됩니다
                        </span>
                      </div>
                      <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                        {candidateIssues.map((item) => (
                          <label
                            key={item.key}
                            className={`px-4 py-2.5 flex items-start gap-3 text-xs cursor-pointer ${
                              item.isDuplicate ? 'bg-slate-50/70' : 'hover:bg-slate-50/50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => toggleIssue(item.key)}
                              className="mt-0.5 w-3.5 h-3.5 rounded border-slate-300 text-[#1D4ED8]"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-slate-900 truncate">
                                  {item.title}
                                </span>
                                <span
                                  className={`shrink-0 font-mono ${
                                    item.isDuplicate ? 'text-[#D97706]' : 'text-[#16A34A]'
                                  }`}
                                >
                                  {item.isDuplicate ? `중복(${item.duplicateCode})` : '신규'}
                                </span>
                              </div>
                              <div className="mt-0.5 text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2">
                                <span>{ISSUE_MODULE_LABELS[item.module]}</span>
                                <span>·</span>
                                <span>{ISSUE_PRIORITY_LABELS[item.priority]}</span>
                                <span>·</span>
                                <span className="font-mono">ref: {item.externalRef || '-'}</span>
                                <span>·</span>
                                <span>{item.sourceLabel}</span>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 3. Candidate Machines Table */}
                  {candidateMachines.length > 0 && (
                    <div className="border border-slate-200 rounded-md overflow-hidden">
                      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-900">
                          장비 인벤토리 동기화 ({selectedMachines.length}/{candidateMachines.length} 선택)
                        </span>
                        <span className="text-slate-500">machineCode 기준 Upsert</span>
                      </div>
                      <div className="divide-y divide-slate-100 max-h-44 overflow-y-auto">
                        {candidateMachines.map((m) => (
                          <label
                            key={m.machineCode}
                            className="px-4 py-2 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/50 cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={m.selected}
                                onChange={() => toggleMachine(m.machineCode)}
                                className="w-3.5 h-3.5 rounded border-slate-300 text-[#1D4ED8]"
                              />
                              <span className="font-mono font-semibold text-slate-800 w-16 shrink-0">
                                {m.machineCode}
                              </span>
                              <span className="text-slate-700 truncate">{m.hostnameModel}</span>
                            </div>
                            <span className="font-mono text-[11px] text-slate-500 shrink-0">
                              {m.gitCommitRef || '-'} · {m.isUpdate ? '업데이트' : '신규'}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Export View */
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-md flex items-start gap-2.5 text-xs text-slate-600">
                <ShieldCheck className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Export 파일에는 Firebase 내부 식별자(<code className="font-mono">createdBy</code>,{' '}
                  <code className="font-mono">memberUids</code>,{' '}
                  <code className="font-mono">inviteCode</code>)가 포함되지 않아{' '}
                  <code className="font-mono">wvs2026/icb-aicell</code> GitHub 저장소에 안전하게
                  커밋할 수 있습니다.
                </p>
              </div>

              <div className="border border-slate-200 rounded-md p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      승인 ROC · 확정 Decision 기준선 Export (JSON)
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      스키마 <span className="font-mono">cell-sync.export.v1</span> · Gate 2 로컬
                      리뷰 참조용 기준 데이터
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadExportJson}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#1D4ED8] rounded-md hover:bg-[#1E40AF] cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    JSON 다운로드
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-xs">
                  <div>
                    <div className="text-slate-400">승인된 ROC</div>
                    <div className="font-mono tabular-nums text-base font-semibold text-slate-900 mt-0.5">
                      {approvedRocs.length}건
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">확정 Decision</div>
                    <div className="font-mono tabular-nums text-base font-semibold text-slate-900 mt-0.5">
                      {decisions.length}건
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">장비 인벤토리</div>
                    <div className="font-mono tabular-nums text-base font-semibold text-slate-900 mt-0.5">
                      {machines.length}대
                    </div>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-700 pt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportIncludeMachines}
                    onChange={(e) => setExportIncludeMachines(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-[#1D4ED8]"
                  />
                  Export JSON에 장비 인벤토리({machines.length}대) 포함
                </label>
              </div>

              <div className="border border-slate-200 rounded-md p-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    장비 인벤토리 Markdown 역내보내기
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    <span className="font-mono">docs/machine_inventory.md</span> 표 형식으로 8종
                    장비 현황을 내보냅니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadMachinesMarkdown}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Markdown 다운로드
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-4 shrink-0 bg-slate-50/50">
          <div className="text-xs text-slate-500">
            {mode === 'import' && parseResult?.ok ? (
              <span>
                감지 스키마: <span className="font-mono">{parseResult.detectedSchema}</span>
              </span>
            ) : (
              <span>로컬 파일 기반 단방향 동기화 · 제어망 격리 준수</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-white cursor-pointer"
            >
              닫기
            </button>
            {mode === 'import' && (
              <button
                type="button"
                disabled={!canCommit || committing}
                onClick={handleCommitImport}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1D4ED8] rounded-md hover:bg-[#1E40AF] disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <Check className="w-3.5 h-3.5" />
                {committing ? 'Firestore 반영 중...' : '선택 항목 Firestore 반영'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
