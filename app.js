import { ImpostorWordEngine } from "./impostor-word-engine.js";
import { RetroAudioEngine } from "./audio-engine.js";

// Helper to prevent XSS by escaping HTML special characters
function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, function(m) {
        switch (m) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#039;';
            default: return m;
        }
    });
}

// DOM Elements
const screens = {
    intro: document.getElementById('intro-screen'),
    setup: document.getElementById('setup-screen'),
    distribution: document.getElementById('distribution-screen'),
    game: document.getElementById('game-screen'),
    moderator: document.getElementById('moderator-screen'),
    end: document.getElementById('end-screen')
};

const audio = new RetroAudioEngine();
const themeSelector = document.getElementById('theme-selector');
const toggleSoundBtn = document.getElementById('toggle-sound');
const shiftStatus = document.getElementById('shift-status');
const goToSetupBtn = document.getElementById('go-to-setup-btn');

// Moderator Elements
const moderatorCategory = document.getElementById('moderator-category');
const freeSecretWord = document.getElementById('free-secret-word');
const freeRolesList = document.getElementById('free-roles-list');
const finishFreeGameBtn = document.getElementById('finish-free-game');

const categoryPillsContainer = document.getElementById('category-pills');
const selectAllBtn = document.getElementById('select-all-cats');
const selectNoneBtn = document.getElementById('select-none-cats');
const playerInput = document.getElementById('player-names');
const impostorInput = document.getElementById('impostor-count');
const difficultyInput = document.getElementById('difficulty');
const startBtn = document.getElementById('start-game-btn');

// Distribution Elements
const targetPlayerName = document.getElementById('target-player-name');
const distributionPrompt = document.getElementById('distribution-prompt');
const revealCardArea = document.getElementById('reveal-card-area');
const readyToSeeBtn = document.getElementById('ready-to-see-btn');
const confirmSeenBtn = document.getElementById('confirm-seen-btn');
const cardContent = document.getElementById('card-content');
const holoWrapper = document.getElementById('holo-card-wrapper');

// Game Elements
const gameCategoryName = document.getElementById('game-category-name');
const categoryBanner = document.getElementById('category-bg');
const domainPillsContainer = document.getElementById('domain-pills');

const gamePhaseTag = document.getElementById('game-phase-tag');
const gameRoundTag = document.getElementById('game-round-tag');
const clueSection = document.getElementById('clue-section');
const voteSection = document.getElementById('vote-section');
const revealSection = document.getElementById('reveal-section');
const freeModeSection = document.getElementById('free-mode-section');
const freeModeRevealBtn = document.getElementById('free-mode-reveal-btn');

const currentTurnPlayer = document.getElementById('current-turn-player');
const clueInput = document.getElementById('clue-input');
const clueError = document.getElementById('clue-error');
const submitClueBtn = document.getElementById('submit-clue-btn');
const clueList = document.getElementById('clue-list');

const voteButtons = document.getElementById('vote-buttons');
const skipVoteBtn = document.getElementById('skip-vote-btn');

const revealResultTitle = document.getElementById('reveal-result-title');
const revealResultDesc = document.getElementById('reveal-result-desc');
const impostorGuessArea = document.getElementById('impostor-guess-area');
const impostorGuessInput = document.getElementById('impostor-guess-input');
const guessError = document.getElementById('guess-error');
const submitGuessBtn = document.getElementById('submit-guess-btn');
const skipGuessBtn = document.getElementById('skip-guess-btn');
const nextRoundBtn = document.getElementById('next-round-btn');

// Engine Initialization
let engine;
let allCards = [];
let distributionIndex = 0;
let gamesPlayedInShift = 0;
let isFreeMode = false;

