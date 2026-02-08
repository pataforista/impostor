import { ImpostorWordEngine } from "./impostor-word-engine.js";
import { RetroAudioEngine } from "./audio-engine.js";

// DOM Elements
const screens = {
    intro: document.getElementById('intro-screen'),
    setup: document.getElementById('setup-screen'),
    distribution: document.getElementById('distribution-screen'),
    game: document.getElementById('game-screen'),
    end: document.getElementById('end-screen')
};

const audio = new RetroAudioEngine();
const themeSelector = document.getElementById('theme-selector');
const toggleSoundBtn = document.getElementById('toggle-sound');
const shiftStatus = document.getElementById('shift-status');
const goToSetupBtn = document.getElementById('go-to-setup-btn');

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
const revealAllBtn = document.getElementById('reveal-all-btn');

// Engine Initialization
let engine;
let dataset;
let distributionIndex = 0;
let gamesPlayedInShift = 0;

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
        bgOverlay.style.backgroundImage = 'none';
        bgOverlay.style.opacity = '0';
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

// 1. Load Dataset & Populate Categories
async function init() {
    audio.init();
    try {
        const response = await fetch('impostor_deck_200_v1_1_normalizado.json');
        dataset = await response.json();

        const categories = [...new Set(dataset.cards.map(c => c.categoria))].sort();
        categoryPillsContainer.innerHTML = '';
        categories.forEach(cat => {
            const pill = document.createElement('div');
            pill.className = 'category-pill active'; // Pre-selected
            const label = document.createElement('span');
            label.className = 'pill-label';
            label.textContent = cat;
            pill.appendChild(label);
            pill.dataset.category = cat;
            pill.addEventListener('click', () => {
                pill.classList.toggle('active');
                triggerHaptic('light');
                audio.play('click');
                if (pill.classList.contains('active')) {
                    updateBackground(cat);
                }
            });
            pill.addEventListener('mouseenter', () => {
                updateBackground(cat);
            });
            applyCategoryPreview(pill, cat);
            categoryPillsContainer.appendChild(pill);
        });
    } catch (e) {
        console.error("Failed to load dataset", e);
    }
}

goToSetupBtn.addEventListener('click', () => {
    switchScreen('setup');
});

selectAllBtn.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.category-pill').forEach(p => p.classList.add('active'));
});

selectNoneBtn.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
});

themeSelector.addEventListener('change', (e) => {
    document.body.setAttribute('data-theme', e.target.value);
    audio.play('click');
});

toggleSoundBtn.addEventListener('click', () => {
    audio.toggle();
    toggleSoundBtn.textContent = audio.enabled ? '🔊' : '🔇';
    audio.init();
});

// 2. Start Game Logic
startBtn.addEventListener('click', () => {
    audio.play('transition');
    shiftStatus.classList.remove('hidden');
    const playerNames = playerInput.value.split(',').map(n => n.trim()).filter(n => n);
    if (playerNames.length < 3) return alert("¡Atención! Se necesitan al menos 3 jugadores para una partida épica.");

    const players = playerNames.map((name, i) => ({ id: i.toString(), name }));
    const impostorCount = parseInt(impostorInput.value);
    const difficulty = parseInt(difficultyInput.value);
    const selectedCats = Array.from(document.querySelectorAll('.category-pill.active')).map(p => p.dataset.category);

    const wordBank = dataset.cards
        .filter(card => card.dificultad <= difficulty)
        .map(card => ({
            word: card.palabra_secreta,
            category: card.categoria,
            forbidden: card.prohibidas
        }));

    engine = new ImpostorWordEngine({ impostorCount });
    engine.start({
        players,
        wordBank,
        categories: selectedCats.length ? selectedCats : undefined,
        impostorCount
    });

    startDistribution();
});

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
            <h3 class="card-role" style="font-size: 1.2rem; opacity: 0.8;">${card.category}</h3>
            <p class="card-label">Caso a Debatir</p>
            <h3 class="card-word">${card.word}</h3>
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

revealAllBtn.addEventListener('click', () => {
    triggerHaptic('heavy');
    audio.play('success');
    const state = engine.getState();
    gamesPlayedInShift++;

    document.getElementById('end-result-label').textContent = `ÉXITO CLÍNICO #${gamesPlayedInShift}`;
    const impostors = state.players.filter(p => p.role === "IMPOSTOR").map(p => p.name).join(", ");

    document.getElementById('winner-display').textContent = `IMPOSTOR(ES): ${impostors}`;
    document.getElementById('secret-word-display').textContent = state.secret.word;
    switchScreen('end');
});

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
    Object.values(screens).forEach(s => {
        if (s) s.classList.remove('active');
    });
    if (screens[id]) {
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

init();
