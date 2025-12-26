/**
 * UIManager - Manages HTML UI screens and Game Overlay
 * Handles transitions between Start, Setup, and Game screens.
 */

import { GameConfig, GameState } from '../engine2d/GameState';
import { eventBus } from '../engine2d/EventBus';
import { SaveManager } from '../engine2d/SaveManager';
import { PLAYER_ORDER } from '../styles/theme';
import gsap from 'gsap';

export class UIManager {
    private gameState: GameState;
    private onStartGame: (config: GameConfig) => void;
    private lastGameConfig: GameConfig | null = null;

    // Screens
    private startScreen: HTMLElement;
    private setupScreen: HTMLElement;
    private gameUIOverlay: HTMLElement;
    private gameContainer: HTMLElement; // The canvas container
    private resumeBtn: HTMLElement;

    // Components
    private avatarContainer: HTMLElement;
    private playerInputs: HTMLElement;
    private menuModal: HTMLElement;

    constructor(gameState: GameState, onStartGame: (config: GameConfig) => void) {
        this.gameState = gameState;
        this.onStartGame = onStartGame;

        // Cache Elements
        this.startScreen = document.getElementById('start-screen')!;
        this.setupScreen = document.getElementById('setup-screen')!;
        this.gameUIOverlay = document.getElementById('game-ui-overlay')!;
        this.gameContainer = document.getElementById('game-container')!;
        this.avatarContainer = document.getElementById('avatar-container')!;
        this.resumeBtn = document.getElementById('btn-resume-match')!;

        this.playerInputs = document.querySelector('.player-config')!;
        this.menuModal = document.getElementById('in-game-menu')!;

        this.setupEventListeners();
        this.checkExistingSave();
    }

