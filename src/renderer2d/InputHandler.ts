/**
 * InputHandler - Touch and mouse input handling
 * Handles tap to roll dice, tap to select token, and gesture debouncing
 */

import { GameState } from '../engine2d/GameState';
import { TokenRenderer2D } from './TokenRenderer2D';
import { BoardModel } from '../engine2d/BoardModel';
import { eventBus } from '../engine2d/EventBus';
import { SIZES } from '../styles/theme';

export interface InputConfig {
    debounceTime: number;
    doubleTapTime: number;
}

export class InputHandler {
    private gameState: GameState;
    private tokenRenderer: TokenRenderer2D;
    private boardModel: BoardModel;
    private canvas: HTMLCanvasElement;

    private config: InputConfig = {
        debounceTime: 200,
        doubleTapTime: 300,
    };

    // Input state
    private lastTapTime: number = 0;
    private isInputLocked: boolean = false;
    private touchStartPos: { x: number; y: number } | null = null;

    // Dice area (relative to board)
    private diceAreaRadius: number = 60;
    private diceAreaCenter: { x: number; y: number };

    // Bound event handlers for cleanup
    private boundHandlers: {
        touchStart: (e: TouchEvent) => void;
        touchEnd: (e: TouchEvent) => void;
        mouseDown: (e: MouseEvent) => void;
        mouseUp: (e: MouseEvent) => void;
    };

    constructor(
        canvas: HTMLCanvasElement,
        gameState: GameState,
        tokenRenderer: TokenRenderer2D,
        boardModel: BoardModel
    ) {
        this.canvas = canvas;
        this.gameState = gameState;
        this.tokenRenderer = tokenRenderer;
        this.boardModel = boardModel;

        // Dice area in center of board
        const center = boardModel.size / 2;
        this.diceAreaCenter = { x: center, y: center };

        // Create bound handlers
        this.boundHandlers = {
            touchStart: this.handleTouchStart.bind(this),
            touchEnd: this.handleTouchEnd.bind(this),
            mouseDown: this.handleMouseDown.bind(this),
            mouseUp: this.handleMouseUp.bind(this),
        };

        this.setupEventListeners();
        this.setupGameEventListeners();
    }

