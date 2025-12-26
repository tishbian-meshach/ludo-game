/**
 * UIManager - Manages HTML UI screens and Game Overlay
 * Handles transitions between Start, Setup, and Game screens.
 */

import { GameConfig, GameState } from '../engine2d/GameState';
import { eventBus } from '../engine2d/EventBus';
import { PLAYER_ORDER } from '../styles/theme';

export class UIManager {
    private gameState: GameState;
    private onStartGame: (config: GameConfig) => void;

    // Screens
    private startScreen: HTMLElement;
    private setupScreen: HTMLElement;
    private gameUIOverlay: HTMLElement;
    private gameContainer: HTMLElement; // The canvas container

    // Components
    private avatarContainer: HTMLElement;
    private playerInputs: HTMLElement;

    // Config State
    private config: GameConfig = {
        playerCount: 2,
        activePlayerIndices: [0, 2], // Default R+Y
        playerNames: ['Player 1', 'Player 2', 'Player 3', 'Player 4'],
        botStatus: [false, false, false, false]
    };

    constructor(gameState: GameState, onStartGame: (config: GameConfig) => void) {
        this.gameState = gameState;
        this.onStartGame = onStartGame;

        // Cache Elements
        this.startScreen = document.getElementById('start-screen')!;
        this.setupScreen = document.getElementById('setup-screen')!;
        this.gameUIOverlay = document.getElementById('game-ui-overlay')!;
        this.gameContainer = document.getElementById('game-container')!;
        this.avatarContainer = document.getElementById('avatar-container')!;
        this.playerInputs = document.querySelector('.player-config')!;

        this.setupEventListeners();

        // Initial state logic?
        // Let game start in menu mode
    }

