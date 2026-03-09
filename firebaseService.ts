import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, doc, setDoc, onSnapshot, getDoc, getDocs, collection, query, where, or, arrayUnion, arrayRemove, updateDoc, memoryLocalCache, serverTimestamp } from 'firebase/firestore';
import { MatchState, UserProfile, ScheduledMatch, Tournament } from '../types';

const firebaseConfig = {
    apiKey: 'AIzaSyCYOlKRsh37n6k2h97dCl6LIBTXkK-Oy-Y',
    appId: '1:1059544521669:web:6af238657eeea18ab889ac',
    messagingSenderId: '1059544521669',
    projectId: 'orange-community',
    authDomain: 'orange-community-bb6be.firebaseapp.com',
    storageBucket: 'orange-community.firebasestorage.app',
    databaseURL: 'https://orange-community-default-rtdb.asia-southeast1.firebasedatabase.app/',
};

export const SRS_CONFIG = {
    SERVER_IP: 'localhost', // User should replace this with their actual server IP
    HTTP_PORT: 1985,
    RTC_PORT: 8000,
    API_PUBLISH: '/rtc/v1/publish/',
    API_PLAY: '/rtc/v1/play/',
    APP: 'live'
};

// --- Firebase Singleton Pattern ---
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Use initializeFirestore with experimentalForceLongPolling to resolve persistent internal assertion errors (ID: ca9/b815)
// related to WebChannel stream desync and IndexedDB persistence corruption.
let db;
try {
    db = initializeFirestore(app, {
        localCache: memoryLocalCache(),
        experimentalForceLongPolling: true // 🔥 Hard fix for stream assertion errors
    });
    console.log("[Firebase] Firestore initialized with Long Polling.");
} catch (e) {
    // If already initialized (common in Vite HMR), get the existing instance
    const { getFirestore } = await import('firebase/firestore');
    db = getFirestore(app);
    console.warn("[Firebase] Firestore was already initialized, using existing instance.");
}

export { db };

export const loginUser = (email, password) => signInWithEmailAndPassword(auth, email, password);

export const loginAnonymous = () => signInAnonymously(auth);

export const resetPassword = (email) => sendPasswordResetEmail(auth, email);

export const generateJoinId = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";

    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return result;
};

export const registerUser = async (email, password, username) => {
    console.log(`[Firebase] Attempting to register user: ${email}`);
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log(`[Firebase] Auth user created: ${user.uid}. Creating profile...`);

        // Create user profile in Firestore
        await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: user.email,
            username: username || email.split('@')[0], // Fallback if not provided
            createdAt: new Date().toISOString(),
            heroRank: Math.floor(Math.random() * 100) + 1, // Mock rank for new users
            matchesPlayed: 0,
            totalPoints: 0
        });
        console.log(`[Firebase] User profile created for: ${user.uid}`);

        return userCredential;
    } catch (error) {
        console.error("[Firebase] Registration error:", error);
        throw error;
    }
};

export const getUserProfile = async (userId: string) => {
    try {
        const docRef = doc(db, 'users', userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        }
        return null;
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return null;
    }
};

export const updateUserProfile = async (uid: string, data: Partial<any>) => {
    try {
        const docRef = doc(db, 'users', uid);
        await setDoc(docRef, {
            ...data,
            lastUpdated: new Date().toISOString()
        }, { merge: true });
    } catch (error) {
        console.error("Error updating profile:", error);
        throw error;
    }
};

export const deleteUserAccount = async (uid: string) => {
    try {
        // 1. Delete Firestore data
        const docRef = doc(db, 'users', uid);
        await setDoc(docRef, {
            status: 'DELETED',
            deletedAt: new Date().toISOString()
        }, { merge: true });

        // 2. Clear sessions
        const sessionRef = doc(db, 'user_sessions', uid);
        await setDoc(sessionRef, { activeDevices: [] }, { merge: true });

        // NOTE: Actual Auth deletion requires re-authentication, 
        // which would breaking the current UX session. 
        // We'll mark as deleted and the app will handle logout.
        return true;
    } catch (error) {
        console.error("Error deleting user account:", error);
        throw error;
    }
};

export const uploadProfileImage = async (uid: string, file: File) => {
    // Mock implementation as requested or until Storage is set up
    // In real app: storage.ref(`profiles/${uid}`).put(file)
    console.log("Uploading file for", uid, file.name);
    return Promise.resolve("https://via.placeholder.com/150");
};

