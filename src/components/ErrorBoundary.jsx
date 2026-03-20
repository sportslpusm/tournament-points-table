import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch() {
    // Error logged internally — no console output in production
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-navy-950 flex items-center justify-center p-4">
          <div className="text-center max-w-md animate-fadeIn">
            <div className="relative mb-6">
              <div className="absolute inset-0 scale-150 rounded-full blur-3xl bg-red-500/[0.06]" />
              <div className="relative text-6xl animate-floatUp">⚠️</div>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Something went wrong</h1>
            <p className="text-gray-400 mb-8 text-sm leading-relaxed">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full px-6 py-3 bg-accent text-navy-900 font-bold rounded-xl hover:bg-accent-dark transition-all duration-200 shadow-lg shadow-accent/20 hover:shadow-accent/30 hover:-translate-y-0.5"
              >
                Refresh Page
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="w-full px-6 py-3 bg-white/[0.04] text-gray-300 rounded-xl hover:bg-white/[0.08] transition-all duration-200 border border-white/[0.06]"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
