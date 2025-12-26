/**
 * TokenModel - Token state management
 * Handles individual token state and position tracking
 */

import { TokenPosition } from './BoardModel';
import { BOARD, PlayerColor, PLAYER_ORDER } from '../styles/theme';

export type TokenState = 'home' | 'on-board' | 'home-stretch' | 'finished';

export interface Token {
    id: string;
    playerIndex: number;
    playerColor: PlayerColor;
    tokenIndex: number; // 0-3 within player
    state: TokenState;
    position: TokenPosition;
    mainTrackPosition: number; // Logical position on track (-1 if not on track)
    stepsFromStart: number; // Total steps taken from start
}

export class TokenModel {
    private tokens: Map<string, Token> = new Map();

    constructor(activePlayerIndices: number[] = [0, 1, 2, 3]) {
        this.initializeTokens(activePlayerIndices);
    }

    /**
     * Initialize all tokens for all players
     * For 2 players: Red (0) and Yellow (2) - opposite corners
     * For 3 players: Red (0), Green (1), Yellow (2)
     * For 4 players: All corners
     */
    private initializeTokens(activePlayerIndices: number[]): void {
        this.tokens.clear();

        for (const playerIndex of activePlayerIndices) {
            const playerColor = PLAYER_ORDER[playerIndex];

            for (let tokenIndex = 0; tokenIndex < BOARD.tokensPerPlayer; tokenIndex++) {
                const id = `${playerColor}-${tokenIndex}`;

                this.tokens.set(id, {
                    id,
                    playerIndex,   // Use actual player index (0, 2 for 2-player)
                    playerColor,   // Matches the player index
                    tokenIndex,
                    state: 'home',
                    position: { type: 'spawn', spawnIndex: tokenIndex },
                    mainTrackPosition: -1,
                    stepsFromStart: 0,
                });
            }
        }
    }

    /**
     * Get a token by ID
     */
    getToken(tokenId: string): Token | undefined {
        return this.tokens.get(tokenId);
    }

    /**
     * Get all tokens
     */
    getAllTokens(): Token[] {
        return Array.from(this.tokens.values());
    }

    /**
     * Get tokens for a specific player
     */
    getPlayerTokens(playerIndex: number): Token[] {
        return this.getAllTokens().filter((t) => t.playerIndex === playerIndex);
    }

    /**
     * Get tokens at a specific main track position
     */
    getTokensAtPosition(mainTrackPosition: number): Token[] {
        return this.getAllTokens().filter(
            (t) => t.state === 'on-board' && t.mainTrackPosition === mainTrackPosition
        );
    }

    /**
     * Move token out of home onto start position
     */
    enterBoard(tokenId: string): boolean {
        const token = this.tokens.get(tokenId);
        if (!token || token.state !== 'home') return false;

        const startPos = BOARD.startPositions[token.playerColor];

        token.state = 'on-board';
        token.position = { type: 'main', cellIndex: startPos };
        token.mainTrackPosition = startPos;
        token.stepsFromStart = 0;

        return true;
    }

