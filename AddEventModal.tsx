import React, { useState } from 'react';
import { X, Trophy, Calendar, Users, MapPin, Clock, Globe, Lock, CheckCircle2, ChevronRight, Plus, Copy } from 'lucide-react';
import { createPreMatchEvent, generateJoinId } from '../services/firebaseService';
import { auth } from '../services/firebaseService';

interface AddEventModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

const AddEventModal: React.FC<AddEventModalProps> = ({ onClose, onSuccess }) => {
    const [type, setType] = useState<'TOURNAMENT' | 'MATCH'>('MATCH');
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [createdEventId, setCreatedEventId] = useState<string | null>(null);

    const [form, setForm] = useState({
        name: '',
        teamA: '',
        teamB: '',
        date: '',
        time: '',
        format: 'T20',
        location: '',
        visibility: 'PUBLIC' as 'PUBLIC' | 'PRIVATE',
        teamsCount: 8,
        organizer: auth.currentUser?.displayName || 'Pro Scorer'
    });

    const handleCreate = async () => {
        setIsSubmitting(true);
        try {
            // Generate a standard robust ID for backend storage (MUST be lowercase for consistent Lookups)
            const eventId = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10) + Date.now().toString(36)).toLowerCase();
            const autoJoinId = generateJoinId();

            const eventData = type === 'MATCH' ? {
                id: eventId,
                title: form.name,
                teamA: { name: form.teamA },
                teamB: { name: form.teamB },
                time: `${form.date}T${form.time}:00`,
                location: form.location,
                format: form.format,
                visibility: form.visibility,
                creatorId: auth.currentUser?.uid || 'anonymous',
                creatorName: auth.currentUser?.displayName || 'System',
                status: 'SCHEDULED',
                joinId: autoJoinId
            } : {
                id: eventId,
                name: form.name,
                organizer: form.organizer,
                status: 'UPCOMING',
                teams: form.teamsCount,
                matches: Math.floor(form.teamsCount * 1.5), // Mock estimate
                banner: '',
                startDate: form.date,
                visibility: form.visibility,
                creatorId: auth.currentUser?.uid || 'anonymous',
                creatorName: auth.currentUser?.displayName || 'System',
                followers: [],
                joinId: autoJoinId
            };

            await createPreMatchEvent(type, eventData);
            setCreatedEventId(eventId);
            onSuccess();
            // Done automatically by success screen button
        } catch (error) {
            alert("Failed to create event. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in zoom-in duration-300">
            <div className="bg-slate-900 w-full max-w-2xl rounded-[40px] border border-slate-800 shadow-2xl overflow-hidden flex flex-col relative">
                {/* Header */}
                <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-md z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                            <Plus className="w-6 h-6 text-black" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white italic tracking-tight">ADD PRE-MATCH EVENT</h2>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                Step {step} of 2 • {type === 'MATCH' ? 'Single Match' : 'Tournament'}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-slate-800 rounded-full text-slate-400 transition hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-8 space-y-8 flex-1 overflow-y-auto max-h-[70vh] custom-scrollbar">
                    {step === 1 ? (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                            {/* Type Selector */}
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setType('MATCH')}
                                    className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-4 ${type === 'MATCH' ? 'bg-amber-500 border-amber-400 text-black' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                >
                                    <Calendar className="w-10 h-10" />
                                    <div className="text-center">
                                        <div className="font-black uppercase tracking-tighter">Single Match</div>
                                        <div className="text-[10px] font-bold opacity-60">1v1 Friendly or Official</div>
                                    </div>
                                </button>
                                <button
                                    onClick={() => setType('TOURNAMENT')}
                                    className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-4 ${type === 'TOURNAMENT' ? 'bg-amber-500 border-amber-400 text-black' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                >
                                    <Trophy className="w-10 h-10" />
                                    <div className="text-center">
                                        <div className="font-black uppercase tracking-tighter">Tournament</div>
                                        <div className="text-[10px] font-bold opacity-60">Leagues, Knockouts, Series</div>
                                    </div>
                                </button>
                            </div>

                            {/* Basic Details */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block italic">Event Name</label>
                                    <input
                                        type="text"
                                        placeholder={type === 'MATCH' ? "e.g., Weekend Friendly #1" : "e.g., Summer Smash 2026"}
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white focus:border-amber-500 outline-none transition font-bold"
                                    />
                                </div>

                                {type === 'MATCH' && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block italic">Team A</label>
                                            <input
                                                type="text"
                                                placeholder="Enter Name"
                                                value={form.teamA}
                                                onChange={e => setForm({ ...form, teamA: e.target.value })}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white focus:border-amber-500 outline-none transition font-bold text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block italic">Team B</label>
                                            <input
                                                type="text"
                                                placeholder="Enter Name"
                                                value={form.teamB}
                                                onChange={e => setForm({ ...form, teamB: e.target.value })}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white focus:border-amber-500 outline-none transition font-bold text-sm"
                                            />
                                        </div>
                                    </div>
                                )}

                                {type === 'TOURNAMENT' && (
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block italic">Participating Teams Count</label>
                                        <div className="flex items-center gap-4 bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4">
                                            <input
                                                type="range"
                                                min="2"
                                                max="64"
                                                value={form.teamsCount}
                                                onChange={e => setForm({ ...form, teamsCount: parseInt(e.target.value) })}
                                                className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                            />
                                            <span className="text-xl font-black text-white min-w-[40px]">{form.teamsCount}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => setStep(2)}
                                disabled={!form.name || (type === 'MATCH' && (!form.teamA || !form.teamB))}
                                className="w-full bg-slate-800 hover:bg-slate-750 text-white font-black py-5 rounded-3xl transition flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                            >
                                NEXT DETAILS <ChevronRight className="w-6 h-6" />
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block italic">Start Date</label>
                                    <div className="relative">
                                        <input
                                            type="date"
                                            value={form.date}
                                            onChange={e => setForm({ ...form, date: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white focus:border-amber-500 outline-none transition font-bold"
                                        />
                                        <Calendar className="absolute right-4 top-4 text-slate-500 w-5 h-5 pointer-events-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block italic">Start Time</label>
                                    <div className="relative">
                                        <input
                                            type="time"
                                            value={form.time}
                                            onChange={e => setForm({ ...form, time: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white focus:border-amber-500 outline-none transition font-bold"
                                        />
                                        <Clock className="absolute right-4 top-4 text-slate-500 w-5 h-5 pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block italic">Ground / Location</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Enter venue..."
                                            value={form.location}
                                            onChange={e => setForm({ ...form, location: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white focus:border-amber-500 outline-none transition font-bold"
                                        />
                                        <MapPin className="absolute right-4 top-4 text-slate-500 w-5 h-5" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block italic">Match Format</label>
                                    <select
                                        value={form.format}
                                        onChange={e => setForm({ ...form, format: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white focus:border-amber-500 outline-none transition font-bold appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_1.5rem_center]"
                                    >
                                        <option value="T20">T20 (20 Overs)</option>
                                        <option value="ODI">ODI (50 Overs)</option>
                                        <option value="Test">Multi-Day Test</option>
                                        <option value="50 Overs">Local 50 Overs</option>
                                        <option value="Other">Custom Format</option>
                                    </select>
                                </div>
                            </div>

                            {/* Visibility */}
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setForm({ ...form, visibility: 'PUBLIC' })}
                                    className={`p-5 rounded-2xl border-2 transition-all flex items-center gap-3 ${form.visibility === 'PUBLIC' ? 'bg-green-500 border-green-400 text-black' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                >
                                    <Globe className="w-5 h-5" />
                                    <div className="text-left">
                                        <div className="font-bold text-xs uppercase tracking-tighter leading-none">Public</div>
                                        <div className="text-[8px] font-bold opacity-60">Visible to everyone</div>
                                    </div>
                                </button>
                                <button
                                    onClick={() => setForm({ ...form, visibility: 'PRIVATE' })}
                                    className={`p-5 rounded-2xl border-2 transition-all flex items-center gap-3 ${form.visibility === 'PRIVATE' ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                >
                                    <Lock className="w-5 h-5" />
                                    <div className="text-left">
                                        <div className="font-bold text-xs uppercase tracking-tighter leading-none">Private</div>
                                        <div className="text-[8px] font-bold opacity-60">Invite only</div>
                                    </div>
                                </button>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button onClick={() => setStep(1)} className="flex-1 bg-slate-800 hover:bg-slate-750 text-white font-black py-5 rounded-3xl transition active:scale-95">BACK</button>
                                <button
                                    onClick={handleCreate}
                                    disabled={isSubmitting || !form.date || !form.time}
                                    className="flex-[2] bg-amber-500 hover:bg-amber-600 text-black font-black py-5 rounded-3xl shadow-xl shadow-amber-500/20 transition flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                                >
                                    {isSubmitting ? <RefreshCw className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
                                    CREATE {type}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {createdEventId && (
                    <div className="absolute inset-0 z-[50] bg-slate-900 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-300">
                        <div className="w-20 h-20 bg-green-500 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-green-500/20">
                            <CheckCircle2 className="w-10 h-10 text-black" />
                        </div>
                        <h2 className="text-3xl font-black text-white italic mb-2 tracking-tight uppercase">Event Created!</h2>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-8">Your {type.toLowerCase()} is ready for live scoring</p>

                        <div className="w-full max-w-xs bg-slate-950 border border-slate-800 rounded-3xl p-6 mb-8 text-center text-slate-400 font-medium">
                            You can generate a shareable Match ID from the dashboard when you are ready to start scoring.
                        </div>

                        <button
                            onClick={onClose}
                            className="w-full max-w-xs bg-amber-500 hover:bg-amber-600 text-black font-black py-5 rounded-3xl shadow-xl shadow-amber-500/20 transition active:scale-95"
                        >
                            GO TO DASHBOARD
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// Helper for spin icon
const RefreshCw: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" /></svg>
);

export default AddEventModal;
