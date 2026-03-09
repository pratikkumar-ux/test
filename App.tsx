import React, { useState, useEffect } from 'react';
import { Home, Users, User, Video, List, Activity, Sparkles, PlusCircle, Settings, MapPin, Play, Check, X, Radio, Camera, Trophy, Layers, Copy, Tv, Type, Eye, CheckCircle2, RefreshCw, Zap, Club, Moon, Sunset, Monitor, Award, Layout, Smartphone, CloudRain, Sun, Cloud, Wind, WifiOff } from 'lucide-react';

import MatchSetupWizard from './components/MatchSetupWizard';
import ScoreControl from './components/ScoreControl';
import ScoreCard from './components/ScoreCard';
import Login from './components/Login';
import LiveHub from './components/LiveHub';
import EventDashboard from './components/EventDashboard';
import ProfileHub from './components/ProfileHub';
import WagonWheel from './components/WagonWheel';
import MatchActions from './components/MatchActions';
import LandingPage from './components/LandingPage';
import BroadcastManager from './components/BroadcastManager';
import CameraOperator from './components/CameraOperator';
import ScoreTicker from './components/ScoreTicker';
import { MatchState, Player, Team, BallLog, ExtrasType, WicketType } from './types';
import { getMatchAnalysis, getBallCommentary } from './services/geminiService';
import { pushMatchState, listenMatchState, fetchMatchState, startLiveMatch, stopLiveMatch, listenToLiveMatch, checkMatchExists, auth, getUserProfile, updateScheduledMatchFields, generateJoinId, loginAnonymous } from './services/firebaseService';
import { onAuthStateChanged } from 'firebase/auth';

// --- Helper Functions (Mock Data) ---
const createPlayer = (id: string, name: string): Player => ({
  id, name, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, onStrike: false,
  oversBowled: 0, runsConceded: 0, wickets: 0, maidens: 0
});

const createTeam = (name: string, logo?: string | null, customPlayers: string[] = [], playerCount: number = 11): Team => {
  const players = Array.from({ length: playerCount }).map((_, i) => {
    const playerName = customPlayers[i] || `${name} Player ${i + 1} `;
    return createPlayer(`${name} -${i} `, playerName);
  });
  return {
    name,
    logo: logo || undefined,
    players
  };
};


