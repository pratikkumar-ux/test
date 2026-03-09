import React from 'react';
import { BallLog } from '../types';

interface WagonWheelProps {
    logs: BallLog[];
}

const WagonWheel: React.FC<WagonWheelProps> = ({ logs }) => {
    return (
        <div className="relative w-full aspect-square flex items-center justify-center">
            {/* Cricket Field (Outer Boundary) */}
            <div className="absolute inset-0 border-[3px] border-white/5 rounded-full bg-slate-950/40 shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] backdrop-blur-sm"></div>

            {/* 30 Yard Circle (Inner Boundary) */}
            <div className="absolute w-[60%] h-[60%] border border-white/10 rounded-full opacity-40 border-dashed"></div>

            {/* Pitch */}
            <div className="absolute w-5 h-14 bg-amber-900/10 border border-amber-950/30 rounded-sm backdrop-blur-md shadow-lg"></div>

            {/* Scoring Zones Labels */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 text-[8px] font-black text-slate-600 uppercase tracking-[0.4em] font-heading">Straight</div>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[8px] font-black text-slate-600 uppercase tracking-[0.4em] font-heading">Behind</div>
            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-600 uppercase tracking-[0.4em] font-heading rotate-90 origin-right">Off Side</div>
            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-600 uppercase tracking-[0.4em] font-heading -rotate-90 origin-left">Leg Side</div>

            {/* Shots */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none p-4" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="1.2" fill="#00FF9C" className="animate-pulse shadow-[0_0_10px_rgba(0,255,156,0.6)]" />
                {logs.filter(l => l.shotAngle !== undefined && l.runsScored > 0).map((log, i) => {
                    const angle = ((log.shotAngle ?? 0) - 90) * (Math.PI / 180);
                    const length = 35 + (log.runsScored * 2.5);
                    const x2 = 50 + Math.cos(angle) * length;
                    const y2 = 50 + Math.sin(angle) * length;

                    let color = '#475569'; // slate-600 for singles
                    if (log.runsScored === 4) color = '#00FF9C'; // mint for 4s
                    if (log.runsScored === 6) color = '#f59e0b'; // amber for 6s

                    return (
                        <line
                            key={i}
                            x1="50"
                            y1="50"
                            x2={x2}
                            y2={y2}
                            stroke={color}
                            strokeWidth={log.runsScored >= 4 ? "0.8" : "0.4"}
                            strokeOpacity={log.runsScored >= 4 ? "0.9" : "0.5"}
                            strokeDasharray={log.runsScored >= 4 ? "0" : "2 1"}
                            className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] transition-all duration-500"
                        />
                    );
                })}
            </svg>
        </div>
    );
};

export default WagonWheel;
