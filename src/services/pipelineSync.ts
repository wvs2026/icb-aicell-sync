import {
  addDaysDateStr,
  Decision,
  FindingCounts,
  Gate1CheckEntry,
  Gate1Checks,
  Gate1Status,
  Gate2Verdict,
  getTodayDateStr,
  Issue,
  IssueModule,
  IssuePriority,
  LIMITS,
  MachineCategory,
  MachineInventory,
  MachineStatus,
  Project,
  RocChange,
  TeamMember,
  TeamRole,
} from '../types';

// ---------------------------------------------------------------------------
// Pre-flight Secret Guard & Internal URL Stripping
// ---------------------------------------------------------------------------
const STRIPPED_KEYS = new Set([
  'base_url',
  'baseurl',
  'server_url',
  'serverurl',
  'vllm_url',
  'endpoint',
  'api_key',
  'apikey',
  'password',
  'passwd',
  'secret',
  'token',
  'private_key',
  'privatekey',
  'nas_password',
  'credentials',
  'auth_header',
]);

const HARD_SECRET_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'Private Key 블록', regex: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/i },
  { label: 'API Key 토큰(sk-)', regex: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { label: 'GitHub PAT 토큰(ghp_)', regex: /\bghp_[A-Za-z0-9]{20,}\b/ },
  { label: 'Google API Key(AIza)', regex: /\bAIza[0-9A-Za-z\-_]{25,}\b/ },
  { label: '자격증명 포함 SMB/NAS URI', regex: /\b(?:smb|ftp|sftp|http|https):\/\/[^/\s:@]+:[^/\s@]+@/i },
];

const INTERNAL_URL_REGEX =
  /https?:\/\/(?:localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|100\.\d{1,3}\.\d{1,3}\.\d{1,3}|[a-zA-Z0-9\-]+\.local)(?::\d+)?(?:\/[^\s"']*)?/gi;

export interface ParsedCandidateIssue {
  key: string;
  externalRef: string;
  title: string;
  description: string;
  module: IssueModule;
  priority: IssuePriority;
  assigneeRole: TeamRole;
  assigneeName: string;
  dueDate: string;
  sourceLabel: string;
  isDuplicate: boolean;
  duplicateCode: string;
  selected: boolean;
}

export interface ParsedQualityGatePayload {
  gitRef: string;
  reportedAt: string;
  gate1Status: Gate1Status;
  gate1Checks: Gate1Checks;
  gate2Verdict: Gate2Verdict;
  gate2Model: string;
  reviewedFileCount: number;
  securityLocalOnly: boolean;
  findingCounts: FindingCounts;
  summary: string;
}

export interface ParsedCandidateMachine {
  machineCode: string;
  category: MachineCategory;
  hostnameModel: string;
  osFirmware: string;
  runtimeEnv: string;
  networkLabel: string;
  nasBackupPath: string;
  lastBackupDate: string;
  gitCommitRef: string;
  recipeVersion: string;
  status: MachineStatus;
  notes: string;
  sortOrder: number;
  isUpdate: boolean;
  selected: boolean;
}

export interface ImportParseResult {
  ok: boolean;
  blockReason?: string;
  redactionNotices: string[];
  qualityGate: ParsedQualityGatePayload | null;
  candidateIssues: ParsedCandidateIssue[];
  candidateMachines: ParsedCandidateMachine[];
  skippedSecurityFindings: number;
  detectedSchema: string;
}

function sanitizeDeep(
  value: unknown,
  strippedTracker: Set<string>
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDeep(item, strippedTracker));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const lower = k.toLowerCase();
      if (STRIPPED_KEYS.has(lower)) {
        strippedTracker.add(k);
        continue;
      }
      out[k] = sanitizeDeep(v, strippedTracker);
    }
    return out;
  }
  return value;
}

function scrubInternalUrls(text: string, notices: Set<string>): string {
  if (!text) return '';
  if (INTERNAL_URL_REGEX.test(text)) {
    notices.add('텍스트 내 내부 서버/LAN URL 자동 마스킹 처리됨');
    return text.replace(INTERNAL_URL_REGEX, '[internal-endpoint-redacted]');
  }
  return text;
}

