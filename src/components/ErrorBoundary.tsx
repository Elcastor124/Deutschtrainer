// Si algo falla al pintar una pantalla, nunca queda en blanco: se muestra el error y cómo seguir.
import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; onReset?: () => void; resetLabel?: string }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error) { console.error('[ui] error de pantalla:', error); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="home" role="alert">
        <h2 className="h2">Algo ha fallado en esta pantalla</h2>
        <p className="err-msg">{this.state.error.message || 'Error inesperado.'}</p>
        <p className="dim">Tu progreso está guardado en el servidor.</p>
        <div className="row">
          <button className="btn primary" onClick={() => location.reload()}>Recargar</button>
          {this.props.onReset && <button className="btn" onClick={() => { this.setState({ error: null }); this.props.onReset?.(); }}>{this.props.resetLabel ?? 'Volver a empezar'}</button>}
        </div>
      </div>
    );
  }
}
