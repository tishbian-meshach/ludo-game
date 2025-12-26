/**
 * Dice3D - 3D dice with physics-like roll animation
 * Uses GSAP for timing and easing
 */

import * as THREE from 'three';
import gsap from 'gsap';
import { ThreeScene } from './ThreeScene';
import { eventBus } from '../engine2d/EventBus';
import { COLORS, DURATIONS, EASING, getPlayerColors } from '../styles/theme';

// Dice face rotations to show each value
const FACE_ROTATIONS: Record<number, { x: number; y: number; z: number }> = {
    1: { x: 0, y: 0, z: 0 },
    2: { x: 0, y: 0, z: Math.PI / 2 },     // Fixed: Rotate around Z to bring Right (+X) to Top (+Y)
    3: { x: -Math.PI / 2, y: 0, z: 0 },
    4: { x: Math.PI / 2, y: 0, z: 0 },
    5: { x: 0, y: 0, z: -Math.PI / 2 },    // Fixed: Rotate around Z to bring Left (-X) to Top (+Y)
    6: { x: Math.PI, y: 0, z: 0 },
};

export class Dice3D {
    private threeScene: ThreeScene;
    private dice: THREE.Group;
    private diceMesh: THREE.Mesh;
    private dotMeshes: THREE.Mesh[] = [];

    private isRolling: boolean = false;
    private currentValue: number = 1;
    private timeline: gsap.core.Timeline | null = null;

    private basePosition: THREE.Vector3;
    private baseScale: number;

    constructor(threeScene: ThreeScene) {
        this.threeScene = threeScene;
        const boardSize = threeScene.getSize();

        // Calculate scale relative to board (approx 1/15th of board, like a cell)
        this.baseScale = boardSize / 15;
        this.basePosition = new THREE.Vector3(0, boardSize * 0.033, 0); // Y pos relative to size

        this.dice = new THREE.Group();
        this.diceMesh = this.createDiceMesh();
        this.dice.add(this.diceMesh);

        this.createDots();

        this.dice.position.copy(this.basePosition);
        this.dice.visible = false; // Hidden until roll

        threeScene.add(this.dice);
        this.setupEventListeners();
    }

    /**
     * Resize dice based on new board size
     */
    resize(newSize: number): void {
        // Dispose old meshes
        this.diceMesh.geometry.dispose();
        (this.diceMesh.material as THREE.Material).dispose();
        this.dice.remove(this.diceMesh);

        this.dotMeshes.forEach(dot => {
            dot.geometry.dispose();
            (dot.material as THREE.Material).dispose();
            this.dice.remove(dot);
        });
        this.dotMeshes = [];

        // Update metrics
        this.baseScale = newSize / 15;
        this.basePosition.set(0, newSize * 0.033, 0);

        // Recreate meshes
        this.diceMesh = this.createDiceMesh();
        this.dice.add(this.diceMesh);
        this.createDots();

        // Reset position unless rolling
        if (!this.isRolling) {
            this.dice.position.copy(this.basePosition);
        }
    }

    /**
     * Create the dice cube mesh
     */
    private createDiceMesh(): THREE.Mesh {
        const size = this.baseScale;
        // High segment count for smooth rounding
        const segments = 12;
        const geometry = new THREE.BoxGeometry(size, size, size, segments, segments, segments);

        // Algorithm to spherify corners for a perfect rounded box
        const posAttr = geometry.attributes.position;
        const vertex = new THREE.Vector3();
        const normal = new THREE.Vector3();

        // Cartoonish rounding radius
        const radius = size * 0.25;
        const halfSize = size / 2;
        const innerLimit = halfSize - radius;

        for (let i = 0; i < posAttr.count; i++) {
            vertex.fromBufferAttribute(posAttr, i);

            // Clamp point to the inner box
            const clampedX = Math.max(-innerLimit, Math.min(innerLimit, vertex.x));
            const clampedY = Math.max(-innerLimit, Math.min(innerLimit, vertex.y));
            const clampedZ = Math.max(-innerLimit, Math.min(innerLimit, vertex.z));

            // Vector from clamped point to original point
            normal.set(vertex.x - clampedX, vertex.y - clampedY, vertex.z - clampedZ);

            // If we are at a corner/edge, project out by radius
            if (normal.lengthSq() > 0) {
                normal.normalize().multiplyScalar(radius);
            }

            // Set new position
            vertex.set(clampedX, clampedY, clampedZ).add(normal);
            posAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }

        geometry.computeVertexNormals();

        // Material - Bright white, cartoon-like, slightly shiny but plastic
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.2,
            metalness: 0.0,
            emissive: 0xA8A8A8, // Slight self-illumination to look bright
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        return mesh;
    }

