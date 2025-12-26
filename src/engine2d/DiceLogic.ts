/**
 * DiceLogic - Dice rolling logic and state
 */

import { eventBus } from './EventBus';

export interface DiceState {
    value: number;
    isRolling: boolean;
    canRoll: boolean;
    consecutiveSixes: number;
}

export class DiceLogic {
    private state: DiceState = {
        value: 1,
        isRolling: false,
        canRoll: true,
        consecutiveSixes: 0,
    };

    private currentPlayer: number = 0;

    /**
     * Roll the dice
     * Returns the result after "animation" completes
     */
    async roll(player: number): Promise<number> {
        if (this.state.isRolling || !this.state.canRoll) {
            return this.state.value;
        }

        this.currentPlayer = player;
        this.state.isRolling = true;
        this.state.canRoll = false;

        // Emit roll start event (for any listeners that need to know roll started)
        eventBus.emit('DICE_ROLL_START', { player });

        // Generate random value (or use debug forced value)
        let value: number;
        if (this.nextRollForceValue !== null) {
            value = this.nextRollForceValue;
            this.nextRollForceValue = null;
            console.log('[DiceLogic] Using forced debug value:', value);
        } else {
            value = Math.floor(Math.random() * 6) + 1;
        }

        this.state.value = value;

        // Track consecutive sixes
        if (value === 6) {
            this.state.consecutiveSixes++;
        } else {
            this.state.consecutiveSixes = 0;
        }

        // Emit combined roll event with value so 3D can animate to correct face
        eventBus.emit('DICE_ROLL', { player, value });

        // Wait for dice animation to complete
        await eventBus.waitFor('DICE_ANIMATION_COMPLETE', 3000).catch(() => {
            // Timeout - animation may not be subscribed yet
            console.log('Dice animation timeout, continuing...');
        });

        this.state.isRolling = false;

        // Emit DICE_ROLLED for other listeners (camera, input handler, etc.)
        eventBus.emit('DICE_ROLLED', { value, player });

        return value;
    }

    private nextRollForceValue: number | null = null;

    /**
     * DEBUG: Force next roll value
     */
    debugSetNextRoll(value: number): void {
        if (value < 1 || value > 6) return;
        this.nextRollForceValue = value;
        console.log('[DiceLogic] Next roll forced to:', value);
    }

    /**
     * Quick roll without waiting for animation
     * Used for testing or when animations are disabled
     */
    rollImmediate(player: number): number {
        const value = Math.floor(Math.random() * 6) + 1;
        this.state.value = value;
        this.currentPlayer = player;

        if (value === 6) {
            this.state.consecutiveSixes++;
        } else {
            this.state.consecutiveSixes = 0;
        }

        eventBus.emit('DICE_ROLLED', { value, player });
        return value;
    }

    /**
     * Enable rolling
     */
    enableRoll(): void {
        this.state.canRoll = true;
    }

    /**
     * Disable rolling
     */
    disableRoll(): void {
        this.state.canRoll = false;
    }

    /**
     * Reset consecutive sixes counter
     */
    resetConsecutiveSixes(): void {
        this.state.consecutiveSixes = 0;
    }

    /**
     * Check if player rolled three consecutive sixes (bust)
     */
    isThreeSixes(): boolean {
        return this.state.consecutiveSixes >= 3;
    }

    /**
     * Check if player gets extra turn
     */
    getsExtraTurn(): boolean {
        return this.state.value === 6 && this.state.consecutiveSixes < 3;
    }

    /**
     * Get current dice state
     */
    getState(): Readonly<DiceState> {
        return { ...this.state };
    }

    /**
     * Get last rolled value
     */
    getValue(): number {
        return this.state.value;
    }

    /**
     * Check if dice is currently rolling
     */
    isRolling(): boolean {
        return this.state.isRolling;
    }

    /**
     * Reset dice state
     */
    reset(): void {
        this.state = {
            value: 1,
            isRolling: false,
            canRoll: true,
            consecutiveSixes: 0,
        };
    }
}

export default DiceLogic;