    private setupEventListeners(): void {
        // Start Screen -> Play -> Setup
        document.getElementById('btn-play-initial')?.addEventListener('click', () => {
            this.showScreen(this.setupScreen);
        });

        // Setup Back -> Start
        document.getElementById('btn-back')?.addEventListener('click', () => {
            this.showScreen(this.startScreen);
        });

        // Local state for toggles (no global config.gameMode anymore)

        // Setup Grid Selection & Toggles
        const gridCells = document.querySelectorAll('.player-cell');

        // Initial Selection: Red (0) and Yellow (2)
        // Note: HTML already has 'selected' class on 0 and 2

        gridCells.forEach(cell => {
            const input = cell.querySelector('input') as HTMLInputElement;
            const editIcon = cell.querySelector('.edit-icon') as HTMLElement;
            const botBtn = cell.querySelector('.bot-toggle-btn') as HTMLElement;

            cell.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;

                // Toggle selection
                if (target.classList.contains('selected')) {
                    const selectedCells = Array.from(document.querySelectorAll('.player-cell.selected'));
                    const selectedCount = selectedCells.length;

                    // Validation: Must keep at least 1 human
                    const humanCount = selectedCells.filter(c => c.querySelector('.type-btn.human.active')).length;
                    const isTargetHuman = target.querySelector('.type-btn.human.active');

                    // Validation: Must keep at least 2 players
                    if (selectedCount > 2) {
                        if (isTargetHuman && humanCount <= 1) {
                            this.showToast("At least one human player is required!", 'error');
                            return;
                        }
                        target.classList.remove('selected');
                    }
                } else {
                    target.classList.add('selected');
                }

                // Update input state based on selection (and bot state)
                if (input) {
                    const botBtnSegmented = cell.querySelector('.type-btn.bot');
                    const isBot = !!(botBtnSegmented && botBtnSegmented.classList.contains('active'));
                    input.disabled = !target.classList.contains('selected') || isBot;
                }
            });

            // Input: stop propagation (don't toggle)
            if (input) {
                input.addEventListener('click', (e) => e.stopPropagation());
            }

            // Edit Icon
            if (editIcon && input) {
                editIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!input.disabled) {
                        input.focus();
                    }
                });
            }

            // Bot Toggle (Segmented)
            const humanBtn = cell.querySelector('.type-btn.human');
            const botBtnSegmented = cell.querySelector('.type-btn.bot');

            const setBotState = (isBot: boolean) => {
                if (isBot) {
                    humanBtn?.classList.remove('active');
                    botBtnSegmented?.classList.add('active');
                    if (input) {
                        // input.value = 'Bot'; // Optional: auto-rename
                        input.disabled = true;
                    }
                } else {
                    humanBtn?.classList.add('active');
                    botBtnSegmented?.classList.remove('active');
                    if (input && cell.classList.contains('selected')) {
                        input.disabled = false;
                    }
                }
            };

            if (humanBtn) {
                humanBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    setBotState(false);
                });
            }

            if (botBtnSegmented) {
                botBtnSegmented.addEventListener('click', (e) => {
                    e.stopPropagation();

                    // Validation: Prevent removing last human
                    if (cell.classList.contains('selected')) {
                        const selectedCells = Array.from(document.querySelectorAll('.player-cell.selected'));
                        const humanCount = selectedCells.filter(c => c.querySelector('.type-btn.human.active')).length;

                        if (humanBtn?.classList.contains('active') && humanCount <= 1) {
                            this.showToast("At least one human player is required!", 'error');
                            return;
                        }
                    }

                    setBotState(true);
                });
            }
        });

        // Start Game
        document.getElementById('btn-start-game')?.addEventListener('click', () => {
            // Collect Active Players
            const activeIndices: number[] = [];
            const playerNames: string[] = [];
            const botStatus: boolean[] = [false, false, false, false];

            // We iterate 0-3 to maintain order
            for (let i = 0; i < 4; i++) {
                const cell = document.querySelector(`.player-cell[data-player="${i}"]`);
                if (cell && cell.classList.contains('selected')) {
                    activeIndices.push(i);

                    const input = cell.querySelector('input') as HTMLInputElement;
                    playerNames.push(input.value || `Player ${i + 1}`);

                    const botBtn = cell.querySelector('.type-btn.bot');
                    if (botBtn && botBtn.classList.contains('active')) {
                        botStatus[i] = true;
                    }
                }
            }

            const config: GameConfig = {
                playerCount: activeIndices.length,
                activePlayerIndices: activeIndices,
                playerNames: playerNames,
                botStatus: botStatus
            };

            this.onStartGame(config);
            this.showScreen(this.gameUIOverlay);
            this.gameContainer.style.filter = 'none'; // Unblur
            this.gameContainer.style.pointerEvents = 'auto'; // Enable interaction

            // Update Overlay
            this.createAvatars();
        });

        // Game Events
        eventBus.on('TURN_CHANGED', ({ player }) => {
            this.updateActiveAvatar(player);
        });
    }

    /**
     * Switch visible screen
     */
    private showScreen(screen: HTMLElement): void {
        // Hide all screens
        [this.startScreen, this.setupScreen, this.gameUIOverlay].forEach(s => {
            s.classList.add('hidden');
            s.classList.remove('active');
        });

        // Show target
        screen.classList.remove('hidden');
        screen.classList.add('active');
    }



    /**
     * Create Avatar Elements in Overlay
     */
    private createAvatars(): void {
        this.avatarContainer.innerHTML = '';

        const names = this.gameState.getPlayerNames();
        const activePlayerIndices = this.gameState.getActivePlayerIndices();

        // Color hex values indexed by player index
        const colorHexByIndex: Record<number, string> = {
            0: '#FF4757', // Red
            1: '#2ECC71', // Green
            2: '#F1C40F', // Yellow
            3: '#3498DB', // Blue
        };

        activePlayerIndices.forEach((playerIndex, nameIndex) => {
            const colorName = PLAYER_ORDER[playerIndex];
            const name = names[nameIndex];
            const colorHex = colorHexByIndex[playerIndex];

            const avatar = document.createElement('div');
            avatar.className = `player-avatar p-avatar-${playerIndex}`; // Use player index for positioning
            avatar.id = `avatar-${playerIndex}`; // Use player index for ID

            // Set player color as CSS variable for active state
            avatar.style.setProperty('--player-color', colorHex);

            // Determine Icon
            const isBot = this.gameState.isBot(playerIndex);

            // Bot SVG (same as in setup)
            const botSvg = `
            <svg class="avatar-icon" viewBox="0 0 100 105" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M90,36.667h-4.167L79.98,47.312l-0.82-7.373C78.555,34.473,73.558,30,68.057,30H53.333v-7.591 c1.986-1.156,3.334-3.281,3.334-5.743C56.667,12.985,53.682,10,50,10s-6.666,2.985-6.666,6.667c0,2.461,1.349,4.586,3.332,5.743V30 H31.941c-5.5,0-10.496,4.473-11.104,9.938l-0.818,7.369l-5.854-10.641H10l3.334,26.666h4.904l-1.49,13.415 C15.938,84.036,21.274,90,28.608,90H71.39c7.334,0,12.673-5.964,11.862-13.252l-1.491-13.415h4.906L90,36.667z M60,80H40v-6.667h20 V80z M70,60c0,2.751-2.249,5-5,5H35c-2.75,0-5-2.249-5-5V48.333c0-2.75,2.25-5,5-5h30c2.751,0,5,2.25,5,5V60z" />
                <path d="M38.334,52.5c0-1.843,1.492-3.333,3.332-3.333c1.844,0,3.334,1.49,3.334,3.333v3.333c0,1.843-1.49,3.334-3.334,3.334 c-1.84,0-3.332-1.491-3.332-3.334V52.5z" />
                <path d="M55,52.5c0-1.843,1.491-3.333,3.333-3.333c1.843,0,3.334,1.49,3.334,3.333v3.333c0,1.843-1.491,3.334-3.334,3.334 c-1.842,0-3.333-1.491-3.333-3.334V52.5z" />
            </svg>`;

            // Human SVG
            const humanSvg = `
            <svg class="avatar-icon" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="8" r="4"/>
                <path d="M12 14c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4z"/>
            </svg>`;

            avatar.innerHTML = `
                <div class="avatar-circle" style="background: ${colorHex}">
                    ${isBot ? botSvg : humanSvg}
                </div>
                <div class="player-info">
                    <span class="player-name">${name}</span>
                    <span class="player-status">Waiting...</span>
                </div>
            `;

            this.avatarContainer.appendChild(avatar);
        });

        this.updateActiveAvatar(this.gameState.getCurrentPlayer());
    }

    /**
     * Highlight active player
     */
    private updateActiveAvatar(playerIndex: number): void {
        // Remove active class from all
        const avatars = this.avatarContainer.querySelectorAll('.player-avatar');
        avatars.forEach(a => {
            a.classList.remove('active');
            const status = a.querySelector('.player-status');
            if (status) status.textContent = 'Waiting...';
        });

        // Add to current
        const current = document.getElementById(`avatar-${playerIndex}`);
        if (current) {
            current.classList.add('active');
            const status = current.querySelector('.player-status');
            if (status) status.textContent = 'Your Turn!';
        }
    }

    /**
     * Show a toast notification
     */
    private showToast(message: string, type: 'error' | 'success' = 'error'): void {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icon = type === 'error' ? '⚠️' : '✅';
        toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;

        container.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.style.animation = 'toast-out 0.3s ease-in forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}
