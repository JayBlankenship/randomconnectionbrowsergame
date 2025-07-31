import * as THREE from 'https://cdn.skypack.dev/three@0.134.0';
import { createPlayerPawn } from './playerPawn.js';
import { createStar } from './star.js';
import { createAIPlayer } from './ai.js';
import { TerrainPlane } from './terrainPlane.js';
import { TerrainGenerator } from './terrainGenerator.js'; // Import the new class
import { NetworkedPlayerManager } from './networkedPlayer.js'; // Import networked player system

const canvas = document.getElementById('gameCanvas');
const startButton = document.getElementById('startButton');
const menu = document.getElementById('menu');
const pauseMenu = document.getElementById('pauseMenu');
const closeMenuButton = document.getElementById('closeMenu');
const instructions = document.getElementById('instructions');
const thetaSensitivityInput = document.getElementById('thetaSensitivity');
const phiSensitivityInput = document.getElementById('phiSensitivity');

// Global state
let isInstructionsVisible = true;
let isGamePaused = false;
let isSettingsOpen = false;

// Global functions for menu controls
window.resumeGame = function() {
    isGamePaused = false;
    pauseMenu.style.display = 'none';
    if (!document.pointerLockElement) {
        canvas.requestPointerLock();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    startButton.addEventListener('click', () => {
        startButton.style.display = 'none';
        canvas.style.display = 'block';
        initGame();
    });
});

// Load saved settings on page load
function loadSettings() {
    const savedTheta = localStorage.getItem('thetaSensitivity');
    const savedPhi = localStorage.getItem('phiSensitivity');
    if (savedTheta) thetaSensitivityInput.value = savedTheta;
    if (savedPhi) phiSensitivityInput.value = savedPhi;
}

