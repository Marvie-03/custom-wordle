// script.js - Main JavaScript file for Wordle Game

// Game state variables
let currentDifficulty = null;
let currentWordLength = null;
let targetWord = "";
let attempts = [];
let currentAttempt = "";
let maxAttempts = 6;
let gameOver = false;
let gameWon = false;
let competitionMode = false;
let competitionRequestInProgress = false;
let competitionState = null;
let profileUsername = '';
let statistics = {
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    maxStreak: 0,
    guessDistribution: {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0}
};

// DOM Elements
const difficultySelection = document.getElementById('difficulty-selection');
const gameBoard = document.getElementById('game-board');
const boardContainer = document.getElementById('board-container');
const keyboard = document.getElementById('keyboard');
const gameOverScreen = document.getElementById('game-over');
const statsModal = document.getElementById('stats-modal');
const statsBtn = document.getElementById('stats-btn');
const closeStatsBtn = document.getElementById('close-stats');
const newGameBtn = document.getElementById('new-game-btn');
const playAgainBtn = document.getElementById('play-again-btn');
const gameResult = document.getElementById('game-result');
const correctWordDisplay = document.getElementById('correct-word');
const difficultyButtons = document.querySelectorAll('.difficulty-btn');
const messageDisplay = document.getElementById('message-display');
const attemptsCount = document.getElementById('attempts-count');
const maxAttemptsDisplay = document.getElementById('max-attempts');
const currentDifficultyDisplay = document.getElementById('current-difficulty');
const helpBtn = document.getElementById('help-btn');
const howToPlayModal = document.getElementById('how-to-play-modal');
const closeHowToPlayBtn = document.getElementById('close-how-to-play');
const gameStatus = document.getElementById('game-status');
const competitionHome = document.getElementById('competition-home');
const competitionStatus = document.getElementById('competition-status');
const competitionStartBtn = document.getElementById('competition-start-btn');
const competitionResultScore = document.getElementById('competition-result-score');
const competitionProfile = document.getElementById('competition-profile');
const competitionAuth = document.getElementById('competition-auth');
const profileModal = document.getElementById('profile-modal');
const leaderboardModal = document.getElementById('leaderboard-modal');
const supabaseConfig = window.WORDLE_SUPABASE_CONFIG || {};
const supabaseClient = window.supabase && supabaseConfig.url && supabaseConfig.anonKey
    ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey)
    : null;

// Initialize the game
document.addEventListener('DOMContentLoaded', () => {
    loadStatistics();
    setupDifficultyButtons();
    setupKeyboard();
    setupModalButtons();
    setupCompetition();
    checkFirstTimeUser();
});

// Check if it's the first time user is playing
function checkFirstTimeUser() {
    const hasPlayedBefore = localStorage.getItem('hasPlayedBefore');
    if (!hasPlayedBefore) {
        // Show how to play modal for first-time users
        howToPlayModal.classList.remove('hidden');
        // Set flag in localStorage
        localStorage.setItem('hasPlayedBefore', 'true');
    }
}

// Load saved statistics from localStorage
function loadStatistics() {
    const savedStats = localStorage.getItem('wordleStats');
    if (savedStats) {
        statistics = JSON.parse(savedStats);
    }
    updateStatisticsDisplay();
}

// Save statistics to localStorage
function saveStatistics() {
    localStorage.setItem('wordleStats', JSON.stringify(statistics));
}

// Setup difficulty selection buttons
function setupDifficultyButtons() {
    difficultyButtons.forEach(button => {
        button.addEventListener('click', () => {
            const difficulty = button.dataset.difficulty;
            const lengthsByDifficulty = {
                easy: [3, 4, 5],
                medium: [5, 6, 7],
                hard: [7, 8, 9]
            };
            const availableLengths = (lengthsByDifficulty[difficulty] || [])
                .filter(length => getTrainingWords(difficulty, length).length > 0);
            if (!availableLengths.length) {
                showMessage('No training words are available for this difficulty.');
                return;
            }
            const wordLength = availableLengths[Math.floor(Math.random() * availableLengths.length)];
            startGame(difficulty, wordLength);
        });
    });
}

function getTrainingWords(difficulty, wordLength) {
    return [...new Set(Object.values(wordLists[difficulty] || {})
        .flat()
        .map(word => word.toLowerCase())
        .filter(word => word.length === wordLength))];
}