function mapModule(raw: unknown): IssueModule {
  const s = String(raw || '').toUpperCase().trim();
  if (s === 'VISION' || s.startsWith('EC1') || s.startsWith('EC2') || s.startsWith('EC3') || s.includes('비전') || s.includes('CAM')) {
    return 'VISION';
  }
  if (s === 'ROBOT' || s.includes('FANUC') || s.includes('로봇')) return 'ROBOT';
  if (s === 'PLC' || s.startsWith('PLC-') || s.includes('SAFETY') || s.includes('안전') || s.includes('HANDSHAKE')) {
    return 'PLC';
  }
  if (s === 'UI' || s.startsWith('MON-') || s.includes('모니터')) return 'UI';
  return 'SYSTEM';
}

function mapRoleForModule(mod: IssueModule): TeamRole {
  if (mod === 'VISION' || mod === 'ROBOT' || mod === 'PLC' || mod === 'UI') return mod;
  return 'PM';
}

function mapPriority(raw: unknown): IssuePriority {
  const s = String(raw || '').toUpperCase().trim();
  if (s === 'CRITICAL' || s === 'BLOCKER' || s === 'P0') return 'blocker';
  if (s === 'HIGH' || s === 'ERROR' || s === 'P1') return 'high';
  return 'medium';
}

function sanitizeExternalRef(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._:/\-]/g, '')
    .slice(0, LIMITS.EXTERNAL_REF_MAX);
}

function sanitizeGitRef(raw: unknown): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9._/@\-]/g, '')
    .slice(0, LIMITS.QG_GIT_REF_MAX);
  return cleaned || 'local-working-tree';
}

function extractDateStr(raw: unknown, fallback: string): string {
  const s = String(raw || '').trim();
  const match = s.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : fallback;
}

function makeSkippedCheck(reason = 'not reported'): Gate1CheckEntry {
  return { returncode: 0, durationS: 0, skipped: true, reason };
}

function normalizeGate1(
  rawGate1: Record<string, unknown>,
  notices: Set<string>
): { status: Gate1Status; checks: Gate1Checks; failedEntries: Array<{ key: string; name: string; reason: string; returncode: number }> } {
  const checks: Gate1Checks = {
    ruff: makeSkippedCheck(),
    ruffFormat: makeSkippedCheck(),
    mypy: makeSkippedCheck(),
    pytest: makeSkippedCheck(),
  };

  const results = Array.isArray(rawGate1.results)
    ? (rawGate1.results as Array<Record<string, unknown>>)
    : Array.isArray(rawGate1.checks)
    ? (rawGate1.checks as Array<Record<string, unknown>>)
    : [];

  const failedEntries: Array<{ key: string; name: string; reason: string; returncode: number }> = [];

  for (const r of results) {
    const rawName = String(r.name || '').toLowerCase().trim();
    const entry: Gate1CheckEntry = {
      returncode: Number.isFinite(Number(r.returncode))
        ? Math.max(-1, Math.min(999, Math.round(Number(r.returncode))))
        : 0,
      durationS: Number.isFinite(Number(r.duration_s ?? r.durationS))
        ? Math.max(0, Math.min(86400, Number(Number(r.duration_s ?? r.durationS).toFixed(2))))
        : 0,
      skipped: Boolean(r.skipped),
      reason: scrubInternalUrls(String(r.reason || ''), notices).slice(0, LIMITS.QG_REASON_MAX),
    };

    if (rawName === 'ruff-check' || rawName === 'ruff') {
      checks.ruff = entry;
      if (!entry.skipped && entry.returncode !== 0) {
        failedEntries.push({ key: 'ruff-check', name: 'ruff-check', reason: entry.reason, returncode: entry.returncode });
      }
    } else if (rawName === 'ruff-format' || rawName === 'ruff_format' || rawName === 'ruffformat') {
      checks.ruffFormat = entry;
      if (!entry.skipped && entry.returncode !== 0) {
        failedEntries.push({ key: 'ruff-format', name: 'ruff-format', reason: entry.reason, returncode: entry.returncode });
      }
    } else if (rawName === 'mypy') {
      checks.mypy = entry;
      if (!entry.skipped && entry.returncode !== 0) {
        failedEntries.push({ key: 'mypy', name: 'mypy', reason: entry.reason, returncode: entry.returncode });
      }
    } else if (rawName === 'pytest') {
      checks.pytest = entry;
      if (!entry.skipped && entry.returncode !== 0) {
        failedEntries.push({ key: 'pytest', name: 'pytest', reason: entry.reason, returncode: entry.returncode });
      }
    }
  }

  const allEntries = [checks.ruff, checks.ruffFormat, checks.mypy, checks.pytest];
  const anyExecuted = allEntries.some((e) => !e.skipped);
  const anyFailed = allEntries.some((e) => !e.skipped && e.returncode !== 0);
  const status: Gate1Status = !anyExecuted ? 'SKIPPED' : anyFailed ? 'FAIL' : 'PASS';

  return { status, checks, failedEntries };
}

