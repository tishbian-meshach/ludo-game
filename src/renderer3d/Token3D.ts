/**
 * Token3D - 3D token for movement animations
 * Object pooling for performance, curved path movement
 */

import * as THREE from 'three';
import gsap from 'gsap';
import { ThreeScene } from './ThreeScene';
import { BoardModel } from '../engine2d/BoardModel';
import { eventBus } from '../engine2d/EventBus';
import { COLORS, DURATIONS, EASING, getPlayerColors, PLAYER_ORDER } from '../styles/theme';

interface Token3DInstance {
    mesh: THREE.Group;
    isActive: boolean;
    playerId: number;
}

export class Token3D {
    private threeScene: ThreeScene;
    private boardModel: BoardModel;
    private pool: Token3DInstance[] = [];
    private activeTokens: Map<string, Token3DInstance> = new Map();

    private tokenGeometry: THREE.BufferGeometry;
    private tokenMaterials: Map<number, THREE.MeshStandardMaterial> = new Map();

    private poolSize: number = 16; // Max 4 players x 4 tokens

    constructor(threeScene: ThreeScene, boardModel: BoardModel) {
        this.threeScene = threeScene;
        this.boardModel = boardModel;

        // Create shared geometry - pawn-like shape
        this.tokenGeometry = this.createTokenGeometry();

        // Create materials for each player color
        PLAYER_ORDER.forEach((color, index) => {
            const colors = COLORS.players[color];
            const material = new THREE.MeshStandardMaterial({
                color: new THREE.Color(colors.primary),
                roughness: 0.3,
                metalness: 0.1,
            });
            this.tokenMaterials.set(index, material);
        });

        // Initialize pool
        this.initializePool();
        this.setupEventListeners();
    }

    /**
     * Create pawn-like token geometry
     */
    private createTokenGeometry(): THREE.BufferGeometry {
        const group = new THREE.Group();

        // Base cylinder
        const baseGeometry = new THREE.CylinderGeometry(12, 14, 6, 24);

        // Body sphere
        const bodyGeometry = new THREE.SphereGeometry(10, 24, 16);

        // Top sphere (head)
        const headGeometry = new THREE.SphereGeometry(7, 24, 16);

        // Merge geometries
        const mergedGeometry = new THREE.BufferGeometry();

        // For simplicity, we'll use a single sphere for now
        // A more complex pawn would use BufferGeometryUtils.mergeBufferGeometries
        return new THREE.SphereGeometry(15, 32, 24);
    }

    /**
     * Initialize object pool
     */
    private initializePool(): void {
        for (let i = 0; i < this.poolSize; i++) {
            const mesh = this.createTokenMesh(0);
            mesh.visible = false;
            this.threeScene.add(mesh);

            this.pool.push({
                mesh,
                isActive: false,
                playerId: 0,
            });
        }
    }

    /**
     * Create a single token mesh
     */
    private createTokenMesh(playerId: number): THREE.Group {
        const group = new THREE.Group();

        // Base
        const baseGeometry = new THREE.CylinderGeometry(12, 14, 6, 24);
        const baseMesh = new THREE.Mesh(baseGeometry, this.tokenMaterials.get(playerId)!.clone());
        baseMesh.position.y = 3;
        baseMesh.castShadow = true;
        group.add(baseMesh);

        // Body
        const bodyGeometry = new THREE.SphereGeometry(10, 24, 16);
        const bodyMesh = new THREE.Mesh(bodyGeometry, this.tokenMaterials.get(playerId)!.clone());
        bodyMesh.position.y = 14;
        bodyMesh.castShadow = true;
        group.add(bodyMesh);

        // Neck
        const neckGeometry = new THREE.CylinderGeometry(5, 8, 8, 16);
        const neckMesh = new THREE.Mesh(neckGeometry, this.tokenMaterials.get(playerId)!.clone());
        neckMesh.position.y = 24;
        neckMesh.castShadow = true;
        group.add(neckMesh);

        // Head
        const headGeometry = new THREE.SphereGeometry(7, 24, 16);
        const headMesh = new THREE.Mesh(headGeometry, this.tokenMaterials.get(playerId)!.clone());
        headMesh.position.y = 32;
        headMesh.castShadow = true;
        group.add(headMesh);

        group.scale.setScalar(0.5); // Scale down to fit board

        return group;
    }

