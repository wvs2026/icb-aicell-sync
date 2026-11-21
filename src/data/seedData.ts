import {
  addDaysDateStr,
  ChecklistModule,
  ChecklistStatus,
  ImpactModule,
  IssueModule,
  IssuePriority,
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
    specialty: '3-Cam GigE 광학·캘리브레이션·결함 검사',
  },
  {
    id: 'slot-robot',
    role: 'ROBOT',
    displayName: '박준혁 (로봇)',
    specialty: '6축 다관절 로봇 TCP·Hand-Eye·경로 티칭',
  },
  {
    id: 'slot-plc',
    role: 'PLC',
    displayName: '정민수 (PLC)',
    specialty: 'PLC 시퀀스·PROFINET 핸드셰이크·안전 인터록',
  },
  {
    id: 'slot-ui',
    role: 'UI',
    displayName: '최유진 (UI)',
    specialty: '모니터링 PC 3-Cam 뷰어·레시피·알람 로그',
  },
];

export function buildSeedChecklists(): SeedChecklist[] {
  return [
    // VISION (6 items)
    {
      module: 'VISION',
      stage: '1. 카메라 3대 광학 및 조명',
      isInterface: false,
      interfacePair: '',
      title: 'Cam 1(상면 정렬)·Cam 2(측면 치수)·Cam 3(표면 결함) 렌즈 WD 및 DOF 확정',
      status: 'done',
      assigneeRole: 'VISION',
      assigneeName: '이서연 (비전)',
      dueDate: addDaysDateStr(-4),
      notes: 'Cam1 25mm, Cam2 35mm 텔레센트릭, Cam3 16mm 광각. 작업거리 실측 완료.',
      sortOrder: 10,
    },
    {
      module: 'VISION',
      stage: '1. 카메라 3대 광학 및 조명',
      isInterface: false,
      interfacePair: '',
      title: '3-Cam 동시 촬상용 4채널 LED 스트로브 컨트롤러 트리거 지연 측정',
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
      title: 'Cam 1 ↔ 6축 로봇 베이스 좌표계 9-Point Hand-Eye 캘리브레이션 검증',
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
      title: 'Cam 3 고반사 알루미늄 하우징 스크래치 검출 편광 필터 테스트',
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
      title: '비전 엔진 ↔ 모니터링 PC 검사 결과(OK/NG) 및 오버레이 이미지 TCP 전송',
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
      title: '보정 좌표(dX, dY, dTheta) 패킷 체크섬 및 타임아웃 예외 처리',
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
      title: '픽업 → Cam2/Cam3 경유 → 배출 트레이 간섭 회피 안전 경로 티칭',
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
      title: '비전 보정 좌표 수신 후 로봇 Offset Pick 반복 정밀도 ±0.1mm 테스트',
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
      title: 'PLC ↔ 로봇 PROFINET 16-Byte 핸드셰이크(Ready/Start/Busy/Done) 검증',
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
      title: '지그 클램프 완료 → 비전 트리거 → 로봇 투입 메인 오토 사이클 구현',
      status: 'in_progress',
      assigneeRole: 'PLC',
      assigneeName: '정민수 (PLC)',
      dueDate: addDaysDateStr(4),
      notes: 'NG 배출 슈트 만재 센서 알람 분기 로직 추가 중.',
      sortOrder: 230,
    },
    {
      module: 'PLC',
      stage: '2. 자동 시퀀스 및 핸드셰이크',
      isInterface: true,
      interfacePair: 'PLC ↔ PC',
      title: 'PLC ↔ 모니터링 PC 알람 코드(200종) 및 모델 레시피 번호 동기화',
      status: 'done',
      assigneeRole: 'PLC',
      assigneeName: '정민수 (PLC)',
      dueDate: addDaysDateStr(-1),
      notes: 'D1000~D1199 워드 영역 매핑 및 하트비트 1Hz 감시 동작 확인.',
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
      title: '3-Cam 동시 라이브/결과 오버레이 화면(FPS·Tact Time·NG ROI 표시)',
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
      title: '모델별 레시피 전환 시 PLC·비전·로봇 Job 번호 일괄 동기화 화면',
      status: 'in_progress',
      assigneeRole: 'UI',
      assigneeName: '최유진 (UI)',
      dueDate: addDaysDateStr(5),
      notes: 'PLC 응답 ACK 타임아웃(3초) 발생 시 롤백 알림 팝업 구현 중.',
      sortOrder: 320,
    },
    {
      module: 'UI',
      stage: '2. 레시피 및 이력 관리',
      isInterface: false,
      interfacePair: '',
      title: '일별 양품/불량 집계 차트, NG 원본 이미지 자동 보관 및 30일 순환 삭제',
      status: 'done',
      assigneeRole: 'UI',
      assigneeName: '최유진 (UI)',
      dueDate: addDaysDateStr(0),
      notes: '디스크 80% 도달 시 자동 경고 및 오래된 폴더 정리 스케줄러 검증.',
      sortOrder: 330,
    },
    {
      module: 'UI',
      stage: '3. 알람 및 작업자 권한',
      isInterface: true,
      interfacePair: 'PLC ↔ PC',
      title: 'PLC/로봇/비전 통합 알람 이력 로그 및 작업자·관리자 권한 분리',
      status: 'todo',
      assigneeRole: 'UI',
      assigneeName: '최유진 (UI)',
      dueDate: addDaysDateStr(10),
      notes: '엔지니어 모드 진입 시 패스워드 인증 및 변경 이력 감사 로그 포함.',
      sortOrder: 340,
    },
  ];
}