// Setup keyboard event listeners
function setupKeyboard() {
    // Physical keyboard support
    document.addEventListener('keydown', handleKeyPress);
    
    // Virtual keyboard support
    const keys = keyboard.querySelectorAll('.keyboard-key');
    keys.forEach(key => {
        key.addEventListener('click', () => {
            const keyValue = key.dataset.key;
            handleVirtualKeyPress(keyValue);
        });
    });
}

// Handle physical keyboard key press
function handleKeyPress(event) {
    if (gameOver || (!currentDifficulty && !competitionMode) || competitionRequestInProgress) return;
    
    const key = event.key.toLowerCase();
    
    if (key === 'enter') {
        submitGuess();
    } else if (key === 'backspace') {
        removeLastLetter();
    } else if (/^[a-z]$/.test(key) && currentAttempt.length < currentWordLength) {
        addLetter(key);
    }
}

// Handle virtual keyboard key press
function handleVirtualKeyPress(key) {
    if (gameOver || (!currentDifficulty && !competitionMode) || competitionRequestInProgress) return;
    
    if (key === 'enter') {
        submitGuess();
    } else if (key === 'backspace') {
        removeLastLetter();
    } else if (/^[a-z]$/.test(key) && currentAttempt.length < currentWordLength) {
        addLetter(key);
    }
}

// Add letter to current attempt
function addLetter(letter) {
    if (currentAttempt.length < currentWordLength) {
        currentAttempt += letter;
        updateGameBoard();
    }
}

// Remove last letter from current attempt
function removeLastLetter() {
    if (currentAttempt.length > 0) {
        currentAttempt = currentAttempt.slice(0, -1);
        updateGameBoard();
    }
}

// Submit current guess
function submitGuess() {
    if (competitionMode) {
        submitCompetitionGuess();
        return;
    }

    if (currentAttempt.length !== currentWordLength) {
        showMessage(`Word must be ${currentWordLength} letters long`);
        return;
    }
    
    // Check if word is in the word list
    const wordList = getTrainingWords(currentDifficulty, currentWordLength);
    if (!wordList.includes(currentAttempt)) {
        showMessage('Not in word list');
        return;
    }
    
    // Add attempt to the list
    attempts.push(currentAttempt);
    
    // Check if guess is correct
    if (currentAttempt === targetWord) {
        gameWon = true;
        gameOver = true;
        updateStatistics(true);
        showGameOverScreen(true);
    } else if (attempts.length >= maxAttempts) {
        gameOver = true;
        updateStatistics(false);
        showGameOverScreen(false);
    }
    
    // Update keyboard colors
    updateKeyboardColors();
    
    // Reset current attempt
    currentAttempt = "";
    updateGameBoard();
}

// Start a new game with selected difficulty and word length
function startGame(difficulty, wordLength) {
    // Reset game state
    competitionMode = false;
    competitionState = null;
    currentDifficulty = difficulty;
    currentWordLength = wordLength;
    attempts = [];
    currentAttempt = "";
    gameOver = false;
    gameWon = false;
    
    // Select a random word from the word list
    const wordList = getTrainingWords(difficulty, wordLength);
    targetWord = wordList[Math.floor(Math.random() * wordList.length)];
    
    // Hide difficulty selection and show game board
    difficultySelection.classList.add('hidden');
    gameBoard.classList.remove('hidden');
    keyboard.classList.remove('hidden');
    gameOverScreen.classList.add('hidden');
    
    // Create game board based on word length and max attempts
    createGameBoard();
    
    // Reset keyboard colors
    resetKeyboardColors();
}

// Create game board based on word length and max attempts
function createGameBoard() {
    boardContainer.innerHTML = '';
    
    for (let i = 0; i < maxAttempts; i++) {
        const row = document.createElement('div');
        row.classList.add('row');
        
        for (let j = 0; j < currentWordLength; j++) {
            const tile = document.createElement('div');
            tile.classList.add('board-tile');
            row.appendChild(tile);
        }
        
        boardContainer.appendChild(row);
    }
    
    // Update attempts display
    attemptsCount.textContent = '0';
    maxAttemptsDisplay.textContent = maxAttempts;
    currentDifficultyDisplay.textContent = competitionMode
        ? 'Daily Competition'
        : currentDifficulty.charAt(0).toUpperCase() + currentDifficulty.slice(1);
    
    updateGameBoard();
}