    /**
     * Create dot patterns for each face
     */
    private createDots(): void {
        const dotRadius = this.baseScale * 0.1; // Slightly larger dots
        // Use very flattened spheres for dots (like stickers/paint)
        const dotGeometry = new THREE.SphereGeometry(dotRadius, 24, 8);
        const dotMaterial = new THREE.MeshStandardMaterial({
            color: 0x000000,
            roughness: 0.2,
            metalness: 0.0,
        });

        // Box dimensions
        const halfSize = this.baseScale / 2;

        // We flatten the spheres by 80% (scale 0.2)
        const flatteningScale = 0.1;

        // We want the outer surface of the dot to be slightly above the dice face
        // Face is at halfSize. Target outer surface at halfSize + 0.1
        // center + radius * scale = halfSize + 0.1
        // center = halfSize + 0.1 - radius * scale
        const surfaceOffset = this.baseScale * 0.01; // RELATIVE OFFSET
        const dotCenterOffset = halfSize + surfaceOffset - (dotRadius * flatteningScale);

        // Spread of dots
        const offset = this.baseScale * 0.22; // Keep within flat area

        // Dot positions for each face
        // We handle rotations by creating groups or just doing math. 
        // Simplest is explicit coordinates.

        const dotPatterns: Record<number, { x: number; y: number; z: number }[]> = {
            1: [{ x: 0, y: dotCenterOffset, z: 0 }],
            6: [
                { x: -offset, y: -dotCenterOffset, z: -offset },
                { x: -offset, y: -dotCenterOffset, z: 0 },
                { x: -offset, y: -dotCenterOffset, z: offset },
                { x: offset, y: -dotCenterOffset, z: -offset },
                { x: offset, y: -dotCenterOffset, z: 0 },
                { x: offset, y: -dotCenterOffset, z: offset },
            ],
            2: [
                { x: dotCenterOffset, y: -offset, z: offset },
                { x: dotCenterOffset, y: offset, z: -offset },
            ],
            5: [
                { x: -dotCenterOffset, y: -offset, z: -offset },
                { x: -dotCenterOffset, y: -offset, z: offset },
                { x: -dotCenterOffset, y: 0, z: 0 },
                { x: -dotCenterOffset, y: offset, z: -offset },
                { x: -dotCenterOffset, y: offset, z: offset },
            ],
            3: [
                { x: -offset, y: offset, z: dotCenterOffset },
                { x: 0, y: 0, z: dotCenterOffset },
                { x: offset, y: -offset, z: dotCenterOffset },
            ],
            4: [
                { x: -offset, y: -offset, z: -dotCenterOffset },
                { x: offset, y: -offset, z: -dotCenterOffset },
                { x: -offset, y: offset, z: -dotCenterOffset },
                { x: offset, y: offset, z: -dotCenterOffset },
            ],
        };

        // Create dots for all faces
        Object.entries(dotPatterns).forEach(([_face, positions]) => {
            positions.forEach((pos) => {
                const dot = new THREE.Mesh(dotGeometry, dotMaterial);
                dot.position.set(pos.x, pos.y, pos.z);

                // Scale to flatten against the face normal
                // We determine face by which coord is near the surface limit
                const limit = halfSize - (this.baseScale * 0.125); // Relative buffer
                if (Math.abs(pos.x) > limit) dot.scale.set(flatteningScale, 1, 1);
                else if (Math.abs(pos.y) > limit) dot.scale.set(1, flatteningScale, 1);
                else if (Math.abs(pos.z) > limit) dot.scale.set(1, 1, flatteningScale);

                this.dice.add(dot);
                this.dotMeshes.push(dot);
            });
        });
    }

    private pulseTween: gsap.core.Tween | null = null;

    /**
     * Setup event listeners
     */
    private setupEventListeners(): void {
        // Listen for combined roll event that includes the value
        eventBus.on('DICE_ROLL', ({ player, value }) => {
            this.stopPulse(); // Ensure pulse stops
            this.rollWithValue(player, value);
        });

        // Start pulsing when turn changes or extra turn (waiting for roll)
        eventBus.on('TURN_CHANGED', () => this.startPulse());
        eventBus.on('EXTRA_TURN', () => this.startPulse());

        // Stop pulsing when game ends or resets
        eventBus.on('GAME_WON', () => this.stopPulse());
        eventBus.on('GAME_RESET', () => this.stopPulse());
    }

    /**
     * Start pulsing animation (indicate waiting for roll)
     */
    private startPulse(): void {
        // If rolling, don't pulse
        if (this.isRolling) return;

        // Ensure visible
        this.dice.visible = true;

        // Reset position to base just in case
        this.dice.position.copy(this.basePosition);

        // Kill existing
        if (this.pulseTween) {
            this.pulseTween.kill();
        }

        // Pulse scale
        this.pulseTween = gsap.to(this.dice.scale, {
            x: 1.15,
            y: 1.15,
            z: 1.15,
            duration: 0.8, // Slightly slower for elegance
            yoyo: true,
            repeat: -1,
            ease: 'sine.inOut'
        });
    }