function mapMachineCategory(raw: unknown, code: string): MachineCategory {
  const s = String(raw || '').toUpperCase().trim();
  if (['WORKSTATION', 'LAPTOP', 'MINI_PC', 'EDGE_VISION', 'ROBOT', 'PLC', 'MONITORING'].includes(s)) {
    return s as MachineCategory;
  }
  if (code.startsWith('WS')) return 'WORKSTATION';
  if (code.startsWith('NB')) return 'LAPTOP';
  if (code.startsWith('MINI')) return 'MINI_PC';
  if (code.startsWith('EC')) return 'EDGE_VISION';
  if (code.startsWith('PLC')) return 'PLC';
  if (code.startsWith('MON')) return 'MONITORING';
  return 'ROBOT';
}

function mapMachineStatus(raw: unknown): MachineStatus {
  const s = String(raw || '').toLowerCase().trim();
  if (['planned', 'mock', 'commissioning', 'deployed', 'maintenance'].includes(s)) {
    return s as MachineStatus;
  }
  return 'mock';
}

/**
 * Parses and sanitizes ICB-AICell JSON payloads (icb_import_v1 bundle, standalone gate1,
 * standalone gate2 ReviewReport, open issues list, or machine inventory list).
 */
export function parsePipelineImportJson(
  rawText: string,
  existingIssues: Issue[],
  existingMachines: MachineInventory[],
  members: TeamMember[]
): ImportParseResult {
  // 1. Pre-flight hard secret scan before JSON.parse
  for (const pat of HARD_SECRET_PATTERNS) {
    if (pat.regex.test(rawText)) {
      return {
        ok: false,
        blockReason: `보안 정책 위반 감지(${pat.label}): 민감한 키·비밀번호가 포함된 파일은 클라우드로 업로드할 수 없습니다. 로컬에서 제거 후 다시 시도해 주세요.`,
        redactionNotices: [],
        qualityGate: null,
        candidateIssues: [],
        candidateMachines: [],
        skippedSecurityFindings: 0,
        detectedSchema: 'blocked',
      };
    }
  }

  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      blockReason: '유효한 JSON 형식이 아닙니다. 파일 문법을 확인해 주세요.',
      redactionNotices: [],
      qualityGate: null,
      candidateIssues: [],
      candidateMachines: [],
      skippedSecurityFindings: 0,
      detectedSchema: 'invalid',
    };
  }

  // 2. Strip sensitive keys (including base_url from gate2_vllm_review.py)
  const strippedKeys = new Set<string>();
  const notices = new Set<string>();
  const sanitized = sanitizeDeep(parsedRaw, strippedKeys);

  if (strippedKeys.size > 0) {
    notices.add(
      `Pre-flight 자동 제거된 내부/민감 필드: ${Array.from(strippedKeys).join(', ')}`
    );
  }

  const getAssigneeName = (role: TeamRole): string => {
    const found = members.find((m) => m.role === role);
    return found ? found.displayName : role;
  };

  // Index existing issues for deterministic deduplication
  const existingByRef = new Map<string, Issue>();
  const existingByTitle = new Map<string, Issue>();
  for (const iss of existingIssues) {
    if (iss.externalRef && iss.externalRef.trim()) {
      existingByRef.set(iss.externalRef.trim().toLowerCase(), iss);
    }
    existingByTitle.set(iss.title.trim().toLowerCase(), iss);
  }

  const existingMachineCodes = new Set(existingMachines.map((m) => m.machineCode.toUpperCase()));

  // Detect input format
  let detectedSchema = 'icb_import_v1';
  let bundleObj: Record<string, unknown> = {};

  if (Array.isArray(sanitized)) {
    // Standalone issues array
    detectedSchema = 'standalone_issues_array';
    bundleObj = { issues: sanitized };
  } else if (sanitized && typeof sanitized === 'object') {
    const obj = sanitized as Record<string, unknown>;
    if ('results' in obj && !('gate1' in obj) && !('issues' in obj) && !('gate2' in obj)) {
      detectedSchema = 'standalone_gate1';
      bundleObj = { gate1: obj, git_ref: obj.git_ref ?? obj.gitRef };
    } else if ('verdict' in obj && !('gate2' in obj) && !('issues' in obj)) {
      detectedSchema = 'standalone_gate2';
      bundleObj = { gate2: obj, git_ref: obj.git_ref ?? obj.gitRef };
    } else {
      detectedSchema = String(obj.schema_version ?? obj.schemaVersion ?? 'icb_import_v1');
      bundleObj = obj;
    }
  } else {
    return {
      ok: false,
      blockReason: 'JSON 최상위 구조가 객체 또는 배열이어야 합니다.',
      redactionNotices: Array.from(notices),
      qualityGate: null,
      candidateIssues: [],
      candidateMachines: [],
      skippedSecurityFindings: 0,
      detectedSchema: 'invalid',
    };
  }

  const gitRef = sanitizeGitRef(bundleObj.git_ref ?? bundleObj.gitRef);
  const reportedAt = extractDateStr(
    bundleObj.reported_at ??
      bundleObj.reportedAt ??
      (bundleObj.gate2 as Record<string, unknown> | undefined)?.timestamp_utc,
    getTodayDateStr()
  );

  const candidateIssues: ParsedCandidateIssue[] = [];
  const seenCandidateRefs = new Set<string>();
  let skippedSecurityFindings = 0;

  const pushCandidateIssue = (item: Omit<ParsedCandidateIssue, 'isDuplicate' | 'duplicateCode' | 'selected'>) => {
    const refKey = item.externalRef.toLowerCase();
    if (refKey && seenCandidateRefs.has(refKey)) return;
    if (refKey) seenCandidateRefs.add(refKey);

    const dupByRef = refKey ? existingByRef.get(refKey) : undefined;
    const dupByTitle = existingByTitle.get(item.title.trim().toLowerCase());
    const dup = dupByRef || dupByTitle;

    candidateIssues.push({
      ...item,
      isDuplicate: Boolean(dup),
      duplicateCode: dup ? dup.code : '',
      selected: !dup,
    });
  };

  // 3. Parse Gate 1 + Gate 2 into unified QualityGateRun summary (Option A)
  const rawGate1 =
    bundleObj.gate1 && typeof bundleObj.gate1 === 'object'
      ? (bundleObj.gate1 as Record<string, unknown>)
      : null;
  const rawGate2 =
    bundleObj.gate2 && typeof bundleObj.gate2 === 'object'
      ? (bundleObj.gate2 as Record<string, unknown>)
      : null;

  let qualityGate: ParsedQualityGatePayload | null = null;

  if (rawGate1 || rawGate2) {
    const g1 = rawGate1
      ? normalizeGate1(rawGate1, notices)
      : {
          status: 'SKIPPED' as Gate1Status,
          checks: {
            ruff: makeSkippedCheck(),
            ruffFormat: makeSkippedCheck(),
            mypy: makeSkippedCheck(),
            pytest: makeSkippedCheck(),
          },
          failedEntries: [],
        };

    // Promote failed Gate 1 checks as optional candidate issues
    for (const fail of g1.failedEntries) {
      const extRef = sanitizeExternalRef(`gate1:${gitRef}:${fail.key}`);
      pushCandidateIssue({
        key: `g1-${fail.key}`,
        externalRef: extRef,
        title: `[Gate 1 실패] ${fail.name} 검증 오류 (exit ${fail.returncode}) — ${gitRef}`.slice(
          0,
          LIMITS.TITLE_MAX
        ),
        description: `Gate 1 자동 검증(${fail.name})이 종료 코드 ${fail.returncode}로 실패했습니다.${
          fail.reason ? `\n사유: ${fail.reason}` : ''
        }\n대상 리비전: ${gitRef}`.slice(0, LIMITS.ISSUE_DESC_MAX),
        module: 'SYSTEM',
        priority: 'high',
        assigneeRole: 'PM',
        assigneeName: getAssigneeName('PM'),
        dueDate: addDaysDateStr(3),
        sourceLabel: `Gate 1 · ${fail.name}`,
      });
    }

    let gate2Verdict: Gate2Verdict = 'SKIPPED';
    let gate2Model = '';
    let reviewedFileCount = 0;
    let securityLocalOnly = false;
    const findingCounts: FindingCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    let summary = '';

    if (rawGate2) {
      const vRaw = String(rawGate2.verdict || '').toUpperCase().trim();
      gate2Verdict = ['PASS', 'WARN', 'FAIL', 'SKIPPED'].includes(vRaw)
        ? (vRaw as Gate2Verdict)
        : 'WARN';
      gate2Model = scrubInternalUrls(String(rawGate2.model || ''), notices).slice(
        0,
        LIMITS.QG_MODEL_MAX
      );
      securityLocalOnly = Boolean(rawGate2.security_local_only ?? rawGate2.securityLocalOnly);

      if (Array.isArray(rawGate2.reviewed_files)) {
        reviewedFileCount = rawGate2.reviewed_files.length;
      } else if (Number.isFinite(Number(rawGate2.reviewed_file_count ?? rawGate2.reviewedFileCount))) {
        reviewedFileCount = Math.max(
          0,
          Math.min(5000, Math.round(Number(rawGate2.reviewed_file_count ?? rawGate2.reviewedFileCount)))
        );
      }

      const rawFindings = Array.isArray(rawGate2.findings)
        ? (rawGate2.findings as Array<Record<string, unknown>>)
        : [];

      if (rawFindings.length > 0) {
        rawFindings.forEach((f, idx) => {
          const sev = String(f.severity || 'INFO').toUpperCase().trim();
          if (sev === 'CRITICAL') findingCounts.critical += 1;
          else if (sev === 'HIGH') findingCounts.high += 1;
          else if (sev === 'MEDIUM') findingCounts.medium += 1;
          else if (sev === 'LOW') findingCounts.low += 1;
          else findingCounts.info += 1;

          const category = String(f.category || '').toLowerCase().trim();

          // Option A + Security Local Only Guard:
          // Never promote findings when security_local_only=true OR category==='security'
          if (securityLocalOnly || category === 'security') {
            if (sev === 'CRITICAL' || sev === 'HIGH') {
              skippedSecurityFindings += 1;
            }
            return;
          }

          if (sev === 'CRITICAL' || sev === 'HIGH') {
            const fFile = String(f.file || '').trim();
            const fLine = f.line !== undefined && f.line !== null ? String(f.line) : '';
            const fTitle = scrubInternalUrls(String(f.title || `Gate 2 ${sev} 지적`), notices);
            const fDetail = scrubInternalUrls(String(f.detail || ''), notices);
            const fSuggestion = scrubInternalUrls(String(f.suggestion || ''), notices);
            const rawRef = f.external_ref
              ? String(f.external_ref)
              : `gate2:${gitRef}:${category || 'qa'}:${fFile ? fFile.split('/').pop() : idx}:${fLine || idx}`;
            const extRef = sanitizeExternalRef(rawRef);

            const mod = mapModule(category === 'handshake_spec' ? 'PLC' : fFile);
            const role = mapRoleForModule(mod);
            const descParts = [
              fFile ? `대상: ${fFile}${fLine ? `:${fLine}` : ''} (${category || 'review'})` : '',
              fDetail ? `내용: ${fDetail}` : '',
              fSuggestion ? `개선 제안: ${fSuggestion}` : '',
            ].filter(Boolean);

            pushCandidateIssue({
              key: `g2-${idx}-${extRef}`,
              externalRef: extRef,
              title: `[Gate 2 ${sev}] ${fTitle}`.slice(0, LIMITS.TITLE_MAX),
              description: (descParts.join('\n') || fTitle).slice(0, LIMITS.ISSUE_DESC_MAX),
              module: mod,
              priority: mapPriority(sev),
              assigneeRole: role,
              assigneeName: getAssigneeName(role),
              dueDate: addDaysDateStr(sev === 'CRITICAL' ? 2 : 5),
              sourceLabel: `Gate 2 · ${sev}`,
            });
          }
        });
      } else if (rawGate2.finding_counts && typeof rawGate2.finding_counts === 'object') {
        const fc = rawGate2.finding_counts as Record<string, unknown>;
        findingCounts.critical = Math.max(0, Math.min(10000, Math.round(Number(fc.critical || 0))));
        findingCounts.high = Math.max(0, Math.min(10000, Math.round(Number(fc.high || 0))));
        findingCounts.medium = Math.max(0, Math.min(10000, Math.round(Number(fc.medium || 0))));
        findingCounts.low = Math.max(0, Math.min(10000, Math.round(Number(fc.low || 0))));
        findingCounts.info = Math.max(0, Math.min(10000, Math.round(Number(fc.info || 0))));
      }

      if (securityLocalOnly) {
        notices.add(
          'security_local_only=true 감지: 상세 코드/Finding 원문은 폐기하고 익명 요약 메타데이터(≤200자) 및 건수만 반영합니다.'
        );
        summary = `로컬 보안 전용 리뷰(${gate2Verdict}) · 대상 ${reviewedFileCount}파일 · C:${findingCounts.critical} H:${findingCounts.high} M:${findingCounts.medium} (상세 원문 비반출)`.slice(
          0,
          LIMITS.QG_SECURITY_LOCAL_SUMMARY_MAX
        );
      } else {
        if (skippedSecurityFindings > 0) {
          notices.add(
            `category='security' Finding ${skippedSecurityFindings}건은 클라우드 보안 원칙에 따라 이슈 자동 승격에서 제외되었습니다.`
          );
        }
        summary = scrubInternalUrls(String(rawGate2.summary || ''), notices).slice(
          0,
          LIMITS.QG_SUMMARY_MAX
        );
      }
    } else {
      summary = `Gate 1 단독 검증(${g1.status}) · ruff:${g1.checks.ruff.skipped ? 'SKIP' : g1.checks.ruff.returncode === 0 ? 'PASS' : 'FAIL'}, mypy:${g1.checks.mypy.skipped ? 'SKIP' : g1.checks.mypy.returncode === 0 ? 'PASS' : 'FAIL'}, pytest:${g1.checks.pytest.skipped ? 'SKIP' : g1.checks.pytest.returncode === 0 ? 'PASS' : 'FAIL'}`.slice(
        0,
        LIMITS.QG_SUMMARY_MAX
      );
    }

    qualityGate = {
      gitRef,
      reportedAt,
      gate1Status: g1.status,
      gate1Checks: g1.checks,
      gate2Verdict,
      gate2Model,
      reviewedFileCount,
      securityLocalOnly,
      findingCounts,
      summary,
    };
  }

  // 4. Parse Open Issues array (handoff_robot_cell.md / handshake_signals.md)
  const rawIssues = Array.isArray(bundleObj.issues)
    ? (bundleObj.issues as Array<Record<string, unknown>>)
    : Array.isArray(bundleObj.open_issues)
    ? (bundleObj.open_issues as Array<Record<string, unknown>>)
    : [];

  rawIssues.forEach((raw, idx) => {
    const title = scrubInternalUrls(String(raw.title || '').trim(), notices).slice(
      0,
      LIMITS.TITLE_MAX
    );
    if (!title) return;
    const desc = scrubInternalUrls(
      String(raw.description ?? raw.detail ?? title).trim(),
      notices
    ).slice(0, LIMITS.ISSUE_DESC_MAX);
    const mod = mapModule(raw.module ?? raw.component);
    const role = raw.assignee_role || raw.assigneeRole
      ? (['PM', 'VISION', 'ROBOT', 'PLC', 'UI'].includes(
          String(raw.assignee_role ?? raw.assigneeRole).toUpperCase()
        )
          ? (String(raw.assignee_role ?? raw.assigneeRole).toUpperCase() as TeamRole)
          : mapRoleForModule(mod))
      : mapRoleForModule(mod);

    const extRef = sanitizeExternalRef(
      String(raw.external_ref ?? raw.externalRef ?? raw.id ?? `import-${idx + 1}`)
    );

    pushCandidateIssue({
      key: `iss-${idx}-${extRef}`,
      externalRef: extRef,
      title,
      description: desc || title,
      module: mod,
      priority: mapPriority(raw.priority ?? raw.severity),
      assigneeRole: role,
      assigneeName: String(raw.assignee_name ?? raw.assigneeName ?? getAssigneeName(role)).slice(
        0,
        LIMITS.DISPLAY_NAME_MAX
      ),
      dueDate: extractDateStr(raw.due_date ?? raw.dueDate, addDaysDateStr(7)),
      sourceLabel: String(raw.source || 'Open Issues JSON'),
    });
  });

  // 5. Parse Machines inventory array (machine_inventory.md sync)
  const rawMachines = Array.isArray(bundleObj.machines)
    ? (bundleObj.machines as Array<Record<string, unknown>>)
    : [];
  const candidateMachines: ParsedCandidateMachine[] = [];

  rawMachines.forEach((raw, idx) => {
    const code = String(raw.machine_code ?? raw.machineCode ?? raw.id ?? '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9\-]/g, '')
      .slice(0, LIMITS.MACHINE_CODE_MAX);
    if (!LIMITS.MACHINE_CODE_PATTERN.test(code)) return;

    const lastBackupRaw = String(raw.last_backup_date ?? raw.lastBackupDate ?? '').trim();
    const lastBackupDate = LIMITS.DATE_PATTERN.test(lastBackupRaw) ? lastBackupRaw : '';

    candidateMachines.push({
      machineCode: code,
      category: mapMachineCategory(raw.category, code),
      hostnameModel: scrubInternalUrls(
        String(raw.hostname_model ?? raw.hostnameModel ?? code),
        notices
      ).slice(0, LIMITS.MACHINE_HOST_MAX) || code,
      osFirmware: scrubInternalUrls(
        String(raw.os_firmware ?? raw.osFirmware ?? 'TBD'),
        notices
      ).slice(0, LIMITS.MACHINE_OS_MAX) || 'TBD',
      runtimeEnv: scrubInternalUrls(
        String(raw.runtime_env ?? raw.runtimeEnv ?? ''),
        notices
      ).slice(0, LIMITS.MACHINE_ENV_MAX),
      networkLabel: scrubInternalUrls(
        String(raw.network_label ?? raw.networkLabel ?? ''),
        notices
      ).slice(0, LIMITS.MACHINE_NET_MAX),
      nasBackupPath: scrubInternalUrls(
        String(raw.nas_backup_path ?? raw.nasBackupPath ?? ''),
        notices
      ).slice(0, LIMITS.MACHINE_NAS_MAX),
      lastBackupDate,
      gitCommitRef: String(raw.git_commit_ref ?? raw.gitCommitRef ?? '')
        .trim()
        .replace(/[^a-zA-Z0-9._/@\-]/g, '')
        .slice(0, LIMITS.MACHINE_GIT_MAX),
      recipeVersion: scrubInternalUrls(
        String(raw.recipe_version ?? raw.recipeVersion ?? ''),
        notices
      ).slice(0, LIMITS.MACHINE_RECIPE_MAX),
      status: mapMachineStatus(raw.status),
      notes: scrubInternalUrls(String(raw.notes ?? ''), notices).slice(0, LIMITS.MACHINE_NOTES_MAX),
      sortOrder: Number.isFinite(Number(raw.sort_order ?? raw.sortOrder))
        ? Math.max(0, Math.min(1000, Math.round(Number(raw.sort_order ?? raw.sortOrder))))
        : (idx + 1) * 10,
      isUpdate: existingMachineCodes.has(code),
      selected: true,
    });
  });

  if (!qualityGate && candidateIssues.length === 0 && candidateMachines.length === 0) {
    return {
      ok: false,
      blockReason:
        'Import할 수 있는 유효 데이터(issues, gate1, gate2, machines)를 찾지 못했습니다. 스키마를 확인해 주세요.',
      redactionNotices: Array.from(notices),
      qualityGate: null,
      candidateIssues: [],
      candidateMachines: [],
      skippedSecurityFindings,
      detectedSchema,
    };
  }

  return {
    ok: true,
    redactionNotices: Array.from(notices),
    qualityGate,
    candidateIssues,
    candidateMachines,
    skippedSecurityFindings,
    detectedSchema,
  };
}

