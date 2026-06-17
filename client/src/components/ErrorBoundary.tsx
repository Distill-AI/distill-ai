import { Component, type ReactNode } from 'react';
import logger from '../lib/logger';

const log = logger.child('ErrorBoundary');

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    log.error(error.message, { stack: error.stack, componentStack: info.componentStack });
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-screen items-center justify-center bg-gray-50">
            <div className="max-w-md rounded-lg border border-red-200 bg-white p-8 text-center shadow">
              <p className="text-lg font-semibold text-red-700">Something went wrong</p>
              <p className="mt-2 text-sm text-gray-500">{this.state.error.message}</p>
              <button
                className="mt-4 rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
                onClick={() => this.setState({ error: null })}
              >
                Try again
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
