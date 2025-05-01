const express = require('express')
const path = require('path')
const http = require('http')
const PORT = process.env.PORT || 3000
const socketio = require('socket.io')
const app = express()
const server = http.createServer(app)
const io = socketio(server, {
  pingTimeout: 60000,
  pingInterval: 25000,
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
})

// Set static folder
app.use(express.static(path.join(__dirname, "public")))

// Start server
server.listen(PORT, () => console.log(`Server running on port ${PORT}`))

// Connection tracking
const connections = [null, null]
const gameStates = [{ready: false, lastActivity: Date.now()}, {ready: false, lastActivity: Date.now()}]
let currentPlayerTurn = 0; // Track which player's turn it is (0 or 1)
const gameStateData = {
  isGameActive: false,
  startTime: null,
  lastTurnChange: null,
  turnHistory: [],
  reconnectionAttempts: {0: 0, 1: 0}
};

// Add connection logging
console.log("Server initialized, waiting for players to connect...");

// Activity timeout - disconnect inactive players after 2 minutes
const ACTIVITY_TIMEOUT = 120000; // 2 minutes

// Function to log with timestamp
function logWithTime(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// Heartbeat interval checking - run every 30 seconds
setInterval(() => {
  const now = Date.now();
  for (let i = 0; i < 2; i++) {
    if (connections[i] !== null) {
      const inactiveTime = now - gameStates[i].lastActivity;
      if (inactiveTime > ACTIVITY_TIMEOUT) {
        logWithTime(`Player ${i} inactive for ${inactiveTime/1000}s, disconnecting...`);
        
        // Find socket for this player and disconnect
        const sockets = Array.from(io.sockets.sockets.values());
        const playerSocket = sockets.find(s => s.playerIndex === i);
        if (playerSocket) {
          playerSocket.disconnect(true);
        }
        
        // Reset connection
        connections[i] = null;
        gameStates[i].ready = false;
      }
    }
  }
}, 30000);

io.on('connection', socket => {
  // Add connection timestamp for debugging
  logWithTime(`New connection attempt: ${socket.id.substr(0, 4)}`);
  
  // Find an available player number
  let playerIndex = -1;
  for (const i in connections) {
    if (connections[i] === null) {
      playerIndex = i
      break
    }
  }

  // Store player index on socket for reference
  socket.playerIndex = playerIndex;

  // Tell the connecting client what player number they are
  socket.emit('player-number', playerIndex)

  logWithTime(`Player ${playerIndex} has connected with ID: ${socket.id.substr(0, 4)}`)

  // Ignore player 3
  if (playerIndex === -1) {
    logWithTime("Server full, rejecting connection");
    return;
  }

  connections[playerIndex] = false
  gameStates[playerIndex].lastActivity = Date.now();

  // Add heartbeat with activity tracking
  socket.on('heartbeat', () => {
    gameStates[playerIndex].lastActivity = Date.now();
    socket.emit('heartbeat-response', {
      serverTime: Date.now(),
      playersConnected: connections.filter(c => c !== null).length,
      gameActive: gameStateData.isGameActive
    });
  });

  // Tell everyone what player number just connected
  socket.broadcast.emit('player-connection', playerIndex)

  // Handle Disconnect
  socket.on('disconnect', () => {
    logWithTime(`Player ${playerIndex} disconnected - ID: ${socket.id.substr(0, 4)}`)
    
    // Mark player as disconnected but don't immediately clear game state
    // This allows for brief reconnection without losing game state
    connections[playerIndex] = null
    
    // Tell everyone what player number just disconnected
    socket.broadcast.emit('player-connection', playerIndex)
    
    // If the game was in progress, notify the other player
    const otherPlayer = playerIndex === '0' ? '1' : '0';
    if (connections[otherPlayer] !== null) {
      logWithTime(`Notifying Player ${otherPlayer} about disconnection`);
      socket.broadcast.emit('opponent-disconnected', {disconnectedPlayer: playerIndex});
    }
    
    // Set a timeout to fully reset this player's game state if they don't reconnect
    setTimeout(() => {
      if (connections[playerIndex] === null) {
        logWithTime(`Player ${playerIndex} did not reconnect within grace period, resetting state`);
        gameStates[playerIndex].ready = false;
        
        // If both players are disconnected, reset game state completely
        if (connections[0] === null && connections[1] === null) {
          logWithTime("All players disconnected, resetting game state");
          gameStateData.isGameActive = false;
        }
      }
    }, 60000); // 1 minute grace period for reconnection
  })

  // On Ready
  socket.on('player-ready', () => {
    logWithTime(`Player ${playerIndex} is ready to play`);
    
    socket.broadcast.emit('enemy-ready', playerIndex)
    connections[playerIndex] = true
    gameStates[playerIndex].ready = true
    gameStates[playerIndex].lastActivity = Date.now();
    
    // Check if both players are ready and log game start
    if (gameStates[0].ready && gameStates[1].ready) {
      logWithTime('Game starting - both players ready')
      
      // Initialize player 0 as the starting player
      currentPlayerTurn = 0;
      
      // Update game state
      gameStateData.isGameActive = true;
      gameStateData.startTime = Date.now();
      gameStateData.lastTurnChange = Date.now();
      gameStateData.turnHistory = [{player: 0, time: Date.now()}];
      
      // Tell both players who goes first
      io.emit('game-started', currentPlayerTurn);
    }
  })

  // Check player connections
  socket.on('check-players', () => {
    logWithTime(`Player ${playerIndex} checking all player statuses`);
    gameStates[playerIndex].lastActivity = Date.now();
    
    const players = []
    for (const i in connections) {
      players.push({
        connected: connections[i] !== null,
        ready: gameStates[i].ready
      })
    }
    
    socket.emit('check-players', players)
    
    // Send connection status to client
    const connectedPlayers = players.filter(p => p.connected).length;
    logWithTime(`Currently connected players: ${connectedPlayers}/2`);
  })

  // On Fire
  socket.on('fire', id => {
    logWithTime(`Shot fired from Player ${playerIndex} at position ${id}`)
    gameStates[playerIndex].lastActivity = Date.now();
    
    // Verify it's the player's turn before processing
    if (parseInt(playerIndex) !== currentPlayerTurn) {
      logWithTime(`Player ${playerIndex} attempted to fire out of turn!`);
      socket.emit('error', {message: 'Not your turn', code: 'TURN_ERROR'});
      return;
    }
    
    // Forward the shot to the opponent
    socket.broadcast.emit('fire', id)
  })

  // On Fire Reply
  socket.on('fire-reply', classList => {
    logWithTime(`Shot reply received from Player ${playerIndex}`)
    gameStates[playerIndex].lastActivity = Date.now();
    
    // Forward the reply to the opponent
    socket.broadcast.emit('fire-reply', classList)
    
    // Switch turns
    const previousTurn = currentPlayerTurn;
    currentPlayerTurn = currentPlayerTurn === 0 ? 1 : 0;
    
    logWithTime(`Switching turn from Player ${previousTurn} to Player ${currentPlayerTurn}`);
    
    // Track turn changes
    gameStateData.lastTurnChange = Date.now();
    gameStateData.turnHistory.push({player: currentPlayerTurn, time: Date.now()});
    
    // Notify both players about the turn change
    io.emit('update-turn', currentPlayerTurn);
  })
  
  // Handle reconnection attempt
  socket.on('reconnect-attempt', (data) => {
    logWithTime(`Player ${playerIndex} attempting to reconnect`);
    gameStates[playerIndex].lastActivity = Date.now();
    
    // If this is a valid player, update their connection
    if (playerIndex !== -1 && connections[playerIndex] === null) {
      connections[playerIndex] = false;
      gameStateData.reconnectionAttempts[playerIndex]++;
      
      // Send current game state to reconnecting player
      socket.emit('reconnect-success', {
        playerIndex,
        currentTurn: currentPlayerTurn,
        gameActive: gameStateData.isGameActive,
        reconnectCount: gameStateData.reconnectionAttempts[playerIndex]
      });
      
      socket.broadcast.emit('player-connection', playerIndex);
      
      logWithTime(`Player ${playerIndex} successfully reconnected (attempt #${gameStateData.reconnectionAttempts[playerIndex]})`);
    }
  });
  
  // Handle game state sync request
  socket.on('sync-game-state', () => {
    logWithTime(`Player ${playerIndex} requested game state sync`);
    gameStates[playerIndex].lastActivity = Date.now();
    
    socket.emit('game-state-update', {
      currentTurn: currentPlayerTurn,
      gameActive: gameStateData.isGameActive,
      turnHistory: gameStateData.turnHistory.slice(-5) // Send last 5 turns
    });
  });
  
  // Handle game over
  socket.on('game-over', data => {
    logWithTime(`Game over - Player ${data.winner} won`);
    gameStates[playerIndex].lastActivity = Date.now();
    
    socket.broadcast.emit('game-over', data);
    
    // Reset game states but keep connections
    gameStates[0].ready = false;
    gameStates[1].ready = false;
    gameStateData.isGameActive = false;
    
    // Log game statistics
    const gameDuration = Date.now() - gameStateData.startTime;
    logWithTime(`Game statistics: Duration=${Math.floor(gameDuration/1000)}s, Turns=${gameStateData.turnHistory.length}`);
  });

  // Timeout handler - extended to 30 minutes
  setTimeout(() => {
    if (connections[playerIndex] !== null) {
      logWithTime(`Player ${playerIndex} timed out after 30 minutes`);
      connections[playerIndex] = null;
      gameStates[playerIndex].ready = false;
      socket.emit('timeout');
      socket.disconnect(true);
    }
  }, 1800000); // 30 minute limit per player
})

// Add a server health check endpoint
app.get('/health', (req, res) => {
  const players = connections.filter(c => c !== null).length;
  res.json({ 
    status: 'running', 
    players: players,
    uptime: process.uptime(),
    gameActive: gameStateData.isGameActive,
    currentTurn: gameStateData.isGameActive ? currentPlayerTurn : null,
    lastActivity: [
      gameStates[0].lastActivity ? new Date(gameStates[0].lastActivity).toISOString() : null,
      gameStates[1].lastActivity ? new Date(gameStates[1].lastActivity).toISOString() : null
    ]
  });
});

// Add a debug endpoint to get full game state
app.get('/debug-state', (req, res) => {
  // Only available in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).send('Not found');
  }
  
  res.json({
    connections,
    gameStates,
    currentPlayerTurn,
    gameStateData
  });
});