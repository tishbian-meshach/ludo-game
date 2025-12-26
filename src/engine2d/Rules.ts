/**
 * Rules - Ludo game rules engine
 * Handles move validation, captures, and win conditions
 */

import { Token, TokenModel } from './TokenModel';
import { BOARD } from '../styles/theme';

export interface MoveResult {
    valid: boolean;
    from: number;
    to: number;
    captured?: Token;
    enteredBoard?: boolean;
    reachedHome?: boolean;
    getsExtraTurn?: boolean;
}

export class Rules {
    private tokenModel: TokenModel;

    constructor(tokenModel: TokenModel) {
        this.tokenModel = tokenModel;
    }

    /**
     * Validate if a move is legal
     */
    validateMove(tokenId: string, diceValue: number): boolean {
        const token = this.tokenModel.getToken(tokenId);
        if (!token) return false;

        // Finished tokens can't move
        if (token.state === 'finished') return false;

        // Home tokens need a 6 to enter
        if (token.state === 'home') {
            return diceValue === 6;
        }

        // On board - check if we won't overshoot home
        if (token.state === 'on-board') {
            // 51 steps to reach home entry, then homeStretchLength - 1 to finish
            const stepsToFinish = 51 + (BOARD.homeStretchLength - 1) - token.stepsFromStart;
            return diceValue <= stepsToFinish;
        }

        // In home stretch - check exact count to reach triangle (cell 5)
        if (token.state === 'home-stretch') {
            const currentPos = (token.position as { type: 'home-stretch'; cellIndex: number }).cellIndex;
            const stepsToFinish = (BOARD.homeStretchLength - 1) - currentPos;
            return diceValue <= stepsToFinish;
        }

        return false;
    }

    /**
     * Get all valid moves for a player
     */
    getValidMoves(playerIndex: number, diceValue: number): { tokenId: string; canMove: boolean }[] {
        const tokens = this.tokenModel.getPlayerTokens(playerIndex);

        return tokens.map((token) => ({
            tokenId: token.id,
            canMove: this.validateMove(token.id, diceValue),
        }));
    }

    /**
     * Check if any move is possible for a player
     */
    hasAnyValidMove(playerIndex: number, diceValue: number): boolean {
        return this.getValidMoves(playerIndex, diceValue).some((m) => m.canMove);
    }

    /**
     * Execute a move and handle consequences
     */
    executeMove(tokenId: string, diceValue: number): MoveResult | null {
        const token = this.tokenModel.getToken(tokenId);
        if (!token || !this.validateMove(tokenId, diceValue)) {
            return null;
        }

        let from = token.mainTrackPosition;
        let to = -1;
        let captured: Token | undefined;
        let enteredBoard = false;
        let reachedHome = false;
        let getsExtraTurn = false;

        // Handle home -> board entry
        if (token.state === 'home' && diceValue === 6) {
            this.tokenModel.enterBoard(tokenId);
            enteredBoard = true;
            const updatedToken = this.tokenModel.getToken(tokenId)!;
            to = updatedToken.mainTrackPosition;

            // Check for capture at start position
            captured = this.checkAndExecuteCapture(tokenId, to);
            getsExtraTurn = true;
        }
        // Normal move
        else {
            const moveResult = this.tokenModel.moveToken(tokenId, diceValue);
            if (!moveResult) return null;

            from = moveResult.from;
            to = moveResult.to;

            // Check if reached home
            if (to === -1) {
                reachedHome = true;
                getsExtraTurn = true;
            }
            // Check for capture (only on main track, not home stretch)
            else if (to < 100) {
                captured = this.checkAndExecuteCapture(tokenId, to);
                if (captured) {
                    getsExtraTurn = true;
                }
            }
        }

        return {
            valid: true,
            from,
            to,
            captured,
            enteredBoard,
            reachedHome,
            getsExtraTurn: getsExtraTurn || diceValue === 6,
        };
    }

    /**
     * Check for and execute capture at position
     */
    private checkAndExecuteCapture(movingTokenId: string, position: number): Token | undefined {
        const movingToken = this.tokenModel.getToken(movingTokenId);
        if (!movingToken) return undefined;

        // Safe positions - no capture
        if ((BOARD.safePositions as readonly number[]).includes(position)) {
            return undefined;
        }

        // Find opponent tokens at this position
        const tokensAtPosition = this.tokenModel.getTokensAtPosition(position);
        const opponentToken = tokensAtPosition.find(
            (t) => t.playerIndex !== movingToken.playerIndex
        );

        if (opponentToken) {
            // Don't call captureToken here - let TurnManager do it after animation completes
            // This prevents the token from snapping to spawn before the animation plays
            return opponentToken;
        }

        return undefined;
    }

    /**
     * Check if a position is safe
     */
    isSafePosition(position: number): boolean {
        return (BOARD.safePositions as readonly number[]).includes(position);
    }

    /**
     * Check if a player has won
     */
    checkWin(playerIndex: number): boolean {
        return this.tokenModel.hasPlayerWon(playerIndex);
    }

    /**
     * Get player's progress (percentage)
     */
    getPlayerProgress(playerIndex: number): number {
        const tokens = this.tokenModel.getPlayerTokens(playerIndex);
        const maxSteps = (52 + BOARD.homeStretchLength) * BOARD.tokensPerPlayer;

        let totalSteps = 0;
        for (const token of tokens) {
            if (token.state === 'finished') {
                totalSteps += 52 + BOARD.homeStretchLength;
            } else {
                totalSteps += token.stepsFromStart;
            }
        }

        return (totalSteps / maxSteps) * 100;
    }


}

export default Rules;