export function buildSeedRocs(): SeedRoc[] {
  return [
    {
      code: 'ROC-001',
      title: 'Cam 3 조명 링타입 → 동축+저각도 2채널 복합 조명으로 변경',
      asIs: 'Cam 3 단일 백색 링조명(1채널, 24V 상시 점등)',
      toBe: '동축 조명 + 15도 저각도 적색 바조명 2채널 스트로브 제어',
      reason: '알루미늄 가공면 미세 스크래치 대비(Contrast) 확보 및 발열 저감',
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
      title: '비전 → 로봇 좌표 보정 패킷 회전각(dTheta) 정밀도 소수점 3자리 확장',
      asIs: 'ASCII CSV 포맷, dTheta 소수점 1자리(0.1 deg 단위)',
      toBe: '고정폭 프레임 + CRC16 체크섬, dTheta 소수점 3자리(0.001 deg 단위)',
      reason: '장축 워크피스(240mm) 끝단 삽입 시 0.1 deg 오차로 0.42mm 위치 편차 발생',
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
      title: '모니터링 PC ↔ PLC 통신 프로토콜 Modbus TCP → OPC-UA 전환 검토',
      asIs: 'MC Protocol / Modbus TCP 워드 폴링(100ms 주기)',
      toBe: 'PLC 내장 OPC-UA 서버 기반 구독(Subscription) 방식',
      reason: 'MES 상위 시스템 보안 정책 대응 여부 사전 검토',
      impactModules: ['PLC', 'UI'],
      status: 'on_hold',
      requesterName: '최유진 (UI)',
      requesterRole: 'UI',
      reviewerName: '김도현 (PM)',
      reviewComment: '1차 FAT는 기존 워드 통신 유지, 고객사 MES 팀 회신 후 2차 옵션으로 재검토.',
      targetApplyDate: addDaysDateStr(18),
    },
  ];
}

