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
    playerCount: 2 | 4;
}

export class GameState {
    private phase: GamePhase = 'menu';
    private playerCount: number = 4;
    private winners: number[] = [];

    // Core components
    private boardModel: BoardModel;
    private tokenModel: TokenModel;
    private diceLogic: DiceLogic;
    private rules: Rules;
    private turnManager: TurnManager;

    constructor(boardSize: number = 600) {
        this.boardModel = new BoardModel(boardSize);
        this.tokenModel = new TokenModel(this.playerCount);
        this.diceLogic = new DiceLogic();
        this.rules = new Rules(this.tokenModel);
        this.turnManager = new TurnManager(
            this.playerCount,
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
        this.phase = 'playing';
        this.winners = [];

        // Reinitialize components with new player count
        this.tokenModel.reset(this.playerCount);
        this.diceLogic.reset();
        this.turnManager = new TurnManager(
            this.playerCount,
            this.diceLogic,
            this.rules,
            this.tokenModel
        );

        this.turnManager.start();
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
        }
    }

    /**
     * Reset the game
     */
    reset(): void {
        this.phase = 'menu';
        this.phase = 'menu';
        this.winners = [];
        this.tokenModel.reset(this.playerCount);
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

    getCurrentPlayer(): number {
        return this.turnManager.getCurrentPlayer();
    }

    getCurrentPlayerColor(): PlayerColor {
        return PLAYER_ORDER[this.getCurrentPlayer()];
    }

    getTurnPhase(): TurnPhase {
        return this.turnManager.getPhase();
    }

    canRoll(): boolean {
        return this.phase === 'playing' && this.turnManager.canRoll();
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