// Helper: Normalize String for filenames
function normalizeForFilename(str) {
    return str.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function getCategoryImagePath(category) {
    const filename = normalizeForFilename(category);
    return `assets/categories/${filename}.jpg`;
}

function updateBackground(category) {
    const bgOverlay = document.querySelector('.bg-overlay');
    if (!bgOverlay) return;
    const filename = normalizeForFilename(category);
    const img = new Image();
    const path = `assets/categories/${filename}.jpg`;
    img.onload = () => {
        bgOverlay.style.backgroundImage = `url('${path}')`;
        bgOverlay.style.opacity = '0.3';
    };
    img.onerror = () => {
        bgOverlay.style.backgroundImage = 'radial-gradient(circle at 50% 50%, rgba(198, 120, 255, 0.15), transparent 80%)';
        bgOverlay.style.opacity = '0.5';
    };
    img.src = path;
}

function clearBackground() {
    const bgOverlay = document.querySelector('.bg-overlay');
    if (!bgOverlay) return;
    bgOverlay.style.opacity = '0';
}

function applyCategoryPreview(pill, category) {
    const imagePath = getCategoryImagePath(category);
    const img = new Image();
    img.onload = () => {
        pill.style.setProperty('--pill-image', `url('${imagePath}')`);
        pill.classList.add('has-image');
    };
    img.onerror = () => {
        pill.classList.add('no-image');
    };
    img.src = imagePath;
}

// Numeric Stepper Logic
document.querySelectorAll('.step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const input = document.getElementById(targetId);
        if (!input) return;

        let val = parseInt(input.value) || 0;
        if (btn.classList.contains('plus')) {
            val++;
        } else {
            val--;
        }

        // Bounds check
        const min = parseInt(input.min);
        const max = parseInt(input.max);
        if (!isNaN(min) && val < min) val = min;
        if (!isNaN(max) && val > max) val = max;

        input.value = val;
        triggerHaptic('light');
        audio.play('click');

        // Trigger background update if difficulty changes (optional, but consistent)
        if (targetId === 'difficulty') {
            // Optional: visual feedback for difficulty
        }
    });
});

function updateSoundIcon() {
    const icon = toggleSoundBtn.querySelector('i');
    if (icon) {
        icon.setAttribute('data-lucide', audio.enabled ? 'volume-2' : 'volume-x');
        lucide.createIcons();
    }
}

function loadPreferences() {
    // Theme
    const savedTheme = localStorage.getItem('impostor-theme') || 'default';
    themeSelector.value = savedTheme;
    document.body.setAttribute('data-theme', savedTheme);

    // Sound
    const savedSound = localStorage.getItem('impostor-sound-enabled');
    if (savedSound !== null) {
        audio.enabled = savedSound === 'true';
    } else {
        audio.enabled = true; // default
    }
    updateSoundIcon();

    // Game Mode
    const savedMode = localStorage.getItem('impostor-game-mode') || 'free';
    const modeRadio = document.querySelector(`input[name="game-mode"][value="${savedMode}"]`);
    if (modeRadio) modeRadio.checked = true;
}

// 1. Load Dataset & Populate Categories
async function init() {
    loadPreferences();
    audio.init();
    if(domainPillsContainer) domainPillsContainer.innerHTML = '<div class="loading-text">Cargando dominios...</div>';
    if(categoryPillsContainer) categoryPillsContainer.innerHTML = '<div class="loading-text">Cargando categorías...</div>';

    try {
        const domains = [
            { file: 'impostor_deck_200_v1_1_normalizado.json', domain: 'Psiquiatría' },
            { file: 'medicine_general.json', domain: 'Medicina General' },
            { file: 'psychology.json', domain: 'Psicología' }
        ];

        allCards = [];
        for (const d of domains) {
            try {
                const res = await fetch(d.file);
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                const data = await res.json();
                data.cards.forEach(c => {
                    c.domain = d.domain;
                    allCards.push(c);
                });
            } catch (err) {
                console.warn(`Failed to load dataset: ${d.file}`, err);
            }
        }
        
        if (allCards.length === 0) {
            alert("No se pudo cargar ninguna carta. Comprueba tu conexión.");
            return;
        }
        
        const uniqueDomains = [...new Set(allCards.map(c => c.domain))].sort();
        if(domainPillsContainer) domainPillsContainer.innerHTML = '';
        uniqueDomains.forEach(dom => {
            const pill = document.createElement('div');
            pill.className = 'category-pill active no-image';
            pill.setAttribute('tabindex', '0');
            pill.setAttribute('role', 'checkbox');
            pill.setAttribute('aria-checked', 'true');
            const label = document.createElement('span');
            label.className = 'pill-label';
            label.textContent = dom;
            pill.appendChild(label);
            pill.dataset.domain = dom;
            pill.addEventListener('click', () => {
                pill.classList.toggle('active');
                pill.setAttribute('aria-checked', pill.classList.contains('active') ? 'true' : 'false');
                triggerHaptic('light');
                audio.play('click');
                updateCategoryPills();
            });
            pill.addEventListener('keydown', (e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    pill.click();
                }
            });
            if(domainPillsContainer) domainPillsContainer.appendChild(pill);
        });

        updateCategoryPills();
    } catch (e) {
        console.error("Failed to load dataset", e);
    }
}

