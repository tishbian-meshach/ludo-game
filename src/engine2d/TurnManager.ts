/**
 * TurnManager - Handles player turn rotation and flow
 */

import { eventBus } from './EventBus';
import { DiceLogic } from './DiceLogic';
import { Rules } from './Rules';
import { TokenModel } from './TokenModel';

export type TurnPhase =
    | 'waiting-for-roll'
    | 'rolling'
    | 'waiting-for-move'
    | 'moving'
    | 'animating'
    | 'turn-ending';

export interface TurnState {
    currentPlayer: number;
    phase: TurnPhase;
    diceValue: number;
    canRollAgain: boolean;
    mustMove: boolean;
    selectedTokenId: string | null;
    consecutiveSixes: number;
}

export class TurnManager {
    private playerCount: number;
    private activePlayerIndices: number[]; // [0, 2] for 2-player, [0, 1, 2, 3] for 4-player
    private currentPlayerSlot: number = 0; // Index into activePlayerIndices
    private currentPlayer: number = 0;
    private phase: TurnPhase = 'waiting-for-roll';
    private diceValue: number = 0;
    private consecutiveSixes: number = 0;
    private canRollAgain: boolean = false;
    private selectedTokenId: string | null = null;
    private lastMovedTokenId: string | null = null;

    private dice: DiceLogic;
    private rules: Rules;
    private tokenModel: TokenModel;

    constructor(
        activePlayerIndices: number[],
        dice: DiceLogic,
        rules: Rules,
        tokenModel: TokenModel
    ) {
        this.playerCount = activePlayerIndices.length;
        this.activePlayerIndices = activePlayerIndices;
        this.dice = dice;
        this.rules = rules;
        this.tokenModel = tokenModel;
    }

    /**
     * Start the game
     */
    start(): void {
        this.currentPlayerSlot = 0;
        this.currentPlayer = this.activePlayerIndices[0];
        this.phase = 'waiting-for-roll';
        this.consecutiveSixes = 0;
        this.dice.enableRoll();

        eventBus.emit('TURN_CHANGED', {
            player: this.currentPlayer,
            previousPlayer: -1
        });
        eventBus.emit('GAME_STARTED', { playerCount: this.playerCount });
    }

    /**
     * Handle dice roll
     */
    async rollDice(): Promise<void> {
        if (this.phase !== 'waiting-for-roll') return;

        this.phase = 'rolling';

        // Roll the dice (with animation)
        this.diceValue = await this.dice.roll(this.currentPlayer);

        // Track consecutive sixes
        if (this.diceValue === 6) {
            this.consecutiveSixes++;

            // Three sixes = bust
            if (this.consecutiveSixes >= 3) {
                // Rule change: Do not revert last move. Just end turn.
                // if (this.lastMovedTokenId) {
                //     this.rules.handleBust(this.currentPlayer, this.lastMovedTokenId);
                // }
                this.consecutiveSixes = 0;
                this.endTurn();
                return;
            }
        } else {
            this.consecutiveSixes = 0;
        }

        // Check for valid moves
        const hasValidMoves = this.rules.hasAnyValidMove(this.currentPlayer, this.diceValue);

        if (!hasValidMoves) {
            // No valid moves - auto end turn (unless got a 6)
            if (this.diceValue === 6) {
                this.canRollAgain = true;
                this.phase = 'waiting-for-roll';
            } else {
                // Add explicit pause so user can see "Oh I rolled X but can't move"
                await new Promise(resolve => setTimeout(resolve, 1000));
                this.endTurn();
            }
            return;
        }

        // Highlight valid moves
        const validMoves = this.rules.getValidMoves(this.currentPlayer, this.diceValue);
        const movableTokens = validMoves.filter((m) => m.canMove);

        // If only one token can move, auto-select it
        if (movableTokens.length === 1) {
            this.selectedTokenId = movableTokens[0].tokenId;
            await this.moveToken(movableTokens[0].tokenId);
        } else {
            // Wait for player to select token
            this.phase = 'waiting-for-move';
            // Wait for player to select token
            this.phase = 'waiting-for-move';

            // Emit VALID_MOVES so renderer knows what to highlight
            eventBus.emit('VALID_MOVES', { moves: validMoves });
        }
    }

    /**
     * Handle token selection
     */
    async selectToken(tokenId: string): Promise<boolean> {
        if (this.phase !== 'waiting-for-move') return false;

        const token = this.tokenModel.getToken(tokenId);
        if (!token || token.playerIndex !== this.currentPlayer) return false;

        if (!this.rules.validateMove(tokenId, this.diceValue)) return false;

        this.selectedTokenId = tokenId;
        eventBus.emit('CLEAR_HIGHLIGHTS', {});

        await this.moveToken(tokenId);
        return true;
    }

