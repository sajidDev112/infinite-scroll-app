import { Component } from 'react';

/** Shows a recovery screen instead of a blank page when a render error occurs. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ui] render error', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid h-full place-items-center p-8">
        <div className="max-w-md text-center">
          <p className="section-title text-rose-300">Something went wrong</p>
          <h1 className="mt-2 text-xl font-semibold text-white">This screen hit an unexpected error.</h1>
          <p className="mt-2 text-sm text-ink-400">Changes saved before this point are safe. Reload to continue.</p>
          <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-ink-900 p-3 text-left text-xs text-rose-200">{String(this.state.error?.message || this.state.error)}</pre>
          <button type="button" onClick={() => window.location.reload()} className="mt-6 h-10 rounded-lg bg-accent-500 px-4 text-sm font-medium text-white hover:bg-accent-600">
            Reload
          </button>
        </div>
      </div>
    );
  }
}
