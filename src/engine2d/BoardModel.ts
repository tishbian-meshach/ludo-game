/**
 * BoardModel - Ludo board logic and position mapping
 * 15x15 grid-based layout for proper Ludo board
 */

import { BOARD, PLAYER_ORDER, SIZES } from '../styles/theme';

export interface BoardPosition {
    x: number;
    y: number;
}

export interface CellInfo {
    index: number;
    type: 'main' | 'home-stretch' | 'spawn' | 'center';
    player?: number;
    isSafe: boolean;
    isStart: boolean;
    position: BoardPosition;
    gridRow: number;
    gridCol: number;
}

// Token position state
export type TokenPosition =
    | { type: 'spawn'; spawnIndex: number }
    | { type: 'main'; cellIndex: number }
    | { type: 'home-stretch'; cellIndex: number }
    | { type: 'finished' };

// Grid coordinates for the 52 main track cells (clockwise from red start)
const MAIN_TRACK_GRID: [number, number][] = [
    // Red section (left side going up) - cells 0-12
    [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], // Left row going right
    [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], // Going up
    [0, 7], // Top corner

    // Green section (top going right) - cells 13-25
    [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], // Going down
    [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], // Going right
    [7, 14], // Right corner

    // Yellow section (right going down) - cells 26-38
    [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], // Going left
    [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], // Going down
    [14, 7], // Bottom corner

    // Blue section (bottom going left) - cells 39-51
    [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], // Going up
    [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], // Going left
    [7, 0], // Left corner (connects back to cell 0)
];

// Home stretch coordinates for each player
const HOME_STRETCH_GRID: Record<number, [number, number][]> = {
    0: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]], // Red - left to center
    1: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]], // Green - top to center
    2: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]], // Yellow - right to center
    3: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]], // Blue - bottom to center
};

// Spawn positions (2x2 grid in each corner)
const SPAWN_GRID: Record<number, [number, number][]> = {
    0: [[2, 2], [2, 3], [3, 2], [3, 3]], // Red - top left
    1: [[2, 11], [2, 12], [3, 11], [3, 12]], // Green - top right
    2: [[11, 11], [11, 12], [12, 11], [12, 12]], // Yellow - bottom right
    3: [[11, 2], [11, 3], [12, 2], [12, 3]], // Blue - bottom left
};

export class BoardModel {
    private boardSize: number;
    private cellSize: number;
    private gridOffset: number;
    private cellPositions: Map<string, BoardPosition> = new Map();

    constructor(boardSize: number = 600) {
        this.boardSize = boardSize;
        this.cellSize = Math.floor(this.boardSize / 17);
        this.gridOffset = (this.boardSize - this.cellSize * 15) / 2;
        this.calculateAllPositions();
    }

    /**
     * Convert grid coordinates to pixel position
     */
    private gridToPixel(row: number, col: number): BoardPosition {
        return {
            x: this.gridOffset + col * this.cellSize + this.cellSize / 2,
            y: this.gridOffset + row * this.cellSize + this.cellSize / 2,
        };
    }

    /**
     * Pre-calculate all cell positions
     */
    private calculateAllPositions(): void {
        // Calculate main track positions (52 cells)
        for (let i = 0; i < BOARD.mainTrackLength; i++) {
            const [row, col] = MAIN_TRACK_GRID[i];
            const pos = this.gridToPixel(row, col);
            this.cellPositions.set(`main-${i}`, pos);
        }

        // Calculate home stretch positions for each player
        PLAYER_ORDER.forEach((_, playerIndex) => {
            const cells = HOME_STRETCH_GRID[playerIndex];
            for (let i = 0; i < cells.length; i++) {
                const [row, col] = cells[i];
                const pos = this.gridToPixel(row, col);
                this.cellPositions.set(`home-${playerIndex}-${i}`, pos);
            }
        });

        // Calculate spawn positions for each player - must match BoardCanvas.drawSpawnCircles
        const baseSize = this.cellSize * 6;
        const margin = this.gridOffset;

        const corners = [
            { x: margin, y: margin }, // Red - top left
            { x: this.boardSize - margin - baseSize, y: margin }, // Green - top right
            { x: this.boardSize - margin - baseSize, y: this.boardSize - margin - baseSize }, // Yellow - bottom right
            { x: margin, y: this.boardSize - margin - baseSize }, // Blue - bottom left
        ];

        PLAYER_ORDER.forEach((_, playerIndex) => {
            const corner = corners[playerIndex];
            const innerSize = baseSize * 0.65;
            const innerX = corner.x + (baseSize - innerSize) / 2;
            const innerY = corner.y + (baseSize - innerSize) / 2;
            const padding = innerSize * 0.28;

            const spawnPositions = [
                { x: innerX + padding, y: innerY + padding },
                { x: innerX + innerSize - padding, y: innerY + padding },
                { x: innerX + padding, y: innerY + innerSize - padding },
                { x: innerX + innerSize - padding, y: innerY + innerSize - padding },
            ];

            for (let i = 0; i < 4; i++) {
                this.cellPositions.set(`spawn-${playerIndex}-${i}`, spawnPositions[i]);
            }
        });
    }

