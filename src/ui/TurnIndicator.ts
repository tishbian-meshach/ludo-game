/**
 * TurnIndicator - Animated turn display
 * Shows whose turn it is with player color
 */

import gsap from 'gsap';
import { eventBus } from '../engine2d/EventBus';
import { getPlayerColors, PlayerColor, PLAYER_ORDER } from '../styles/theme';

export interface TurnIndicatorOptions {
    x: number;
    y: number;
    size: number;
}

export class TurnIndicator {
    private container: HTMLElement;
    private currentPlayer: number = 0;
    private options: TurnIndicatorOptions;

    constructor(container: HTMLElement, options: TurnIndicatorOptions) {
        this.container = container;
        this.options = options;

        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    private setupEventListeners(): void {
        eventBus.on('TURN_CHANGED', ({ player }) => {
            this.animateToPlayer(player);
        });

        eventBus.on('EXTRA_TURN', ({ player, reason }) => {
            this.showExtraTurn(player, reason);
        });
    }

    /**
     * Animate transition to new player
     */
    private animateToPlayer(player: number): void {
        this.currentPlayer = player;
        // Animation handled by HUD canvas for now
    }

    /**
     * Show extra turn indicator
     */
    private showExtraTurn(player: number, reason: 'six' | 'capture'): void {
        // Could show a "+1" or "Extra Turn" badge
        console.log(`Player ${player} gets extra turn: ${reason}`);
    }

    /**
     * Get current player
     */
    getCurrentPlayer(): number {
        return this.currentPlayer;
    }
}

export default TurnIndicator;
