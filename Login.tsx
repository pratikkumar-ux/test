import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, Loader2, User, Camera } from 'lucide-react';
import { loginUser, registerUser, checkAndRegisterDevice, forceLogoutOthers, resetPassword } from '../services/firebaseService';
import { auth } from '../services/firebaseService';

interface LoginProps {
    onLogin: () => void;
    onGuestAccess: () => void;
    onCameraOperator?: () => void;
}

export default function Login({ onLogin, onGuestAccess, onCameraOperator }: LoginProps) {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [deviceId, setDeviceId] = useState('');
    const [showForceLogout, setShowForceLogout] = useState(false);
    const [limitMsg, setLimitMsg] = useState('');

    React.useEffect(() => {
        let id = localStorage.getItem('device_id');
        if (!id) {
            // Use native crypto UUID or fallback for older browsers
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                id = crypto.randomUUID();
            } else {
                id = Math.random().toString(36).substring(2) + Date.now().toString(36);
            }
            localStorage.setItem('device_id', id);
        }
        setDeviceId(id);
    }, []);

    const handleForceLogout = async () => {
        if (!auth.currentUser) return;
        setLoading(true);
        try {
            await forceLogoutOthers(auth.currentUser.uid, deviceId);
            onLogin(); // Proceed to app
        } catch (err) {
            console.error(err);
            setError("Failed to log out other devices.");
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!email) {
            setError("Please enter your email address first.");
            return;
        }
        setLoading(true);
        try {
            await resetPassword(email);
            setError('');
            alert(`Password reset email sent to ${email}. Check your inbox!`);
        } catch (err: any) {
            console.error("Reset Password Error:", err);
            setError(err.message || "Failed to send reset email.");
        } finally {
            setLoading(false);
        }
    };

    const handleAuth = async () => {
        setError('');
        setLoading(true);
        try {
            if (isSignUp) {
                if (!username.trim()) {
                    setError('Username is required for registration.');
                    setLoading(false);
                    return;
                }
                await registerUser(email, password, username);
                // Registration implies first device, so we register implicitly
                // But safer to just call check
            } else {
                await loginUser(email, password);
            }

            // --- Device Limit Check ---
            const user = auth.currentUser;
            if (user) {
                const check = await checkAndRegisterDevice(user.uid, deviceId, user.email || email);
                if (check.allowed) {
                    onLogin();
                } else {
                    setLimitMsg(check.message || "Device limit reached.");
                    setShowForceLogout(true);
                    // Do NOT call onLogin() here
                }
            } else {
                // Should not happen if auth succeeded
                onLogin();
            }
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/invalid-credential') {
                setError('Invalid email or password.');
            } else if (err.code === 'auth/email-already-in-use') {
                setError('Email already in use. Please switch to "Sign In" tab.');
            } else if (err.code === 'auth/weak-password') {
                setError('Password should be at least 6 characters.');
            } else {
                console.error("Login/Signup Error:", err);
                setError(`Error: ${err.message || 'Something went wrong. Please try again.'}`);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen mesh-gradient flex flex-col p-6 items-center justify-center font-sans">
            <div className="w-full max-w-md glass-premium p-10 rounded-[48px] animate-fade-in-up relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-primary/50 to-transparent"></div>

                <div className="mb-10 text-center">
                    <h2 className="text-4xl font-black text-white mb-3 tracking-tight italic font-heading">
                        {isSignUp ? 'CREATE ACCOUNT' : 'WELCOME BACK'}
                    </h2>
                    <p className="text-slate-400 text-sm font-medium tracking-wide">
                        {isSignUp ? 'Join the elite scoring community.' : 'Continue your professional scoring journey.'}
                    </p>
                </div>

                <div className="space-y-5 mb-10">
                    {isSignUp && (
                        <div className="relative animate-slide-in">
                            <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Username"
                                className="w-full bg-slate-950/50 border border-white/5 text-white pl-14 pr-6 py-5 rounded-3xl focus:border-brand-primary focus:bg-slate-950 transition-all outline-none"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>
                    )}
                    <div className="relative">
                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                        <input
                            type="email"
                            placeholder="Email Address"
                            className="w-full bg-slate-950/50 border border-white/5 text-white pl-14 pr-6 py-5 rounded-3xl focus:border-brand-primary focus:bg-slate-950 transition-all outline-none"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div className="relative">
                        <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                        <input
                            type="password"
                            placeholder="Password"
                            className="w-full bg-slate-950/50 border border-white/5 text-white pl-14 pr-6 py-5 rounded-3xl focus:border-brand-primary focus:bg-slate-950 transition-all outline-none"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                        />
                    </div>

                    {!isSignUp && (
                        <div className="text-right px-2">
                            <button
                                onClick={handleResetPassword}
                                className="text-slate-500 hover:text-brand-primary text-xs font-bold uppercase tracking-widest transition-colors"
                            >
                                Forgot Password?
                            </button>
                        </div>
                    )}

                    {error && <p className="text-red-400 text-xs font-bold tracking-wide text-center animate-pulse">{error}</p>}
                </div>

                <button
                    onClick={handleAuth}
                    disabled={loading}
                    className="w-full bg-white text-slate-950 font-black py-5 rounded-[24px] flex items-center justify-center gap-3 transition-all active:scale-95 group disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_20px_40px_rgba(255,255,255,0.1)] hover:bg-brand-primary hover:shadow-brand-primary/20"
                >
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                        <>
                            <span className="tracking-[0.2em]">{isSignUp ? 'SIGN UP' : 'SIGN IN'}</span>
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </>
                    )}
                </button>

                {showForceLogout && (
                    <div className="mt-6 bg-red-500/10 border border-red-500/30 p-5 rounded-3xl animate-fade-in-up">
                        <p className="text-red-400 text-xs font-black uppercase tracking-widest mb-4 text-center">{limitMsg}</p>
                        <button
                            onClick={handleForceLogout}
                            className="w-full bg-red-500 hover:bg-red-600 text-white font-black py-4 rounded-2xl transition shadow-lg shadow-red-500/20 uppercase tracking-widest text-xs"
                        >
                            Log Out Others & Continue
                        </button>
                    </div>
                )}

                <div className="mt-10 text-center">
                    <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">
                        {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                    </span>
                    <button
                        onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
                        className="text-brand-primary font-black text-xs uppercase tracking-[0.2em] hover:underline"
                    >
                        {isSignUp ? 'SIGN IN' : 'SIGN UP'}
                    </button>
                </div>
            </div>
        </div>
    );
};


