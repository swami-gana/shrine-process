import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-bg text-text">
          <p className="text-[15px] font-[650] mb-2">Something went wrong</p>
          <p className="text-[13px] text-secondary text-center mb-4">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('shrine-cache')
              window.location.reload()
            }}
            className="px-4 py-2 rounded-lg bg-active-stroke text-white text-[15px]"
          >
            Clear cache and reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