    /**
     * Execute token movement
     */
    private async moveToken(tokenId: string): Promise<void> {
        this.phase = 'moving';
        const token = this.tokenModel.getToken(tokenId);
        if (!token) return;

        const fromPos = token.mainTrackPosition;

        // Execute the move
        const result = this.rules.executeMove(tokenId, this.diceValue);
        if (!result) {
            this.phase = 'waiting-for-move';
            return;
        }

        this.lastMovedTokenId = tokenId;

        // Emit appropriate events
        if (result.enteredBoard) {
            eventBus.emit('TOKEN_ENTERED_BOARD', {
                tokenId,
                position: result.to,
                player: this.currentPlayer,
            });
            // No animation for entering board, continue immediately
            this.phase = 'animating';
        } else {
            eventBus.emit('TOKEN_MOVE_START', {
                tokenId,
                from: result.from,
                to: result.to,
                player: this.currentPlayer,
            });
            // Wait for hop animation to complete
            this.phase = 'animating';
            await eventBus.waitFor('TOKEN_ANIMATION_COMPLETE', 2000).catch(() => { });
        }

        // Emit move complete
        eventBus.emit('TOKEN_MOVED', {
            tokenId,
            from: result.from,
            to: result.to,
            player: this.currentPlayer,
        });

        // Handle capture
        if (result.captured) {
            eventBus.emit('TOKEN_CAPTURED', {
                capturedTokenId: result.captured.id,
                capturingTokenId: tokenId,
                position: result.to,
            });
            await eventBus.waitFor('TOKEN_ANIMATION_COMPLETE', 3000).catch(() => { });

            // Now update the token model AFTER the animation completes
            this.tokenModel.captureToken(result.captured.id);
        }

        // Check for win
        if (this.rules.checkWin(this.currentPlayer)) {
            eventBus.emit('GAME_WON', { player: this.currentPlayer });
            eventBus.emit('GAME_WON', { player: this.currentPlayer });
            this.endTurn();
            return;
        }

        // Handle reaching home
        if (result.reachedHome) {
            eventBus.emit('TOKEN_REACHED_HOME', {
                tokenId,
                player: this.currentPlayer,
            });
        }

        // Check for extra turn
        if (result.getsExtraTurn) {
            eventBus.emit('EXTRA_TURN', {
                player: this.currentPlayer,
                reason: this.diceValue === 6 ? 'six' : 'capture'
            });
            this.canRollAgain = true;
            this.phase = 'waiting-for-roll';
            this.dice.enableRoll();
        } else {
            this.endTurn();
        }
    }

    /**
     * End current turn and advance to next player
     */
    private endTurn(): void {
        this.phase = 'turn-ending';

        const previousPlayer = this.currentPlayer;

        // Advance to next player who hasn't finished
        let loopCount = 0;
        do {
            this.currentPlayerSlot = (this.currentPlayerSlot + 1) % this.activePlayerIndices.length;
            this.currentPlayer = this.activePlayerIndices[this.currentPlayerSlot];
            loopCount++;
        } while (this.rules.checkWin(this.currentPlayer) && loopCount < this.activePlayerIndices.length);

        this.consecutiveSixes = 0;
        this.canRollAgain = false;
        this.selectedTokenId = null;
        this.lastMovedTokenId = null;
        this.dice.reset();
        this.dice.enableRoll();

        this.phase = 'waiting-for-roll';

        eventBus.emit('TURN_CHANGED', {
            player: this.currentPlayer,
            previousPlayer,
        });
    }

    /**
     * Get current turn state
     */
    getState(): TurnState {
        return {
            currentPlayer: this.currentPlayer,
            phase: this.phase,
            diceValue: this.diceValue,
            canRollAgain: this.canRollAgain,
            mustMove: this.phase === 'waiting-for-move',
            selectedTokenId: this.selectedTokenId,
            consecutiveSixes: this.consecutiveSixes,
        };
    }

    /**
     * Get current player index
     */
    getCurrentPlayer(): number {
        return this.currentPlayer;
    }

    /**
     * Get current phase
     */
    getPhase(): TurnPhase {
        return this.phase;
    }

    /**
     * Check if it's time to roll
     */
    canRoll(): boolean {
        return this.phase === 'waiting-for-roll';
    }

    /**
     * Reset turn manager
     */
    reset(): void {
        this.currentPlayer = 0;
        this.phase = 'waiting-for-roll';
        this.diceValue = 0;
        this.consecutiveSixes = 0;
        this.canRollAgain = false;
        this.selectedTokenId = null;
        this.lastMovedTokenId = null;
        this.dice.reset();
    }
}

export default TurnManager;
