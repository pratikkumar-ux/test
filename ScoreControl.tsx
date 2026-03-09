import React from 'react';
import { RotateCcw, UserMinus, Palette, Check, X } from 'lucide-react';
import { ExtrasType, MatchState } from '../types';

interface ScoreControlProps {
    onRun: (runs: number, angle?: number) => void;
    onExtra: (type: ExtrasType) => void;
    onWicket: (angle?: number) => void;
    onUndo: () => void;
    onThemeChange?: (theme: MatchState['broadcastTheme']) => void;
    currentTheme?: MatchState['broadcastTheme'];
    disabled?: boolean;
}

const THEMES: { id: MatchState['broadcastTheme']; name: string; color: string }[] = [
    { id: 'CLASSIC_BROADCAST', name: 'Classic TV', color: 'bg-slate-800' },
    { id: 'PRO_INTERNATIONAL', name: 'Pro Intl', color: 'bg-amber-600' },
    { id: 'INDIAN_PRIME', name: 'Prime Blue', color: 'bg-blue-700' },
    { id: 'NIGHT_STADIUM_GLOW', name: 'Night Glow', color: 'bg-emerald-600' },
    { id: 'FINALS_EDITION', name: 'Finals Red', color: 'bg-red-600' },
    { id: 'MINIMAL_TV_STRIP', name: 'Minimalist', color: 'bg-slate-950' },
];

