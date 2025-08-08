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
let statistics = {
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    maxStreak: 0,
    guessDistribution: {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0}
};

// DOM Elements
const difficultySection = document.getElementById('difficulty-selection');
const gameBoard = document.getElementById('game-board');
const boardContainer = document.getElementById('board-container');
const keyboard = document.getElementById('keyboard');
const gameOverScreen = document.getElementById('game-over');
const statsModal = document.getElementById('stats-modal');
const statsButton = document.getElementById('stats-btn');
const closeStatsButton = document.querySelector('.close-modal');
const newGameButton = document.getElementById('new-game-btn');
const playAgainButton = document.getElementById('play-again-btn');
const gameOverMessage = document.getElementById('game-result');
const gameOverWord = document.getElementById('correct-word');
const difficultyButtons = document.querySelectorAll('.difficulty-btn');
const messageDisplay = document.getElementById('message-display');
const attemptsCount = document.getElementById('attempts-count');
const maxAttemptsDisplay = document.getElementById('max-attempts');
const currentDifficultyDisplay = document.getElementById('current-difficulty');

// Initialize the game
document.addEventListener('DOMContentLoaded', () => {
    loadStatistics();
    setupDifficultyButtons();
    setupKeyboard();
    setupModalButtons();
});

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
            let wordLength;
            
            // Determine word length based on difficulty
            switch(difficulty) {
                case 'easy':
                    // For easy, choose from 3, 4, or 5 letter words
                    const easyLengths = Object.keys(wordLists.easy).map(Number);
                    wordLength = easyLengths[Math.floor(Math.random() * easyLengths.length)];
                    break;
                case 'medium':
                    // For medium, choose from 5, 6, or 7 letter words
                    const mediumLengths = Object.keys(wordLists.medium).map(Number);
                    wordLength = mediumLengths[Math.floor(Math.random() * mediumLengths.length)];
                    break;
                case 'hard':
                    // For hard, choose from 7, 8, or 9 letter words
                    const hardLengths = Object.keys(wordLists.hard).map(Number);
                    wordLength = hardLengths[Math.floor(Math.random() * hardLengths.length)];
                    break;
                default:
                    wordLength = 5;
            }
            
            startGame(difficulty, wordLength);
        });
    });
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
    if (gameOver || !currentDifficulty) return;
    
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
    if (gameOver || !currentDifficulty) return;
    
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
    if (currentAttempt.length !== currentWordLength) {
        showMessage(`Word must be ${currentWordLength} letters long`);
        return;
    }
    
    // Check if word is in the word list
    const wordList = wordLists[currentDifficulty][currentWordLength];
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
    currentDifficulty = difficulty;
    currentWordLength = wordLength;
    attempts = [];
    currentAttempt = "";
    gameOver = false;
    gameWon = false;
    
    // Select a random word from the word list
    const wordList = wordLists[difficulty][wordLength];
    targetWord = wordList[Math.floor(Math.random() * wordList.length)];
    
    console.log(`Target word: ${targetWord}`); // For debugging
    
    // Hide difficulty section and show game section
    difficultySection.classList.add('hidden');
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
    currentDifficultyDisplay.textContent = currentDifficulty.charAt(0).toUpperCase() + currentDifficulty.slice(1);
    
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
        gameOverMessage.textContent = won ? 'You Won!' : 'Game Over';
        gameOverWord.textContent = `The word was: ${targetWord.toUpperCase()}`;
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
    statsButton.addEventListener('click', () => {
        statsModal.classList.remove('hidden');
    });
    
    closeStatsButton.addEventListener('click', () => {
        statsModal.classList.add('hidden');
    });
    
    newGameButton.addEventListener('click', () => {
        difficultySection.classList.remove('hidden');
        gameBoard.classList.add('hidden');
        keyboard.classList.add('hidden');
        gameOverScreen.classList.add('hidden');
    });
    
    playAgainButton.addEventListener('click', () => {
        difficultySection.classList.remove('hidden');
        gameOverScreen.classList.add('hidden');
    });
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