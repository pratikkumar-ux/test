import React, { useState, useEffect, useRef } from 'react';
import {
    User, Shield, Zap, Target, TrendingUp, Settings, LogOut, Camera, Edit2,
    Save, X, Lock, Globe, Bell, Eye, EyeOff, Smartphone, Trash2, ChevronRight,
    MapPin, Calendar, Mail, Phone, CheckCircle, Users, Trophy, Loader2
} from 'lucide-react';
import {
    auth, getUserProfile, updateUserProfile, forceLogoutOthers,
    getVisibleEvents, uploadProfileImage, resetPassword, deleteUserAccount
} from '../services/firebaseService';
import { UserProfile, Tournament } from '../types';

const InputField = ({ label, value, onChange, icon: Icon, type = "text", disabled = false, isEditing = false }: any) => (
    <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">{label}</label>
        <div className={`relative flex items-center bg-slate-900 border ${disabled ? 'border-slate-800 opacity-60' : 'border-slate-800 focus-within:border-amber-500'} rounded-xl transition`}>
            {Icon && <Icon className="w-4 h-4 text-slate-500 absolute left-4" />}
            <input
                type={type}
                disabled={disabled || !isEditing}
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                className={`w-full bg-transparent text-white py-3 outline-none text-sm font-medium placeholder-slate-600 ${Icon ? 'pl-12' : 'pl-4'} ${!disabled && isEditing ? 'pr-10' : 'pr-4'}`}
            />
            {!disabled && isEditing && <Edit2 className="w-3 h-3 text-slate-600 absolute right-4 pointer-events-none" />}
        </div>
    </div>
);

interface ProfileHubProps {
    onLogout: () => void;
    theme: 'light' | 'dark';
    onThemeChange: (theme: 'light' | 'dark') => void;
}

