/**
 * Effects - Visual effects for celebrations and feedback
 * Confetti particles, glow effects, dust on landing
 */

import * as THREE from 'three';
import gsap from 'gsap';
import { ThreeScene } from './ThreeScene';
import { eventBus } from '../engine2d/EventBus';
import { COLORS, getPlayerColors, PLAYER_ORDER } from '../styles/theme';

interface Particle {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    rotationSpeed: THREE.Vector3;
    gravity: number;
    lifetime: number;
    age: number;
}

export class Effects {
    private threeScene: ThreeScene;
    private particles: Particle[] = [];
    private particlePool: THREE.Mesh[] = [];
    private maxParticles: number = 200;

    private confettiGeometry: THREE.PlaneGeometry;
    private confettiMaterials: THREE.MeshBasicMaterial[] = [];

    private isActive: boolean = false;

    constructor(threeScene: ThreeScene) {
        this.threeScene = threeScene;

        // Create confetti geometry
        this.confettiGeometry = new THREE.PlaneGeometry(4, 8);

        // Create colorful materials
        const colors = ['#E74C3C', '#27AE60', '#F1C40F', '#3498DB', '#9B59B6', '#E67E22', '#1ABC9C'];
        colors.forEach((color) => {
            this.confettiMaterials.push(
                new THREE.MeshBasicMaterial({
                    color: new THREE.Color(color),
                    side: THREE.DoubleSide,
                })
            );
        });

        // Initialize particle pool
        this.initializePool();
        this.setupEventListeners();
    }

    /**
     * Initialize particle pool
     */
    private initializePool(): void {
        for (let i = 0; i < this.maxParticles; i++) {
            const material = this.confettiMaterials[i % this.confettiMaterials.length].clone();
            const mesh = new THREE.Mesh(this.confettiGeometry, material);
            mesh.visible = false;
            this.threeScene.add(mesh);
            this.particlePool.push(mesh);
        }
    }

    /**
     * Setup event listeners
     */
    private setupEventListeners(): void {
        eventBus.on('GAME_WON', ({ player }) => {
            this.triggerConfetti(player);
        });

        eventBus.on('TOKEN_REACHED_HOME', () => {
            this.triggerSmallCelebration();
        });
    }

    /**
     * Update particles each frame
     */
    update(deltaTime: number): void {
        if (!this.isActive && this.particles.length === 0) return;

        const toRemove: number[] = [];

        this.particles.forEach((particle, index) => {
            particle.age += deltaTime;

            // Apply velocity
            particle.mesh.position.add(
                particle.velocity.clone().multiplyScalar(deltaTime)
            );

            // Apply gravity
            particle.velocity.y -= particle.gravity * deltaTime;

            // Apply rotation
            particle.mesh.rotation.x += particle.rotationSpeed.x * deltaTime;
            particle.mesh.rotation.y += particle.rotationSpeed.y * deltaTime;
            particle.mesh.rotation.z += particle.rotationSpeed.z * deltaTime;

            // Flutter effect
            particle.velocity.x += Math.sin(particle.age * 10) * 0.5 * deltaTime;
            particle.velocity.z += Math.cos(particle.age * 8) * 0.5 * deltaTime;

            // Fade out
            const lifeRatio = particle.age / particle.lifetime;
            if (lifeRatio > 0.7) {
                const material = particle.mesh.material as THREE.MeshBasicMaterial;
                material.opacity = 1 - (lifeRatio - 0.7) / 0.3;
                material.transparent = true;
            }

            // Mark for removal
            if (particle.age >= particle.lifetime || particle.mesh.position.y < -100) {
                toRemove.push(index);
            }
        });

        // Remove dead particles (reverse order to maintain indices)
        toRemove.reverse().forEach((index) => {
            const particle = this.particles[index];
            particle.mesh.visible = false;
            this.particles.splice(index, 1);
        });

        // Check if celebration is done
        if (this.isActive && this.particles.length === 0) {
            this.isActive = false;
        }
    }

    /**
     * Trigger full confetti celebration
     */
    triggerConfetti(winningPlayer: number): void {
        this.isActive = true;
        const colors = getPlayerColors(winningPlayer);

        // Spawn confetti in waves
        const waves = 5;
        const particlesPerWave = 30;

        for (let wave = 0; wave < waves; wave++) {
            setTimeout(() => {
                this.spawnConfettiWave(particlesPerWave, wave);
            }, wave * 200);
        }
    }

