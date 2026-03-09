import React, { useState, useEffect } from 'react';
import { Calendar, Users, ChevronRight, Star, Plus, MapPin, Clock, Play, Bell, BellOff, ArrowRight, X } from 'lucide-react';
import { Tournament, ScheduledMatch } from '../types';
import db, { getVisibleEvents, toggleFollowTournament, cancelPreMatchEvent, auth } from '../services/firebaseService';
import { onSnapshot, query, collection, where, or } from 'firebase/firestore';
import AddEventModal from './AddEventModal';

interface EventDashboardProps {
    onSelectMatch?: (matchId: string, role: 'SCORER' | 'VIEWER') => void;
}

const EventDashboard: React.FC<EventDashboardProps> = ({ onSelectMatch }) => {
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [matches, setMatches] = useState<ScheduledMatch[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [followedTournaments, setFollowedTournaments] = useState<string[]>([]);

    const user = auth.currentUser;

    const fetchData = async () => {
        setLoading(true);
        const [tourneyData, matchData] = await Promise.all([
            getVisibleEvents('TOURNAMENT', user?.uid),
            getVisibleEvents('MATCH', user?.uid)
        ]);
        console.log("[Dashboard] Fetched Matches:", matchData.map((m: any) => ({ id: m.id, status: m.status })));
        setTournaments(tourneyData as Tournament[]);
        setMatches(matchData as ScheduledMatch[]);

        // Check which tournaments user follows
        if (user) {
            const followed = (tourneyData as Tournament[])
                .filter(t => t.followers?.includes(user.uid))
                .map(t => t.id);
            setFollowedTournaments(followed);
        }
        setLoading(false);
    };

    const isMounted = React.useRef(true);

    useEffect(() => {
        isMounted.current = true;
        if (!user) {
            setLoading(false);
            return;
        }

        // 1. Initial Data Fetch
        fetchData();

        // 2. Polling Strategy: Fetch every 30 seconds to bypass SDK streaming bugs (ID: ca9/b815)
        // This keeps the dashboard fresh without keeping problematic persistent streams alive.
        const intervalId = setInterval(() => {
            if (isMounted.current && user) {
                // Background fetch, don't trigger loading state to avoid UI flicker
                Promise.all([
                    getVisibleEvents('TOURNAMENT', user.uid),
                    getVisibleEvents('MATCH', user.uid)
                ]).then(([tourneyData, matchData]) => {
                    if (isMounted.current) {
                        setTournaments(tourneyData as Tournament[]);
                        setMatches(matchData as ScheduledMatch[]);
                    }
                }).catch(err => console.warn("[Dashboard] Polling error:", err));
            }
        }, 30000);

        return () => {
            isMounted.current = false;
            clearInterval(intervalId);
        };
    }, [user]);

    const handleFollow = async (tid: string) => {
        if (!user) {
            alert("Please login to follow events.");
            return;
        }
        const isFollowing = followedTournaments.includes(tid);
        const success = await toggleFollowTournament(tid, user.uid, isFollowing);
        if (success) {
            setFollowedTournaments(prev =>
                isFollowing ? prev.filter(id => id !== tid) : [...prev, tid]
            );
        }
    };

    const handleCancel = async (type: 'TOURNAMENT' | 'MATCH', id: string) => {
        if (!confirm("Are you sure you want to cancel this event? This action cannot be undone.")) return;

        try {
            const success = await cancelPreMatchEvent(type, id);
            if (success) {
                fetchData();
            }
        } catch (error) {
            alert("Failed to cancel event. Please try again.");
        }
    };

    const todayMatches = matches.filter(m => {
        const matchDate = new Date(m.time).toDateString();
        const today = new Date().toDateString();
        return matchDate === today && m.status !== 'COMPLETED' && m.status !== 'CANCELLED';
    });

    const upcomingMatches = matches.filter(m => {
        const matchDate = new Date(m.time);
        const now = new Date();
        return matchDate > now && matchDate.toDateString() !== now.toDateString() && m.status !== 'CANCELLED';
    });

    const activeTournaments = tournaments.filter(t => t.status !== 'CANCELLED');

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 pb-32">
                <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Loading Events...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 p-6 space-y-12 pb-32">
            {/* Header */}
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-5xl font-black text-white italic tracking-tighter font-heading uppercase">Match Center</h2>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em] mt-2">Discover • Track • Watch Live</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="p-4 bg-brand-primary rounded-[24px] text-slate-950 flex items-center gap-3 group hover:scale-105 transition-all active:scale-95 shadow-[0_10px_40px_rgba(0,255,156,0.2)]"
                >
                    <Plus className="w-6 h-6 font-black" />
                    <span className="font-black text-xs uppercase tracking-widest hidden md:block">Add Event</span>
                </button>
            </div>

            {/* LIVE / TODAY'S MATCHES */}
            {todayMatches.length > 0 && (
                <section className="space-y-8">
                    <div className="flex items-center gap-6">
                        <div className="px-4 py-1.5 bg-red-600 rounded-full text-[10px] font-black text-white animate-pulse tracking-widest uppercase shadow-[0_0_20px_rgba(220,38,38,0.4)]">LIVE & TODAY</div>
                        <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent"></div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {todayMatches.map(m => (
                            <div key={m.id} className="glass-premium border-white/5 rounded-[40px] p-8 hover:border-brand-primary/30 transition-all group relative overflow-hidden active:scale-[0.99]">
                                <div className="absolute top-0 right-0 w-48 h-48 bg-brand-primary/5 blur-[80px] -mr-16 -mt-16"></div>
                                <div className="flex justify-between items-start mb-8">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-brand-primary uppercase tracking-[0.3em] mb-1">{m.format}</span>
                                        <h3 className="text-2xl font-black text-white italic font-heading tracking-tight">{m.title}</h3>
                                    </div>
                                    <div className="bg-slate-950/40 px-4 py-2 rounded-2xl border border-white/5 flex flex-col items-end gap-1 backdrop-blur-md">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                                            <span className="text-xs font-black text-white font-mono">{new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        {m.joinId && (
                                            <div className="text-[9px] font-black text-amber-500/80 tracking-widest font-mono uppercase">ID: {m.joinId}</div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-6 mb-10">
                                    <div className="flex flex-col items-center flex-1 text-center group/team">
                                        <div className="w-20 h-20 bg-slate-900/50 rounded-[28px] mb-3 flex items-center justify-center border border-white/5 group-hover/team:border-brand-primary/30 transition-colors shadow-inner">
                                            <Users className="w-10 h-10 text-slate-500 group-hover/team:text-brand-primary transition-colors" />
                                        </div>
                                        <span className="font-black text-sm text-white uppercase tracking-wider">{m.teamA.name}</span>
                                    </div>
                                    <div className="text-2xl font-black text-slate-800 italic font-heading">VS</div>
                                    <div className="flex flex-col items-center flex-1 text-center group/team">
                                        <div className="w-20 h-20 bg-slate-900/50 rounded-[28px] mb-3 flex items-center justify-center border border-white/5 group-hover/team:border-brand-primary/30 transition-colors shadow-inner">
                                            <Users className="w-10 h-10 text-slate-500 group-hover/team:text-brand-primary transition-colors" />
                                        </div>
                                        <span className="font-black text-sm text-white uppercase tracking-wider">{m.teamB.name}</span>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-950/30 p-5 rounded-[28px] border border-white/5 backdrop-blur-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-slate-900/50 rounded-xl border border-white/5">
                                            <MapPin className="w-4 h-4 text-slate-500" />
                                        </div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest line-clamp-1">{m.location}</span>
                                    </div>
                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                        {user?.uid === m.creatorId && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleCancel('MATCH', m.id); }}
                                                className="p-3.5 rounded-[18px] bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all shadow-lg"
                                                title="Cancel Match"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                        {user?.uid === m.creatorId && m.status === 'SCHEDULED' && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onSelectMatch?.(m.id, 'SCORER'); }}
                                                className="flex-1 sm:flex-initial bg-brand-primary text-slate-950 px-8 py-3.5 rounded-[18px] font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-white transition-all shadow-xl shadow-brand-primary/10"
                                            >
                                                <Play className="w-3.5 h-3.5 fill-current" />
                                                START SCORING
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onSelectMatch?.(m.id, 'VIEWER'); }}
                                            className="flex-1 sm:flex-initial bg-white text-slate-950 px-8 py-3.5 rounded-[18px] font-black text-[10px] uppercase tracking-[0.15em] flex items-center justify-center gap-2 hover:bg-brand-primary transition-all shadow-xl"
                                        >
                                            {m.status === 'LIVE' ? <Play className="w-3.5 h-3.5 fill-current" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                            {m.status === 'LIVE' ? 'WATCH LIVE' : 'DETAILS'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* UPCOMING MATCHES */}
            {upcomingMatches.length > 0 && (
                <section className="space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="px-3 py-1 bg-slate-800 rounded-lg text-[10px] font-black text-slate-400 uppercase tracking-widest">Upcoming Matches</div>
                        <div className="h-px flex-1 bg-slate-800"></div>
                    </div>
                    <div className="space-y-3">
                        {upcomingMatches.map(m => (
                            <div key={m.id} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex items-center justify-between group hover:bg-slate-900 transition">
                                <div className="flex items-center gap-6">
                                    <div className="flex flex-col items-center min-w-[60px] border-r border-slate-800 pr-4">
                                        <span className="text-[10px] font-black text-slate-500 uppercase">{new Date(m.time).toLocaleDateString([], { month: 'short' })}</span>
                                        <span className="text-xl font-black text-white leading-none">{new Date(m.time).getDate()}</span>
                                    </div>
                                    <div>
                                        <h4 className="font-black text-sm text-white uppercase">{m.teamA.name} <span className="text-slate-600 mx-1">vs</span> {m.teamB.name}</h4>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 uppercase tracking-widest">
                                                <Clock className="w-3 h-3" /> {new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 uppercase tracking-widest">
                                                <MapPin className="w-3 h-3" /> {m.location}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {user?.uid === m.creatorId && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleCancel('MATCH', m.id); }}
                                            className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 transition"
                                            title="Cancel Match"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    )}
                                    <button className="p-2 rounded-xl text-slate-500 hover:text-amber-500 hover:bg-slate-800 transition">
                                        <Bell className="w-5 h-5" />
                                    </button>
                                    <button className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-slate-800 transition">
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* TOURNAMENTS */}
            <section className="space-y-6">
                <div className="flex items-center gap-4">
                    <div className="px-3 py-1 bg-amber-500 rounded-lg text-[10px] font-black text-black uppercase tracking-widest">Tournaments</div>
                    <div className="h-px flex-1 bg-slate-800"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeTournaments.map(t => (
                        <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden group active:scale-[0.98] transition flex flex-col h-full relative">
                            {t.status === 'ONGOING' && (
                                <div className="absolute top-4 left-4 z-10 bg-green-500 text-black px-2 py-0.5 rounded text-[10px] font-black animate-pulse">ONGOING</div>
                            )}

                            <div className="h-40 bg-gradient-to-br from-slate-800 to-slate-900 relative p-6 flex flex-col justify-end shrink-0">
                                <div className="absolute top-4 right-4 z-10 flex gap-2">
                                    {user?.uid === t.creatorId && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleCancel('TOURNAMENT', t.id); }}
                                            className="p-2 rounded-xl backdrop-blur-md bg-red-500/20 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition"
                                            title="Cancel Tournament"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleFollow(t.id); }}
                                        className={`p-2 rounded-xl backdrop-blur-md transition ${followedTournaments.includes(t.id) ? 'bg-amber-500 text-black' : 'bg-black/40 text-white hover:bg-white/10'}`}
                                    >
                                        {followedTournaments.includes(t.id) ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                                    </button>
                                </div>
                                <h3 className="text-xl font-black text-white leading-tight italic">{t.name}</h3>
                                <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold mt-1">{t.organizer}</p>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="flex justify-between items-end">
                                    <div className="flex gap-6">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Teams</span>
                                            <span className="text-lg font-black text-white">{t.teams}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Matches</span>
                                            <span className="text-lg font-black text-white">{t.matches}</span>
                                        </div>
                                    </div>
                                    <button className="p-3 bg-slate-800 rounded-2xl group-hover:bg-amber-500 group-hover:text-black transition shadow-lg">
                                        <ArrowRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Empty States */}
            {tournaments.length === 0 && matches.length === 0 && (
                <div className="bg-slate-900 rounded-[40px] p-20 text-center border border-slate-800 border-dashed">
                    <div className="w-20 h-20 bg-slate-800 rounded-3xl mx-auto flex items-center justify-center mb-6 border border-slate-700">
                        <Calendar className="w-10 h-10 text-slate-600" />
                    </div>
                    <h3 className="text-2xl font-black text-white italic">No Events Found</h3>
                    <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-2 max-w-xs mx-auto">Be the first to create a tournament or schedule a match!</p>
                </div>
            )}

            {showAddModal && <AddEventModal onClose={() => setShowAddModal(false)} onSuccess={fetchData} />}
        </div>
    );
};

export default EventDashboard;
