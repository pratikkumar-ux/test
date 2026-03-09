import React, { ErrorInfo, ReactNode } from "react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    public static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({
            errorInfo: errorInfo
        });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 bg-slate-950 p-8 text-white z-[9999] overflow-auto font-sans">
                    <div className="max-w-2xl mx-auto border border-red-500 rounded-2xl p-6 bg-slate-900 shadow-2xl">
                        <h1 className="text-3xl font-black text-red-500 mb-2">Application Crashed</h1>
                        <p className="text-slate-400 mb-6">A fatal runtime error occurred while rendering the UI.</p>

                        <div className="bg-black/50 p-6 rounded-xl border border-white/10 overflow-x-auto mb-6">
                            <p className="font-bold text-red-400 mb-2">{this.state.error?.message}</p>
                            <pre className="text-[10px] text-slate-500 font-mono whitespace-pre-wrap">
                                {this.state.error?.stack}
                            </pre>
                        </div>

                        <div className="bg-slate-800 p-4 rounded-xl">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-2">Component Stack</p>
                            <pre className="text-[10px] text-amber-500 font-mono whitespace-pre-wrap">
                                {this.state.errorInfo?.componentStack}
                            </pre>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
