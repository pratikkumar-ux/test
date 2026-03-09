import { GoogleGenerativeAI } from "@google/generative-ai";
import { MatchState, BallLog } from "../types";

const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export const getMatchAnalysis = async (state: MatchState): Promise<string> => {
    try {
        const prompt = `Analyze this cricket match state and provide a brief, professional summary (max 3 sentences):
    Inning: ${state.inning}
    Team Batting: ${state.teamBatting.name} (${state.totalRuns}/${state.totalWickets} in ${state.oversBowled}.${state.ballsBowledInCurrentOver} overs)
    Team Bowling: ${state.teamBowling.name}
    Target: ${state.target || "N/A"}
    Max Overs: ${state.maxOvers}
    Last 6 balls: ${state.currentOverLogs.map(l => l.runsScored).join(", ")}`;

        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error("Analysis Error:", error);
        return "AI analysis currently unavailable.";
    }
};

export const getBallCommentary = async (log: BallLog): Promise<string> => {
    try {
        const prompt = `Write a short, exciting cricket commentary line for this ball:
    Batsman: ${log.batsmanName}
    Bowler: ${log.bowlerName}
    Result: ${log.runsScored} runs ${log.wicketType !== 'NONE' ? `(Wicket: ${log.wicketType})` : ''} ${log.extrasType !== 'NONE' ? `(Extra: ${log.extrasType})` : ''}`;

        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error("Commentary Error:", error);
        return "Great ball!";
    }
};