function updateCategoryPills() {
    if(!categoryPillsContainer) return;
    const selectedDomains = Array.from(document.querySelectorAll('#domain-pills .category-pill.active')).map(p => p.dataset.domain);
    const filteredCards = allCards.filter(c => selectedDomains.includes(c.domain));
    const categories = [...new Set(filteredCards.map(c => c.categoria))].sort();
    
    categoryPillsContainer.innerHTML = '';
    categories.forEach(cat => {
        const pill = document.createElement('div');
        pill.className = 'category-pill active'; 
        pill.setAttribute('tabindex', '0');
        pill.setAttribute('role', 'checkbox');
        pill.setAttribute('aria-checked', 'true');
        const label = document.createElement('span');
        label.className = 'pill-label';
        label.textContent = cat;
        pill.appendChild(label);
        pill.dataset.category = cat;
        pill.addEventListener('click', () => {
            pill.classList.toggle('active');
            pill.setAttribute('aria-checked', pill.classList.contains('active') ? 'true' : 'false');
            triggerHaptic('light');
            audio.play('click');
            if (pill.classList.contains('active')) {
                updateBackground(cat);
            }
        });
        pill.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                pill.click();
            }
        });
        pill.addEventListener('mouseenter', () => {
            updateBackground(cat);
        });
        applyCategoryPreview(pill, cat);
        categoryPillsContainer.appendChild(pill);
    });
}

goToSetupBtn.addEventListener('click', () => {
    switchScreen('setup');
});

selectAllBtn.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.category-pill').forEach(p => {
        p.classList.add('active');
        p.setAttribute('aria-checked', 'true');
    });
});

selectNoneBtn.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.category-pill').forEach(p => {
        p.classList.remove('active');
        p.setAttribute('aria-checked', 'false');
    });
});

themeSelector.addEventListener('change', (e) => {
    document.body.setAttribute('data-theme', e.target.value);
    audio.play('click');
    localStorage.setItem('impostor-theme', e.target.value);
});

toggleSoundBtn.addEventListener('click', () => {
    audio.toggle();
    audio.init();
    updateSoundIcon();
    localStorage.setItem('impostor-sound-enabled', audio.enabled);
});

// Save mode on radio select change
document.querySelectorAll('input[name="game-mode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        localStorage.setItem('impostor-game-mode', e.target.value);
    });
});

