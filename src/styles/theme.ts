/**
 * Premium Ludo - Design System Theme
 * Dark, polished, mobile-game aesthetic
 */

export const COLORS = {
    // Player colors - Cyberpunk NEON theme
    players: {
        red: {
            primary: '#FF0055', // Neon Pink/Red
            light: '#FF3377',
            dark: '#990033',
            glow: 'rgba(255, 0, 85, 0.8)',
            bg: '#2A0015',
        },
        green: {
            primary: '#00FF99', // Neon Lime/Green
            light: '#33FFAA',
            dark: '#006633',
            glow: 'rgba(0, 255, 153, 0.8)',
            bg: '#002A15',
        },
        yellow: {
            primary: '#FFFF00', // Electric Yellow
            light: '#FFFF33',
            dark: '#999900',
            glow: 'rgba(255, 255, 0, 0.8)',
            bg: '#2A2A00',
        },
        blue: {
            primary: '#00CCFF', // Cyan/Electric Blue
            light: '#33DDFF',
            dark: '#006699',
            glow: 'rgba(0, 204, 255, 0.8)',
            bg: '#00152A',
        },
    },

    // Board colors - Cyberpunk dark grid
    board: {
        background: '#050510',
        backgroundGradientStart: '#0A0A1F',
        backgroundGradientEnd: '#000000',
        cell: '#111122',
        cellBorder: '#222244',
        cellHighlight: '#333366',
        safeZone: '#222244',
        path: '#0D0D1A',
        centerStar: '#FFFF00',
        homePath: '#0A0A15',
    },

    // UI colors
    ui: {
        text: '#E0E0FF',
        textSecondary: '#8888AA',
        textLight: '#AAAAFF',
        shadow: 'rgba(0, 0, 0, 0.8)',
        shadowDark: 'rgba(0, 0, 0, 0.9)',
        overlay: 'rgba(0, 0, 0, 0.85)',
        highlight: '#FFFFFF',
        button: '#FF0055',
        buttonHover: '#FF3377',
    },

    // Dice colors - bright digital look
    dice: {
        face: '#FFFFFF',
        dot: '#000000',
        shadow: 'rgba(0, 0, 0, 0.6)',
    },
} as const;

// Player order and mapping
export const PLAYER_ORDER = ['red', 'green', 'yellow', 'blue'] as const;
export type PlayerColor = (typeof PLAYER_ORDER)[number];

export const getPlayerColor = (playerIndex: number): PlayerColor => {
    return PLAYER_ORDER[playerIndex % 4];
};

export const getPlayerColors = (playerIndex: number) => {
    const color = getPlayerColor(playerIndex);
    return COLORS.players[color];
};

// Sizing
export const SIZES = {
    cell: 28, // Base cell size in pixels (smaller for grid)
    token: 28, // Token diameter (Increased for better visibility)
    tokenBorder: 2,
    cellRadius: 4, // Rounded corner radius
    cellGap: 2, // Gap between cells
    shadowBlur: 8,
    shadowOffset: 2,
} as const;

// Animation easing (GSAP compatible)
export const EASING = {
    // General
    default: 'power2.out',
    smooth: 'power2.inOut',

    // Dice
    diceAnticipation: 'power2.in',
    diceLaunch: 'power3.out',
    diceBounce: 'bounce.out',
    diceSettle: 'power4.out',

    // Token
    tokenLift: 'power2.out',
    tokenMove: 'power2.inOut',
    tokenLand: 'back.out(1.7)',
    tokenCapture: 'power3.in',

    // Camera
    cameraZoom: 'power2.inOut',
    cameraPan: 'power2.out',

    // UI
    buttonPress: 'power2.out',
    fadeIn: 'power2.out',
    fadeOut: 'power2.in',
} as const;

// Animation durations (in seconds)
export const DURATIONS = {
    // Dice
    diceAnticipation: 0.2,
    diceRoll: 0.8,
    diceBounce: 0.4,
    diceSettle: 0.2,
    diceTotal: 1.6,

    // Token
    tokenLift: 0.1,
    tokenMove: 0.4,
    tokenLand: 0.15,
    tokenCapture: 0.5,

    // Camera
    cameraZoom: 0.5,
    cameraPan: 0.3,

    // UI
    turnChange: 0.3,
    fadeIn: 0.3,
    fadeOut: 0.2,

    // Win
    winCelebration: 2.0,
} as const;

// Board layout constants
export const BOARD = {
    // Main track has 52 cells (13 per player quadrant)
    mainTrackLength: 52,

    // Home stretch has 6 cells per player
    homeStretchLength: 6,

    // Each player has 4 tokens
    tokensPerPlayer: 4,

    // Grid dimensions (15x15 for standard Ludo)
    gridSize: 15,

    // Starting positions for each player on main track
    startPositions: {
        red: 1,
        green: 14,
        yellow: 27,
        blue: 40,
    },

    // Entry to home stretch positions
    homeEntryPositions: {
        red: 51,
        green: 12,
        yellow: 25,
        blue: 38,
    },

    // Safe zone positions (star cells)
    safePositions: [1, 9, 14, 22, 27, 35, 40, 48],
} as const;

// Z-index layers for 3D scene
export const LAYERS = {
    board: 0,
    token2D: 1,
    shadow: 2,
    token3D: 3,
    dice: 4,
    effects: 5,
    ui: 10,
} as const;

export default {
    COLORS,
    SIZES,
    EASING,
    DURATIONS,
    BOARD,
    LAYERS,
    PLAYER_ORDER,
    getPlayerColor,
    getPlayerColors,
};
