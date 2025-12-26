/**
 * TokenRenderer2D - Renders tokens on the 2D canvas
 * Includes step-by-step hopping animation
 */

import { TokenModel, Token } from '../engine2d/TokenModel';
import { BoardModel, TokenPosition } from '../engine2d/BoardModel';
import { eventBus } from '../engine2d/EventBus';
import { getPlayerColorsByName, SIZES, BOARD, PlayerColor } from '../styles/theme';

interface AnimatingToken {
    token: Token;
    path: { x: number; y: number }[]; // Full path of positions
    currentStep: number;
    stepProgress: number;
    speedMultiplier: number; // 1.0 for normal, higher for capture
    isCapture: boolean;
}

export class TokenRenderer2D {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private tokenModel: TokenModel;
    private boardModel: BoardModel;
    private size: number;
    private scale: number = 1;

    // Animation state
    private glowPhase: number = 0;
    private highlightedTokens: Set<string> = new Set();
    private selectedToken: string | null = null;
    private animatingTokens: Map<string, AnimatingToken> = new Map();

    // Animation speed
    private hopDuration: number = 0.15; // seconds per cell

    constructor(
        canvas: HTMLCanvasElement,
        tokenModel: TokenModel,
        boardModel: BoardModel
    ) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.tokenModel = tokenModel;
        this.boardModel = boardModel;
        this.size = boardModel.size;

