# ICB-AICell 파이프라인 현황 브리프 (Google AI Studio 연동 검토용)

> **문서 목적**: Google AI Studio(AI Space)로 제작한 프로젝트 관리 앱과 현재 개발 중인 `ICB-AICell` 개발·검증·운영 파이프라인을 연동하기 위해, AI Studio 측에 전달하는 시스템 현황 및 연동 요구사항 문서입니다.

---

## 1. 프로젝트 개요 (`ICB-AICell`)

- **대상 설비**: 자동차 배터리(BPA) ICB 모듈 자동 조립 및 머신비전 검사 셀
- **주요 하드웨어 구성**:
  - **EC1 (머신비전 1, Jetson Orin Nano 예정)**: 부품 상자(15슬롯) 내 PCB 부품 인식 및 파지 좌표 산출 → Fanuc 로봇으로 직접 좌표 전달
  - **Fanuc 다관절 로봇**: 부품 피킹 → 조립대 이송 및 조립 → 검사 시야 밖 퇴피
  - **EC2 (전면 검사) / EC3 (상면 틈새 측정)**: 조립 완료품 동시 검사 및 양/불 판정
  - **PLC (`PLC-01`)**: 공정 시퀀스 마스터 (10단계 상태 머신, 타임아웃/하트비트 감시, 안전 인터록)
  - **모니터링 PC (`MON-01`)**: PLC 판정 결과 및 EC1~3 촬영 이미지 수집·표시 (제어 미관여)
- **현재 개발 단계**: Mock 시뮬레이터 + PLC 시퀀스 마스터 + 비전 추상화 인터페이스 + Gate 1/2 자동 검수 파이프라인 구축 완료 (타겟 하드웨어 확정 전 단계)

---

## 2. 개발·협업 인프라 및 파이프라인 구조

### 2.1 하이브리드 저장소 & 네트워크
| 구분 | 위치 | 관리 대상 |
|---|---|---|
| **코드·문서** | GitHub Private (`wvs2026/icb-aicell`) | Python 소스, `docs/*.md`, `configs/*.json`, `cad/*.scad`, 검증 스크립트 |
| **대용량 자산** | 연구실 NAS (`arca.local`) | 이미지/영상 데이터셋, 학습 모델(`.pt`, `.onnx`, `.engine`), 장비별 백업(`03_machines/`), 릴리스 패키지 |

- **PC 역할 분리**:
  - **노트북 (`NB-01`)**: 메인 개발 및 현장 장비 연동·시운전 중계 (Windows)
  - **연구실 워크스테이션 (`WS-01`, Ubuntu, RTX 3090 × 4)**: 로컬 `vLLM` 2+2 듀얼 서버(`8000`, `8001` 포트), 모델 학습, 자동 검증/빌드
  - **네트워크**: 연구실과 현장은 방화벽으로 분리된 별도 LAN이며, `Tailscale VPN`으로 노트북 ↔ 워크스테이션 ↔ NAS 연결

### 2.2 3-AI 역할 분담 & 3중 품질 검수 파이프라인
1. **개념 설계 (Gemini)**: 아키텍처, FSM, 핸드셰이크 규격(`docs/handshake_signals.md`), 도면/이미지 분석
2. **코드 구현 (Claude Code / 로컬 vLLM)**: 프로덕션 코드, Mock 시뮬레이터, 테스트 구현
3. **3중 품질 게이트**:
   - **Gate 1 (`scripts/gate1.py`)**: `ruff` + `mypy --strict` + `pytest` 결정론적 검증 (`--json-report`로 JSON 요약 출력 지원)
   - **Gate 2 (`scripts/gate2_vllm_review.py`)**: 워크스테이션 로컬 `vLLM`이 `docs/handshake_signals.md` 및 고정 체크리스트(신호 규격, 하드코딩 여부, 예외 처리, 추상화, 보안) 대조 리뷰 (`ReviewReport` JSON 출력 지원)
   - **Gate 3**: 상용 AI 간 교차 리뷰
4. **4단계 서브에이전트 루프 (Contract-First)**:
   - `1단계(설계/규격)` → `2단계(Mock/Test)` → `3단계(구현)` → `4단계(QA/안전)`
   - QA 실패 시 결함 원인에 따라 1단계(설계) 또는 3단계(구현)로 반려

---

## 3. 프로젝트 관리 앱과 연동 가능한 데이터 소스 (현재 구조)

현재 파이프라인에는 아래와 같은 구조화된 문서·JSON·데이터 모델이 존재합니다.

