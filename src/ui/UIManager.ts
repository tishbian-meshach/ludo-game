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
        playerCount: 4,
        gameMode: 'friends',
        playerNames: ['Player 1', 'Player 2', 'Player 3', 'Player 4']
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

        // Setup Toggles
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const parent = target.parentElement!;

                // Active state
                parent.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                target.classList.add('active');

                // Update Config
                if (target.dataset.mode) this.config.gameMode = target.dataset.mode as any;
                if (target.dataset.players) {
                    this.config.playerCount = parseInt(target.dataset.players) as 2 | 4;
                    this.updatePlayerInputs();
                }
            });
        });

        // Start Game
        document.getElementById('btn-start-game')?.addEventListener('click', () => {
            // Collect Names
            const inputs = this.playerInputs.querySelectorAll('input');
            this.config.playerNames = Array.from(inputs).map(input => input.value || input.placeholder);

            // Launch
            this.onStartGame(this.config);
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
     * Update player name inputs based on count
     */
    private updatePlayerInputs(): void {
        const p3 = document.getElementById('p2-name')?.parentElement;
        const p4 = document.getElementById('p3-name')?.parentElement;

        if (this.config.playerCount === 2) {
            // Hide 3 and 4
            if (p3) p3.style.display = 'none';
            if (p4) p4.style.display = 'none';
        } else {
            // Show all
            if (p3) p3.style.display = 'flex';
            if (p4) p4.style.display = 'flex';
        }
    }

    /**
     * Create Avatar Elements in Overlay
     */
    private createAvatars(): void {
        this.avatarContainer.innerHTML = '';

        const names = this.gameState.getPlayerNames();
        const count = this.gameState.getPlayerCount(); // Might be 2 or 4

        // If 2 players, we use Red (0) and Yellow (2) usually?
        // Or Red and Green? Standard Ludo 2-player is usually opposite (Red/Yellow) or standard order 0,1.
        // Let's assume GameState handles 0 and 1 if count is 2?
        // Wait, Rules.ts usually handles 2 players as Red/Yellow (0 and 2)?
        // I need to check how backend handles 2 players.
        // Assuming 0, 1 for now if logic is simple 0..N-1.
        // Actually, if 2 players, usually it's Index 0 and Index 1.
        // Let's iterate 0 to count-1.

        for (let i = 0; i < count; i++) {
            const colorName = PLAYER_ORDER[i]; // red, green, yellow, blue
            const name = names[i];

            const avatar = document.createElement('div');
            avatar.className = `player-avatar p-avatar-${i}`;
            avatar.id = `avatar-${i}`;

            // Map index to color hex
            const colorHex = i === 0 ? '#FF4757' : i === 1 ? '#2ECC71' : i === 2 ? '#F1C40F' : '#3498DB';

            // Set player color as CSS variable for active state
            avatar.style.setProperty('--player-color', colorHex);

            avatar.innerHTML = `
                <div class="avatar-circle" style="background: ${colorHex}">
                    <svg class="avatar-icon" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="8" r="4"/>
                        <path d="M12 14c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4z"/>
                    </svg>
                </div>
                <div class="player-info">
                    <span class="player-name">${name}</span>
                    <span class="player-status">Waiting...</span>
                </div>
            `;

            this.avatarContainer.appendChild(avatar);
        }

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
}