// 2. Start Game Logic
startBtn.addEventListener('click', () => {
    audio.play('transition');
    shiftStatus.classList.remove('hidden');
    const playerNames = playerInput.value.split(',').map(n => n.trim()).filter(n => n);
    if (playerNames.length < 3) return alert("¡Atención! Se necesitan al menos 3 jugadores para una partida épica.");

    const uniqueNames = new Set(playerNames);
    if (uniqueNames.size !== playerNames.length) {
        return alert("¡Atención! Todos los jugadores deben tener nombres únicos.");
    }

    const players = playerNames.map((name, i) => ({ id: i.toString(), name }));
    const impostorCount = parseInt(impostorInput.value);
    const difficulty = parseInt(difficultyInput.value);
    const selectedCats = Array.from(document.querySelectorAll('#category-pills .category-pill.active')).map(p => p.dataset.category);

    const selectedModeNode = document.querySelector('input[name="game-mode"]:checked');
    isFreeMode = selectedModeNode ? selectedModeNode.value === 'free' : false;

    const wordBank = allCards
        .filter(card => selectedCats.includes(card.categoria) && card.dificultad <= difficulty)
        .map(card => ({
            word: card.palabra_secreta,
            category: card.categoria,
            forbidden: card.prohibidas
        }));

    if (wordBank.length === 0) {
        return alert("No hay cartas disponibles con estos filtros. Cambia la dificultad o categorías.");
    }

    const defaultConfig = {
        impostorCount,
        maxRounds: 3,
        seed: Date.now(),
        enforceOneWord: true,
        forbidRepeatedClues: true,
        normalizeClues: "lower",
        allowSkipVote: true,
        tiePolicy: "NO_ELIMINATION",
        requireAllVotes: false,
        impostorsWinOnSurviveToEnd: true,
        impostorsWinOnParity: true,
        allowImpostorGuess: true,
        impostorGuessTiming: "AFTER_ELIMINATION_REVEAL",
        impostorGuessOutcomeOnWrong: "NOTHING",
        onlyGuessIfEliminated: true
    };

    engine = new ImpostorWordEngine(defaultConfig);
    setupEngineListeners();

    engine.start({
        players,
        wordBank,
        categories: selectedCats.length ? selectedCats : undefined,
        impostorCount
    });

    if (isFreeMode) {
        startFreeMode();
    } else {
        startDistribution();
    }
});

function startFreeMode() {
    const state = engine.getState();
    
    if (moderatorCategory) {
        moderatorCategory.textContent = state.secret.category || "General";
    }
    if (freeSecretWord) {
        freeSecretWord.textContent = state.secret.word;
    }
    
    if (freeRolesList) {
        freeRolesList.innerHTML = state.players.map(p => {
            const roleLabel = p.role === "IMPOSTOR" ? '<span class="impostor-text" style="font-weight: 800;">🤫 IMPOSTOR</span>' : `<span>🔍 ESPECIALISTA</span>`;
            return `<li><span class="player-name">${escapeHTML(p.name)}</span><span>${roleLabel}</span></li>`;
        }).join('');
    }
    
    finishFreeGameBtn.onclick = () => {
        triggerHaptic('heavy');
        audio.play('success');
        engine.endGame();
    };
    
    switchScreen('moderator');
}

function startDistribution() {
    distributionIndex = 0;
    switchScreen('distribution');
    showDistributionPrompt();
}

function showDistributionPrompt() {
    const state = engine.getState();
    const player = state.players[distributionIndex];
    if (!player) {
        showGameScreen();
        return;
    }

    holoWrapper.classList.add('flipped');
    targetPlayerName.textContent = player.name;
    distributionPrompt.classList.remove('hidden');
    revealCardArea.classList.add('hidden');
    clearBackground();
}

readyToSeeBtn.addEventListener('click', () => {
    triggerHaptic('medium');
    audio.play('flip');
    clearBackground();
    const state = engine.getState();
    const player = state.players[distributionIndex];
    const card = engine.getPrivateCard(player.id);

    if (card.kind === "impostor") {
        cardContent.innerHTML = `
            <p class="card-label">Identidad Clínica</p>
            <h3 class="card-role impostor-text">IMPOSTOR</h3>
            <p class="card-note">Infíltrate en el debate. Mimetiza su lógica.</p>
        `;
    } else {
        cardContent.innerHTML = `
            <p class="card-label">Identidad Clínica</p>
            <h3 class="card-role">ESPECIALISTA</h3>
            <p class="card-label">Área de Consulta</p>
            <h3 class="card-role" style="font-size: 1.2rem; opacity: 0.8;">${escapeHTML(card.category)}</h3>
            <p class="card-label">Caso a Debatir</p>
            <h3 class="card-word">${escapeHTML(card.word)}</h3>
        `;
    }

    distributionPrompt.classList.add('hidden');
    revealCardArea.classList.remove('hidden');

    setTimeout(() => {
        holoWrapper.classList.remove('flipped');
    }, 100);
});

