/**
 * DebugPanel - UI for testing and debugging
 * Allows forcing dice rolls
 * Hidden by default. Use debug.on() in console to show.
 */

import { DiceLogic } from '../engine2d/DiceLogic';

export class DebugPanel {
    private container: HTMLElement;
    private diceLogic: DiceLogic;
    private buttons: HTMLButtonElement[] = [];

    constructor(diceLogic: DiceLogic, container: HTMLElement) {
        this.diceLogic = diceLogic;

        // Create within the game container so it stays with the board
        this.container = document.createElement('div');
        this.setupUI();
        container.appendChild(this.container);

        // Hide by default
        this.hide();

        // Expose global debug object
        this.exposeGlobalDebug();
    }

    /**
     * Expose debug controls to window for console access
     */
    private exposeGlobalDebug(): void {
        (window as any).debug = {
            on: () => {
                this.show();
                console.log('%c🎲 Debug panel enabled', 'color: #2ecc71; font-weight: bold');
            },
            off: () => {
                this.hide();
                console.log('%c🎲 Debug panel disabled', 'color: #e74c3c; font-weight: bold');
            },
            roll: (value: number) => {
                if (value >= 1 && value <= 6) {
                    this.diceLogic.debugSetNextRoll(value);
                    console.log(`%c🎲 Next roll forced to: ${value}`, 'color: #f1c40f; font-weight: bold');
                } else {
                    console.warn('Roll value must be between 1 and 6');
                }
            }
        };
    }

    /**
     * Show the debug panel
     */
    show(): void {
        this.container.style.display = 'flex';
    }

    /**
     * Hide the debug panel
     */
    hide(): void {
        this.container.style.display = 'none';
    }

    private setupUI(): void {
        // Container style - Absolute relative to the game board container
        Object.assign(this.container.style, {
            position: 'absolute',
            top: '5%',
            right: '2%',
            background: 'rgba(0, 0, 0, 0.85)',
            padding: '8px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            zIndex: '100',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            pointerEvents: 'auto',
            fontFamily: '"Outfit", sans-serif',
            backdropFilter: 'blur(5px)',
            transformOrigin: 'top right',
            transform: 'scale(0.8)',
            maxWidth: '200px',
        });

        // Label
        const label = document.createElement('div');
        label.textContent = 'DEBUG: Force Roll';
        Object.assign(label.style, {
            color: '#aaa',
            fontSize: '11px',
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: '4px',
            textTransform: 'uppercase',
        });
        this.container.appendChild(label);

        // Buttons container
        const btnRow = document.createElement('div');
        Object.assign(btnRow.style, {
            display: 'flex',
            gap: '5px',
        });

        // Create buttons 1-6
        for (let i = 1; i <= 6; i++) {
            const btn = document.createElement('button');
            btn.textContent = i.toString();

            Object.assign(btn.style, {
                width: '30px',
                height: '30px',
                background: '#333',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                transition: 'all 0.2s ease',
            });

            btn.onmouseenter = () => btn.style.background = '#444';
            btn.onmouseleave = () => {
                if (btn.getAttribute('data-active') !== 'true') {
                    btn.style.background = '#333';
                }
            };

            btn.onclick = () => {
                this.diceLogic.debugSetNextRoll(i);

                this.buttons.forEach(b => {
                    b.style.background = '#333';
                    b.style.borderColor = '#555';
                    b.setAttribute('data-active', 'false');
                });

                btn.style.background = '#2ecc71';
                btn.style.borderColor = '#27ae60';
                btn.setAttribute('data-active', 'true');
            };

            this.buttons.push(btn);
            btnRow.appendChild(btn);
        }

        this.container.appendChild(btnRow);
    }

    destroy(): void {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        // Clean up global
        delete (window as any).debug;
    }
}
