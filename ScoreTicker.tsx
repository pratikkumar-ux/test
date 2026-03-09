import React, { useState, useEffect, useMemo } from 'react';
import { MatchState, WicketType, ExtrasType } from '../types';
import { Radio, Zap, Target, Users, Activity, Sun, Cloud, CloudRain, Wind, MapPin, Layers, Trophy, TrendingUp } from 'lucide-react';

interface ScoreTickerProps {
    matchState: MatchState;
    matchId?: string | null;
    className?: string;
}

const THEME_STYLES = {
    CLASSIC_BROADCAST: {
        wrapper: "bg-slate-900/95 border-t-2 border-white/10",
        label: "text-slate-400 font-medium uppercase tracking-[0.2em]",
        active: "text-white font-black",
        accent: "bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]",
        divider: "border-white/5",
        gradient: "from-slate-900/50 via-slate-800/20 to-transparent"
    },
    MINIMAL_TV_STRIP: {
        wrapper: "bg-slate-950/90 border-t border-slate-800",
        label: "text-slate-500 font-bold uppercase tracking-widest",
        active: "text-white font-black",
        accent: "bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.4)]",
        divider: "border-slate-800",
        gradient: "from-slate-950/40 via-transparent to-transparent"
    },
    PRO_INTERNATIONAL: {
        wrapper: "bg-gradient-to-r from-slate-900 via-slate-900 to-black border-t-4 border-amber-500 shadow-2xl",
        label: "text-amber-500/70 font-black uppercase tracking-[0.25em]",
        active: "text-white font-black font-outfit",
        accent: "bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.6)]",
        divider: "border-white/10",
        gradient: "from-amber-500/10 via-transparent to-transparent"
    },
    INDIAN_PRIME: {
        wrapper: "bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 border-t-2 border-amber-400 shadow-2xl",
        label: "text-amber-300 font-black italic tracking-wider",
        active: "text-white font-black italic font-outfit",
        accent: "bg-amber-400 text-black shadow-[0_0_20px_rgba(251,191,36,0.5)]",
        divider: "border-white/20",
        gradient: "from-amber-400/20 via-blue-500/10 to-transparent"
    },
    NIGHT_STADIUM_GLOW: {
        wrapper: "bg-slate-950/95 border-t border-emerald-500 shadow-[0_-15px_40px_rgba(16,185,129,0.15)]",
        label: "text-emerald-500/70 font-mono tracking-widest",
        active: "text-emerald-50 font-mono font-bold",
        accent: "bg-emerald-500 shadow-[0_0_15px_#10b981]",
        divider: "border-emerald-900/30",
        gradient: "from-emerald-500/5 via-transparent to-transparent"
    },
    FINALS_EDITION: {
        wrapper: "bg-black/95 border-t-4 border-red-600 shadow-[0_-20px_60px_rgba(220,38,38,0.3)]",
        label: "text-red-500 font-black uppercase tracking-[0.3em]",
        active: "text-white font-black uppercase tracking-tighter font-outfit",
        accent: "bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.6)]",
        divider: "border-white/10",
        gradient: "from-red-600/20 via-transparent to-transparent"
    }
};

