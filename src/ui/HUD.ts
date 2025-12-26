/**
 * HUD - Canvas-based heads-up display
 * Minimal, icon-first design with player progress
 */

import { GameState } from '../engine2d/GameState';
import { eventBus } from '../engine2d/EventBus';
import { COLORS, getPlayerColors, PLAYER_ORDER, PlayerColor } from '../styles/theme';

export class HUD {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private gameState: GameState;
    private size: number;
    private scale: number = 1;

    // Animation state
    private pulsePhase: number = 0;
    private showTurnBanner: boolean = false;
    private bannerOpacity: number = 0;
    private bannerPlayer: number = 0;

    constructor(canvas: HTMLCanvasElement, gameState: GameState, size: number) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.gameState = gameState;
        this.size = size;

        this.setupHighDPI();
        this.setupEventListeners();
    }

    /**
     * Setup high DPI canvas
     */
    private setupHighDPI(): void {
        const dpr = window.devicePixelRatio || 1;
        this.scale = dpr;

        this.canvas.style.width = `${this.size}px`;
        this.canvas.style.height = `${this.size}px`;
        this.canvas.width = this.size * dpr;
        this.canvas.height = this.size * dpr;
        this.ctx.scale(dpr, dpr);
    }

    /**
     * Setup event listeners
     */
    private setupEventListeners(): void {
        eventBus.on('TURN_CHANGED', ({ player }) => {
            this.showTurnBanner = true;
            this.bannerPlayer = player;
            this.bannerOpacity = 0;
        });
    }

    /**
     * Draw localized UI for the current player (Turn label, Action button)
     */
    private drawLocalizedUI(): void {
        const currentPlayer = this.gameState.getCurrentPlayer();
        const config = this.getPlayerUIConfig(currentPlayer);
        const phase = this.gameState.getTurnPhase();
        const colors = getPlayerColors(currentPlayer);

        this.ctx.save();
        this.ctx.translate(config.x, config.y);
        this.ctx.rotate(config.rotation);

        // --- Turn Status Text ---
        // Always show whose turn it is
        const colorName = PLAYER_ORDER[currentPlayer];
        const statusText = `${colorName.toUpperCase()}'S TURN`;

        this.ctx.font = '700 14px "Outfit", sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Text Shadow/Glow
        this.ctx.shadowColor = colors.glow;
        this.ctx.shadowBlur = 15;
        this.ctx.fillStyle = colors.light;
        this.ctx.fillText(statusText, 0, 0);
        this.ctx.shadowBlur = 0;

        // --- Action Button (Tap to Roll / Select) ---
        let actionText = '';
        if (phase === 'waiting-for-roll') actionText = 'TAP TO ROLL';
        else if (phase === 'waiting-for-move') actionText = 'SELECT TOKEN';

        if (actionText) {
            // Position button "Inner" from the status text (Negative Y moves towards center)
            const buttonY = -45;

            this.ctx.font = '700 16px "Outfit", sans-serif';
            const textMetrics = this.ctx.measureText(actionText);
            const w = Math.max(140, textMetrics.width + 50);
            const h = 44;

            const x = -w / 2;
            const y = buttonY - h / 2;

            // Button Background (Pill Shape)
            this.ctx.beginPath();
            this.ctx.roundRect(x, y, w, h, h / 2);

            // Gradient fill
            const gradient = this.ctx.createLinearGradient(x, y, x, y + h);
            gradient.addColorStop(0, colors.primary);
            gradient.addColorStop(1, colors.dark);
            this.ctx.fillStyle = gradient;

            // Active Glow
            const pulse = 1 + Math.sin(this.pulsePhase * 5) * 0.05;
            this.ctx.shadowColor = colors.glow;
            this.ctx.shadowBlur = 20 * pulse;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;

            // Inner Highlight
            this.ctx.beginPath();
            this.ctx.moveTo(x + 15, y + 2);
            this.ctx.lineTo(x + w - 15, y + 2);
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();

            // Button Text
            this.ctx.fillStyle = '#000000'; // High contrast
            this.ctx.fillText(actionText, 0, buttonY);
        } else if (phase === 'rolling') {
            // Show Rolling text if no button
            this.ctx.fillStyle = '#AAAAAA';
            this.ctx.font = '600 14px "Outfit", sans-serif';
            this.ctx.fillText('ROLLING...', 0, -35);
        }

        this.ctx.restore();
    }

    /**
     * Update HUD state
     */
    update(deltaTime: number): void {
        this.pulsePhase += deltaTime * 2;

        // Animate turn banner
        if (this.showTurnBanner) {
            if (this.bannerOpacity < 1) {
                this.bannerOpacity = Math.min(1, this.bannerOpacity + deltaTime * 4);
            } else {
                // Hold for a bit then fade
                setTimeout(() => {
                    this.showTurnBanner = false;
                }, 1000);
            }
        } else if (this.bannerOpacity > 0) {
            this.bannerOpacity = Math.max(0, this.bannerOpacity - deltaTime * 3);
        }
    }

    /**
     * Get UI configuration for a specific player (position, rotation)
     */
    private getPlayerUIConfig(playerIndex: number): { x: number, y: number, rotation: number, align: 'left' | 'right' } {
        const margin = 20;
        const offset = 80; // Distance from corner for UI elements

        switch (playerIndex) {
            case 0: // Red - Top Left
                return {
                    x: margin + offset,
                    y: margin + offset,
                    rotation: Math.PI, // 180 degrees
                    align: 'left'
                };
            case 1: // Green - Top Right
                return {
                    x: this.size - margin - offset,
                    y: margin + offset,
                    rotation: Math.PI, // 180 degrees
                    align: 'right'
                };
            case 2: // Yellow - Bottom Right
                return {
                    x: this.size - margin - offset,
                    y: this.size - margin - offset,
                    rotation: 0,
                    align: 'right'
                };
            case 3: // Blue - Bottom Left
                return {
                    x: margin + offset,
                    y: this.size - margin - offset,
                    rotation: 0,
                    align: 'left'
                };
            default:
                return { x: 0, y: 0, rotation: 0, align: 'left' };
        }
    }

    /**
     * Render the HUD
     */
    render(): void {
        this.ctx.clearRect(0, 0, this.size, this.size);

        // Draw player indicators in corners
        this.drawPlayerIndicators();

        // Draw current player highlight
        this.drawCurrentPlayerHighlight();

        // Draw finish ranks (1st, 2nd, 3rd)
        this.drawFinishRanks();
    }

    /**
     * Draw rank badges for finished players
     */
    private drawFinishRanks(): void {
        const playerCount = this.gameState.getPlayerCount();
        const center = this.size / 2;
        // Position badges in the center of each player's triangle
        const offset = this.size * 0.15;

        for (let i = 0; i < playerCount; i++) {
            // @ts-ignore - method added in GameState
            const rank = this.gameState.getFinishRank(i);

            if (rank > 0) {
                let x = center;
                let y = center;

                // Position based on player side
                switch (i) {
                    case 0: x -= offset; break; // Red (Left)
                    case 1: y -= offset; break; // Green (Top)
                    case 2: x += offset; break; // Yellow (Right)
                    case 3: y += offset; break; // Blue (Bottom)
                }

                this.drawRankBadge(x, y, rank);
            }
        }
    }

    private drawRankBadge(x: number, y: number, rank: number): void {
        const colors = ['#FFD700', '#C0C0C0', '#CD7F32', '#778899']; // Gold, Silver, Bronze, Steel
        const shadows = ['#CCAA00', '#8899AA', '#884411', '#445566'];

        const baseColor = colors[rank - 1] || '#FFFFFF';
        const darkColor = shadows[rank - 1] || '#888888';

        // Glow
        this.ctx.shadowColor = baseColor;
        this.ctx.shadowBlur = 15;

        // Badge Circle
        this.ctx.beginPath();
        this.ctx.arc(x, y, 18, 0, Math.PI * 2);

        const gradient = this.ctx.createLinearGradient(x - 10, y - 10, x + 10, y + 10);
        gradient.addColorStop(0, '#FFFFFF');
        gradient.addColorStop(0.3, baseColor);
        gradient.addColorStop(1, darkColor);

        this.ctx.fillStyle = gradient;
        this.ctx.fill();

        // Border
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        this.ctx.shadowBlur = 0;

        // Rank Number
        this.ctx.fillStyle = '#000000';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.font = 'bold 20px "Segoe UI", sans-serif';
        this.ctx.fillText(rank.toString(), x, y + 1);
    }

    /**
     * Draw player indicators in corners
     */
    private drawPlayerIndicators(): void {
        const playerCount = this.gameState.getPlayerCount();
        const indicatorSize = 50;
        const margin = 15;
        const currentPlayer = this.gameState.getCurrentPlayer();

        // Corner positions
        const positions = [
            { x: margin, y: margin }, // Red - top left
            { x: this.size - margin - indicatorSize, y: margin }, // Green - top right
            { x: this.size - margin - indicatorSize, y: this.size - margin - indicatorSize }, // Yellow - bottom right
            { x: margin, y: this.size - margin - indicatorSize }, // Blue - bottom left
        ];

        for (let i = 0; i < playerCount; i++) {
            const pos = positions[i];
            const colors = getPlayerColors(i);
            const isCurrentPlayer = currentPlayer === i;
            const cx = pos.x + indicatorSize / 2;
            const cy = pos.y + indicatorSize / 2;

            // Draw indicator - brighter for current player, very dim for others
            if (isCurrentPlayer) {
                // Current player: bright background and pulsing ring
                this.ctx.beginPath();
                this.ctx.arc(cx, cy, indicatorSize / 2, 0, Math.PI * 2);
                this.ctx.fillStyle = colors.bg;
                this.ctx.fill();
                this.ctx.strokeStyle = colors.primary;
                this.ctx.lineWidth = 3;
                this.ctx.stroke();


            } else {
                // Non-current player: very dim, barely visible
                this.ctx.globalAlpha = 0.4;
                this.ctx.beginPath();
                this.ctx.arc(cx, cy, indicatorSize / 2, 0, Math.PI * 2);
                this.ctx.fillStyle = colors.bg;
                this.ctx.fill();
                this.ctx.strokeStyle = colors.dark;
                this.ctx.lineWidth = 1;
                this.ctx.stroke();
                this.ctx.globalAlpha = 1.0;
            }

            // Player icon (pawn) - always visible
            this.drawPawnIcon(cx, cy, 15, isCurrentPlayer ? colors.primary : colors.dark);
        }
    }

    /**
     * Draw simplified pawn icon
     */
    private drawPawnIcon(x: number, y: number, size: number, color: string): void {
        this.ctx.fillStyle = color;

        // Head
        this.ctx.beginPath();
        this.ctx.arc(x, y - size * 0.3, size * 0.25, 0, Math.PI * 2);
        this.ctx.fill();

        // Body
        this.ctx.beginPath();
        this.ctx.moveTo(x - size * 0.35, y + size * 0.4);
        this.ctx.lineTo(x - size * 0.15, y - size * 0.1);
        this.ctx.lineTo(x + size * 0.15, y - size * 0.1);
        this.ctx.lineTo(x + size * 0.35, y + size * 0.4);
        this.ctx.closePath();
        this.ctx.fill();
    }

    /**
     * Draw current player highlight - simple radial glow from corner
     * Uses ONLY gameState.getCurrentPlayer() - single source of truth
     */
    private drawCurrentPlayerHighlight(): void {
        const currentPlayer = this.gameState.getCurrentPlayer();
        const colors = getPlayerColors(currentPlayer);

        // Pulse animation
        const pulse = Math.sin(this.pulsePhase * 2);
        const glowIntensity = 0.4 + pulse * 0.1;

        // Corner positions for each player
        const corners = [
            { x: 0, y: 0 },                             // 0: Red - Top Left
            { x: this.size, y: 0 },                     // 1: Green - Top Right
            { x: this.size, y: this.size },             // 2: Yellow - Bottom Right
            { x: 0, y: this.size },                     // 3: Blue - Bottom Left
        ];

        const corner = corners[currentPlayer];
        const radius = this.size * 0.6;

        // Draw radial gradient glow from corner
        const gradient = this.ctx.createRadialGradient(
            corner.x, corner.y, 0,
            corner.x, corner.y, radius
        );

        // Use the player's glow color with variable intensity
        const glowColor = colors.glow.replace('0.8', String(glowIntensity));
        gradient.addColorStop(0, glowColor);
        gradient.addColorStop(0.5, colors.glow.replace('0.8', '0.1'));
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.size, this.size);

        // Draw faded edge lines for the active player's corner
        this.drawCornerEdges(currentPlayer, colors.primary);
    }

    /**
     * Draw faded edge lines at the active player's corner
     */
    private drawCornerEdges(playerIndex: number, color: string): void {
        const length = this.size * 0.8;
        const thickness = 2;

        this.ctx.lineWidth = thickness;
        this.ctx.lineCap = 'round';

        // Helper to draw a faded line
        const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
            const gradient = this.ctx.createLinearGradient(x1, y1, x2, y2);
            gradient.addColorStop(0, color);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            this.ctx.strokeStyle = gradient;
            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
            this.ctx.stroke();
        };

        switch (playerIndex) {
            case 0: // Top Left - Red
                drawLine(0, thickness / 2, length, thickness / 2);          // Top edge
                drawLine(thickness / 2, 0, thickness / 2, length);          // Left edge
                break;
            case 1: // Top Right - Green
                drawLine(this.size, thickness / 2, this.size - length, thickness / 2);  // Top edge
                drawLine(this.size - thickness / 2, 0, this.size - thickness / 2, length); // Right edge
                break;
            case 2: // Bottom Right - Yellow
                drawLine(this.size, this.size - thickness / 2, this.size - length, this.size - thickness / 2); // Bottom edge
                drawLine(this.size - thickness / 2, this.size, this.size - thickness / 2, this.size - length); // Right edge
                break;
            case 3: // Bottom Left - Blue
                drawLine(0, this.size - thickness / 2, length, this.size - thickness / 2); // Bottom edge
                drawLine(thickness / 2, this.size, thickness / 2, this.size - length);     // Left edge
                break;
        }
    }

    /**
     * Draw phase indicator
     */
    private unused_drawPhaseIndicator(): void {
        const phase = this.gameState.getTurnPhase();
        const centerX = this.size / 2;
        const y = this.size - 30;

        let text = '';
        switch (phase) {
            case 'waiting-for-roll':
                text = 'Tap to Roll';
                break;
            case 'rolling':
                text = 'Rolling...';
                break;
            case 'waiting-for-move':
                text = 'Select Token';
                break;
            case 'moving':
            case 'animating':
                text = '';
                break;
        }

        if (text) {
            const centerX = this.size / 2;
            const y = this.size - 60; // Move up slightly
            const currentPlayer = this.gameState.getCurrentPlayer();
            const colors = getPlayerColors(currentPlayer);

            this.ctx.font = '600 16px "Outfit", "Segoe UI", system-ui, sans-serif'; // Professional font weight
            const textMetrics = this.ctx.measureText(text.toUpperCase());
            const textWidth = Math.max(140, textMetrics.width + 60); // Wider, more comfortable
            const buttonHeight = 48;

            // Simple elegant pill shape
            const w = textWidth;
            const h = buttonHeight;
            const x = centerX - w / 2;
            const top = y - h / 2;

            const isInteractive = phase === 'waiting-for-roll';

            // Draw Button Background
            this.ctx.beginPath();
            this.ctx.roundRect(x, top, w, h, h / 2); // Full pill shape

            if (isInteractive) {
                // Active State: Modern gradient
                const gradient = this.ctx.createLinearGradient(x, top, x, top + h);
                gradient.addColorStop(0, colors.primary);
                gradient.addColorStop(1, colors.dark);
                this.ctx.fillStyle = gradient;

                // Active Glow
                this.ctx.shadowColor = colors.glow;
                this.ctx.shadowBlur = 20;
                this.ctx.fill();

                // Reset shadow for text
                this.ctx.shadowBlur = 0;
            } else {
                // Inactive State: Subtle dark glass
                this.ctx.fillStyle = 'rgba(30, 30, 40, 0.8)';
                this.ctx.fill();
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                this.ctx.lineWidth = 1;
                this.ctx.stroke();
            }

            // Text
            this.ctx.fillStyle = isInteractive ? '#000000' : '#8888AA'; // High contrast black on bright button
            if (!isInteractive) this.ctx.fillStyle = '#AAAAAA';

            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';

            // Letter spacing for "premium" feel
            const charSpacing = 1.5;
            this.ctx.fillText(text.toUpperCase(), centerX, y);
        }
    }





    /**
     * Check if a point is within the current action button
     */
    public hitTestActionButton(x: number, y: number): boolean {
        const phase = this.gameState.getTurnPhase();
        if (phase !== 'waiting-for-roll' && phase !== 'waiting-for-move') return false;

        const currentPlayer = this.gameState.getCurrentPlayer();
        const config = this.getPlayerUIConfig(currentPlayer);

        // Transform point to local space
        // 1. Translate relative to anchor
        const dx = x - config.x;
        const dy = y - config.y;

        // 2. Rotate inverse
        // x' = x cos(-a) - y sin(-a)
        // y' = x sin(-a) + y cos(-a)
        const cos = Math.cos(-config.rotation);
        const sin = Math.sin(-config.rotation);

        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;

        // Button bounds in local space
        // Center of button is at (0, -45)
        // Width approx 180 (generous), Height 60 (generous)
        const btnY = -45;
        const halfW = 90;
        const halfH = 30;

        return (
            localX >= -halfW && localX <= halfW &&
            localY >= btnY - halfH && localY <= btnY + halfH
        );
    }

    /**
     * Resize HUD
     */
    resize(newSize: number): void {
        this.size = newSize;
        this.setupHighDPI();
    }
}

export default HUD;
