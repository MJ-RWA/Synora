import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong. Please try again later.";
      let isFirestoreError = false;
      
      try {
        if (this.state.error?.message) {
          const parsedError = JSON.parse(this.state.error.message);
          if (parsedError.error && parsedError.operationType) {
            errorMessage = `Firestore Error: ${parsedError.error} during ${parsedError.operationType} on ${parsedError.path}`;
            isFirestoreError = true;
          } else if (parsedError.error && parsedError.error.includes('insufficient permissions')) {
            errorMessage = "You don't have permission to perform this action or view this content.";
          }
        }
      } catch {
        // Not a JSON error, use default
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#050505] p-4">
          <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-[40px] p-8 md:p-12 backdrop-blur-xl shadow-2xl text-center">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="text-red-500" size={40} />
            </div>
            <h2 className="text-2xl font-black text-white mb-4">Application Error</h2>
            <p className="text-gray-400 mb-8 leading-relaxed">
              {errorMessage}
            </p>
            <button
              onClick={this.handleReset}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/20"
            >
              <RefreshCcw size={20} />
              Reload Application
            </button>
            {isFirestoreError && (
              <p className="mt-6 text-[10px] text-gray-600 uppercase tracking-widest font-bold">
                Check console for detailed error info
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