const ScoreTicker: React.FC<ScoreTickerProps> = ({ matchState, matchId, className = "" }) => {
    const themeKey = (matchState.broadcastTheme as keyof typeof THEME_STYLES) || 'CLASSIC_BROADCAST';
    const theme = THEME_STYLES[themeKey] || THEME_STYLES.CLASSIC_BROADCAST;

    const [infoPage, setInfoPage] = useState(0);

    // Derived Data
    const striker = matchState.teamBatting.players.find(p => p.id === matchState.strikerId);
    const nonStriker = matchState.teamBatting.players.find(p => p.id === matchState.nonStrikerId);
    const bowler = matchState.teamBowling.players.find(p => p.id === matchState.currentBowlerId);

    const crr = useMemo(() => {
        const totalBalls = (matchState.oversBowled * 6) + matchState.ballsBowledInCurrentOver;
        return totalBalls > 0 ? ((matchState.totalRuns / totalBalls) * 6).toFixed(2) : "0.00";
    }, [matchState.totalRuns, matchState.oversBowled, matchState.ballsBowledInCurrentOver]);

    const partnership = useMemo(() => {
        let runs = 0;
        let balls = 0;
        for (let i = (matchState.allLogs?.length || 0) - 1; i >= 0; i--) {
            if (matchState.allLogs[i].wicketType !== WicketType.NONE) break;
            runs += (matchState.allLogs[i].runsScored + matchState.allLogs[i].extraRuns);
            if (matchState.allLogs[i].isLegalBall) balls++;
        }
        return { runs, balls };
    }, [matchState.allLogs, matchState.totalRuns]);

    useEffect(() => {
        const interval = setInterval(() => {
            let maxPages = 4; // Bats, Bowl, Timeline, Context
            if (matchState.weather) maxPages++;
            if (matchId) maxPages++;
            setInfoPage(prev => (prev + 1) % maxPages);
        }, 6000);
        return () => clearInterval(interval);
    }, [matchState.weather, matchId]);

    const formatMatchStatus = () => {
        if (matchState.isMatchOver) return <span className="flex items-center gap-2"><Trophy className="w-3 h-3 text-amber-500" /> {matchState.winner ? `${matchState.winner.toUpperCase()} WON` : "MATCH OVER"}</span>;
        if (matchState.inning === 2 && matchState.target) {
            const need = matchState.target - matchState.totalRuns;
            const balls = ((matchState.maxOvers * 6) - (matchState.oversBowled * 6 + matchState.ballsBowledInCurrentOver));
            return <span className="flex items-center gap-2"><TrendingUp className="w-3 h-3 text-cyan-400" /> {matchState.teamBatting.name.toUpperCase()} NEEDS {need} RUNS IN {balls} BALLS</span>;
        }
        return <span className="flex items-center gap-2 opacity-70">{matchState.teamBatting.name.toUpperCase()} 1ST INNINGS</span>;
    };

    return (
        <div className={`w-full overflow-hidden h-14 md:h-16 flex transition-all duration-700 backdrop-blur-2xl shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.9)] relative ${theme.wrapper} ${className}`}>
            {/* Ambient Background Gradient Glow */}
            <div className={`absolute inset-0 bg-gradient-to-r ${theme.gradient} opacity-50 pointer-events-none`}></div>

            {/* 1. MATCH CLUSTER (Fixed Left) */}
            <div className={`z-10 hidden md:flex items-center px-6 border-r ${theme.divider} min-w-[280px] bg-white/5 backdrop-blur-md`}>
                <div className="flex flex-col justify-center">
                    <div className={`text-[9px] ${theme.label} flex items-center gap-2`}>
                        <Radio className="w-2.5 h-2.5 animate-pulse text-red-500" />
                        {matchState.teamBatting.name} v {matchState.teamBowling.name}
                    </div>
                    <div className={`text-sm font-black whitespace-nowrap font-outfit ${theme.active}`}>
                        {matchState.inning === 1 ? '1ST INNINGS' : '2ND INNINGS | TARGET: ' + matchState.target}
                    </div>
                </div>
            </div>

            {/* 2. MAIN SCORE PANEL (The Heart of Ticker) */}
            <div className={`z-10 flex items-center px-8 gap-8 relative border-r ${theme.divider} bg-gradient-to-b from-white/5 to-transparent`}>
                <div className="flex items-center gap-4">
                    {/* Living Indicator Score */}
                    <div className={`flex items-baseline gap-1.5`}>
                        <span className={`text-3xl md:text-4xl font-black tabular-nums font-outfit tracking-tighter ${theme.active}`}>
                            {matchState.totalRuns}
                        </span>
                        <span className={`text-xl md:text-2xl font-bold opacity-30 ${theme.active}`}>
                            /{matchState.totalWickets}
                        </span>
                    </div>

                    {/* Overs Display with Custom Ring */}
                    <div className="flex flex-col items-center justify-center bg-white/5 px-3 py-1 rounded-xl border border-white/5">
                        <div className={`text-sm md:text-base font-black tabular-nums font-outfit ${theme.active}`}>
                            {matchState.oversBowled}.{matchState.ballsBowledInCurrentOver}
                        </div>
                        <div className={`text-[8px] font-black uppercase tracking-tighter opacity-50 ${theme.label}`}>Overs</div>
                    </div>
                </div>

                {/* Radar Ripple Live Pulse */}
                <div className="flex items-center justify-center relative w-4 h-4">
                    <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${theme.accent}`}></div>
                    <div className={`w-2 h-2 rounded-full z-10 ${theme.accent}`}></div>
                </div>
            </div>

            {/* 3. DYNAMIC METRIC AREA (The Rotating Info) */}
            <div className="z-10 flex-1 relative overflow-hidden">
                <div className="absolute inset-0 flex items-center px-8">

                    {/* BATS-INFO PAGE (Modernized) */}
                    {infoPage === 0 && (
                        <div className="flex items-center gap-10 animate-in slide-in-from-right duration-700 w-full group">
                            <div className="flex items-center gap-6">
                                <div className="flex flex-col">
                                    <div className={`text-sm md:text-base font-black flex items-center gap-2 font-outfit transition-transform group-hover:translate-x-1 ${theme.active}`}>
                                        <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> {striker?.name || 'Batsman'}
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 border border-amber-500/20`}>{crr} CRR</span>
                                    </div>
                                    <div className={`text-[11px] font-bold ${theme.label} opacity-80`}>
                                        <span className="text-white">{striker?.runs || 0}</span> runs <span className="opacity-50">({striker?.balls || 0}b)</span> • 4s:{striker?.fours || 0} 6s:{striker?.sixes || 0}
                                    </div>
                                </div>
                                <div className={`h-8 border-r ${theme.divider} opacity-40`}></div>
                                <div className="flex flex-col opacity-60 hover:opacity-100 transition-opacity">
                                    <div className={`text-xs md:text-sm font-bold ${theme.active}`}>
                                        {nonStriker?.name || 'Batsman'}
                                    </div>
                                    <div className={`text-[10px] font-medium ${theme.label}`}>
                                        {nonStriker?.runs || 0} ({nonStriker?.balls || 0})
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* BOWL-INFO PAGE (Modernized) */}
                    {infoPage === 1 && (
                        <div className="flex items-center gap-8 animate-in slide-in-from-right duration-700 w-full">
                            <div className="flex items-center gap-5">
                                <div className="p-2.5 bg-white/5 rounded-2xl border border-white/5">
                                    <Target className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div className="flex flex-col">
                                    <div className={`text-[9px] ${theme.label} mb-0.5`}>Current Bowler</div>
                                    <div className={`text-base md:text-lg font-black flex items-center gap-4 font-outfit ${theme.active}`}>
                                        {bowler?.name || 'Bowler'}
                                        <div className={`bg-white/10 px-3 py-0.5 rounded-lg text-[11px] font-black border border-white/5 flex items-center gap-2`}>
                                            {bowler?.wickets || 0}-{bowler?.runsConceded || 0}
                                            <span className="opacity-40 font-medium">({bowler?.oversBowled || 0}.{matchState.ballsBowledInCurrentOver})</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TIMELINE PAGE (Timeline Grid) */}
                    {infoPage === 2 && (
                        <div className="flex items-center gap-8 animate-in slide-in-from-right duration-700 w-full">
                            <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme.label} px-4 py-1.5 bg-white/5 rounded-lg border border-white/5`}>
                                This Over
                            </div>
                            <div className="flex gap-2">
                                {(!matchState.currentOverLogs || matchState.currentOverLogs.length === 0) ? (
                                    <div className="flex items-center gap-2 text-[10px] font-black opacity-30 italic">
                                        <div className="w-1.5 h-1.5 rounded-full bg-white opacity-50 animate-pulse"></div>
                                        Preparing for new over...
                                    </div>
                                ) : (
                                    matchState.currentOverLogs.map((log, i) => (
                                        <div key={i} className={`w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-black transition-all hover:scale-110 
                                            ${log.wicketType !== WicketType.NONE ? 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg shadow-red-600/40 ring-2 ring-white/20' :
                                                log.runsScored === 4 ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-600/30' :
                                                    log.runsScored === 6 ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-lg shadow-amber-500/40 ring-1 ring-white/20' :
                                                        'bg-slate-800 text-white/50 border border-white/5'}`}>
                                            {log.wicketType !== WicketType.NONE ? 'W' :
                                                log.extrasType === ExtrasType.WIDE ? 'WD' :
                                                    log.extrasType === ExtrasType.NO_BALL ? 'NB' :
                                                        log.runsScored}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* CONTEXT PAGE (Advanced Stats) */}
                    {infoPage === 3 && (
                        <div className="flex items-center gap-12 animate-in slide-in-from-right duration-700 w-full justify-between pr-10">
                            <div className="flex items-center gap-10">
                                <div className="flex flex-col">
                                    <span className={`text-[8px] font-black uppercase tracking-widest opacity-40 ${theme.label}`}>Partnership</span>
                                    <span className={`text-base font-black font-outfit ${theme.active}`}>{partnership.runs} <span className="text-[10px] font-bold opacity-50">({partnership.balls}b)</span></span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className={`text-[8px] font-black uppercase tracking-widest opacity-40 ${theme.label}`}>Current RR</span>
                                    <span className={`text-base font-black font-outfit ${theme.active}`}>{crr}</span>
                                </div>
                            </div>
                            <div className={`hidden lg:flex items-center px-4 py-2 bg-white/5 rounded-2xl border border-white/10 text-[11px] font-black ${theme.active} uppercase tracking-tight`}>
                                {formatMatchStatus()}
                            </div>
                        </div>
                    )}

                    {/* WEATHER (Smart Page) */}
                    {infoPage === 4 && matchState.weather && (
                        <div className="flex items-center gap-12 animate-in slide-in-from-right duration-700 w-full">
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col">
                                    <span className={`text-[9px] font-black uppercase opacity-40 ${theme.label}`}>Conditions</span>
                                    <div className="flex items-center gap-3">
                                        {matchState.weather.condition === 'Sunny' ? <Sun className="w-5 h-5 text-yellow-400" /> : <CloudRain className="w-5 h-5 text-blue-400" />}
                                        <span className={`text-base font-black font-outfit ${theme.active}`}>{matchState.weather.temp}°C • {matchState.weather.condition}</span>
                                    </div>
                                </div>
                            </div>
                            <div className={`h-8 border-r ${theme.divider} opacity-20`}></div>
                            <div className="flex flex-col">
                                <span className={`text-[9px] font-black uppercase opacity-40 ${theme.label}`}>Venue</span>
                                <span className={`text-sm font-bold ${theme.active}`}>{matchState.venue}</span>
                            </div>
                        </div>
                    )}

                    {/* MATCH INFO (ID & Venue) */}
                    {((infoPage === 4 && !matchState.weather) || infoPage === 5) && matchState.joinId && (
                        <div className="flex items-center gap-12 animate-in slide-in-from-right duration-700 w-full">
                            <div className="flex items-center gap-6">
                                <div className="p-2.5 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                                    <Trophy className="w-5 h-5 text-amber-500" />
                                </div>
                                <div className="flex flex-col">
                                    <span className={`text-[9px] font-black uppercase opacity-40 ${theme.label}`}>Match Identity</span>
                                    <div className={`text-base md:text-lg font-black flex items-center gap-4 font-outfit ${theme.active}`}>
                                        ID: <span className="text-amber-500 tracking-wider font-mono">{matchState.joinId}</span>
                                    </div>
                                </div>
                            </div>
                            <div className={`h-8 border-r ${theme.divider} opacity-20`}></div>
                            <div className="flex flex-col">
                                <span className={`text-[9px] font-black uppercase opacity-40 ${theme.label}`}>Ground</span>
                                <span className={`text-sm font-bold ${theme.active}`}>{matchState.venue || 'Live Match'}</span>
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* 4. BRANDING CLUSTER (Fixed Right) */}
            <div className={`hidden lg:flex items-center px-10 border-l ${theme.divider} bg-white/5`}>
                <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                        <span className="text-[10px] font-black text-white uppercase tracking-[0.4em]">LIVE</span>
                    </div>
                    {matchId && (
                        <div className="text-[9px] font-black text-amber-500 tracking-[0.1em] mb-0.5">
                            ID: {matchId}
                        </div>
                    )}
                    <span className="text-[8px] font-bold text-slate-500 tracking-widest uppercase">PRO-SCORER DIGITAL</span>
                </div>
            </div>

            <style>{`
                @keyframes slide-in-from-right {
                    from { transform: translateX(50px); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .rotate-animation {
                    animation: rotate-slow 15s linear infinite;
                }
                .animate-in {
                    animation-fill-mode: forwards;
                }
                .font-outfit {
                    font-family: 'Outfit', sans-serif;
                }
            `}</style>
        </div>
    );
};

export default ScoreTicker;
