import {
  addDaysDateStr,
  ChecklistModule,
  ChecklistStatus,
  FindingCounts,
  Gate1Checks,
  Gate1Status,
  Gate2Verdict,
  ImpactModule,
  IssueModule,
  IssuePriority,
  MachineCategory,
  MachineStatus,
  RocStatus,
  TeamRole,
} from '../types';

export interface SeedMember {
  id: string;
  role: TeamRole;
  displayName: string;
  specialty: string;
}

export interface SeedChecklist {
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

export interface SeedRoc {
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
}

export interface SeedIssue {
  code: string;
  title: string;
  description: string;
  module: IssueModule;
  priority: IssuePriority;
  status: 'open' | 'in_review';
  assigneeName: string;
  assigneeRole: TeamRole;
  dueDate: string;
  externalRef?: string;
}

export interface SeedDecision {
  code: string;
  title: string;
  decisionSummary: string;
  rationale: string;
  impactModules: ImpactModule[];
  decidedByName: string;
  decidedDate: string;
}

export interface SeedMachine {
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
}

export interface SeedQualityGate {
  runCode: string;
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

export const PRESET_MEMBERS: SeedMember[] = [
  {
    id: 'slot-pm',
    role: 'PM',
    displayName: '김도현 (PM)',
    specialty: '전체 공정·FAT·고객 사양 변경 총괄',
  },
  {
    id: 'slot-vision',
    role: 'VISION',
    displayName: '이서연 (비전)',
    specialty: 'EC1~3 비전 광학·캘리브레이션·결함 검사',
  },
  {
    id: 'slot-robot',
    role: 'ROBOT',
    displayName: '박준혁 (로봇)',
    specialty: 'Fanuc 다관절 로봇 TCP·Hand-Eye·경로 티칭',
  },
  {
    id: 'slot-plc',
    role: 'PLC',
    displayName: '정민수 (PLC)',
    specialty: 'PLC-01 10단계 FSM·핸드셰이크·안전 인터록',
  },
  {
    id: 'slot-ui',
    role: 'UI',
    displayName: '최유진 (UI)',
    specialty: 'MON-01 모니터링 PC 뷰어·레시피·알람 로그',
  },
];

export function buildSeedMachines(): SeedMachine[] {
  return [
    {
      machineCode: 'WS-01',
      category: 'WORKSTATION',
      hostnameModel: 'Lab Workstation (RTX 3090 x4)',
      osFirmware: 'Ubuntu 22.04 LTS',
      runtimeEnv: 'Python 3.11 / Conda / vLLM Dual',
      networkLabel: 'Lab-LAN · Tailscale',
      nasBackupPath: '03_machines/WS-01/',
      lastBackupDate: addDaysDateStr(-2),
      gitCommitRef: 'main@a4f9c21',
      recipeVersion: 'default_recipe v1.0',
      status: 'deployed',
      notes: '로컬 vLLM 2+2 듀얼 서버(Gate 2 리뷰) 및 학습·자동 검증 호스트.',
      sortOrder: 10,
    },
    {
      machineCode: 'NB-01',
      category: 'LAPTOP',
      hostnameModel: 'Dev Field Laptop',
      osFirmware: 'Windows 11 Pro',
      runtimeEnv: 'Python 3.11 / uv / Git',
      networkLabel: 'Field-Relay · Tailscale',
      nasBackupPath: '03_machines/NB-01/',
      lastBackupDate: addDaysDateStr(-1),
      gitCommitRef: 'main@a4f9c21',
      recipeVersion: 'default_recipe v1.0',
      status: 'deployed',
      notes: '메인 개발 및 현장 장비 시운전·파일 번들 중계용 노트북.',
      sortOrder: 20,
    },
    {
      machineCode: 'MINI-01',
      category: 'MINI_PC',
      hostnameModel: 'Edge Utility Mini PC',
      osFirmware: 'Ubuntu 22.04 LTS',
      runtimeEnv: 'Python 3.11 / Docker',
      networkLabel: 'Lab-LAN · Tailscale',
      nasBackupPath: '03_machines/MINI-01/',
      lastBackupDate: addDaysDateStr(-5),
      gitCommitRef: 'main@91c2b08',
      recipeVersion: '-',
      status: 'mock',
      notes: '보조 테스트 및 시뮬레이터 연동 검증용 미니 PC.',
      sortOrder: 30,
    },
    {
      machineCode: 'EC1',
      category: 'EDGE_VISION',
      hostnameModel: 'Jetson Orin Nano (예정) · 부품 피킹 비전',
      osFirmware: 'JetPack 6.x (예정)',
      runtimeEnv: 'Python 3.10 / TensorRT (Mock 검증중)',
      networkLabel: 'Cell-LAN · Robot Direct',
      nasBackupPath: '03_machines/EC1/',
      lastBackupDate: '',
      gitCommitRef: 'main@a4f9c21',
      recipeVersion: 'default_recipe v1.0',
      status: 'mock',
      notes: '15슬롯 부품 상자 PCB 인식 및 Fanuc 로봇 직접 파지 좌표 전송(2D/3D 사양 확정 대기).',
      sortOrder: 40,
    },
    {
      machineCode: 'EC2',
      category: 'EDGE_VISION',
      hostnameModel: '전면 검사 비전 노드 (리니어카메라 검토)',
      osFirmware: 'Ubuntu 22.04 (예정)',
      runtimeEnv: 'Python 3.11 / OpenCV (Mock)',
      networkLabel: 'Cell-LAN · Vision Net',
      nasBackupPath: '03_machines/EC2/',
      lastBackupDate: '',
      gitCommitRef: 'main@a4f9c21',
      recipeVersion: 'default_recipe v1.0',
      status: 'planned',
      notes: '조립 완료품 전면 검사. EC3와 동시 촬상 및 양/불 판정.',
      sortOrder: 50,
    },
    {
      machineCode: 'EC3',
      category: 'EDGE_VISION',
      hostnameModel: '상면 틈새 측정 비전 노드',
      osFirmware: 'Ubuntu 22.04 (예정)',
      runtimeEnv: 'Python 3.11 / OpenCV (Mock)',
      networkLabel: 'Cell-LAN · Vision Net',
      nasBackupPath: '03_machines/EC3/',
      lastBackupDate: '',
      gitCommitRef: 'main@a4f9c21',
      recipeVersion: 'default_recipe v1.0',
      status: 'planned',
      notes: '조립 완료품 상면 틈새(max_gap_mm) 계측 및 양/불 판정.',
      sortOrder: 60,
    },
    {
      machineCode: 'MON-01',
      category: 'MONITORING',
      hostnameModel: '셀 모니터링 PC (제어 미관여)',
      osFirmware: 'Windows 11 / Linux (예정)',
      runtimeEnv: 'Python 3.11 / PySide6 또는 Web UI',
      networkLabel: 'Cell-LAN · Read-Only Tap',
      nasBackupPath: '03_machines/MON-01/',
      lastBackupDate: '',
      gitCommitRef: 'main@a4f9c21',
      recipeVersion: 'default_recipe v1.0',
      status: 'mock',
      notes: 'PLC-01 판정 결과 및 EC1~3 촬영 이미지 수집·표시 전용(설비 제어 미관여).',
      sortOrder: 70,
    },
    {
      machineCode: 'PLC-01',
      category: 'PLC',
      hostnameModel: '공정 시퀀스 마스터 PLC (기종 확정 대기)',
      osFirmware: 'PLC Firmware TBD',
      runtimeEnv: '10-Step FSM / Heartbeat / Interlock',
      networkLabel: 'Cell-Control-LAN',
      nasBackupPath: '03_machines/PLC-01/',
      lastBackupDate: '',
      gitCommitRef: 'main@a4f9c21',
      recipeVersion: 'cell_config v1.0',
      status: 'mock',
      notes: '10단계 상태 머신, 9개 구간 타임아웃/하트비트 감시 및 안전 인터록 마스터.',
      sortOrder: 80,
    },
  ];
}

export function buildSeedQualityGates(): SeedQualityGate[] {
  return [
    {
      runCode: 'QG-001',
      gitRef: 'main@91c2b08',
      reportedAt: addDaysDateStr(-3),
      gate1Status: 'PASS',
      gate1Checks: {
        ruff: { returncode: 0, durationS: 0.42, skipped: false, reason: '' },
        ruffFormat: { returncode: 0, durationS: 0.19, skipped: false, reason: '' },
        mypy: { returncode: 0, durationS: 2.85, skipped: false, reason: '' },
        pytest: { returncode: 0, durationS: 4.12, skipped: false, reason: '' },
      },
      gate2Verdict: 'WARN',
      gate2Model: 'vllm-local-qwen2.5-coder-32b',
      reviewedFileCount: 14,
      securityLocalOnly: false,
      findingCounts: { critical: 0, high: 1, medium: 3, low: 2, info: 4 },
      summary:
        'PLC controller 10-step FSM 및 Mock 시뮬레이터 통과. 단, EC1 좌표 수신 타임아웃 재시도 경계값 1건(HIGH) 보완 권장.',
    },
    {
      runCode: 'QG-002',
      gitRef: 'main@a4f9c21',
      reportedAt: addDaysDateStr(-1),
      gate1Status: 'PASS',
      gate1Checks: {
        ruff: { returncode: 0, durationS: 0.38, skipped: false, reason: '' },
        ruffFormat: { returncode: 0, durationS: 0.17, skipped: false, reason: '' },
        mypy: { returncode: 0, durationS: 2.61, skipped: false, reason: '' },
        pytest: { returncode: 0, durationS: 4.35, skipped: false, reason: '' },
      },
      gate2Verdict: 'PASS',
      gate2Model: 'vllm-local-qwen2.5-coder-32b',
      reviewedFileCount: 16,
      securityLocalOnly: false,
      findingCounts: { critical: 0, high: 0, medium: 1, low: 2, info: 3 },
      summary:
        'docs/handshake_signals.md 규격 대조 및 예외 처리·추상화 체크리스트 전원 통과. CycleRecord 알람 코드 100~500 매핑 일관성 확인.',
    },
  ];
}

export function buildSeedChecklists(): SeedChecklist[] {
  return [
    // VISION (6 items)
    {
      module: 'VISION',
      stage: '1. 카메라 3대 광학 및 조명',
      isInterface: false,
      interfacePair: '',
      title: 'EC1(15슬롯 피킹)·EC2(전면 검사)·EC3(상면 틈새) 렌즈 WD 및 DOF 확정',
      status: 'done',
      assigneeRole: 'VISION',
      assigneeName: '이서연 (비전)',
      dueDate: addDaysDateStr(-4),
      notes: 'EC1 부품 상자 시야 확보, EC2 리니어/에어리어 비교, EC3 틈새 분해능 검토 완료.',
      sortOrder: 10,
    },
    {
      module: 'VISION',
      stage: '1. 카메라 3대 광학 및 조명',
      isInterface: false,
      interfacePair: '',
      title: '3-Cam 동시 촬상용 LED 스트로브 컨트롤러 트리거 지연 측정',
      status: 'done',
      assigneeRole: 'VISION',
      assigneeName: '이서연 (비전)',
      dueDate: addDaysDateStr(-2),
      notes: '노출 1.2ms 기준 지터 40us 이내 확인.',
      sortOrder: 20,
    },
    {
      module: 'VISION',
      stage: '2. 캘리브레이션 및 알고리즘',
      isInterface: true,
      interfacePair: '비전 ↔ 로봇',
      title: 'EC1 ↔ Fanuc 6축 로봇 베이스 좌표계 9-Point Hand-Eye 캘리브레이션 검증',
      status: 'in_progress',
      assigneeRole: 'VISION',
      assigneeName: '이서연 (비전)',
      dueDate: addDaysDateStr(3),
      notes: '현재 RMS 오차 0.14mm → 목표 0.08mm 이하로 체커보드 재측정 예정.',
      sortOrder: 30,
    },
    {
      module: 'VISION',
      stage: '2. 캘리브레이션 및 알고리즘',
      isInterface: false,
      interfacePair: '',
      title: 'EC3 상면 틈새 측정(max_gap_mm) 편광 조명 및 반복 정밀도 테스트',
      status: 'in_progress',
      assigneeRole: 'VISION',
      assigneeName: '이서연 (비전)',
      dueDate: addDaysDateStr(5),
      notes: '원형 편광판 적용 시 과검률 6.2% → 1.1% 개선, 추가 시료 50개 검증 필요.',
      sortOrder: 40,
    },
    {
      module: 'VISION',
      stage: '3. 외부 트리거 및 통신 연동',
      isInterface: true,
      interfacePair: '비전 ↔ PC',
      title: 'EC1~3 비전 노드 ↔ MON-01 검사 결과(OK/NG) 및 오버레이 이미지 전송',
      status: 'done',
      assigneeRole: 'VISION',
      assigneeName: '이서연 (비전)',
      dueDate: addDaysDateStr(-1),
      notes: 'JPEG 85% 압축 3장 합산 평균 전송 68ms 달성.',
      sortOrder: 50,
    },
    {
      module: 'VISION',
      stage: '3. 외부 트리거 및 통신 연동',
      isInterface: true,
      interfacePair: '비전 ↔ 로봇',
      title: 'EC1 → Fanuc 파지 좌표(dX, dY, dTheta) 패킷 체크섬 및 타임아웃 예외 처리',
      status: 'todo',
      assigneeRole: 'VISION',
      assigneeName: '이서연 (비전)',
      dueDate: addDaysDateStr(7),
      notes: 'ROC-002 승인 결과에 따라 회전각 소수점 3자리 포맷 반영 예정.',
      sortOrder: 60,
    },

    // ROBOT (5 items)
    {
      module: 'ROBOT',
      stage: '1. 기구 세팅 및 TCP 정의',
      isInterface: false,
      interfacePair: '',
      title: '진공 그리퍼 2-Zone Tool Center Point(TCP) 4점 교시 및 페이로드 입력',
      status: 'done',
      assigneeRole: 'ROBOT',
      assigneeName: '박준혁 (로봇)',
      dueDate: addDaysDateStr(-5),
      notes: '총 페이로드 4.35kg, 무게중심 오프셋 컨트롤러 입력 완료.',
      sortOrder: 110,
    },
    {
      module: 'ROBOT',
      stage: '2. 경로 티칭 및 사이클 최적화',
      isInterface: false,
      interfacePair: '',
      title: '15슬롯 피킹 → 조립대 이송 → EC2/EC3 시야 밖 퇴피 안전 경로 티칭',
      status: 'in_progress',
      assigneeRole: 'ROBOT',
      assigneeName: '박준혁 (로봇)',
      dueDate: addDaysDateStr(4),
      notes: 'Z축 상단 지그 여유 공간 18mm 확보 여부 재확인 중(ISS-002 연관).',
      sortOrder: 120,
    },
    {
      module: 'ROBOT',
      stage: '2. 경로 티칭 및 사이클 최적화',
      isInterface: true,
      interfacePair: '비전 ↔ 로봇',
      title: 'EC1 보정 좌표 수신 후 로봇 Offset Pick 반복 정밀도 ±0.1mm 테스트',
      status: 'todo',
      assigneeRole: 'ROBOT',
      assigneeName: '박준혁 (로봇)',
      dueDate: addDaysDateStr(8),
      notes: 'Hand-Eye RMS 0.08mm 달성 직후 100회 연속 픽업 검증 예정.',
      sortOrder: 130,
    },
    {
      module: 'ROBOT',
      stage: '3. PLC 인터페이스 및 안전',
      isInterface: true,
      interfacePair: 'PLC ↔ 로봇',
      title: 'PLC-01 ↔ Fanuc 로봇 핸드셰이크(Ready/Start/Busy/Done) 검증',
      status: 'done',
      assigneeRole: 'ROBOT',
      assigneeName: '박준혁 (로봇)',
      dueDate: addDaysDateStr(-1),
      notes: 'DEC-002 확정 맵 기준 시그널 32비트 매핑 및 에코 테스트 완료.',
      sortOrder: 140,
    },
    {
      module: 'ROBOT',
      stage: '3. PLC 인터페이스 및 안전',
      isInterface: true,
      interfacePair: 'PLC ↔ 로봇',
      title: '안전 영역(Safe Zone) 이탈 및 라이트 커튼 감지 시 즉시 정지(STO) 연동',
      status: 'done',
      assigneeRole: 'ROBOT',
      assigneeName: '박준혁 (로봇)',
      dueDate: addDaysDateStr(0),
      notes: 'Category 3 안전 릴레이 이중화 배선 및 정지 시간 180ms 확인.',
      sortOrder: 150,
    },

    // PLC (5 items)
    {
      module: 'PLC',
      stage: '1. 전장 및 I/O 맵',
      isInterface: false,
      interfacePair: '',
      title: '공압 솔레노이드 밸브·진공 센서·컨베이어 인버터 I/O 전수 체크',
      status: 'done',
      assigneeRole: 'PLC',
      assigneeName: '정민수 (PLC)',
      dueDate: addDaysDateStr(-6),
      notes: 'DI 48점 / DO 32점 단자대 결선 및 강제 출력 점검 완료.',
      sortOrder: 210,
    },
    {
      module: 'PLC',
      stage: '1. 전장 및 I/O 맵',
      isInterface: false,
      interfacePair: '',
      title: '도어 인터록·비상정지(E-Stop) 4개소·안전 릴레이 하드와이어드 시퀀스 검증',
      status: 'done',
      assigneeRole: 'PLC',
      assigneeName: '정민수 (PLC)',
      dueDate: addDaysDateStr(-3),
      notes: '도어 개방 시 로봇 서보 OFF 및 공압 잔압 배기 확인.',
      sortOrder: 220,
    },
    {
      module: 'PLC',
      stage: '2. 자동 시퀀스 및 핸드셰이크',
      isInterface: true,
      interfacePair: 'PLC ↔ 로봇',
      title: 'PLC-01 10단계 상태 머신(Step 0~10) 및 9개 구간 타임아웃 감시 구현',
      status: 'in_progress',
      assigneeRole: 'PLC',
      assigneeName: '정민수 (PLC)',
      dueDate: addDaysDateStr(4),
      notes: 'Mock 시뮬레이터 통과 완료. 실 PLC 기종 확정 후 레더 이식 예정.',
      sortOrder: 230,
    },
    {
      module: 'PLC',
      stage: '2. 자동 시퀀스 및 핸드셰이크',
      isInterface: true,
      interfacePair: 'PLC ↔ PC',
      title: 'PLC-01 ↔ MON-01 알람 코드(100~500번대) 및 레시피 번호 동기화',
      status: 'done',
      assigneeRole: 'PLC',
      assigneeName: '정민수 (PLC)',
      dueDate: addDaysDateStr(-1),
      notes: '하트비트 1Hz 감시 및 CycleRecord 전송 규격 확인.',
      sortOrder: 240,
    },
    {
      module: 'PLC',
      stage: '3. 신뢰성 및 원점 복귀',
      isInterface: true,
      interfacePair: 'PLC ↔ PC',
      title: '이상 정지 후 자동 원점 복귀(Auto Home) 및 PC 복구 가이드 신호 연동',
      status: 'todo',
      assigneeRole: 'PLC',
      assigneeName: '정민수 (PLC)',
      dueDate: addDaysDateStr(9),
      notes: '로봇 간섭 해제 순서 확정 후 시퀀스 스텝 반영.',
      sortOrder: 250,
    },

    // UI (4 items)
    {
      module: 'UI',
      stage: '1. 실시간 검사 뷰어',
      isInterface: true,
      interfacePair: '비전 ↔ PC',
      title: 'MON-01 EC1~3 동시 라이브/결과 오버레이 화면(Tact Time·NG ROI 표시)',
      status: 'done',
      assigneeRole: 'UI',
      assigneeName: '최유진 (UI)',
      dueDate: addDaysDateStr(-2),
      notes: '1920x1080 메인 모니터 3분할 레이아웃 및 NG 확대 뷰 구현 완료.',
      sortOrder: 310,
    },
    {
      module: 'UI',
      stage: '2. 레시피 및 이력 관리',
      isInterface: true,
      interfacePair: 'PLC ↔ PC',
      title: '품종별 default_recipe 전환 시 PLC·비전·로봇 Job 번호 표시 동기화',
      status: 'in_progress',
      assigneeRole: 'UI',
      assigneeName: '최유진 (UI)',
      dueDate: addDaysDateStr(5),
      notes: '제어 미관여 원칙 준수(읽기 전용 모니터링 및 레시피 파라미터 조회).',
      sortOrder: 320,
    },
    {
      module: 'UI',
      stage: '2. 레시피 및 이력 관리',
      isInterface: false,
      interfacePair: '',
      title: 'CycleRecord 양품/불량 집계 및 NG 원본 이미지 NAS/로컬 보관',
      status: 'done',
      assigneeRole: 'UI',
      assigneeName: '최유진 (UI)',
      dueDate: addDaysDateStr(0),
      notes: '디스크 80% 도달 시 자동 경고 및 순환 정리 스케줄러 검증.',
      sortOrder: 330,
    },
    {
      module: 'UI',
      stage: '3. 알람 및 작업자 권한',
      isInterface: true,
      interfacePair: 'PLC ↔ PC',
      title: 'PLC/로봇/EC1~3 통합 알람 이력(AlarmCode 100~500) 조회 화면',
      status: 'todo',
      assigneeRole: 'UI',
      assigneeName: '최유진 (UI)',
      dueDate: addDaysDateStr(10),
      notes: '엔지니어 모드 진입 시 변경 이력 감사 로그 포함.',
      sortOrder: 340,
    },
  ];
}

export function buildSeedRocs(): SeedRoc[] {
  return [
    {
      code: 'ROC-001',
      title: 'EC3 상면 틈새 조명 링타입 → 동축+저각도 2채널 복합 조명으로 변경',
      asIs: 'EC3 단일 백색 링조명(1채널, 24V 상시 점등)',
      toBe: '동축 조명 + 15도 저각도 적색 바조명 2채널 스트로브 제어',
      reason: '알루미늄 가공면 미세 틈새 대비(Contrast) 확보 및 발열 저감',
      impactModules: ['VISION', 'PLC', 'MECH'],
      status: 'approved',
      requesterName: '이서연 (비전)',
      requesterRole: 'VISION',
      reviewerName: '김도현 (PM)',
      reviewComment: '광학 테스트 결과 과검률 대폭 개선 확인. 브라켓 수정 도면 배포 완료.',
      targetApplyDate: addDaysDateStr(-1),
    },
    {
      code: 'ROC-002',
      title: 'EC1 → Fanuc 좌표 보정 패킷 회전각(dTheta) 정밀도 소수점 3자리 확장',
      asIs: 'ASCII CSV 포맷, dTheta 소수점 1자리(0.1 deg 단위)',
      toBe: '고정폭 프레임 + CRC16 체크섬, dTheta 소수점 3자리(0.001 deg 단위)',
      reason: 'ICB PCB 부품 파지 시 0.1 deg 오차로 끝단 위치 편차 발생',
      impactModules: ['VISION', 'ROBOT', 'UI'],
      status: 'pending',
      requesterName: '박준혁 (로봇)',
      requesterRole: 'ROBOT',
      reviewerName: '',
      reviewComment: '',
      targetApplyDate: addDaysDateStr(4),
    },
    {
      code: 'ROC-003',
      title: 'NG 배출 슈트 2-Lane 분리(치수 불량 / 외관 불량) 요구사항 추가',
      asIs: '단일 NG 배출 컨베이어 1개소(불량 유형 미구분)',
      toBe: '로봇 배출 포인트 2개소 분기 + PLC 만재 감지 센서 2개소 증설',
      reason: '고객사 품질팀의 외관 불량 재검사 공정 분리를 위한 사양 추가 요청',
      impactModules: ['ROBOT', 'PLC', 'UI', 'MECH'],
      status: 'pending',
      requesterName: '김도현 (PM)',
      requesterRole: 'PM',
      reviewerName: '',
      reviewComment: '',
      targetApplyDate: addDaysDateStr(8),
    },
    {
      code: 'ROC-004',
      title: 'MON-01 ↔ PLC-01 통신 프로토콜 Modbus TCP → OPC-UA 전환 검토',
      asIs: 'MC Protocol / Modbus TCP 워드 폴링(100ms 주기)',
      toBe: 'PLC 내장 OPC-UA 서버 기반 구독(Subscription) 방식',
      reason: '상위 MES 보안 정책 대응 여부 사전 검토',
      impactModules: ['PLC', 'UI'],
      status: 'on_hold',
      requesterName: '최유진 (UI)',
      requesterRole: 'UI',
      reviewerName: '김도현 (PM)',
      reviewComment: '1차 FAT는 기존 워드 통신 유지, 고객사 회신 후 2차 옵션으로 재검토.',
      targetApplyDate: addDaysDateStr(18),
    },
  ];
}

export function buildSeedIssues(): SeedIssue[] {
  return [
    {
      code: 'ISS-001',
      title: 'EC1 2D 카메라 단독 vs 3D 센서 적용 여부 미확정',
      description:
        '부품 상자(15슬롯) 내 PCB 부품의 Z축 높이 편차 허용 범위에 따라 EC1을 2D 에어로 처리할지 3D 구조광을 도입할지 최종 결정 필요.',
      module: 'VISION',
      priority: 'blocker',
      status: 'open',
      assigneeName: '이서연 (비전)',
      assigneeRole: 'VISION',
      dueDate: addDaysDateStr(2),
      externalRef: 'handoff-6.1-ec1-2d3d',
    },
    {
      code: 'ISS-002',
      title: 'Fanuc 로봇 Z축 하강 구간과 상부 EC2 브라켓 간섭 여유 18mm 부족 우려',
      description:
        '워크피스 파지 상태에서 고속 이동 시 진동 포함 안전 여유가 20mm 미만으로 측정됨. 브라켓 25mm 상향 또는 로봇 경유점 수정 결정 필요.',
      module: 'ROBOT',
      priority: 'blocker',
      status: 'in_review',
      assigneeName: '박준혁 (로봇)',
      assigneeRole: 'ROBOT',
      dueDate: addDaysDateStr(3),
      externalRef: 'handoff-6.2-robot-clearance',
    },
    {
      code: 'ISS-003',
      title: 'PLC-01 타겟 기종 및 프로토콜(PROFINET vs EtherNet/IP) 최종 확정 대기',
      description:
        '현재 Mock 시뮬레이터 10단계 FSM은 검증 완료했으나 실 PLC 기종에 따라 Fanuc 및 MON-01 통신 드라이버 확정 필요.',
      module: 'PLC',
      priority: 'high',
      status: 'open',
      assigneeName: '정민수 (PLC)',
      assigneeRole: 'PLC',
      dueDate: addDaysDateStr(5),
      externalRef: 'handshake-10.1-plc-model',
    },
    {
      code: 'ISS-004',
      title: 'EC2 리니어카메라 적용 여부 및 EC3 틈새 측정 광학 방식 검토',
      description:
        '조립 완료품 전면/상면 동시 검사 Tact Time 충족을 위해 EC2 라인스캔 vs 고해상도 에어리어 카메라 비교 검토 진행 중.',
      module: 'VISION',
      priority: 'medium',
      status: 'in_review',
      assigneeName: '이서연 (비전)',
      assigneeRole: 'VISION',
      dueDate: addDaysDateStr(6),
      externalRef: 'handoff-6.4-ec2-ec3-optics',
    },
  ];
}

export function buildSeedDecisions(): SeedDecision[] {
  return [
    {
      code: 'DEC-001',
      title: 'MON-01 모니터링 PC 제어 미관여(Read-Only) 아키텍처 확정',
      decisionSummary:
        '모니터링 PC(MON-01)는 PLC-01 판정 결과 및 EC1~3 촬영 이미지 수집·표시만 수행하며, 설비 제어 명령은 PLC-01 마스터로 단일화한다.',
      rationale:
        '제어망과 모니터링 UI 장애를 물리·논리적으로 격리해 PC 재부팅이나 UI 오류 시에도 셀 안전 시퀀스에 영향이 없도록 보장함.',
      impactModules: ['VISION', 'UI', 'PLC'],
      decidedByName: '김도현 (PM)',
      decidedDate: addDaysDateStr(-4),
    },
    {
      code: 'DEC-002',
      title: 'PLC-01 10단계 상태 머신(Step 0~10) 및 9개 구간 타임아웃 표준 동결',
      decisionSummary:
        'configs/cell_config.json 기반 10단계 FSM, 1Hz 하트비트 감시, AlarmCode 100~500번대 분류 체계를 v1.0 기준선으로 동결.',
      rationale:
        '비전(EC1~3)·로봇(Fanuc)·모니터링(MON-01) 병렬 Mock 개발과 Gate 2 자동 리뷰 기준 문서를 일원화하기 위함.',
      impactModules: ['ROBOT', 'PLC', 'UI'],
      decidedByName: '정민수 (PLC)',
      decidedDate: addDaysDateStr(-2),
    },
  ];
}