function initGame() {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Create player pawn and star
    const playerPawn = createPlayerPawn(false); // false indicates human player
    scene.add(playerPawn);

    // Initialize networked player manager for red replicated players
    const networkedPlayerManager = new NetworkedPlayerManager(scene);
    console.log('[Game] NetworkedPlayerManager initialized');
    
    // Set up network callbacks for player replication once connected
    if (window.Network) {
        // Handle incoming player state updates from other clients
        window.Network.callbacks.handlePlayerState = (peerId, state) => {
            console.log(`[Game] Received player state from ${peerId}:`, state);
            networkedPlayerManager.updatePlayer(peerId, state);
        };
        
        // Track when players join/leave the lobby to create/remove red players
        const originalUpdateUI = window.Network.callbacks.updateUI;
        window.Network.callbacks.updateUI = function(peers) {
            // Call original updateUI if it exists
            if (originalUpdateUI) {
                originalUpdateUI(peers);
            }
            
            // Only create red players if we're in a complete lobby
            if (window.Network.isInCompleteLobby && window.Network.isInCompleteLobby()) {
                const currentPeerIds = window.Network.getLobbyPeerIds();
                const existingPeerIds = Array.from(networkedPlayerManager.networkedPlayers.keys());
                
                console.log(`[Game] Lobby complete! Current peers:`, currentPeerIds);
                console.log(`[Game] Existing networked players:`, existingPeerIds);
                
                // Add new players as red replicated pawns
                for (const peerId of currentPeerIds) {
                    if (!existingPeerIds.includes(peerId)) {
                        console.log(`[Game] Creating RED networked player for peer: ${peerId}`);
                        networkedPlayerManager.addPlayer(peerId);
                    }
                }
                
                // Remove disconnected players
                for (const peerId of existingPeerIds) {
                    if (!currentPeerIds.includes(peerId)) {
                        console.log(`[Game] Removing networked player for peer: ${peerId}`);
                        networkedPlayerManager.removePlayer(peerId);
                    }
                }
            }
        };
    }

    // Create multiple AI players
    const numberOfAIPlayers = 8; // Set this to your desired number
    const aiPlayers = []; // Array to store all AI players

    for (let i = 0; i < numberOfAIPlayers; i++) {
        const aiPlayer = createAIPlayer();
        
        // Position in a spiral pattern to avoid clustering
        const angle = (i / numberOfAIPlayers) * Math.PI * 2;
        const radius = 70 + (i % 5) * 5; // Staggered distances
        
        aiPlayer.position.set(
            Math.cos(angle) * radius,
            0,
            Math.sin(angle) * radius
        );
        
        scene.add(aiPlayer);
        aiPlayers.push(aiPlayer);
    }

    // Procedural ground system
    const planeSize = 2;
    const planeGeometry = new THREE.PlaneGeometry(planeSize, planeSize, 1, 1);
    const planeMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00FF00, // Neon green
        side: THREE.DoubleSide,
        wireframe: true
    });

    // Initialize TerrainGenerator
    const terrainGenerator = new TerrainGenerator(scene, planeSize, planeGeometry, planeMaterial);

    // Initial camera position
    camera.position.set(0, 5, -10);
    camera.lookAt(playerPawn.position);

    // Calculate initial theta and phi
    const initialOffset = new THREE.Vector3().subVectors(camera.position, playerPawn.position);
    const r = initialOffset.length();
    let theta = Math.atan2(initialOffset.x, initialOffset.z);
    let phi = Math.atan2(initialOffset.y, Math.sqrt(initialOffset.x ** 2 + initialOffset.z ** 2));

    // Mouse controls with Pointer Lock
    let isPointerLocked = false;
    let mouseX = 0;
    let mouseY = 0;
    let thetaSensitivity = parseFloat(thetaSensitivityInput.value);
    let phiSensitivity = parseFloat(phiSensitivityInput.value);

    canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;

    canvas.addEventListener('click', () => {
        if (!isPointerLocked && !menu.style.display) {
            canvas.requestPointerLock();
        }
    });

    document.addEventListener('pointerlockchange', () => {
        isPointerLocked = document.pointerLockElement === canvas;
    });

    document.addEventListener('mousemove', (e) => {
        if (isPointerLocked) {
            mouseX = e.movementX || e.mozMovementX || 0;
            mouseY = e.movementY || e.mozMovementY || 0;
        }
    });

    // Update and save sensitivity from sliders
    thetaSensitivityInput.addEventListener('input', (e) => {
        thetaSensitivity = parseFloat(e.target.value);
        localStorage.setItem('thetaSensitivity', thetaSensitivity);
    });
    phiSensitivityInput.addEventListener('input', (e) => {
        phiSensitivity = parseFloat(e.target.value);
        localStorage.setItem('phiSensitivity', phiSensitivity);
    });

    // Load settings when the page loads
    loadSettings();

    // Movement controls
    const moveState = { forward: false, backward: false, left: false, right: false };
    const playerSpeed = 5.0;
    let lastTime = performance.now();
    let isMenuOpen = false;
    let animationTime = 0;

    document.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        
        // Global hotkeys
        if (key === 'escape') {
            isGamePaused = !isGamePaused;
            pauseMenu.style.display = isGamePaused ? 'block' : 'none';
            if (isGamePaused && isPointerLocked) {
                document.exitPointerLock();
            } else if (!isGamePaused && !isPointerLocked) {
                canvas.requestPointerLock();
            }
        }
        
        if (key === 'f1') {
            isInstructionsVisible = !isInstructionsVisible;
            instructions.classList.toggle('hidden', !isInstructionsVisible);
        }
        
        if (key === 'f2') {
            isSettingsOpen = !isSettingsOpen;
            menu.style.display = isSettingsOpen ? 'block' : 'none';
        }
        
        // Movement controls only when not paused
        if (!isGamePaused && !isSettingsOpen) {
            if (key === 'w') moveState.forward = true;
            if (key === 's') moveState.backward = true;
            if (key === 'a') moveState.left = true;
            if (key === 'd') moveState.right = true;
        }
    });

    document.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        if (key === 'w') moveState.forward = false;
        if (key === 's') moveState.backward = false;
        if (key === 'a') moveState.left = false;
        if (key === 'd') moveState.right = false;
    });

    closeMenuButton.addEventListener('click', () => {
        isSettingsOpen = false;
        menu.style.display = 'none';
        if (!isPointerLocked) {
            canvas.requestPointerLock();
        }
    });

    // Animation loop
    function animate(currentTime) {
        requestAnimationFrame(animate);
        
        const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1);
        lastTime = currentTime;
        animationTime += deltaTime;

        // Update player position only if not paused
        if (!isGamePaused && !isSettingsOpen) {
            let direction = new THREE.Vector3();
            camera.getWorldDirection(direction);
            direction.y = 0;
            direction.normalize();

            if (moveState.forward) {
                playerPawn.position.x += playerSpeed * deltaTime * direction.x;
                playerPawn.position.z += playerSpeed * deltaTime * direction.z;
            }
            if (moveState.backward) {
                playerPawn.position.x -= playerSpeed * deltaTime * direction.x;
                playerPawn.position.z -= playerSpeed * deltaTime * direction.z;
            }
            if (moveState.left) {
                const leftVector = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
                playerPawn.position.x += playerSpeed * deltaTime * leftVector.x;
                playerPawn.position.z += playerSpeed * deltaTime * leftVector.z;
            }
            if (moveState.right) {
                const rightVector = new THREE.Vector3().crossVectors(direction, camera.up).normalize();
                playerPawn.position.x += playerSpeed * deltaTime * rightVector.x;
                playerPawn.position.z += playerSpeed * deltaTime * rightVector.z;
            }

            // Update player pawn and star animations
            playerPawn.update(deltaTime, animationTime);

            // Broadcast our position to other players if we're in a complete lobby
            if (window.Network && window.Network.isInCompleteLobby && window.Network.isInCompleteLobby()) {
                // Create player state object
                const playerState = {
                    position: {
                        x: playerPawn.position.x,
                        y: playerPawn.position.y,
                        z: playerPawn.position.z
                    },
                    rotation: {
                        x: playerPawn.rotation.x,
                        y: playerPawn.rotation.y,
                        z: playerPawn.rotation.z
                    },
                    surgeActive: playerPawn.surgeActive || false
                };
                
                // Throttle network updates to avoid spam (send every ~100ms)
                const now = Date.now();
                if (!window.lastNetworkUpdate || now - window.lastNetworkUpdate > 100) {
                    window.Network.broadcastPlayerState(playerState);
                    window.lastNetworkUpdate = now;
                }
            }

            // Update red networked players (animate them smoothly)
            networkedPlayerManager.update(deltaTime, animationTime);

            // Update all AI players
            aiPlayers.forEach(aiPlayer => {
                aiPlayer.updateAI(deltaTime, animationTime);
                // Generate planes around each AI
                terrainGenerator.generateNeighboringPlanes(aiPlayer.position);
            });

            // Generate new planes for both player and AI
            terrainGenerator.generateNeighboringPlanes(playerPawn.position);
            
            // Generate terrain around red networked players too
            /*
            const networkedPlayerPositions = networkedPlayerManager.getAllPositions();
            networkedPlayerPositions.forEach(position => {
                terrainGenerator.generateNeighboringPlanes(position);
            });

            // Remove distant planes (check distance to player, AIs, and networked players)
            const allPositions = [playerPawn.position, ...aiPlayers.map(ai => ai.position), ...networkedPlayerPositions];
            terrainGenerator.removeDistantPlanes(playerPawn.position, aiPlayers.concat(networkedPlayerPositions));
            */

            // Remove distant planes (check distance to player and all AIs)
            terrainGenerator.removeDistantPlanes(playerPawn.position, aiPlayers);

            // Update camera based on mouse movement
            if (isPointerLocked && (mouseX !== 0 || mouseY !== 0)) {
                theta -= mouseX * thetaSensitivity;
                phi -= mouseY * phiSensitivity;
                phi = Math.max(0.1, Math.min(1.2, phi));
                theta = ((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
                mouseX = 0;
                mouseY = 0;
            }

            // Update camera position
            const horizontalDistance = r * Math.cos(phi);
            camera.position.x = playerPawn.position.x + horizontalDistance * Math.sin(theta);
            camera.position.z = playerPawn.position.z + horizontalDistance * Math.cos(theta);
            camera.position.y = playerPawn.position.y + r * Math.sin(phi);
            camera.lookAt(playerPawn.position);
        }

        renderer.render(scene, camera);
    }
    animate(performance.now());

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}