    /**
     * Get a token from the pool
     */
    private acquireToken(tokenId: string, playerId: number): Token3DInstance | null {
        // Check if already active
        if (this.activeTokens.has(tokenId)) {
            return this.activeTokens.get(tokenId)!;
        }

        // Find available token in pool
        let instance = this.pool.find((t) => !t.isActive);

        if (!instance) {
            console.warn('Token pool exhausted');
            return null;
        }

        // Update material color
        const colors = getPlayerColors(playerId);
        instance.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                const material = child.material as THREE.MeshStandardMaterial;
                material.color.set(colors.primary);
            }
        });

        instance.isActive = true;
        instance.playerId = playerId;
        instance.mesh.visible = true;

        this.activeTokens.set(tokenId, instance);

        return instance;
    }

    /**
     * Release a token back to pool
     */
    private releaseToken(tokenId: string): void {
        const instance = this.activeTokens.get(tokenId);
        if (instance) {
            instance.isActive = false;
            instance.mesh.visible = false;
            this.activeTokens.delete(tokenId);
        }
    }

    /**
     * Setup event listeners - disabled for simple movement
     */
    private setupEventListeners(): void {
        // 3D token animations disabled - using 2D only
    }

    /**
     * Animate token entering the board
     */
    private animateEnterBoard(tokenId: string, position: number, playerId: number): void {
        const instance = this.acquireToken(tokenId, playerId);
        if (!instance) return;

        const boardPos = this.boardModel.getPosition({ type: 'main', cellIndex: position }, playerId);
        const worldPos = this.threeScene.boardToWorld(boardPos.x, boardPos.y);

        // Start above spawn position
        const spawnPos = this.boardModel.getPosition({ type: 'spawn', spawnIndex: 0 }, playerId);
        const spawnWorldPos = this.threeScene.boardToWorld(spawnPos.x, spawnPos.y);

        instance.mesh.position.set(spawnWorldPos.x, 60, spawnWorldPos.z);
        instance.mesh.scale.setScalar(0);

        eventBus.emit('ANIMATION_START', { type: 'token', duration: 0.5 });

        const tl = gsap.timeline({
            onComplete: () => {
                this.releaseToken(tokenId);
                eventBus.emit('ANIMATION_COMPLETE', { type: 'token' });
            },
        });

        // Pop in
        tl.to(instance.mesh.scale, {
            x: 0.6,
            y: 0.6,
            z: 0.6,
            duration: 0.15,
            ease: 'back.out(2)',
        });

        // Arc to position
        tl.to(instance.mesh.position, {
            x: worldPos.x,
            y: 30,
            z: worldPos.z,
            duration: 0.25,
            ease: 'power2.out',
        });

        // Drop and squash
        tl.to(instance.mesh.position, {
            y: 0,
            duration: 0.1,
            ease: 'power2.in',
        });

        tl.to(instance.mesh.scale, {
            x: 0.6,
            y: 0.45,
            z: 0.6,
            duration: 0.05,
            ease: 'power2.out',
        }, '<');

        // Recover
        tl.to(instance.mesh.scale, {
            x: 0.5,
            y: 0.5,
            z: 0.5,
            duration: 0.1,
            ease: 'elastic.out(1, 0.5)',
        });
    }

    /**
     * Animate token movement along board
     */
    private animateMove(tokenId: string, from: number, to: number, playerId: number): void {
        const instance = this.acquireToken(tokenId, playerId);
        if (!instance) return;

        // Determine positions
        const isHomeStretch = to >= 100;
        const toPos = isHomeStretch
            ? this.boardModel.getPosition({ type: 'home-stretch', cellIndex: to - 100 }, playerId)
            : this.boardModel.getPosition({ type: 'main', cellIndex: to }, playerId);

        const fromPos = from >= 100
            ? this.boardModel.getPosition({ type: 'home-stretch', cellIndex: from - 100 }, playerId)
            : this.boardModel.getPosition({ type: 'main', cellIndex: from }, playerId);

        const fromWorld = this.threeScene.boardToWorld(fromPos.x, fromPos.y);
        const toWorld = this.threeScene.boardToWorld(toPos.x, toPos.y);

        instance.mesh.position.set(fromWorld.x, 0, fromWorld.z);
        instance.mesh.scale.setScalar(0.5);

        eventBus.emit('ANIMATION_START', { type: 'token', duration: DURATIONS.tokenMove + 0.2 });

        const tl = gsap.timeline({
            onComplete: () => {
                this.releaseToken(tokenId);
                eventBus.emit('ANIMATION_COMPLETE', { type: 'token' });
            },
        });

        // Lift
        tl.to(instance.mesh.position, {
            y: 25,
            duration: DURATIONS.tokenLift,
            ease: EASING.tokenLift,
        });

        tl.to(instance.mesh.scale, {
            x: 0.55,
            y: 0.55,
            z: 0.55,
            duration: DURATIONS.tokenLift,
            ease: EASING.tokenLift,
        }, '<');

        // Arc movement with bezier-like curve
        const midX = (fromWorld.x + toWorld.x) / 2;
        const midZ = (fromWorld.z + toWorld.z) / 2;

        tl.to(instance.mesh.position, {
            x: midX,
            y: 40,
            z: midZ,
            duration: DURATIONS.tokenMove * 0.5,
            ease: 'power2.out',
        });

        tl.to(instance.mesh.position, {
            x: toWorld.x,
            y: 25,
            z: toWorld.z,
            duration: DURATIONS.tokenMove * 0.5,
            ease: 'power2.in',
        });

        // Land with squash
        tl.to(instance.mesh.position, {
            y: 0,
            duration: DURATIONS.tokenLand,
            ease: 'power2.in',
        });

        tl.to(instance.mesh.scale, {
            x: 0.55,
            y: 0.4,
            z: 0.55,
            duration: 0.05,
        }, '<');

        // Recover
        tl.to(instance.mesh.scale, {
            x: 0.5,
            y: 0.5,
            z: 0.5,
            duration: 0.15,
            ease: EASING.tokenLand,
        });
    }

    /**
     * Animate token capture
     */
    private animateCapture(tokenId: string): void {
        const instance = this.activeTokens.get(tokenId);
        if (!instance) return;

        eventBus.emit('ANIMATION_START', { type: 'capture', duration: DURATIONS.tokenCapture });

        const tl = gsap.timeline({
            onComplete: () => {
                this.releaseToken(tokenId);
                eventBus.emit('ANIMATION_COMPLETE', { type: 'capture' });
            },
        });

        // Lift
        tl.to(instance.mesh.position, {
            y: 40,
            duration: 0.2,
            ease: 'power2.out',
        });

        // Shrink and spin
        tl.to(instance.mesh.scale, {
            x: 0.1,
            y: 0.1,
            z: 0.1,
            duration: 0.3,
            ease: EASING.tokenCapture,
        });

        tl.to(instance.mesh.rotation, {
            y: Math.PI * 2,
            duration: 0.3,
            ease: 'power2.in',
        }, '<');

        // Fade out (using opacity would require transparent material)
        tl.to(instance.mesh.position, {
            y: -20,
            duration: 0.1,
            ease: 'power2.in',
        });
    }

    /**
     * Animate token reaching home
     */
    private animateReachHome(tokenId: string, playerId: number): void {
        const instance = this.acquireToken(tokenId, playerId);
        if (!instance) return;

        const centerWorld = this.threeScene.boardToWorld(
            this.boardModel.size / 2,
            this.boardModel.size / 2
        );

        eventBus.emit('ANIMATION_START', { type: 'home', duration: 0.8 });

        const tl = gsap.timeline({
            onComplete: () => {
                this.releaseToken(tokenId);
                eventBus.emit('ANIMATION_COMPLETE', { type: 'home' });
            },
        });

        // Celebrate - jump and spin
        tl.to(instance.mesh.position, {
            x: centerWorld.x,
            y: 80,
            z: centerWorld.z,
            duration: 0.3,
            ease: 'power2.out',
        });

        tl.to(instance.mesh.rotation, {
            y: Math.PI * 4,
            duration: 0.5,
            ease: 'power2.inOut',
        }, '<');

        tl.to(instance.mesh.scale, {
            x: 0.7,
            y: 0.7,
            z: 0.7,
            duration: 0.3,
            ease: 'power2.out',
        }, '<');

        // Shrink into center
        tl.to(instance.mesh.scale, {
            x: 0,
            y: 0,
            z: 0,
            duration: 0.3,
            ease: 'power2.in',
        });

        tl.to(instance.mesh.position, {
            y: 0,
            duration: 0.2,
            ease: 'power2.in',
        }, '<');
    }

    /**
     * Dispose of all resources
     */
    dispose(): void {
        this.pool.forEach((instance) => {
            instance.mesh.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    (child.material as THREE.Material).dispose();
                }
            });
            this.threeScene.remove(instance.mesh);
        });

        this.tokenGeometry.dispose();
        this.tokenMaterials.forEach((mat) => mat.dispose());
    }
}

export default Token3D;
