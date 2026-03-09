import React from 'react';
import { X, User, ChevronRight, Activity } from 'lucide-react';
import { MatchState, Team, WicketType } from '../types';

interface ScoreCardProps {
    team: Team;
    matchState: MatchState;
    onClose: () => void;
}

const ScoreCard: React.FC<ScoreCardProps> = ({ team, matchState, onClose }) => {
    return (
        <div className="fixed inset-0 glass-premium z-[200] flex flex-col font-sans">
            {/* Header */}
            <div className="bg-slate-950/40 p-8 border-b border-white/5 flex justify-between items-end backdrop-blur-xl">
                <div>
                    <h2 className="text-4xl font-black text-white italic font-heading tracking-tight uppercase">SCORECARD</h2>
                    <p className="text-[10px] text-brand-primary font-black uppercase tracking-[0.3em] mt-2">{team.name} INNINGS</p>
                </div>
                <button onClick={onClose} className="p-4 bg-slate-950/50 rounded-[28px] border border-white/10 text-white hover:bg-brand-primary hover:text-slate-950 transition-all shadow-xl active:scale-95">
                    <X className="w-8 h-8" />
                </button>
            </div>

            {/* Tabs / Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <section className="px-2">
                    <div className="flex justify-between items-end mb-6 px-4">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">BATTING ANALYSIS</h3>
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">R (B) • 4s • 6s • SR</span>
                    </div>
                    <div className="space-y-3">
                        {(team?.players || []).map((p, i) => (
                            <div key={i} className={`p-6 rounded-[32px] flex items-center justify-between border transition-all duration-300 ${p.onStrike ? 'bg-brand-primary/10 border-brand-primary/30 shadow-[0_0_20px_rgba(0,255,156,0.1)]' : 'bg-slate-950/30 border-white/5'}`}>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                                        <User className={`w-4 h-4 ${p.onStrike ? 'text-amber-500' : ''}`} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-white flex items-center gap-1">
                                            {p.name} {p.onStrike && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>}
                                        </div>
                                        <div className="text-[10px] text-slate-500">
                                            {p.isOut ? (
                                                p.wicketType === WicketType.BOWLED ? 'b Bowler' :
                                                    p.wicketType === WicketType.CAUGHT ? `c ${p.fielderName || 'Fielder'} b Bowler` :
                                                        p.wicketType === WicketType.LBW ? 'lbw b Bowler' :
                                                            p.wicketType === WicketType.RUN_OUT ? `run out (${p.fielderName || 'Fielder'})` :
                                                                p.wicketType === WicketType.STUMPED ? `st ${p.fielderName || 'Keeper'} b Bowler` :
                                                                    p.wicketType === WicketType.HIT_WICKET ? 'hit wicket b Bowler' :
                                                                        p.wicketType === WicketType.RETIRED_OUT ? 'retired out' :
                                                                            p.wicketType === WicketType.RETIRED_HURT ? 'retired hurt' :
                                                                                'Out'
                                            ) : 'Not Out'}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-black text-white">{p.runs} <span className="text-xs font-normal text-slate-500">({p.balls})</span></div>
                                    <div className="text-[10px] text-slate-500">{p.fours} • {p.sixes} • {p.balls ? ((p.runs / p.balls) * 100).toFixed(1) : '0.0'}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section>
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 px-2">Bowling</h3>
                    <div className="space-y-1">
                        {(matchState?.teamBowling?.players || []).filter(p => p.oversBowled > 0 || p.id === matchState?.currentBowlerId).map((p, i) => (
                            <div key={i} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                                        <Activity className="w-4 h-4 text-blue-500" />
                                    </div>
                                    <div className="text-sm font-bold text-white">{p.name}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-black text-white">{p.wickets}-{p.runsConceded}</div>
                                    <div className="text-[10px] text-slate-500">{p.oversBowled} Overs • {p.oversBowled ? (p.runsConceded / p.oversBowled).toFixed(2) : '0.0'} Econ</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {/* Summary Footer */}
            <div className="bg-slate-950/60 p-10 border-t border-white/5 backdrop-blur-2xl rounded-t-[48px] shadow-[0_-20px_60px_rgba(0,0,0,0.5)]">
                <div className="flex justify-between items-end">
                    <div>
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-3">INNINGS SUMMARY</div>
                        <div className="text-6xl font-black text-white italic font-heading tracking-tighter">
                            {matchState.totalRuns}<span className="text-brand-primary">/{matchState.totalWickets}</span>
                        </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                        <div className="text-sm font-black text-white italic">OVER {matchState.oversBowled}.{matchState.ballsBowledInCurrentOver} <span className="text-slate-600 mx-1">/</span> {matchState.maxOvers}</div>
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Extras: {matchState.allLogs.reduce((acc, l) => acc + l.extraRuns, 0)}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScoreCard;