// ---------------------------------------------------------------------------
// Export Helpers (Strips internal UIDs, memberUids, inviteCode, projectId)
// ---------------------------------------------------------------------------
export function buildCellSyncExportPayload(params: {
  project: Project;
  rocChanges: RocChange[];
  decisions: Decision[];
  issues: Issue[];
  machines: MachineInventory[];
  includeMachines: boolean;
}) {
  const approvedRocs = [...params.rocChanges]
    .filter((r) => r.status === 'approved')
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((r) => ({
      code: r.code,
      title: r.title,
      as_is: r.asIs,
      to_be: r.toBe,
      reason: r.reason,
      impact_modules: r.impactModules,
      requester_name: r.requesterName,
      requester_role: r.requesterRole,
      reviewer_name: r.reviewerName,
      review_comment: r.reviewComment,
      target_apply_date: r.targetApplyDate,
    }));

  const decisions = [...params.decisions]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((d) => ({
      code: d.code,
      title: d.title,
      decision_summary: d.decisionSummary,
      rationale: d.rationale,
      impact_modules: d.impactModules,
      decided_by: d.decidedByName,
      decided_date: d.decidedDate,
      source_issue_code: d.sourceIssueCode || null,
    }));

  const openIssuesSummary = {
    open_count: params.issues.filter((i) => i.status !== 'resolved').length,
    blocker_count: params.issues.filter((i) => i.status !== 'resolved' && i.priority === 'blocker')
      .length,
    resolved_count: params.issues.filter((i) => i.status === 'resolved').length,
  };

  const payload: Record<string, unknown> = {
    schema_version: 'cell-sync.export.v1',
    exported_at_utc: new Date().toISOString(),
    project_name: params.project.name,
    target_date: params.project.targetDate,
    summary: {
      approved_roc_count: approvedRocs.length,
      decision_count: decisions.length,
      ...openIssuesSummary,
    },
    approved_rocs: approvedRocs,
    decisions,
  };

  if (params.includeMachines) {
    payload.machines = [...params.machines]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((m) => ({
        machine_code: m.machineCode,
        category: m.category,
        hostname_model: m.hostnameModel,
        os_firmware: m.osFirmware,
        runtime_env: m.runtimeEnv,
        network_label: m.networkLabel,
        nas_backup_path: m.nasBackupPath,
        last_backup_date: m.lastBackupDate,
        git_commit_ref: m.gitCommitRef,
        recipe_version: m.recipeVersion,
        status: m.status,
        notes: m.notes,
      }));
  }

  return payload;
}