### 3.1 마일스톤 및 미결정 사항 (프로젝트/이슈 관리 대상)
- **구축 로드맵 (`docs/dev_platform_plan.md` §6)**: Step 1-1 ~ Step 5 체크리스트
- **설계 미결정 사항 (`docs/handoff_robot_cell.md` §6, `docs/handshake_signals.md` §10)**:
  - 부품·공정 사양, 로봇 옵션/라이선스, EC1 2D/3D 결정, PLC 기종/프로토콜, 안전 신호, EC2 리니어카메라/EC3 틈새 측정 방식 등 다수의 오픈 이슈 존재

### 3.2 장비 인벤토리 및 버전 매핑 (`docs/machine_inventory.md`)
- 관리 대상 장비 8종: `WS-01`, `NB-01`, `MINI-01`, `EC1`, `EC2`, `EC3`, `MON-01`, `PLC-01`
- 추적 항목: 호스트명/모델, OS/펌웨어, Python/Conda 환경, IP/Tailscale, NAS 백업 경로, 최근 백업일, 연동 Git 커밋 해시/태그

### 3.3 설정 및 레시피 JSON (`configs/`)
- `configs/cell_config.json`: 하트비트 주기, 9개 구간 타임아웃, 재시도 횟수, 로봇 작업 영역 바운드, 상자 슬롯 수(`15`)
- `configs/recipes/default_recipe.json`: 품종별 조명 밝기, ROI, 임계값, 로봇 오프셋, EC3 최대 허용 틈새(`max_gap_mm`)

### 3.4 자동 검증 리포트 JSON (CI/QA 대시보드용)
- **Gate 1 JSON (`CheckResult`)**:
  - `name` (`ruff`, `mypy`, `pytest`), `returncode`, `duration_s`, `skipped`, `reason`
- **Gate 2 JSON (`ReviewReport`)**:
  - `verdict` (`PASS` | `WARN` | `FAIL`), `summary`, `model`, `reviewed_files`, `security_local_only`, `timestamp_utc`
  - `findings[]`: `severity` (`CRITICAL`~`INFO`), `category` (`handshake_spec`, `hardcoding`, `error_handling`, `abstraction`, `security`), `file`, `line`, `title`, `detail`, `suggestion`

### 3.5 시뮬레이션 / 설비 모니터링 레코드 (`CycleRecord`)
- 사이클 종료 또는 알람 시 생성되는 데이터 구조 (`src/icb_aicell/plc/controller.py`):
  - `seq_no`, `step` (`CycleStep` 0~10), `alarm` (`AlarmCode` 100~500번대), `ec1_result`, `ec1_slot_used`, `ec2_result`, `ec3_result`, `passed`, `cycle_time_s`

---

## 4. 보안 및 아키텍처 제약 조건 (필수 준수)

1. **보안 민감 정보 클라우드 반출 금지**:
   - EC1~3 무단 복제 방지 코드, 모델 암호화/HW 바인딩 로직, API 키, 비밀번호, NAS 계정 정보, 개인키는 외부 클라우드 앱(Google AI Space 포함)으로 절대 전송하지 않습니다.
   - Gate 2에서 `security_local_only=true`로 분류된 파일의 상세 코드 내용은 외부로 내보내지 않고, 익명화된 메타데이터(통과 여부/건수)만 연동 가능합니다.
2. **제어망 분리 원칙**:
   - 프로젝트 관리 앱은 설비 제어(PLC/로봇/EC)에 직접 관여하지 않으며, **개발 관리·이슈 추적·품질 리포트·장비/레시피 이력 관리·시운전 체크리스트** 역할에 집중합니다.
3. **현장 오프라인/분리망 고려**:
   - 현장 네트워크에서 외부 인터넷 접근이 제한될 수 있으므로, 파일(JSON/Markdown) 기반 동기화 또는 GitHub 경유 동기화 같은 느슨한 결합(Loose Coupling) 방식을 1차로 선호합니다.

---

## 5. AI Studio와 함께 검토하고 싶은 연동 시나리오

1. **개발·설계 이슈 및 마일스톤 추적**: `handoff_robot_cell.md` / `handshake_signals.md`의 미결정 사항(Open Questions)과 4단계 루프 반려 이력을 앱에서 칸반/이슈 형태로 관리
2. **품질 게이트(Gate 1/2) 리포트 시각화**: `gate1.py` 및 `gate2_vllm_review.py`가 생성한 JSON 리포트를 앱에 업로드하거나 연동해 커밋별 품질 추이 및 지적 사항(Findings) 추적
3. **장비 인벤토리 & 배포 이력 관리**: `machine_inventory.md`의 8개 장비별 백업일·Git 태그·레시피 버전을 앱에서 관리하고 Markdown/JSON으로 역내보내기(Export)
4. **현장 시운전 체크리스트 & 모니터링 요약**: 시운전 단계별 점검 항목 및 시뮬레이터/모니터링 `CycleRecord` 통계 요약 뷰어
