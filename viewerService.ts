import { joinLiveMatch, listenToLiveMatch } from "./firebaseService";

export const connectViewerToMatch = async (joinId: string) => {
    try {
        await joinLiveMatch(joinId, (match: any) => {
            console.log("Match Found:", match);

            const realMatchId = match.matchId;

            // Start realtime listener
            listenToLiveMatch(realMatchId, (data: any) => {
                if (!data) {
                    console.log("Match not found");
                    return;
                }

                if (data.waiting) {
                    console.log("Waiting for scorer to start live");
                    return;
                }

                console.log("Live match data:", data);

                // Note: In a real app, you would dispatch this data to a store (Redux/Zustand)
                // or update a React context/state here.
            });
        });
    } catch (error) {
        console.error("Viewer join failed:", error);
        throw error;
    }
};
