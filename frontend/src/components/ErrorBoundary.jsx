import { Component } from 'react';

/** Catches render errors so a bug shows a message instead of a blank white page. */
export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }

  static getDerivedStateFromError(error) { return { error }; }

  componentDidCatch(error, info) { console.error('UI crashed:', error, info?.componentStack); }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="container page narrow center">
        <h1>Something went wrong</h1>
        <p className="muted">Please refresh the page. If it keeps happening, contact support.</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload page</button>
      </div>
    );
  }
}
