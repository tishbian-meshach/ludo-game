/**
 * DebugPanel - UI for testing and debugging
 * Allows forcing dice rolls
 */

import { DiceLogic } from '../engine2d/DiceLogic';

export class DebugPanel {
    private container: HTMLElement;
    private diceLogic: DiceLogic;
    private buttons: HTMLButtonElement[] = [];

    constructor(diceLogic: DiceLogic) {
        this.diceLogic = diceLogic;
        this.container = document.createElement('div');
        this.setupUI();
        document.body.appendChild(this.container);
    }

    private setupUI(): void {
        // Container style
        Object.assign(this.container.style, {
            position: 'absolute',
            top: '70px', // Below turn banner area
            right: '20px',
            background: 'rgba(0, 0, 0, 0.8)',
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            zIndex: '10000', // Ensure above everything
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            pointerEvents: 'auto',
            fontFamily: 'system-ui, sans-serif',
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

            // Button style
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

            // Hover
            btn.onmouseenter = () => btn.style.background = '#444';
            btn.onmouseleave = () => {
                if (btn.getAttribute('data-active') !== 'true') {
                    btn.style.background = '#333';
                }
            };

            // Click
            btn.onclick = () => {
                this.diceLogic.debugSetNextRoll(i);

                // Active state feedback
                this.buttons.forEach(b => {
                    b.style.background = '#333';
                    b.style.borderColor = '#555';
                    b.setAttribute('data-active', 'false');
                });

                btn.style.background = '#2ecc71'; // Green
                btn.style.borderColor = '#27ae60';
                btn.setAttribute('data-active', 'true');

                // Auto reset visual after 3s (or let it stay until roll consumption?)
                // DiceLogic consumes it immediately on roll.
                // We could listen to DICE_ROLL event to reset UI?
                // For simplicity, just show it's selected.
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
    }
}
