import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
  claimMemberSlot,
  releaseMemberSlot,
  updateProjectMetadata,
} from '../services/projectService';
import { LIMITS, Project, ROLE_LABELS, TeamMember } from '../types';

interface TeamRoleModalProps {
  projectId: string;
  currentUid: string;
  fallbackName: string;
  members: TeamMember[];
  onClose: () => void;
  onToast: (msg: string) => void;
}

export function TeamRoleModal({
  projectId,
  currentUid,
  fallbackName,
  members,
  onClose,
  onToast,
}: TeamRoleModalProps) {
  const mySlot = members.find((m) => m.uid === currentUid);
  const [selectedId, setSelectedId] = useState(
    mySlot?.id || members.find((m) => !m.isClaimed)?.id || members[0]?.id || ''
  );
  const selectedMember = members.find((m) => m.id === selectedId);
  const [displayName, setDisplayName] = useState(
    mySlot?.displayName || fallbackName || ''
  );
  const [specialty, setSpecialty] = useState(selectedMember?.specialty || '');
  const [saving, setSaving] = useState(false);

  const handleSelectSlot = (slot: TeamMember) => {
    setSelectedId(slot.id);
    setSpecialty(slot.specialty);
    if (slot.uid === currentUid) {
      setDisplayName(slot.displayName);
    } else if (!displayName.trim()) {
      setDisplayName(fallbackName);
    }
  };

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !displayName.trim() || !specialty.trim()) return;
    setSaving(true);
    try {
      // If switching from another slot owned by me, release previous slot first
      if (mySlot && mySlot.id !== selectedMember.id) {
        await releaseMemberSlot(projectId, mySlot.id);
      }
      await claimMemberSlot(projectId, selectedMember.id, displayName, specialty);
      onToast(`${ROLE_LABELS[selectedMember.role]} 파트로 배정되었습니다.`);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">5인 팀원 파트 배정</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              본인이 담당하는 장비 개발 파트를 선택하고 표시 이름을 설정하세요.
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

        <form onSubmit={handleClaim} className="space-y-4">
          <div className="space-y-2">
            {members.map((slot) => {
              const isMine = slot.uid === currentUid;
              const takenByOther = slot.isClaimed && !isMine;
              const isSelected = selectedId === slot.id;

              return (
                <button
                  key={slot.id}
                  type="button"
                  disabled={takenByOther}
                  onClick={() => handleSelectSlot(slot)}
                  className={`w-full text-left p-3 rounded-md border transition-colors ${
                    takenByOther
                      ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                      : isSelected
                      ? 'bg-blue-50/50 border-[#1D4ED8] cursor-pointer'
                      : 'bg-white border-slate-200 hover:border-slate-300 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900">
                      {ROLE_LABELS[slot.role]}
                    </span>
                    <span
                      className={`font-medium ${
                        isMine
                          ? 'text-[#1D4ED8]'
                          : takenByOther
                          ? 'text-slate-500'
                          : 'text-[#16A34A]'
                      }`}
                    >
                      {isMine
                        ? '내 파트'
                        : takenByOther
                        ? `배정됨 (${slot.displayName})`
                        : '선택 가능'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{slot.specialty}</div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">표시 이름</label>
              <input
                type="text"
                required
                maxLength={LIMITS.DISPLAY_NAME_MAX}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">세부 담당 영역</label>
              <input
                type="text"
                required
                maxLength={LIMITS.SPECIALTY_MAX}
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-[#1D4ED8]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
            >
              닫기
            </button>
            <button
              type="submit"
              disabled={saving || !selectedMember || (selectedMember.isClaimed && selectedMember.uid !== currentUid)}
              className="px-4 py-2 text-xs font-medium text-white bg-[#1D4ED8] rounded-md hover:bg-[#1E40AF] disabled:opacity-50 cursor-pointer"
            >
              {saving ? '저장 중...' : '파트 정보 저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ProjectSettingsModalProps {
  project: Project;
  isOwner: boolean;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export function ProjectSettingsModal({
  project,
  isOwner,
  onClose,
  onToast,
}: ProjectSettingsModalProps) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [targetDate, setTargetDate] = useState(project.targetDate);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner || !name.trim()) return;
    setSaving(true);
    try {
      await updateProjectMetadata(project.id, { name, description, targetDate });
      onToast('프로젝트 설정이 업데이트되었습니다.');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
          <h3 className="text-base font-semibold text-slate-900">워크스페이스 설정</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">프로젝트명</label>
            <input
              type="text"
              required
              disabled={!isOwner}
              maxLength={LIMITS.PROJECT_NAME_MAX}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md disabled:bg-slate-50 focus:outline-none focus:border-[#1D4ED8]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">장비 개요</label>
            <textarea
              rows={2}
              disabled={!isOwner}
              maxLength={LIMITS.PROJECT_DESC_MAX}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md disabled:bg-slate-50 focus:outline-none focus:border-[#1D4ED8]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">목표 FAT / 납기일</label>
            <input
              type="date"
              required
              disabled={!isOwner}
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono tabular-nums border border-slate-200 rounded-md disabled:bg-slate-50 focus:outline-none focus:border-[#1D4ED8]"
            />
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500">팀 초대 코드 (최대 10명 참여)</div>
              <div className="text-sm font-mono font-bold tracking-widest text-slate-900 mt-0.5">
                {project.inviteCode}
              </div>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              접속 멤버 {project.memberUids.length}명
            </span>
          </div>

          {!isOwner && (
            <p className="text-xs text-slate-500">
              프로젝트 기본 정보 수정은 워크스페이스 생성자(Owner)만 가능합니다.
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
            >
              닫기
            </button>
            {isOwner && (
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-medium text-white bg-[#1D4ED8] rounded-md hover:bg-[#1E40AF] disabled:opacity-60 cursor-pointer"
              >
                {saving ? '저장 중...' : '변경 저장'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
