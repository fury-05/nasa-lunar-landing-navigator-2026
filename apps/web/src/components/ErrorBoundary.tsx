import { Component, type ErrorInfo, type ReactNode } from "react";

/** Catches render errors so a bug in one view shows a message and a way out, not a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("View crashed:", error.message, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="rounded-card border border-bad/50 p-6">
        <h1 className="m-0 text-2xl">Something went wrong in this view</h1>
        <p className="mt-2 text-muted">
          The rest of the site still works. Reload the page to try again, or go back to the home
          page.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-11 rounded-cell border border-earth/60 px-4 text-sm text-earth hover:bg-white/10"
          >
            Reload this page
          </button>
          <a
            href="/"
            className="inline-flex min-h-11 items-center rounded-cell border border-white/20 px-4 text-sm text-ink no-underline hover:bg-white/10"
          >
            Home
          </a>
        </div>
      </div>
    );
  }
}
