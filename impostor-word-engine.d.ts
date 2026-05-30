export type Id = string;
export type RNG = () => number;
export declare function mulberry32(seed: number): RNG;
export declare function shuffle<T>(arr: T[], rng: RNG): T[];
export declare function sampleOne<T>(arr: T[], rng: RNG): T;
export type Role = "CREWMATE" | "IMPOSTOR";
export type Player = {
    id: Id;
    name: string;
};
export type WordCard = {
    kind: "secret";
    word: string;
    category?: string;
} | {
    kind: "impostor";
};
export type Phase = "SETUP" | "CLUE" | "VOTE" | "REVEAL" | "END";
export type ClueEntry = {
    playerId: Id;
    clue: string;
    rawClue: string;
    atMs: number;
};
export type VoteEntry = {
    voterId: Id;
    targetId: Id | "SKIP";
    atMs: number;
};
export type WinSide = "CREWMATES" | "IMPOSTORS" | "NONE";
export type EngineConfig = {
    impostorCount: number;
    maxRounds: number;
    seed?: number;
    enforceOneWord: boolean;
    forbidRepeatedClues: boolean;
    normalizeClues: "lower" | "none";
    allowSkipVote: boolean;
    tiePolicy: "NO_ELIMINATION" | "ELIMINATE_NONE_BUT_ADVANCE";
    requireAllVotes: boolean;
    impostorsWinOnSurviveToEnd: boolean;
    impostorsWinOnParity: boolean;
    allowImpostorGuess: boolean;
    impostorGuessTiming: "AFTER_CLUES_BEFORE_VOTE" | "AFTER_ELIMINATION_REVEAL";
    impostorGuessOutcomeOnWrong: "NOTHING" | "ELIMINATE_GUESSER";
    onlyGuessIfEliminated?: boolean;
};
export type GameState = {
    phase: Phase;
    round: number;
    ended: boolean;
    players: Array<{
        id: Id;
        name: string;
        role: Role;
        alive: boolean;
        hasGuessed?: boolean;
    }>;
    secret: {
        word: string;
        category?: string;
    };
    turnOrder: Id[];
    currentTurnIndex: number;
    cluesThisRound: ClueEntry[];
    votesThisRound: VoteEntry[];
    usedClueSet: Record<string, true>;
    forbiddenWords: string[];
    eliminatedThisRound: Id | null | undefined;
    winner: WinSide;
};
export type EngineEvent = {
    type: "GAME_STARTED";
    state: GameState;
} | {
    type: "PHASE_CHANGED";
    phase: Phase;
    state: GameState;
} | {
    type: "TURN_CHANGED";
    playerId: Id;
    state: GameState;
} | {
    type: "CLUE_ACCEPTED";
    entry: ClueEntry;
    state: GameState;
} | {
    type: "CLUE_REJECTED";
    reason: string;
    state: GameState;
} | {
    type: "VOTE_CAST";
    entry: VoteEntry;
    state: GameState;
} | {
    type: "VOTE_REJECTED";
    reason: string;
    state: GameState;
} | {
    type: "VOTE_RESOLVED";
    eliminated: Id | null;
    tally: Record<string, number>;
    state: GameState;
} | {
    type: "IMPOSTOR_GUESS";
    playerId: Id;
    guess: string;
    correct: boolean;
    state: GameState;
} | {
    type: "GAME_ENDED";
    winner: WinSide;
    state: GameState;
};
export type Listener = (ev: EngineEvent) => void;
export declare class ImpostorWordEngine {
    private rng;
    private cfg;
    private listeners;
    private state;
    private cardsByPlayer;
    constructor(cfg: EngineConfig);
    on(listener: Listener): () => boolean;
    getState(): GameState;
    /** Returns each player's private card (secret word or impostor). Use in UI per-user. */
    getPrivateCard(playerId: Id): WordCard;
    /** Start a new game with players + secret word or word bank. */
    start(params: {
        players: Player[];
        secretWord?: {
            word: string;
            category?: string;
            forbidden?: string[];
        };
        wordBank?: Array<{
            word: string;
            category?: string;
            forbidden?: string[];
        }>;
        categories?: string[];
        impostorCount?: number;
    }): void;
    /** Submit a one-word clue for the current turn player. */
    submitClue(playerId: Id, clueRaw: string): void;
    /** Optional: impostor attempts to guess the secret word (timing controlled by config). */
    impostorGuess(playerId: Id, guessRaw: string): void;
    /** Cast a vote (target playerId or SKIP). */
    castVote(voterId: Id, targetId: Id | "SKIP"): void;
    /** Resolve vote now (useful if requireAllVotes=false and UI decides when to resolve). */
    resolveVote(): void;
    /** Manually advance from REVEAL to next round/end if we were waiting for a guess. */
    finishReveal(): void;
    private afterRevealAdvance;
    private checkWinConditions;
    private endGame;
    private advanceTurnOrMoveToVote;
    private emitTurn;
    private alivePlayers;
    private isAlive;
    private ensureAlive;
    private ensurePhase;
    private setPhase;
    private ensureTurn;
    private normalizeClue;
    private normalizeCategory;
    private validateClue;
    private eqLoose;
    private emit;
}
//# sourceMappingURL=impostor-word-engine.d.ts.map