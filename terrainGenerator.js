// TerrainGenerator.js
import * as THREE from 'https://cdn.skypack.dev/three@0.134.0';
import { TerrainPlane } from './terrainPlane.js';

export class TerrainGenerator {
    constructor(scene, planeSize, planeGeometry, planeMaterial) {
        this.scene = scene;
        this.planeSize = planeSize;
        this.planeGeometry = planeGeometry;
        this.planeMaterial = planeMaterial;
        this.planes = new Map(); // Map<gridKey, TerrainPlane>
    }

    // Convert world position to grid coordinates
    getGridKey(x, z) {
        const gridX = Math.floor(x / this.planeSize);
        const gridZ = Math.floor(z / this.planeSize);
        return `${gridX},${gridZ}`;
    }

    // Create a TerrainPlane at a given grid position
    createPlane(gridX, gridZ) {
        const gridKey = this.getGridKey(gridX * this.planeSize, gridZ * this.planeSize);
        if (!this.planes.has(gridKey)) {
            const terrainPlane = new TerrainPlane(gridX, gridZ, this.scene, this.planeSize, this.planeGeometry, this.planeMaterial);
            this.planes.set(gridKey, terrainPlane);
            return terrainPlane;
        }
        return this.planes.get(gridKey);
    }

    // Generate neighboring planes and ensure a plane under the entity, with a larger radius
    generateNeighboringPlanes(entityPosition) {
        const gridKey = this.getGridKey(entityPosition.x, entityPosition.z);
        const [gridX, gridZ] = gridKey.split(',').map(Number);

        // Always create a plane directly under the entity if it doesn't exist
        const currentGridKey = `${gridX},${gridZ}`;
        if (!this.planes.has(currentGridKey)) {
            this.createPlane(gridX, gridZ);
        }

        // Check if entity is near an edge (within 5 units of plane boundary) to generate neighbors
        const localX = entityPosition.x - gridX * this.planeSize;
        const localZ = entityPosition.z - gridZ * this.planeSize;
        const edgeThreshold = 5;

        // Generate planes up to 5 grid cells out in all four directions
        const maxDistance = 18; // Generate 5 cells out (total span of 11 cells: -5 to +5)
        for (let dx = -maxDistance; dx <= maxDistance; dx++) {
            for (let dz = -maxDistance; dz <= maxDistance; dz++) {
                if (dx === 0 && dz === 0) continue; // Skip the center (already handled)
                if (Math.abs(dx) + Math.abs(dz) > maxDistance) continue; // Keep it a cross shape (only x or z offset)

                // Check if near an edge in the respective direction
                if (
                    (dx !== 0 && Math.abs(localX) > this.planeSize / 2 - edgeThreshold) ||
                    (dz !== 0 && Math.abs(localZ) > this.planeSize / 2 - edgeThreshold)
                ) {
                    const newGridX = gridX + dx;
                    const newGridZ = gridZ + dz;
                    const newGridKey = `${newGridX},${newGridZ}`;
                    if (!this.planes.has(newGridKey)) {
                        this.createPlane(newGridX, newGridZ);
                    }
                }
            }
        }
    }

    // Remove distant planes
    removeDistantPlanes(playerPosition, aiPlayers) {
        const maxDistance = this.planeSize * 10;
        this.planes.forEach((terrainPlane, gridKey) => {
            let shouldRemove = true;
            
            // Check player distance
            if (playerPosition.distanceTo(terrainPlane.position) <= maxDistance) {
                shouldRemove = false;
            }
            
            // Check AI distances
            if (shouldRemove) {
                for (const aiPlayer of aiPlayers) {
                    if (aiPlayer.position.distanceTo(terrainPlane.position) <= maxDistance) {
                        shouldRemove = false;
                        break;
                    }
                }
            }
            
            if (shouldRemove) {
                terrainPlane.remove();
                this.planes.delete(gridKey);
            }
        });
    }
}