// Update game board with current attempts and current attempt
function updateGameBoard() {
    const rows = boardContainer.querySelectorAll('.row');
    
    // Clear all tiles
    rows.forEach(row => {
        const tiles = row.querySelectorAll('.board-tile');
        tiles.forEach(tile => {
            tile.textContent = '';
            tile.className = 'board-tile';
        });
    });
    
    if (competitionMode && competitionState) {
        for (let i = 0; i < competitionState.guesses.length; i++) {
            const tiles = rows[i].querySelectorAll('.board-tile');
            const guess = competitionState.guesses[i];
            const feedback = competitionState.feedback[i];
            for (let j = 0; j < guess.length; j++) {
                tiles[j].textContent = guess[j].toUpperCase();
                tiles[j].classList.add(feedback[j]);
            }
        }

        if (!competitionState.completed && competitionState.guesses.length < maxAttempts) {
            const tiles = rows[competitionState.guesses.length].querySelectorAll('.board-tile');
            for (let i = 0; i < currentAttempt.length; i++) {
                tiles[i].textContent = currentAttempt[i].toUpperCase();
                tiles[i].classList.add('filled');
            }
        }
        attemptsCount.textContent = competitionState.guesses.length;
        return;
    }

    // Fill in completed attempts with correct colors
    for (let i = 0; i < attempts.length; i++) {
        const row = rows[i];
        const tiles = row.querySelectorAll('.board-tile');
        const attempt = attempts[i];
        
        // Create a map to track remaining letters in the target word
        const targetLetterCount = {};
        for (let j = 0; j < targetWord.length; j++) {
            const letter = targetWord[j];
            targetLetterCount[letter] = (targetLetterCount[letter] || 0) + 1;
        }
        
        // First pass: Mark correct positions
        for (let j = 0; j < attempt.length; j++) {
            const tile = tiles[j];
            const letter = attempt[j];
            
            tile.textContent = letter.toUpperCase();
            
            if (letter === targetWord[j]) {
                tile.classList.add('correct');
                targetLetterCount[letter]--;
            }
        }
        
        // Second pass: Mark present and absent letters
        for (let j = 0; j < attempt.length; j++) {
            const tile = tiles[j];
            const letter = attempt[j];
            
            if (letter !== targetWord[j]) {
                if (targetLetterCount[letter] > 0) {
                    tile.classList.add('present');
                    targetLetterCount[letter]--;
                } else {
                    tile.classList.add('absent');
                }
            }
        }
    }
    
    // Fill in current attempt
    if (attempts.length < maxAttempts) {
        const row = rows[attempts.length];
        const tiles = row.querySelectorAll('.board-tile');
        
        for (let i = 0; i < currentAttempt.length; i++) {
            tiles[i].textContent = currentAttempt[i].toUpperCase();
        }
    }
    
    // Update attempts count
    attemptsCount.textContent = attempts.length;
}

// Update keyboard colors based on guesses
function updateKeyboardColors() {
    const keys = keyboard.querySelectorAll('.keyboard-key');
    const letterStatus = {};

    if (competitionMode && competitionState) {
        competitionState.guesses.forEach((guess, rowIndex) => {
            guess.split('').forEach((letter, index) => {
                const status = competitionState.feedback[rowIndex][index];
                const priority = { unused: 0, absent: 1, present: 2, correct: 3 };
                if (!letterStatus[letter] || priority[status] > priority[letterStatus[letter]]) {
                    letterStatus[letter] = status;
                }
            });
        });
        keys.forEach(key => {
            const letter = key.dataset.key;
            if (!letter || !/^[a-z]$/.test(letter)) return;
            key.classList.remove('correct', 'present', 'absent');
            if (letterStatus[letter]) key.classList.add(letterStatus[letter]);
        });
        return;
    }
    
    // Initialize all letters as unused
    keys.forEach(key => {
        const letter = key.dataset.key;
        if (letter && /^[a-z]$/.test(letter)) {
            letterStatus[letter] = 'unused';
        }
    });
    
    // Update letter status based on attempts
    for (const attempt of attempts) {
        for (let i = 0; i < attempt.length; i++) {
            const letter = attempt[i];
            
            if (letter === targetWord[i]) {
                letterStatus[letter] = 'correct';
            } else if (targetWord.includes(letter) && letterStatus[letter] !== 'correct') {
                letterStatus[letter] = 'present';
            } else if (letterStatus[letter] !== 'correct' && letterStatus[letter] !== 'present') {
                letterStatus[letter] = 'absent';
            }
        }
    }
    
    // Apply colors to keyboard keys
    keys.forEach(key => {
        const letter = key.dataset.key;
        if (letter && /^[a-z]$/.test(letter)) {
            // Remove existing status classes
            key.classList.remove('correct', 'present', 'absent');
            
            // Add new status class
            if (letterStatus[letter] !== 'unused') {
                key.classList.add(letterStatus[letter]);
            }
        }
    });
}

