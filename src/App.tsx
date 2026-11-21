import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  Check,
  CheckSquare,
  Copy,
  FileDiff,
  GitPullRequestDraft,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType, signOutUser } from './firebase';
import { AuthGate } from './components/AuthGate';
import { ChecklistTab } from './components/ChecklistTab';
import { DashboardTab } from './components/DashboardTab';
import { ErrorBoundary } from './components/ErrorBoundary';
import { IssuesDecisionsTab } from './components/IssuesDecisionsTab';
import { RocTab } from './components/RocTab';
import { ProjectSettingsModal, TeamRoleModal } from './components/WorkspaceModals';
import {
  ActiveTab,
  ChecklistItem,
  ChecklistModule,
  Decision,
  Issue,
  Project,
  RocChange,
  ROLE_SHORT_LABELS,
  TeamMember,
} from './types';

const TAB_ITEMS: Array<{
  id: ActiveTab;
  index: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', index: '1', label: '전체 진척 대시보드', icon: LayoutDashboard },
  { id: 'roc', index: '2', label: 'ROC/사양 변경 이력', icon: FileDiff },
  { id: 'checklist', index: '3', label: '모듈별 체크리스트', icon: CheckSquare },
  { id: 'issues', index: '4', label: '미결 이슈 및 결정사항', icon: GitPullRequestDraft },
];

const ROLE_ORDER: Record<string, number> = { PM: 0, VISION: 1, ROBOT: 2, PLC: 3, UI: 4 };

function WorkspaceApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Active project subcollection state
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [checklists, setChecklists] = useState<ChecklistItem[]>([]);
  const [rocChanges, setRocChanges] = useState<RocChange[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);

  // UI Navigation & Deep-link state
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [targetChecklistModule, setTargetChecklistModule] = useState<ChecklistModule | undefined>(
    undefined
  );
  const [targetRocId, setTargetRocId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Contextual CTA modal triggers
  const [rocCreateTrigger, setRocCreateTrigger] = useState(0);
  const [checklistCreateTrigger, setChecklistCreateTrigger] = useState(0);
  const [issueCreateTrigger, setIssueCreateTrigger] = useState(0);

  // Modals & Toast
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  // 1. Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        setProjects([]);
        setProjectsLoaded(false);
        setActiveProjectId(null);
      }
    });
    return unsub;
  }, []);

  // 2. Projects list listener (only when authenticated)
  useEffect(() => {
    if (!authReady || !user) return;
    const q = query(
      collection(db, 'projects'),
      where('memberUids', 'array-contains', user.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Project[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Project, 'id'>),
        }));
        setProjects(list);
        setProjectsLoaded(true);
        setActiveProjectId((prev) => {
          if (prev && list.some((p) => p.id === prev)) return prev;
          return list[0]?.id || null;
        });
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'projects')
    );
    return unsub;
  }, [authReady, user]);

  // 3. Active workspace subcollection listeners
  useEffect(() => {
    if (!authReady || !user || !activeProjectId) {
      setMembers([]);
      setChecklists([]);
      setRocChanges([]);
      setIssues([]);
      setDecisions([]);
      return;
    }

    setWorkspaceLoading(true);
    let readyCount = 0;
    const markReady = () => {
      readyCount += 1;
      if (readyCount >= 5) setWorkspaceLoading(false);
    };

    const unsubMembers = onSnapshot(
      query(
        collection(db, 'projects', activeProjectId, 'members'),
        where('projectId', '==', activeProjectId)
      ),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<TeamMember, 'id'>) }))
          .sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9));
        setMembers(list);
        markReady();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `projects/${activeProjectId}/members`)
    );

    const unsubChecklists = onSnapshot(
      query(
        collection(db, 'projects', activeProjectId, 'checklists'),
        where('projectId', '==', activeProjectId)
      ),
      (snap) => {
        setChecklists(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChecklistItem, 'id'>) }))
        );
        markReady();
      },
      (err) =>
        handleFirestoreError(err, OperationType.LIST, `projects/${activeProjectId}/checklists`)
    );

    const unsubRocs = onSnapshot(
      query(
        collection(db, 'projects', activeProjectId, 'rocChanges'),
        where('projectId', '==', activeProjectId)
      ),
      (snap) => {
        setRocChanges(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RocChange, 'id'>) }))
        );
        markReady();
      },
      (err) =>
        handleFirestoreError(err, OperationType.LIST, `projects/${activeProjectId}/rocChanges`)
    );

    const unsubIssues = onSnapshot(
      query(
        collection(db, 'projects', activeProjectId, 'issues'),
        where('projectId', '==', activeProjectId)
      ),
      (snap) => {
        setIssues(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Issue, 'id'>) })));
        markReady();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `projects/${activeProjectId}/issues`)
    );

    const unsubDecisions = onSnapshot(
      query(
        collection(db, 'projects', activeProjectId, 'decisions'),
        where('projectId', '==', activeProjectId)
      ),
      (snap) => {
        setDecisions(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Decision, 'id'>) }))
        );
        markReady();
      },
      (err) =>
        handleFirestoreError(err, OperationType.LIST, `projects/${activeProjectId}/decisions`)
    );

    return () => {
      unsubMembers();
      unsubChecklists();
      unsubRocs();
      unsubIssues();
      unsubDecisions();
    };
  }, [authReady, user, activeProjectId]);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  const currentMember = useMemo(
    () => (user ? members.find((m) => m.uid === user.uid) : undefined),
    [members, user]
  );

  const handleNavigateTab = (
    tab: ActiveTab,
    options?: { checklistModule?: ChecklistModule; rocId?: string }
  ) => {
    setActiveTab(tab);
    if (options?.checklistModule) {
      setTargetChecklistModule(options.checklistModule);
    }
    if (options?.rocId) {
      setTargetRocId(options.rocId);
    }
    setMobileMenuOpen(false);
  };

  const handleCopyInviteCode = async () => {
    if (!activeProject) return;
    try {
      await navigator.clipboard.writeText(activeProject.inviteCode);
      setCopiedInvite(true);
      showToast(`팀 초대 코드(${activeProject.inviteCode})가 복사되었습니다.`);
      window.setTimeout(() => setCopiedInvite(false), 2000);
    } catch {
      showToast(`초대 코드: ${activeProject.inviteCode}`);
    }
  };

  const handlePrimaryCta = () => {
    if (activeTab === 'roc') {
      setRocCreateTrigger((n) => n + 1);
    } else if (activeTab === 'checklist') {
      setChecklistCreateTrigger((n) => n + 1);
    } else if (activeTab === 'issues') {
      setIssueCreateTrigger((n) => n + 1);
    } else {
      setSettingsModalOpen(true);
    }
  };

  // Loading gate before auth resolves
  if (!authReady || (user && !projectsLoaded)) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-sm text-slate-500 font-medium">워크스페이스 연결 확인 중...</div>
      </div>
    );
  }

  // Unauthenticated or no project joined yet (or user clicked create/join workspace)
  if (!user || !activeProject || showOnboarding) {
    return (
      <AuthGate
        user={user}
        onCancel={activeProject ? () => setShowOnboarding(false) : undefined}
        onWorkspaceReady={(newProjectId) => {
          setActiveProjectId(newProjectId);
          setShowOnboarding(false);
          setActiveTab('dashboard');
          showToast('실시간 공유 워크스페이스에 연결되었습니다.');
        }}
      />
    );
  }

  const activeTabMeta = TAB_ITEMS.find((t) => t.id === activeTab) || TAB_ITEMS[0];
  const fallbackName = user.displayName || user.email?.split('@')[0] || '엔지니어';

  const primaryCtaLabel =
    activeTab === 'roc'
      ? 'ROC 등록'
      : activeTab === 'checklist'
      ? '체크 항목 추가'
      : activeTab === 'issues'
      ? '이슈 등록'
      : '프로젝트 설정';

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 w-64">
      {/* Brand & Workspace Switcher */}
      <div className="px-5 h-14 flex items-center justify-between border-b border-slate-200 shrink-0">
        <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
          CELL-SYNC
        </span>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1 text-slate-400 hover:text-slate-700"
          aria-label="메뉴 닫기"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Workspace Selector */}
      <div className="px-4 py-3 border-b border-slate-200">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-xs font-medium text-slate-400">활성 프로젝트</span>
          <button
            type="button"
            onClick={() => setShowOnboarding(true)}
            className="text-xs font-medium text-[#1D4ED8] hover:underline cursor-pointer whitespace-nowrap"
          >
            + 생성/합류
          </button>
        </div>
        {projects.length > 1 ? (
          <select
            aria-label="프로젝트 전환"
            value={activeProject.id}
            onChange={(e) => setActiveProjectId(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs font-semibold text-slate-900 border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:border-[#1D4ED8]"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="text-xs font-semibold text-slate-900 truncate">{activeProject.name}</div>
        )}
      </div>

      {/* 4 Core Navigation Tabs */}
      <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
        {TAB_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigateTab(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-[#1D4ED8]/[0.08] text-[#1D4ED8]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {item.index}. {item.label}
              </span>
            </button>
          );
        })}

        {/* 5-Engineer Team Roster */}
        <div className="pt-5 mt-5 border-t border-slate-200">
          <div className="px-2 flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">5인 팀원 파트</span>
            <button
              type="button"
              onClick={() => setRoleModalOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#1D4ED8] hover:underline cursor-pointer"
            >
              <Users className="w-3 h-3" />
              파트 설정
            </button>
          </div>
          <div className="space-y-1">
            {members.map((m) => {
              const isMe = m.uid === user.uid;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setRoleModalOpen(true)}
                  className="w-full px-2 py-1.5 rounded hover:bg-slate-50 flex items-center justify-between gap-2 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] font-mono text-slate-400 w-8 shrink-0">
                      {ROLE_SHORT_LABELS[m.role]}
                    </span>
                    <span
                      className={`text-xs truncate ${
                        isMe ? 'font-semibold text-[#1D4ED8]' : 'text-slate-700'
                      }`}
                    >
                      {m.displayName}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">
                    {isMe ? '나' : m.isClaimed ? '참여' : '대기'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Team Invite Code & Account Footer */}
      <div className="p-4 border-t border-slate-200 space-y-3 bg-slate-50/50 shrink-0">
        <div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
            <span>팀원 공유 초대 코드</span>
            <span className="font-mono tabular-nums">{activeProject.memberUids.length}/10명</span>
          </div>
          <button
            type="button"
            onClick={handleCopyInviteCode}
            className="w-full flex items-center justify-between px-3 py-1.5 bg-white border border-slate-200 rounded-md hover:border-slate-300 transition-colors cursor-pointer"
          >
            <span className="text-xs font-mono font-semibold tracking-widest text-slate-900">
              {activeProject.inviteCode}
            </span>
            {copiedInvite ? (
              <Check className="w-3.5 h-3.5 text-[#16A34A]" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-800 truncate">
              {currentMember?.displayName || fallbackName}
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              {currentMember ? ROLE_SHORT_LABELS[currentMember.role] : '파트 미지정'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOutUser()}
            title="로그아웃"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded cursor-pointer shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block shrink-0 sticky top-0 h-screen">{sidebarContent}</aside>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="relative z-10 h-full">{sidebarContent}</div>
          <div
            className="flex-1 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Context Header (Single Row: Breadcrumb + 1 Primary Action) */}
        <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 text-slate-600 hover:bg-slate-100 rounded"
              aria-label="네비게이션 열기"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
              <span className="text-slate-400 truncate hidden sm:inline max-w-[200px]">
                {activeProject.name}
              </span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-semibold text-slate-900 truncate">
                {activeTabMeta.index}. {activeTabMeta.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrimaryCta}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-[#1D4ED8] rounded-md hover:bg-[#1E40AF] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {activeTab === 'dashboard' ? (
                <Settings className="w-3.5 h-3.5" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              {primaryCtaLabel}
            </button>
          </div>
        </header>

        {/* Active Tab Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1360px] w-full mx-auto">
          {workspaceLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-28 bg-white border border-slate-200 rounded-lg p-5 animate-pulse"
                  >
                    <div className="h-3 w-24 bg-slate-100 rounded mb-4" />
                    <div className="h-7 w-16 bg-slate-100 rounded" />
                  </div>
                ))}
              </div>
              <div className="h-64 bg-white border border-slate-200 rounded-lg animate-pulse" />
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardTab
                  project={activeProject}
                  members={members}
                  checklists={checklists}
                  rocChanges={rocChanges}
                  issues={issues}
                  decisions={decisions}
                  onNavigateTab={handleNavigateTab}
                />
              )}

              {activeTab === 'roc' && (
                <RocTab
                  projectId={activeProject.id}
                  projectOwnerId={activeProject.ownerId}
                  currentUid={user.uid}
                  currentMember={currentMember}
                  fallbackName={fallbackName}
                  rocChanges={rocChanges}
                  initialSelectedRocId={targetRocId}
                  openCreateTrigger={rocCreateTrigger}
                  onToast={showToast}
                />
              )}

              {activeTab === 'checklist' && (
                <ChecklistTab
                  projectId={activeProject.id}
                  members={members}
                  checklists={checklists}
                  initialModule={targetChecklistModule}
                  openCreateTrigger={checklistCreateTrigger}
                  onToast={showToast}
                />
              )}

              {activeTab === 'issues' && (
                <IssuesDecisionsTab
                  projectId={activeProject.id}
                  projectOwnerId={activeProject.ownerId}
                  currentUid={user.uid}
                  currentMember={currentMember}
                  fallbackName={fallbackName}
                  members={members}
                  issues={issues}
                  decisions={decisions}
                  openCreateIssueTrigger={issueCreateTrigger}
                  onToast={showToast}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Role Assignment Modal */}
      {roleModalOpen && (
        <TeamRoleModal
          projectId={activeProject.id}
          currentUid={user.uid}
          fallbackName={fallbackName}
          members={members}
          onClose={() => setRoleModalOpen(false)}
          onToast={showToast}
        />
      )}

      {/* Project Settings Modal */}
      {settingsModalOpen && (
        <ProjectSettingsModal
          project={activeProject}
          isOwner={activeProject.ownerId === user.uid}
          onClose={() => setSettingsModalOpen(false)}
          onToast={showToast}
        />
      )}

      {/* Subtle Toast Feedback */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-2.5 rounded-md shadow-md max-w-sm"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <WorkspaceApp />
    </ErrorBoundary>
  );
}
