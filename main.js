import { ImpostorWordEngine } from "./impostor-word-engine.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// 1. Configuration
const config = {
    impostorCount: 1,
    maxRounds: 1,
    seed: 12345,
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
    onlyGuessIfEliminated: true,
};
const selectedCategories = ["Trastornos", "Neurociencia"];
const difficultyFilter = 3;
const desiredPlayerCount = 4;
const desiredImpostorCount = 1;
// 2. Load Dataset
const datasetPath = path.join(__dirname, "impostor_deck_200_v1_1_normalizado.json");
const rawData = fs.readFileSync(datasetPath, "utf-8");
const dataset = JSON.parse(rawData);
// 3. Prepare Word Bank
const wordBank = dataset.cards
    .filter((card) => card.dificultad <= difficultyFilter)
    .map((card) => ({
    word: card.palabra_secreta,
    category: card.categoria,
    forbidden: card.prohibidas,
}));
// 4. Initialize Engine
const engine = new ImpostorWordEngine(config);
engine.on((ev) => {
    if (ev.type === "GAME_STARTED") {
        console.log(`\n=== IMPOSTOR: PSYCHIATRY EDITION ===`);
        console.log(`Category: ${ev.state.secret.category}`);
    }
    if (ev.type === "TURN_CHANGED") {
        const pl = ev.state.players.find(p => p.id === ev.playerId);
        console.log(`\n> Turn: ${pl?.name}`);
    }
    if (ev.type === "CLUE_ACCEPTED") {
        console.log(`  Clue: "${ev.entry.rawClue}"`);
    }
    if (ev.type === "CLUE_REJECTED") {
        console.log(`  [X] REJECTED: ${ev.reason}`);
    }
    if (ev.type === "VOTE_RESOLVED") {
        const elim = ev.state.players.find(p => p.id === ev.eliminated);
        console.log(`\n[Vote] Eliminated: ${elim ? elim.name : "None"}`);
    }
    if (ev.type === "IMPOSTOR_GUESS") {
        const pl = ev.state.players.find(p => p.id === ev.playerId);
        console.log(`\n[Guess] ${pl?.name} guessed: "${ev.guess}"`);
        console.log(`  Result: ${ev.correct ? "CORRECT! Impostors win." : "WRONG."}`);
    }
    if (ev.type === "GAME_ENDED") {
        console.log(`\n--- GAME OVER ---`);
        console.log(`Winner: ${ev.winner}`);
        console.log(`Secret word was: ${ev.state.secret.word}`);
    }
});
// 5. Start Game
const players = [
    { id: "1", name: "Dra. Ana" },
    { id: "2", name: "Dr. Beto" },
    { id: "3", name: "Estudiante Caro" },
    { id: "4", name: "Residente Diego" },
].slice(0, desiredPlayerCount);
engine.start({
    players,
    wordBank,
    categories: selectedCategories,
    impostorCount: desiredImpostorCount,
});
// 6. Simulate Interaction
const state = engine.getState();
const currentPlayerId = state.turnOrder[0];
// Submit First Clue
engine.submitClue(currentPlayerId, "Atención");
// Try First Forbidden Word from the active card
const forbiddenClue = state.forbiddenWords[0] || "diagnóstico";
console.log(`\n(Simulating) Next player tries forbidden word: "${forbiddenClue}"`);
engine.submitClue(state.turnOrder[1], forbiddenClue);
// Continue with valid clues
engine.submitClue(state.turnOrder[1], "Memoria");
engine.submitClue(state.turnOrder[2], "Alzheimer");
engine.submitClue(state.turnOrder[3], "Temporal");
// Vote for the impostor (let's find him)
const impostor = state.players.find(p => p.role === "IMPOSTOR");
players.forEach(p => engine.castVote(p.id, impostor.id));
// Impostor Guesses
console.log(`\n(Simulating) Impostor ${impostor.name} makes final guess...`);
engine.impostorGuess(impostor.id, state.secret.word);
//# sourceMappingURL=main.js.map