// Reset keyboard colors
function resetKeyboardColors() {
    const keys = keyboard.querySelectorAll('.keyboard-key');
    keys.forEach(key => {
        key.classList.remove('correct', 'present', 'absent');
    });
}

// Show game over screen
function showGameOverScreen(won) {
    setTimeout(() => {
        gameResult.textContent = won ? 'You Won!' : 'Game Over';
        correctWordDisplay.textContent = competitionMode
            ? 'Today’s competition puzzle is complete.'
            : `The word was: ${targetWord.toUpperCase()}`;
        competitionResultScore.classList.toggle('hidden', !competitionMode);
        if (competitionMode) {
            competitionResultScore.textContent = `${competitionState.score} ${competitionState.score === 1 ? 'point' : 'points'} earned`;
            document.getElementById('game-stats').classList.add('hidden');
        } else {
            document.getElementById('game-stats').classList.remove('hidden');
        }
        gameOverScreen.classList.remove('hidden');
    }, 1000);
}

// Update statistics after game ends
function updateStatistics(won) {
    statistics.gamesPlayed++;
    
    // Initialize difficulty stats if they don't exist
    if (!statistics.difficultyStats) {
        statistics.difficultyStats = {
            easy: { wins: 0, total: 0 },
            medium: { wins: 0, total: 0 },
            hard: { wins: 0, total: 0 }
        };
    }
    
    // Update difficulty-specific stats
    statistics.difficultyStats[currentDifficulty].total++;
    
    if (won) {
        statistics.gamesWon++;
        statistics.currentStreak++;
        statistics.difficultyStats[currentDifficulty].wins++;
        
        // Update guess distribution
        if (!statistics.guessDistribution) {
            statistics.guessDistribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0};
        }
        statistics.guessDistribution[attempts.length] = (statistics.guessDistribution[attempts.length] || 0) + 1;
        
        if (statistics.currentStreak > statistics.maxStreak) {
            statistics.maxStreak = statistics.currentStreak;
        }
    } else {
        statistics.currentStreak = 0;
    }
    
    saveStatistics();
    updateStatisticsDisplay();
}