confirmSeenBtn.addEventListener('click', () => {
    triggerHaptic('light');
    audio.play('click');
    holoWrapper.classList.add('flipped');

    setTimeout(() => {
        distributionIndex++;
        showDistributionPrompt();
    }, 600);
});

function showGameScreen() {
    const state = engine.getState();
    gameCategoryName.textContent = state.secret.category || "General";

    // Privacy: Neutral background during debate
    clearBackground();
    if (categoryBanner) categoryBanner.style.backgroundImage = 'none';

    switchScreen('game');
}

function setupEngineListeners() {
    engine.on(ev => {
        switch (ev.type) {
            case "PHASE_CHANGED":
                updateGamePhaseUI(ev.state);
                break;
            case "TURN_CHANGED":
                updateTurnUI(ev.state);
                break;
            case "CLUE_ACCEPTED":
                clueInput.value = '';
                clueError.classList.add('hidden');
                renderClueList(ev.state);
                break;
            case "CLUE_REJECTED":
                clueError.textContent = ev.reason;
                clueError.classList.remove('hidden');
                triggerHaptic('heavy');
                break;
            case "VOTE_CAST":
                renderVoteUI(ev.state);
                break;
            case "VOTE_REJECTED": {
                // Show inline error instead of blocking alert
                const voteErr = document.getElementById('vote-error');
                if (voteErr) {
                    voteErr.textContent = ev.reason;
                    voteErr.classList.remove('hidden');
                    setTimeout(() => voteErr.classList.add('hidden'), 3000);
                }
                break;
            }
            case "VOTE_RESOLVED":
                renderRevealUI(ev);
                break;
            case "IMPOSTOR_GUESS":
                if (!ev.correct) {
                    guessError.textContent = "¡INCORRECTO! No era esa palabra.";
                    guessError.classList.remove('hidden');
                } else {
                    guessError.classList.add('hidden');
                }
                break;
            case "GAME_ENDED":
                showEndScreen(ev.state);
                break;
        }
    });
}

function updateGamePhaseUI(state) {
    const phaseLabels = { CLUE: 'PISTAS', VOTE: 'VOTACIÓN', REVEAL: 'RESULTADO' };
    if (gamePhaseTag) gamePhaseTag.textContent = `FASE: ${phaseLabels[state.phase] || state.phase}`;
    if (gameRoundTag) gameRoundTag.textContent = `RONDA ${state.round}`;
    
    if(clueSection) clueSection.classList.add('hidden');
    if(voteSection) voteSection.classList.add('hidden');
    if(revealSection) revealSection.classList.add('hidden');
    if(freeModeSection) freeModeSection.classList.add('hidden');

    const showPhaseContent = () => {
        if (isFreeMode) {
            if (state.phase === "CLUE") {
                if (freeModeSection) freeModeSection.classList.remove('hidden');
                if (gamePhaseTag) gamePhaseTag.textContent = `DEBATE VERBAL`;
            }
            return;
        }

        if (state.phase === "CLUE" && clueSection) {
            clueSection.classList.remove('hidden');
            renderClueList(state);
        } else if (state.phase === "VOTE" && voteSection) {
            voteSection.classList.remove('hidden');
            renderVoteUI(state);
        } else if (state.phase === "REVEAL" && revealSection) {
            revealSection.classList.remove('hidden');
        }
    };

    // Fade out visible sections
    const sections = [clueSection, voteSection, revealSection, freeModeSection];
    let needsDelay = false;
    sections.forEach(sec => {
        if (sec && !sec.classList.contains('hidden')) {
            sec.classList.add('fade-out');
            needsDelay = true;
            setTimeout(() => {
                sec.classList.add('hidden');
                sec.classList.remove('fade-out');
            }, 200);
        }
    });

    if (needsDelay) {
        setTimeout(showPhaseContent, 210);
    } else {
        showPhaseContent();
    }
}

