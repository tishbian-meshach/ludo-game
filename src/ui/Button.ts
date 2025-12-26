/**
 * Button - Canvas-drawn button component
 * Rounded corners, soft shadows, press feedback
 */

import gsap from 'gsap';
import { COLORS, EASING } from '../styles/theme';

export interface ButtonOptions {
    x: number;
    y: number;
    width: number;
    height: number;
    text?: string;
    icon?: string;
    color?: string;
    onClick?: () => void;
}

export interface ButtonState {
    isHovered: boolean;
    isPressed: boolean;
    isDisabled: boolean;
    scale: number;
    opacity: number;
}

export class Button {
    private options: ButtonOptions;
    private state: ButtonState = {
        isHovered: false,
        isPressed: false,
        isDisabled: false,
        scale: 1,
        opacity: 1,
    };

    constructor(options: ButtonOptions) {
        this.options = {
            color: COLORS.ui.text,
            ...options,
        };
    }

    /**
     * Render the button to a canvas context
     */
    render(ctx: CanvasRenderingContext2D): void {
        const { x, y, width, height, text, icon, color } = this.options;
        const { scale, opacity, isPressed, isHovered, isDisabled } = this.state;

        ctx.save();
        ctx.globalAlpha = opacity * (isDisabled ? 0.5 : 1);

        // Calculate scaled position
        const scaledWidth = width * scale;
        const scaledHeight = height * scale;
        const offsetX = (width - scaledWidth) / 2;
        const offsetY = (height - scaledHeight) / 2;

        // Shadow
        if (!isPressed) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetY = 3;
        }

        // Background
        const bgColor = isPressed
            ? this.darkenColor('#FFFFFF', 10)
            : isHovered
                ? '#FFFFFF'
                : 'rgba(255, 255, 255, 0.95)';

        ctx.fillStyle = bgColor;
        ctx.beginPath();
        ctx.roundRect(
            x + offsetX,
            y + offsetY + (isPressed ? 2 : 0),
            scaledWidth,
            scaledHeight,
            scaledHeight / 2
        );
        ctx.fill();

        ctx.shadowColor = 'transparent';

        // Border
        ctx.strokeStyle = color!;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Text or icon
        if (text) {
            ctx.fillStyle = color!;
            ctx.font = `bold ${14 * scale}px "Segoe UI", system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
                text,
                x + width / 2,
                y + height / 2 + (isPressed ? 2 : 0)
            );
        }

        if (icon) {
            // Simple icon rendering (could be replaced with actual icon font)
            ctx.fillStyle = color!;
            ctx.font = `${20 * scale}px "Segoe UI Emoji", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
                icon,
                x + width / 2,
                y + height / 2 + (isPressed ? 2 : 0)
            );
        }

        ctx.restore();
    }

    /**
     * Check if point is inside button
     */
    hitTest(px: number, py: number): boolean {
        const { x, y, width, height } = this.options;
        return px >= x && px <= x + width && py >= y && py <= y + height;
    }

    /**
     * Handle press
     */
    press(): void {
        if (this.state.isDisabled) return;

        this.state.isPressed = true;
        gsap.to(this.state, {
            scale: 0.95,
            duration: 0.1,
            ease: EASING.buttonPress,
        });
    }

    /**
     * Handle release
     */
    release(): void {
        this.state.isPressed = false;
        gsap.to(this.state, {
            scale: 1,
            duration: 0.15,
            ease: EASING.buttonPress,
        });

        if (this.options.onClick && !this.state.isDisabled) {
            this.options.onClick();
        }
    }

    /**
     * Handle hover enter
     */
    hoverEnter(): void {
        if (this.state.isDisabled) return;
        this.state.isHovered = true;
    }

    /**
     * Handle hover exit
     */
    hoverExit(): void {
        this.state.isHovered = false;
    }

    /**
     * Enable button
     */
    enable(): void {
        this.state.isDisabled = false;
    }

    /**
     * Disable button
     */
    disable(): void {
        this.state.isDisabled = true;
    }

    /**
     * Set button visibility
     */
    setVisible(visible: boolean): void {
        gsap.to(this.state, {
            opacity: visible ? 1 : 0,
            duration: 0.2,
        });
    }

    /**
     * Darken a color
     */
    private darkenColor(color: string, amount: number): string {
        if (color.startsWith('rgba')) return color;
        const hex = color.replace('#', '');
        const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - amount);
        const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - amount);
        const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - amount);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    /**
     * Get button bounds
     */
    getBounds(): { x: number; y: number; width: number; height: number } {
        return { ...this.options };
    }

    /**
     * Update button options
     */
    updateOptions(options: Partial<ButtonOptions>): void {
        Object.assign(this.options, options);
    }
}

export default Button;
