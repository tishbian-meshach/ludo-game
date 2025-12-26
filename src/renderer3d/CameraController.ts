/**
 * CameraController - Subtle camera movements for cinematics
 * Handles zoom on dice roll, capture, and win
 */

import * as THREE from 'three';
import gsap from 'gsap';
import { ThreeScene } from './ThreeScene';
import { eventBus } from '../engine2d/EventBus';
import { DURATIONS, EASING } from '../styles/theme';

export interface CameraState {
    position: THREE.Vector3;
    lookAt: THREE.Vector3;
    fov: number;
}

export class CameraController {
    private threeScene: ThreeScene;
    private camera: THREE.PerspectiveCamera;

    private defaultState: CameraState;
    private currentTimeline: gsap.core.Timeline | null = null;

    constructor(threeScene: ThreeScene) {
        this.threeScene = threeScene;
        this.camera = threeScene.getCamera();

        const size = threeScene.getSize();

        // Store default camera state
        this.defaultState = {
            position: new THREE.Vector3(0, size * 0.8, size * 0.5),
            lookAt: new THREE.Vector3(0, 0, 0),
            fov: 45,
        };

        this.setupDefaultPosition();
        this.setupEventListeners();
    }

    /**
     * Setup default camera position
     */
    private setupDefaultPosition(): void {
        this.camera.position.copy(this.defaultState.position);
        this.camera.lookAt(this.defaultState.lookAt);
        this.camera.fov = this.defaultState.fov;
        this.camera.updateProjectionMatrix();
    }

    /**
     * Setup event listeners
     */
    private setupEventListeners(): void {
        // Dice roll - subtle zoom in
        eventBus.on('DICE_ROLL_START', () => {
            this.zoomTo(0.9, DURATIONS.diceTotal * 0.5);
        });

        eventBus.on('DICE_ROLLED', () => {
            setTimeout(() => {
                this.resetToDefault(0.3);
            }, 500);
        });

        // Token capture - nudge toward action
        eventBus.on('TOKEN_CAPTURED', ({ position }) => {
            this.nudgeToward(position, 0.3);
        });

        // Game won - dramatic zoom
        eventBus.on('GAME_WON', ({ player }) => {
            this.celebrationZoom(player);
        });

        // Game reset
        eventBus.on('GAME_RESET', () => {
            this.resetToDefault(0.5);
        });
    }

    /**
     * Zoom camera (relative to current)
     */
    zoomTo(scale: number, duration: number): void {
        this.killCurrentAnimation();

        const targetPos = this.defaultState.position.clone().multiplyScalar(scale);

        this.currentTimeline = gsap.timeline();

        this.currentTimeline.to(this.camera.position, {
            x: targetPos.x,
            y: targetPos.y,
            z: targetPos.z,
            duration,
            ease: EASING.cameraZoom,
            onUpdate: () => {
                this.camera.lookAt(this.defaultState.lookAt);
            },
        });
    }

    /**
     * Subtle nudge toward a board position
     */
    nudgeToward(boardPosition: number, duration: number): void {
        this.killCurrentAnimation();

        // Small offset based on position
        const angle = (boardPosition / 52) * Math.PI * 2;
        const nudgeAmount = 20;

        const targetPos = this.defaultState.position.clone();
        targetPos.x += Math.sin(angle) * nudgeAmount;
        targetPos.z += Math.cos(angle) * nudgeAmount;

        this.currentTimeline = gsap.timeline();

        // Nudge out
        this.currentTimeline.to(this.camera.position, {
            x: targetPos.x,
            y: targetPos.y,
            z: targetPos.z,
            duration: duration * 0.4,
            ease: 'power2.out',
            onUpdate: () => {
                this.camera.lookAt(this.defaultState.lookAt);
            },
        });

        // Return
        this.currentTimeline.to(this.camera.position, {
            x: this.defaultState.position.x,
            y: this.defaultState.position.y,
            z: this.defaultState.position.z,
            duration: duration * 0.6,
            ease: EASING.cameraPan,
            onUpdate: () => {
                this.camera.lookAt(this.defaultState.lookAt);
            },
        });
    }

    /**
     * Celebration zoom for game win
     */
    celebrationZoom(winningPlayer: number): void {
        this.killCurrentAnimation();

        const size = this.threeScene.getSize();

        // Slow zoom into center
        const zoomTarget = new THREE.Vector3(0, size * 0.3, size * 0.2);

        this.currentTimeline = gsap.timeline();

        // Slow dramatic zoom
        this.currentTimeline.to(this.camera.position, {
            x: zoomTarget.x,
            y: zoomTarget.y,
            z: zoomTarget.z,
            duration: DURATIONS.winCelebration,
            ease: 'power2.inOut',
            onUpdate: () => {
                this.camera.lookAt(0, 0, 0);
            },
        });

        // Slight FOV change for drama
        this.currentTimeline.to(this.camera, {
            fov: 35,
            duration: DURATIONS.winCelebration,
            ease: 'power2.inOut',
            onUpdate: () => {
                this.camera.updateProjectionMatrix();
            },
        }, '<');
    }

    /**
     * Reset to default position
     */
    resetToDefault(duration: number = 0.5): void {
        this.killCurrentAnimation();

        this.currentTimeline = gsap.timeline();

        this.currentTimeline.to(this.camera.position, {
            x: this.defaultState.position.x,
            y: this.defaultState.position.y,
            z: this.defaultState.position.z,
            duration,
            ease: EASING.cameraPan,
            onUpdate: () => {
                this.camera.lookAt(this.defaultState.lookAt);
            },
        });

        this.currentTimeline.to(this.camera, {
            fov: this.defaultState.fov,
            duration,
            ease: EASING.cameraPan,
            onUpdate: () => {
                this.camera.updateProjectionMatrix();
            },
        }, '<');
    }

    /**
     * Kill current animation
     */
    private killCurrentAnimation(): void {
        if (this.currentTimeline) {
            this.currentTimeline.kill();
            this.currentTimeline = null;
        }
    }

    /**
     * Set new default state
     */
    setDefaultState(position: THREE.Vector3, lookAt: THREE.Vector3, fov: number): void {
        this.defaultState = { position: position.clone(), lookAt: lookAt.clone(), fov };
    }

    /**
     * Get current camera state
     */
    getState(): CameraState {
        return {
            position: this.camera.position.clone(),
            lookAt: this.defaultState.lookAt.clone(),
            fov: this.camera.fov,
        };
    }

    /**
     * Dispose
     */
    dispose(): void {
        this.killCurrentAnimation();
    }
}

export default CameraController;
