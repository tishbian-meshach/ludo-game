/**
 * GameState - Central game state manager
 * Orchestrates all game components
 */

import { eventBus } from './EventBus';
import { BoardModel } from './BoardModel';
import { TokenModel } from './TokenModel';
import { DiceLogic } from './DiceLogic';
import { Rules } from './Rules';
import { TurnManager, TurnPhase } from './TurnManager';
import { PLAYER_ORDER, PlayerColor } from '../styles/theme';

export type GamePhase = 'menu' | 'playing' | 'paused' | 'ended';

export interface GameConfig {
    playerCount: number;
    activePlayerIndices: number[];
    playerNames: string[];
    // explicit bot status for each player index [true, false, true, false]
    botStatus: boolean[];
}

export class GameState {
    private phase: GamePhase = 'menu';
    private playerCount: number = 4;
    private playerNames: string[] = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];
    private botPlayers: boolean[] = [false, false, false, false]; // true = bot, false = human
    private playerBoardMapping: number[] = [0, 1, 2, 3]; // Maps logical player index to board position
    private winners: number[] = [];

    // Core components
    private boardModel: BoardModel;
    private tokenModel: TokenModel;
    private diceLogic: DiceLogic;
    private rules: Rules;
    private turnManager: TurnManager;

    constructor(boardSize: number = 600) {
        this.boardModel = new BoardModel(boardSize);
        // Default to 4 players [0, 1, 2, 3]
        this.tokenModel = new TokenModel([0, 1, 2, 3]);
        this.diceLogic = new DiceLogic();
        this.rules = new Rules(this.tokenModel);
        this.turnManager = new TurnManager(
            [0, 1, 2, 3],
            this.diceLogic,
            this.rules,
            this.tokenModel
        );

        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    private setupEventListeners(): void {
        eventBus.on('GAME_WON', ({ player }) => {
            // Add to winners list if not already there
            if (!this.winners.includes(player)) {
                this.winners.push(player);

                // End game only if N-1 players have finished
                if (this.winners.length >= this.playerCount - 1) {
                    this.phase = 'ended';
                }
            }
        });
    }

    /**
     * Start a new game
     */
    startGame(config: GameConfig): void {
        this.playerCount = config.playerCount;
        this.playerNames = config.playerNames;
        this.phase = 'playing';
        this.winners = [];

        // Use explicit active player indices from config
        this.playerBoardMapping = config.activePlayerIndices;

        // Set up bot players from config
        this.botPlayers = [...config.botStatus];

        // Reinitialize components with new active players
        this.tokenModel.reset(this.playerBoardMapping);
        this.diceLogic.reset();
        this.turnManager = new TurnManager(
            this.playerBoardMapping,
            this.diceLogic,
            this.rules,
            this.tokenModel
        );

        this.turnManager.start();

        // Emit config changed so UI can update
        eventBus.emit('GAME_STARTED', { playerCount: this.playerCount });
    }

    /**
     * Roll dice
     */
    async rollDice(): Promise<void> {
        if (this.phase !== 'playing') return;
        await this.turnManager.rollDice();
    }

    /**
     * Select a token to move
     */
    async selectToken(tokenId: string): Promise<boolean> {
        if (this.phase !== 'playing') return false;
        return await this.turnManager.selectToken(tokenId);
    }

    /**
     * Pause the game
     */
    pause(): void {
        if (this.phase === 'playing') {
            this.phase = 'paused';
        }
    }

    /**
     * Resume the game
     */
    resume(): void {
        if (this.phase === 'paused') {
            this.phase = 'playing';
            eventBus.emit('GAME_RESUMED', { player: this.getCurrentPlayer() });
        }
    }

    /**
     * Reset the game
     */
    reset(): void {
        this.phase = 'menu';
        this.phase = 'menu';
        this.winners = [];
        this.tokenModel.reset(this.playerBoardMapping);
        this.diceLogic.reset();
        this.turnManager.reset();
        eventBus.emit('GAME_RESET', {});
    }

    // Getters
    getPhase(): GamePhase {
        return this.phase;
    }

    getPlayerCount(): number {
        return this.playerCount;
    }

    getDiceLogic(): DiceLogic {
        return this.diceLogic;
    }

    getPlayerNames(): string[] {
        return this.playerNames;
    }

    isBot(playerIndex: number): boolean {
        return this.botPlayers[playerIndex] ?? false;
    }

    getCurrentPlayer(): number {
        return this.turnManager.getCurrentPlayer();
    }

    getCurrentPlayerColor(): PlayerColor {
        // Now getCurrentPlayer returns actual player index (0, 2, etc.)
        return PLAYER_ORDER[this.getCurrentPlayer()];
    }

    /**
     * Get the list of active player indices for this game
     */
    getActivePlayerIndices(): number[] {
        return this.playerBoardMapping;
    }

    getTurnPhase(): TurnPhase {
        return this.turnManager.getPhase();
    }

    canRoll(): boolean {
        return this.phase === 'playing' && this.turnManager.canRoll();
    }

    /**
     * Handle dice click (for bots and human players)
     */
    async handleDiceClick(): Promise<void> {
        if (!this.canRoll()) return;
        await this.turnManager.rollDice();
    }

    /**
     * Handle token selection (for bots and human players)
     */
    async handleTokenSelection(tokenId: string): Promise<boolean> {
        return this.turnManager.selectToken(tokenId);
    }

    getBoard(): BoardModel {
        return this.boardModel;
    }

    getTokens(): TokenModel {
        return this.tokenModel;
    }

    getDice(): DiceLogic {
        return this.diceLogic;
    }

    getRules(): Rules {
        return this.rules;
    }

    getTurnManager(): TurnManager {
        return this.turnManager;
    }

    getWinner(): number | null {
        return this.winners.length > 0 ? this.winners[0] : null;
    }

    getWinners(): number[] {
        return [...this.winners];
    }

    /**
     * Get player's finishing rank (1st, 2nd, etc.)
     * Returns 0 if not finished
     */
    getFinishRank(playerIndex: number): number {
        const index = this.winners.indexOf(playerIndex);
        return index === -1 ? 0 : index + 1;
    }

    /**
     * Get player progress for all players
     */
    getProgress(): { player: number; color: PlayerColor; progress: number }[] {
        const progress = [];
        for (let i = 0; i < this.playerCount; i++) {
            progress.push({
                player: i,
                color: PLAYER_ORDER[i],
                progress: this.rules.getPlayerProgress(i),
            });
        }
        return progress;
    }
}

export default GameState;
