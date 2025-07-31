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
        
        // For networking: track changes since last frame
        this.newPlanes = new Set(); // Track newly created planes for networking
        this.removedPlanes = new Set(); // Track removed planes for networking
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
            
            // Track this as a new plane for networking
            this.newPlanes.add({
                gridX: gridX,
                gridZ: gridZ,
                gridKey: gridKey
            });
            console.log(`[TerrainGenerator] Added new plane at (${gridX}, ${gridZ}) for networking`);
            
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
                // Track this as a removed plane for networking
                this.removedPlanes.add({
                    gridX: terrainPlane.gridX,
                    gridZ: terrainPlane.gridZ,
                    gridKey: gridKey
                });
                
                terrainPlane.remove();
                this.planes.delete(gridKey);
            }
        });
    }

    // Get terrain changes since last frame (for networking)
    getTerrainChanges() {
        const changes = {
            newPlanes: Array.from(this.newPlanes),
            removedPlanes: Array.from(this.removedPlanes)
        };
        
        // Log if there are changes for debugging
        if (changes.newPlanes.length > 0 || changes.removedPlanes.length > 0) {
            console.log(`[TerrainGenerator] Getting terrain changes: ${changes.newPlanes.length} new, ${changes.removedPlanes.length} removed`);
        }
        
        // Limit the number of changes to prevent network spam
        const maxChanges = 50;
        if (changes.newPlanes.length > maxChanges) {
            console.warn(`[TerrainGenerator] Too many new planes (${changes.newPlanes.length}), limiting to ${maxChanges}`);
            changes.newPlanes = changes.newPlanes.slice(0, maxChanges);
        }
        if (changes.removedPlanes.length > maxChanges) {
            console.warn(`[TerrainGenerator] Too many removed planes (${changes.removedPlanes.length}), limiting to ${maxChanges}`);
            changes.removedPlanes = changes.removedPlanes.slice(0, maxChanges);
        }
        
        // Clear the change tracking sets after getting changes
        this.newPlanes.clear();
        this.removedPlanes.clear();
        
        return changes;
    }

    // Apply terrain changes from network (for receiving updates from other players)
    applyTerrainChanges(changes) {
        if (!changes) return;
        
        console.log(`[TerrainGenerator] Applying terrain changes: ${changes.newPlanes?.length || 0} new, ${changes.removedPlanes?.length || 0} removed`);
        
        // Create new planes
        if (changes.newPlanes && Array.isArray(changes.newPlanes)) {
            changes.newPlanes.forEach(planeData => {
                if (!planeData || typeof planeData.gridX !== 'number' || typeof planeData.gridZ !== 'number') {
                    console.warn('[TerrainGenerator] Invalid plane data:', planeData);
                    return;
                }
                
                const gridKey = this.getGridKey(planeData.gridX * this.planeSize, planeData.gridZ * this.planeSize);
                if (!this.planes.has(gridKey)) {
                    try {
                        // Create plane without tracking it as our own change
                        const terrainPlane = new TerrainPlane(planeData.gridX, planeData.gridZ, this.scene, this.planeSize, this.planeGeometry, this.planeMaterial);
                        this.planes.set(gridKey, terrainPlane);
                        console.log(`[TerrainGenerator] Created networked plane at (${planeData.gridX}, ${planeData.gridZ})`);
                    } catch (error) {
                        console.error('[TerrainGenerator] Error creating plane:', error);
                    }
                }
            });
        }

        // Remove planes
        if (changes.removedPlanes && Array.isArray(changes.removedPlanes)) {
            changes.removedPlanes.forEach(planeData => {
                if (!planeData) return;
                
                const gridKey = planeData.gridKey || this.getGridKey(planeData.gridX * this.planeSize, planeData.gridZ * this.planeSize);
                const terrainPlane = this.planes.get(gridKey);
                if (terrainPlane) {
                    try {
                        terrainPlane.remove();
                        this.planes.delete(gridKey);
                    } catch (error) {
                        console.error('[TerrainGenerator] Error removing plane:', error);
                    }
                }
            });
        }
    }
}