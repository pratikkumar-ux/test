import React, { useState } from 'react';
import { Users, MapPin, Clock, ArrowRight, ChevronLeft, Check, Camera, Crosshair } from 'lucide-react';

interface MatchSetupWizardProps {
    onStartMatch: (config: any) => void | Promise<void>;
    onCancel: () => void;
}

const MatchSetupWizard: React.FC<MatchSetupWizardProps> = ({ onStartMatch, onCancel }) => {
    const [step, setStep] = useState(1);
    const [config, setConfig] = useState({
        teamA: 'Team Alpha',
        teamALogo: null as string | null,
        teamB: 'Team Beta',
        teamBLogo: null as string | null,
        overs: 5,
        ballType: 'TENNIS',
        venue: '',
        venueLocation: '',
        tossWinner: '',
        tossDecision: 'BAT',
        striker: '',
        nonStriker: '',
        bowler: ''
    });

    const nextStep = () => setStep(s => s + 1);
    const prevStep = () => setStep(s => s - 1);

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, team: 'teamALogo' | 'teamBLogo') => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setConfig(prev => ({ ...prev, [team]: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const getCurrentLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                const { latitude, longitude } = position.coords;
                const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
                setConfig(prev => ({ ...prev, venueLocation: mapsUrl }));
                // Ideally, you'd reverse geocode here to get the venue name
                if (!config.venue) setConfig(p => ({ ...p, venue: `Lat: ${latitude.toFixed(4)}, Long: ${longitude.toFixed(4)}` }));
            }, (error) => {
                alert("Could not fetch location: " + error.message);
            });
        } else {
            alert("Geolocation is not supported by this browser.");
        }
    };

    const renderStep1 = () => (
        <div className="space-y-6 animate-fade-in">
            <h3 className="text-2xl font-bold text-white mb-2 font-outfit">Teams & Venue</h3>
            <p className="text-sm text-slate-400 mb-6">Let's set up the competing teams and match location.</p>

            <div className="space-y-5">
                {/* Team A Input */}
                <div className="glass-panel p-5 rounded-2xl border border-slate-700/50 hover:border-cyan-500/30 transition-all duration-300">
                    <div className="flex justify-between items-center mb-3">
                        <label className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Team Alpha</label>
                        <label className="cursor-pointer group">
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoUpload(e, 'teamALogo')} />
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 group-hover:text-cyan-400 transition-colors">
                                <Camera className="w-3.5 h-3.5" /> {config.teamALogo ? 'Change Logo' : 'Upload Logo'}
                            </div>
                        </label>
                    </div>
                    <div className="flex gap-4 items-center">
                        {config.teamALogo ? (
                            <img src={config.teamALogo} alt="Logo" className="w-12 h-12 rounded-xl object-cover border-2 border-slate-700 shadow-lg shadow-black/50" />
                        ) : (
                            <div className="w-12 h-12 rounded-xl border border-dashed border-slate-600 flex items-center justify-center bg-slate-800/50">
                                <Users className="w-5 h-5 text-slate-500" />
                            </div>
                        )}
                        <input
                            className="w-full bg-transparent text-white font-bold text-lg outline-none placeholder:text-slate-600"
                            placeholder="Enter Team A Name"
                            value={config.teamA}
                            onChange={e => setConfig({ ...config, teamA: e.target.value })}
                        />
                    </div>
                </div>

                {/* Team B Input */}
                <div className="glass-panel p-5 rounded-2xl border border-slate-700/50 hover:border-orange-500/30 transition-all duration-300">
                    <div className="flex justify-between items-center mb-3">
                        <label className="cursor-pointer group">
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoUpload(e, 'teamBLogo')} />
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 group-hover:text-orange-400 transition-colors">
                                {config.teamBLogo ? 'Change Logo' : 'Upload Logo'} <Camera className="w-3.5 h-3.5" />
                            </div>
                        </label>
                        <label className="text-xs font-bold text-orange-400 uppercase tracking-widest">Team Beta</label>
                    </div>
                    <div className="flex gap-4 items-center flex-row-reverse text-right">
                        {config.teamBLogo ? (
                            <img src={config.teamBLogo} alt="Logo" className="w-12 h-12 rounded-xl object-cover border-2 border-slate-700 shadow-lg shadow-black/50" />
                        ) : (
                            <div className="w-12 h-12 rounded-xl border border-dashed border-slate-600 flex items-center justify-center bg-slate-800/50">
                                <Users className="w-5 h-5 text-slate-500" />
                            </div>
                        )}
                        <input
                            className="w-full bg-transparent text-white font-bold text-lg outline-none placeholder:text-slate-600 text-right"
                            placeholder="Enter Team B Name"
                            value={config.teamB}
                            onChange={e => setConfig({ ...config, teamB: e.target.value })}
                        />
                    </div>
                </div>

                {/* Venue Input */}
                <div className="space-y-2 mt-4">
                    <div className="relative group">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 group-focus-within:text-cyan-400 transition-colors" />
                        <input
                            className="w-full bg-slate-900/80 border border-slate-700 text-white pl-12 pr-12 py-4 rounded-xl outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all shadow-inner"
                            placeholder="Match Venue (e.g., Lords Ground)"
                            value={config.venue}
                            onChange={e => setConfig({ ...config, venue: e.target.value })}
                        />
                        <button
                            onClick={getCurrentLocation}
                            className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all ${config.venueLocation ? 'text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 shadow-[0_0_10px_rgba(34,211,238,0.2)]' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                            title="Auto-detect Location"
                        >
                            <Crosshair className="w-4 h-4" />
                        </button>
                    </div>
                    {config.venueLocation && (
                        <p className="text-[10px] text-cyan-400 flex items-center gap-1.5 ml-2 font-medium">
                            <Check className="w-3 h-3" /> Location securely pinned
                        </p>
                    )}
                </div>
            </div>

            <button
                onClick={nextStep}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-bold py-4 rounded-xl mt-6 shadow-[0_0_20px_rgba(34,211,238,0.2)] hover:shadow-[0_0_25px_rgba(34,211,238,0.4)] transition-all flex items-center justify-center gap-2 group"
            >
                Configure Match Rules <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-6 animate-fade-in">
            <h3 className="text-2xl font-bold text-white mb-2 font-outfit">Match Rules</h3>
            <p className="text-sm text-slate-400 mb-6">Define the overs, ball type, and toss decision.</p>

            <div className="space-y-5">
                {/* Overs Slider */}
                <div className="glass-panel p-5 rounded-2xl border border-slate-700/50">
                    <div className="flex justify-between items-end mb-5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Clock className="w-4 h-4 text-cyan-400" /> Match Length
                        </label>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold text-white font-outfit">{config.overs}</span>
                            <span className="text-sm text-slate-500 font-medium">overs</span>
                        </div>
                    </div>
                    <div className="relative pt-1">
                        <input
                            type="range"
                            min="1"
                            max="50"
                            step="1"
                            value={config.overs}
                            onChange={(e) => setConfig({ ...config, overs: parseInt(e.target.value) })}
                            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                            style={{
                                background: `linear-gradient(to right, #06b6d4 ${(config.overs / 50) * 100}%, #1e293b ${(config.overs / 50) * 100}%)`
                            }}
                        />
                        <div className="flex justify-between text-[10px] text-slate-500 mt-3 font-bold">
                            <span>T10 (10)</span>
                            <span>T20 (20)</span>
                            <span>ODI (50)</span>
                        </div>
                    </div>
                </div>

                {/* Ball Type */}
                <div className="glass-panel p-5 rounded-2xl border border-slate-700/50">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 block">Select Ball Type</label>
                    <div className="grid grid-cols-3 gap-3">
                        {['TENNIS', 'LEATHER', 'OTHER'].map((type) => (
                            <button
                                key={type}
                                onClick={() => setConfig({ ...config, ballType: type })}
                                className={`py-3 px-2 rounded-xl text-xs font-bold tracking-wide transition-all shadow-sm ${config.ballType === type ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white border-transparent shadow-[0_4px_15px_rgba(6,182,212,0.3)] scale-105' : 'bg-slate-800/50 border border-slate-700 text-slate-400 hover:bg-slate-700/50 hover:text-white'}`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Toss Section */}
                <div className="glass-panel p-6 rounded-2xl border border-slate-700/50 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-20" />
                    <h4 className="text-slate-300 font-bold mb-5 text-sm uppercase tracking-widest flex items-center justify-center gap-2">
                        <Users className="w-4 h-4 text-cyan-400" /> Toss Winner
                    </h4>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setConfig({ ...config, tossWinner: config.teamA })}
                            className={`flex-1 py-3.5 px-4 rounded-xl text-sm font-bold transition-all border ${config.tossWinner === config.teamA ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/50' : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                        >
                            <span className="truncate block">{config.teamA || 'Team Alpha'}</span>
                        </button>
                        <button
                            onClick={() => setConfig({ ...config, tossWinner: config.teamB })}
                            className={`flex-1 py-3.5 px-4 rounded-xl text-sm font-bold transition-all border ${config.tossWinner === config.teamB ? 'bg-orange-500/10 border-orange-500 text-orange-300 shadow-[0_0_15px_rgba(249,115,22,0.15)] ring-1 ring-orange-500/50' : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                        >
                            <span className="truncate block">{config.teamB || 'Team Beta'}</span>
                        </button>
                    </div>

                    {/* Expandable Decision Section */}
                    <div className={`mt-6 transition-all duration-300 overflow-hidden ${config.tossWinner ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="w-full h-px bg-slate-800 mb-5" />
                        <h4 className="text-slate-400 font-bold mb-3 text-xs uppercase tracking-widest">Elected To</h4>
                        <div className="flex bg-slate-900/80 p-1.5 rounded-xl border border-slate-700/50">
                            <button
                                onClick={() => setConfig({ ...config, tossDecision: 'BAT' })}
                                className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${config.tossDecision === 'BAT' ? 'bg-white text-black shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
                            >
                                🏏 Bat First
                            </button>
                            <button
                                onClick={() => setConfig({ ...config, tossDecision: 'BOWL' })}
                                className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${config.tossDecision === 'BOWL' ? 'bg-white text-black shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
                            >
                                🥎 Bowl First
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex gap-4 mt-8">
                <button onClick={prevStep} className="flex-1 glass-panel text-white font-bold py-4 rounded-xl border border-slate-700 hover:bg-slate-800 transition-colors">Back</button>
                <button
                    onClick={nextStep}
                    disabled={!config.tossWinner}
                    className="flex-[2] bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-bold py-4 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(34,211,238,0.2)] transition-all flex items-center justify-center gap-2 group"
                >
                    Opening Players <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </div>
    );

    const renderStep3 = () => (
        <div className="space-y-6 animate-fade-in">
            <h3 className="text-2xl font-bold text-white mb-2 font-outfit">Opening Set</h3>
            <p className="text-sm text-slate-400 mb-6">Enter the names of the starting batsmen and bowler.</p>

            <div className="space-y-4">
                <div className="glass-panel p-5 rounded-2xl border border-slate-700/50 focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/20 transition-all">
                    <label className="text-[10px] font-bold text-cyan-400 uppercase tracking-[0.2em] block mb-2 opacity-80">Striker (On-Strike)</label>
                    <input
                        className="w-full bg-transparent text-white font-bold outline-none text-xl placeholder:text-slate-600 placeholder:font-medium"
                        placeholder="Player Name"
                        value={config.striker}
                        onChange={e => setConfig({ ...config, striker: e.target.value })}
                        autoFocus
                    />
                </div>
                <div className="glass-panel p-5 rounded-2xl border border-slate-700/50 focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/20 transition-all">
                    <label className="text-[10px] font-bold text-cyan-400 uppercase tracking-[0.2em] block mb-2 opacity-80">Non-Striker</label>
                    <input
                        className="w-full bg-transparent text-white font-bold outline-none text-xl placeholder:text-slate-600 placeholder:font-medium"
                        placeholder="Player Name"
                        value={config.nonStriker}
                        onChange={e => setConfig({ ...config, nonStriker: e.target.value })}
                    />
                </div>

                <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent my-6" />

                <div className="glass-panel p-5 rounded-2xl border border-slate-700/50 focus-within:border-orange-500/50 focus-within:ring-1 focus-within:ring-orange-500/20 transition-all">
                    <label className="text-[10px] font-bold text-orange-400 uppercase tracking-[0.2em] block mb-2 opacity-80">Opening Bowler</label>
                    <input
                        className="w-full bg-transparent text-white font-bold outline-none text-xl placeholder:text-slate-600 placeholder:font-medium"
                        placeholder="Player Name"
                        value={config.bowler}
                        onChange={e => setConfig({ ...config, bowler: e.target.value })}
                    />
                </div>
            </div>

            <div className="flex gap-4 mt-10">
                <button onClick={prevStep} className="flex-1 glass-panel text-white font-bold py-4 rounded-xl border border-slate-700 hover:bg-slate-800 transition-colors">Back</button>
                <button
                    onClick={() => onStartMatch(config)}
                    disabled={!config.striker || !config.nonStriker || !config.bowler}
                    className="flex-[2] bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
                >
                    <span className="tracking-wide">COMMENCE MATCH</span>
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                        <Check className="w-4 h-4" />
                    </div>
                </button>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
            {/* Immersive Backdrop */}
            <div
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-md animate-fade-in"
                onClick={onCancel}
            />

            <div className="w-full max-w-xl glass-premium border border-slate-700/50 rounded-[2rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh] relative z-10 animate-slide-up">

                {/* Header Profile */}
                <div className="p-6 sm:p-8 pb-6 border-b border-slate-800/50 bg-slate-900/30">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <button onClick={onCancel} className="p-2 hover:bg-slate-800/50 rounded-full transition-colors group">
                                <ChevronLeft className="text-slate-400 w-6 h-6 group-hover:text-white transition-colors" />
                            </button>
                            <div>
                                <h2 className="font-bold text-white text-xl font-outfit tracking-tight">Setup Engine</h2>
                                <p className="text-[10px] text-cyan-500 font-bold tracking-[0.2em] uppercase">Pro-Scorer OS</p>
                            </div>
                        </div>

                        {/* Compact Step Indicator */}
                        <div className="flex items-center gap-2 bg-slate-950/50 px-3 py-1.5 rounded-full border border-slate-800">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex items-center">
                                    <div
                                        className={`w-2 h-2 rounded-full transition-all duration-300 ${step === i ? 'bg-cyan-500 w-6 shadow-[0_0_10px_rgba(6,182,212,0.5)]' :
                                            step > i ? 'bg-cyan-500/40' : 'bg-slate-700'
                                            }`}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Scrollable Setup Body */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-8 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                    {step === 3 && renderStep3()}
                </div>
            </div>
        </div>
    );
};

export default MatchSetupWizard;
