import React, { useState, useEffect, useRef } from 'react';
import { X, Tv, Type, Layers, Eye, Radio, CheckCircle2, RefreshCw, Zap, Trophy, Club, Moon, Sunset, Monitor, Award, Layout, Smartphone, MapPin, CloudRain, Sun, Cloud, Wind, Activity, WifiOff, Copy } from 'lucide-react';
import Peer from 'peerjs';
import { MatchState } from '../types';
import { pushMatchState, listenToLiveMatch, SRS_CONFIG } from '../services/firebaseService';
import ScoreTicker from './ScoreTicker';
import { fetchWeather } from '../services/weatherService';

interface LiveHubProps {
    onClose?: () => void;
    matchState: MatchState | null;
    matchId: string | null;
    onUpdateMatch?: (state: Partial<MatchState>) => Promise<void>;
    userRole?: string;
    onLeaveMatch?: () => void;
}

const THEME_METADATA = {
    CLASSIC_BROADCAST: { name: 'Classic Broadcast', desc: 'Traditional TV-style ticker', icon: <Tv className="w-5 h-5 text-blue-300" /> },
    MINIMAL_TV_STRIP: { name: 'Minimal TV Strip', desc: 'Clean bottom-strip', icon: <Smartphone className="w-5 h-5 text-slate-500" /> },
    PITCH_GREEN: { name: 'Pitch Green', desc: 'Grass-toned background', icon: <Club className="w-5 h-5 text-green-300" /> },
    PRO_INTERNATIONAL: { name: 'Pro International', desc: 'ICC tournament-style', icon: <Monitor className="w-5 h-5 text-amber-500" /> },
    INDIAN_PRIME: { name: 'Indian Prime', desc: 'IPL-inspired bold colors', icon: <Zap className="w-5 h-5 text-amber-500" /> },
    NIGHT_STADIUM_GLOW: { name: 'Night Stadium', desc: 'Dark theme with neon', icon: <Moon className="w-5 h-5 text-amber-400" /> },
    BOUNDARY_FLASH: { name: 'Boundary Flash', desc: 'Special visual flash', icon: <Zap className="w-5 h-5 text-red-500" /> },
    CHAMPIONS_GOLD: { name: 'Champions Gold', desc: 'Trophy-match visual tone', icon: <Award className="w-5 h-5 text-amber-500" /> },
    ULTRA_CLEAN_PRO: { name: 'Ultra Clean Pro', desc: 'Broadcaster-grade UI', icon: <Layout className="w-5 h-5 text-slate-400" /> },
    FINALS_EDITION: { name: 'Finals Edition', desc: 'Grand-match style', icon: <Trophy className="w-5 h-5 text-red-600" /> }
};