function updateTurnUI(state) {
    const currentId = state.turnOrder[state.currentTurnIndex];
    const player = state.players.find(p => p.id === currentId);
    if (player && currentTurnPlayer) {
        currentTurnPlayer.textContent = player.name;
    }
    // Clear clue input for the new player's turn
    if (clueInput) clueInput.value = '';
    if (clueError) clueError.classList.add('hidden');
}

function renderClueList(state) {
    if (!clueList) return;
    clueList.innerHTML = '';
    state.cluesThisRound.forEach(c => {
        const p = state.players.find(x => x.id === c.playerId);
        const li = document.createElement('li');
        li.innerHTML = `<span class="player-name">${escapeHTML(p.name)}</span><span class="player-clue">${escapeHTML(c.rawClue)}</span>`;
        clueList.appendChild(li);
    });
}

function renderVoteUI(state) {
    if (!voteButtons) return;
    voteButtons.innerHTML = '';
    
    const votePromptText = document.querySelector('#vote-section .hint');
    const alivePlayers = state.players.filter(p => p.alive);
    const votersWhoVoted = state.votesThisRound.map(v => v.voterId);
    const remainingVoters = alivePlayers.filter(p => !votersWhoVoted.includes(p.id));

    if (remainingVoters.length > 0) {
        const currentVoter = remainingVoters[0];
        if (votePromptText) {
            votePromptText.innerHTML = `Voto de: <strong style="color: var(--primary); font-size: 1.2rem;">${escapeHTML(currentVoter.name)}</strong><br><span style="font-size: 0.9rem; opacity: 0.8;">Elige al infiltrado:</span>`;
        }
        if (skipVoteBtn) {
            skipVoteBtn.classList.remove('hidden');
            skipVoteBtn.onclick = () => {
                if (confirm(`¿Estás seguro de que ${currentVoter.name} desea saltar su voto?`)) {
                    audio.play('click');
                    triggerHaptic('light');
                    engine.castVote(currentVoter.id, "SKIP");
                }
            };
        }

        alivePlayers.forEach(p => {
            const btn = document.createElement('button');
            btn.className = 'vote-btn';
            btn.textContent = p.name;
            btn.onclick = () => {
                audio.play('click');
                triggerHaptic('light');
                engine.castVote(currentVoter.id, p.id);
            };
            voteButtons.appendChild(btn);
        });
    } else {
        if (votePromptText) {
            votePromptText.textContent = "Todos los diagnósticos han votado.";
        }
        if (skipVoteBtn) {
            skipVoteBtn.classList.add('hidden');
        }

        const resolveBtn = document.createElement('button');
        resolveBtn.className = 'primary-btn';
        resolveBtn.style.width = '100%';
        resolveBtn.textContent = 'RESOLVER VOTACIÓN';
        resolveBtn.onclick = () => {
            audio.play('transition');
            triggerHaptic('medium');
            engine.resolveVote();
        };
        voteButtons.appendChild(resolveBtn);
    }
}

function renderRevealUI(ev) {
    const state = ev.state;
    const eliminatedId = ev.eliminated;
    if (impostorGuessArea) impostorGuessArea.classList.add('hidden');
    if (impostorGuessInput) impostorGuessInput.value = '';
    if (guessError) guessError.classList.add('hidden');

    if (eliminatedId) {
        const p = state.players.find(x => x.id === eliminatedId);
        if(revealResultTitle) revealResultTitle.textContent = `${p.name} ELIMINADO`;
        if(revealResultDesc) revealResultDesc.textContent = p.role === "IMPOSTOR" ? "¡Era un IMPOSTOR!" : "Era un ESPECIALISTA inocente.";
        
        if (p.role === "IMPOSTOR" && !p.hasGuessed) {
            if (impostorGuessArea) impostorGuessArea.classList.remove('hidden');
            if (submitGuessBtn) {
                submitGuessBtn.onclick = () => {
                    const guess = impostorGuessInput.value;
                    if (guess) engine.impostorGuess(p.id, guess);
                };
            }
            if (skipGuessBtn) {
                skipGuessBtn.onclick = () => {
                    engine.finishReveal();
                };
            }
        }
    } else {
        if(revealResultTitle) revealResultTitle.textContent = "EMPATE / SALTO";
        if(revealResultDesc) revealResultDesc.textContent = "Nadie fue eliminado en esta ronda.";
    }

    if(nextRoundBtn) {
        nextRoundBtn.onclick = () => {
            engine.finishReveal();
        };
    }
}