/**
 * Syncs the match state to Firestore.
 * This should be called by the "Scorer" whenever the state changes locally.
 */
export const pushMatchState = async (matchId: string, state: Partial<MatchState>) => {
    // Technical IDs (UUIDs) are always lowercase in our Firestore schema
    const safeId = matchId.toLowerCase();
    try {
        const docRef = doc(db, 'matches', safeId);
        const sanitizedState = JSON.parse(JSON.stringify(state));

        const updateData = {
            ...sanitizedState,
            lastUpdated: new Date().toISOString()
        };

        // Try update first (prefers existing document permissions)
        try {
            await updateDoc(docRef, updateData);
        } catch (updateErr: any) {
            // If it doesn't exist, create it with setDoc
            if (updateErr.code === 'not-found') {
                const creatorInfo = auth.currentUser ? {
                    creatorId: auth.currentUser.uid,
                    creatorName: auth.currentUser.displayName || 'System'
                } : {};
                await setDoc(docRef, {
                    ...updateData,
                    ...creatorInfo,
                    matchId: safeId
                }, { merge: true });
            } else {
                throw updateErr;
            }
        }
    } catch (error) {
        console.error("Firestore Push Error:", error);
        throw error;
    }
};

/* ===============================
   Start Live Match
================================ */
export const startLiveMatch = async (matchId: string, streamId: string) => {
    try {
        const safeMatchId = matchId.toLowerCase();
        const matchRef = doc(db, "matches", safeMatchId);

        const joinId = generateJoinId();

        await setDoc(matchRef, {
            matchId: safeMatchId,
            joinId: joinId,
            streamId: streamId,
            status: "LIVE",
            isLive: true,
            liveStreamType: "LIVE",

            createdAt: serverTimestamp(),
            startedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),

            creatorId: auth.currentUser?.uid || "anonymous",
            creatorName: auth.currentUser?.displayName || "System"
        }, { merge: true });

        console.log("Live match started:", safeMatchId);
        return joinId;
    } catch (error) {
        console.error("Failed to start live match:", error);
        throw error;
    }
};

// ⏹ Stop live match
export const stopLiveMatch = async (matchId: string) => {
    const docRef = doc(db, "matches", matchId);
    await updateDoc(docRef, {
        status: "ENDED",
        broadcastId: null,
        streamId: null,   // 🔥 SRS Stream ID
        isLive: false,    // 🔥 Reset live flag
        liveStreamType: "ENDED",
        endedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
    });

    await updateScheduledMatchStatus(matchId, "COMPLETED").catch(() => { });
};

// 👀 Viewer listens for match
export const listenToLiveMatch = (matchId: string, callback: (data: any) => void) => {
    const safeId = matchId.toLowerCase();

    const docRef = doc(db, "matches", safeId);

    return onSnapshot(docRef, (snapshot) => {
        if (!snapshot.exists()) {
            callback(null);
            return;
        }

        const data = snapshot.data();

        if (data.status === "LIVE") {
            callback(data);
        } else {
            callback({
                status: data.status,
                waiting: true
            });
        }
    });
};

// 🆔 Check match ID (Robust lookup by joinId OR document ID)
export const checkMatchExists = async (joinId: string) => {
    try {
        const trimmed = joinId.trim();
        const upperCode = trimmed.toUpperCase();
        const lowCode = trimmed.toLowerCase();

        // 1. Try direct document lookup (Technical ID / UUID)
        for (const colName of ["matches", "scheduled_matches"]) {
            const directRef = doc(db, colName, lowCode);
            const directSnap = await getDoc(directRef);
            if (directSnap.exists()) {
                return { id: directSnap.id, ...directSnap.data() };
            }
        }

        // 2. Try Join ID field lookup
        for (const colName of ["matches", "scheduled_matches"]) {
            const q = query(
                collection(db, colName),
                where("joinId", "==", upperCode)
            );
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                const found = snapshot.docs[0];
                return { id: found.id, ...found.data() };
            }
        }

        return null;
    } catch (error) {
        console.error("Error checking match:", error);
        return null;
    }
};

export const joinLiveMatch = async (joinId: string, callback: (data: any) => void) => {
    const upperCode = joinId.toUpperCase();

    const q = query(
        collection(db, "matches"),
        where("joinId", "==", upperCode)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        throw new Error("Match ID not found");
    }

    const foundDoc = snapshot.docs[0];
    const data = foundDoc.data();

    if (data.status !== "LIVE") {
        throw new Error("Match is not live");
    }

    callback({
        matchId: foundDoc.id,
        ...data
    });
};

