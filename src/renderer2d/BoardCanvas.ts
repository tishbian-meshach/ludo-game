/**
 * BoardCanvas - Premium 2D Ludo board renderer
 * Dark theme with visible grid paths
 */

import { BoardModel } from '../engine2d/BoardModel';
import { COLORS, SIZES, BOARD, PLAYER_ORDER, getPlayerColors } from '../styles/theme';

export class BoardCanvas {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private boardModel: BoardModel;
    private size: number;
    private scale: number = 1;
    private cellSize: number;
    private gridOffset: number;

    private staticBoardCanvas: HTMLCanvasElement | null = null;

    constructor(canvas: HTMLCanvasElement, boardModel: BoardModel) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.boardModel = boardModel;
        this.size = boardModel.size;
        this.cellSize = boardModel.cell;
        this.gridOffset = boardModel.offset;

        this.setupHighDPI();
        this.renderStaticBoard();
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

    private renderStaticBoard(): void {
        this.staticBoardCanvas = document.createElement('canvas');
        this.staticBoardCanvas.width = this.canvas.width;
        this.staticBoardCanvas.height = this.canvas.height;

        const ctx = this.staticBoardCanvas.getContext('2d')!;
        ctx.scale(this.scale, this.scale);

        this.drawBackground(ctx);
        this.drawCrossPath(ctx); // Draw grid first
        this.drawHomeBases(ctx); // Draw bases ON TOP to cover grid overlap
        this.drawHomeStretches(ctx);
        this.drawCenterHome(ctx);
    }