    /**
     * Check if there's a game to resume
     */
    private checkExistingSave(): void {
        const buttonsContainer = this.startScreen.querySelector('.start-buttons');
        if (!buttonsContainer) return;

        // Reset state for loading
        buttonsContainer.classList.remove('buttons-ready');

        // Simulate a "Premium" cache check delay
        setTimeout(() => {
            if (SaveManager.hasSave()) {
                this.resumeBtn.classList.remove('hidden');
            } else {
                this.resumeBtn.classList.add('hidden');
            }

            // Reveal buttons smoothly
            buttonsContainer.classList.add('buttons-ready');
        }, 800);
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

        // Resume Match Button
        this.resumeBtn?.addEventListener('click', () => {
            const saveData = SaveManager.load();
            if (saveData) {
                this.lastGameConfig = saveData.config;
                this.gameState.resumeGame(saveData);
                this.showGameUI();

                // Hide menu and setup
                this.startScreen.classList.add('hidden');
                this.startScreen.classList.remove('active');
                this.setupScreen.classList.add('hidden');
            }
        });

        // Menu Button
        document.getElementById('btn-menu')?.addEventListener('click', () => {
            const modal = document.getElementById('in-game-menu');
            if (modal) modal.classList.remove('hidden');
            this.gameState.pause(); // Pause the game when menu opens
        });

        // Menu Options
        document.getElementById('btn-resume')?.addEventListener('click', () => {
            const modal = document.getElementById('in-game-menu');
            if (modal) modal.classList.add('hidden');
            this.gameState.resume(); // Resume the game
        });

        document.getElementById('btn-restart')?.addEventListener('click', () => {
            const modal = document.getElementById('in-game-menu');
            if (modal) modal.classList.add('hidden');
            if (this.lastGameConfig) {
                this.onStartGame(this.lastGameConfig);
                // Re-create avatars
                this.createAvatars();
            }
        });

        document.getElementById('btn-quit')?.addEventListener('click', () => {
            const modal = document.getElementById('in-game-menu');
            if (modal) modal.classList.add('hidden');
            this.gameState.reset(); // Reset game state
            this.showScreen(this.startScreen);
        });

        // Tap to Roll Button
        const tapToRollBtn = document.getElementById('tap-to-roll');
        if (tapToRollBtn) {
            tapToRollBtn.addEventListener('click', async () => {
                if (this.gameState.canRoll()) {
                    tapToRollBtn.classList.add('hidden');
                    await this.gameState.handleDiceClick();
                }
            });
        }

        // --- Game Events ---

        eventBus.on('TURN_CHANGED', ({ player }) => {
            this.updateTurnUI(player);
            this.updateTapToRollButton(player);

            // Auto-save on turn change
            if (this.gameState.getPhase() === 'playing') {
                SaveManager.save(this.gameState.serialize());
                this.checkExistingSave();
            }
        });

        eventBus.on('DICE_ROLLED', () => {
            const btn = document.getElementById('tap-to-roll');
            if (btn) btn.classList.add('hidden');
        });

        eventBus.on('GAME_RESUMED', ({ player }) => {
            this.updateTapToRollButton(player);
        });

        eventBus.on('EXTRA_TURN', ({ player }) => {
            setTimeout(() => {
                this.updateTapToRollButton(player);
            }, 100);
        });

        eventBus.on('TOKEN_MOVED', () => {
            this.updateTapToRollButton();

            // Auto-save after movement
            if (this.gameState.getPhase() === 'playing') {
                SaveManager.save(this.gameState.serialize());
            }
        });

        eventBus.on('GAME_WON', ({ player }) => {
            this.checkGameOver();

            // Clear save if game ended
            if (this.gameState.getWinners().length >= this.gameState.getPlayerCount() - 1) {
                SaveManager.clear();
                this.checkExistingSave();
            }
        });

        // Game Over Modal Buttons
        document.getElementById('btn-game-over-restart')?.addEventListener('click', () => {
            const modal = document.getElementById('game-over-modal');
            if (modal) modal.classList.add('hidden');
            if (this.lastGameConfig) {
                this.onStartGame(this.lastGameConfig);
                this.createAvatars();
            }
        });

        document.getElementById('btn-game-over-quit')?.addEventListener('click', () => {
            const modal = document.getElementById('game-over-modal');
            if (modal) modal.classList.add('hidden');
            this.gameState.reset();
            this.showScreen(this.startScreen);
        });

        // --- Setup Grid Selection & Toggles ---

        const gridCells = document.querySelectorAll('.player-cell');

        gridCells.forEach(cell => {
            const input = cell.querySelector('input') as HTMLInputElement;
            const editIcon = cell.querySelector('.edit-icon') as HTMLElement;

            cell.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;

                if (target.classList.contains('selected')) {
                    const selectedCells = Array.from(document.querySelectorAll('.player-cell.selected'));
                    const selectedCount = selectedCells.length;
                    const humanCount = selectedCells.filter(c => c.querySelector('.type-btn.human.active')).length;
                    const isTargetHuman = !!target.querySelector('.type-btn.human.active');

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

                if (input) {
                    const botBtnSegmented = cell.querySelector('.type-btn.bot');
                    const isBot = !!(botBtnSegmented && botBtnSegmented.classList.contains('active'));
                    input.disabled = !target.classList.contains('selected') || isBot;
                }
            });

            if (input) {
                input.addEventListener('click', (e) => e.stopPropagation());
            }

            if (editIcon && input) {
                editIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!input.disabled) input.focus();
                });
            }

            // Bot Toggle (Segmented)
            const humanBtn = cell.querySelector('.type-btn.human');
            const botBtnSegmented = cell.querySelector('.type-btn.bot');

            const setBotState = (isBot: boolean) => {
                const playerIndex = parseInt(cell.getAttribute('data-player') || '0');
                if (isBot) {
                    humanBtn?.classList.remove('active');
                    botBtnSegmented?.classList.add('active');
                    if (input) {
                        input.value = `Bot ${playerIndex + 1}`;
                        input.disabled = true;
                    }
                    if (editIcon) editIcon.style.display = 'none';
                } else {
                    humanBtn?.classList.add('active');
                    botBtnSegmented?.classList.remove('active');
                    if (input && cell.classList.contains('selected')) {
                        input.value = `Player ${playerIndex + 1}`;
                        input.disabled = false;
                    }
                    if (editIcon) editIcon.style.display = '';
                }
            };

            humanBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                setBotState(false);
            });

            botBtnSegmented?.addEventListener('click', (e) => {
                e.stopPropagation();
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
        });

        // Start Game
        document.getElementById('btn-start-game')?.addEventListener('click', () => {
            const activeIndices: number[] = [];
            const playerNames: string[] = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];
            const botStatus: boolean[] = [false, false, false, false];

            for (let i = 0; i < 4; i++) {
                const cell = document.querySelector(`.player-cell[data-player="${i}"]`);
                if (cell && cell.classList.contains('selected')) {
                    activeIndices.push(i);
                    const input = cell.querySelector('input') as HTMLInputElement;
                    playerNames[i] = input.value || `Player ${i + 1}`;
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

            this.lastGameConfig = config;
            this.onStartGame(config);
            this.showGameUI();
        });
    }

    /**
     * Show game UI and enable interaction
     */
    private showGameUI(): void {
        this.showScreen(this.gameUIOverlay);
        this.gameContainer.style.filter = 'none';
        this.gameContainer.style.pointerEvents = 'auto';

        // Update Overlay
        this.createAvatars();
    }

    /**
     * Switch visible screen
     */
    private showScreen(screen: HTMLElement): void {
        [this.startScreen, this.setupScreen, this.gameUIOverlay].forEach(s => {
            s.classList.add('hidden');
            s.classList.remove('active');
        });

        screen.classList.remove('hidden');
        screen.classList.add('active');

        // Refresh resume button status if returning to start screen
        if (screen === this.startScreen) {
            this.checkExistingSave();
        }
    }

    /**
     * Create Avatar Elements in Overlay
     */
    private createAvatars(): void {
        this.avatarContainer.innerHTML = '';
        const names = this.gameState.getPlayerNames();
        const activePlayerIndices = this.gameState.getActivePlayerIndices();

        const colorHexByIndex: Record<number, string> = {
            0: '#FF4757', // Red
            1: '#2ECC71', // Green
            2: '#F1C40F', // Yellow
            3: '#3498DB', // Blue
        };

        activePlayerIndices.forEach((playerIndex, nameIndex) => {
            const name = names[playerIndex] || `Player ${playerIndex + 1}`;
            const colorHex = colorHexByIndex[playerIndex];

            const avatar = document.createElement('div');
            avatar.className = `player-avatar p-avatar-${playerIndex}`;
            avatar.id = `avatar-${playerIndex}`;
            avatar.style.setProperty('--player-color', colorHex);

            const isBot = this.gameState.isBot(playerIndex);

            const botSvg = `
                <svg class="avatar-icon" viewBox="0 0 100 105" fill="currentColor">
                    <path d="M90,36.667h-4.167L79.98,47.312l-0.82-7.373C78.555,34.473,73.558,30,68.057,30H53.333v-7.591 c1.986-1.156,3.334-3.281,3.334-5.743C56.667,12.985,53.682,10,50,10s-6.666,2.985-6.666,6.667c0,2.461,1.349,4.586,3.332,5.743V30 H31.941c-5.5,0-10.496,4.473-11.104,9.938l-0.818,7.369l-5.854-10.641H10l3.334,26.666h4.904l-1.49,13.415 C15.938,84.036,21.274,90,28.608,90H71.39c7.334,0,12.673-5.964,11.862-13.252l-1.491-13.415h4.906L90,36.667z M60,80H40v-6.667h20 V80z M70,60c0,2.751-2.249,5-5,5H35c-2.75,0-5-2.249-5-5V48.333c0-2.75,2.25-5,5-5h30c2.751,0,5,2.25,5,5V60z" />
                    <path d="M38.334,52.5c0-1.843,1.492-3.333,3.332-3.333c1.844,0,3.334,1.49,3.334,3.333v3.333c0,1.843-1.49,3.334-3.334,3.334 c-1.84,0-3.332-1.491-3.332-3.334V52.5z" />
                    <path d="M55,52.5c0-1.843,1.491-3.333,3.333-3.333c1.843,0,3.334,1.49,3.334,3.333v3.333c0,1.843-1.491,3.334-3.334,3.334 c-1.842,0-3.333-1.491-3.333-3.334V52.5z" />
                </svg>`;

            const humanSvg = `
                <svg class="avatar-icon" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="8" r="4"/><path d="M12 14c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4z"/>
                </svg>`;

            avatar.innerHTML = `
                <div class="avatar-circle" style="background: ${colorHex}">
                    ${isBot ? botSvg : humanSvg}
                </div>
                <div class="player-info">
                    <span class="player-name">${name}</span>
                    <span class="player-status">Waiting...</span>
                </div>`;

            this.avatarContainer.appendChild(avatar);
        });

        this.updateTurnUI(this.gameState.getCurrentPlayer());
    }

    /**
     * Highlight active player
     */
    private updateTurnUI(playerIndex: number): void {
        const avatars = this.avatarContainer.querySelectorAll('.player-avatar');
        avatars.forEach(a => {
            a.classList.remove('active');
            const status = a.querySelector('.player-status');
            if (status) status.textContent = 'Waiting...';
        });

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
        setTimeout(() => {
            toast.style.animation = 'toast-out 0.3s ease-in forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /**
     * Update the tap-to-roll button visibility
     */
    private updateTapToRollButton(playerIndex?: number): void {
        const targetPlayer = playerIndex !== undefined ? playerIndex : this.gameState.getCurrentPlayer();
        const btn = document.getElementById('tap-to-roll');
        if (!btn) return;

        const isHuman = !this.gameState.isBot(targetPlayer);
        const canRoll = this.gameState.canRoll();
        const turnPhase = this.gameState.getTurnPhase();

        if (isHuman && canRoll && turnPhase === 'waiting-for-roll') {
            btn.classList.remove('hidden');
            const colorName = PLAYER_ORDER[targetPlayer];
            const colorHex = ({ red: '#FF0055', green: '#00FF99', yellow: '#FFFF00', blue: '#00CCFF' } as any)[colorName] || '#00f7ff';
            btn.style.setProperty('--player-color', colorHex);

            btn.style.top = btn.style.bottom = btn.style.left = btn.style.right = '';
            switch (targetPlayer) {
                case 0: btn.style.top = 'calc(12% + 102px)'; btn.style.left = '5%'; break;
                case 1: btn.style.top = 'calc(12% + 102px)'; btn.style.right = '5%'; break;
                case 2: btn.style.bottom = 'calc(8% + 70px)'; btn.style.right = '5%'; break;
                case 3: btn.style.bottom = 'calc(8% + 70px)'; btn.style.left = '5%'; break;
            }
        } else {
            btn.classList.add('hidden');
        }
    }

    /**
     * Check if game should end and show modal
     */
    private checkGameOver(): void {
        const winners = this.gameState.getWinners();
        const playerCount = this.gameState.getPlayerCount();

        if (winners.length >= playerCount - 1 && playerCount > 1) {
            const activePlayers = this.lastGameConfig?.activePlayerIndices || [0, 1, 2, 3];
            const remainingPlayers = activePlayers.filter(p => !winners.includes(p));
            this.showGameOverModal([...winners, ...remainingPlayers]);
        }
    }

    /**
     * Show the game over modal with rankings
     */
    private showGameOverModal(rankings: number[]): void {
        const modal = document.getElementById('game-over-modal');
        if (!modal) return;

        const playerNames = this.lastGameConfig?.playerNames || ['Player 1', 'Player 2', 'Player 3', 'Player 4'];

        for (let i = 0; i < 4; i++) {
            const rankRow = document.querySelector(`.rank-${i + 1}`) as HTMLElement;
            const nameEl = document.getElementById(`rank-${i + 1}-name`);
            const medalImg = document.getElementById(`rank-${i + 1}-medal`) as HTMLImageElement;
            const numberOverlay = document.getElementById(`rank-${i + 1}-number`);

            if (rankings[i] !== undefined) {
                if (rankRow) rankRow.style.display = 'flex';
                if (medalImg) {
                    const assets = ['1st-medal.png', '2nd-medal.png', '3rd-medal.png', 'looser-medal.png'];
                    medalImg.src = `/assets/${assets[Math.min(i, 3)]}`;
                }
                if (numberOverlay) {
                    numberOverlay.style.display = i >= 3 ? 'block' : 'none';
                    numberOverlay.textContent = (i + 1).toString();
                }
                if (nameEl) {
                    const pIndex = rankings[i];
                    nameEl.textContent = playerNames[pIndex] || `Player ${pIndex + 1}`;
                }
            } else if (rankRow) {
                rankRow.style.display = 'none';
            }
        }

        modal.classList.remove('hidden');
        this.gameState.pause();
        const tapBtn = document.getElementById('tap-to-roll');
        if (tapBtn) tapBtn.classList.add('hidden');
        this.launchConfetti();
    }

    /**
     * Launch a confetti celebration
     */
    private launchConfetti(): void {
        const colors = ['#FF0055', '#00FF99', '#FFFF00', '#00CCFF', '#FF6600', '#FF00FF', '#FFD700'];
        const container = document.getElementById('game-over-modal');
        if (!container) return;

        for (let i = 0; i < 60; i++) {
            const confetti = document.createElement('div');
            confetti.style.cssText = `position:absolute; width:${Math.random() * 10 + 6}px; height:${Math.random() * 10 + 6}px; background:${colors[Math.floor(Math.random() * colors.length)]}; left:${Math.random() * 100}%; top:-20px; border-radius:${Math.random() > 0.5 ? '50%' : '2px'}; pointer-events:none; z-index:10001;`;
            container.appendChild(confetti);

            gsap.to(confetti, {
                y: window.innerHeight + 50, x: (Math.random() - 0.5) * 200, rotation: Math.random() * 720 - 360,
                duration: Math.random() * 2 + 2, delay: Math.random() * 0.5, ease: 'power1.out',
                onComplete: () => confetti.remove()
            });
        }

        for (let i = 0; i < 20; i++) {
            const spark = document.createElement('div');
            spark.style.cssText = `position:absolute; width:4px; height:4px; background:#FFD700; left:50%; top:50%; border-radius:50%; pointer-events:none; z-index:10002; box-shadow:0 0 6px #FFD700;`;
            container.appendChild(spark);
            const angle = (i / 20) * Math.PI * 2;
            const dist = 80 + Math.random() * 60;
            gsap.to(spark, {
                x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, opacity: 0, scale: 0,
                duration: 0.8, delay: 0.1, ease: 'power2.out', onComplete: () => spark.remove()
            });
        }

        // Looping Fireworks at the top
        this.launchFireworks(container, colors);
    }

    /**
     * Launch looping fireworks animation at the top of the modal
     */
    private launchFireworks(container: HTMLElement, colors: string[]): void {
        const launchSingleFirework = () => {
            const xPos = 10 + Math.random() * 80; // 10-90% of width
            const yPos = 5 + Math.random() * 15;  // 5-20% from top

            const burstColor = colors[Math.floor(Math.random() * colors.length)];
            const sparkCount = 12 + Math.floor(Math.random() * 10);

            for (let i = 0; i < sparkCount; i++) {
                const spark = document.createElement('div');
                spark.className = 'firework-spark';
                spark.style.cssText = `
                    position: absolute;
                    width: 5px;
                    height: 5px;
                    background: ${burstColor};
                    left: ${xPos}%;
                    top: ${yPos}%;
                    border-radius: 50%;
                    pointer-events: none;
                    z-index: 10003;
                    box-shadow: 0 0 8px ${burstColor}, 0 0 12px ${burstColor};
                `;
                container.appendChild(spark);

                const angle = (i / sparkCount) * Math.PI * 2;
                const dist = 40 + Math.random() * 50;

                gsap.to(spark, {
                    x: Math.cos(angle) * dist,
                    y: Math.sin(angle) * dist,
                    opacity: 0,
                    scale: 0.5,
                    duration: 0.8 + Math.random() * 0.4,
                    ease: 'power2.out',
                    onComplete: () => spark.remove()
                });
            }
        };

        // Initial burst
        launchSingleFirework();
        setTimeout(() => launchSingleFirework(), 200);

        // Loop: launch new fireworks every 1.5 seconds
        const intervalId = setInterval(() => {
            // Stop if modal is hidden
            if (container.classList.contains('hidden')) {
                clearInterval(intervalId);
                return;
            }
            launchSingleFirework();
            setTimeout(() => launchSingleFirework(), 300 + Math.random() * 300);
        }, 1500);
    }
}
