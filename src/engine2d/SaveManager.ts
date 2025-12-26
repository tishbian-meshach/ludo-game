/**
 * SaveManager - Handles persistence of game state to localStorage
 */

export interface SaveData {
    config: any;
    tokens: any[];
    turn: any;
    winners: number[];
    timestamp: number;
}

const SAVE_KEY = 'LUDO_SAVE_GAME';

export const SaveManager = {
    /**
     * Save game state
     */
    save(data: SaveData): void {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save game:', e);
        }
    },

    /**
     * Load game state
     */
    load(): SaveData | null {
        try {
            const data = localStorage.getItem(SAVE_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Failed to load game:', e);
            return null;
        }
    },

    /**
     * Clear saved game
     */
    clear(): void {
        localStorage.removeItem(SAVE_KEY);
    },

    /**
     * Check if a saved game exists
     */
    hasSave(): boolean {
        return !!localStorage.getItem(SAVE_KEY);
    }
};
