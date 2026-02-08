// impostor-word-engine.ts
// UI-agnostic engine for "secret word + impostor" (Among Us tabletop style).
export function mulberry32(seed) {
    let t = seed >>> 0;
    return () => {
        t += 0x6D2B79F5;
        let x = Math.imul(t ^ (t >>> 15), 1 | t);
        x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
}
export function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const temp = a[i];
        a[i] = a[j];
        a[j] = temp;
    }
    return a;
}
export function sampleOne(arr, rng) {
    if (!arr.length)
        throw new Error("sampleOne: empty array");
    const res = arr[Math.floor(rng() * arr.length)];
    if (res === undefined)
        throw new Error("sampleOne: undefined result");
    return res;
}
export class ImpostorWordEngine {
    rng;
    cfg;
    listeners = new Set();
    state;
    cardsByPlayer = {};
    constructor(cfg) {
        if (cfg.impostorCount < 1)
            throw new Error("impostorCount must be >= 1");
        if (cfg.maxRounds < 1)
            throw new Error("maxRounds must be >= 1");
        this.cfg = cfg;
        this.rng = mulberry32((cfg.seed ?? Date.now()) | 0);
    }
    on(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    getState() {
        return JSON.parse(JSON.stringify(this.state));
    }
    /** Returns each player's private card (secret word or impostor). Use in UI per-user. */
    getPrivateCard(playerId) {
        const card = this.cardsByPlayer[playerId];
        if (!card)
            throw new Error("Unknown playerId");
        return JSON.parse(JSON.stringify(card));
    }
    /** Start a new game with players + secret word or word bank. */
    start(params) {
        const { players } = params;
        if (players.length < 3)
            throw new Error("Need at least 3 players");
        const impostorCount = params.impostorCount ?? this.cfg.impostorCount;
        if (impostorCount < 1)
            throw new Error("impostorCount must be >= 1");
        if (impostorCount >= players.length)
            throw new Error("impostorCount must be < players.length");
        let wordBank = params.wordBank ?? [];
        if (params.categories?.length) {
            const categorySet = new Set(params.categories.map(category => this.normalizeCategory(category)));
            wordBank = wordBank.filter(card => card.category ? categorySet.has(this.normalizeCategory(card.category)) : false);
        }
        const secret = params.secretWord ??
            (wordBank.length ? sampleOne(wordBank, this.rng) : null);
        if (!secret)
            throw new Error("Provide secretWord or non-empty wordBank");
        // Assign roles
        const ids = players.map(p => p.id);
        const shuffled = shuffle(ids, this.rng);
        const impostorIds = new Set(shuffled.slice(0, impostorCount));
        // Normalize forbidden words
        const forbidden = (secret.forbidden ?? []).map(w => this.normalizeClue(w));
        // Init state
        this.state = {
            phase: "SETUP",
            round: 1,
            ended: false,
            players: players.map(p => ({
                id: p.id,
                name: p.name,
                role: impostorIds.has(p.id) ? "IMPOSTOR" : "CREWMATE",
                alive: true,
                hasGuessed: false,
            })),
            secret: { word: secret.word, category: secret.category ?? "" },
            turnOrder: shuffle(ids, this.rng),
            currentTurnIndex: 0,
            cluesThisRound: [],
            votesThisRound: [],
            usedClueSet: {},
            forbiddenWords: forbidden,
            eliminatedThisRound: null,
            winner: "NONE",
        };
        // Private cards
        this.cardsByPlayer = {};
        for (const pl of this.state.players) {
            this.cardsByPlayer[pl.id] =
                pl.role === "IMPOSTOR"
                    ? { kind: "impostor" }
                    : { kind: "secret", word: secret.word, category: secret.category ?? "" };
        }
        this.emit({ type: "GAME_STARTED", state: this.getState() });
        this.setPhase("CLUE");
        this.emitTurn();
    }
    /** Submit a one-word clue for the current turn player. */
    submitClue(playerId, clueRaw) {
        this.ensurePhase("CLUE");
        this.ensureAlive(playerId);
        this.ensureTurn(playerId);
        const clue = this.normalizeClue(clueRaw);
        const validation = this.validateClue(clueRaw, clue);
        if (validation) {
            this.emit({ type: "CLUE_REJECTED", reason: validation, state: this.getState() });
            return;
        }
        const entry = {
            playerId,
            clue,
            rawClue: clueRaw,
            atMs: Date.now(),
        };
        this.state.cluesThisRound.push(entry);
        if (this.cfg.forbidRepeatedClues)
            this.state.usedClueSet[clue] = true;
        this.emit({ type: "CLUE_ACCEPTED", entry, state: this.getState() });
        // Advance turn
        this.advanceTurnOrMoveToVote();
    }
    /** Optional: impostor attempts to guess the secret word (timing controlled by config). */
    impostorGuess(playerId, guessRaw) {
        if (!this.cfg.allowImpostorGuess)
            return;
        this.ensureAlive(playerId, true); // Allow eliminated players if it's their "last chance"
        const pl = this.state.players.find(x => x.id === playerId);
        if (pl.role !== "IMPOSTOR")
            throw new Error("Only impostors can guess");
        if (pl.hasGuessed)
            throw new Error("This impostor already guessed");
        const timingOK = (this.cfg.impostorGuessTiming === "AFTER_CLUES_BEFORE_VOTE" && this.state.phase === "CLUE") ||
            (this.cfg.impostorGuessTiming === "AFTER_ELIMINATION_REVEAL" && this.state.phase === "REVEAL");
        if (!timingOK)
            throw new Error("Guess not allowed in current phase");
        // Special check for onlyGuessIfEliminated
        if (this.cfg.onlyGuessIfEliminated && this.state.phase === "REVEAL") {
            if (this.state.eliminatedThisRound !== playerId) {
                throw new Error("Only the eliminated player can guess in this phase");
            }
        }
        pl.hasGuessed = true;
        const guess = guessRaw.trim();
        const correct = this.eqLoose(guess, this.state.secret.word);
        if (correct) {
            this.state.winner = "IMPOSTORS";
            this.endGame();
        }
        else if (this.cfg.impostorGuessOutcomeOnWrong === "ELIMINATE_GUESSER") {
            pl.alive = false;
            // If that elimination causes crewmate win:
            this.checkWinConditions();
        }
        this.emit({
            type: "IMPOSTOR_GUESS",
            playerId,
            guess: guessRaw,
            correct,
            state: this.getState(),
        });
    }
    /** Cast a vote (target playerId or SKIP). */
    castVote(voterId, targetId) {
        this.ensurePhase("VOTE");
        this.ensureAlive(voterId);
        if (targetId === "SKIP" && !this.cfg.allowSkipVote) {
            this.emit({ type: "VOTE_REJECTED", reason: "Skip vote not allowed", state: this.getState() });
            return;
        }
        if (targetId !== "SKIP")
            this.ensureAlive(targetId);
        const already = this.state.votesThisRound.find(v => v.voterId === voterId);
        if (already) {
            this.emit({ type: "VOTE_REJECTED", reason: "Voter already voted", state: this.getState() });
            return;
        }
        const entry = { voterId, targetId, atMs: Date.now() };
        this.state.votesThisRound.push(entry);
        this.emit({ type: "VOTE_CAST", entry, state: this.getState() });
        if (this.cfg.requireAllVotes) {
            const aliveCount = this.alivePlayers().length;
            if (this.state.votesThisRound.length >= aliveCount) {
                this.resolveVote();
            }
        }
    }
    /** Resolve vote now (useful if requireAllVotes=false and UI decides when to resolve). */
    resolveVote() {
        this.ensurePhase("VOTE");
        const alive = this.alivePlayers().map(p => p.id);
        const tally = {};
        for (const v of this.state.votesThisRound) {
            // ignore votes from dead (shouldn't happen) or to dead
            if (!alive.includes(v.voterId))
                continue;
            if (v.targetId !== "SKIP" && !alive.includes(v.targetId))
                continue;
            tally[v.targetId] = (tally[v.targetId] ?? 0) + 1;
        }
        // Determine top
        const entries = Object.entries(tally);
        if (!entries.length) {
            // no votes => no elimination
            this.state.eliminatedThisRound = null;
            this.emit({ type: "VOTE_RESOLVED", eliminated: null, tally, state: this.getState() });
            this.setPhase("REVEAL");
            this.afterRevealAdvance();
            return;
        }
        // Find max votes
        let max = -1;
        for (const [, c] of entries)
            max = Math.max(max, c);
        const top = entries.filter(([, c]) => c === max).map(([k]) => k);
        // tie -> no elimination
        if (top.length !== 1) {
            this.state.eliminatedThisRound = null;
            this.emit({ type: "VOTE_RESOLVED", eliminated: null, tally, state: this.getState() });
            this.setPhase("REVEAL");
            this.afterRevealAdvance();
            return;
        }
        const eliminatedKey = top[0];
        const eliminatedId = eliminatedKey === "SKIP" ? null : eliminatedKey;
        if (eliminatedId) {
            const pl = this.state.players.find(p => p.id === eliminatedId);
            pl.alive = false;
            this.state.eliminatedThisRound = eliminatedId;
        }
        else {
            this.state.eliminatedThisRound = null;
        }
        this.emit({ type: "VOTE_RESOLVED", eliminated: eliminatedId, tally, state: this.getState() });
        this.setPhase("REVEAL");
        // If not guessing now, advance. If onlyGuessIfEliminated is on, we wait for a guess or manual advance?
        // Usually in games with "last guess", the REVEAL phase stays until the guess is made or skipped.
        // Let's keep afterRevealAdvance() but maybe make it conditional if guess is possible.
        if (!this.cfg.allowImpostorGuess || this.cfg.impostorGuessTiming !== "AFTER_ELIMINATION_REVEAL") {
            this.afterRevealAdvance();
        }
        else {
            // In REVEAL phase, if impostor can guess, we wait for 'resolveReveal' call?
            // Or we just check if someone IS an impostor and was eliminated.
            const elim = this.state.players.find(p => p.id === this.state.eliminatedThisRound);
            if (elim && elim.role === "IMPOSTOR" && !elim.hasGuessed) {
                // Wait for guess
            }
            else {
                this.afterRevealAdvance();
            }
        }
    }
    /** Manually advance from REVEAL to next round/end if we were waiting for a guess. */
    finishReveal() {
        this.ensurePhase("REVEAL");
        this.afterRevealAdvance();
    }
    // --------------------
    // Internals
    // --------------------
    afterRevealAdvance() {
        // Check wins after elimination
        this.checkWinConditions();
        if (this.state.ended)
            return;
        // Advance round
        if (this.state.round >= this.cfg.maxRounds) {
            // End by limit
            if (this.cfg.impostorsWinOnSurviveToEnd) {
                this.state.winner = "IMPOSTORS";
            }
            else {
                this.state.winner = "NONE";
            }
            this.endGame();
            return;
        }
        this.state.round += 1;
        this.state.cluesThisRound = [];
        this.state.votesThisRound = [];
        this.state.eliminatedThisRound = undefined;
        // New turn order each round among alive players
        this.state.turnOrder = shuffle(this.alivePlayers().map(p => p.id), this.rng);
        this.state.currentTurnIndex = 0;
        this.setPhase("CLUE");
        this.emitTurn();
    }
    checkWinConditions() {
        const alive = this.alivePlayers();
        const impostors = alive.filter(p => p.role === "IMPOSTOR").length;
        const crewmates = alive.filter(p => p.role === "CREWMATE").length;
        if (impostors === 0) {
            this.state.winner = "CREWMATES";
            this.endGame();
            return;
        }
        if (this.cfg.impostorsWinOnParity && impostors >= crewmates) {
            this.state.winner = "IMPOSTORS";
            this.endGame();
            return;
        }
    }
    endGame() {
        this.state.phase = "END";
        this.state.ended = true;
        this.emit({ type: "GAME_ENDED", winner: this.state.winner, state: this.getState() });
    }
    advanceTurnOrMoveToVote() {
        const aliveOrder = this.state.turnOrder.filter(id => this.isAlive(id));
        const nextIndex = this.state.currentTurnIndex + 1;
        if (nextIndex >= aliveOrder.length) {
            // all alive gave clue
            this.setPhase("VOTE");
            return;
        }
        this.state.currentTurnIndex = nextIndex;
        this.emitTurn();
    }
    emitTurn() {
        const aliveOrder = this.state.turnOrder.filter(id => this.isAlive(id));
        const pid = aliveOrder[this.state.currentTurnIndex];
        if (!pid)
            return; // edge case: game ended
        this.emit({ type: "TURN_CHANGED", playerId: pid, state: this.getState() });
    }
    alivePlayers() {
        return this.state.players.filter(p => p.alive);
    }
    isAlive(playerId) {
        const pl = this.state.players.find(p => p.id === playerId);
        return !!pl?.alive;
    }
    ensureAlive(playerId, allowEliminated = false) {
        const pl = this.state.players.find(p => p.id === playerId);
        if (!pl)
            throw new Error("Unknown playerId");
        if (!pl.alive && !allowEliminated)
            throw new Error("Player is eliminated");
    }
    ensurePhase(phase) {
        if (this.state.phase !== phase)
            throw new Error(`Invalid phase; expected ${phase}, got ${this.state.phase}`);
    }
    setPhase(phase) {
        this.state.phase = phase;
        this.emit({ type: "PHASE_CHANGED", phase, state: this.getState() });
    }
    ensureTurn(playerId) {
        const aliveOrder = this.state.turnOrder.filter(id => this.isAlive(id));
        const expected = aliveOrder[this.state.currentTurnIndex];
        if (playerId !== expected)
            throw new Error("Not this player's turn");
    }
    normalizeClue(clueRaw) {
        const t = clueRaw.trim()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
        if (this.cfg.normalizeClues === "lower")
            return t.toLowerCase();
        return t;
    }
    normalizeCategory(category) {
        return category.trim().toLowerCase();
    }
    validateClue(raw, normalized) {
        if (!raw || !raw.trim())
            return "Empty clue";
        // enforce one-word rule (token-based)
        if (this.cfg.enforceOneWord) {
            // Accept letters/numbers with accents, hyphens; reject spaces beyond one token.
            const trimmed = raw.trim();
            if (/\s/.test(trimmed))
                return "Clue must be a single word (no spaces)";
            if (!/[A-Za-zÀ-ÿ0-9]/.test(trimmed))
                return "Clue must contain letters or numbers";
        }
        // no repeat rule
        if (this.cfg.forbidRepeatedClues) {
            if (this.state.usedClueSet[normalized])
                return "Clue already used";
        }
        // forbid exact secret word for crewmates
        if (this.eqLoose(normalized, this.state.secret.word))
            return "Cannot say the secret word";
        // forbid words in the forbidden list
        if (this.state.forbiddenWords.some(fw => this.eqLoose(normalized, fw))) {
            return "That clue is a forbidden word for this card";
        }
        return null;
    }
    eqLoose(a, b) {
        const na = a.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const nb = b.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        return na === nb;
    }
    emit(ev) {
        for (const l of this.listeners)
            l(ev);
    }
}
//# sourceMappingURL=impostor-word-engine.js.map