        this.setupHighDPI();
        this.setupEventListeners();
    }

    private setupHighDPI(): void {
        const dpr = window.devicePixelRatio || 1;
        this.scale = dpr;

        this.canvas.style.width = `${this.size}px`;
        this.canvas.style.height = `${this.size}px`;
        this.canvas.width = this.size * dpr;
        this.canvas.height = this.size * dpr;
        this.ctx.scale(dpr, dpr);
    }

    private setupEventListeners(): void {
        eventBus.on('VALID_MOVES', ({ moves }) => {
            this.highlightedTokens.clear();
            moves.forEach((move: { tokenId: string; canMove: boolean }) => {
                if (move.canMove) {
                    this.highlightedTokens.add(move.tokenId);
                }
            });
        });

        eventBus.on('TOKEN_SELECTED', ({ tokenId }) => {
            this.selectedToken = tokenId;
        });

        eventBus.on('TURN_CHANGED', () => {
            this.highlightedTokens.clear();
            this.selectedToken = null;
        });

        // Listen for token movement to animate
        eventBus.on('TOKEN_MOVE_START', ({ tokenId, from, to, player }) => {
            this.highlightedTokens.clear();
            this.selectedToken = null;
            this.startHopAnimation(tokenId, from, to, player);
        });

        eventBus.on('TOKEN_ENTERED_BOARD', ({ tokenId, position, player }) => {
            this.highlightedTokens.clear();
            this.selectedToken = null;
            // Simple entry - no special animation needed
        });

        // Listen for capture
        eventBus.on('TOKEN_CAPTURED', ({ capturedTokenId, position }) => {
            this.startCaptureAnimation(capturedTokenId, position);
        });
    }

    /**
     * Start hopping animation from cell to cell
     * Handles: main track (0-51), home stretch (100+), finished (-1)
     */
    private startHopAnimation(tokenId: string, from: number, to: number, player: number): void {
        const token = this.tokenModel.getToken(tokenId);
        if (!token) return;

        const path: { x: number; y: number }[] = [];

        // Determine 'from' position type
        if (from >= 100) {
            // Starting from home stretch
            const fromHomeCell = from - 100;
            path.push(this.boardModel.getPosition({ type: 'home-stretch', cellIndex: fromHomeCell }, player));

            if (to === -1) {
                // Moving to finish - animate to the triangle position, not BoardModel position
                for (let i = fromHomeCell + 1; i < BOARD.homeStretchLength - 1; i++) {
                    path.push(this.boardModel.getPosition({ type: 'home-stretch', cellIndex: i }, player));
                }
                // End at the triangle line position (this will be where the token renders)
                path.push(this.getTriangleFinishPosition(player));
            } else if (to >= 100) {
                // Moving within home stretch
                const toHomeCell = to - 100;
                for (let i = fromHomeCell + 1; i <= toHomeCell; i++) {
                    path.push(this.boardModel.getPosition({ type: 'home-stretch', cellIndex: i }, player));
                }
            }
        } else {
            // Starting from main track
            path.push(this.boardModel.getPosition({ type: 'main', cellIndex: from }, player));

            if (to >= 100) {
                // Entering home stretch from main track
                const toHomeCell = to - 100;

                // Trace to home entry position
                const homeEntry = (BOARD.homeEntryPositions as any)[token.playerColor];
                let current = from;
                const maxSteps = 52;
                let steps = 0;

                while (current !== homeEntry && steps < maxSteps) {
                    current = (current + 1) % 52;
                    path.push(this.boardModel.getPosition({ type: 'main', cellIndex: current }, player));
                    steps++;
                }

                // Now trace into home stretch
                for (let i = 0; i <= toHomeCell; i++) {
                    path.push(this.boardModel.getPosition({ type: 'home-stretch', cellIndex: i }, player));
                }
            } else if (to === -1) {
                // Going directly to finish from main track (unlikely but handle it)
                const homeEntry = (BOARD.homeEntryPositions as any)[token.playerColor];
                let current = from;
                const maxSteps = 52;
                let steps = 0;

                while (current !== homeEntry && steps < maxSteps) {
                    current = (current + 1) % 52;
                    path.push(this.boardModel.getPosition({ type: 'main', cellIndex: current }, player));
                    steps++;
                }

                // Trace through home stretch to finish
                for (let i = 0; i < BOARD.homeStretchLength - 1; i++) {
                    path.push(this.boardModel.getPosition({ type: 'home-stretch', cellIndex: i }, player));
                }
                // End at the triangle line position
                path.push(this.getTriangleFinishPosition(player));
            } else {
                // Normal main track movement
                let current = from;
                const maxSteps = 20;
                let steps = 0;

                while (current !== to && steps < maxSteps) {
                    current = (current + 1) % 52;
                    path.push(this.boardModel.getPosition({ type: 'main', cellIndex: current }, player));
                    steps++;
                }
            }
        }

        if (path.length < 2) return;

        this.animatingTokens.set(tokenId, {
            token,
            path,
            currentStep: 0,
            stepProgress: 0,
            speedMultiplier: 1.0,
            isCapture: false
        });
    }

    /**
     * Start reverse capture aniamtion (rewind to start, then spawn)
     */
    private startCaptureAnimation(tokenId: string, fromPos: number): void {
        const token = this.tokenModel.getToken(tokenId);
        if (!token) return;

        const path: { x: number; y: number }[] = [];
        const startPos = (BOARD.startPositions as any)[token.playerColor];

        // 1. Add current position
        path.push(this.boardModel.getPosition({ type: 'main', cellIndex: fromPos }, token.playerIndex));

        // 2. Trace BACKWARDS to start position
        let current = fromPos;
        const maxSteps = 52; // Limit rewind to one full loop max
        let steps = 0;

        while (current !== startPos && steps < maxSteps) {
            // Move backwards with wrap-around
            current = (current - 1 + 52) % 52;
            path.push(this.boardModel.getPosition({ type: 'main', cellIndex: current }, token.playerIndex));
            steps++;
        }

        // 3. Add Spawn position
        path.push(this.boardModel.getPosition({ type: 'spawn', spawnIndex: token.tokenIndex }, token.playerIndex));

        // Speed up the rewind based on distance
        // Baseline: 6 steps per second (2x normal). If long path, go faster.
        const speedMult = Math.max(2, steps / 4);

        this.animatingTokens.set(tokenId, {
            token,
            path,
            currentStep: 0,
            stepProgress: 0,
            speedMultiplier: speedMult,
            isCapture: true
        });
    }

    update(deltaTime: number): void {
        this.glowPhase += deltaTime * 3;

        // Update hop animations
        this.animatingTokens.forEach((anim, tokenId) => {
            // Use base speed (steps per second) modified by multiplier
            // Default 300ms per step = 3.33 steps/sec
            const stepSpeed = (1 / this.hopDuration) * anim.speedMultiplier;
            anim.stepProgress += deltaTime * stepSpeed;

            if (anim.stepProgress >= 1) {
                // Move to next step
                anim.currentStep++;
                anim.stepProgress = 0;

                if (anim.currentStep >= anim.path.length - 1) {
                    // Animation complete
                    this.animatingTokens.delete(tokenId);
                    eventBus.emit('TOKEN_ANIMATION_COMPLETE', { tokenId });
                }
            }
        });
    }



    render(deltaTime: number): void {
        this.update(deltaTime);
        this.ctx.clearRect(0, 0, this.size, this.size);

        const allTokens = this.tokenModel.getAllTokens();

        // Group tokens by position key
        const tokenGroups = new Map<string, Token[]>();

        allTokens.forEach(token => {
            // Animating tokens are handled separately or excluded from grouping to prevent snapping
            const anim = this.animatingTokens.get(token.id);
            if (anim) {
                // Render animating token immediately (floating above)
                this.renderAnimatingToken(anim);
            } else {
                // Static tokens are grouped
                let key = '';
                if (token.position.type === 'main') {
                    key = `main_${token.position.cellIndex}`;
                } else if (token.position.type === 'home-stretch') {
                    key = `home_${token.playerIndex}_${token.position.cellIndex}`;
                } else if (token.position.type === 'finished') {
                    key = `finished_${token.playerIndex}`;
                } else {
                    key = `other_${token.id}`; // Spawn and others not grouped
                }

                if (!tokenGroups.has(key)) tokenGroups.set(key, []);
                tokenGroups.get(key)!.push(token);
            }
        });

        // Render groups
        tokenGroups.forEach((tokens, key) => {
            const count = tokens.length;

            // Sort tokens in group so they render in consistent order (e.g., by player, then ID)
            tokens.sort((a, b) => a.id.localeCompare(b.id));

            // Check if this is a finished group - render specially as a LINE in the triangle
            if (key.startsWith('finished_')) {
                const playerIndex = tokens[0].playerIndex;
                this.renderFinishedTokensInLine(tokens, playerIndex);
                return;
            }

            tokens.forEach((token, index) => {
                const basePos = this.boardModel.getPosition(token.position, token.playerIndex);
                let x = basePos.x;
                let y = basePos.y;
                let scale = 1;

                // Apply offsets if multiple tokens are in the same cell
                // Calculate dynamic offset based on board size
                const cellSize = this.boardModel.size / 15;
                const dynamicOffset = cellSize * 0.22; // 22% of cell size

                if (count > 1) {
                    if (count === 2) {
                        scale = 0.6;
                        // Diagonal separation
                        const dir = index === 0 ? -1 : 1;
                        x += dir * dynamicOffset;
                        y += dir * dynamicOffset;
                    } else if (count === 3) {
                        scale = 0.5;
                        // Triangle
                        const angle = (index / 3) * Math.PI * 2 - Math.PI / 2;
                        x += Math.cos(angle) * dynamicOffset;
                        y += Math.sin(angle) * dynamicOffset;
                    } else if (count === 4) {
                        scale = 0.45;
                        // Square corners
                        const dx = (index % 2 === 0) ? -1 : 1;
                        const dy = (index < 2) ? -1 : 1;
                        x += dx * dynamicOffset;
                        y += dy * dynamicOffset;
                    } else {
                        // Circle for 5+
                        scale = 0.4;
                        const angle = (index / count) * Math.PI * 2;
                        x += Math.cos(angle) * dynamicOffset;
                        y += Math.sin(angle) * dynamicOffset;
                    }
                }

                const isHighlighted = this.highlightedTokens.has(token.id);
                const isSelected = this.selectedToken === token.id;

                this.drawTokenAt(x, y, token.playerColor, isHighlighted, isSelected, scale);
            });
        });
    }

    /**
     * Render finished tokens in a LINE inside the player's triangle
     * Token size is DYNAMIC based on how many are finished
     */
    private renderFinishedTokensInLine(tokens: Token[], playerIndex: number): void {
        const count = tokens.length;
        const center = this.boardModel.size / 2;
        const cellSize = this.boardModel.size / 17;

        // Dynamic token scale and spacing based on count
        let tokenScale: number;
        let spacing: number;

        switch (count) {
            case 1:
                tokenScale = 0.6;
                spacing = 0;
                break;
            case 2:
                tokenScale = 0.5;
                spacing = cellSize * 0.55;
                break;
            case 3:
                tokenScale = 0.45;
                spacing = cellSize * 0.5;
                break;
            case 4:
            default:
                tokenScale = 0.4;
                spacing = cellSize * 0.4;
                break;
        }

        // Calculate line start position based on player's triangle
        // Push them further out to avoid dice, but keep inside triangle (1.5)
        const centerOffset = cellSize * 1.2;

        let baseX = center;
        let baseY = center;
        let isHorizontal = false;

        switch (playerIndex) {
            case 0: // Red - left triangle, tokens in vertical line
                baseX = center - centerOffset;
                baseY = center - ((count - 1) * spacing) / 2;
                isHorizontal = false;
                break;
            case 1: // Green - top triangle, tokens in horizontal line
                baseX = center - ((count - 1) * spacing) / 2;
                baseY = center - centerOffset;
                isHorizontal = true;
                break;
            case 2: // Yellow - right triangle, tokens in vertical line
                baseX = center + centerOffset;
                baseY = center - ((count - 1) * spacing) / 2;
                isHorizontal = false;
                break;
            case 3: // Blue - bottom triangle, tokens in horizontal line
                baseX = center - ((count - 1) * spacing) / 2;
                baseY = center + centerOffset;
                isHorizontal = true;
                break;
        }

        tokens.forEach((token, index) => {
            let x = baseX;
            let y = baseY;

            if (isHorizontal) {
                x += index * spacing;
            } else {
                y += index * spacing;
            }

            this.drawTokenAt(x, y, token.playerColor, false, false, tokenScale);
        });
    }

    /**
     * Get the position where a finishing token should animate to
     * This matches the line layout used by renderFinishedTokensInLine
     */
    private getTriangleFinishPosition(playerIndex: number): { x: number; y: number } {
        const center = this.boardModel.size / 2;
        const cellSize = this.boardModel.size / 17;

        // Count how many tokens this player already has finished
        const finishedCount = this.tokenModel.getPlayerTokens(playerIndex)
            .filter(t => t.state === 'finished').length;

        // The new token will be at position 'finishedCount' in the line
        const index = finishedCount; // 0 for first finish, 1 for second, etc.
        const totalAfterThis = finishedCount + 1;

        // Calculate spacing based on what the count will be after this token finishes
        let spacing: number;
        switch (totalAfterThis) {
            case 1: spacing = 0; break;
            case 2: spacing = cellSize * 0.35; break;
            case 3: spacing = cellSize * 0.3; break;
            default: spacing = cellSize * 0.25; break;
        }

        const centerOffset = cellSize * 1.5;
        let baseX = center;
        let baseY = center;

        switch (playerIndex) {
            case 0: // Red - left, vertical line
                baseX = center - centerOffset;
                baseY = center - ((totalAfterThis - 1) * spacing) / 2 + index * spacing;
                break;
            case 1: // Green - top, horizontal line
                baseX = center - ((totalAfterThis - 1) * spacing) / 2 + index * spacing;
                baseY = center - centerOffset;
                break;
            case 2: // Yellow - right, vertical line
                baseX = center + centerOffset;
                baseY = center - ((totalAfterThis - 1) * spacing) / 2 + index * spacing;
                break;
            case 3: // Blue - bottom, horizontal line
                baseX = center - ((totalAfterThis - 1) * spacing) / 2 + index * spacing;
                baseY = center + centerOffset;
                break;
        }

        return { x: baseX, y: baseY };
    }

    private renderAnimatingToken(anim: AnimatingToken): void {
        if (anim.currentStep >= anim.path.length - 1) return;

        const t = anim.stepProgress;
        const easeT = anim.isCapture ? t : (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

        const fromPos = anim.path[anim.currentStep];
        const toPos = anim.path[anim.currentStep + 1];

        const x = fromPos.x + (toPos.x - fromPos.x) * easeT;
        const y = fromPos.y + (toPos.y - fromPos.y) * easeT;

        const hop = !anim.isCapture ? Math.sin(t * Math.PI) * 8 : 0;

        this.drawTokenAt(x, y - hop, anim.token.playerColor, false, false, 1.1);
    }

    private renderToken(token: Token): void {
        // Warning: This method is bypassed by the new render() logic for static tokens
        // Keeping it for potential single-token renders if needed, but primary logic is in render()
        const pos = this.boardModel.getPosition(token.position, token.playerIndex);
        const isHighlighted = this.highlightedTokens.has(token.id);
        const isSelected = this.selectedToken === token.id;

        this.drawTokenAt(pos.x, pos.y, token.playerColor, isHighlighted, isSelected);
    }

    private drawTokenAt(x: number, y: number, playerColor: PlayerColor, isHighlighted: boolean, isSelected: boolean, scale: number = 1): void {
        const colors = getPlayerColorsByName(playerColor);

        // Calculate dynamic radius based on board size (15 cells across)
        const cellSize = this.boardModel.size / 15;
        // Make token fill most of the cell (0.85 * half-cell-size)
        const baseRadius = (cellSize / 2) * 0.85;
        const radius = baseRadius * scale;

        // Selection/Highlight Glow (Draw BEHIND token)
        if (isHighlighted || isSelected) {
            const glowRadius = radius * 1.5;
            const glowGradient = this.ctx.createRadialGradient(x, y, radius, x, y, glowRadius);
            glowGradient.addColorStop(0, colors.glow);
            glowGradient.addColorStop(1, 'transparent');

            this.ctx.beginPath();
            this.ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
            this.ctx.fillStyle = glowGradient;
            this.ctx.globalAlpha = 0.6 + Math.sin(this.glowPhase) * 0.2;
            this.ctx.fill();
            this.ctx.globalAlpha = 1;
        }

        // 1. Drop Shadow
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        this.ctx.shadowBlur = 4 * scale;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 2 * scale;

        // 2. Outer Rim (White/Metallic Base)
        const rimGradient = this.ctx.createLinearGradient(
            x - radius, y - radius,
            x + radius, y + radius
        );
        rimGradient.addColorStop(0, '#FFFFFF');
        rimGradient.addColorStop(0.5, '#E8E8E8');
        rimGradient.addColorStop(1, '#B0B0B0');

        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = rimGradient;
        this.ctx.fill();

        // Reset Shadow for inner parts
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
        this.ctx.shadowOffsetY = 0;

        // 3. Inner Circle (Colored Button)
        const innerRadius = radius * 0.7; // 70% size for the inner color

        // Inner Shadow (to make the rim look raised around the color)
        // We simulate this by drawing a dark circle first, then the colored button slightly smaller
        this.ctx.beginPath();
        this.ctx.arc(x, y, innerRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(0,0,0,0.1)'; // Subtle socket shadow
        this.ctx.fill();

        // The Colored Button Body
        const buttonRadius = innerRadius * 0.95;
        const buttonGradient = this.ctx.createRadialGradient(
            x, y - buttonRadius * 0.4, 0,
            x, y, buttonRadius
        );
        buttonGradient.addColorStop(0, colors.light);     // Highlight top-center
        buttonGradient.addColorStop(0.4, colors.primary); // Main color
        buttonGradient.addColorStop(1, colors.dark);      // Shadow edges

        this.ctx.beginPath();
        this.ctx.arc(x, y, buttonRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = buttonGradient;
        this.ctx.fill();

        // 4. Glossy Highlight (Top Shine)
        this.ctx.beginPath();
        this.ctx.ellipse(x, y - buttonRadius * 0.4, buttonRadius * 0.6, buttonRadius * 0.3, 0, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.fill();

        // 5. Selection Indicators (Overlay)
        if (isSelected) {
            // White ring around the whole token to indicate selection
            this.ctx.beginPath();
            this.ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = 2.5;
            this.ctx.stroke();
        } else if (isHighlighted) {
            // Dashed ring for movable tokens
            this.ctx.beginPath();
            this.ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([4, 4]);
            this.ctx.lineDashOffset = -this.glowPhase * 10;
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }
    }

    hitTest(x: number, y: number): Token | null {
        const allTokens = this.tokenModel.getAllTokens();

        // Dynamic radius for hit testing
        const cellSize = this.boardModel.size / 15;
        const baseRadius = (cellSize / 2) * 0.85;

        // Build token positions with offsets (same logic as render)
        const tokenPositions: { token: Token; x: number; y: number; scale: number }[] = [];

        // Group tokens by position key (same as in render)
        const tokenGroups = new Map<string, Token[]>();

        allTokens.forEach(token => {
            // Skip animating tokens for hit test
            if (this.animatingTokens.has(token.id)) return;

            let key = '';
            if (token.position.type === 'main') {
                key = `main_${token.position.cellIndex}`;
            } else if (token.position.type === 'home-stretch') {
                key = `home_${token.playerIndex}_${token.position.cellIndex}`;
            } else if (token.position.type === 'finished') {
                key = `finished_${token.playerIndex}`;
            } else {
                key = `other_${token.id}`;
            }

            if (!tokenGroups.has(key)) tokenGroups.set(key, []);
            tokenGroups.get(key)!.push(token);
        });

        // Calculate positions with offsets
        tokenGroups.forEach((tokens) => {
            const count = tokens.length;
            tokens.sort((a, b) => a.id.localeCompare(b.id));

            tokens.forEach((token, index) => {
                const basePos = this.boardModel.getPosition(token.position, token.playerIndex);
                let tx = basePos.x;
                let ty = basePos.y;
                let scale = 1;

                if (count > 1) {
                    const cellSize = this.boardModel.size / 15;
                    const dynamicOffset = cellSize * 0.22;

                    if (count === 2) {
                        scale = 0.6;
                        const dir = index === 0 ? -1 : 1;
                        tx += dir * dynamicOffset;
                        ty += dir * dynamicOffset;
                    } else if (count === 3) {
                        scale = 0.5;
                        const angle = (index / 3) * Math.PI * 2 - Math.PI / 2;
                        tx += Math.cos(angle) * dynamicOffset;
                        ty += Math.sin(angle) * dynamicOffset;
                    } else if (count === 4) {
                        scale = 0.45;
                        const dx = (index % 2 === 0) ? -1 : 1;
                        const dy = (index < 2) ? -1 : 1;
                        tx += dx * dynamicOffset;
                        ty += dy * dynamicOffset;
                    } else {
                        scale = 0.4;
                        const angle = (index / count) * Math.PI * 2;
                        tx += Math.cos(angle) * dynamicOffset;
                        ty += Math.sin(angle) * dynamicOffset;
                    }
                }

                tokenPositions.push({ token, x: tx, y: ty, scale });
            });
        });

        // Check in reverse order (last added = top-most)
        for (let i = tokenPositions.length - 1; i >= 0; i--) {
            const { token, x: tx, y: ty, scale } = tokenPositions[i];
            const radius = baseRadius * scale;

            const dx = x - tx;
            const dy = y - ty;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= radius + 5) {
                return token;
            }
        }

        return null;
    }

    setHighlighted(tokenIds: string[]): void {
        this.highlightedTokens.clear();
        tokenIds.forEach((id) => this.highlightedTokens.add(id));
    }

    clearHighlights(): void {
        this.highlightedTokens.clear();
        this.selectedToken = null;
    }

    resize(newSize: number): void {
        this.size = newSize;
        this.setupHighDPI();
    }
}

export default TokenRenderer2D;