export function buildMachineInventoryMarkdown(projectName: string, machines: MachineInventory[]): string {
  const sorted = [...machines].sort((a, b) => a.sortOrder - b.sortOrder);
  const lines = [
    `# Machine Inventory (${projectName})`,
    '',
    `> Exported from CELL-SYNC on ${getTodayDateStr()} (내부 자격증명 제외)`,
    '',
    '| 장비 코드 | 호스트명 / 모델 | OS / 펌웨어 | 런타임 환경 | 네트워크 라벨 | NAS 백업 경로 | 최근 백업일 | Git 커밋/태그 | 레시피 버전 | 상태 |',
    '|---|---|---|---|---|---|---|---|---|---|',
  ];

  const esc = (s: string) => (s || '-').replace(/\|/g, '\\|').replace(/\n/g, ' ');

  for (const m of sorted) {
    lines.push(
      `| ${esc(m.machineCode)} | ${esc(m.hostnameModel)} | ${esc(m.osFirmware)} | ${esc(m.runtimeEnv)} | ${esc(m.networkLabel)} | ${esc(m.nasBackupPath)} | ${esc(m.lastBackupDate || '-')} | ${esc(m.gitCommitRef || '-')} | ${esc(m.recipeVersion || '-')} | ${esc(m.status)} |`
    );
  }
  lines.push('');
  return lines.join('\n');
}

export function triggerFileDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