// Update statistics display
function updateStatisticsDisplay() {
    const winPercentage = statistics.gamesPlayed > 0 
        ? Math.round((statistics.gamesWon / statistics.gamesPlayed) * 100) 
        : 0;
        
    // Update game over stats
    const gamesPlayedElement = document.getElementById('games-played');
    const winPercentageElement = document.getElementById('win-percentage');
    const currentStreakElement = document.getElementById('current-streak');
    const maxStreakElement = document.getElementById('max-streak');
    
    if (gamesPlayedElement) gamesPlayedElement.textContent = statistics.gamesPlayed;
    if (winPercentageElement) winPercentageElement.textContent = winPercentage;
    if (currentStreakElement) currentStreakElement.textContent = statistics.currentStreak;
    if (maxStreakElement) maxStreakElement.textContent = statistics.maxStreak;
    
    // Update modal stats
    const modalGamesPlayedElement = document.getElementById('modal-games-played');
    const modalWinPercentageElement = document.getElementById('modal-win-percentage');
    const modalCurrentStreakElement = document.getElementById('modal-current-streak');
    const modalMaxStreakElement = document.getElementById('modal-max-streak');
    
    if (modalGamesPlayedElement) modalGamesPlayedElement.textContent = statistics.gamesPlayed;
    if (modalWinPercentageElement) modalWinPercentageElement.textContent = winPercentage;
    if (modalCurrentStreakElement) modalCurrentStreakElement.textContent = statistics.currentStreak;
    if (modalMaxStreakElement) modalMaxStreakElement.textContent = statistics.maxStreak;
    
    // Update difficulty stats if they exist
    const easyWinsElement = document.getElementById('easy-wins');
    const easyTotalElement = document.getElementById('easy-total');
    const mediumWinsElement = document.getElementById('medium-wins');
    const mediumTotalElement = document.getElementById('medium-total');
    const hardWinsElement = document.getElementById('hard-wins');
    const hardTotalElement = document.getElementById('hard-total');
    
    // Initialize difficulty stats if they don't exist in the statistics object
    if (!statistics.difficultyStats) {
        statistics.difficultyStats = {
            easy: { wins: 0, total: 0 },
            medium: { wins: 0, total: 0 },
            hard: { wins: 0, total: 0 }
        };
    }
    
    // Update difficulty stats elements if they exist
    if (easyWinsElement) easyWinsElement.textContent = statistics.difficultyStats.easy.wins;
    if (easyTotalElement) easyTotalElement.textContent = statistics.difficultyStats.easy.total;
    if (mediumWinsElement) mediumWinsElement.textContent = statistics.difficultyStats.medium.wins;
    if (mediumTotalElement) mediumTotalElement.textContent = statistics.difficultyStats.medium.total;
    if (hardWinsElement) hardWinsElement.textContent = statistics.difficultyStats.hard.wins;
    if (hardTotalElement) hardTotalElement.textContent = statistics.difficultyStats.hard.total;
}

// Setup modal buttons
function setupModalButtons() {
    // Stats modal
    statsBtn.addEventListener('click', () => {
        updateStatisticsDisplay();
        statsModal.classList.remove('hidden');
    });
    
    closeStatsBtn.addEventListener('click', () => {
        statsModal.classList.add('hidden');
    });
    
    // How to Play modal
    helpBtn.addEventListener('click', () => {
        howToPlayModal.classList.remove('hidden');
    });
    
    closeHowToPlayBtn.addEventListener('click', () => {
        howToPlayModal.classList.add('hidden');
    });
    
    newGameBtn.addEventListener('click', () => {
        setGameMode('training');
        difficultySelection.classList.remove('hidden');
        document.getElementById('game-board').classList.add('hidden');
        keyboard.classList.add('hidden');
        gameOverScreen.classList.add('hidden');
    });
    
    playAgainBtn.addEventListener('click', () => {
        setGameMode('training');
        difficultySelection.classList.remove('hidden');
        gameOverScreen.classList.add('hidden');
    });

    document.getElementById('profile-btn').addEventListener('click', () => {
        profileModal.classList.remove('hidden');
    });
    document.getElementById('close-profile').addEventListener('click', () => {
        profileModal.classList.add('hidden');
    });
    document.getElementById('leaderboard-btn').addEventListener('click', openLeaderboard);
    document.getElementById('close-leaderboard').addEventListener('click', () => {
        leaderboardModal.classList.add('hidden');
    });
}

function setGameMode(mode) {
    const isCompetition = mode === 'competition';
    competitionHome.classList.toggle('hidden', !isCompetition);
    difficultySelection.classList.toggle('hidden', isCompetition);
    if (gameBoard) gameBoard.classList.add('hidden');
    keyboard.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    document.querySelectorAll('.mode-btn').forEach(button => {
        const active = button.dataset.mode === mode;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
    });
    competitionMode = false;
}

