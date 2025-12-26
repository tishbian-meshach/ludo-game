/**
 * BotController - Intelligent AI for bot players
 * Evaluates moves and makes strategic decisions
 */

import { TokenModel, Token } from './TokenModel';
import { Rules, MoveResult } from './Rules';
import { BOARD } from '../styles/theme';
import { eventBus } from './EventBus';

// Move scoring weights
const SCORE = {
    CAPTURE: 100,           // Capture opponent token
    ENTER_SAFE: 50,         // Move to a safe position
    ENTER_HOME_STRETCH: 45, // Enter the home stretch
    REACH_HOME: 80,         // Finish a token
    EXIT_SPAWN: 35,         // Exit spawn (on 6)
    ADVANCE_CLOSE: 25,      // Advance token close to finish
    ADVANCE_FAR: 15,        // Advance token far from finish
    ESCAPE_DANGER: 30,      // Move away from threatened position
    DEFAULT: 10,            // Any valid move
};

export interface MoveOption {
    tokenId: string;
    token: Token;
    score: number;
    wouldCapture: boolean;
    wouldEnterSafe: boolean;
    wouldFinish: boolean;
    destinationPosition: number;
}

export class BotController {
    private tokenModel: TokenModel;
    private rules: Rules;
    private thinkingDelay: number = 800; // ms delay to simulate thinking
    private moveDelay: number = 500;     // ms delay between actions

    constructor(tokenModel: TokenModel, rules: Rules) {
        this.tokenModel = tokenModel;
        this.rules = rules;
    }

    /**
     * Execute a complete bot turn
     */
    async executeTurn(playerIndex: number, diceValue: number): Promise<string | null> {
        // Small delay to simulate thinking
        await this.delay(this.thinkingDelay);

        const bestMove = this.findBestMove(playerIndex, diceValue);

        if (!bestMove) {
            return null; // No valid moves
        }

        return bestMove.tokenId;
    }

    /**
     * Find the best move for a player given dice value
     */
    findBestMove(playerIndex: number, diceValue: number): MoveOption | null {
        const validMoves = this.rules.getValidMoves(playerIndex, diceValue);
        const movableTokens = validMoves.filter(m => m.canMove);

        if (movableTokens.length === 0) {
            return null;
        }

        // Evaluate all possible moves
        const options: MoveOption[] = movableTokens.map(move => {
            const token = this.tokenModel.getToken(move.tokenId)!;
            return this.evaluateMove(token, diceValue, playerIndex);
        });

        // Sort by score (highest first)
        options.sort((a, b) => b.score - a.score);

        return options[0];
    }

    /**
     * Evaluate a single move and calculate its score
     */
    private evaluateMove(token: Token, diceValue: number, playerIndex: number): MoveOption {
        let score = SCORE.DEFAULT;
        let wouldCapture = false;
        let wouldEnterSafe = false;
        let wouldFinish = false;
        let destinationPosition = -1;

        // Calculate destination
        if (token.state === 'home') {
            // Exiting spawn
            score += SCORE.EXIT_SPAWN;
            destinationPosition = this.getSpawnExitPosition(playerIndex);

            // Check if we can capture at spawn exit
            const captureTarget = this.checkCaptureAt(destinationPosition, playerIndex);
            if (captureTarget) {
                score += SCORE.CAPTURE;
                wouldCapture = true;
            }
        } else if (token.state === 'on-board') {
            const currentPos = token.mainTrackPosition;
            const newPos = (currentPos + diceValue) % 52;

            // Check if entering home stretch
            const stepsToHome = 51 - token.stepsFromStart;
            if (diceValue > stepsToHome && token.stepsFromStart < 51) {
                score += SCORE.ENTER_HOME_STRETCH;
                destinationPosition = 100 + (diceValue - stepsToHome - 1); // Home stretch position
            } else {
                destinationPosition = newPos;

                // Check for capture
                const captureTarget = this.checkCaptureAt(newPos, playerIndex);
                if (captureTarget) {
                    score += SCORE.CAPTURE;
                    wouldCapture = true;
                }

                // Check for safe position
                if (this.rules.isSafePosition(newPos)) {
                    score += SCORE.ENTER_SAFE;
                    wouldEnterSafe = true;
                }

                // Check if we're in danger at current position
                if (this.isInDanger(token, playerIndex)) {
                    score += SCORE.ESCAPE_DANGER;
                }
            }

            // Prioritize tokens closer to home
            const progressBonus = Math.floor((token.stepsFromStart / 52) * SCORE.ADVANCE_CLOSE);
            score += progressBonus;

        } else if (token.state === 'home-stretch') {
            const currentCell = (token.position as { type: 'home-stretch'; cellIndex: number }).cellIndex;
            const newCell = currentCell + diceValue;

            if (newCell >= BOARD.homeStretchLength - 1) {
                score += SCORE.REACH_HOME;
                wouldFinish = true;
                destinationPosition = -1; // Finished
            } else {
                destinationPosition = 100 + newCell;
                // Still prioritize advancing in home stretch
                score += SCORE.ADVANCE_CLOSE;
            }
        }

        return {
            tokenId: token.id,
            token,
            score,
            wouldCapture,
            wouldEnterSafe,
            wouldFinish,
            destinationPosition
        };
    }

    /**
     * Get spawn exit position for a player
     */
    private getSpawnExitPosition(playerIndex: number): number {
        const startPositions = [0, 13, 26, 39]; // Main track start positions
        return startPositions[playerIndex];
    }

    /**
     * Check if there's a capturable opponent at position
     */
    private checkCaptureAt(position: number, playerIndex: number): Token | null {
        if (this.rules.isSafePosition(position)) {
            return null;
        }

        const tokensAtPos = this.tokenModel.getTokensAtPosition(position);
        const opponent = tokensAtPos.find(t => t.playerIndex !== playerIndex);
        return opponent || null;
    }

    /**
     * Check if a token is in danger (opponent can capture it next turn)
     */
    private isInDanger(token: Token, playerIndex: number): boolean {
        if (token.state !== 'on-board') return false;
        if (this.rules.isSafePosition(token.mainTrackPosition)) return false;

        const currentPos = token.mainTrackPosition;

        // Check if any opponent token is within 6 steps behind
        for (let opponentIdx = 0; opponentIdx < 4; opponentIdx++) {
            if (opponentIdx === playerIndex) continue;

            const opponentTokens = this.tokenModel.getPlayerTokens(opponentIdx);
            for (const oppToken of opponentTokens) {
                if (oppToken.state !== 'on-board') continue;

                const oppPos = oppToken.mainTrackPosition;
                // Check if opponent is 1-6 steps behind (with wraparound)
                for (let steps = 1; steps <= 6; steps++) {
                    if ((oppPos + steps) % 52 === currentPos) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /**
     * Utility delay function
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Set thinking delay
     */
    setThinkingDelay(ms: number): void {
        this.thinkingDelay = ms;
    }
}
