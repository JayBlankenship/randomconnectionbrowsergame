// TerrainPlane.js
import * as THREE from 'https://cdn.skypack.dev/three@0.134.0';

export class TerrainPlane {
    constructor(gridX, gridZ, scene, planeSize, planeGeometry, planeMaterial) {
        this.gridX = gridX;
        this.gridZ = gridZ;
        this.scene = scene; // Store the scene reference
        this.position = new THREE.Vector3(gridX * planeSize, 0, gridZ * planeSize);
        this.mesh = new THREE.Mesh(planeGeometry, planeMaterial);
        this.mesh.rotation.x = -Math.PI / 2;
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);

        // Placeholder for future procedural generation (e.g., height, texture)
        this.terrainData = {
            height: 0, // Default flat plane, can be modified later
            // Add more properties (e.g., noise, features) as needed
        };
    }

    // Method to update terrain (optional, for future use)
    updateTerrain() {
        // Future implementation for random generation
    }

    remove() {
        this.scene.remove(this.mesh); // Use the stored scene reference
    }
}