    /**
     * Get position for a token
     */
    getPosition(tokenPosition: TokenPosition, playerIndex: number): BoardPosition {
        switch (tokenPosition.type) {
            case 'spawn':
                return this.cellPositions.get(`spawn-${playerIndex}-${tokenPosition.spawnIndex}`)
                    || { x: 0, y: 0 };

            case 'main':
                return this.cellPositions.get(`main-${tokenPosition.cellIndex}`)
                    || { x: 0, y: 0 };

            case 'home-stretch':
                return this.cellPositions.get(`home-${playerIndex}-${tokenPosition.cellIndex}`)
                    || { x: 0, y: 0 };

            case 'finished':
                // Place finished tokens in the player's triangle area
                // Triangles point toward center from each home stretch
                return this.getFinishedPosition(playerIndex);
        }
    }

    /**
     * Get the start position on main track for a player
     */
    getStartPosition(playerIndex: number): number {
        const color = PLAYER_ORDER[playerIndex];
        return BOARD.startPositions[color];
    }

    /**
     * Get the home entry position for a player
     */
    getHomeEntryPosition(playerIndex: number): number {
        const color = PLAYER_ORDER[playerIndex];
        return BOARD.homeEntryPositions[color];
    }

    /**
     * Get the finished position in the player's triangle
     * Tokens are placed INSIDE the colored triangle, not near the center
     */
    private getFinishedPosition(playerIndex: number): BoardPosition {
        // The triangles are the colored areas at the end of each home stretch
        // Position tokens deep inside the triangle, away from center
        const center = this.boardSize / 2;
        const triangleDepth = this.cellSize * 1.5; // How far into the triangle from center

        switch (playerIndex) {
            case 0: // Red - left triangle (pointing right toward center)
                return { x: center - triangleDepth, y: center };
            case 1: // Green - top triangle (pointing down toward center)
                return { x: center, y: center - triangleDepth };
            case 2: // Yellow - right triangle (pointing left toward center)
                return { x: center + triangleDepth, y: center };
            case 3: // Blue - bottom triangle (pointing up toward center)
                return { x: center, y: center + triangleDepth };
            default:
                return { x: center, y: center };
        }
    }

    /**
     * Check if a main track position is safe
     */
    isSafePosition(mainTrackIndex: number): boolean {
        return (BOARD.safePositions as readonly number[]).includes(mainTrackIndex);
    }

    /**
     * Check if a main track position is a player's start
     */
    isStartPosition(mainTrackIndex: number): boolean {
        return (Object.values(BOARD.startPositions) as number[]).includes(mainTrackIndex);
    }

    /**
     * Get cell info for rendering
     */
    getCellInfo(mainTrackIndex: number): CellInfo {
        const [row, col] = MAIN_TRACK_GRID[mainTrackIndex];
        return {
            index: mainTrackIndex,
            type: 'main',
            isSafe: this.isSafePosition(mainTrackIndex),
            isStart: this.isStartPosition(mainTrackIndex),
            position: this.cellPositions.get(`main-${mainTrackIndex}`) || { x: 0, y: 0 },
            gridRow: row,
            gridCol: col,
        };
    }

    /**
     * Get all main track cells
     */
    getAllMainTrackCells(): CellInfo[] {
        const cells: CellInfo[] = [];
        for (let i = 0; i < BOARD.mainTrackLength; i++) {
            cells.push(this.getCellInfo(i));
        }
        return cells;
    }

    /**
     * Get grid coordinates for a main track cell
     */
    getMainTrackGridCoords(index: number): [number, number] {
        return MAIN_TRACK_GRID[index];
    }

    /**
     * Get home stretch grid coordinates
     */
    getHomeStretchGridCoords(playerIndex: number): [number, number][] {
        return HOME_STRETCH_GRID[playerIndex];
    }

    /**
     * Get spawn grid coordinates
     */
    getSpawnGridCoords(playerIndex: number): [number, number][] {
        return SPAWN_GRID[playerIndex];
    }

    /**
     * Convert pixel position to grid cell
     */
    positionToCell(x: number, y: number): { type: string; index: number; player?: number } | null {
        const tolerance = this.cellSize * 0.6;

        // Check main track
        for (let i = 0; i < BOARD.mainTrackLength; i++) {
            const pos = this.cellPositions.get(`main-${i}`);
            if (pos && Math.abs(pos.x - x) < tolerance && Math.abs(pos.y - y) < tolerance) {
                return { type: 'main', index: i };
            }
        }

        // Check spawn positions
        for (let p = 0; p < 4; p++) {
            for (let t = 0; t < 4; t++) {
                const pos = this.cellPositions.get(`spawn-${p}-${t}`);
                if (pos && Math.abs(pos.x - x) < tolerance && Math.abs(pos.y - y) < tolerance) {
                    return { type: 'spawn', index: t, player: p };
                }
            }
        }

        return null;
    }

    get size(): number {
        return this.boardSize;
    }

    get cell(): number {
        return this.cellSize;
    }

    get offset(): number {
        return this.gridOffset;
    }
}

export default BoardModel;
