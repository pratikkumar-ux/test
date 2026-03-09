import React, { useState, useEffect, useRef } from 'react';
import Peer, { MediaConnection } from 'peerjs';
import { X, Camera, Mic, MicOff, Video, VideoOff, Settings, Radio, Users } from 'lucide-react';
import { MatchState } from '../types';
import { pushMatchState, updateScheduledMatchStatus, startLiveMatch, stopLiveMatch, SRS_CONFIG } from '../services/firebaseService';

interface BroadcastManagerProps {
    matchId: string;
    matchState: MatchState;
    onClose: () => void;
    onUpdateMatch: (state: Partial<MatchState>) => Promise<void>;
}

const BroadcastManager: React.FC<BroadcastManagerProps> = ({ matchId, matchState, onClose, onUpdateMatch }) => {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [isLive, setIsLive] = useState(false);
    const [rtcConn, setRtcConn] = useState<RTCPeerConnection | null>(null);
    const [viewerCount, setViewerCount] = useState(0);
    const [connectionLogs, setConnectionLogs] = useState<string[]>([]);
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [showAddCamera, setShowAddCamera] = useState(false);
    const [editingCamId, setEditingCamId] = useState<string | null>(null);
    const [tempLabel, setTempLabel] = useState('');
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null); // Use ref for cleanup to avoid stale closures

    const addLog = (msg: string) => {
        const formatted = `[${new Date().toLocaleTimeString()}] ${msg}`;
        setConnectionLogs(prev => [formatted, ...prev].slice(0, 5));
    };


    // 1. Initialize Camera (Request permissions & get default stream)
    useEffect(() => {
        const initCamera = async () => {
            try {
                console.log("Requesting camera access...");
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                setLocalStream(stream);
                streamRef.current = stream; // Update ref
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }

                // Once we have permission, enumerate devices
                const devs = await navigator.mediaDevices.enumerateDevices();
                const videoDevs = devs.filter(d => d.kind === 'videoinput');
                setDevices(videoDevs);

                // Set selected device based on the active stream's track
                const videoTrack = stream.getVideoTracks()[0];
                const activeDeviceId = videoTrack.getSettings().deviceId;
                if (activeDeviceId) {
                    setSelectedDeviceId(activeDeviceId);
                } else if (videoDevs.length > 0) {
                    setSelectedDeviceId(videoDevs[0].deviceId);
                }
            } catch (err) {
                console.error("Error initializing camera:", err);
                alert("Could not access camera. Please allow permissions and refresh.");
            }
        };

        initCamera();
    }, []);

    // 2. Switch Camera (When user selects a different device)
    useEffect(() => {
        if (!selectedDeviceId) return;
        // Skip if the current stream matches the selected device (avoid unnecessary restart)
        const currentVideoTrack = localStream?.getVideoTracks()[0];
        if (currentVideoTrack && currentVideoTrack.getSettings().deviceId === selectedDeviceId) return;

        const switchCamera = async () => {
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        frameRate: { ideal: 30 }
                    },
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true
                    }
                });
                setLocalStream(stream);
                streamRef.current = stream; // Update ref
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error("Error switching camera:", err);
            }
        };

        // Only switch if we already have a stream (meaning init is done) and user changed selection
        if (localStream) {
            switchCamera();
        }
    }, [selectedDeviceId]);

    // 3. Toggle Mute/Video
    useEffect(() => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => track.enabled = !isMuted);
            localStream.getVideoTracks().forEach(track => track.enabled = !isVideoOff);
        }
    }, [isMuted, isVideoOff, localStream]);

    // 4. Ensure Video Element has Stream (Fix for Minimize/Maximize)
    useEffect(() => {
        if (videoRef.current && localStream) {
            videoRef.current.srcObject = localStream;
        }
    }, [isMinimized, localStream]); // Re-run when UI layout changes or stream updates

    // Media Health Check (Broadcaster side)
    useEffect(() => {
        const interval = setInterval(() => {
            if (isLive && streamRef.current && !streamRef.current.active) {
                console.warn("Broadcaster: Media stream unexpectedly inactive! Resyncing...");
                addLog("Warning: Camera signal lost. Resyncing...");
                handleResyncSignaling();
            }
        }, 5000);
        return () => clearInterval(interval);
    }, [isLive]);


    const generateJoinId = () => {
        // Generate a 6-digit random code for simplicity but match-specific
        return Math.floor(100000 + Math.random() * 900000).toString();
    };


    // Store valid session tokens for handshake verification
    const viewerTokens = useRef<Record<string, string>>({});

    const generateSessionToken = () => {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    };

    // 4. Handle Go Live (SRS WebRTC Publish)
    const initializeSRS = async (camId: string = "camera1") => {
        if (!localStream) return;

        try {
            console.log(`[Scorer] Starting SRS Publisher: ${camId}`);
            addLog(`Initializing SRS: ${camId}...`);

            const pc = new RTCPeerConnection({
                iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
            });

            setRtcConn(pc);

            localStream.getTracks().forEach(track => {
                pc.addTrack(track, localStream);
            });

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            const server = SRS_CONFIG.SERVER_IP;
            const apiPort = SRS_CONFIG.HTTP_PORT;
            const app = SRS_CONFIG.APP;

            const apiUrl = `http://${server}:${apiPort}${SRS_CONFIG.API_PUBLISH}`;
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
                throw new Error(`SRS Error: ${data.code}`);
            }

            await pc.setRemoteDescription({
                type: "answer",
                sdp: data.sdp
            });

            console.log("[Scorer] SRS Publisher Online:", camId);
            setIsLive(true);
            setConnectionLogs(prev => [`[${new Date().toLocaleTimeString()}] SRS Live: ${camId}`, ...prev]);

            // Update Firestore
            await startLiveMatch(matchId, camId);

            await onUpdateMatch({
                liveStreamType: "LIVE",
                isCloudMode: true,
                cameraJoinId: matchState.cameraJoinId || generateJoinId(),
                joinIdExpiresAt: Date.now() + (4 * 60 * 60 * 1000)
            });

            // Update the scheduled match status to LIVE
            updateScheduledMatchStatus(matchId, 'LIVE');

        } catch (err) {
            console.error("SRS Publish Error:", err);
            addLog(`SRS Error: ${err instanceof Error ? err.message : 'Unknown'}`);
            alert("Failed to start SRS stream. Is the server running?");
        }
    };



    // 4. Handle Go Live
    const handleGoLive = () => {
        if (!localStream) {
            alert("Camera not ready. Please allow camera access and select a device.");
            return;
        }

        initializeSRS("camera1");
    };

    const handleResyncSignaling = () => {
        if (rtcConn) {
            rtcConn.close();
            setRtcConn(null);
        }
        setConnectionLogs(prev => [`[${new Date().toLocaleTimeString()}] HARD RESYNC INITIATED...`, ...prev]);
        setTimeout(() => initializeSRS("camera1"), 500);
    };

    // 5. Handle Pause Live
    const handlePauseLive = async () => {
        await onUpdateMatch({
            liveStreamType: 'PAUSED'
        });
        setConnectionLogs(prev => [`[${new Date().toLocaleTimeString()}] Stream Paused`, ...prev]);
    };

    // 6. Handle Resume Live
    const handleResumeLive = async () => {
        await onUpdateMatch({
            liveStreamType: 'LIVE'
        });
        setConnectionLogs(prev => [`[${new Date().toLocaleTimeString()}] Stream Resumed`, ...prev]);
    };

    // 7. Handle Stop Live
    const handleStopLive = async () => {
        if (rtcConn) {
            rtcConn.close();
            setRtcConn(null);
        }
        setIsLive(false);
        setViewerCount(0);

        // NEW: Standardized Stop logic
        await stopLiveMatch(matchId);

        await onUpdateMatch({
            isCloudMode: false,
            playbackUrl: null,
            cloudIngestUrl: null,
            cameraJoinId: null,
            joinIdExpiresAt: null,
            cameras: []
        });

        // Revert dashboard status
        updateScheduledMatchStatus(matchId, 'SCHEDULED');

        onClose(); // Close modal on stop
    };

    // 6. Add External Camera
    const handleAddCamera = async () => {
        const currentCameras = matchState.cameras || [];
        if (currentCameras.length >= 5) {
            alert("Maximum 5 external cameras allowed.");
            return;
        }

        const nextId = `CAM${currentCameras.length + 1}`;
        const newCamera = {
            id: nextId,
            name: `Camera ${currentCameras.length + 1}`,
            status: 'OFFLINE' as const,
            isDisabled: false
        };
        const updatedCameras = [...currentCameras, newCamera];

        await onUpdateMatch({ cameras: updatedCameras });
    };

    const handleUpdateCamera = async (camId: string, updates: Partial<{ name: string, isDisabled: boolean }>) => {
        const updatedCameras = (matchState.cameras || []).map(c =>
            c.id === camId ? { ...c, ...updates } : c
        );
        await onUpdateMatch({ cameras: updatedCameras });
        setEditingCamId(null);
    };

    // 7. Remove Camera
    const handleRemoveCamera = async (camId: string) => {
        const updatedCameras = (matchState.cameras || []).filter(c => c.id !== camId);
        await onUpdateMatch({ cameras: updatedCameras });
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (rtcConn) rtcConn.close();
            // Use ref to ensure we have the latest stream to stop
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }
        };
    }, []);

    if (isMinimized) {
        return (
            <div className="fixed bottom-4 right-4 z-[200] w-64 bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-5">
                <div className="h-32 bg-black relative">
                    <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover opacity-80"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-red-600/90 text-white text-xs font-black px-3 py-1 rounded shadow-lg animate-pulse">
                            LIVE ON AIR
                        </div>
                    </div>
                    <button
                        onClick={() => setIsMinimized(false)}
                        className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/80 rounded-full text-white backdrop-blur-sm transition"
                        title="Expand"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
                    </button>
                </div>
                <div className="p-3 flex items-center justify-between gap-3 bg-slate-900">
                    <div className="flex items-center gap-2 text-xs text-white font-bold">
                        <Users className="w-3 h-3 text-amber-500" />
                        {viewerCount}
                    </div>
                    <div className="flex items-center gap-2">
                        {matchState.liveStreamType === 'LIVE' ? (
                            <button
                                onClick={handlePauseLive}
                                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 rounded-lg text-[10px] font-black uppercase tracking-wider border border-amber-500/30 transition"
                            >
                                Pause
                            </button>
                        ) : (
                            <button
                                onClick={handleResumeLive}
                                className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-500 rounded-lg text-[10px] font-black uppercase tracking-wider border border-green-500/30 transition"
                            >
                                Resume
                            </button>
                        )}
                        <button
                            onClick={handleStopLive}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-black uppercase tracking-wider border border-slate-700 transition"
                        >
                            End
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 w-full max-w-4xl rounded-[40px] border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 z-10">
                    <div className="flex items-center gap-4 text-slate-200">
                        <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center animate-pulse">
                            <Radio className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black italic tracking-tight uppercase leading-none">Scorer Hub</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-widest ${isLive ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                    rtcConn ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                        'bg-slate-800 text-slate-500 border-slate-700'
                                    }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-green-500' : 'bg-slate-600'}`}></span>
                                    {isLive ? 'SRS Online' : 'Offline'}
                                </div>
                                <div className="text-[10px] font-bold text-slate-500 lowercase opacity-60">
                                    SRS: {SRS_CONFIG.SERVER_IP}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsMinimized(true)}
                            className="p-2 hover:bg-slate-800 rounded-full text-slate-400"
                            title="Minimize"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" /></svg>
                        </button>
                        <button onClick={handleStopLive} className="p-2 hover:bg-slate-800 rounded-full text-slate-400">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                    {/* Main Preview */}
                    <div className="flex-1 bg-black relative flex items-center justify-center p-4 overflow-hidden">
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            className="w-full h-full object-contain rounded-2xl border border-slate-800"
                        />

                        {/* Overlay Controls */}
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-900/80 backdrop-blur-md p-3 rounded-2xl border border-slate-700">
                            <button onClick={() => setIsMuted(!isMuted)} className={`p-3 rounded-xl transition ${isMuted ? 'bg-red-500 text-white' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
                                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                            </button>
                            <button onClick={() => setIsVideoOff(!isVideoOff)} className={`p-3 rounded-xl transition ${isVideoOff ? 'bg-red-500 text-white' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
                                {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                            </button>
                        </div>

                        {isLive && (
                            <div className="absolute top-8 left-8 bg-red-600 px-4 py-1 rounded-lg text-white font-black text-xs uppercase tracking-widest animate-pulse shadow-lg shadow-red-600/20 flex items-center gap-2">
                                <span className="w-2 h-2 bg-white rounded-full"></span> LIVE ON AIR
                            </div>
                        )}

                        {isLive && (
                            <div className="absolute top-8 right-8 bg-black/60 backdrop-blur px-4 py-1 rounded-lg text-white font-bold text-xs flex items-center gap-2 border border-white/10">
                                <Users className="w-4 h-4 text-amber-500" /> {viewerCount} Viewers
                            </div>
                        )}
                    </div>

                    {/* Sidebar Controls */}
                    <div className="w-full md:w-80 bg-slate-950 p-6 border-l border-slate-800 flex flex-col gap-6 overflow-y-auto">

                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Video Source</label>
                            </div>
                            <div className="space-y-2">
                                {devices.map((device, idx) => (
                                    <button
                                        key={device.deviceId}
                                        onClick={() => !isLive && setSelectedDeviceId(device.deviceId)}
                                        disabled={isLive}
                                        className={`w-full p-4 rounded-xl text-left border transition-all flex items-center gap-3
                                            ${selectedDeviceId === device.deviceId
                                                ? 'bg-amber-500/10 border-amber-500 text-white'
                                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'}
                                            ${isLive ? 'opacity-50 cursor-not-allowed' : ''}
                                        `}
                                    >
                                        <Camera className={`w-5 h-5 ${selectedDeviceId === device.deviceId ? 'text-amber-500' : 'text-slate-600'}`} />
                                        <div className="min-w-0 flex-1">
                                            <div className="text-xs font-bold truncate">{device.label || `Camera ${idx + 1}`}</div>
                                            <div className="text-[10px] opacity-60 uppercase">{device.deviceId.substring(0, 8)}...</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Multi-Camera Management */}
                        <div className="pt-6 border-t border-slate-800">
                            <div className="flex justify-between items-center mb-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">External Cameras</label>
                                <button
                                    onClick={handleAddCamera}
                                    disabled={!isLive}
                                    className="text-[10px] font-bold text-amber-500 hover:text-amber-400 uppercase flex items-center gap-1 disabled:opacity-50"
                                >
                                    <Users className="w-3 h-3" /> Add Cam
                                </button>
                            </div>

                            {isLive && matchState.cameraJoinId && (
                                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                    <div className="text-[10px] font-black text-amber-500/70 uppercase tracking-tighter mb-1">Camera Join ID</div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xl font-black text-white tracking-[0.2em]">{matchState.cameraJoinId}</span>
                                        <button
                                            onClick={async () => {
                                                const newId = generateJoinId();
                                                await onUpdateMatch({ cameraJoinId: newId });
                                            }}
                                            className="text-[10px] font-bold text-amber-500 uppercase"
                                        >
                                            Refresh
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                {(matchState.cameras || []).length === 0 && (
                                    <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 border-dashed text-center">
                                        <p className="text-xs text-slate-500">No external cameras added.</p>
                                    </div>
                                )}
                                {(matchState.cameras || []).map((cam) => (
                                    <div key={cam.id} className={`p-3 bg-slate-900 rounded-xl border transition-all ${cam.isDisabled ? 'border-slate-800 opacity-50' : 'border-slate-800'}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${cam.status === 'LIVE' && !cam.isDisabled ? 'bg-red-500 animate-pulse' : 'bg-slate-600'}`}></div>
                                                {editingCamId === cam.id ? (
                                                    <input
                                                        autoFocus
                                                        className="bg-slate-800 border border-slate-700 text-white text-xs font-bold px-2 py-1 rounded w-32"
                                                        value={tempLabel}
                                                        onChange={(e) => setTempLabel(e.target.value)}
                                                        onBlur={() => handleUpdateCamera(cam.id, { name: tempLabel })}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateCamera(cam.id, { name: tempLabel })}
                                                    />
                                                ) : (
                                                    <div className="text-xs font-bold text-white flex items-center gap-2 group cursor-pointer" onClick={() => { setEditingCamId(cam.id); setTempLabel(cam.name); }}>
                                                        {cam.name}
                                                        <Settings className="w-3 h-3 text-slate-600 group-hover:text-amber-500 transition opacity-0 group-hover:opacity-100" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleUpdateCamera(cam.id, { isDisabled: !cam.isDisabled })}
                                                    className={`p-1.5 rounded transition ${cam.isDisabled ? 'text-slate-500 hover:text-white' : 'text-amber-500 hover:bg-amber-500/10'}`}
                                                    title={cam.isDisabled ? "Enable" : "Disable"}
                                                >
                                                    {cam.isDisabled ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveCamera(cam.id)}
                                                    className="p-1.5 hover:bg-red-500/10 text-slate-500 hover:text-red-500 rounded transition"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                                            <span>SLOT: {cam.id}</span>
                                            {cam.status === 'LIVE' && <span className="text-red-500 font-bold uppercase">Streaming</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {/* Connection Logs */}
                            {isLive && connectionLogs.length > 0 && (
                                <div className="pt-6 border-t border-slate-800">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Live Connections</label>
                                    <div className="space-y-1">
                                        {connectionLogs.map((log, i) => (
                                            <div key={i} className="text-[9px] font-mono text-slate-400 opacity-60">{log}</div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <p className="text-[10px] text-slate-500 mt-4 leading-relaxed italic opacity-75">
                                Share the <b>Camera Join ID</b> with operators. Unauthorized or expired IDs will be rejected.
                            </p>
                        </div>

                    </div>

                    <div className="mt-auto px-6 pb-6">
                        {!isLive ? (
                            <button
                                onClick={handleGoLive}
                                className="w-full bg-amber-500 text-black hover:bg-amber-400 py-6 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-amber-500/20"
                            >
                                <Radio className="w-5 h-5" />
                                Start Stream
                            </button>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                {matchState.liveStreamType === 'LIVE' ? (
                                    <button
                                        onClick={handlePauseLive}
                                        className="bg-slate-800 text-white hover:bg-slate-700 border border-slate-700 py-6 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95"
                                    >
                                        Pause
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleResumeLive}
                                        className="bg-green-600 text-white hover:bg-green-500 py-6 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-green-600/20 transition-all active:scale-95"
                                    >
                                        Resume
                                    </button>
                                )}
                                <button
                                    onClick={handleStopLive}
                                    className="bg-red-600 text-white hover:bg-red-500 py-6 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-600/20 transition-all active:scale-95"
                                >
                                    End
                                </button>
                            </div>
                        )}
                        {isLive && (
                            <button
                                onClick={handleResyncSignaling}
                                className="w-full mt-3 bg-slate-900 text-slate-400 hover:text-white border border-slate-800 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all"
                            >
                                Re-Sync Signaling
                            </button>
                        )}
                        <p className="text-center text-[10px] text-slate-500 mt-4 font-bold px-4 leading-relaxed opacity-60">
                            {!isLive ? "Ready to broadcast. Click to go live." : (matchState.liveStreamType === 'LIVE' ? "Stream is live. Click to pause or end." : "Stream is paused. Click to resume or end.")}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BroadcastManager;