const ProfileHub: React.FC<ProfileHubProps> = ({ onLogout, theme, onThemeChange }) => {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTab] = useState<'INFO' | 'SECURITY' | 'PREFS'>('INFO');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Edit Form State
    const [formData, setFormData] = useState<Partial<UserProfile>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [followedTournaments, setFollowedTournaments] = useState<Tournament[]>([]);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        if (auth.currentUser) {
            const data = await getUserProfile(auth.currentUser.uid);
            setProfile(data as UserProfile);
            setFormData(data || {});

            // Fetch followed tournaments
            const tournaments = await getVisibleEvents('TOURNAMENT');
            const followed = tournaments.filter((t: any) => t.followers?.includes(auth.currentUser?.uid)) as Tournament[];
            setFollowedTournaments(followed);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        if (!auth.currentUser) {
            console.error("[ProfileHub] Save failed: No authenticated user");
            return;
        }

        setIsSaving(true);
        console.log("[ProfileHub] Attempting to save formData:", formData);

        try {
            // Ensure essential fields are present even if profile document was missing
            const dataToSave = {
                ...formData,
                uid: auth.currentUser.uid,
                email: auth.currentUser.email,
                lastUpdated: new Date().toISOString()
            };

            await updateUserProfile(auth.currentUser.uid, dataToSave);

            const updatedProfile = { ...(profile || {}), ...dataToSave } as UserProfile;
            setProfile(updatedProfile);
            setFormData(updatedProfile);
            setIsEditing(false);

            console.log("[ProfileHub] Save successful");
            alert("Profile updated successfully! ✨");
        } catch (error: any) {
            console.error("[ProfileHub] Save error:", error);
            alert(`Failed to save: ${error.message || 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !auth.currentUser) return;

        setIsUploading(true);
        try {
            const url = await uploadProfileImage(auth.currentUser.uid, file);
            await updateUserProfile(auth.currentUser.uid, { profileImage: url });
            setProfile(prev => prev ? { ...prev, profileImage: url } : null);
            setFormData(prev => ({ ...prev, profileImage: url }));
        } catch (error) {
            console.error("Upload failed", error);
            alert("Failed to upload image.");
        } finally {
            setIsUploading(false);
        }
    };

    const handlePasswordReset = async () => {
        if (!auth.currentUser?.email) return;
        if (confirm("Send password reset email to " + auth.currentUser.email + "?")) {
            try {
                await resetPassword(auth.currentUser.email);
                alert("Reset email sent! Please check your inbox.");
            } catch (error: any) {
                alert("Error: " + error.message);
            }
        }
    };

    const handleDeleteAccount = async () => {
        if (!auth.currentUser) return;
        const msg = "Are you absolutely sure? This will delete your profile data. You will be logged out.";
        if (confirm(msg)) {
            try {
                await deleteUserAccount(auth.currentUser.uid);
                onLogout();
            } catch (error: any) {
                alert("Error deleting account: " + error.message);
            }
        }
    };

    const handlePrefChange = async (key: string, value: any) => {
        const newFormData = { ...formData, [key]: value };
        setFormData(newFormData);
        if (auth.currentUser) {
            await updateUserProfile(auth.currentUser.uid, { [key]: value });
        }
    };

    const handleCancel = () => {
        setFormData(profile || {});
        setIsEditing(false);
    };

    const handleLogoutAll = async () => {
        if (!auth.currentUser) return;
        if (confirm("Are you sure? This will log you out from all other devices.")) {
            const deviceId = localStorage.getItem('device_id') || 'browser';
            try {
                await forceLogoutOthers(auth.currentUser.uid, deviceId);
                alert("Logged out from other devices.");
            } catch (error) {
                console.error("Logout all failed", error);
            }
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }


    return (
        <div className="min-h-screen bg-slate-950 flex flex-col pb-32 max-w-5xl mx-auto w-full">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageChange}
                className="hidden"
                accept="image/*"
            />

            {/* --- HEADER SECTION --- */}
            <div className="relative bg-gradient-to-b from-slate-900 to-slate-950 pb-8 pt-20 px-6 sm:px-10 border-b border-slate-800/50 text-white">
                <div className="absolute top-6 right-6 flex gap-3 z-20">
                    <button
                        onClick={() => isEditing ? handleCancel() : setIsEditing(true)}
                        className={`p-2.5 rounded-xl border transition flex items-center gap-2 text-sm font-bold ${isEditing
                            ? 'bg-amber-500 text-black border-amber-500 shadow-lg shadow-amber-500/20'
                            : 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700'
                            }`}
                    >
                        {isEditing ? <><X className="w-4 h-4" /> Cancel</> : <><Edit2 className="w-4 h-4" /> Edit Profile</>}
                    </button>
                    <button onClick={onLogout} className="p-2.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl hover:bg-red-500 hover:text-white transition">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left relative z-10">
                    <div className="relative group">
                        <div className="w-32 h-32 rounded-[2.5rem] bg-gradient-to-br from-amber-500 via-amber-400 to-amber-600 p-1 shadow-2xl shadow-amber-500/20">
                            <div className="w-full h-full rounded-[2.2rem] bg-slate-900 flex items-center justify-center overflow-hidden relative">
                                {isUploading ? (
                                    <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                                ) : profile?.profileImage ? (
                                    <img src={profile.profileImage} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <User className="w-12 h-12 text-slate-500" />
                                )}
                                {isEditing && (
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="absolute inset-0 bg-black/50 flex items-center justify-center cursor-pointer hover:bg-black/60 transition"
                                    >
                                        <Camera className="w-8 h-8 text-white opacity-80" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-center md:justify-start gap-3">
                            <h1 className="text-3xl md:text-4xl font-black text-white italic tracking-tighter capitalize">
                                {profile?.username || "Scorer"}
                            </h1>
                            {profile?.isVerified && <CheckCircle className="w-6 h-6 text-amber-500 fill-amber-500/10" />}
                        </div>
                        <p className="text-slate-400 font-medium max-w-md mx-auto md:mx-0 leading-relaxed">
                            {profile?.bio || (isEditing ? "Add a bio..." : "Live cricket scorer passionate about data and analytics.")}
                        </p>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex items-center gap-6 mt-12 border-b border-slate-800 overflow-x-auto no-scrollbar">
                    {[
                        { id: 'INFO', label: 'Personal Info', icon: User },
                        { id: 'SECURITY', label: 'Security & Login', icon: Shield },
                        { id: 'PREFS', label: 'App Preferences', icon: Settings },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`pb-4 px-2 text-sm font-bold flex items-center gap-2 transition relative ${activeTab === tab.id ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-amber-500' : ''}`} />
                            {tab.label}
                            {activeTab === tab.id && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-t-full shadow-[0_-2px_8px_rgba(245,158,11,0.5)]"></div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* --- CONTENT SECTION --- */}
            <div className="p-6 sm:p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {activeTab === 'INFO' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <User className="w-5 h-5 text-amber-500" /> Basic Details
                            </h3>
                            <div className="grid gap-6">
                                <InputField label="Username" value={formData.username} onChange={(v: string) => setFormData(prev => ({ ...prev, username: v }))} icon={User} isEditing={isEditing} />
                                <InputField label="Full Name" value={formData.displayName} onChange={(v: string) => setFormData(prev => ({ ...prev, displayName: v }))} isEditing={isEditing} />
                                <InputField label="Bio" value={formData.bio} onChange={(v: string) => setFormData(prev => ({ ...prev, bio: v }))} isEditing={isEditing} />
                            </div>
                        </div>
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Phone className="w-5 h-5 text-amber-500" /> Contact Info
                            </h3>
                            <div className="grid gap-6">
                                <InputField label="Email Address" value={profile?.email} disabled icon={Mail} isEditing={isEditing} />
                                <InputField label="Mobile Number" value={formData.mobileNumber} onChange={(v: string) => setFormData(prev => ({ ...prev, mobileNumber: v }))} icon={Smartphone} isEditing={isEditing} />
                                <InputField label="Location" value={formData.location} onChange={(v: string) => setFormData(prev => ({ ...prev, location: v }))} icon={MapPin} isEditing={isEditing} />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'SECURITY' && (
                    <div className="space-y-8 max-w-2xl text-white">
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                            <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Lock className="w-5 h-5 text-amber-500" /> Password & Auth</h3>
                            <button
                                onClick={handlePasswordReset}
                                className="w-full flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl hover:bg-slate-800 transition group mb-4"
                            >
                                <div className="text-left">
                                    <div className="font-bold group-hover:text-amber-500">Change Password</div>
                                    <div className="text-xs text-slate-500">Send reset link to your email</div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-600" />
                            </button>
                            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl">
                                <div>
                                    <div className="font-bold">Two-Factor Authentication</div>
                                    <div className="text-xs text-slate-500">Persistent security for your account</div>
                                </div>
                                <button
                                    onClick={() => handlePrefChange('is2FAEnabled', !formData.is2FAEnabled)}
                                    className={`w-12 h-6 rounded-full relative transition ${formData.is2FAEnabled ? 'bg-amber-500' : 'bg-slate-700'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${formData.is2FAEnabled ? 'right-1' : 'left-1'}`}></div>
                                </button>
                            </div>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                            <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Smartphone className="w-5 h-5 text-amber-500" /> Management</h3>
                            <button
                                onClick={handleLogoutAll}
                                className="w-full py-3 rounded-xl border border-slate-700 text-slate-400 text-sm font-bold hover:bg-red-500/10 hover:text-red-500 transition flex items-center justify-center gap-2"
                            >
                                <LogOut className="w-4 h-4" /> Log Out All Other Devices
                            </button>
                        </div>

                        <div className="pt-8 border-t border-slate-800">
                            <button onClick={handleDeleteAccount} className="text-red-500 text-sm font-bold flex items-center gap-2 hover:underline">
                                <Trash2 className="w-4 h-4" /> Delete Account
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'PREFS' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-white">
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
                            <h3 className="text-lg font-bold flex items-center gap-2"><Globe className="w-5 h-5 text-amber-500" /> Regional</h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-slate-300">Language</span>
                                    <select
                                        value={formData.language || 'English (US)'}
                                        onChange={(e) => handlePrefChange('language', e.target.value)}
                                        className="bg-slate-800 text-white text-sm font-bold rounded-lg px-3 py-1.5 outline-none border border-slate-700"
                                    >
                                        <option>English (US)</option>
                                        <option>Hindi</option>
                                        <option>Spanish</option>
                                    </select>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-slate-300">Theme</span>
                                    <div className="flex bg-slate-800 p-1 rounded-lg">
                                        {(['dark', 'light'] as const).map(t => (
                                            <button
                                                key={t}
                                                onClick={async () => {
                                                    onThemeChange(t);
                                                    if (auth.currentUser) await updateUserProfile(auth.currentUser.uid, { theme: t });
                                                }}
                                                className={`px-3 py-1 rounded-md text-xs font-bold transition ${theme === t ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'}`}
                                            >
                                                {t.charAt(0).toUpperCase() + t.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
                            <h3 className="text-lg font-bold flex items-center gap-2"><Bell className="w-5 h-5 text-amber-500" /> Notifications</h3>
                            <div className="space-y-4">
                                {(['Email', 'Push', 'Match Updates'] as const).map(item => {
                                    const key = `notif_${item.replace(' ', '').toLowerCase()}`;
                                    const active = formData[key];
                                    return (
                                        <div key={item} className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-slate-300">{item}</span>
                                            <button
                                                onClick={() => handlePrefChange(key, !active)}
                                                className={`w-10 h-6 rounded-full relative transition ${active ? 'bg-amber-500' : 'bg-slate-700'}`}
                                            >
                                                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${active ? 'right-1' : 'left-1'}`}></div>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {isEditing && (
                    <div className="fixed bottom-0 left-0 right-0 bg-slate-900/80 backdrop-blur-md border-t border-slate-800 p-4 z-50">
                        <div className="max-w-5xl mx-auto flex justify-end gap-3">
                            <button onClick={handleCancel} className="px-6 py-3 rounded-xl font-bold text-slate-400 hover:bg-slate-800 transition">Cancel</button>
                            <button onClick={handleSave} disabled={isSaving} className="px-8 py-3 rounded-xl bg-amber-500 text-black font-bold shadow-lg flex items-center gap-2">
                                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                Save Changes
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProfileHub;
