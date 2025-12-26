/**
 * EventBus - Central event system for decoupled communication
 * 2D Engine emits events, 3D Renderer subscribes
 */

// Game event types with their payloads
export interface GameEventMap {
    // Dice events
    DICE_ROLL_START: { player: number };
    DICE_ROLL: { player: number; value: number };  // Combined event with value
    DICE_ROLLED: { value: number; player: number };

    // Token events
    TOKEN_SELECTED: { tokenId: string; player: number };
    TOKEN_MOVE_START: { tokenId: string; from: number; to: number; player: number };
    TOKEN_MOVED: { tokenId: string; from: number; to: number; player: number };
    TOKEN_ENTERED_BOARD: { tokenId: string; position: number; player: number };
    TOKEN_CAPTURED: { capturedTokenId: string; capturingTokenId: string; position: number };
    TOKEN_REACHED_HOME: { tokenId: string; player: number };
    TOKEN_ANIMATION_START: { tokenId: string };
    TOKEN_ANIMATION_END: { tokenId: string };

    // Turn events
    TURN_CHANGED: { player: number; previousPlayer: number };
    EXTRA_TURN: { player: number; reason: 'six' | 'capture' };

    // Game state events
    GAME_STARTED: { playerCount: number };
    GAME_WON: { player: number };
    GAME_RESET: {};
    GAME_RESUMED: { player: number };

    // UI events
    HIGHLIGHT_MOVES: { tokenId: string; validPositions: number[] };
    CLEAR_HIGHLIGHTS: {};
    VALID_MOVES: { moves: Array<{ tokenId: string; canMove: boolean }> };

    // Animation sync events
    ANIMATION_START: { type: string; duration: number };
    ANIMATION_COMPLETE: { type: string };
    DICE_ANIMATION_COMPLETE: { type: string };
    TOKEN_ANIMATION_COMPLETE: { tokenId: string };
}

export type GameEventType = keyof GameEventMap;
export type GameEventPayload<T extends GameEventType> = GameEventMap[T];

type EventCallback<T extends GameEventType> = (payload: GameEventPayload<T>) => void;

interface Subscription {
    eventType: GameEventType;
    callback: EventCallback<GameEventType>;
    once: boolean;
}

class EventBus {
    private listeners: Map<GameEventType, Set<Subscription>> = new Map();
    private eventHistory: Array<{ type: GameEventType; payload: unknown; timestamp: number }> = [];
    private maxHistorySize = 100;

    /**
     * Subscribe to an event
     */
    on<T extends GameEventType>(
        eventType: T,
        callback: EventCallback<T>
    ): () => void {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set());
        }

        const subscription: Subscription = {
            eventType,
            callback: callback as EventCallback<GameEventType>,
            once: false,
        };

        this.listeners.get(eventType)!.add(subscription);

        // Return unsubscribe function
        return () => {
            this.listeners.get(eventType)?.delete(subscription);
        };
    }

    /**
     * Subscribe to an event for one-time execution
     */
    once<T extends GameEventType>(
        eventType: T,
        callback: EventCallback<T>
    ): () => void {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set());
        }

        const subscription: Subscription = {
            eventType,
            callback: callback as EventCallback<GameEventType>,
            once: true,
        };

        this.listeners.get(eventType)!.add(subscription);

        return () => {
            this.listeners.get(eventType)?.delete(subscription);
        };
    }

    /**
     * Emit an event to all subscribers
     */
    emit<T extends GameEventType>(eventType: T, payload: GameEventPayload<T>): void {
        // Store in history
        this.eventHistory.push({
            type: eventType,
            payload,
            timestamp: performance.now(),
        });

        // Trim history if needed
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }

        const listeners = this.listeners.get(eventType);
        if (!listeners) return;

        // Create a copy to avoid mutation during iteration
        const toRemove: Subscription[] = [];

        listeners.forEach((subscription) => {
            try {
                subscription.callback(payload);
                if (subscription.once) {
                    toRemove.push(subscription);
                }
            } catch (error) {
                console.error(`Error in event handler for ${eventType}:`, error);
            }
        });

        // Remove one-time listeners
        toRemove.forEach((sub) => listeners.delete(sub));
    }

    /**
     * Remove all listeners for a specific event type
     */
    off(eventType: GameEventType): void {
        this.listeners.delete(eventType);
    }

    /**
     * Remove all listeners
     */
    clear(): void {
        this.listeners.clear();
    }

    /**
     * Get event history for debugging
     */
    getHistory(): ReadonlyArray<{ type: GameEventType; payload: unknown; timestamp: number }> {
        return this.eventHistory;
    }

    /**
     * Wait for a specific event (Promise-based)
     */
    waitFor<T extends GameEventType>(
        eventType: T,
        timeout?: number
    ): Promise<GameEventPayload<T>> {
        return new Promise((resolve, reject) => {
            const unsubscribe = this.once(eventType, (payload) => {
                if (timeoutId) clearTimeout(timeoutId);
                resolve(payload);
            });

            let timeoutId: ReturnType<typeof setTimeout> | undefined;
            if (timeout) {
                timeoutId = setTimeout(() => {
                    unsubscribe();
                    reject(new Error(`Timeout waiting for event: ${eventType}`));
                }, timeout);
            }
        });
    }
}

// Singleton instance
export const eventBus = new EventBus();

export default eventBus;