const ScoreControl: React.FC<ScoreControlProps> = ({ onRun, onExtra, onWicket, onUndo, onThemeChange, currentTheme, disabled }) => {
    const [showShotSelector, setShowShotSelector] = React.useState(false);
    const [showThemeSelector, setShowThemeSelector] = React.useState(false);
    const [pendingAction, setPendingAction] = React.useState<{ type: 'RUN' | 'WICKET', value?: number } | null>(null);

    const triggerAction = (type: 'RUN' | 'WICKET', value?: number) => {
        setPendingAction({ type, value });
        setShowShotSelector(true);
    };

    const handleShotSelect = (angle: number) => {
        if (pendingAction?.type === 'RUN') {
            onRun(pendingAction.value ?? 0, angle);
        } else if (pendingAction?.type === 'WICKET') {
            onWicket(angle);
        }
        setShowShotSelector(false);
        setPendingAction(null);
    };

    const ThemeSelector = () => (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setShowThemeSelector(false)} />
            <div className="w-full max-w-md glass-premium rounded-[2.5rem] border border-slate-700/50 shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden relative z-10 animate-slide-up">
                <div className="p-8 border-b border-slate-800/50 bg-slate-900/30 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black text-white font-outfit tracking-tight">Ticker Theme</h3>
                        <p className="text-[10px] text-cyan-400 font-bold tracking-[0.2em] uppercase mt-1">Broadcast Styles</p>
                    </div>
                    <button onClick={() => setShowThemeSelector(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                <div className="p-6 grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                    {THEMES.map((theme) => (
                        <button
                            key={theme.id}
                            onClick={() => {
                                onThemeChange?.(theme.id);
                                setShowThemeSelector(false);
                            }}
                            className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-3 group relative overflow-hidden ${currentTheme === theme.id
                                    ? 'border-cyan-500 bg-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-800'
                                }`}
                        >
                            <div className={`w-12 h-12 rounded-xl ${theme.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                                {currentTheme === theme.id ? <Check className="w-6 h-6 text-white" /> : <Palette className="w-6 h-6 text-white/50" />}
                            </div>
                            <span className={`text-xs font-bold tracking-wide ${currentTheme === theme.id ? 'text-cyan-400' : 'text-slate-400'}`}>
                                {theme.name}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );

    const ShotSelector = () => (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="glass-premium p-8 rounded-[2rem] border border-slate-700/50 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] flex flex-col items-center max-w-sm w-[90vw] animate-slide-up">
                <div className="text-center mb-8">
                    <h3 className="text-white font-bold text-xl font-outfit tracking-tight">Shot Direction</h3>
                    <p className="text-cyan-400/80 text-xs font-medium uppercase tracking-[0.2em] mt-1">Tap Radar to Select</p>
                </div>

                <div
                    className="w-72 h-72 rounded-full border border-slate-700/50 relative bg-slate-900/50 cursor-crosshair active:scale-[0.98] transition-all shadow-inner overflow-hidden group"
                    onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left - rect.width / 2;
                        const y = e.clientY - rect.top - rect.height / 2;

                        let angle = Math.atan2(y, x) * (180 / Math.PI);
                        angle += 90;
                        if (angle < 0) angle += 360;
                        handleShotSelect(angle);
                    }}
                >
                    <div className="absolute inset-0 rounded-full border border-cyan-500/10 scale-90 group-hover:scale-100 transition-transform duration-500"></div>
                    <div className="absolute inset-0 rounded-full border border-cyan-500/20 scale-75 group-hover:scale-90 transition-transform duration-500 delay-75"></div>
                    <div className="absolute inset-0 rounded-full border border-cyan-500/30 scale-50 group-hover:scale-75 transition-transform duration-500 delay-150"></div>

                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-36 bg-gradient-to-b from-amber-900/40 via-amber-800/20 to-amber-900/40 rounded-full border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[40%] w-2 h-0.5 bg-white/50 rounded-full"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-[40%] w-2 h-0.5 bg-white/50 rounded-full"></div>

                    <div className="absolute inset-0 rounded-full border border-white/5"></div>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-3 text-[9px] text-cyan-400/60 font-black uppercase tracking-widest bg-slate-950/80 px-2 py-0.5 rounded-full">Long Off</div>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-3 text-[9px] text-cyan-400/60 font-black uppercase tracking-widest bg-slate-950/80 px-2 py-0.5 rounded-full">Long On</div>
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-6 text-[9px] text-cyan-400/60 font-black uppercase tracking-widest bg-slate-950/80 px-2 py-0.5 rounded-full rotate-[-90deg]">Cover</div>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 text-[9px] text-cyan-400/60 font-black uppercase tracking-widest bg-slate-950/80 px-2 py-0.5 rounded-full rotate-90">Mid Wicket</div>

                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.8)]"></div>
                </div>

                <button
                    onClick={() => setShowShotSelector(false)}
                    className="mt-8 px-6 py-2.5 rounded-xl text-xs text-slate-400 font-bold border border-slate-700/50 hover:bg-slate-800/50 hover:text-white transition-all uppercase tracking-widest"
                >
                    Cancel Action
                </button>
            </div>
        </div>
    );

    return (
        <>
            {showShotSelector && <ShotSelector />}
            {showThemeSelector && <ThemeSelector />}
            <div className="glass-premium border-t border-slate-700/50 pb-8 pt-6 px-4 sm:p-8 shadow-[0_-30px_60px_rgba(0,0,0,0.8)] rounded-t-[2.5rem] relative before:absolute before:inset-0 before:bg-gradient-to-t before:from-slate-900/80 before:to-transparent before:rounded-t-[2.5rem] before:-z-10">

                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-slate-700/50 rounded-full mt-3"></div>

                {/* Scorer Controls Bar */}
                <div className="absolute -top-6 left-6 right-6 flex justify-between items-center z-30">
                    <button
                        onClick={() => setShowThemeSelector(true)}
                        disabled={disabled}
                        className="bg-slate-900 border border-slate-700/50 p-3.5 rounded-full shadow-2xl hover:bg-slate-800 hover:-translate-y-1 transition-all active:scale-90 disabled:opacity-30 flex items-center gap-2 group"
                        title="Change Ticker Theme"
                    >
                        <Palette className="w-5 h-5 text-cyan-400 group-hover:rotate-12 transition-transform" />
                        <span className="text-[10px] font-bold text-white pr-2">THEME</span>
                    </button>

                    <button
                        onClick={onUndo}
                        disabled={disabled}
                        className="bg-gradient-to-br from-amber-400 to-orange-500 border border-orange-300/30 p-3.5 rounded-full shadow-[0_10px_25px_rgba(245,158,11,0.4)] hover:shadow-[0_10px_30px_rgba(245,158,11,0.6)] hover:-translate-y-1 transition-all active:scale-90 disabled:opacity-30 disabled:hover:translate-y-0 group"
                        title="Undo Last Ball"
                    >
                        <RotateCcw className="w-5 h-5 text-amber-950 group-active:-rotate-45 transition-transform duration-300" strokeWidth={2.5} />
                    </button>
                </div>

                <div className="space-y-6 sm:space-y-8 mt-2 relative z-10">
                    <div className="flex justify-between gap-3 overflow-x-auto no-scrollbar pb-2 px-1">
                        {[0, 1, 2, 3, 4, 6].map(run => (
                            <button
                                key={run}
                                onClick={() => triggerAction('RUN', run)}
                                disabled={disabled}
                                className={`flex-1 min-w-[50px] sm:min-w-[64px] aspect-[4/5] sm:aspect-square rounded-2xl flex flex-col items-center justify-center transition-all duration-300 active:scale-95 disabled:opacity-30 border 
                                    ${run === 4 ? 'bg-gradient-to-br from-cyan-400 to-blue-600 border-cyan-300/30 text-white shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] hover:-translate-y-1' :
                                        run === 6 ? 'bg-gradient-to-br from-amber-400 to-orange-600 border-amber-300/30 text-white shadow-[0_0_25px_rgba(245,158,11,0.5)] hover:shadow-[0_0_35px_rgba(245,158,11,0.7)] hover:-translate-y-1 scale-105 origin-bottom' :
                                            'glass-panel border-slate-700/50 text-slate-200 hover:bg-slate-800/80 hover:border-slate-600/50 hover:text-white'}`}
                            >
                                <span className={`font-black font-outfit ${run === 6 ? 'text-4xl' : run === 4 ? 'text-3xl' : 'text-2xl sm:text-3xl'}`}>
                                    {run}
                                </span>
                                <span className={`text-[8px] font-bold uppercase tracking-widest mt-1 opacity-80 ${run >= 4 ? 'text-white' : 'text-slate-400'}`}>
                                    {run === 1 ? 'RUN' : 'RUNS'}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-[3] grid grid-cols-2 gap-3">
                            {[ExtrasType.WIDE, ExtrasType.NO_BALL, ExtrasType.BYE, ExtrasType.LEG_BYE].map(type => (
                                <button
                                    key={type}
                                    onClick={() => onExtra(type)}
                                    disabled={disabled}
                                    className="glass-panel border-slate-700/50 text-[10px] font-bold text-slate-300 py-3.5 rounded-xl hover:bg-slate-800/80 hover:text-white transition-all active:scale-95 disabled:opacity-30 uppercase tracking-[0.15em] hover:border-slate-600/50 shadow-sm"
                                >
                                    {type.replace('_', ' ')}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => triggerAction('WICKET')}
                            disabled={disabled}
                            className="flex-[2] bg-gradient-to-br from-red-500 to-rose-700 border border-red-400/30 rounded-2xl flex flex-col items-center justify-center gap-1.5 group active:scale-95 disabled:opacity-30 shadow-[0_10px_20_rgba(239,68,68,0.3)] hover:shadow-[0_15px_30px_rgba(239,68,68,0.5)] transition-all hover:-translate-y-1"
                        >
                            <UserMinus className="w-6 h-6 sm:w-7 sm:h-7 text-white group-hover:scale-110 transition-transform duration-300" strokeWidth={2.5} />
                            <span className="text-[10px] sm:text-xs font-black text-rose-100 uppercase tracking-[0.25em]">OUT!</span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ScoreControl;