function setupCompetition() {
    competitionStartBtn.addEventListener('click', startCompetitionGame);
    document.querySelectorAll('.mode-btn').forEach(button => {
        button.addEventListener('click', () => setGameMode(button.dataset.mode));
    });
    document.getElementById('supabase-notice').classList.toggle('hidden', Boolean(supabaseClient));
    competitionAuth.classList.toggle('hidden', !supabaseClient);
    document.getElementById('competition-date').textContent = new Date().toLocaleDateString(undefined, {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZoneName: 'short'
    });
    if (!supabaseClient) {
        competitionStatus.textContent = 'Configure Supabase to sign in and play.';
        return;
    }

    document.getElementById('google-sign-in').addEventListener('click', async () => {
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.href.split('#')[0] }
        });
        if (error) setCompetitionMessage(error.message);
    });

    document.getElementById('email-sign-in').addEventListener('click', async () => {
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) setCompetitionMessage(error.message);
    });

    document.getElementById('email-sign-up').addEventListener('click', async () => {
        const username = document.getElementById('auth-username').value.trim();
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
            setCompetitionMessage('Username must be 3–20 letters, numbers, or underscores.');
            return;
        }
        const { error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: { data: { username } }
        });
        if (error) setCompetitionMessage(error.message);
        else setCompetitionMessage('Account created. Check your email if confirmation is enabled.');
    });

    document.getElementById('save-profile-btn').addEventListener('click', saveProfile);
    document.getElementById('sign-out-btn').addEventListener('click', async () => {
        const { error } = await supabaseClient.auth.signOut();
        if (error) setCompetitionMessage(error.message);
        else profileModal.classList.add('hidden');
    });

    supabaseClient.auth.onAuthStateChange((_event, session) => {
        setTimeout(() => {
            updateAuthUI(session);
            if (session) loadProfile();
        }, 0);
    });
    supabaseClient.auth.getSession().then(({ data, error }) => {
        if (error) {
            setCompetitionMessage(error.message);
            return;
        }
        updateAuthUI(data.session);
        if (data.session) loadProfile();
    });
}

function updateAuthUI(session) {
    competitionAuth.classList.toggle('hidden', Boolean(session));
    competitionProfile.classList.toggle('hidden', !session);
    document.getElementById('signed-out-profile').classList.toggle('hidden', Boolean(session));
    document.getElementById('signed-in-profile').classList.toggle('hidden', !session);
    if (!session) {
        document.getElementById('profile-username-display').textContent = 'Player';
        document.getElementById('season-points').textContent = '—';
        competitionStatus.textContent = 'Sign in to play today’s puzzle.';
    }
}

async function loadProfile() {
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !session) return;
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('username')
        .eq('id', session.user.id)
        .single();
    if (error) {
        setCompetitionMessage(error.message);
        return;
    }
    document.getElementById('profile-username-display').textContent = data.username;
    document.getElementById('profile-username').value = data.username;
    profileUsername = data.username;
    refreshSeasonPoints().catch(error => setCompetitionMessage(error.message));
    document.getElementById('competition-date').textContent = new Date().toLocaleDateString(undefined, {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZoneName: 'short'
    });
}

async function saveProfile() {
    const username = document.getElementById('profile-username').value.trim();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
        setCompetitionMessage('Username must be 3–20 letters, numbers, or underscores.');
        return;
    }
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !session) {
        setCompetitionMessage(sessionError ? sessionError.message : 'Sign in to update your profile.');
        return;
    }
    const { error } = await supabaseClient
        .from('profiles')
        .update({ username })
        .eq('id', session.user.id);
    if (error) {
        setCompetitionMessage(error.code === '23505' ? 'That username is already taken.' : error.message);
        return;
    }
    document.getElementById('profile-username-display').textContent = username;
    profileUsername = username;
    setCompetitionMessage('Username updated.');
}

async function refreshSeasonPoints() {
    const season = new Date().toISOString().slice(0, 7);
    const result = await competitionRequest({ action: 'leaderboard', season });
    const player = result.entries.find(entry => entry.isYou);
    document.getElementById('season-points').textContent = player ? player.points : '0';
}

async function competitionRequest(payload) {
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) throw new Error('Sign in to play competition.');
    const response = await fetch(`${supabaseConfig.url}/functions/v1/competition`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'The competition request failed.');
    return result;
}

