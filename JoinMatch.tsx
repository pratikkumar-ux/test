import React, { useState } from "react";
import { connectViewerToMatch } from "../services/viewerService";

export default function JoinMatch() {
    const [joinId, setJoinId] = useState("");
    const [isConnecting, setIsConnecting] = useState(false);

    const handleJoin = async () => {
        if (!joinId.trim()) return;
        setIsConnecting(true);
        try {
            await connectViewerToMatch(joinId);
        } catch (err) {
            alert("Failed to join: " + (err instanceof Error ? err.message : String(err)));
        } finally {
            setIsConnecting(false);
        }
    };

    return (
        <div className="bg-slate-900/50 p-8 rounded-2xl border border-slate-800 backdrop-blur-sm shadow-2xl max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">Join Live Match</h2>

            <div className="space-y-4">
                <input
                    className="w-full bg-slate-950 border border-slate-700 text-white px-6 py-4 rounded-xl outline-none focus:border-amber-500 transition text-center font-black tracking-[0.2em] text-xl uppercase placeholder:text-slate-600 placeholder:tracking-normal placeholder:font-normal placeholder:text-base"
                    placeholder="Enter 6-Digit Match ID"
                    value={joinId}
                    onChange={(e) => setJoinId(e.target.value.toUpperCase())}
                    maxLength={6}
                />

                <button
                    onClick={handleJoin}
                    disabled={isConnecting}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100"
                >
                    {isConnecting ? "Connecting..." : "Join Match"}
                </button>
            </div>

            <p className="text-slate-400 text-xs mt-4 text-center leading-relaxed">
                Enter the 6-character code provided by the match scorer to start viewing real-time scores and broadcast.
            </p>
        </div>
    );
}
