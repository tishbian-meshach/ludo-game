/**
 * Premium Ludo - Main Entry Point
 * Bootstraps the game with 2D board, 3D animations, and UI
 */

// Engine imports
import { GameState } from './engine2d/GameState';
import { BoardModel } from './engine2d/BoardModel';
import { eventBus } from './engine2d/EventBus';

// 2D Renderer imports
import { BoardCanvas } from './renderer2d/BoardCanvas';
import { TokenRenderer2D } from './renderer2d/TokenRenderer2D';
import { InputHandler } from './renderer2d/InputHandler';

// 3D Renderer imports
import { ThreeScene } from './renderer3d/ThreeScene';
import { Dice3D } from './renderer3d/Dice3D';
import { Token3D } from './renderer3d/Token3D';
import { CameraController } from './renderer3d/CameraController';
import { Effects } from './renderer3d/Effects';

// UI imports
import { HUD } from './ui/HUD';
import { DebugPanel } from './ui/DebugPanel';

// Debug imports
import { setupDebugConsole } from './debug/DebugConsole';

class LudoGame {
    // Canvas elements
    private canvasBoard!: HTMLCanvasElement;
    private canvasTokens!: HTMLCanvasElement;
    private canvas3D!: HTMLCanvasElement;
    private canvasUI!: HTMLCanvasElement;
    private container!: HTMLElement;

    // Game state
    private gameState!: GameState;
    private boardModel!: BoardModel;

    // 2D Renderers
    private boardCanvas!: BoardCanvas;
    private tokenRenderer!: TokenRenderer2D;
    private inputHandler!: InputHandler;

    // 3D Renderers
    private threeScene!: ThreeScene;
    private dice3D!: Dice3D;
    private token3D!: Token3D;
    private cameraController!: CameraController;
    private effects!: Effects;

    // UI
    private hud!: HUD;
    private debugPanel!: DebugPanel;

    // Game loop
    private lastTime: number = 0;
    private isRunning: boolean = false;

    // Board size (responsive)
    private boardSize: number = 600;

    constructor() {
        this.init();
    }

    /**
     * Initialize the game
     */
    private async init(): Promise<void> {
        // Get canvas elements
        this.container = document.getElementById('game-container')!;
        this.canvasBoard = document.getElementById('canvas-board') as HTMLCanvasElement;
        this.canvasTokens = document.getElementById('canvas-tokens') as HTMLCanvasElement;
        this.canvas3D = document.getElementById('canvas-3d') as HTMLCanvasElement;
        this.canvasUI = document.getElementById('ui-canvas') as HTMLCanvasElement;

        // Calculate responsive board size
        this.calculateBoardSize();

        // Set canvas sizes
        [this.canvasBoard, this.canvasTokens, this.canvas3D, this.canvasUI].forEach((canvas) => {
            canvas.style.width = `${this.boardSize}px`;
            canvas.style.height = `${this.boardSize}px`;
        });

        // Initialize game state
        this.boardModel = new BoardModel(this.boardSize);
        this.gameState = new GameState(this.boardSize);

        // Initialize 2D renderers - use SEPARATE canvases
        this.boardCanvas = new BoardCanvas(this.canvasBoard, this.boardModel);
        this.tokenRenderer = new TokenRenderer2D(
            this.canvasTokens,
            this.gameState.getTokens(),
            this.boardModel
        );
        this.inputHandler = new InputHandler(
            this.canvasTokens,
            this.gameState,
            this.tokenRenderer,
            this.boardModel
        );

        // Initialize 3D renderers
        this.threeScene = new ThreeScene(this.canvas3D, this.boardSize);
        this.dice3D = new Dice3D(this.threeScene);
        this.token3D = new Token3D(this.threeScene, this.boardModel);
        this.cameraController = new CameraController(this.threeScene);
        this.effects = new Effects(this.threeScene);

        // Initialize UI
        this.hud = new HUD(this.canvasUI, this.gameState, this.boardSize);
        // Pass container for correct positioning
        this.debugPanel = new DebugPanel(this.gameState.getDice(), this.container);

        // Setup resize handler
        window.addEventListener('resize', this.handleResize.bind(this));

        // Hide loading
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.add('hidden');
            setTimeout(() => loading.remove(), 500);
        }

        // Start game
        this.startGame();

        // Setup debug console (development only)
        setupDebugConsole(this.gameState);
    }

    /**
     * Calculate responsive board size
     */
    private calculateBoardSize(): void {
        const padding = 20;
        const maxSize = 700;
        const viewportSize = Math.min(window.innerWidth, window.innerHeight) - padding * 2;
        this.boardSize = Math.min(viewportSize, maxSize);
    }

    /**
     * Handle window resize
     */
    private handleResize(): void {
        this.calculateBoardSize();

        // Resize all components
        this.boardModel.resize(this.boardSize);
        this.boardCanvas.resize(this.boardSize);
        this.tokenRenderer.resize(this.boardSize);
        this.threeScene.resize(this.boardSize);
        this.dice3D.resize(this.boardSize);
        this.hud.resize(this.boardSize);

        // Re-render static board
        this.boardCanvas.render();
    }

    /**
     * Start the game
     */
    private startGame(): void {
        // Start with menu or directly into game
        // For MVP, start 4-player game directly
        this.gameState.startGame({ playerCount: 4 });

        // Start game loop
        this.isRunning = true;
        this.lastTime = performance.now();
        this.gameLoop();
    }

    /**
     * Main game loop
     */
    private gameLoop(): void {
        if (!this.isRunning) return;

        const now = performance.now();
        const deltaTime = (now - this.lastTime) / 1000;
        this.lastTime = now;

        // Update
        this.update(deltaTime);

        // Render
        this.render(deltaTime);

        // Next frame
        requestAnimationFrame(() => this.gameLoop());
    }

    /**
     * Update game state
     */
    private update(deltaTime: number): void {
        // Update effects
        this.effects.update(deltaTime);

        // Update HUD
        this.hud.update(deltaTime);
    }

    /**
     * Render all layers
     */
    private render(deltaTime: number): void {
        // 1. Render 2D board (static, cached)
        this.boardCanvas.render();

        // 2. Render 2D tokens
        this.tokenRenderer.render(deltaTime);

        // 3. Render 3D scene (dice, token animations)
        this.threeScene.render();

        // 4. Render UI overlay
        this.hud.render();
    }

    /**
     * Pause the game
     */
    pause(): void {
        this.isRunning = false;
        this.gameState.pause();
    }

    /**
     * Resume the game
     */
    resume(): void {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        this.gameState.resume();
        this.gameLoop();
    }

    /**
     * Reset the game
     */
    reset(): void {
        this.gameState.reset();
        this.startGame();
    }

    /**
     * Cleanup
     */
    destroy(): void {
        this.isRunning = false;
        this.inputHandler.destroy();
        this.threeScene.dispose();
        this.dice3D.dispose();
        this.token3D.dispose();
        this.effects.dispose();
        this.debugPanel.destroy();
        eventBus.clear();
    }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const game = new LudoGame();

    // Expose to window for debugging
    (window as any).ludoGame = game;
});

export { LudoGame };
