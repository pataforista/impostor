// example.ts
import { ImpostorWordEngine } from "./impostor-word-engine.js";

const engine = new ImpostorWordEngine({
    impostorCount: 1,
    maxRounds: 3,
    seed: 1234,

    enforceOneWord: true,
    forbidRepeatedClues: true,
    normalizeClues: "lower",

    allowSkipVote: true,
    tiePolicy: "NO_ELIMINATION",
    requireAllVotes: true,

    impostorsWinOnSurviveToEnd: true,
    impostorsWinOnParity: true,

    allowImpostorGuess: true,
    impostorGuessTiming: "AFTER_ELIMINATION_REVEAL",
    impostorGuessOutcomeOnWrong: "NOTHING",
    onlyGuessIfEliminated: true, // Suggested improvement
});

engine.on((ev) => {
    switch (ev.type) {
        case "GAME_STARTED":
            console.log(`\n--- GAME STARTED ---`);
            console.log(`Secret word: ${ev.state.secret.word} (${ev.state.secret.category})`);
            break;
        case "PHASE_CHANGED":
            console.log(`\n[Phase: ${ev.phase}]`);
            break;
        case "TURN_CHANGED":
            console.log(`Turn: ${ev.playerId}`);
            break;
        case "CLUE_ACCEPTED":
            console.log(`Clue accepted: ${ev.entry.rawClue} (normalized: ${ev.entry.clue})`);
            break;
        case "VOTE_RESOLVED":
            console.log(`Vote resolved. Eliminated: ${ev.eliminated ?? "None"}`);
            break;
        case "IMPOSTOR_GUESS":
            console.log(`Impostor guess: ${ev.guess} -> ${ev.correct ? "CORRECT!" : "WRONG"}`);
            break;
        case "GAME_ENDED":
            console.log(`\n--- GAME ENDED ---`);
            console.log(`Winner: ${ev.winner}`);
            break;
    }
});

const players = [
    { id: "p1", name: "Ana" },
    { id: "p2", name: "Beto" },
    { id: "p3", name: "Caro" },
    { id: "p4", name: "Diego" },
];

engine.start({
    players,
    secretWord: { word: "Camión", category: "Transporte" },
});

const state = engine.getState();
const impostor = state.players.find(p => p.role === "IMPOSTOR")!;
const crewmates = state.players.filter(p => p.role === "CREWMATE");

console.log(`\nImpostor is: ${impostor.name} (${impostor.id})`);

// Round 1 Clues
engine.submitClue(state.turnOrder[0]!, "Ruedas");
engine.submitClue(state.turnOrder[1]!, "Carga");
engine.submitClue(state.turnOrder[2]!, "Diesel");
engine.submitClue(state.turnOrder[3]!, "Grande");

// Round 1 Voting - Everyone votes for the impostor
players.forEach(p => {
    engine.castVote(p.id, impostor.id);
});

// Since timing is AFTER_ELIMINATION_REVEAL and onlyGuessIfEliminated is true,
// the engine should wait for the impostor to guess.
console.log(`\nImpostor ${impostor.name} tries to guess...`);
engine.impostorGuess(impostor.id, "Camion"); // Correct even with accent difference