    /**
     * Setup DOM event listeners
     */
    private setupEventListeners(): void {
        // Touch events
        this.canvas.addEventListener('touchstart', this.boundHandlers.touchStart, { passive: false });
        this.canvas.addEventListener('touchend', this.boundHandlers.touchEnd, { passive: false });

        // Mouse events (for desktop)
        this.canvas.addEventListener('mousedown', this.boundHandlers.mouseDown);
        this.canvas.addEventListener('mouseup', this.boundHandlers.mouseUp);

        // Prevent context menu on long press
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    /**
     * Setup game event listeners for input locking
     */
    private setupGameEventListeners(): void {
        // Lock input during animations
        eventBus.on('ANIMATION_START', () => {
            this.isInputLocked = true;
        });

        // Fix: Dice3D emits DICE_ANIMATION_COMPLETE, not ANIMATION_COMPLETE
        eventBus.on('DICE_ANIMATION_COMPLETE', () => {
            this.isInputLocked = false;
        });

        // Also listen for generic ANIMATION_COMPLETE in case other components use it
        eventBus.on('ANIMATION_COMPLETE', () => {
            this.isInputLocked = false;
        });

        // Safety: Always unlock input when turn changes
        eventBus.on('TURN_CHANGED', () => {
            this.isInputLocked = false;
        });

        eventBus.on('DICE_ROLL_START', () => {
            this.isInputLocked = true;
        });

        eventBus.on('DICE_ROLLED', () => {
            // Small delay before unlocking
            setTimeout(() => {
                this.isInputLocked = false;
            }, 100);
        });
    }



    /**
     * Handle touch start
     */
    private handleTouchStart(e: TouchEvent): void {
        e.preventDefault();

        if (e.touches.length !== 1) return;

        const touch = e.touches[0];
        const pos = this.getCanvasPosition(touch.clientX, touch.clientY);
        this.touchStartPos = pos;
    }

    /**
     * Handle touch end (tap detection)
     */
    private handleTouchEnd(e: TouchEvent): void {
        e.preventDefault();

        if (!this.touchStartPos) return;
        if (e.changedTouches.length !== 1) return;

        const touch = e.changedTouches[0];
        const endPos = this.getCanvasPosition(touch.clientX, touch.clientY);

        // Check if it was a tap (not a drag)
        const distance = Math.sqrt(
            (endPos.x - this.touchStartPos.x) ** 2 + (endPos.y - this.touchStartPos.y) ** 2
        );

        if (distance < 20) {
            this.handleTap(endPos.x, endPos.y);
        }

        this.touchStartPos = null;
    }

    /**
     * Handle mouse down
     */
    private handleMouseDown(e: MouseEvent): void {
        const pos = this.getCanvasPosition(e.clientX, e.clientY);
        this.touchStartPos = pos;
    }

    /**
     * Handle mouse up (click detection)
     */
    private handleMouseUp(e: MouseEvent): void {
        if (!this.touchStartPos) return;

        const endPos = this.getCanvasPosition(e.clientX, e.clientY);

        // Check if it was a click (not a drag)
        const distance = Math.sqrt(
            (endPos.x - this.touchStartPos.x) ** 2 + (endPos.y - this.touchStartPos.y) ** 2
        );

        if (distance < 10) {
            this.handleTap(endPos.x, endPos.y);
        }

        this.touchStartPos = null;
    }

    /**
     * Convert client coordinates to canvas coordinates
     */
    private getCanvasPosition(clientX: number, clientY: number): { x: number; y: number } {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.boardModel.size / rect.width;
        const scaleY = this.boardModel.size / rect.height;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY,
        };
    }

    /**
     * Handle tap action
     */
    private handleTap(x: number, y: number): void {
        // Check debounce
        const now = performance.now();
        if (now - this.lastTapTime < this.config.debounceTime) return;
        if (this.isInputLocked) return;

        this.lastTapTime = now;

        const phase = this.gameState.getTurnPhase();

        // If waiting for roll, tap anywhere to roll
        if (phase === 'waiting-for-roll') {
            this.gameState.rollDice();
            return;
        }

        // If waiting for move, check if tapped a valid token
        if (phase === 'waiting-for-move') {
            const token = this.tokenRenderer.hitTest(x, y);

            if (token) {
                // Check if this token can move based on the current player
                const currentPlayer = this.gameState.getCurrentPlayer();
                if (token.playerIndex === currentPlayer) {
                    this.gameState.selectToken(token.id);
                    return;
                }
            }
        }
    }

    /**
     * Check if point is in dice area
     */
    isDiceAreaTap(x: number, y: number): boolean {
        const dist = Math.sqrt(
            (x - this.diceAreaCenter.x) ** 2 + (y - this.diceAreaCenter.y) ** 2
        );
        return dist <= this.diceAreaRadius;
    }

    /**
     * Lock input (during animations)
     */
    lock(): void {
        this.isInputLocked = true;
    }

    /**
     * Unlock input
     */
    unlock(): void {
        this.isInputLocked = false;
    }

    /**
     * Check if input is locked
     */
    isLocked(): boolean {
        return this.isInputLocked;
    }

    /**
     * Update dice area position
     */
    setDiceAreaPosition(x: number, y: number, radius: number): void {
        this.diceAreaCenter = { x, y };
        this.diceAreaRadius = radius;
    }

    /**
     * Cleanup event listeners
     */
    destroy(): void {
        this.canvas.removeEventListener('touchstart', this.boundHandlers.touchStart);
        this.canvas.removeEventListener('touchend', this.boundHandlers.touchEnd);
        this.canvas.removeEventListener('mousedown', this.boundHandlers.mouseDown);
        this.canvas.removeEventListener('mouseup', this.boundHandlers.mouseUp);
    }
}

export default InputHandler;
