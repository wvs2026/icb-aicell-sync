import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
  detail: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = {
    hasError: false,
    message: '',
    detail: '',
  };

  static getDerivedStateFromError(error: Error): State {
    let message = '예상치 못한 오류가 발생했습니다.';
    let detail = error.message || '';

    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed === 'object' && parsed.operationType) {
        if (String(parsed.error).includes('Quota exceeded')) {
          message = '일일 Firestore 무료 사용량을 초과했습니다.';
          detail = '다음 날 자정(태평양 표준시 기준)에 사용량이 초기화됩니다.';
        } else if (String(parsed.error).includes('permission') || String(parsed.error).includes('PERMISSION_DENIED')) {
          message = '워크스페이스 접근 권한을 확인할 수 없습니다.';
          detail = `작업: ${parsed.operationType} · 경로: ${parsed.path || '-'}`;
        } else {
          message = '데이터 동기화 중 오류가 발생했습니다.';
          detail = parsed.error;
        }
      }
    } catch {
      // Plain error string
    }

    return { hasError: true, message, detail };
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '', detail: '' });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg p-8">
            <div className="flex items-center gap-3 text-[#DC2626] mb-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h2 className="text-base font-semibold text-slate-900">오류 안내</h2>
            </div>
            <p className="text-sm text-slate-800 leading-relaxed mb-2">{this.state.message}</p>
            {this.state.detail && (
              <p className="text-xs font-mono text-slate-500 bg-slate-50 border border-slate-200 rounded p-3 mb-6 break-all">
                {this.state.detail}
              </p>
            )}
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#1D4ED8] rounded-md hover:bg-[#1E40AF] transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              화면 새로고침
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