    /**
     * Move token by dice value
     * Returns the new position, or null if move is invalid
     */
    moveToken(tokenId: string, steps: number): { from: number; to: number } | null {
        const token = this.tokens.get(tokenId);
        if (!token) return null;

        const from = token.mainTrackPosition;

        if (token.state === 'home') {
            // Can only enter board with a 6
            return null;
        }

        if (token.state === 'on-board') {
            const homeEntry = BOARD.homeEntryPositions[token.playerColor];
            const stepsToHome = this.calculateStepsToHome(token);

            // Check if entering home stretch (after 51 steps, enter home lane)
            // Red: starts at 1, after 50 steps at pos 51 (home entry), 51st step enters home
            if (token.stepsFromStart + steps >= 51) {
                const homeSteps = token.stepsFromStart + steps - 51;

                if (homeSteps >= BOARD.homeStretchLength - 1) {
                    // Exact count needed to finish (reach cell 5, the triangle)
                    if (homeSteps === BOARD.homeStretchLength - 1) {
                        token.state = 'finished';
                        token.position = { type: 'finished' };
                        token.mainTrackPosition = -1;
                        return { from, to: -1 };
                    }
                    return null; // Overshot
                }

                // Enter home stretch
                token.state = 'home-stretch';
                token.position = { type: 'home-stretch', cellIndex: homeSteps };
                token.stepsFromStart += steps;
                token.mainTrackPosition = -1;
                return { from, to: homeSteps + 100 }; // 100+ indicates home stretch
            }

            // Normal move on main track
            const newPosition = (token.mainTrackPosition + steps) % BOARD.mainTrackLength;
            token.position = { type: 'main', cellIndex: newPosition };
            token.mainTrackPosition = newPosition;
            token.stepsFromStart += steps;

            return { from, to: newPosition };
        }

        if (token.state === 'home-stretch') {
            const currentHomePos = (token.position as { type: 'home-stretch'; cellIndex: number }).cellIndex;
            const newHomePos = currentHomePos + steps;

            if (newHomePos >= BOARD.homeStretchLength - 1) {
                if (newHomePos === BOARD.homeStretchLength - 1) {
                    // Reached the triangle (finish)!
                    token.state = 'finished';
                    token.position = { type: 'finished' };
                    return { from: currentHomePos + 100, to: -1 };
                }
                return null; // Overshot
            }

            token.position = { type: 'home-stretch', cellIndex: newHomePos };
            token.stepsFromStart += steps;
            return { from: currentHomePos + 100, to: newHomePos + 100 };
        }

        return null;
    }

    /**
     * Calculate steps remaining to reach home stretch entry
     */
    private calculateStepsToHome(token: Token): number {
        const homeEntry = BOARD.homeEntryPositions[token.playerColor];
        const startPos = BOARD.startPositions[token.playerColor];

        // Full loop is 51 steps (0-51, then home)
        return 51 - token.stepsFromStart;
    }

    /**
     * Send token back to spawn (captured)
     */
    captureToken(tokenId: string): boolean {
        const token = this.tokens.get(tokenId);
        if (!token || token.state === 'home' || token.state === 'finished') return false;

        token.state = 'home';
        token.position = { type: 'spawn', spawnIndex: token.tokenIndex };
        token.mainTrackPosition = -1;
        token.stepsFromStart = 0;

        return true;
    }

    /**
     * Check if a player has won
     */
    hasPlayerWon(playerIndex: number): boolean {
        const playerTokens = this.getPlayerTokens(playerIndex);
        return playerTokens.every((t) => t.state === 'finished');
    }

    /**
     * Get tokens that can be moved with given dice value
     */
    getMovableTokens(playerIndex: number, diceValue: number): Token[] {
        const tokens = this.getPlayerTokens(playerIndex);
        const movable: Token[] = [];

        for (const token of tokens) {
            if (token.state === 'home') {
                // Only 6 can bring token out
                if (diceValue === 6) {
                    movable.push(token);
                }
            } else if (token.state === 'on-board') {
                // Check if move is valid (won't overshoot home)
                // 51 steps to reach home entry, then homeStretchLength - 1 to finish
                const stepsToFinish = 51 + (BOARD.homeStretchLength - 1) - token.stepsFromStart;
                if (diceValue <= stepsToFinish) {
                    movable.push(token);
                }
            } else if (token.state === 'home-stretch') {
                const currentPos = (token.position as { type: 'home-stretch'; cellIndex: number }).cellIndex;
                // Finish at cell 5 (homeStretchLength - 1), not cell 6
                const stepsToFinish = (BOARD.homeStretchLength - 1) - currentPos;
                if (diceValue <= stepsToFinish) {
                    movable.push(token);
                }
            }
            // finished tokens can't move
        }

        return movable;
    }

    /**
     * Get current state of all tokens
     */
    getState(): Token[] {
        return this.getAllTokens();
    }

    /**
     * Load state of all tokens
     */
    loadState(tokens: Token[]): void {
        this.tokens.clear();
        tokens.forEach(t => {
            this.tokens.set(t.id, { ...t });
        });
    }

    /**
     * Reset all tokens
     */
    reset(activePlayerIndices: number[]): void {
        this.initializeTokens(activePlayerIndices);
    }
}

export default TokenModel;
