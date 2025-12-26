/**
 * ThreeScene - Three.js scene setup and management
 * Transparent overlay for 3D animations on top of 2D board
 */

import * as THREE from 'three';
import { COLORS, LAYERS } from '../styles/theme';

export class ThreeScene {
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private canvas: HTMLCanvasElement;
    private size: number;

    // Lighting
    private ambientLight: THREE.AmbientLight;
    private directionalLight: THREE.DirectionalLight;
    private fillLight: THREE.DirectionalLight;

    // Animation loop
    private animationId: number | null = null;
    private lastTime: number = 0;
    private onUpdate: ((deltaTime: number) => void) | null = null;

    constructor(canvas: HTMLCanvasElement, size: number) {
        this.canvas = canvas;
        this.size = size;

        // Setup renderer with transparency
        this.renderer = new THREE.WebGLRenderer({
            canvas,
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance',
        });

        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(size, size);
        this.renderer.setClearColor(0x000000, 0); // Transparent background
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        // Create scene
        this.scene = new THREE.Scene();

        // Create camera - TOP DOWN view to match 2D board
        const aspect = 1;
        this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
        // Position camera directly above center, looking straight down
        this.camera.position.set(0, size * 0.9, 0);
        this.camera.lookAt(0, 0, 0);
        // Rotate to align properly
        this.camera.up.set(0, 0, -1);

        // Setup lighting
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(this.ambientLight);

        // Main directional light (from above)
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.directionalLight.position.set(0, size, 0);
        this.directionalLight.castShadow = true;
        this.directionalLight.shadow.mapSize.width = 1024;
        this.directionalLight.shadow.mapSize.height = 1024;
        this.directionalLight.shadow.camera.near = 0.1;
        this.directionalLight.shadow.camera.far = size * 2;
        this.directionalLight.shadow.camera.left = -size / 2;
        this.directionalLight.shadow.camera.right = size / 2;
        this.directionalLight.shadow.camera.top = size / 2;
        this.directionalLight.shadow.camera.bottom = -size / 2;
        this.directionalLight.shadow.bias = -0.001;
        this.scene.add(this.directionalLight);

        // Fill light (slight angle for depth)
        this.fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        this.fillLight.position.set(size * 0.3, size * 0.5, size * 0.3);
        this.scene.add(this.fillLight);

        // Ground plane for shadows (invisible but receives shadows)
        const groundGeometry = new THREE.PlaneGeometry(size * 2, size * 2);
        const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.15 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -1;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    /**
     * Add object to scene
     */
    add(object: THREE.Object3D): void {
        this.scene.add(object);
    }

    /**
     * Remove object from scene
     */
    remove(object: THREE.Object3D): void {
        this.scene.remove(object);
    }

    /**
     * Get the scene
     */
    getScene(): THREE.Scene {
        return this.scene;
    }

    /**
     * Get the camera
     */
    getCamera(): THREE.PerspectiveCamera {
        return this.camera;
    }

    /**
     * Get the renderer
     */
    getRenderer(): THREE.WebGLRenderer {
        return this.renderer;
    }

    /**
     * Convert 2D board position to 3D world position
     */
    boardToWorld(x: number, y: number, z: number = 0): THREE.Vector3 {
        // Center the board at origin
        const halfSize = this.size / 2;
        return new THREE.Vector3(
            x - halfSize,
            z,
            y - halfSize
        );
    }

    /**
     * Convert 3D world position to 2D board position
     */
    worldToBoard(position: THREE.Vector3): { x: number; y: number } {
        const halfSize = this.size / 2;
        return {
            x: position.x + halfSize,
            y: position.z + halfSize,
        };
    }

    /**
     * Set update callback
     */
    setUpdateCallback(callback: (deltaTime: number) => void): void {
        this.onUpdate = callback;
    }

    /**
     * Start animation loop
     */
    start(): void {
        if (this.animationId !== null) return;

        this.lastTime = performance.now();

        const animate = (time: number) => {
            const deltaTime = (time - this.lastTime) / 1000;
            this.lastTime = time;

            if (this.onUpdate) {
                this.onUpdate(deltaTime);
            }

            this.renderer.render(this.scene, this.camera);
            this.animationId = requestAnimationFrame(animate);
        };

        this.animationId = requestAnimationFrame(animate);
    }

    /**
     * Stop animation loop
     */
    stop(): void {
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * Render a single frame
     */
    render(): void {
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Resize the scene
     */
    resize(newSize: number): void {
        this.size = newSize;
        this.renderer.setSize(newSize, newSize);
        this.camera.aspect = 1;
        this.camera.updateProjectionMatrix();
    }

    /**
     * Update camera position
     */
    setCameraPosition(x: number, y: number, z: number): void {
        this.camera.position.set(x, y, z);
    }

    /**
     * Look at a point
     */
    lookAt(x: number, y: number, z: number): void {
        this.camera.lookAt(x, y, z);
    }

    /**
     * Get board size
     */
    getSize(): number {
        return this.size;
    }

    /**
     * Dispose of all resources
     */
    dispose(): void {
        this.stop();

        this.scene.traverse((object) => {
            if (object instanceof THREE.Mesh) {
                object.geometry.dispose();
                if (object.material instanceof THREE.Material) {
                    object.material.dispose();
                } else if (Array.isArray(object.material)) {
                    object.material.forEach((m) => m.dispose());
                }
            }
        });

        this.renderer.dispose();
    }
}

export default ThreeScene;