    private drawBackground(ctx: CanvasRenderingContext2D): void {
        const gradient = ctx.createRadialGradient(
            this.size / 2, this.size / 2, 0,
            this.size / 2, this.size / 2, this.size * 0.7
        );
        gradient.addColorStop(0, COLORS.board.backgroundGradientStart);
        gradient.addColorStop(1, COLORS.board.backgroundGradientEnd);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.size, this.size);
    }

    private drawHomeBases(ctx: CanvasRenderingContext2D): void {
        const baseSize = this.cellSize * 6;
        const margin = this.gridOffset;
        const cornerRadius = 0; // Square corners

        const corners = [
            { x: margin, y: margin, playerIndex: 0 },
            { x: this.size - margin - baseSize, y: margin, playerIndex: 1 },
            { x: this.size - margin - baseSize, y: this.size - margin - baseSize, playerIndex: 2 },
            { x: margin, y: this.size - margin - baseSize, playerIndex: 3 },
        ];

        corners.forEach((corner) => {
            const colors = getPlayerColors(corner.playerIndex);

            // Base background
            ctx.beginPath();
            ctx.roundRect(corner.x, corner.y, baseSize, baseSize, cornerRadius);
            ctx.fillStyle = colors.bg;
            ctx.fill();
            // Use darker border so it doesn't compete with HUD's active player highlight
            ctx.strokeStyle = colors.dark;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Inner circle area
            const innerSize = baseSize * 0.65;
            const innerX = corner.x + (baseSize - innerSize) / 2;
            const innerY = corner.y + (baseSize - innerSize) / 2;

            ctx.beginPath();
            ctx.roundRect(innerX, innerY, innerSize, innerSize, 0); // Square inner area
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fill();
            ctx.strokeStyle = colors.dark;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Spawn circles
            this.drawSpawnCircles(ctx, corner.playerIndex, colors, innerX, innerY, innerSize);
        });
    }

    private drawSpawnCircles(
        ctx: CanvasRenderingContext2D,
        playerIndex: number,
        colors: ReturnType<typeof getPlayerColors>,
        innerX: number,
        innerY: number,
        innerSize: number
    ): void {
        // Increased radius for bigger tokens (cyberpunk bold look)
        const circleRadius = innerSize * 0.22;
        const padding = innerSize * 0.28;

        const positions = [
            { cx: innerX + padding, cy: innerY + padding },
            { cx: innerX + innerSize - padding, cy: innerY + padding },
            { cx: innerX + padding, cy: innerY + innerSize - padding },
            { cx: innerX + innerSize - padding, cy: innerY + innerSize - padding },
        ];

        positions.forEach((pos) => {
            // Draw empty ring/slot where token can sit
            ctx.beginPath();
            ctx.arc(pos.cx, pos.cy, circleRadius, 0, Math.PI * 2);

            // Dark fill for slot
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fill();

            // Subtle ring (not bright, so it doesn't compete with HUD highlight)
            ctx.strokeStyle = colors.dark;
            ctx.lineWidth = 2;
            ctx.stroke();
        });
    }

    /**
     * Draw the cross-shaped path using explicit grid coordinates
     */
    private drawCrossPath(ctx: CanvasRenderingContext2D): void {
        const cs = this.cellSize;
        const offset = this.gridOffset;
        const gap = 0; // No gaps between cells

        // Helper to draw a single cell
        const drawCell = (row: number, col: number, color: string = COLORS.board.cell, borderColor: string = COLORS.board.cellBorder, isSafe: boolean = false) => {
            const x = offset + col * cs + gap / 2;
            const y = offset + row * cs + gap / 2;
            const w = cs - gap;
            const h = cs - gap;

            // Cell background
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, 0); // Square cells (no rounding)
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 1;
            ctx.stroke();

            // Safe zone marker (star)
            if (isSafe) {
                ctx.shadowColor = COLORS.board.centerStar;
                ctx.shadowBlur = 10;
                this.drawStar(ctx, x + w / 2, y + h / 2, 6, 5, 0.5, COLORS.board.centerStar);
                ctx.shadowBlur = 0;
            }
        };

        // Standard Ludo safe positions (8 safe cells: start positions + 4 additional)
        // Safe cells are at start positions and every 8-9 cells along the track
        const safePositionGrids = new Set([
            // Start position safe cells
            '6,1',   // Red start
            '1,8',   // Green start  
            '8,13',  // Yellow start
            '13,6',  // Blue start
            // Additional safe cells (one in each arm, near the center)
            '2,6',   // Top arm
            '6,12',  // Right arm
            '12,8',  // Bottom arm
            '8,2',   // Left arm
        ]);

        // Start positions for each player [row, col, playerIndex]
        const startPositions: [number, number, number][] = [
            [6, 1, 0],   // Red
            [1, 8, 1],   // Green
            [8, 13, 2],  // Yellow
            [13, 6, 3],  // Blue
        ];

        const startSet = new Map<string, number>();
        startPositions.forEach(([r, c, p]) => startSet.set(`${r},${c}`, p));

        // Draw TOP arm (rows 0-5, cols 6-8) - ALL 3 columns
        for (let row = 0; row <= 5; row++) {
            for (let col = 6; col <= 8; col++) {
                if (col === 7) continue; // Home stretch column (drawn separately)
                const key = `${row},${col}`;
                const isSafe = safePositionGrids.has(key);
                const playerStart = startSet.get(key);

                if (playerStart !== undefined) {
                    const colors = getPlayerColors(playerStart);
                    drawCell(row, col, colors.primary, colors.light, false); // Full opacity start cell
                } else {
                    drawCell(row, col, COLORS.board.cell, COLORS.board.cellBorder, isSafe);
                }
            }
        }

        // Draw BOTTOM arm (rows 9-14, cols 6-8) - ALL 3 columns
        for (let row = 9; row <= 14; row++) {
            for (let col = 6; col <= 8; col++) {
                if (col === 7) continue; // Home stretch column
                const key = `${row},${col}`;
                const isSafe = safePositionGrids.has(key);
                const playerStart = startSet.get(key);

                if (playerStart !== undefined) {
                    const colors = getPlayerColors(playerStart);
                    drawCell(row, col, colors.primary, colors.light, false); // Full opacity start cell
                } else {
                    drawCell(row, col, COLORS.board.cell, COLORS.board.cellBorder, isSafe);
                }
            }
        }

        // Draw LEFT arm (rows 6-8, cols 0-5) - ALL 3 rows
        for (let row = 6; row <= 8; row++) {
            for (let col = 0; col <= 5; col++) {
                if (row === 7) continue; // Home stretch row
                const key = `${row},${col}`;
                const isSafe = safePositionGrids.has(key);
                const playerStart = startSet.get(key);

                if (playerStart !== undefined) {
                    const colors = getPlayerColors(playerStart);
                    drawCell(row, col, colors.primary, colors.light, false); // Full opacity start cell
                } else {
                    drawCell(row, col, COLORS.board.cell, COLORS.board.cellBorder, isSafe);
                }
            }
        }

        // Draw RIGHT arm (rows 6-8, cols 9-14) - ALL 3 rows
        for (let row = 6; row <= 8; row++) {
            for (let col = 9; col <= 14; col++) {
                if (row === 7) continue; // Home stretch row
                const key = `${row},${col}`;
                const isSafe = safePositionGrids.has(key);
                const playerStart = startSet.get(key);

                if (playerStart !== undefined) {
                    const colors = getPlayerColors(playerStart);
                    drawCell(row, col, colors.primary, colors.light, false); // Full opacity start cell
                } else {
                    drawCell(row, col, COLORS.board.cell, COLORS.board.cellBorder, isSafe);
                }
            }
        }

        // Draw junction/corner cells (the 4 corners where arms meet center)
        // These are at positions (6,6), (6,8), (8,6), (8,8)
        const junctionCells = [
            [6, 6], [6, 8], [8, 6], [8, 8]
        ];
        junctionCells.forEach(([row, col]) => {
            drawCell(row, col, COLORS.board.cell, COLORS.board.cellBorder, false);
        });

        // Draw the 4 tip cells at the ends of the cross
        // (0, 7), (7, 0), (7, 14), (14, 7)
        const tipCells = [
            [0, 7], [7, 0], [7, 14], [14, 7]
        ];
        tipCells.forEach(([row, col]) => {
            drawCell(row, col, COLORS.board.cell, COLORS.board.cellBorder, false);
        });
    }

    private drawHomeStretches(ctx: CanvasRenderingContext2D): void {
        const cs = this.cellSize;
        const offset = this.gridOffset;
        const gap = 0; // No gaps between cells

        // Home stretches - colored paths to center
        const homeStretches: { playerIndex: number; cells: [number, number][] }[] = [
            { playerIndex: 0, cells: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]] }, // Red
            { playerIndex: 1, cells: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]] }, // Green
            { playerIndex: 2, cells: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]] }, // Yellow
            { playerIndex: 3, cells: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]] }, // Blue
        ];

        homeStretches.forEach(({ playerIndex, cells }) => {
            const colors = getPlayerColors(playerIndex);

            cells.forEach(([row, col], index) => {
                const x = offset + col * cs + gap / 2;
                const y = offset + row * cs + gap / 2;
                const w = cs - gap;
                const h = cs - gap;

                // Gradient intensity based on position
                const intensity = 0.5 + (index / cells.length) * 0.3;

                ctx.beginPath();
                ctx.roundRect(x, y, w, h, 0); // Square cells
                ctx.fillStyle = colors.dark;
                ctx.globalAlpha = intensity;
                ctx.fill();
                ctx.globalAlpha = 1;
                ctx.strokeStyle = colors.primary;
                ctx.lineWidth = 1;
                ctx.stroke();
            });
        });
    }

    private drawCenterHome(ctx: CanvasRenderingContext2D): void {
        const cs = this.cellSize;
        const off = this.gridOffset;

        // Coordinates for the 3x3 central square
        // The central area spans from col 6 to 9, and row 6 to 9
        const left = off + 6 * cs;
        const right = off + 9 * cs;
        const top = off + 6 * cs;
        const bottom = off + 9 * cs;
        const cx = off + 7.5 * cs;
        const cy = off + 7.5 * cs;

        // Draw opaque background to hide grid lines
        ctx.fillStyle = '#000000';
        ctx.fillRect(left, top, right - left, bottom - top);

        // Define the 4 triangles
        // Red (0): Left Arm -> Left Triangle
        const drawTriangle = (p1: { x: number, y: number }, p2: { x: number, y: number }, color: string) => {
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
            // Stroke to clean up edges
            ctx.strokeStyle = color; // Blend with fill
            ctx.lineWidth = 1;
            ctx.stroke();
        };

        // Red (Left)
        drawTriangle({ x: left, y: top }, { x: left, y: bottom }, COLORS.players[PLAYER_ORDER[0]].primary);

        // Green (Top)
        drawTriangle({ x: left, y: top }, { x: right, y: top }, COLORS.players[PLAYER_ORDER[1]].primary);

        // Yellow (Right)
        drawTriangle({ x: right, y: top }, { x: right, y: bottom }, COLORS.players[PLAYER_ORDER[2]].primary);

        // Blue (Bottom)
        drawTriangle({ x: left, y: bottom }, { x: right, y: bottom }, COLORS.players[PLAYER_ORDER[3]].primary);

        // Diagonal borders between triangles
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(left, top);
        ctx.lineTo(right, bottom);
        ctx.moveTo(right, top);
        ctx.lineTo(left, bottom);
        ctx.stroke();

        // Center circle (home/finish)
        const centerSize = cs * 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, centerSize * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#1A1A2E'; // Dark center
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Cyberpunk logo/star in center
        ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
        ctx.shadowBlur = 10;
        this.drawStar(ctx, cx, cy, centerSize * 0.25, 4, 0.4, '#FFFFFF');
        ctx.shadowBlur = 0;
    }

    private drawStar(
        ctx: CanvasRenderingContext2D,
        cx: number, cy: number,
        outerRadius: number, points: number,
        innerRatio: number, color: string
    ): void {
        const innerRadius = outerRadius * innerRatio;

        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI) / points - Math.PI / 2;
            const x = cx + Math.cos(angle) * radius;
            const y = cy + Math.sin(angle) * radius;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    }

    render(): void {
        this.ctx.clearRect(0, 0, this.size, this.size);

        if (this.staticBoardCanvas) {
            this.ctx.drawImage(
                this.staticBoardCanvas,
                0, 0, this.canvas.width, this.canvas.height,
                0, 0, this.size, this.size
            );
        }
    }

    getCanvas(): HTMLCanvasElement {
        return this.canvas;
    }

    getSize(): number {
        return this.size;
    }

    getCellSize(): number {
        return this.cellSize;
    }

    getGridOffset(): number {
        return this.gridOffset;
    }

    resize(newSize: number): void {
        this.size = newSize;
        this.cellSize = Math.floor(this.size / 17);
        this.gridOffset = (this.size - this.cellSize * 15) / 2;
        this.setupHighDPI();
        this.renderStaticBoard();
    }
}

export default BoardCanvas;
