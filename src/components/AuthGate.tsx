import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { ArrowRight, KeyRound, LogOut, Plus, ShieldCheck } from 'lucide-react';
import { signInWithGoogle, signOutUser } from '../firebase';
import { createWorkspaceWithSeed, joinWorkspaceByCode } from '../services/projectService';
import { addDaysDateStr, LIMITS, ROLE_LABELS, TeamRole } from '../types';

interface AuthGateProps {
  user: User | null;
  onWorkspaceReady: (projectId: string) => void;
  onCancel?: () => void;
}

const ROLES: TeamRole[] = ['PM', 'VISION', 'ROBOT', 'PLC', 'UI'];

export function AuthGate({ user, onWorkspaceReady, onCancel }: AuthGateProps) {
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [projectName, setProjectName] = useState('CELL-01 비전·로봇 통합 검사장비');
  const [description, setDescription] = useState(
    '3-Cam 머신비전 + 6축 다관절 로봇 + PLC + 모니터링 PC 연동 자동화 셀 개발'
  );
  const [targetDate, setTargetDate] = useState(addDaysDateStr(28));
  const [creatorRole, setCreatorRole] = useState<TeamRole>('PM');
  const [creatorDisplayName, setCreatorDisplayName] = useState(user?.displayName || '');
  const [includeSampleData, setIncludeSampleData] = useState(true);

  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const handleGoogleSignIn = async () => {
    setAuthError('');
    setAuthLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '로그인에 실패했습니다.';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError('Google 로그인 중 문제가 발생했습니다. 팝업 차단을 해제한 뒤 다시 시도해 주세요.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!projectName.trim()) {
      setFormError('프로젝트명을 입력해 주세요.');
      return;
    }
    if (!LIMITS.DATE_PATTERN.test(targetDate)) {
      setFormError('목표 납기일 형식을 확인해 주세요 (YYYY-MM-DD).');
      return;
    }
    setSubmitting(true);
    try {
      const projectId = await createWorkspaceWithSeed({
        name: projectName,
        description,
        targetDate,
        creatorRole,
        creatorDisplayName: creatorDisplayName.trim() || user?.displayName || '엔지니어',
        includeSampleData,
      });
      onWorkspaceReady(projectId);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '워크스페이스 생성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const normalized = inviteCode.trim().toUpperCase();
    if (!LIMITS.INVITE_CODE_PATTERN.test(normalized)) {
      setFormError('팀원에게 받은 6자리 영문/숫자 초대 코드를 정확히 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await joinWorkspaceByCode(normalized);
      onWorkspaceReady(result.projectId);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '초대 코드로 합류할 수 없습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between">
        <header className="w-full border-b border-slate-200 bg-white">
          <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
            <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
              CELL-SYNC
            </span>
            <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
              5인 통합 자동화 장비 개발 워크스페이스
            </span>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="text-xs font-medium text-[#1D4ED8] tracking-wide">
                머신비전 3-Cam · 다관절 로봇 · PLC · 모니터링 PC
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-tight [text-wrap:balance]">
                복합 연동 장비 개발을 하나의 실시간 기준선으로 관리합니다
              </h1>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
                5명의 파트별 엔지니어(PM·비전·로봇·PLC·UI)가 동일한 프로젝트 공간에서 전체 진척률,
                ROC 사양 변경 이력, 모듈별 검증 체크리스트, 미결 이슈와 확정 결정사항을 실시간으로
                동기화합니다.
              </p>

              <div className="grid grid-cols-2 gap-x-8 gap-y-4 pt-4 border-t border-slate-200">
                <div>
                  <div className="text-xs font-mono text-slate-400 mb-1">01</div>
                  <div className="text-sm font-semibold text-slate-900">전체 진척 대시보드</div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    모듈 체크리스트 완료율과 파트 간 연동 준비도 자동 집계
                  </p>
                </div>
                <div>
                  <div className="text-xs font-mono text-slate-400 mb-1">02</div>
                  <div className="text-sm font-semibold text-slate-900">ROC / 사양 변경 이력</div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    As-Is / To-Be 비교, 영향 모듈 태깅 및 승인 상태 추적
                  </p>
                </div>
                <div>
                  <div className="text-xs font-mono text-slate-400 mb-1">03</div>
                  <div className="text-sm font-semibold text-slate-900">모듈별 체크리스트</div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    비전 3대·로봇·PLC·모니터링 UI 공정 단계별 검증 관리
                  </p>
                </div>
                <div>
                  <div className="text-xs font-mono text-slate-400 mb-1">04</div>
                  <div className="text-sm font-semibold text-slate-900">미결 이슈 → 결정 전환</div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    안건 종결과 동시에 근거가 연결된 확정 결정사항 자동 기록
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="bg-white border border-slate-200 rounded-lg p-7">
                <h2 className="text-base font-semibold text-slate-900 mb-1.5">팀 계정 로그인</h2>
                <p className="text-xs text-slate-500 leading-relaxed mb-6">
                  Google 계정으로 로그인하면 소속 프로젝트에 즉시 연결되며, 초대 코드로 팀원 5명이
                  실시간으로 공동 작업할 수 있습니다.
                </p>

                {authError && (
                  <div className="mb-4 text-xs text-[#DC2626] bg-red-50 border border-red-200 rounded-md p-3">
                    {authError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={authLoading}
                  className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 text-sm font-medium text-white bg-[#1D4ED8] rounded-md hover:bg-[#1E40AF] disabled:opacity-60 transition-colors cursor-pointer"
                >
                  <span>{authLoading ? 'Google 로그인 중...' : 'Google 계정으로 시작하기'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-500">
                  <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    워크스페이스 멤버십 기반 접근 제어로 초대된 팀원만 프로젝트 데이터를 조회 및
                    수정할 수 있습니다.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </main>

        <footer className="border-t border-slate-200 bg-white">
          <div className="max-w-5xl mx-auto px-6 py-4 text-xs text-slate-400 flex items-center justify-between">
            <span>CELL-SYNC Engineering Workspace</span>
            <span>Vision · Robot · PLC · Monitoring PC</span>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <header className="w-full border-b border-slate-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
              CELL-SYNC
            </span>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="text-xs font-medium text-[#1D4ED8] hover:underline cursor-pointer whitespace-nowrap"
              >
                워크스페이스로 돌아가기
              </button>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span className="truncate max-w-[200px]">{user.displayName || user.email}</span>
            <button
              type="button"
              onClick={() => signOutUser()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl bg-white border border-slate-200 rounded-lg p-7">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-slate-900 mb-1">공유 워크스페이스 시작</h1>
            <p className="text-xs text-slate-500">
              새 장비 개발 프로젝트를 생성하거나, 팀원이 공유한 6자리 초대 코드로 합류하세요.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-md mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('create');
                setFormError('');
              }}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'create'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              새 프로젝트 생성
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('join');
                setFormError('');
              }}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'join'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              초대 코드로 합류
            </button>
          </div>

          {formError && (
            <div className="mb-5 text-xs text-[#DC2626] bg-red-50 border border-red-200 rounded-md p-3">
              {formError}
            </div>
          )}

          {mode === 'create' ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  프로젝트명 <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={LIMITS.PROJECT_NAME_MAX}
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
                  placeholder="예: CELL-01 비전·로봇 통합 검사장비"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">장비 개요</label>
                <input
                  type="text"
                  maxLength={LIMITS.PROJECT_DESC_MAX}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    목표 FAT / 납기일
                  </label>
                  <input
                    type="date"
                    required
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    내 담당 파트 (5인 프리셋)
                  </label>
                  <select
                    value={creatorRole}
                    onChange={(e) => setCreatorRole(e.target.value as TeamRole)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:border-[#1D4ED8]"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  워크스페이스 표시 이름
                </label>
                <input
                  type="text"
                  maxLength={LIMITS.DISPLAY_NAME_MAX}
                  value={creatorDisplayName}
                  onChange={(e) => setCreatorDisplayName(e.target.value)}
                  placeholder={user.displayName || '예: 홍길동 (PM)'}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>

              <label className="flex items-start gap-2.5 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSampleData}
                  onChange={(e) => setIncludeSampleData(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#1D4ED8] focus:ring-[#1D4ED8]"
                />
                <span className="text-xs text-slate-600 leading-relaxed">
                  <strong className="font-medium text-slate-800">
                    5인 역할 프리셋 및 실무 샘플 공정 데이터 포함
                  </strong>
                  <br />
                  3-Cam 비전·다관절 로봇·PLC·모니터링 UI 체크리스트 20건, ROC 4건, 미결 이슈 4건,
                  확정 결정사항 2건이 자동 세팅됩니다.
                </span>
              </label>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#1D4ED8] rounded-md hover:bg-[#1E40AF] disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {submitting ? '워크스페이스 초기화 중...' : '공유 워크스페이스 생성'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  팀 초대 코드 (6자리) <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="예: A7K9P2"
                  className="w-full px-3 py-2.5 text-base font-mono tracking-widest uppercase border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  프로젝트 생성자의 좌측 사이드바 하단에 표시된 6자리 초대 코드를 입력하면 즉시
                  실시간 공유 DB에 연결됩니다.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#1D4ED8] rounded-md hover:bg-[#1E40AF] disabled:opacity-60 transition-colors cursor-pointer"
              >
                {submitting ? '워크스페이스 합류 중...' : '워크스페이스 합류하기'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