export const endLiveMatch = async (matchId: string) => {
    try {
        const safeMatchId = matchId.toLowerCase();

        const matchRef = doc(db, "matches", safeMatchId);

        await updateDoc(matchRef, {
            status: "ENDED",
            isLive: false,    // 🔥 Reset live flag
            streamId: null,   // 🔥 SRS Stream ID
            endedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
        });

        await updateScheduledMatchStatus(safeMatchId, "COMPLETED").catch(() => { });
    } catch (error) {
        console.error("Error ending match:", error);
    }
};

/**
 * Listen for real-time updates to a match state.
 * This should be used by "Viewers" to update their local state.
 */
export const listenMatchState = (matchId: string, onUpdate: (state: MatchState) => void) => {
    const safeId = matchId.toLowerCase();
    const docRef = doc(db, 'matches', safeId);
    return onSnapshot(docRef, (doc) => {
        if (doc.exists()) {
            onUpdate(doc.data() as MatchState);
        }
    });
};

/**
 * Fetches the initial match state from Firestore.
 */
export const fetchMatchState = async (matchId: string): Promise<MatchState | null> => {
    const safeId = matchId.toLowerCase();
    console.log(`[Firebase] Fetching match state for ID: ${safeId}`);
    try {
        // 1. Try 'matches' collection first (Live matches)
        const docRef = doc(db, 'matches', safeId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            console.log(`[Firebase] Live match found for ID: ${safeId}`);
            return docSnap.data() as MatchState;
        }

        // 2. Fallback to 'scheduled_matches' collection
        const schedRef = doc(db, 'scheduled_matches', safeId);
        const schedSnap = await getDoc(schedRef);
        if (schedSnap.exists()) {
            console.log(`[Firebase] Scheduled match found for ID: ${safeId}`);
            return schedSnap.data() as any as MatchState;
        }

        console.warn(`[Firebase] Match ID ${safeId} not found in any collection.`);
        return null;
    } catch (error) {
        console.error(`[Firebase] Error fetching match state for ID ${safeId}:`, error);
        return null;
    }
};


/**
 * Checks if the user can log in with the current device.
 * Enforces a maximum of 2 devices.
 */
export const checkAndRegisterDevice = async (userId: string, deviceId: string, email: string): Promise<{ allowed: boolean; message?: string }> => {
    const sessionRef = doc(db, 'user_sessions', userId);
    try {
        const sessionSnap = await getDoc(sessionRef);

        if (!sessionSnap.exists()) {
            // First time login for this user
            await setDoc(sessionRef, {
                email,
                activeDevices: [deviceId],
                lastLogin: new Date().toISOString()
            });
            return { allowed: true };
        }

        const data = sessionSnap.data();
        const activeDevices: string[] = data.activeDevices || [];

        // Check if this device is already registered
        if (activeDevices.includes(deviceId)) {
            // Update last login
            await setDoc(sessionRef, { lastLogin: new Date().toISOString() }, { merge: true });
            return { allowed: true };
        }

        // Check limit
        if (activeDevices.length < 2) {
            // Add new device
            await setDoc(sessionRef, {
                activeDevices: [...activeDevices, deviceId],
                lastLogin: new Date().toISOString()
            }, { merge: true });
            return { allowed: true };
        }

        // Limit exceeded
        return {
            allowed: false,
            message: "Device limit exceeded. You are already logged in on 2 devices."
        };

    } catch (error) {
        console.error("Session Check Error:", error);
        // FAIL OPEN: If DB is unreachable or permissions fail, allow login to prevent lockout.
        return { allowed: true };
    }
};

/**
 * Force logs out other devices by clearing the session list and keeping only the current one.
 */
export const forceLogoutOthers = async (userId: string, deviceId: string) => {
    const sessionRef = doc(db, 'user_sessions', userId);
    await setDoc(sessionRef, {
        activeDevices: [deviceId], // Reset to just this one
        lastLogin: new Date().toISOString()
    }, { merge: true });
};

/**
 * Creates a new pre-match event (Tournament or Scheduled Match)
 */
export const createPreMatchEvent = async (type: 'TOURNAMENT' | 'MATCH', data: any) => {
    try {
        const collectionName = type === 'TOURNAMENT' ? 'tournaments' : 'scheduled_matches';
        const safeId = data.id.toLowerCase();
        const docRef = doc(db, collectionName, safeId);
        await setDoc(docRef, {
            ...data,
            id: safeId,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
        });
        return true;
    } catch (error) {
        console.error(`Error creating ${type}:`, error);
        throw error;
    }
};