export function buildSeedIssues(): SeedIssue[] {
  return [
    {
      code: 'ISS-001',
      title: 'Cam 1~3 동시 촬상 시 GigE 패킷 드롭 간헐 발생 (약 0.3%)',
      description:
        '3대 카메라 5MP Full Frame 동시 트리거 시 모니터링 PC 단일 NIC 대역폭 포화로 프레임 유실 발생. Jumbo Frame 9014 및 카메라별 Inter-Packet Delay 조정 테스트 중.',
      module: 'VISION',
      priority: 'blocker',
      status: 'open',
      assigneeName: '이서연 (비전)',
      assigneeRole: 'VISION',
      dueDate: addDaysDateStr(2),
    },
    {
      code: 'ISS-002',
      title: '로봇 Z축 하강 구간과 상부 Cam 2 브라켓 간섭 여유 18mm 부족 우려',
      description:
        '워크피스 최대 높이(65mm) 파지 상태에서 고속 이동 시 진동 포함 안전 여유가 20mm 미만으로 측정됨. 브라켓 25mm 상향 또는 로봇 경유점 수정 결정 필요.',
      module: 'ROBOT',
      priority: 'blocker',
      status: 'in_review',
      assigneeName: '박준혁 (로봇)',
      assigneeRole: 'ROBOT',
      dueDate: addDaysDateStr(3),
    },
    {
      code: 'ISS-003',
      title: '목표 Tact Time 4.2초 대비 현재 통합 사이클 4.65초 (+0.45초 초과)',
      description:
        'PLC 지그 클램프 확인 지연(0.25초)과 비전 검사 후 로봇 출발 대기 구간이 직렬로 동작하여 병목 발생. 로봇 선행 진입(Look-ahead) 인터록 적용 검토 필요.',
      module: 'PLC',
      priority: 'high',
      status: 'open',
      assigneeName: '정민수 (PLC)',
      assigneeRole: 'PLC',
      dueDate: addDaysDateStr(5),
    },
    {
      code: 'ISS-004',
      title: '레시피 전환 중 PLC-비전 모델 번호 불일치 시 자동 운전 차단 정책 미정',
      description:
        'UI에서 모델 B 선택 후 비전 로딩이 지연될 때 PLC가 모델 A 기준으로 스타트되는 엣지 케이스 발견. 상호 Handshake 확인 후 Start 버튼 활성화 정책 확정 필요.',
      module: 'UI',
      priority: 'medium',
      status: 'in_review',
      assigneeName: '최유진 (UI)',
      assigneeRole: 'UI',
      dueDate: addDaysDateStr(6),
    },
  ];
}

export function buildSeedDecisions(): SeedDecision[] {
  return [
    {
      code: 'DEC-001',
      title: '모니터링 PC 내 Intel I350 4포트 독립 PoE GigE NIC 증설 확정',
      decisionSummary:
        '카메라 3대를 각각 독립 NIC 포트(Port 1~3)에 직결하고, PLC/로봇 제어망은 메인보드 LAN으로 물리 분리한다.',
      rationale:
        '단일 스위치 허브 경유 시 브로드캐스트 및 대역폭 경합으로 패킷 드롭 위험이 높아 하드웨어 레벨에서 통신망을 격리함.',
      impactModules: ['VISION', 'UI', 'PLC'],
      decidedByName: '김도현 (PM)',
      decidedDate: addDaysDateStr(-4),
    },
    {
      code: 'DEC-002',
      title: 'PLC ↔ 다관절 로봇 PROFINET 16-Byte 표준 I/O 핸드셰이크 맵 동결',
      decisionSummary:
        'Input 16-Byte / Output 16-Byte 구조(시스템 상태 2B, 명령/완료 비트 2B, 모델/Job ID 2B, 알람 코드 2B, 예비 8B)로 v1.0 동결.',
      rationale:
        '로봇 티칭과 PLC 래더 병렬 개발을 위해 인터페이스 워드 주소를 조기 확정하고 이후 변경은 ROC 절차를 통해서만 허용함.',
      impactModules: ['ROBOT', 'PLC'],
      decidedByName: '정민수 (PLC)',
      decidedDate: addDaysDateStr(-2),
    },
  ];
}