    /**
     * Spawn a wave of confetti particles
     */
    private spawnConfettiWave(count: number, waveIndex: number): void {
        const size = this.threeScene.getSize();

        for (let i = 0; i < count; i++) {
            const mesh = this.particlePool.find((m) => !m.visible);
            if (!mesh) continue;

            mesh.visible = true;

            // Random position above camera
            mesh.position.set(
                (Math.random() - 0.5) * size * 1.5,
                size * 0.5 + Math.random() * size * 0.3,
                (Math.random() - 0.5) * size * 1.5
            );

            // Random initial rotation
            mesh.rotation.set(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );

            // Random scale
            const scale = 0.5 + Math.random() * 1;
            mesh.scale.setScalar(scale);

            // Random material
            const materialIndex = Math.floor(Math.random() * this.confettiMaterials.length);
            (mesh.material as THREE.MeshBasicMaterial).color.copy(
                this.confettiMaterials[materialIndex].color
            );
            (mesh.material as THREE.MeshBasicMaterial).opacity = 1;

            // Create particle data
            this.particles.push({
                mesh,
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 100,
                    -50 - Math.random() * 50,
                    (Math.random() - 0.5) * 100
                ),
                rotationSpeed: new THREE.Vector3(
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10
                ),
                gravity: 80 + Math.random() * 40,
                lifetime: 3 + Math.random() * 2,
                age: 0,
            });
        }
    }

    /**
     * Small celebration for reaching home
     */
    triggerSmallCelebration(): void {
        const count = 15;
        const size = this.threeScene.getSize();

        for (let i = 0; i < count; i++) {
            const mesh = this.particlePool.find((m) => !m.visible);
            if (!mesh) continue;

            mesh.visible = true;

            // Burst from center
            const angle = (i / count) * Math.PI * 2;
            const radius = 20 + Math.random() * 20;

            mesh.position.set(
                Math.cos(angle) * 10,
                20,
                Math.sin(angle) * 10
            );

            mesh.rotation.set(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );

            mesh.scale.setScalar(0.3 + Math.random() * 0.3);

            // Random material
            const materialIndex = Math.floor(Math.random() * this.confettiMaterials.length);
            (mesh.material as THREE.MeshBasicMaterial).color.copy(
                this.confettiMaterials[materialIndex].color
            );
            (mesh.material as THREE.MeshBasicMaterial).opacity = 1;

            this.particles.push({
                mesh,
                velocity: new THREE.Vector3(
                    Math.cos(angle) * radius * 3,
                    100 + Math.random() * 50,
                    Math.sin(angle) * radius * 3
                ),
                rotationSpeed: new THREE.Vector3(
                    (Math.random() - 0.5) * 15,
                    (Math.random() - 0.5) * 15,
                    (Math.random() - 0.5) * 15
                ),
                gravity: 200,
                lifetime: 1.5,
                age: 0,
            });
        }
    }

    /**
     * Spawn dust particles at a position
     */
    spawnDust(x: number, y: number, z: number): void {
        const count = 5;

        for (let i = 0; i < count; i++) {
            const mesh = this.particlePool.find((m) => !m.visible);
            if (!mesh) continue;

            mesh.visible = true;
            mesh.position.set(x, y, z);
            mesh.scale.setScalar(0.2);

            (mesh.material as THREE.MeshBasicMaterial).color.set(0xd4c5a9);
            (mesh.material as THREE.MeshBasicMaterial).opacity = 0.5;
            (mesh.material as THREE.MeshBasicMaterial).transparent = true;

            const angle = (i / count) * Math.PI * 2;

            this.particles.push({
                mesh,
                velocity: new THREE.Vector3(
                    Math.cos(angle) * 30,
                    20 + Math.random() * 10,
                    Math.sin(angle) * 30
                ),
                rotationSpeed: new THREE.Vector3(0, 0, 0),
                gravity: 50,
                lifetime: 0.5,
                age: 0,
            });
        }
    }

    /**
     * Check if effects are active
     */
    getIsActive(): boolean {
        return this.isActive || this.particles.length > 0;
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.particles = [];

        this.particlePool.forEach((mesh) => {
            mesh.geometry.dispose();
            (mesh.material as THREE.Material).dispose();
            this.threeScene.remove(mesh);
        });

        this.confettiGeometry.dispose();
        this.confettiMaterials.forEach((mat) => mat.dispose());
    }
}

export default Effects;