const LiveHub: React.FC<LiveHubProps> = ({ onClose, matchState, matchId, onUpdateMatch, userRole, onLeaveMatch }) => {
    const [tickerInput, setTickerInput] = useState(matchState?.tickerText || '');
    const [locationInput, setLocationInput] = useState(matchState?.venueLocation || '');
    const [activeTab, setActiveTab] = useState<'TICKER' | 'THEME' | 'WEATHER'>('THEME');
    const [autoScoreTicker, setAutoScoreTicker] = useState(false);
    const [isUpdatingWeather, setIsUpdatingWeather] = useState(false);
    const [connectionLogs, setConnectionLogs] = useState<string[]>([]);

    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<'IDLE' | 'CONNECTING' | 'CONNECTED' | 'ERROR' | 'DISCONNECTED' | 'WAITING' | 'OFFLINE' | 'ENDED'>('IDLE');
    const [liveData, setLiveData] = useState<any>(null);
    const [rtcConn, setRtcConn] = useState<RTCPeerConnection | null>(null);

    const [debugInfo, setDebugInfo] = useState<string>('');
    const [activeCameraId, setActiveCameraId] = useState<string>('MAIN');
    const [hasOptedIn, setHasOptedIn] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [browserError, setBrowserError] = useState<string | null>(null);
    const [streamQuality, setStreamQuality] = useState<'LOW' | 'MED' | 'HIGH'>('MED');

    const videoRef = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<Peer | null>(null);
    const dataConnRef = useRef<any>(null);


    // 1. Browser Compatibility Check
    useEffect(() => {
        if (!window.RTCPeerConnection || !navigator.mediaDevices) {
            setBrowserError("Your browser doesn't support modern live streaming. Please try Chrome or Safari.");
        }
    }, []);

    // 2. Status Monitoring (Auto-Connect & Standardized Flow)
    useEffect(() => {
        if (userRole !== 'VIEWER' || !hasOptedIn) {
            if (!hasOptedIn) setConnectionStatus('IDLE');
            return;
        }

        const unsubscribe = listenToLiveMatch(matchId, (data) => {
            setLiveData(data);
            if (!data) {
                setConnectionStatus('OFFLINE');
                return;
            }

            if (data.waiting) {
                setConnectionStatus('WAITING');
                setDebugInfo(`Status: ${data.status || 'Initializing'}`);
                return;
            }

            if (data.status === 'LIVE' || data.liveStreamType === 'LIVE') {
                if (data.broadcastId) {
                    // Handled by the connection effect below which reacts to connectionStatus changes
                    // or we can trigger it directly if we refactor. 
                    // For now, let's just update local connectionStatus if we're IDLE/WAITING
                    setConnectionStatus(prev => (prev === 'IDLE' || prev === 'WAITING' || prev === 'OFFLINE') ? 'CONNECTING' : prev);
                }
            } else if (data.status === 'ENDED' || data.liveStreamType === 'ENDED') {
                setConnectionStatus('ENDED');
                setRemoteStream(null);
                if (peerRef.current) {
                    peerRef.current.destroy();
                    peerRef.current = null;
                }
            }
        });

        return () => {
            try { unsubscribe(); } catch (e) { console.warn("Ignored LiveHub unmount assertion", e); }
        };
    }, [matchId, userRole, hasOptedIn]);

    // Explicit video attachment for WebRTC

    useEffect(() => {
        if (videoRef.current && remoteStream) {
            console.log("LiveHub: Attaching stream to video element", {
                id: remoteStream.id,
                active: remoteStream.active,
                tracks: remoteStream.getTracks().length
            });
            videoRef.current.srcObject = remoteStream;

            // Explicitly call play() after a short delay to satisfy policy/race
            const playTimer = setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.play().catch(err => {
                        console.warn("LiveHub: Auto-play blocked or failed:", err);
                        addLog("Playback restricted. Click video to play.");
                    });
                }
            }, 100);
            return () => clearTimeout(playTimer);
        }
    }, [remoteStream]);

    const addLog = (msg: string) => {
        const formatted = `[${new Date().toLocaleTimeString()}] ${msg}`;
        setConnectionLogs(prev => [formatted, ...prev].slice(0, 5));
    };

    const connectToSRS = async (camId: string) => {
        if (!camId) return;

        console.log("[Viewer] SRS Playback Connection:", camId);
        setConnectionStatus('CONNECTING');
        setDebugInfo(`Status: Fetching ${camId} flow...`);
        addLog(`Connecting to SRS: ${camId}`);

        try {
            const pc = new RTCPeerConnection({
                iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
            });

            setRtcConn(pc);

            pc.ontrack = (event) => {
                console.log("[Viewer] SRS Track Received");
                setRemoteStream(event.streams[0]);
                setConnectionStatus('CONNECTED');
                addLog("Stream synchronized.");
            };

            const offer = await pc.createOffer({
                offerToReceiveVideo: true,
                offerToReceiveAudio: true
            });

            await pc.setLocalDescription(offer);

            const server = SRS_CONFIG.SERVER_IP;
            const apiPort = SRS_CONFIG.HTTP_PORT;
            const app = SRS_CONFIG.APP;

            const apiUrl = `http://${server}:${apiPort}${SRS_CONFIG.API_PLAY}`;
            const streamUrl = `webrtc://${server}/${app}/${camId}`;

            const res = await fetch(apiUrl, {
                method: "POST",
                body: JSON.stringify({
                    api: apiUrl,
                    streamurl: streamUrl,
                    sdp: offer.sdp
                })
            });

            const data = await res.json();

            if (data.code !== 0) {
                throw new Error(`SRS Server Error: ${data.code}`);
            }

            await pc.setRemoteDescription({
                type: "answer",
                sdp: data.sdp
            });

        } catch (err) {
            console.error("SRS Play Error:", err);
            setConnectionStatus('ERROR');
            setDebugInfo(`Error: ${err instanceof Error ? err.message : 'Unknown'}`);
            addLog("Connection failed.");
        }
    };

    // 3. Core Connection Trigger
    useEffect(() => {
        if ((connectionStatus === 'CONNECTING' || connectionStatus === 'CONNECTED' || connectionStatus === 'ENDED') || userRole !== 'VIEWER' || !hasOptedIn) {
            return;
        }

        // Determine Target SRS Stream ID
        let targetCamId = '';

        if (activeCameraId === 'MAIN') {
            targetCamId = liveData?.streamId || matchState?.streamId || 'camera1';
        } else {
            targetCamId = activeCameraId.toLowerCase(); // camera1, camera2, etc
        }

        if (targetCamId) {
            connectToSRS(targetCamId);
        }

        return () => {
            if (rtcConn) {
                console.log("LiveHub: Cleaning up SRS connection.");
                rtcConn.close();
                setRtcConn(null);
            }
        };
    }, [liveData?.streamId, matchState?.streamId, activeCameraId, hasOptedIn, userRole]);

    const handleHardReset = () => {
        console.log("LiveHub: Manual Hard Reset Initiated");
        if (rtcConn) {
            rtcConn.close();
            setRtcConn(null);
        }
        setRemoteStream(null);
        setConnectionStatus('CONNECTING');
        setDebugInfo('Hard Reset: Reconnecting...');
    };

    // Reliable stream attachment
    useEffect(() => {
        if (videoRef.current && remoteStream) {
            console.log("LiveHub: Attaching stream to element. Tracks:", remoteStream.getTracks().length);
            videoRef.current.srcObject = remoteStream;
            videoRef.current.load();
            videoRef.current.play().then(() => {
                console.log("LiveHub: Playback started successfully");
            }).catch(e => {
                console.warn("LiveHub: Autoplay blocked or failed:", e);
                // If blocked, we might show a 'Click to Unmute' overlay if needed
            });
        }
    }, [remoteStream]);

    // Auto-ticker sync
    useEffect(() => {
        if (autoScoreTicker && matchState) {
            const { teamBatting, totalRuns, totalWickets, oversBowled, ballsBowledInCurrentOver, strikerId, nonStrikerId, currentBowlerId } = matchState;
            const striker = teamBatting.players.find(p => p.id === strikerId);
            const nonStriker = teamBatting.players.find(p => p.id === nonStrikerId);
            const bowler = matchState.teamBowling.players.find(p => p.id === currentBowlerId);

            const scoreTxt = `${teamBatting.name} ${totalRuns}/${totalWickets} (${oversBowled}.${ballsBowledInCurrentOver})`;
            const battingTxt = striker ? `${striker.name} ${striker.runs}*` : '';
            const nonStrikerTxt = nonStriker ? `${nonStriker.name} ${nonStriker.runs}` : '';
            const bowlerTxt = bowler ? ` | 🏏 ${bowler.name} ${bowler.wickets}/${bowler.runsConceded}` : '';

            const fullTicker = `${scoreTxt} | 🏏 ${battingTxt} ${nonStrikerTxt} ${bowlerTxt}`;
            setTickerInput(fullTicker);
        }
    }, [matchState, autoScoreTicker]);

    const handleUpdateTicker = async () => {
        if (!matchId || !matchState) return;
        const updates = { tickerText: tickerInput };
        if (onUpdateMatch) await onUpdateMatch(updates);
        else await pushMatchState(matchId, updates);
    };

    const handleUpdateTheme = async (theme: keyof typeof THEME_METADATA) => {
        if (!matchId || !matchState) return;
        const updates = { broadcastTheme: theme };
        if (onUpdateMatch) await onUpdateMatch(updates);
        else await pushMatchState(matchId, updates);
    };

    const handleUpdateWeather = async () => {
        if (!matchId || !matchState || !locationInput || userRole !== 'SCORER') return;
        setIsUpdatingWeather(true);
        const weatherData = await fetchWeather(locationInput);
        if (weatherData) {
            const updates = { weather: weatherData, venueLocation: locationInput };
            if (onUpdateMatch) await onUpdateMatch(updates);
            else await pushMatchState(matchId, updates);
        }
        setIsUpdatingWeather(false);
    };

    if (!matchState) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6">
            <div className="bg-slate-900 w-full max-w-5xl h-[85vh] rounded-[40px] border border-slate-800 shadow-2xl flex flex-col overflow-hidden relative">

                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                    <div className="flex items-center gap-4 text-slate-200">
                        <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center animate-pulse">
                            <Radio className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-2xl font-black italic tracking-tight uppercase">Control Room</h2>
                                {matchState.joinId && (
                                    <button
                                        onClick={() => {
                                            if (matchState.joinId) navigator.clipboard.writeText(matchState.joinId);
                                            alert("Match ID Copied! 📋");
                                        }}
                                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 border border-white/5 rounded text-[10px] text-amber-500 font-mono tracking-widest uppercase flex items-center gap-1.5 transition group"
                                    >
                                        ID: {matchState.joinId}
                                        <Copy className="w-3 h-3 opacity-40 group-hover:opacity-100 transition" />
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${connectionStatus === 'CONNECTED' ? 'bg-red-500/20 text-red-500 border-red-500/20' :
                                    connectionStatus === 'CONNECTING' ? 'bg-amber-500/20 text-amber-500 border-amber-500/20' :
                                        connectionStatus === 'WAITING' ? 'bg-blue-500/20 text-blue-400 border-blue-500/20' :
                                            connectionStatus === 'OFFLINE' ? 'bg-slate-800 text-slate-500 border-slate-700' :
                                                'bg-blue-500/20 text-blue-400 border-blue-500/20'
                                    }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${connectionStatus === 'CONNECTED' ? 'bg-red-500 animate-pulse' : (connectionStatus === 'CONNECTING' || connectionStatus === 'WAITING') ? 'bg-amber-500 animate-pulse' : 'bg-slate-600'}`}></span>
                                    {connectionStatus === 'CONNECTED' ? 'Live' :
                                        connectionStatus === 'CONNECTING' ? 'Connecting' :
                                            connectionStatus === 'WAITING' ? 'Pending Sync' :
                                                connectionStatus === 'OFFLINE' ? 'Offline' : 'Ready'}
                                </div>
                                {remoteStream && (
                                    <div className="flex items-center gap-1">
                                        <span className="text-[9px] font-black bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20">
                                            {remoteStream.getVideoTracks().length}v / {remoteStream.getAudioTracks().length}a
                                        </span>
                                        <select
                                            value={streamQuality}
                                            onChange={(e) => {
                                                const q = e.target.value as any;
                                                setStreamQuality(q);
                                                if (dataConnRef.current) {
                                                    dataConnRef.current.send({ type: 'CHANGE_QUALITY', quality: q });
                                                    addLog(`Requested ${q} quality`);
                                                }
                                            }}
                                            className="bg-slate-900 text-slate-400 text-[9px] font-bold border border-slate-700 rounded px-1 outline-none"
                                        >
                                            <option value="LOW">Low</option>
                                            <option value="MED">Med</option>
                                            <option value="HIGH">High</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {userRole === 'VIEWER' && onLeaveMatch && (
                            <button
                                onClick={onLeaveMatch}
                                className="px-4 py-2 bg-slate-800 hover:bg-red-600/20 text-slate-400 hover:text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-700 transition"
                            >
                                Leave Match
                            </button>
                        )}
                        <button onClick={onClose} className="p-3 hover:bg-slate-800 rounded-full text-slate-400">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Viewport Area */}
                    <div className={`${userRole === 'VIEWER' ? 'w-full' : 'w-[40%] border-r border-slate-800'} p-8 bg-slate-950/50 flex flex-col gap-6`}>
                        <div className="flex-1 bg-black rounded-[32px] border-4 border-slate-800 relative overflow-hidden shadow-2xl flex flex-col">
                            <div className="flex-1 relative flex items-center justify-center bg-black">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted={userRole === 'VIEWER'}
                                    onPlay={() => {
                                        console.log("LiveHub: Video playback started successfully.");
                                        addLog("Media player active (Rendering)");
                                    }}
                                    className={`w-full h-full object-contain transition-opacity duration-500 ${remoteStream ? 'opacity-100' : 'opacity-0'} ${matchState.liveStreamType === 'PAUSED' ? 'grayscale opacity-50' : ''}`}
                                />
                                {matchState.liveStreamType === 'PAUSED' && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-[2px] z-20">
                                        <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center border border-amber-500/50 mb-4 animate-pulse">
                                            <div className="w-4 h-8 bg-amber-500 rounded-sm mr-1"></div>
                                            <div className="w-4 h-8 bg-amber-500 rounded-sm"></div>
                                        </div>
                                        <h3 className="text-xl font-black text-white italic tracking-widest uppercase">Stream Paused</h3>
                                        <p className="text-amber-500/70 text-[10px] font-bold uppercase tracking-tighter mt-1">The Scorer will resume shortly</p>
                                    </div>
                                )}
                                {!remoteStream && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/50 backdrop-blur-md z-10 px-8 text-center">
                                        {browserError ? (
                                            <div className="flex flex-col items-center">
                                                <WifiOff className="w-16 h-16 text-red-500 mb-4" />
                                                <h4 className="text-white font-black uppercase text-sm tracking-widest">Browser Restricted</h4>
                                                <p className="text-slate-400 text-[10px] mt-2 max-w-xs">{browserError}</p>
                                            </div>
                                        ) : !hasOptedIn ? (
                                            <div className="flex flex-col items-center">
                                                <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center border border-amber-500/20 mb-6">
                                                    <Tv className="w-10 h-10 text-amber-500" />
                                                </div>
                                                <h3 className="text-xl font-black text-white italic tracking-tighter uppercase mb-2">Live Stream Available</h3>
                                                <p className="text-slate-400 text-xs font-medium mb-8 max-w-[200px]">Join the broadcast room to watch the match live.</p>
                                                <button
                                                    onClick={() => setHasOptedIn(true)}
                                                    className="px-8 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-black uppercase tracking-widest shadow-xl shadow-amber-500/20 transition active:scale-95 flex items-center gap-2"
                                                >
                                                    <Radio className="w-4 h-4" /> Watch Live Stream
                                                </button>
                                            </div>
                                        ) : (connectionStatus === 'CONNECTING' || connectionStatus === 'WAITING') ? (
                                            <div className="flex flex-col items-center">
                                                <div className="w-12 h-12 border-4 border-slate-700 border-t-amber-500 rounded-full animate-spin mb-4"></div>
                                                <p className="text-amber-500 font-black text-[10px] uppercase tracking-[0.2em] animate-pulse">
                                                    {connectionStatus === 'WAITING' ? 'Awaiting Broadcast Sync...' : (retryCount > 0 ? `Retrying Connection (${retryCount}/2)...` : 'Performing Handshake...')}
                                                </p>
                                                {debugInfo && <p className="text-[9px] font-mono text-slate-500 mt-2 opacity-60">{debugInfo}</p>}
                                                {connectionStatus === 'WAITING' && (
                                                    <p className="text-[9px] text-slate-600 mt-2 max-w-[180px]">The Match is established, but the Scorer hasn't started the stream yet.</p>
                                                )}
                                            </div>
                                        ) : connectionStatus === 'OFFLINE' ? (
                                            <div className="flex flex-col items-center">
                                                <WifiOff className="w-16 h-16 text-slate-800 mb-4" />
                                                <p className="text-slate-600 font-black text-xs uppercase tracking-widest">Signaling Offline</p>
                                                <p className="text-slate-700 text-[9px] mt-1 font-bold uppercase">Waiting for Scorer to Start Broadcast</p>
                                            </div>
                                        ) : connectionStatus === 'ENDED' ? (
                                            <div className="flex flex-col items-center">
                                                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 border border-slate-700">
                                                    <Tv className="w-10 h-10 text-slate-500" />
                                                </div>
                                                <h3 className="text-xl font-black text-white italic tracking-tighter uppercase mb-2">Stream Ended</h3>
                                                <p className="text-slate-400 text-xs font-medium mb-8 max-w-[200px]">This broadcast has been completed by the scorer.</p>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center">
                                                <WifiOff className="w-16 h-16 text-red-500/50 mb-4" />
                                                <h4 className="text-red-500 font-black uppercase text-sm tracking-widest">Handshake Failed</h4>
                                                <p className="text-slate-500 text-[10px] mt-1 mb-6 font-bold uppercase">{debugInfo || 'Broadcaster unreachable'}</p>
                                                <button
                                                    onClick={() => {
                                                        setRetryCount(0);
                                                        setConnectionStatus('CONNECTING');
                                                        setHasOptedIn(true);
                                                    }}
                                                    className="px-6 py-2 bg-slate-800 text-white rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-700 hover:bg-slate-700 transition"
                                                >
                                                    Retry Manually
                                                </button>
                                            </div>
                                        )}

                                        {connectionLogs.length > 0 && hasOptedIn && (
                                            <div className="mt-8 p-3 bg-black/40 rounded-xl border border-white/5 w-full max-w-[220px]">
                                                <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-2 border-b border-white/5 pb-1">Handshake Log</div>
                                                <div className="space-y-1">
                                                    {connectionLogs.map((log, i) => (
                                                        <div key={i} className="text-[9px] font-mono text-slate-500 opacity-60 leading-tight text-left truncate">{log}</div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="absolute top-6 left-6 bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded shadow-lg animate-pulse uppercase">LIVE</div>

                                {userRole !== 'VIEWER' && (matchState.cameras || []).length > 0 && (
                                    <div className="absolute top-6 right-6 flex flex-col gap-2 z-20">
                                        <button
                                            onClick={() => setActiveCameraId('MAIN')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition border ${activeCameraId === 'MAIN' ? 'bg-red-600 border-red-500 text-white' : 'bg-black/50 border-white/10 text-slate-300'}`}
                                        >
                                            Main Feed
                                        </button>
                                        <button onClick={() => setActiveCameraId("camera2")} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition border ${activeCameraId === "camera2" ? 'bg-amber-500 border-amber-400 text-black' : 'bg-black/50 border-white/10 text-slate-300'}`}>Bowler Camera</button>
                                        <button onClick={() => setActiveCameraId("camera3")} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition border ${activeCameraId === "camera3" ? 'bg-amber-500 border-amber-400 text-black' : 'bg-black/50 border-white/10 text-slate-300'}`}>Boundary Camera</button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-auto">
                            <ScoreTicker matchState={matchState} matchId={matchId} />
                        </div>
                    </div>

                    {/* Scorer Dashboard Tabs */}
                    {userRole !== 'VIEWER' && (
                        <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
                            <div className="flex border-b border-slate-800">
                                <button onClick={() => setActiveTab('THEME')} className={`flex-1 py-5 text-xs font-black uppercase tracking-widest transition ${activeTab === 'THEME' ? 'bg-slate-800 text-white border-b-2 border-amber-500' : 'text-slate-500'}`}>Visual Themes</button>
                                <button onClick={() => setActiveTab('TICKER')} className={`flex-1 py-5 text-xs font-black uppercase tracking-widest transition ${activeTab === 'TICKER' ? 'bg-slate-800 text-white border-b-2 border-amber-500' : 'text-slate-500'}`}>Overlay Ticker</button>
                                {userRole === 'SCORER' && <button onClick={() => setActiveTab('WEATHER')} className={`flex-1 py-5 text-xs font-black uppercase tracking-widest transition ${activeTab === 'WEATHER' ? 'bg-slate-800 text-white border-b-2 border-amber-500' : 'text-slate-500'}`}>Weather</button>}
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                                {activeTab === 'THEME' && (
                                    <div className="grid grid-cols-2 gap-4">
                                        {Object.entries(THEME_METADATA).map(([key, theme]) => (
                                            <button key={key} onClick={() => handleUpdateTheme(key as any)} className={`p-4 rounded-xl border-2 transition text-left h-24 flex flex-col justify-between ${matchState.broadcastTheme === key ? 'border-amber-500 bg-slate-800' : 'border-slate-800 bg-slate-950'}`}>
                                                <div className="font-bold text-white text-sm">{theme.name}</div>
                                                <div className="text-[10px] text-slate-500 font-bold">{theme.desc}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {activeTab === 'TICKER' && (
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between bg-slate-950 p-4 rounded-xl border border-slate-800">
                                            <div>
                                                <div className="text-white text-sm font-bold">Auto-Sync Scorecard</div>
                                                <div className="text-[10px] text-slate-500">Live stats from the scorer</div>
                                            </div>
                                            <button onClick={() => setAutoScoreTicker(!autoScoreTicker)} className={`w-12 h-6 rounded-full relative transition ${autoScoreTicker ? 'bg-amber-500' : 'bg-slate-700'}`}>
                                                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${autoScoreTicker ? 'left-7' : 'left-1'}`} />
                                            </button>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Custom Message</label>
                                            <div className="flex gap-2">
                                                <input type="text" value={tickerInput} onChange={e => { setTickerInput(e.target.value); setAutoScoreTicker(false); }} className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-500 font-bold" />
                                                <button onClick={handleUpdateTicker} className="bg-amber-500 text-black px-6 rounded-xl font-black text-[10px] uppercase">Update</button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'WEATHER' && (
                                    <div className="space-y-6">
                                        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800">
                                            <label className="text-[10px] font-black text-slate-500 uppercase mb-4 block">Venue Location</label>
                                            <div className="flex gap-4">
                                                <input type="text" value={locationInput} onChange={e => setLocationInput(e.target.value)} placeholder="e.g. London" className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white" />
                                                <button onClick={handleUpdateWeather} disabled={isUpdatingWeather} className="bg-amber-500 text-black px-6 rounded-xl font-bold text-xs uppercase disabled:opacity-50">
                                                    {isUpdatingWeather ? '...' : 'Fetch'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LiveHub;