async function startCompetitionGame() {
    if (!supabaseClient) {
        setCompetitionMessage('Competition setup is not finished yet.');
        return;
    }
    if (!profileUsername || profileUsername.startsWith('player_')) {
        setCompetitionMessage('Choose your unique username in Profile before competing.');
        profileModal.classList.remove('hidden');
        return;
    }
    competitionRequestInProgress = true;
    competitionStartBtn.disabled = true;
    setCompetitionMessage('Loading today’s puzzle…');
    try {
        competitionState = await competitionRequest({ action: 'start' });
        competitionMode = true;
        currentDifficulty = null;
        currentWordLength = 5;
        attempts = [...competitionState.guesses];
        currentAttempt = '';
        maxAttempts = competitionState.maxGuesses;
        gameOver = competitionState.completed;
        gameWon = competitionState.won;
        difficultySelection.classList.add('hidden');
        competitionHome.classList.add('hidden');
        gameBoard.classList.remove('hidden');
        keyboard.classList.remove('hidden');
        gameOverScreen.classList.add('hidden');
        document.getElementById('game-stats').classList.add('hidden');
        competitionResultScore.classList.add('hidden');
        createGameBoard();
        updateKeyboardColors();
        setCompetitionMessage(competitionState.completed
            ? `Today's puzzle is complete — ${competitionState.score} points earned.`
            : 'Your competition game is in progress.');
        if (competitionState.completed) showGameOverScreen(competitionState.won);
    } catch (error) {
        setCompetitionMessage(error.message);
    } finally {
        competitionRequestInProgress = false;
        competitionStartBtn.disabled = false;
    }
}

async function submitCompetitionGuess() {
    if (!competitionMode || !competitionState || competitionRequestInProgress) return;
    if (currentAttempt.length !== currentWordLength) {
        showMessage(`Word must be ${currentWordLength} letters long`);
        return;
    }
    competitionRequestInProgress = true;
    try {
        competitionState = await competitionRequest({ action: 'guess', guess: currentAttempt });
        attempts = [...competitionState.guesses];
        currentAttempt = '';
        updateGameBoard();
        updateKeyboardColors();
        if (competitionState.completed) {
            gameWon = competitionState.won;
            gameOver = true;
            showGameOverScreen(gameWon);
            setCompetitionMessage(`Puzzle complete — ${competitionState.score} points earned.`);
            refreshSeasonPoints().catch(error => setCompetitionMessage(error.message));
        }
    } catch (error) {
        showMessage(error.message);
        setCompetitionMessage(error.message);
    } finally {
        competitionRequestInProgress = false;
    }
}

async function openLeaderboard() {
    leaderboardModal.classList.remove('hidden');
    const entriesElement = document.getElementById('leaderboard-entries');
    const statusElement = document.getElementById('leaderboard-status');
    entriesElement.replaceChildren();
    if (!supabaseClient) {
        statusElement.textContent = 'Configure Supabase to load leaderboard scores.';
        return;
    }
    statusElement.textContent = 'Loading leaderboard…';
    const season = new Date().toISOString().slice(0, 7);
    document.getElementById('leaderboard-season').textContent = season;
    try {
        const result = await competitionRequest({ action: 'leaderboard', season });
        const player = result.entries.find(entry => entry.isYou);
        document.getElementById('season-points').textContent = player ? player.points : '0';
        result.entries.forEach(entry => {
            const row = document.createElement('li');
            row.className = `leaderboard-row${entry.isYou ? ' you' : ''}`;
            for (const value of [entry.rank, entry.username, entry.points]) {
                const cell = document.createElement('span');
                cell.textContent = value;
                row.appendChild(cell);
            }
            entriesElement.appendChild(row);
        });
        statusElement.textContent = result.entries.length ? '' : 'No completed games this season yet.';
    } catch (error) {
        statusElement.textContent = error.message;
    }
}

function setCompetitionMessage(message) {
    if (competitionStatus) competitionStatus.textContent = message;
    const authFeedback = document.getElementById('auth-feedback');
    const profileFeedback = document.getElementById('profile-feedback');
    if (authFeedback && !competitionAuth.classList.contains('hidden')) authFeedback.textContent = message;
    if (profileFeedback && !profileModal.classList.contains('hidden')) profileFeedback.textContent = message;
    const leaderboardStatus = document.getElementById('leaderboard-status');
    if (leaderboardModal && !leaderboardModal.classList.contains('hidden') && leaderboardStatus) {
        leaderboardStatus.textContent = message;
    }
}

// Show message to user
function showMessage(message) {
    if (messageDisplay) {
        messageDisplay.textContent = message;
        messageDisplay.classList.add('active');
        
        // Clear any existing timeout
        if (messageDisplay.timeoutId) {
            clearTimeout(messageDisplay.timeoutId);
        }
        
        // Set new timeout to hide message after 2 seconds
        messageDisplay.timeoutId = setTimeout(() => {
            messageDisplay.classList.remove('active');
        }, 2000);
    } else {
        console.error('Message display element not found');
    }
}