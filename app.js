// --- APPLICATION CONTROLLER ---
// This file now acts as the main application controller,
// coordinating between the Network module and PauseUI module

// Legacy global variables for compatibility (reference Network object)
let myPeerId = null;
let peer = null;
let isBase = false;
let paired = false;
let partnerPeerId = null;
let partnerConn = null;
let isInitialized = false;

// Initialize all modules
function initializeApp() {
  // Initialize UI
  PauseUI.init();
  
  // Set up Network callbacks to use PauseUI functions
  Network.setCallbacks({
    updateConnectionStatus: PauseUI.updateConnectionStatus.bind(PauseUI),
    logChainEvent: PauseUI.logChainEvent.bind(PauseUI),
    updateUI: PauseUI.updateUI.bind(PauseUI),
    handleMessage: PauseUI.handleMessage.bind(PauseUI)
  });
  
  // Start networking
  Network.init();
  Network.startAutoReconnect();
  
  // Update legacy variables for compatibility
  updateLegacyVariables();
}

// Update legacy global variables for any remaining compatibility needs
function updateLegacyVariables() {
  myPeerId = Network.myPeerId;
  peer = Network.peer;
  isBase = Network.isBase;
  paired = Network.paired;
  partnerPeerId = Network.partnerPeerId;
  partnerConn = Network.partnerConn;
  isInitialized = Network.isInitialized;
}

// Wrapper functions for global access
function sendMessage() {
  PauseUI.sendMessage();
  updateLegacyVariables();
}

function joinChain() {
  PauseUI.joinChain();
  updateLegacyVariables();
}

// Legacy functions kept for compatibility
function broadcastChain() {
  PauseUI.broadcastChain();
}

function updateChainLinks() {
  PauseUI.updateChainLinks();
}

// Expose functions globally for HTML onclick handlers
window.sendMessage = sendMessage;
window.joinChain = joinChain;

// Start the application
initializeApp();