if (submitClueBtn) {
    submitClueBtn.addEventListener('click', () => {
        const state = engine.getState();
        const currentId = state.turnOrder[state.currentTurnIndex];
        engine.submitClue(currentId, clueInput.value);
    });
}

if (freeModeRevealBtn) {
    freeModeRevealBtn.addEventListener('click', () => {
        triggerHaptic('heavy');
        audio.play('success');
        const state = engine.getState();
        showEndScreen(state);
    });
}

function showEndScreen(state) {
    gamesPlayedInShift++;
    document.getElementById('end-result-label').textContent = `ÉXITO CLÍNICO #${gamesPlayedInShift}`;
    
    const impostors = state.players.filter(p => p.role === "IMPOSTOR").map(p => p.name);
    const impostorNamesEl = document.getElementById('impostor-names-display');

    if (isFreeMode) {
        document.getElementById('winner-display').textContent = `IMPOSTOR(ES): ${impostors.join(", ")}`;
    } else {
        if (state.winner === "IMPOSTORS") {
            document.getElementById('winner-display').textContent = "¡GANAN LOS IMPOSTORES!";
        } else if (state.winner === "CREWMATES") {
            document.getElementById('winner-display').textContent = "¡GANAN LOS ESPECIALISTAS!";
        } else {
            document.getElementById('winner-display').textContent = "EMPATE / FIN DE RONDA";
        }
        // Always show who the impostors were
        if (impostorNamesEl) {
            impostorNamesEl.textContent = `El impostor era: ${impostors.join(", ")}`;
        }
    }

    document.getElementById('secret-word-display').textContent = state.secret.word;
    switchScreen('end');
}

// Feedback Helper
function triggerHaptic(type = 'light') {
    if (navigator.vibrate) {
        if (type === 'light') navigator.vibrate(10);
        else if (type === 'medium') navigator.vibrate(30);
        else if (type === 'heavy') navigator.vibrate([50, 30, 50]);
    }
    const activeScreen = document.querySelector('.screen.active .glass-container');
    if (activeScreen) {
        activeScreen.classList.remove('haptic-feedback');
        void activeScreen.offsetWidth;
        activeScreen.classList.add('haptic-feedback');
    }
}

function switchScreen(id) {
    const currentActive = document.querySelector('.screen.active');
    
    if (currentActive && currentActive.id !== `${id}-screen`) {
        currentActive.classList.add('fade-out');
        setTimeout(() => {
            currentActive.classList.remove('active', 'fade-out');
            if (screens[id]) {
                screens[id].classList.add('active');
                triggerHaptic('light');
            }
        }, 200);
    } else if (!currentActive && screens[id]) {
        screens[id].classList.add('active');
        triggerHaptic('light');
    }
}

// Holographic Tilt
holoWrapper.addEventListener('pointermove', (e) => {
    const rect = holoWrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const px = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const py = Math.max(0, Math.min(100, (y / rect.height) * 100));

    const rx = (px - 50) / 1.5;
    const ry = (py - 50) / -1.5;

    holoWrapper.style.setProperty('--pointer-x', `${px}%`);
    holoWrapper.style.setProperty('--pointer-y', `${py}%`);
    holoWrapper.style.setProperty('--rotate-x', `${rx}deg`);
    holoWrapper.style.setProperty('--rotate-y', `${ry}deg`);
    holoWrapper.style.setProperty('--background-x', `${px}%`);
    holoWrapper.style.setProperty('--background-y', `${py}%`);
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => {
            console.warn("Service Worker registration failed: ", err);
        });
    });
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
            refreshing = true;
            window.location.reload();
        }
    });
}

init();
lucide.createIcons();