export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('isLoggedIn') === 'true');
  const [authLoading, setAuthLoading] = useState(true);
  const [showLanding, setShowLanding] = useState(!isLoggedIn);
  const [currentTab, setCurrentTab] = useState<'HOME' | 'MATCH' | 'PROFILE'>('HOME');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('theme') as 'light' | 'dark') || 'dark');

  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showScorecard, setShowScorecard] = useState(false);
  const [showLiveHub, setShowLiveHub] = useState(false);
  const [showMatchActions, setShowMatchActions] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [historyStack, setHistoryStack] = useState<MatchState[]>([]);
  const [userRole, setUserRole] = useState<'SCORER' | 'VIEWER'>(() => (localStorage.getItem('userRole') as 'SCORER' | 'VIEWER') || 'SCORER');
  const [matchId, setMatchId] = useState<string | null>(() => localStorage.getItem('matchId'));
  const [isCreator, setIsCreator] = useState(() => localStorage.getItem('isCreator') === 'true');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const [showBowlerSelector, setShowBowlerSelector] = useState(false);
  const [showBroadcastManager, setShowBroadcastManager] = useState(false);
  const [showCameraOperator, setShowCameraOperator] = useState(false);
  const [showScoreTicker, setShowScoreTicker] = useState(false);
  const [showWicketModal, setShowWicketModal] = useState(false);
  const [pendingWicketAngle, setPendingWicketAngle] = useState<number | undefined>(undefined);
  const [joinMatchId, setJoinMatchId] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // --- Session & Persistence Logic ---

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setIsLoggedIn(!!user);
      if (user) {
        const profile = await getUserProfile(user.uid);
        if (profile?.theme) {
          setTheme(profile.theme as 'light' | 'dark');
        }
      } else {
        setShowLanding(true);
        setMatchId(null);
        setMatchState(null);
      }
      setAuthLoading(false);
    });
    return () => {
      try { unsub(); } catch (e) { console.warn("Ignored Auth listener unmount assertion", e); }
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('isLoggedIn', isLoggedIn.toString());
  }, [isLoggedIn]);

  useEffect(() => {
    localStorage.setItem('userRole', userRole);
  }, [userRole]);

  useEffect(() => {
    localStorage.setItem('isCreator', isCreator.toString());
  }, [isCreator]);

  useEffect(() => {
    if (matchId) {
      localStorage.setItem('matchId', matchId);
    } else {
      localStorage.removeItem('matchId');
      setIsCreator(false);
    }
  }, [matchId]);

  // Handle Refresh/Close warning for Scorer
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (matchState && userRole === 'SCORER' && !matchState.isMatchOver) {
        e.preventDefault();
        e.returnValue = "Match is live. Refreshing may interrupt scoring.";
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [matchState, userRole]);

  // Initial Auto-Resume Hydration & Tab Switch Sync
  useEffect(() => {
    const restoreMatch = async () => {
      // Hydrate if we have an ID but no state, OR if we are on the MATCH tab and state is missing (for Scorers)
      if (matchId && (!matchState || currentTab === 'MATCH')) {
        setIsRestoring(true);
        const savedState = await fetchMatchState(matchId);
        if (savedState) {
          setMatchState(savedState);
        } else {
          // DO NOT clear matchId here. If it was a scheduled match being set up,
          // it won't exist in the 'matches' collection yet.
          // setMatchId(null); // REMOVED to fix race condition
          console.log("[App] Match state not found in 'matches' yet, preserving ID for setup.");
        }
        setIsRestoring(false);
      }
    };
    restoreMatch();
  }, [currentTab, matchId]); // Run on tab switch to ensure state is fresh

  // --- Sync State (Viewer) ---
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (matchId && userRole === 'VIEWER') {
      console.log(`[App] Subscribing to match updates for ${matchId}`);
      unsubscribe = listenMatchState(matchId, (newState) => {
        if (!newState) return;
        console.log("[App] Received match update:", newState.liveStreamType);
        setMatchState(newState);
      });
    }

    return () => {
      if (unsubscribe) {
        console.log("[App] Unsubscribing from match updates");
        try { unsubscribe(); } catch (e) { console.warn("Ignored match listener unmount assertion", e); }
      }
    };
  }, [matchId, userRole]);


  const updateMatchState = async (newState: Partial<MatchState>, forceId?: string) => {
    setMatchState(prev => {
      if (!prev) return newState as MatchState;
      return { ...prev, ...newState };
    });
    const activeId = forceId || matchId;
    if (userRole === 'SCORER' && activeId && (isCreator || true)) { // Allow scorer to sync even if creator flag missed
      setIsSyncing(true);
      setSyncError(null);
      try {
        await pushMatchState(activeId, newState);
      } catch (err) {
        setSyncError("Sync failed. Check connection.");
      } finally {
        setIsSyncing(false);
      }
    }
  };


  // --- Match Logic ---

  const startMatch = async (config: any) => {
    // Determine which team bats first to assign opening players correctly
    const isTeamABatting = (config.tossWinner === config.teamA && config.tossDecision === 'BAT') ||
      (config.tossWinner === config.teamB && config.tossDecision === 'BOWL');

    const battingTeamName = isTeamABatting ? config.teamA : config.teamB;
    const bowlingTeamName = isTeamABatting ? config.teamB : config.teamA;
    const battingTeamLogo = isTeamABatting ? config.teamALogo : config.teamBLogo;
    const bowlingTeamLogo = isTeamABatting ? config.teamBLogo : config.teamALogo;

    // Create teams with custom opening players
    const teamBatting = createTeam(battingTeamName, battingTeamLogo, [config.striker, config.nonStriker]);
    const teamBowling = createTeam(bowlingTeamName, bowlingTeamLogo, [config.bowler]);

    const striker = teamBatting.players[0];
    const nonStriker = teamBatting.players[1];
    const bowler = teamBowling.players[0];

    if (!striker || !nonStriker || !bowler) {
      alert("Error initializing match: Incomplete player data.");
      return;
    }

    striker.onStrike = true;
    nonStriker.onStrike = false;

    const initialState: MatchState = {
      inning: 1,
      teamBatting: teamBatting,
      teamBowling: teamBowling,
      totalRuns: 0,
      totalWickets: 0,
      oversBowled: 0,
      ballsBowledInCurrentOver: 0,
      currentOverLogs: [],
      allLogs: [],
      maxOvers: config.overs,
      strikerId: striker.id,
      nonStrikerId: nonStriker.id,
      currentBowlerId: bowler.id,
      isMatchOver: false,
      venue: config.venue,
      venueLocation: config.venueLocation,
      tossWinner: config.tossWinner,
      tossDecision: config.tossDecision,
      broadcastTheme: 'CLASSIC_BROADCAST',
      tickerTheme: 'MODERN',
      ballType: config.ballType,
      activeCameraId: 'cam-1',
      cameras: [{ id: 'cam-1', name: 'Main Camera', status: 'OFFLINE' }],
      status: 'LIVE',
      creatorId: auth.currentUser?.uid || 'anonymous',
      creatorName: auth.currentUser?.displayName || 'System'
    };

    let nextMatchId = matchId || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10) + Date.now().toString(36));
    nextMatchId = nextMatchId.toLowerCase();

    setIsCreator(true);
    setUserRole('SCORER');

    // 🔥 Standardized Live Start with 6-char Join ID
    try {
      const generatedJoinId = await startLiveMatch(nextMatchId, 'cam-1');
      initialState.joinId = generatedJoinId;

      await updateMatchState(initialState, nextMatchId);

      console.log("Share this Join ID with viewers:", generatedJoinId);
      alert("Match is LIVE\nJoin ID: " + generatedJoinId);
    } catch (err) {
      console.error("Start match error:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      alert("Failed to start live match: " + errorMessage + "\n\nPlease check your permissions or network connection.");
      return;
    }

    setMatchId(nextMatchId);
    setHistoryStack([]);
    setShowSetupWizard(false);
    setCurrentTab('MATCH');
  };

  const handleJoinMatch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!joinMatchId.trim()) return;

    setIsJoining(true);
    const id = joinMatchId.trim().toUpperCase();
    console.log(`[UI] Attempting to join match with ID: ${id} `);

    try {
      const savedState = await checkMatchExists(id) as (MatchState & { id?: string }) | null;
      if (savedState) {
        const actualDocId = savedState.id || id;
        console.log(`[UI] Join successful. Resolved ID: ${id} -> DocID: ${actualDocId}`);
        alert(`Successfully joined Match: ${id}`);

        if (savedState.status === 'ENDED' || savedState.liveStreamType === 'ENDED') {
          console.log(`[UI] Note: Match ${actualDocId} has already ended.`);
        }

        setMatchId(actualDocId);
        setMatchState(savedState);
        setUserRole('VIEWER');
        setIsCreator(false);
        setJoinMatchId('');
        setShowLanding(false);
        setCurrentTab('MATCH');

        // Automatically show the LiveHub (video player) if it's a live match
        if (savedState.status === 'LIVE' || savedState.liveStreamType === 'LIVE') {
          setShowLiveHub(true);
        }
      } else {
        console.warn(`[UI] Join failed. Match ID "${id}" was not found via Document ID or field-level JoinID search.`);
        alert(`Match ID "${id}" not found.\n\nPlease verify the ID with the scorer and try again.\n(Note: IDs are case-insensitive)`);
      }
    } catch (err) {
      console.error("[UI] Unexpected error during join:", err);
      alert("An unexpected error occurred. Please try again.");
    } finally {
      setIsJoining(false);
    }
  };

  const saveToHistory = (state: MatchState) => {
    setHistoryStack(prev => [...prev.slice(-10), JSON.parse(JSON.stringify(state))]);
  };

  const handleThemeChange = (theme: MatchState['broadcastTheme']) => {
    if (!matchState) return;
    const newState = { ...matchState, broadcastTheme: theme };
    setMatchState(newState);
    updateMatchState(newState);
  };

  const handleUndo = () => {
    if (historyStack.length > 0) {
      const previousState = historyStack[historyStack.length - 1];
      updateMatchState(previousState);
      setHistoryStack(prev => prev.slice(0, -1));
    }
  };

  const handleEndInnings = () => {
    if (!matchState) return;
    saveToHistory(matchState);

    if (matchState.inning === 2) {
      handleEndMatch();
      return;
    }

    const newState: MatchState = JSON.parse(JSON.stringify(matchState));

    newState.inning = 2;
    newState.target = newState.totalRuns + 1;

    const tempTeam = newState.teamBatting;
    newState.teamBatting = newState.teamBowling;
    newState.teamBowling = tempTeam;

    newState.totalRuns = 0;
    newState.totalWickets = 0;
    newState.oversBowled = 0;
    newState.ballsBowledInCurrentOver = 0;
    newState.currentOverLogs = [];
    newState.allLogs = [];

    if (!newState.teamBatting?.players || newState.teamBatting.players.length < 2) {
      alert("Incomplete team data. Please check team rosters.");
      return;
    }

    newState.teamBatting.players.forEach(p => p.onStrike = false);
    newState.teamBatting.players[0].onStrike = true;
    newState.strikerId = newState.teamBatting.players[0].id;
    newState.nonStrikerId = newState.teamBatting.players[1].id;

    // newState.currentBowlerId = newState.teamBowling.players[0].id; // Don't auto-set, let user pick
    setShowBowlerSelector(true); // Trigger selection for first over of new innings

    updateMatchState(newState);
    setShowMatchActions(false);
  };

  const handleEndMatch = async () => {
    if (!matchState) return;

    if (userRole === 'SCORER' && matchId) {
      // 1. Mark as over and stop stream in Cloud
      const finalState: MatchState = {
        ...matchState,
        isMatchOver: true,
        liveStreamType: 'NONE',
        broadcastId: undefined
      };
      await updateMatchState(finalState);
    }

    // 2. Clear local session
    setMatchState(null); // Clear active match
    setMatchId(null); // Clear from persistence
    setCurrentTab('HOME'); // Navigate to Home
    setShowMatchActions(false);
    setShowLiveHub(false); // Close LiveHub for Scorer as well
  };

  const handleLeaveMatch = () => {
    setMatchState(null);
    setMatchId(null);
    setCurrentTab('HOME');
    setShowLiveHub(false);
    setShowScorecard(false);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setShowLanding(true);
    setUserRole('SCORER');
    setMatchId(null);
    setMatchState(null);
    localStorage.clear();
  };

  const handleRun = async (runs: number, angle?: number) => {
    if (!matchState || matchState.isMatchOver) return;
    saveToHistory(matchState);

    const shotAngle = angle !== undefined ? angle : Math.floor(Math.random() * 360);

    const newState = JSON.parse(JSON.stringify(matchState));
    const striker = newState.teamBatting.players.find((p: Player) => p.id === newState.strikerId);
    const bowler = newState.teamBowling.players.find((p: Player) => p.id === newState.currentBowlerId);

    if (!striker || !bowler) return;

    newState.totalRuns += runs;
    striker.runs += runs;
    striker.balls += 1;
    if (runs === 4) striker.fours++;
    if (runs === 6) striker.sixes++;

    bowler.runsConceded += runs;
    newState.ballsBowledInCurrentOver++;

    const log: BallLog = {
      over: newState.oversBowled,
      ballInOver: newState.ballsBowledInCurrentOver,
      bowlerName: bowler.name,
      batsmanName: striker.name,
      runsScored: runs,
      extrasType: ExtrasType.NONE,
      extraRuns: 0,
      wicketType: WicketType.NONE,
      isLegalBall: true,
      shotAngle: shotAngle
    };

    getBallCommentary(log).then(text => setAiAnalysis(text));

    newState.currentOverLogs.push(log);
    newState.allLogs.push(log);

    if (runs % 2 !== 0) {
      const temp = newState.strikerId;
      newState.strikerId = newState.nonStrikerId;
      newState.nonStrikerId = temp;
      newState.teamBatting.players.forEach((p: Player) => { p.onStrike = p.id === newState.strikerId; });
    }

    checkOverComplete(newState);
    checkMatchEnd(newState);
    updateMatchState(newState);
  };

  const handleExtra = (type: ExtrasType) => {
    if (!matchState || matchState.isMatchOver) return;
    saveToHistory(matchState);

    const newState = JSON.parse(JSON.stringify(matchState));
    const bowler = newState.teamBowling.players.find((p: Player) => p.id === newState.currentBowlerId);
    if (!bowler) return;

    if (type === ExtrasType.WIDE || type === ExtrasType.NO_BALL) {
      newState.totalRuns += 1;
      bowler.runsConceded += 1;
    } else {
      newState.ballsBowledInCurrentOver++;
      newState.totalRuns += 1;
    }

    const log: BallLog = {
      over: newState.oversBowled,
      ballInOver: newState.ballsBowledInCurrentOver,
      bowlerName: bowler.name,
      batsmanName: "Extras",
      runsScored: 0,
      extrasType: type,
      extraRuns: 1,
      wicketType: WicketType.NONE,
      isLegalBall: type === ExtrasType.BYE || type === ExtrasType.LEG_BYE
    };

    newState.currentOverLogs.push(log);
    newState.allLogs.push(log);
    checkOverComplete(newState);
    updateMatchState(newState);
  };

  const handleWicket = (angle?: number) => {
    if (!matchState || matchState.isMatchOver) return;
    setPendingWicketAngle(angle);
    setShowWicketModal(true);
  };

  const confirmWicket = (data: {
    type: WicketType;
    batsmanId: string;
    fielderName?: string;
  }) => {
    if (!matchState) return;
    saveToHistory(matchState);

    const newState = JSON.parse(JSON.stringify(matchState));
    const striker = newState.teamBatting.players.find((p: Player) => p.id === newState.strikerId);
    const nonStriker = newState.teamBatting.players.find((p: Player) => p.id === newState.nonStrikerId);
    const bowler = newState.teamBowling.players.find((p: Player) => p.id === newState.currentBowlerId);

    if (!striker || !bowler) return;

    const outPlayer = newState.teamBatting.players.find((p: Player) => p.id === data.batsmanId);
    if (!outPlayer) return;

    // 1. Mark player as out
    outPlayer.isOut = true;
    if (data.type !== WicketType.RETIRED_HURT) {
      newState.totalWickets += 1;
    }
    // Store dismissal type on player for scorecard display
    outPlayer.wicketType = data.type;
    outPlayer.fielderName = data.fielderName;

    // 2. Statistics Attribution
    if (data.type !== WicketType.RETIRED_OUT && data.type !== WicketType.RETIRED_HURT) {
      striker.balls += 1; // Only striker's balls increment on a delivery (unless wide/nb, handled separately)
      newState.ballsBowledInCurrentOver += 1;

      // Credit bowler for specific types
      if (data.type === WicketType.BOWLED ||
        data.type === WicketType.LBW ||
        data.type === WicketType.CAUGHT ||
        data.type === WicketType.STUMPED ||
        data.type === WicketType.HIT_WICKET) {
        bowler.wickets += 1;
      }
    }

    // 3. Create Log
    const log: BallLog = {
      over: newState.oversBowled,
      ballInOver: newState.ballsBowledInCurrentOver,
      bowlerName: bowler.name,
      batsmanName: outPlayer.name,
      runsScored: 0,
      extrasType: ExtrasType.NONE,
      extraRuns: 0,
      wicketType: data.type,
      isLegalBall: true,
      shotAngle: pendingWicketAngle !== undefined ? pendingWicketAngle : Math.floor(Math.random() * 360),
      fielderName: data.fielderName
    };
    newState.currentOverLogs.push(log);
    newState.allLogs.push(log);

    // 4. Fill Crease / Handle All Out
    if (newState.totalWickets < 10) {
      const remainingPlayers = newState.teamBatting.players.filter((p: Player) => !p.isOut && p.id !== newState.strikerId && p.id !== newState.nonStrikerId);
      const nextPlayer = remainingPlayers[0];

      if (nextPlayer) {
        if (data.batsmanId === newState.strikerId) {
          newState.strikerId = nextPlayer.id;
        } else {
          newState.nonStrikerId = nextPlayer.id;
        }
        nextPlayer.onStrike = true; // Temporary, will be cleared/set below
      }
    } else {
      newState.strikerId = null;
      newState.nonStrikerId = null;
      if (newState.inning === 2) {
        newState.isMatchOver = true;
      }
    }

    // Update onStrike flags
    newState.teamBatting.players.forEach((p: Player) => {
      p.onStrike = p.id === newState.strikerId;
    });

    setShowWicketModal(false);
    setPendingWicketAngle(undefined);

    checkOverComplete(newState);
    checkMatchEnd(newState);
    updateMatchState(newState);
  };

  const checkOverComplete = (state: MatchState) => {
    if (state.ballsBowledInCurrentOver >= 6) {
      state.oversBowled += 1;
      state.ballsBowledInCurrentOver = 0;
      const bowler = state.teamBowling.players.find((p: Player) => p.id === state.currentBowlerId);
      if (bowler) bowler.oversBowled++;

      const temp = state.strikerId;
      state.strikerId = state.nonStrikerId;
      state.nonStrikerId = temp;

      // REMOVED AUTO ROTATION
      // const currentBowlerIdx = state.teamBowling.players.findIndex((p: Player) => p.id === state.currentBowlerId);
      // const nextBowlerIdx = (currentBowlerIdx - 1 + state.teamBowling.players.length) % state.teamBowling.players.length;
      // state.currentBowlerId = state.teamBowling.players[nextBowlerIdx].id;

      // Trigger Selector Modal instead, BUT we can't set state hook here directly if passing 'state' object around.
      // We need to set the state in the component. 
      // checkOverComplete modifies 'state' in place. 
      // We'll set a flag in the state or just rely on the component's 'oversBowled' change effect?
      // Better: Just set the local state hook to show modal.
      if (state.oversBowled < state.maxOvers) {
        setShowBowlerSelector(true);
      }

      triggerAIAnalysis(state);
    }
  };

  const checkMatchEnd = (state: MatchState) => {
    // 10 Wicket All-Out
    if (state.totalWickets >= 10) {
      if (state.inning === 2) {
        state.isMatchOver = true;
        state.winner = state.totalRuns >= (state.target || 0) ? state.teamBatting.name : state.teamBowling.name;
        if (state.totalRuns === (state.target || 0) - 1) state.winner = "Tie";
      }
      return;
    }

    if (state.target && state.totalRuns >= state.target) {
      state.isMatchOver = true;
      state.winner = state.teamBatting.name;
      return;
    }

    if (state.oversBowled >= state.maxOvers) {
      if (state.inning === 2) {
        state.isMatchOver = true;
        if (state.totalRuns >= (state.target || 0)) state.winner = state.teamBatting.name;
        else if (state.totalRuns < ((state.target || 0) - 1)) state.winner = state.teamBowling.name;
        else state.winner = "Tie";
      }
    }
  };

  const triggerAIAnalysis = async (state: MatchState) => {
    setIsAnalyzing(true);
    const analysis = await getMatchAnalysis(state);
    setAiAnalysis(analysis);
    setIsAnalyzing(false);
  };

  const handleSelectBowler = (bowlerId: string) => {
    if (!matchState) return;
    const newState = { ...matchState, currentBowlerId: bowlerId };
    updateMatchState(newState);
    setShowBowlerSelector(false);
  };

  // --- Render Views ---

  if (showLanding && !showCameraOperator) {
    return (
      <LandingPage
        onGetStarted={() => setShowLanding(false)}
      />
    );
  }

  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} onGuestAccess={() => { setShowLanding(false); setUserRole('VIEWER'); setIsLoggedIn(true); }} />;
  }

  // Active Match View
  const renderMatchTab = () => {
    if (showSetupWizard) return <MatchSetupWizard onStartMatch={startMatch} onCancel={() => setShowSetupWizard(false)} />;

    if (!matchState || !matchState.teamBatting) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-950">
          <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-6 border border-amber-500/20">
            <Radio className="w-8 h-8 text-amber-500" />
          </div>

          <h2 className="text-2xl font-black text-white mb-2 italic uppercase">
            {matchId ? `MATCH ID: ${matchId} ` : 'No Match Active'}
          </h2>


          {matchState?.joinId && !matchState.teamBatting && (
            <div className="mb-6 px-6 py-3 bg-slate-900 border border-amber-500/30 rounded-2xl text-amber-500 font-mono tracking-widest uppercase flex flex-col items-center gap-1">
              <span className="text-[8px] font-black opacity-60 uppercase tracking-widest mb-1">Shareable Join ID</span>
              <span className="text-xl font-black">{matchState.joinId}</span>
            </div>
          )}

          <p className="text-slate-500 mb-8 max-w-xs font-bold text-xs uppercase tracking-widest leading-relaxed">
            {matchId
              ? `Ready to start match ${matchId}? Set up teams and overs to begin professional scoring.`
              : 'Create or join a match to start professional cricket scoring with real-time sync and live match updates.'}
          </p>

          <div className="flex bg-slate-900 p-1.5 rounded-2xl mb-8 border border-slate-800 w-full max-w-sm">
            <button
              onClick={() => {
                if (matchId && !isCreator) {
                  alert("You joined this match as a Viewer. Only the Scorer can control the match.");
                  return;
                }
                setUserRole('SCORER');
              }}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-[10px] uppercase tracking-widest transition ${userRole === 'SCORER' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-slate-500 hover:text-white'} ${(matchId && !isCreator) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Scorer
            </button>
            <button
              onClick={() => setUserRole('VIEWER')}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-[10px] uppercase tracking-widest transition ${userRole === 'VIEWER' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-slate-500 hover:text-white'}`}
            >
              Viewer
            </button>
          </div>

          {userRole === 'SCORER' && (
            <button
              onClick={() => setShowSetupWizard(true)}
              className="bg-amber-500 hover:bg-amber-600 text-black px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-amber-500/20 flex items-center gap-3 transition active:scale-95"
            >
              <PlusCircle className="w-5 h-5" />
              {matchId ? 'Setup Match' : 'Start New Match'}
            </button>
          )}

          {userRole === 'VIEWER' && (
            <form onSubmit={handleJoinMatch} className="w-full max-w-sm flex flex-col gap-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter Match ID"
                  value={joinMatchId}
                  onChange={(e) => setJoinMatchId(e.target.value.toUpperCase())}
                  maxLength={6} // 🆔 6-character Join ID system
                  className="w-full bg-slate-900 border border-slate-800 text-white px-6 py-4 rounded-xl outline-none focus:border-amber-500 transition text-center font-black tracking-[0.2em] text-2xl uppercase placeholder:text-slate-700 placeholder:tracking-normal placeholder:font-normal placeholder:text-lg"
                />
              </div>
              <button
                type="submit"
                disabled={isJoining || joinMatchId.length < 6}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-black px-8 py-4 rounded-xl font-bold shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition"
              >
                {isJoining ? (
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Activity className="w-5 h-5" />
                )}
                Join Live Match
              </button>
            </form>
          )}
        </div>
      );
    }

    const striker = matchState.teamBatting.players.find(p => p.id === matchState.strikerId) || matchState.teamBatting.players[0];
    const nonStriker = matchState.teamBatting.players.find(p => p.id === matchState.nonStrikerId) || matchState.teamBatting.players[1];
    const bowler = matchState.teamBowling.players.find(p => p.id === matchState.currentBowlerId) || matchState.teamBowling.players[0];


    return (
      <div className="flex flex-col h-full bg-slate-950 relative">
        {/* Header */}
        <div className="bg-slate-900 border-b border-amber-500/20 p-3 sm:p-4 shadow-lg z-10 sticky top-0">
          <div className="flex justify-between items-start mb-4 gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em]">{matchState.venue || 'LIVE MATCH'}</span>
                  {matchState.joinId && (
                    <button
                      onClick={() => {
                        if (matchState.joinId) navigator.clipboard.writeText(matchState.joinId);
                        alert("Match ID Copied! 📋");
                      }}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 border border-white/5 rounded text-[9px] text-amber-500 font-mono tracking-widest uppercase flex items-center gap-1.5 transition group"
                    >
                      ID: {matchState.joinId}
                      <Copy className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100 transition" />
                    </button>
                  )}
                </div>
                <h1 className="text-2xl font-black text-white italic tracking-tight uppercase flex items-center gap-2">
                  <div className="flex items-center gap-2 shrink-0">
                    {matchState.teamBatting.logo && <img src={matchState.teamBatting.logo} className="w-6 h-6 rounded-full object-cover bg-white" alt="Team A" />}
                    <span>{matchState.teamBatting.name}</span>
                  </div>
                  <span className="text-slate-700 not-italic text-sm">VS</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span>{matchState.teamBowling.name}</span>
                    {matchState.teamBowling.logo && <img src={matchState.teamBowling.logo} className="w-6 h-6 rounded-full object-cover bg-white" alt="Team B" />}
                  </div>
                </h1>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-4xl font-bold tracking-tight text-white">
                  {matchState.totalRuns}<span className="text-amber-500 text-2xl">/{matchState.totalWickets}</span>
                </span>
                <span className="text-slate-400 font-medium">
                  ({matchState.oversBowled}.{matchState.ballsBowledInCurrentOver} / {matchState.maxOvers} Ov)
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {matchState.inning === 2 && matchState.target && (
                  <span>Target: {matchState.target} • Need <span className="text-amber-500">{matchState.target - matchState.totalRuns}</span> runs in {(matchState.maxOvers * 6) - (matchState.oversBowled * 6 + matchState.ballsBowledInCurrentOver)} balls</span>
                )}
                {matchState.inning === 1 && (
                  <span>CRR: {(matchState.totalRuns / Math.max(1, matchState.oversBowled + matchState.ballsBowledInCurrentOver / 6)).toFixed(2)}</span>
                )}
              </div>
            </div>
            {/* Header Actions */}
            <div className="flex items-center gap-2">
              {userRole === 'SCORER' && (
                <button
                  onClick={() => setShowMatchActions(true)}
                  className="p-2 rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition"
                >
                  <Settings className="w-5 h-5" />
                </button>
              )}

              {userRole === 'VIEWER' && matchId && (
                <button
                  onClick={handleLeaveMatch}
                  className="px-3 py-2 bg-slate-800 hover:bg-red-600/20 text-slate-400 hover:text-red-500 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-700 transition"
                >
                  Leave
                </button>
              )}

              {userRole === 'SCORER' && (!matchState || !matchState.isMatchOver) && (
                <button
                  onClick={() => setShowBroadcastManager(true)}
                  className={`p-2 rounded-full border transition ${matchState?.liveStreamType === 'LIVE'
                    ? 'bg-red-600 border-red-500 text-white animate-pulse shadow-lg shadow-red-600/20'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700'
                    }`}
                  title="Go Live"
                >
                  <Radio className="w-5 h-5" />
                </button>
              )}
              {userRole === 'SCORER' && (
                <button
                  onClick={() => setShowCameraOperator(true)}
                  className="p-2 bg-amber-500/10 border border-amber-500/50 rounded-lg hover:bg-amber-500/20 transition group flex items-center gap-2"
                  title="Contribute as Camera"
                >
                  <Camera className="w-5 h-5 text-amber-500 group-hover:scale-110 transition-transform" />
                  <span className="hidden lg:inline text-[10px] font-black text-amber-500 uppercase tracking-widest">Add Angle</span>
                </button>
              )}
              {userRole === 'VIEWER' && matchState?.liveStreamType === 'LIVE' && (
                <button
                  onClick={() => setShowLiveHub(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg shadow-lg hover:bg-red-500 transition-all active:scale-95 animate-pulse"
                >
                  <Video className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Watch Live</span>
                </button>
              )}
              <button
                onClick={() => setShowScoreTicker(!showScoreTicker)}
                className={`p - 2 border rounded - lg transition ${showScoreTicker ? 'bg-amber-500/20 border-amber-500/50 text-amber-500' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white'} `}
                title="Toggle Score Ticker"
              >
                <Layers className="w-5 h-5" />
              </button>
              <button onClick={() => setShowScorecard(true)} className="p-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition" title="Scorecard"><List className="w-5 h-5 text-white" /></button>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-3 backdrop-blur-sm border border-slate-700">
            <div className="flex justify-between text-sm mb-2 pb-2 border-b border-slate-700/50">
              <div className="flex-1">
                <div className="flex items-center gap-1 font-semibold text-white">
                  {striker?.name} <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]"></span>
                </div>
                <div className="text-slate-400 text-xs">{striker?.runs}({striker?.balls})</div>
              </div>
              <div className="text-right flex-1 opacity-70">
                <div className="font-medium text-slate-300">{nonStriker?.name}</div>
                <div className="text-slate-500 text-xs">{nonStriker?.runs}({nonStriker?.balls})</div>
              </div>
            </div>
            <div className="text-sm flex justify-between items-center">
              <div className="flex items-center gap-2"><span className="text-slate-500 text-xs uppercase tracking-wider">Bowler</span><span className="font-medium text-white">{bowler?.name || 'Bowler'}</span></div>
              <div className="text-xs bg-slate-900 border border-slate-700 text-slate-300 px-2 py-1 rounded">{bowler?.wickets || 0}-{bowler?.runsConceded || 0} <span className="opacity-60">({bowler?.oversBowled || 0}.{matchState.ballsBowledInCurrentOver || 0})</span></div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pb-80 sm:pb-96 bg-slate-900 pb-safe">

          <div className="p-4 max-w-2xl mx-auto w-full">
            {/* Wagon Wheel */}
            <div className="bg-slate-900 p-4 rounded-3xl shadow-xl border border-slate-800/50 backdrop-blur-md">
              <h4 className="text-[10px] font-black text-slate-500 uppercase mb-4 text-center tracking-[0.2em]">Wagon Wheel</h4>
              <div className="max-w-[280px] sm:max-w-xs mx-auto">
                <WagonWheel logs={matchState.allLogs || []} />
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="p-4 pt-0 max-w-2xl mx-auto w-full">
            <h4 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-[0.2em]">Live Timeline</h4>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-4 -mx-1 px-1">
              {[...(matchState.allLogs || [])].reverse().slice(0, 15).map((log, i) => (
                <div key={i} className="flex-shrink-0 flex flex-col items-center">
                  <div className={`w - 12 h - 12 rounded - 2xl flex items - center justify - center font - black text - sm shadow - xl border - 2 transition - transform active: scale - 90
                      ${log.wicketType !== WicketType.NONE ? 'bg-red-500/10 border-red-500/50 text-red-500' :
                      log.runsScored === 4 ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' :
                        log.runsScored === 6 ? 'bg-amber-500/10 border-amber-500/50 text-amber-500' :
                          log.extrasType !== ExtrasType.NONE ? 'bg-slate-800 border-slate-700 text-slate-300' :
                            'bg-slate-800/50 border-slate-800 text-slate-500'
                    } `}>
                    {log.wicketType !== WicketType.NONE ? 'W' :
                      log.extrasType !== ExtrasType.NONE ? (log.extrasType === ExtrasType.WIDE ? 'WD' : 'NB') :
                        log.runsScored}
                  </div>
                  <span className="text-[9px] font-bold text-slate-600 mt-2 tracking-tighter">{log.over}.{log.ballInOver}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Score Ticker (Broadcast) */}
        {
          matchState && showScoreTicker && (
            <div className="fixed bottom-[88px] md:bottom-0 left-0 right-0 md:left-72 z-40 animate-in slide-in-from-bottom duration-500">
              <ScoreTicker matchState={matchState} matchId={matchId} />
            </div>
          )
        }

        {/* Broadcast Manager Modals */}
        {
          showBroadcastManager && matchState && matchId && (
            <BroadcastManager
              matchId={matchId}
              matchState={matchState}
              onClose={() => setShowBroadcastManager(false)}
              onUpdateMatch={updateMatchState}
            />
          )
        }

        {/* Controls (Scorer Only) */}
        {
          userRole === 'SCORER' && (
            <div className={`fixed ${showScoreTicker ? 'bottom-56 md:bottom-28' : 'bottom-32 md:bottom-16'} left-0 right-0 md:left-72 z-50 px-4 pointer-events-none transition-all duration-500 ease-in-out`}>
              <div className="max-w-lg mx-auto pointer-events-auto">
                <ScoreControl
                  onRun={handleRun}
                  onExtra={handleExtra}
                  onWicket={handleWicket}
                  onUndo={handleUndo}
                  onThemeChange={handleThemeChange}
                  currentTheme={matchState.broadcastTheme}
                  disabled={matchState.isMatchOver || matchState.oversBowled >= matchState.maxOvers}
                />
              </div>
            </div>
          )
        }

        {/* Match Over / Innings End Overlays */}
        {
          matchState && (matchState.isMatchOver || matchState.oversBowled >= matchState.maxOvers) && (
            <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-500">
              <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-[40px] p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
                {/* Decorative Background */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50"></div>

                <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto border border-amber-500/20">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full bg-amber-500"></div>
                  </div>
                </div>

                <div>
                  <h2 className="text-3xl font-black text-white mb-2 italic">
                    {matchState.isMatchOver ? 'MATCH OVER' : 'INNINGS ENDED'}
                  </h2>
                  <div className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                    {matchState.teamBatting.name} {matchState.totalRuns}/{matchState.totalWickets} ({matchState.oversBowled}.{matchState.ballsBowledInCurrentOver})
                  </div>
                </div>

                {matchState.isMatchOver && matchState.winner && (
                  <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800">
                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">Result</div>
                    <div className="text-xl font-bold text-amber-500">{matchState.winner} Won</div>
                  </div>
                )}

                {matchState.inning === 1 && !matchState.isMatchOver && userRole === 'SCORER' && (
                  <div className="space-y-4">
                    <div className="text-sm text-slate-400 leading-relaxed">
                      First innings completed. {matchState.teamBowling.name} needs <span className="text-amber-500 font-bold">{matchState.totalRuns + 1}</span> runs to win.
                    </div>
                    <button
                      onClick={handleEndInnings}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-black font-black py-4 rounded-2xl shadow-lg shadow-amber-500/20 transition active:scale-95"
                    >
                      START SECOND INNINGS
                    </button>
                  </div>
                )}
                {matchState.isMatchOver && (
                  <button
                    onClick={handleEndMatch}
                    className="w-full bg-slate-800 hover:bg-slate-750 text-white font-bold py-4 rounded-2xl transition active:scale-95"
                  >
                    RETURN TO HOME
                  </button>
                )}
              </div>
            </div>
          )
        }

        {/* Login Modal */}
        {
          showLanding && !isLoggedIn && !showCameraOperator && (
            <Login
              onLogin={() => setIsLoggedIn(true)}
              onGuestAccess={async () => {
                try {
                  await loginAnonymous();
                  setShowLanding(false);
                  setUserRole('VIEWER');
                } catch (err) {
                  console.error("Guest login failed:", err);
                  alert("Failed to join as guest. Please check your connection.");
                }
              }}
              onCameraOperator={() => setShowCameraOperator(true)}
            />
          )
        }



        {/* Landing Page (If not logged in and not showing login modal) */}
        {/* Bowler Selector Modal */}
        {
          showBowlerSelector && matchState && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-slate-900 w-full max-w-sm mx-4 p-6 rounded-3xl border border-slate-800 shadow-2xl flex flex-col max-h-[80vh]">
                <h3 className="text-xl font-bold text-white mb-6 text-center">Select Next Bowler</h3>
                <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar pr-2">
                  {(matchState.teamBowling?.players || []).map(player => (
                    <button
                      key={player.id}
                      onClick={() => handleSelectBowler(player.id)}
                      disabled={player.id === matchState.currentBowlerId}
                      className={`w-full p-6 rounded-xl flex justify-between items-center transition border ${matchState.currentBowlerId === player.id ? 'bg-amber-500 border-amber-400 shadow-lg shadow-amber-500/20' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}
                    >
                      <span className="font-bold">{player.name}</span>
                      <div className="text-xs text-slate-400">
                        {player.oversBowled} overs • {player.runsConceded}/{player.wickets}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )
        }
      </div >
    );
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="w-16 h-16 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mb-6"></div>
        <h2 className="text-2xl font-black text-white italic mb-2 tracking-tight">INITIALIZING</h2>
        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest opacity-50">Authenticating with Pro Scorer Cloud...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-950 w-full overflow-hidden font-sans text-slate-200">

      {/* Desktop Sidebar Navigation */}
      <div className="hidden md:flex flex-col w-72 bg-slate-950/50 backdrop-blur-2xl border-r border-white/5 p-8 relative z-50">
        <div className="flex items-center gap-4 mb-12">
          <div>
            <h1 className="font-black text-2xl text-white tracking-tighter italic font-heading">PRO SCORER</h1>
          </div>
        </div>

        <nav className="flex-1 space-y-3">
          {[
            { id: 'HOME', label: 'Dashboard', icon: Home },
            { id: 'MATCH', label: 'Live Match', icon: Play },
            { id: 'PROFILE', label: 'My Career', icon: User },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id as any)}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-xl font-black uppercase tracking-widest text-[11px] transition ${currentTab === item.id ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}
            >
              <item.icon className={`w-5 h-5 ${currentTab === item.id ? 'fill-current' : ''} `} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-8 border-t border-white/5">
          <div className="bg-slate-900/50 rounded-[22px] p-1.5 flex relative border border-white/5">
            <div
              className={`absolute inset-y-1.5 w-[48%] bg-brand-primary rounded-[18px] transition-all duration-500 ease-out shadow-lg ${userRole === 'VIEWER' ? 'left-[49%] ml-0.5' : 'left-1.5'}`}
            ></div>
            <button
              onClick={() => {
                if (matchId && !isCreator) {
                  alert("You joined this match as a Viewer. Only the Scorer can control the match.");
                  return;
                }
                setUserRole('SCORER');
              }}
              className={`flex-1 relative z-10 text-[10px] font-black uppercase tracking-widest py-3 rounded-[18px] transition-colors duration-300 ${userRole === 'SCORER' ? 'text-slate-950' : 'text-slate-500'} ${(matchId && !isCreator) ? 'opacity-30 cursor-not-allowed' : ''}`}
            >
              Scorer
            </button>
            <button
              onClick={() => setUserRole('VIEWER')}
              className={`flex-1 relative z-10 text-[10px] font-black uppercase tracking-widest py-3 rounded-[18px] transition-colors duration-300 ${userRole === 'VIEWER' ? 'text-slate-950' : 'text-slate-500'}`}
            >
              Viewer
            </button>
          </div>
          <p className="text-[10px] text-center text-slate-600 mt-4 font-black uppercase tracking-[0.2em] opacity-40">Role Management</p>
        </div>


      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative mesh-gradient">
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative z-10">
          <div className="max-w-7xl mx-auto w-full h-full p-4 md:p-8">
            {currentTab === 'HOME' && (
              <EventDashboard onSelectMatch={(id, role) => {
                setMatchId(id);
                setUserRole(role);
                setIsCreator(role === 'SCORER');
                setMatchState(null);
                setCurrentTab('MATCH');
              }} />
            )}
            {currentTab === 'MATCH' && renderMatchTab()}
            {currentTab === 'PROFILE' && <ProfileHub onLogout={handleLogout} theme={theme} onThemeChange={setTheme} />}
          </div>
        </div>

        {/* Mobile Bottom Navigation - Glass Effect */}
        <div className="md:hidden h-20 glass-premium border-t border-white/5 flex items-center justify-around pb-2 z-50 absolute bottom-0 w-full px-4 rounded-t-[32px]">
          <button
            onClick={() => setCurrentTab('HOME')}
            className={`flex flex-col items-center gap-1 p-2 transition-all duration-300 ${currentTab === 'HOME' ? 'text-brand-primary scale-110' : 'text-slate-400 opacity-60'}`}
          >
            <Home className={`w-6 h-6 ${currentTab === 'HOME' ? 'fill-current' : ''}`} />
            <span className="text-[10px] font-black uppercase tracking-widest">Home</span>
          </button>
          <button
            onClick={() => setCurrentTab('MATCH')}
            className={`flex flex-col items-center gap-1 p-2 transition-all duration-300 ${currentTab === 'MATCH' ? 'text-brand-primary scale-110' : 'text-slate-400 opacity-60'}`}
          >
            <div className={`p-2 rounded-2xl ${currentTab === 'MATCH' ? 'bg-brand-primary/10 shadow-lg shadow-brand-primary/20' : ''}`}>
              <Play className="w-8 h-8 fill-current" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest mt-1">Match</span>
          </button>

          <button
            onClick={() => setCurrentTab('PROFILE')}
            className={`flex flex-col items-center gap-1 p-2 transition-all duration-300 ${currentTab === 'PROFILE' ? 'text-brand-primary scale-110' : 'text-slate-400 opacity-60'}`}
          >
            <User className={`w-6 h-6 ${currentTab === 'PROFILE' ? 'fill-current' : ''}`} />
            <span className="text-[10px] font-black uppercase tracking-widest">Profile</span>
          </button>
        </div>
      </div>

      {/* Modals Overlays */}
      {showCameraOperator && (
        <CameraOperator
          onBack={() => setShowCameraOperator(false)}
          initialMatchId={matchId || undefined}
          initialJoinId={matchState?.cameraJoinId || undefined}
        />
      )}
      {showScorecard && matchState && <ScoreCard team={matchState.teamBatting} matchState={matchState} onClose={() => setShowScorecard(false)} />}
      {showLiveHub && matchState && matchId && (
        <LiveHub
          matchState={matchState}
          matchId={matchId}
          onUpdateMatch={updateMatchState}
          userRole={userRole}
          onClose={() => setShowLiveHub(false)}
          onLeaveMatch={userRole === 'VIEWER' ? handleLeaveMatch : undefined}
        />
      )}
      {showMatchActions && matchState && <MatchActions matchState={matchState} onEndInnings={handleEndInnings} onEndMatch={handleEndMatch} onClose={() => setShowMatchActions(false)} />}

      {showWicketModal && matchState && (
        <React.Suspense fallback={<div className="fixed inset-0 bg-black/50 z-[150]" />}>
          {(() => {
            const striker = matchState.teamBatting.players.find(p => p.id === matchState.strikerId);
            const nonStriker = matchState.teamBatting.players.find(p => p.id === matchState.nonStrikerId);
            if (!striker || !nonStriker) return null; // CRITICAL: Prevent crash if players aren't found yet
            return (
              <WicketDetailsModal
                striker={striker}
                nonStriker={nonStriker}
                onConfirm={confirmWicket}
                onCancel={() => setShowWicketModal(false)}
              />
            );
          })()}
        </React.Suspense>
      )}

      {isRestoring && (
        <div className="fixed inset-0 z-[200] bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-6"></div>
          <h2 className="text-2xl font-black text-white italic mb-2 tracking-tight">RESTORING MATCH</h2>
          <p className="text-slate-400 text-sm">Resuming live match data from cloud state...</p>
        </div>
      )}
    </div >
  );
}

// --- Specialized Components ---

interface WicketDetailsModalProps {
  striker: Player;
  nonStriker: Player;
  onConfirm: (data: { type: WicketType, batsmanId: string, fielderName?: string }) => void;
  onCancel: () => void;
}

const WicketDetailsModal: React.FC<WicketDetailsModalProps> = ({ striker, nonStriker, onConfirm, onCancel }) => {
  const [type, setType] = useState<WicketType>(WicketType.CAUGHT);
  const [batsmanId, setBatsmanId] = useState(striker.id);
  const [fielderName, setFielderName] = useState('');

  const types = [
    { id: WicketType.BOWLED, label: 'Bowled', credit: true },
    { id: WicketType.CAUGHT, label: 'Caught', credit: true, fielder: true },
    { id: WicketType.LBW, label: 'LBW', credit: true },
    { id: WicketType.RUN_OUT, label: 'Run Out', credit: false, fielder: true, choice: true },
    { id: WicketType.STUMPED, label: 'Stumped', credit: true },
    { id: WicketType.HIT_WICKET, label: 'Hit Wicket', credit: true },
    { id: WicketType.RETIRED_OUT, label: 'Retired Out', credit: false, choice: true },
    { id: WicketType.RETIRED_HURT, label: 'Retired Hurt', credit: false, choice: true },
  ];

  return (
    <div className="fixed inset-0 z-[150] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in duration-300">
      <div className="bg-slate-900 w-full max-w-md rounded-[40px] border border-slate-800 shadow-2xl p-8 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent"></div>

        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-black text-white italic tracking-tight">WICKET DETAILS</h2>
          <button onClick={onCancel} className="p-2 hover:bg-slate-800 rounded-full transition text-slate-500"><X /></button>
        </div>

        <div className="space-y-6">
          {/* Dismissal Type */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Mode of Dismissal</label>
            <div className="grid grid-cols-2 gap-2">
              {types.map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    setType(t.id);
                    if (!t.choice) setBatsmanId(striker.id);
                  }}
                  className={`p-3 rounded-2xl text-xs font-bold transition border ${type === t.id ? 'bg-red-500 border-red-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Batsman Selection (Only for Run Out etc) */}
          {types.find(t => t.id === type)?.choice && (
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Player Out</label>
              <div className="flex gap-2">
                {[striker, nonStriker].map(p => (
                  <button
                    key={p.id}
                    onClick={() => setBatsmanId(p.id)}
                    className={`flex-1 p-4 rounded-2xl text-sm font-bold transition border ${batsmanId === p.id ? 'bg-white border-white text-slate-950' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fielder Name */}
          {types.find(t => t.id === type)?.fielder && (
            <div className="animate-in fade-in slide-in-from-top-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Fielder Name (Optional)</label>
              <input
                type="text"
                placeholder="Enter fielder name..."
                value={fielderName}
                onChange={(e) => setFielderName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white focus:outline-none focus:border-red-500 transition"
              />
            </div>
          )}

          <button
            onClick={() => onConfirm({ type, batsmanId, fielderName })}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-black py-5 rounded-3xl shadow-xl shadow-red-500/20 transition flex items-center justify-center gap-3 active:scale-95"
          >
            CONFIRM WICKET <Check className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};