import React from "react";

type Props = { children: React.ReactNode };
type State = { error?: Error };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = {};
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: any) { console.error("[ErrorBoundary]", error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-dvh grid place-items-center p-6">
        <div className="card p-6 max-w-lg">
          <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
          <div className="text-white/70 text-sm mb-4">{this.state.error.message}</div>
          <button className="btn btn-primary" onClick={() => location.assign("/")}>Go home</button>
        </div>
      </div>
    );
  }
}