/**
 * Fetches all events visible to the current user (All Public + User's Private)
 */
export const getVisibleEvents = async (type: 'TOURNAMENT' | 'MATCH', userId?: string) => {
    try {
        const collectionName = type === 'TOURNAMENT' ? 'tournaments' : 'scheduled_matches';
        let q;
        if (userId) {
            const publicQ = query(collection(db, collectionName), where('visibility', '==', 'PUBLIC'));
            const privateQ = query(collection(db, collectionName), where('creatorId', '==', userId));

            const [publicSnap, privateSnap] = await Promise.all([
                getDocs(publicQ),
                getDocs(privateQ)
            ]);

            const resultsMap = new Map();
            publicSnap.docs.forEach(doc => {
                const safeId = doc.id.toLowerCase();
                resultsMap.set(safeId, { id: safeId, ...doc.data() });
            });
            privateSnap.docs.forEach(doc => {
                const safeId = doc.id.toLowerCase();
                resultsMap.set(safeId, { id: safeId, ...doc.data() });
            });

            return Array.from(resultsMap.values());
        }
        else {
            q = query(collection(db, collectionName), where('visibility', '==', 'PUBLIC'));
        }

        const querySnapshot = await getDocs(q!);
        return querySnapshot.docs.map((doc: any) => ({
            id: doc.id.toLowerCase(),
            ...doc.data()
        }));
    } catch (error) {
        console.error(`Error fetching ${type}s:`, error);
        return [];
    }
};

/**
 * Toggles follow status for a tournament
 */
export const toggleFollowTournament = async (tournamentId: string, userId: string, isFollowing: boolean) => {
    try {
        const docRef = doc(db, 'tournaments', tournamentId);
        await updateDoc(docRef, {
            followers: isFollowing ? arrayRemove(userId) : arrayUnion(userId)
        });
        return true;
    } catch (error) {
        console.error("Error toggling follow:", error);
        return false;
    }
};

/**
 * Searches for a user by mobile number.
 * Only returns users who have 'isDiscoverableByPhone' enabled.
 */
export const searchUserByPhone = async (phoneNumber: string): Promise<UserProfile[]> => {
    try {
        const q = query(
            collection(db, 'users'),
            where('mobileNumber', '==', phoneNumber),
            where('isDiscoverableByPhone', '==', true)
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
    } catch (error) {
        console.error("Error searching user by phone:", error);
        return [];
    }
};

/**
 * Cancels a pre-match event (Tournament or Scheduled Match)
 */
export const cancelPreMatchEvent = async (type: 'TOURNAMENT' | 'MATCH', eventId: string) => {
    try {
        const collectionName = type === 'TOURNAMENT' ? 'tournaments' : 'scheduled_matches';
        const safeId = eventId.toLowerCase();
        const docRef = doc(db, collectionName, safeId);
        await updateDoc(docRef, {
            status: 'CANCELLED',
            lastUpdated: new Date().toISOString()
        });
        return true;
    } catch (error) {
        console.error(`Error cancelling ${type}:`, error);
        throw error;
    }
};

/**
 * Updates the status of a scheduled match (e.g., to LIVE or COMPLETED)
 */
export const updateScheduledMatchStatus = async (matchId: string, status: 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED') => {
    return updateScheduledMatchFields(matchId, { status });
};

/**
 * Updates any fields of a scheduled match
 */
export const updateScheduledMatchFields = async (matchId: string, fields: Partial<ScheduledMatch>) => {
    const safeId = matchId.toLowerCase();
    try {
        console.log(`[Firebase] Updating scheduled match ${safeId} fields:`, Object.keys(fields));
        const docRef = doc(db, 'scheduled_matches', safeId);

        // Try update first
        try {
            await updateDoc(docRef, {
                ...fields,
                lastUpdated: new Date().toISOString()
            });
        } catch (updateErr: any) {
            if (updateErr.code === 'not-found') {
                await setDoc(docRef, {
                    ...fields,
                    createdAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString(),
                    creatorId: auth.currentUser?.uid || 'anonymous'
                }, { merge: true });
            } else {
                throw updateErr;
            }
        }
        return true;
    } catch (error) {
        console.warn(`[Firebase] Could not update scheduled match ${safeId}.`, error);
        throw error; // Throw so UI can handle it
    }
};

export default db;
