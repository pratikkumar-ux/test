import React from 'react';
import { Power, SkipForward, X, AlertCircle } from 'lucide-react';
import { MatchState } from '../types';

interface MatchActionsProps {
    matchState: MatchState;
    onEndInnings: () => void;
    onEndMatch: () => void;
    onClose: () => void;
}

const MatchActions: React.FC<MatchActionsProps> = ({ matchState, onEndInnings, onEndMatch, onClose }) => {
    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[250] flex items-end justify-center">
            <div className="w-full bg-slate-900 border-t border-slate-800 rounded-t-[40px] p-8 space-y-8 animate-in slide-in-from-bottom duration-300">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white">Match Controls</h3>
                    <button onClick={onClose} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-4">
                    {!matchState.isMatchOver && (
                        <button
                            onClick={onEndInnings}
                            className="w-full bg-slate-800 hover:bg-slate-750 text-white p-6 rounded-3xl flex items-center justify-between group transition active:scale-95 border border-slate-700/50"
                        >
                            <div className="flex items-center gap-4 text-left">
                                <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center">
                                    <SkipForward className="w-6 h-6 text-amber-500" />
                                </div>
                                <div>
                                    <div className="font-bold">End Innings</div>
                                    <div className="text-xs text-slate-500">Declarations or end of allocated overs</div>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-600 group-hover:translate-x-1 transition-transform" />
                        </button>
                    )}

                    <button
                        onClick={onEndMatch}
                        className="w-full bg-red-600/10 hover:bg-red-600/20 text-red-500 p-6 rounded-3xl flex items-center justify-between group transition active:scale-95 border border-red-500/20"
                    >
                        <div className="flex items-center gap-4 text-left">
                            <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center">
                                <Power className="w-6 h-6 text-red-500" />
                            </div>
                            <div>
                                <div className="font-bold">Abandon Match</div>
                                <div className="text-xs text-red-500/60">Finalize match and record outcome now</div>
                            </div>
                        </div>
                        <AlertCircle className="w-5 h-5 opacity-40" />
                    </button>
                </div>

                <div className="p-4 bg-slate-800/30 rounded-2xl border border-slate-800 text-center">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Inning Status</p>
                    <div className="text-sm font-semibold text-slate-300">
                        {matchState.inning === 1 ? 'First Inning in progress' : 'Chasing ' + matchState.target + ' runs'}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Internal Helper for MatchActions
const ChevronRight = ({ className }: { className?: string }) => (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m9 18 6-6-6-6" />
    </svg>
);

export default MatchActions;