    /**
     * Stop pulsing animation
     */
    private stopPulse(): void {
        if (this.pulseTween) {
            this.pulseTween.kill();
            this.pulseTween = null;
        }
        // Return to normal scale
        gsap.to(this.dice.scale, { x: 1, y: 1, z: 1, duration: 0.2 });
    }

    /**
     * Play roll animation with a specific target value
     */
    async rollWithValue(playerIndex: number, targetValue: number): Promise<void> {
        if (this.isRolling) {
            // Kill existing animation and start new one
            if (this.timeline) {
                this.timeline.kill();
            }
        }

        this.isRolling = true;
        this.dice.visible = true;
        this.currentValue = targetValue;

        // Emit animation start
        eventBus.emit('ANIMATION_START', { type: 'dice', duration: DURATIONS.diceTotal });

        // Create GSAP timeline
        this.timeline = gsap.timeline({
            onComplete: () => {
                this.isRolling = false;
                eventBus.emit('DICE_ANIMATION_COMPLETE', { type: 'dice' });
            },
        });

        // Initial position
        this.dice.position.set(0, 5, 0);
        this.dice.rotation.set(0, 0, 0);
        this.dice.scale.setScalar(0.5);

        // Build animation with the target value
        this.buildRollAnimation(targetValue);
    }

    /**
     * Build the roll animation timeline for a specific value
     */
    private buildRollAnimation(value: number): void {
        // Validate value is in range
        if (value < 1 || value > 6) {
            console.error('Invalid dice value:', value);
            value = 1;
        }

        const targetRot = FACE_ROTATIONS[value];
        if (!this.timeline || !targetRot) {
            console.error('Timeline or targetRot missing for value:', value);
            return;
        }

        // Ensure we end up at a multiple of 2PI + the target rotation for smooth transition
        const rounds = 4; // Number of full spins
        const finalX = targetRot.x + Math.PI * 2 * rounds;
        const finalY = targetRot.y + Math.PI * 2 * rounds;
        const finalZ = targetRot.z + Math.PI * 2 * rounds;

        // Phase 1: Launch
        this.timeline.to(this.dice.scale, { x: 1, y: 1, z: 1, duration: 0.2 });
        this.timeline.to(this.dice.position, { y: 80, duration: 0.4, ease: 'power2.out' }, '<');

        // Random spin during air time
        this.timeline.to(this.dice.rotation, {
            x: Math.PI * 2,
            y: Math.PI * 3,
            z: Math.PI,
            duration: 0.4,
            ease: 'none'
        }, '<');

        // Phase 2: Fall and land on target
        this.timeline.to(this.dice.position, { y: 15, duration: 0.5, ease: 'bounce.out' });

        // Critical: Rotate to exactly the target face during the fall
        this.timeline.to(this.dice.rotation, {
            x: finalX,
            y: finalY,
            z: finalZ,
            duration: 0.5,
            ease: 'power2.out'
        }, '<');

        // Phase 3: Settle
        this.timeline.to(this.dice.position, { y: this.basePosition.y, duration: 0.2 });
        this.timeline.to(this.dice.scale, { x: 0.9, y: 0.9, z: 0.9, yoyo: true, repeat: 1, duration: 0.1 });

        // Explicitly play the timeline to ensure it starts
        this.timeline.play(0);
    }

    /**
     * Hide the dice
     */
    hide(): void {
        gsap.to(this.dice.scale, {
            x: 0,
            y: 0,
            z: 0,
            duration: 0.2,
            ease: 'power2.in',
            onComplete: () => {
                this.dice.visible = false;
                this.dice.scale.setScalar(1);
            },
        });
    }

    /**
     * Show the dice at a position
     */
    show(x: number = 0, y: number = 20, z: number = 0): void {
        this.dice.position.set(x, y, z);
        this.dice.visible = true;
    }

    /**
     * Get the dice group
     */
    getObject(): THREE.Group {
        return this.dice;
    }

    /**
     * Check if currently rolling
     */
    getIsRolling(): boolean {
        return this.isRolling;
    }

    /**
     * Get current shown value
     */
    getValue(): number {
        return this.currentValue;
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        if (this.timeline) {
            this.timeline.kill();
        }

        this.diceMesh.geometry.dispose();
        (this.diceMesh.material as THREE.Material).dispose();

        this.dotMeshes.forEach((dot) => {
            dot.geometry.dispose();
            (dot.material as THREE.Material).dispose();
        });

        this.threeScene.remove(this.dice);
    }
}

export default Dice3D;
