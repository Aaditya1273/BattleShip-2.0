document.addEventListener('DOMContentLoaded', () => {
  const userGrid = document.querySelector('.grid-user')
  const computerGrid = document.querySelector('.grid-computer')
  const displayGrid = document.querySelector('.grid-display')
  const ships = document.querySelectorAll('.ship')
  const destroyer = document.querySelector('.destroyer-container')
  const submarine = document.querySelector('.submarine-container')
  const cruiser = document.querySelector('.cruiser-container')
  const battleship = document.querySelector('.battleship-container')
  const carrier = document.querySelector('.carrier-container')
  const startButton = document.querySelector('#start')
  const rotateButton = document.querySelector('#rotate')
  const turnDisplay = document.querySelector('#whose-go')
  const infoDisplay = document.querySelector('#info')
  const setupButtons = document.getElementById('setup-buttons')
  const userSquares = []
  const computerSquares = []
  let isHorizontal = true
  let isGameOver = false
  let currentPlayer = 'user'
  const width = 10
  let playerNum = 0
  let ready = false
  let enemyReady = false
  let allShipsPlaced = false
  let shotFired = -1
  let isAnimating = false
  
  // Game statistics
  let totalShots = 0;
  let hits = 0;
  const statsDisplay = {
    shotsCount: document.getElementById('shots-fired'),
    hitsCount: document.getElementById('hits'),
    accuracyDisplay: document.getElementById('accuracy')
  };
  
  // Performance optimization - batch DOM updates
  const batchUpdate = (callback) => {
    requestAnimationFrame(() => {
      callback();
    });
  };
  
  // Animate element with class
  const animateElement = (element, className, duration) => {
    if (isAnimating) return;
    isAnimating = true;
    element.classList.add(className);
    setTimeout(() => {
      element.classList.remove(className);
      isAnimating = false;
    }, duration);
  };
  
  // Ships
  const shipArray = [
    {
      name: 'destroyer',
      directions: [
        [0, 1],
        [0, width]
      ]
    },
    {
      name: 'submarine',
      directions: [
        [0, 1, 2],
        [0, width, width*2]
      ]
    },
    {
      name: 'cruiser',
      directions: [
        [0, 1, 2],
        [0, width, width*2]
      ]
    },
    {
      name: 'battleship',
      directions: [
        [0, 1, 2, 3],
        [0, width, width*2, width*3]
      ]
    },
    {
      name: 'carrier',
      directions: [
        [0, 1, 2, 3, 4],
        [0, width, width*2, width*3, width*4]
      ]
    },
  ]

  createBoard(userGrid, userSquares)
  createBoard(computerGrid, computerSquares)

  // Select Player Mode
  if (gameMode === 'singlePlayer') {
    startSinglePlayer()
  } else {
    startMultiPlayer()
  }

  // Multiplayer
  function startMultiPlayer() {
    const socket = io({
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000
    });

    // Store socket reference globally for use in other functions
    window.gameSocket = socket;

    // Connection monitoring
    let connectionLost = false;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    
    // Init connection indicator
    const connectionIndicator = document.createElement('div');
    connectionIndicator.className = 'connection-status';
    connectionIndicator.innerHTML = '<i class="fas fa-wifi"></i> <span>Connected</span>';
    document.body.appendChild(connectionIndicator);
    
    // Setup heartbeat mechanism
    let heartbeatInterval;
    const setupHeartbeat = () => {
      clearInterval(heartbeatInterval); // Clear any existing interval
      heartbeatInterval = setInterval(() => {
        if (socket.connected) {
          socket.emit('heartbeat');
        }
      }, 15000); // Send heartbeat every 15 seconds
    };
    
    // Start heartbeat when connected
    setupHeartbeat();
    
    // Heartbeat response handler
    socket.on('heartbeat-response', (data) => {
      // Update connection indicator
      connectionIndicator.className = 'connection-status connected';
      connectionIndicator.innerHTML = `<i class="fas fa-wifi"></i> <span>Connected (${data.playersConnected}/2)</span>`;
      
      // Check if game state needs syncing
      if (data.gameActive && ready && enemyReady) {
        socket.emit('sync-game-state');
      }
    });
    
    // Monitor connection status
    socket.on('connect', () => {
      connectionIndicator.className = 'connection-status connected';
      connectionIndicator.innerHTML = '<i class="fas fa-wifi"></i> <span>Connected</span>';
      
      if (connectionLost) {
        // We've reconnected
        infoDisplay.innerHTML = "Reconnected to server!";
        connectionLost = false;
        reconnectAttempts = 0;
        
        // Attempt to restore our place in the game
        socket.emit('reconnect-attempt', {playerNum});
        
        // Restart heartbeat
        setupHeartbeat();
      }
    });
    
    socket.on('connect_error', () => {
      connectionLost = true;
      reconnectAttempts++;
      
      // Update connection indicator
      connectionIndicator.className = 'connection-status disconnected';
      connectionIndicator.innerHTML = `<i class="fas fa-wifi"></i> <span>Connecting (${reconnectAttempts}/${maxReconnectAttempts})</span>`;
      
      if (reconnectAttempts <= maxReconnectAttempts) {
        infoDisplay.innerHTML = `Connection error. Reconnecting (${reconnectAttempts}/${maxReconnectAttempts})...`;
      } else {
        infoDisplay.innerHTML = "Unable to connect to server. Please refresh the page.";
        
        // Show a refresh button
        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = "Refresh";
        refreshBtn.classList.add('btn');
        refreshBtn.addEventListener('click', () => window.location.reload());
        infoDisplay.parentNode.appendChild(refreshBtn);
      }
    });
    
    socket.on('disconnect', () => {
      connectionLost = true;
      connectionIndicator.className = 'connection-status disconnected';
      connectionIndicator.innerHTML = '<i class="fas fa-wifi"></i> <span>Disconnected</span>';
      clearInterval(heartbeatInterval);
    });
    
    // Handle reconnection success
    socket.on('reconnect-success', (data) => {
      // Update player info
      playerNum = parseInt(data.playerIndex);
      
      // Update turn status
      if (data.gameActive) {
        currentPlayer = parseInt(data.currentTurn) === playerNum ? 'user' : 'enemy';
        updateTurnIndicator(currentPlayer, 'game');
        
        // Request to sync full game state from server
        socket.emit('sync-game-state');
        
        infoDisplay.innerHTML = `Reconnected (${data.reconnectCount}). ${currentPlayer === 'user' ? 'Your turn!' : 'Enemy turn'}`;
      } else {
        // Game isn't active yet, probably still in setup phase
        infoDisplay.innerHTML = "Reconnected to game";
      }
    });
    
    // Handle game state sync
    socket.on('game-state-update', (state) => {
      // Update current player based on server's current turn
      const previousPlayer = currentPlayer;
      currentPlayer = parseInt(state.currentTurn) === playerNum ? 'user' : 'enemy';
      
      // Only update UI if there's an actual change
      if (previousPlayer !== currentPlayer) {
        updateTurnIndicator(currentPlayer, 'game');
      }
      
      console.log(`Game state synced: turn=${state.currentTurn}, active=${state.gameActive}`);
      
      // Show brief notification
      const syncNotification = document.createElement('div');
      syncNotification.className = 'sync-notification';
      syncNotification.textContent = "Game state synchronized";
      document.body.appendChild(syncNotification);
      
      // Remove notification after 2 seconds
      setTimeout(() => {
        syncNotification.classList.add('fade-out');
        setTimeout(() => {
          syncNotification.remove();
        }, 500);
      }, 2000);
    });
    
    // Error handling
    socket.on('error', (errorData) => {
      console.error('Socket error:', errorData);
      
      if (errorData.code === 'TURN_ERROR') {
        infoDisplay.innerHTML = "Wait for your turn!";
        animateElement(infoDisplay, 'shake', 500);
      }
    });
    
    // Handle opponent disconnection
    socket.on('opponent-disconnected', (data) => {
      if (!isGameOver) {
        infoDisplay.innerHTML = "Your opponent disconnected! Waiting for reconnection...";
        animateElement(infoDisplay, 'shake', 500);
        
        // Update opponent's connection indicator
        const opponentId = playerNum === 0 ? 1 : 0;
        const playerStatus = document.querySelector(`#player${opponentId + 1}-status .connection-indicator`);
        if (playerStatus) {
          const statusDot = playerStatus.querySelector('.status-dot');
          const statusLabel = playerStatus.querySelector('.status-label');
          
          if (statusDot) statusDot.className = 'status-dot disconnected';
          if (statusLabel) statusLabel.textContent = 'Disconnected';
        }
        
        // Show reconnection timer
        let reconnectTimer = 60; // 60 seconds reconnection grace period
        const timerInterval = setInterval(() => {
          reconnectTimer--;
          infoDisplay.innerHTML = `Your opponent disconnected! Waiting for reconnection... (${reconnectTimer}s)`;
          
          if (reconnectTimer <= 0) {
            clearInterval(timerInterval);
            
            // Show restart button if timer expires
            const restartBtn = document.createElement('button');
            restartBtn.textContent = "Back to Menu";
            restartBtn.classList.add('btn');
            restartBtn.addEventListener('click', () => window.location.href = '/');
            infoDisplay.innerHTML = "Your opponent didn't reconnect. Game over.";
            infoDisplay.parentNode.appendChild(restartBtn);
          }
        }, 1000);
        
        // Store timer in a global variable so we can clear it if opponent reconnects
        window.reconnectTimer = timerInterval;
      }
    });
    
    // Listen for the game-started event
    socket.on('game-started', firstPlayerTurn => {
      console.log(`Game started, Player ${firstPlayerTurn} goes first`);
      
      // Update current player based on who goes first
      currentPlayer = parseInt(firstPlayerTurn) === playerNum ? 'user' : 'enemy';
      console.log(`My player number: ${playerNum}, My turn status: ${currentPlayer}`);
      
      // Update the turn display with the correct initial state
      updateTurnIndicator(currentPlayer, 'game');
      
      // Show game starting message
      infoDisplay.innerHTML = "Game starting! " + (currentPlayer === 'user' ? "Your turn first!" : "Opponent goes first!");
      infoDisplay.style.color = '#FFD700';
      
      // Show the setup buttons if it's not already hidden
      if (setupButtons) {
        setupButtons.style.display = 'none';
      }
      
      // If opponent reconnect timer is running, clear it
      if (window.reconnectTimer) {
        clearInterval(window.reconnectTimer);
        window.reconnectTimer = null;
      }
    });
    
    // Replace switch-turn with update-turn
    socket.on('update-turn', playerTurn => {
      console.log(`Turn update received. Current turn: Player ${playerTurn}`);
      
      // Set current player based on whose turn it is
      const previousPlayer = currentPlayer;
      currentPlayer = parseInt(playerTurn) === playerNum ? 'user' : 'enemy';
      
      console.log(`Turn changed from ${previousPlayer} to ${currentPlayer}`);
      
      // Only update if there's an actual change to prevent flickering
      if (previousPlayer !== currentPlayer && !isGameOver) {
        updateTurnIndicator(currentPlayer, 'game');
        
        // Add notification for turn change
        const notification = document.createElement('div');
        notification.className = `turn-notification ${currentPlayer === 'user' ? 'your-turn-notify' : 'enemy-turn-notify'}`;
        notification.textContent = currentPlayer === 'user' ? 'Your Turn' : 'Enemy Turn';
        document.body.appendChild(notification);
        
        // Remove notification after animation
        setTimeout(() => {
          notification.classList.add('fade-out');
          setTimeout(() => notification.remove(), 1000);
        }, 2000);
        
        // Play sound if enabled
        if (window.playSound && typeof window.playSound === 'function') {
          window.playSound('turn-change');
        }
      }
    });

    // Get your player number
    socket.on('player-number', num => {
      if (num === -1) {
        infoDisplay.innerHTML = "Sorry, the server is full"
        animateElement(infoDisplay, 'shake', 500);
      } else {
        playerNum = parseInt(num)
        if(playerNum === 1) currentPlayer = "enemy"

        console.log(`You are player ${playerNum + 1}`)

        // Initialize your own status indicator
        const playerStatusId = `player${playerNum + 1}-status`
        const playerStatusElement = document.getElementById(playerStatusId)
        if (playerStatusElement) {
          const statusDot = playerStatusElement.querySelector('.status-dot')
          const statusLabel = playerStatusElement.querySelector('.status-label')
          
          if (statusDot) {
            statusDot.classList.add('active')
            
            if (statusLabel) {
              statusLabel.textContent = 'You'
              statusLabel.style.color = '#00bfff'
            }
            
            playerStatusElement.style.fontWeight = 'bold'
            playerStatusElement.style.boxShadow = '0 0 10px rgba(0, 255, 255, 0.5)'
          }
        }

        // Get other player status
        socket.emit('check-players')
        
        // Set initial turn indicator to setup mode
        updateTurnIndicator(null, 'setup');
      }
    })

    // Handle server error
    socket.on('error', msg => {
      infoDisplay.innerHTML = msg
      animateElement(infoDisplay, 'shake', 500);
    })

    // Another player has connected or disconnected
    socket.on('player-connection', num => {
      console.log(`Player ${parseInt(num) + 1} connection changed`)
      playerConnectedOrDisconnected(num)
    })

    // Update the enemy-ready handler
    socket.on('enemy-ready', num => {
      enemyReady = true
      
      // Mark enemy player as ready
      playerReady(num)
      
      // Show notification to place ships if not ready yet
      if (!ready) {
        infoDisplay.innerHTML = "<span class='highlight-text'>Opponent is READY!</span> Place your ships and click Ready."
        infoDisplay.style.color = '#FFD700'
        animateElement(infoDisplay, 'pulse', 800)
        
        // Add visual highlight to Ready button
        startButton.classList.add('highlight-ready')
        animateElement(startButton, 'pulse', 1000)
      }
      // Note: We're not setting turn indicators here anymore
      // That will be done when both players are ready and server sends 'game-started'
    })

    // Check player status
    socket.on('check-players', players => {
      players.forEach((p, i) => {
        if (i === playerNum) return // Skip current player, already handled
        
        // Update connection status
        if (p.connected) {
          playerConnectedOrDisconnected(i)
        } else {
          // Make sure disconnected players show as disconnected
          const playerStatusId = `player${i + 1}-status`
          const playerStatusElement = document.getElementById(playerStatusId)
          if (playerStatusElement) {
            const statusDot = playerStatusElement.querySelector('.status-dot')
            const statusLabel = playerStatusElement.querySelector('.status-label')
            
            if (statusDot && statusDot.classList.contains('active')) {
              statusDot.classList.remove('active')
              
              if (statusLabel) {
                statusLabel.textContent = 'Disconnected'
                statusLabel.style.color = ''
              }
            }
          }
        }
        
        // Update ready status
        if (p.ready) {
          playerReady(i)
          if (i !== playerNum) enemyReady = true
        }
      })
    })

    // On Timeout
    socket.on('timeout', () => {
      infoDisplay.innerHTML = 'You have reached the 10 minute limit'
      animateElement(infoDisplay, 'shake', 500);
    })

    // Fix the ready button click handler
    startButton.addEventListener('click', () => {
      if(allShipsPlaced) {
        // Mark user as ready
        ready = true
        
        // Update turn indicator to "WAITING" state
        updateTurnIndicator(null, 'waiting');
        
        // Rest of the existing code
        const playerStatusId = `player${playerNum + 1}-status`
        const playerStatusElement = document.getElementById(playerStatusId)
        
        if (playerStatusElement) {
          // Add ready class to the player indicator
          playerStatusElement.classList.add('ready')
          
          // Update the status dot
          const statusDot = playerStatusElement.querySelector('.status-dot')
          if (statusDot) {
            statusDot.classList.add('ready')
          }
          
          // Update status text
          const statusLabel = playerStatusElement.querySelector('.status-label')
          if (statusLabel) {
            statusLabel.textContent = 'Ready!'
            statusLabel.style.color = '#FFD700'
            statusLabel.style.fontWeight = 'bold'
          }
          
          // Change the Ready button appearance
          startButton.textContent = 'Waiting...'
          startButton.style.backgroundColor = '#FFD700'
          startButton.style.cursor = 'default'
          startButton.disabled = true
        }
        
        // Add transition effect when starting game
        animateElement(startButton, 'btn-click', 300);
        
        // Tell the server we're ready
        socket.emit('player-ready')
        
        // Show waiting message if enemy is not ready yet
        if (!enemyReady) {
          infoDisplay.innerHTML = "You're ready - waiting for opponent..."
          infoDisplay.style.color = '#00bfff'
        }
        // Note: We don't initialize the game here anymore
        // That will be done when both players are ready and server sends 'game-started'
      } else {
        infoDisplay.innerHTML = "Please place all ships"
        animateElement(infoDisplay, 'shake', 500);
      }
    });

    // Fix the fire handling to wait for server confirmation of turn
    computerSquares.forEach(square => {
      square.addEventListener('click', () => {
        // Only allow clicking if it's the player's turn, both are ready, and game isn't over
        if(currentPlayer === 'user' && ready && enemyReady && !isGameOver) {
          // Prevent multiple clicks on the same square or clicking while waiting for response
          if(square.classList.contains('boom') || square.classList.contains('miss') || 
             square.classList.contains('processing')) return
          
          // Mark square as being processed to prevent multiple clicks
          square.classList.add('processing');
          
          // Record the shot
          shotFired = square.dataset.id
          
          // Add click effect
          animateElement(square, 'grid-click', 300);
          
          // Do not switch turns here. Wait for server confirmation
          // But disable further clicks
          computerSquares.forEach(s => {
            s.style.pointerEvents = 'none';
          });
          
          // Send the shot to the server
          socket.emit('fire', shotFired)
        }
      })
    });

    // Update the fire-reply handler
    socket.on('fire-reply', classList => {
      // Prevent processing if the game is over
      if (isGameOver) return;
      
      // Remove processing class from all squares
      computerSquares.forEach(sq => {
        sq.classList.remove('processing');
        sq.style.pointerEvents = '';  // Re-enable clicking
      });
      
      // Process the shot result
      revealSquare(classList)
      
      // Ensure checkForWins is called after DOM is updated
      setTimeout(() => {
        // Check for wins
        const gameEnded = checkForWins();
        
        console.log("Game ended check:", gameEnded);
        
        // If game didn't end, prepare for next turn
        if (!gameEnded && !isGameOver) {
          console.log("Game continues - waiting for turn update");
        }
      }, 300);
    });

    // Improve enemy's shot processing 
    socket.on('fire', id => {
      // Prevent processing if game is over
      if (isGameOver) return;
      
      // Process the enemy's move
      enemyGo(id)
      
      // Ensure checkForWins is called after DOM is updated
      setTimeout(() => {
        // Check for wins
        const gameEnded = checkForWins();
        
        // If game didn't end, send reply and continue
        if (!gameEnded && !isGameOver) {
          const square = userSquares[id]
          socket.emit('fire-reply', square.classList)
        }
      }, 300);
    });

    // Re-add the game-over handler
    socket.on('game-over', data => {
      // We already handled our own game over, so we only need to process opponent wins
      if (data.winner !== playerNum && !isGameOver) {
        isGameOver = true;
        showDefeatScreen();
      }
    });

    function playerConnectedOrDisconnected(num) {
      // Fix the selector to match the actual HTML structure in multiplayer.html
      // The player indicators have IDs player1-status and player2-status
      const playerIndex = parseInt(num) + 1
      const playerStatusId = `player${playerIndex}-status`
      const playerStatusElement = document.getElementById(playerStatusId)
      
      if (playerStatusElement) {
        // Find the status dot within the player status element
        const statusDot = playerStatusElement.querySelector('.status-dot')
        const statusLabel = playerStatusElement.querySelector('.status-label')
        
        if (statusDot) {
      batchUpdate(() => {
            // Toggle the 'connected' class to indicate connection status
            statusDot.classList.toggle('active')
            
            // Update status label
            if (statusLabel) {
              if (statusDot.classList.contains('active')) {
                statusLabel.textContent = 'Connected'
              } else {
                statusLabel.textContent = 'Disconnected'
                
                // If opponent disconnected during the game, show a message
                if (ready && enemyReady && !isGameOver && parseInt(num) !== playerNum) {
                  infoDisplay.innerHTML = "Your opponent disconnected!"
                  animateElement(infoDisplay, 'shake', 500)
                }
              }
            }
            
            // Add connection animation to the player indicator
            if (statusDot.classList.contains('active')) {
              animateElement(playerStatusElement, 'fadeIn', 500)
            }
            
            // Highlight the current player
            if (parseInt(num) === playerNum) {
              playerStatusElement.style.fontWeight = 'bold'
              // Add visual indicator for current player
              playerStatusElement.style.boxShadow = '0 0 10px rgba(0, 255, 255, 0.5)'
              
              // Update status label for current player
              if (statusLabel) {
                statusLabel.textContent = 'You'
                statusLabel.style.color = '#00bfff'
              }
            }
          })
        }
      } else {
        console.error(`Player status element #${playerStatusId} not found`)
      }
    }
    
    function playerReady(num) {
      // Get the player indicator element
      const playerIndex = parseInt(num) + 1
      const playerStatusId = `player${playerIndex}-status`
      const playerStatusElement = document.getElementById(playerStatusId)
      
      if (playerStatusElement) {
        // Find the status label
        const statusLabel = playerStatusElement.querySelector('.status-label')
        
        // Update the status dot to show ready state
        const statusDot = playerStatusElement.querySelector('.status-dot')
        if (statusDot) {
          statusDot.classList.add('ready')
        }
        
        // Update status text
        if (statusLabel) {
          statusLabel.textContent = 'Ready!'
          statusLabel.style.color = '#4CAF50'
          statusLabel.style.fontWeight = 'bold'
        }
        
        // Add visual effect to the player indicator
        animateElement(playerStatusElement, 'player-ready', 800)
        
        // If it's not the current player, show a notification
        if (parseInt(num) !== playerNum) {
          infoDisplay.innerHTML = "Opponent is ready! Place your ships and click Ready to start."
          infoDisplay.style.color = '#4CAF50'
          animateElement(infoDisplay, 'pulse', 800)
        }
      }
    }
  }

  // Single Player
  function startSinglePlayer() {
    generate(shipArray[0])
    generate(shipArray[1])
    generate(shipArray[2])
    generate(shipArray[3])
    generate(shipArray[4])

    startButton.addEventListener('click', () => {
      batchUpdate(() => {
      setupButtons.style.display = 'none'
        document.querySelector('.container').classList.add('game-starting');
      });
      
      // Add click effect
      animateElement(startButton, 'btn-click', 300);
      
      // Show game starting message with animation
      infoDisplay.innerHTML = "<span class='start-text'>GAME STARTING!</span>"
      infoDisplay.style.color = '#FFD700'
      infoDisplay.style.fontSize = '1.8rem'
      infoDisplay.style.fontWeight = 'bold'
      infoDisplay.style.textAlign = 'center'
      infoDisplay.style.textShadow = '0 0 10px rgba(255, 215, 0, 0.7)'
      animateElement(infoDisplay, 'pulse', 1000)
      
      // Clear game starting message after delay
      setTimeout(() => {
        // Clear the starting message
        infoDisplay.innerHTML = ""
        infoDisplay.style = ""
        
        // Show the turn indicator more prominently
        const turnContainer = turnDisplay.parentNode
        if (turnContainer) {
          turnContainer.classList.add('turn-container-enhanced')
        }
        
        // Start the game after message clears
      playGameSingle()
      }, 2000);
    })
  }

  //Create Board
  function createBoard(grid, squares) {
    for (let i = 0; i < width*width; i++) {
      const square = document.createElement('div')
      square.dataset.id = i
      
      // Add progressive animation delay for board squares
      square.style.animationDelay = `${i * 0.005}s`;
      
      grid.appendChild(square)
      squares.push(square)
    }
  }

  //Draw the computers ships in random locations
  function generate(ship) {
    let randomDirection = Math.floor(Math.random() * ship.directions.length)
    let current = ship.directions[randomDirection]
    if (randomDirection === 0) direction = 1
    if (randomDirection === 1) direction = 10
    let randomStart = Math.abs(Math.floor(Math.random() * computerSquares.length - (ship.directions[0].length * direction)))

    const isTaken = current.some(index => computerSquares[randomStart + index].classList.contains('taken'))
    const isAtRightEdge = current.some(index => (randomStart + index) % width === width - 1)
    const isAtLeftEdge = current.some(index => (randomStart + index) % width === 0)

    if (!isTaken && !isAtRightEdge && !isAtLeftEdge) current.forEach(index => computerSquares[randomStart + index].classList.add('taken', ship.name))
    else generate(ship)
  }
  

  // Add this helper function to ensure ships are displayed correctly
  function updateShipDisplay() {
    // Update all ships
    const ships = document.querySelectorAll('.ship');
    
    ships.forEach(ship => {
      const isVertical = ship.classList.contains('vertical');
      const shipLength = ship.childElementCount;
      
      // Set proper dimensions based on orientation
      if (isVertical) {
        ship.style.width = '4.2vmin';
        ship.style.height = `calc(4.2vmin * ${shipLength})`;
        
        // Update internal divs
        Array.from(ship.children).forEach(div => {
          div.style.width = '4.2vmin';
          div.style.height = '4.2vmin';
          div.style.margin = '0';
        });
      } else {
        ship.style.width = `calc(4.2vmin * ${shipLength})`;
        ship.style.height = '4.2vmin';
        
        // Update internal divs
        Array.from(ship.children).forEach(div => {
          div.style.width = '4.2vmin';
          div.style.height = '4.2vmin';
          div.style.margin = '0';
        });
      }
    });
  }

  // Modify the rotate function to use the helper
  function rotate() {
    if (isHorizontal) {
      destroyer.classList.add('destroyer-container-vertical');
      submarine.classList.add('submarine-container-vertical');
      cruiser.classList.add('cruiser-container-vertical');
      battleship.classList.add('battleship-container-vertical');
      carrier.classList.add('carrier-container-vertical');
      
      // Add vertical class to all ships
      ships.forEach(ship => {
        ship.classList.add('vertical');
      });
      
      isHorizontal = false;
      
      // Update all ship displays
      updateShipDisplay();
      
      // Play rotation animation
      ships.forEach(ship => {
        animateElement(ship, 'rotate-ship', 500);
      });
      
      return;
    }
    
    if (!isHorizontal) {
      destroyer.classList.remove('destroyer-container-vertical');
      submarine.classList.remove('submarine-container-vertical');
      cruiser.classList.remove('cruiser-container-vertical');
      battleship.classList.remove('battleship-container-vertical');
      carrier.classList.remove('carrier-container-vertical');
      
      // Remove vertical class from all ships
      ships.forEach(ship => {
        ship.classList.remove('vertical');
      });
      
      isHorizontal = true;
      
      // Update all ship displays
      updateShipDisplay();
      
      // Play rotation animation
      ships.forEach(ship => {
        animateElement(ship, 'rotate-ship', 500);
      });
      
      return;
    }
  }
  rotateButton.addEventListener('click', rotate)

  //move around user ship
  ships.forEach(ship => ship.addEventListener('dragstart', dragStart))
  userSquares.forEach(square => square.addEventListener('dragstart', dragStart))
  userSquares.forEach(square => square.addEventListener('dragover', dragOver))
  userSquares.forEach(square => square.addEventListener('dragenter', dragEnter))
  userSquares.forEach(square => square.addEventListener('dragleave', dragLeave))
  userSquares.forEach(square => square.addEventListener('drop', dragDrop))
  userSquares.forEach(square => square.addEventListener('dragend', dragEnd))

  let selectedShipNameWithIndex
  let draggedShip
  let draggedShipLength

  ships.forEach(ship => ship.addEventListener('mousedown', (e) => {
    selectedShipNameWithIndex = e.target.id
  }))

  function dragStart() {
    draggedShip = this
    draggedShipLength = this.childNodes.length
    
    // Add dragging effect
    setTimeout(() => this.classList.add('dragging'), 0);
  }

  function dragOver(e) {
    e.preventDefault()
  }

  function dragEnter(e) {
    e.preventDefault()
    // Add visual feedback when dragging over valid squares
    this.classList.add('drag-over');
  }

  function dragLeave() {
    // Remove feedback effect
    this.classList.remove('drag-over');
  }

  // Fix vertical ship visual display
  function fixVerticalShips() {
    // Update all taken vertical cells
    const verticalCells = document.querySelectorAll('.taken.vertical');
    verticalCells.forEach(cell => {
      // Ensure vertical cells have proper styling
      cell.style.margin = '0';
      cell.style.padding = '0';
      
      // Make sure ship type color is preserved
      if (cell.classList.contains('destroyer')) {
        cell.style.backgroundColor = 'var(--destroyer-color)';
      } else if (cell.classList.contains('submarine')) {
        cell.style.backgroundColor = 'var(--submarine-color)';
      } else if (cell.classList.contains('cruiser')) {
        cell.style.backgroundColor = 'var(--cruiser-color)';
      } else if (cell.classList.contains('battleship')) {
        cell.style.backgroundColor = 'var(--battleship-color)';
      } else if (cell.classList.contains('carrier')) {
        cell.style.backgroundColor = 'var(--carrier-color)';
      }
    });
  }

  // Call this after ship placement in dragDrop
  function dragDrop() {
    let shipNameWithLastId = draggedShip.lastChild.id
    let shipClass = shipNameWithLastId.slice(0, -2)
    let lastShipIndex = parseInt(shipNameWithLastId.substr(-1))
    let shipLastId = lastShipIndex + parseInt(this.dataset.id)
    const notAllowedHorizontal = [0,10,20,30,40,50,60,70,80,90,1,11,21,31,41,51,61,71,81,91,2,22,32,42,52,62,72,82,92,3,13,23,33,43,53,63,73,83,93]
    const notAllowedVertical = [99,98,97,96,95,94,93,92,91,90,89,88,87,86,85,84,83,82,81,80,79,78,77,76,75,74,73,72,71,70,69,68,67,66,65,64,63,62,61,60]
    
    let newNotAllowedHorizontal = notAllowedHorizontal.splice(0, 10 * lastShipIndex)
    let newNotAllowedVertical = notAllowedVertical.splice(0, 10 * lastShipIndex)

    let shipLastIdHorizontal = shipLastId % 10
    let shipLastIdVertical = Math.floor(shipLastId / 10)
    let selectedShipIndex = parseInt(selectedShipNameWithIndex.substr(-1))
    shipLastId = shipLastId - selectedShipIndex

    // Remove drag-over class
    this.classList.remove('drag-over');
    // Remove dragging effect
    draggedShip.classList.remove('dragging');

    // Check if ship is out of bounds or overlapping
    if (isHorizontal) {
      // Check for right edge boundary
      const rightBoundary = Math.floor((parseInt(this.dataset.id) - selectedShipIndex) / 10) * 10 + 10;
      const lastSquare = parseInt(this.dataset.id) - selectedShipIndex + draggedShipLength - 1;
      
      if (lastSquare >= rightBoundary) {
        return; // Ship would cross the right boundary
      }
      
      // Check for overlapping
      let overlapping = false;
      for (let i = 0; i < draggedShipLength; i++) {
        const squareIndex = parseInt(this.dataset.id) - selectedShipIndex + i;
        // Check if square exists and not taken
        if (squareIndex < 0 || squareIndex >= 100 || 
            userSquares[squareIndex].classList.contains('taken')) {
          overlapping = true;
          break;
        }
      }
      
      if (!overlapping) {
        for (let i = 0; i < draggedShipLength; i++) {
          let directionClass;
          if (i === 0) directionClass = 'start';
          else if (i === draggedShipLength - 1) directionClass = 'end';
          else directionClass = 'horizontal';
          
          const squareIndex = parseInt(this.dataset.id) - selectedShipIndex + i;
          
          // Add all necessary classes
          userSquares[squareIndex].classList.add('taken');
          userSquares[squareIndex].classList.add('horizontal');
          userSquares[squareIndex].classList.add(directionClass);
          userSquares[squareIndex].classList.add(shipClass);
          
          // Set visual attributes
          userSquares[squareIndex].setAttribute('data-ship', shipClass);
          userSquares[squareIndex].setAttribute('data-index', i);
          
          // Apply appropriate ship color
          if (shipClass === 'destroyer') {
            userSquares[squareIndex].style.backgroundColor = 'var(--destroyer-color)';
          } else if (shipClass === 'submarine') {
            userSquares[squareIndex].style.backgroundColor = 'var(--submarine-color)';
          } else if (shipClass === 'cruiser') {
            userSquares[squareIndex].style.backgroundColor = 'var(--cruiser-color)';
          } else if (shipClass === 'battleship') {
            userSquares[squareIndex].style.backgroundColor = 'var(--battleship-color)';
          } else if (shipClass === 'carrier') {
            userSquares[squareIndex].style.backgroundColor = 'var(--carrier-color)';
          }
          
          // Add placement effect
          userSquares[squareIndex].classList.add('ship-placed-effect');
          setTimeout(() => {
            userSquares[squareIndex].classList.remove('ship-placed-effect');
          }, 600);
        }
      } else {
        return;
      }
    } else {
      // Vertical ship placement
      
      // Get the starting position on the grid
      const startId = parseInt(this.dataset.id);
      
      // Check for bottom edge boundary
      if (startId + (draggedShipLength - 1) * width >= 100) {
        return; // Ship would go off the bottom edge
      }
      
      // Check for overlapping
      let overlapping = false;
      for (let i = 0; i < draggedShipLength; i++) {
        const squareIndex = startId + (width * i);
        if (squareIndex < 0 || squareIndex >= 100 || 
            userSquares[squareIndex].classList.contains('taken')) {
          overlapping = true;
          break;
        }
      }
      
      if (!overlapping) {
        for (let i = 0; i < draggedShipLength; i++) {
          let directionClass;
          if (i === 0) directionClass = 'start';
          else if (i === draggedShipLength - 1) directionClass = 'end';
          else directionClass = 'vertical';
          
          const squareIndex = startId + (width * i);
          
          // Add all necessary classes
          userSquares[squareIndex].classList.add('taken');
          userSquares[squareIndex].classList.add('vertical');
          userSquares[squareIndex].classList.add(directionClass);
          userSquares[squareIndex].classList.add(shipClass);
          
          // Set visual attributes
          userSquares[squareIndex].setAttribute('data-ship', shipClass);
          userSquares[squareIndex].setAttribute('data-index', i);
          
          // Apply appropriate ship color directly
          if (shipClass === 'destroyer') {
            userSquares[squareIndex].style.backgroundColor = 'var(--destroyer-color)';
          } else if (shipClass === 'submarine') {
            userSquares[squareIndex].style.backgroundColor = 'var(--submarine-color)';
          } else if (shipClass === 'cruiser') {
            userSquares[squareIndex].style.backgroundColor = 'var(--cruiser-color)';
          } else if (shipClass === 'battleship') {
            userSquares[squareIndex].style.backgroundColor = 'var(--battleship-color)';
          } else if (shipClass === 'carrier') {
            userSquares[squareIndex].style.backgroundColor = 'var(--carrier-color)';
          }
          
          // Add placement effect
          userSquares[squareIndex].classList.add('ship-placed-effect');
          setTimeout(() => {
            userSquares[squareIndex].classList.remove('ship-placed-effect');
          }, 600);
      }
    } else {
      return;
      }
    }
    
    // Remove the dragged ship
    displayGrid.removeChild(draggedShip);
    
    // Check if all ships have been placed
    if (!displayGrid.querySelector('.ship')) {
      allShipsPlaced = true;
      // Show animation for ready state
      startButton.classList.add('ready-to-start');
      animateElement(startButton, 'pulse', 1000);
    }
  }

  function dragEnd() {
    // Clean up any remaining drag effects
    this.classList.remove('dragging');
    userSquares.forEach(square => square.classList.remove('drag-over'));
  }

  // Game Logic for Single Player
  function playGameSingle() {
    if (isGameOver) return
    
    updateTurnDisplay(currentPlayer);
      
      // Set up ONE TIME event listeners for firing - this was causing the bug
      const handleSquareClick = function(e) {
        if(!this.classList.contains('boom') && !this.classList.contains('miss')) {
          // Remove all click listeners to prevent duplicates
          computerSquares.forEach(sq => {
            sq.removeEventListener('click', handleSquareClick)
          })
          
            // Shot fired
          shotFired = this.dataset.id
          const classList = this.classList
          
          if (classList.contains('taken')) {
            this.classList.add('boom')
            // Add hit animation
            animateElement(this, 'shake', 500)
            // Update hit counter
            hits++
            if (statsDisplay.hitsCount) {
              statsDisplay.hitsCount.textContent = hits
            }
          } else {
            this.classList.add('miss')
          }
          
          // Update total shots
          totalShots++
          if (statsDisplay.shotsCount) {
            statsDisplay.shotsCount.textContent = totalShots
          }
          
          // Update accuracy
          if (statsDisplay.accuracyDisplay && totalShots > 0) {
            const accuracy = Math.round((hits / totalShots) * 100)
            statsDisplay.accuracyDisplay.textContent = accuracy + '%'
          }
            
            // Add click effect
          animateElement(this, 'grid-click', 300)
          
          // Check for wins before changing player
          checkForWins()
          
          if (!isGameOver) {
            // Switch to computer's turn
            currentPlayer = 'computer'
          updateTurnDisplay(currentPlayer)
          
            // Call the function again with computer as current player
            setTimeout(() => {
            playGameSingle()
            }, 500)
          }
        }
      }
      
    if (currentPlayer === 'user') {
      // Add click event listeners to computer grid
      computerSquares.forEach(square => {
        square.addEventListener('click', handleSquareClick)
      })
    }
    
    if (currentPlayer === 'computer') {
      // Add thinking delay for better user experience
      setTimeout(() => {
        let randomGo = Math.floor(Math.random() * userSquares.length)
        const maxTries = 100 // Prevent infinite loop
        let tries = 0
        
        // Find a square that hasn't been hit yet
        while ((userSquares[randomGo].classList.contains('boom') || 
                userSquares[randomGo].classList.contains('miss')) && 
               tries < maxTries) {
          randomGo = Math.floor(Math.random() * userSquares.length)
          tries++
        }
        
        if (tries < maxTries) {
          const hit = userSquares[randomGo].classList.contains('taken')
          userSquares[randomGo].classList.add(hit ? 'boom' : 'miss')
          
          if (hit) {
            animateElement(userSquares[randomGo], 'shake', 500)
          }
          
          checkForWins()
          
          if (!isGameOver) {
          currentPlayer = 'user'
            updateTurnDisplay(currentPlayer)
            setTimeout(() => {
          playGameSingle()
            }, 500)
          }
        } else {
          // All squares have been hit, game should be over
          checkForWins()
        }
      }, 1000)
    }
  }

  let destroyerCount = 0
  let submarineCount = 0
  let cruiserCount = 0
  let battleshipCount = 0
  let carrierCount = 0

  // Fix the revealSquare function to handle race conditions
  function revealSquare(classList) {
    const enemySquare = computerSquares[shotFired]
    const obj = Object.values(classList)
    if (!enemySquare.classList.contains('boom') && !isGameOver) {
      if (obj.includes('destroyer')) destroyerCount++
      if (obj.includes('submarine')) submarineCount++
      if (obj.includes('cruiser')) cruiserCount++
      if (obj.includes('battleship')) battleshipCount++
      if (obj.includes('carrier')) carrierCount++
      
      // Check if it's a hit
      if (obj.some(className => className !== 'boom' && className !== 'miss' && className !== 'taken')) {
        enemySquare.classList.add('boom')
        
        // Play hit sound
        if (window.playSound) window.playSound('hit');
        
        // Show hit animation
        enemySquare.classList.add('hit-animation');
        setTimeout(() => {
          enemySquare.classList.remove('hit-animation');
        }, 500);
        
        // Update stats if enabled
        if (statsDisplay.hitsCount) {
          hits++;
          statsDisplay.hitsCount.textContent = hits;
          
          if (statsDisplay.accuracyDisplay) {
            const accuracy = Math.round((hits / totalShots) * 100);
            statsDisplay.accuracyDisplay.textContent = accuracy + '%';
          }
        }
      } else {
        enemySquare.classList.add('miss')
        
        // Play miss sound
        if (window.playSound) window.playSound('miss');
        
        // Show miss animation
        enemySquare.classList.add('miss-animation');
        setTimeout(() => {
          enemySquare.classList.remove('miss-animation');
        }, 500);
      }
      
      // Check for wins after applying the hit/miss
      checkForWins();
      
      // Update whose go it is if the game isn't over
      if (!isGameOver) {
        currentPlayer = 'enemy';
        
        // For multiplayer, let's wait for the server's turn update
        if (gameMode === 'singlePlayer') {
          // Only update UI in single player mode
          updateTurnIndicator(currentPlayer, 'game');
        }
      }
    }
  }

  let cpuDestroyerCount = 0
  let cpuSubmarineCount = 0
  let cpuCruiserCount = 0
  let cpuBattleshipCount = 0
  let cpuCarrierCount = 0


  // Improve enemyGo function to handle multiplayer better
  function enemyGo(square) {
    // Don't process if game is over
    if (isGameOver) return
    
    // For singlePlayer, generate a random square
    if (gameMode === 'singlePlayer') square = Math.floor(Math.random() * userSquares.length)
    
    // Guard against invalid square
    if (!userSquares[square]) return;
    
    if (!userSquares[square].classList.contains('boom') && !userSquares[square].classList.contains('miss')) {
      const hit = userSquares[square].classList.contains('taken')
      userSquares[square].classList.add(hit ? 'boom' : 'miss')
      
      // Add hit animation for better feedback
      if (hit) {
        animateElement(userSquares[square], 'shake', 500)
      
        // Count ship hits
      if (userSquares[square].classList.contains('destroyer')) cpuDestroyerCount++
      if (userSquares[square].classList.contains('submarine')) cpuSubmarineCount++
      if (userSquares[square].classList.contains('cruiser')) cpuCruiserCount++
      if (userSquares[square].classList.contains('battleship')) cpuBattleshipCount++
      if (userSquares[square].classList.contains('carrier')) cpuCarrierCount++
      }
    } else if (gameMode === 'singlePlayer') {
      // For single player, retry with a different square
      enemyGo()
    }
  }

  // Fix the checkForWins function with more reliable detection
  function checkForWins() {
    // Don't check for wins if game is already over
    if (isGameOver) {
      return false;
    }
    
    // Count ship cells and hits by directly targeting elements with ship classes
    const shipTypes = ['destroyer', 'submarine', 'cruiser', 'battleship', 'carrier'];
    
    // Count player's ships and hits
    let playerShipCells = 0;
    let playerShipHits = 0;
    
    // Count enemy's ships and hits
    let enemyShipCells = 0;
    let enemyShipHits = 0;
    
    // Count each ship type for better accuracy
    shipTypes.forEach(shipType => {
      // Player ships
      const playerShips = userSquares.filter(square => square.classList.contains(shipType));
      playerShipCells += playerShips.length;
      
      // Count player ship hits
      const playerHits = playerShips.filter(square => square.classList.contains('boom'));
      playerShipHits += playerHits.length;
      
      // Count enemy ships
      const enemyShips = computerSquares.filter(square => square.classList.contains(shipType));
      enemyShipCells += enemyShips.length;
      
      // Count enemy ship hits
      const enemyHits = enemyShips.filter(square => square.classList.contains('boom'));
      enemyShipHits += enemyHits.length;
    });
    
    console.log(`Player ships: ${playerShipCells}, Player hits: ${playerShipHits}`);
    console.log(`Enemy ships: ${enemyShipCells}, Enemy hits: ${enemyShipHits}`);
    
    // Player wins if all enemy ships are hit
    if (enemyShipCells > 0 && enemyShipHits === enemyShipCells) {
      console.log("PLAYER WINS - All enemy ships hit!");
      isGameOver = true;
      
      // Play victory sound
      if (window.playSound) window.playSound('game-over');
      
      // Show victory screen with a slight delay to ensure UI updates
      setTimeout(() => {
        showVictoryScreen();
      }, 500);
      
      // If in multiplayer mode, notify server of game completion
      if (gameMode === 'multiPlayer' && window.gameSocket) {
        window.gameSocket.emit('game-over', { winner: playerNum });
      }
      
      return true;
    }
    
    // Enemy wins if all player ships are hit
    if (playerShipCells > 0 && playerShipHits === playerShipCells) {
      console.log("ENEMY WINS - All player ships hit!");
      isGameOver = true;
      
      // Play defeat sound
      if (window.playSound) window.playSound('game-over');
      
      // Show defeat screen with a slight delay to ensure UI updates
      setTimeout(() => {
        showDefeatScreen();
      }, 500);
      
      // If in multiplayer mode, notify server of game completion
      if (gameMode === 'multiPlayer' && window.gameSocket) {
        window.gameSocket.emit('game-over', { winner: playerNum === 0 ? 1 : 0 });
      }
      
      return true;
    }
    
    return false;
  }

  // Enhanced victory screen with animations
  function showVictoryScreen() {
    console.log("Showing victory screen");
    isGameOver = true;
    
    // Create victory overlay
    const victoryOverlay = document.createElement('div');
    victoryOverlay.className = 'game-end-overlay victory-overlay';
    
    // Create content container
    const contentContainer = document.createElement('div');
    contentContainer.className = 'end-content-container';
    
    // Create victory message
    const victoryMessage = document.createElement('h1');
    victoryMessage.className = 'end-title victory-title';
    victoryMessage.textContent = 'VICTORY!';
    
    // Create victory description
    const victoryDesc = document.createElement('p');
    victoryDesc.className = 'end-description';
    victoryDesc.textContent = 'You destroyed the enemy fleet!';
    
    // Add stats if available
    if (statsDisplay.shotsCount) {
      const statsInfo = document.createElement('div');
      statsInfo.className = 'end-stats';
      statsInfo.innerHTML = `
        <p>Shots fired: <span>${statsDisplay.shotsCount.textContent}</span></p>
        <p>Hits: <span>${statsDisplay.hitsCount.textContent}</span></p>
        <p>Accuracy: <span>${statsDisplay.accuracyDisplay.textContent}</span></p>
      `;
      contentContainer.appendChild(statsInfo);
    }
    
    // Create play again button
    const playAgainBtn = document.createElement('button');
    playAgainBtn.className = 'end-button';
    playAgainBtn.textContent = 'Play Again';
    playAgainBtn.addEventListener('click', () => {
      window.location.reload();
    });
    
    // Assemble the overlay
    contentContainer.appendChild(victoryMessage);
    contentContainer.appendChild(victoryDesc);
    contentContainer.appendChild(playAgainBtn);
    victoryOverlay.appendChild(contentContainer);
    
    // Add to the body
    document.body.appendChild(victoryOverlay);
    
    // Add animation class after a small delay
    setTimeout(() => {
      victoryOverlay.classList.add('active');
      // Add the winner class to the grid for visual effect
      userGrid.classList.add('winner');
      
      // Add winning confetti effect
      createConfetti();
    }, 100);
  }
  
  // Enhanced defeat screen with animations
  function showDefeatScreen() {
    console.log("Showing defeat screen");
    isGameOver = true;
    
    // Create defeat overlay
    const defeatOverlay = document.createElement('div');
    defeatOverlay.className = 'game-end-overlay defeat-overlay';
    
    // Create content container
    const contentContainer = document.createElement('div');
    contentContainer.className = 'end-content-container';
    
    // Create defeat message
    const defeatMessage = document.createElement('h1');
    defeatMessage.className = 'end-title defeat-title';
    defeatMessage.textContent = 'DEFEATED';
    
    // Create defeat description
    const defeatDesc = document.createElement('p');
    defeatDesc.className = 'end-description';
    defeatDesc.textContent = 'Your fleet has been destroyed.';
    
    // Create play again button
    const playAgainBtn = document.createElement('button');
    playAgainBtn.className = 'end-button';
    playAgainBtn.textContent = 'Play Again';
    playAgainBtn.addEventListener('click', () => {
      window.location.reload();
    });
    
    // Assemble the overlay
    contentContainer.appendChild(defeatMessage);
    contentContainer.appendChild(defeatDesc);
    contentContainer.appendChild(playAgainBtn);
    defeatOverlay.appendChild(contentContainer);
    
    // Add to the body
    document.body.appendChild(defeatOverlay);
    
    // Add animation class after a small delay
    setTimeout(() => {
      defeatOverlay.classList.add('active');
      // Add the winner class to the computer grid for visual effect
      computerGrid.classList.add('winner');
    }, 100);
  }

  // Game Over function
  function gameOver() {
    isGameOver = true
    startButton.removeEventListener('click', playGameSingle)
  }

  // Confetti effect for winning
  function createConfetti() {
    const confettiCount = 200;
    const container = document.querySelector('body');
    
    for (let i = 0; i < confettiCount; i++) {
      const confetti = document.createElement('div');
      confetti.classList.add('confetti');
      
      const size = Math.random() * 10 + 5;
      const color = `hsl(${Math.random() * 360}, 100%, 50%)`;
      
      confetti.style.width = `${size}px`;
      confetti.style.height = `${size}px`;
      confetti.style.background = color;
      confetti.style.left = `${Math.random() * 100}vw`;
      confetti.style.top = '-20px';
      confetti.style.position = 'fixed';
      confetti.style.zIndex = '1001';  // Above the game end overlay
      confetti.style.borderRadius = '50%';
      confetti.style.animation = `fall ${Math.random() * 5 + 2}s linear forwards`;
      confetti.style.animationDelay = `${Math.random() * 5}s`;
      
      container.appendChild(confetti);
      
      // Remove confetti after animation completes
      setTimeout(() => {
        confetti.remove();
      }, 8000);
    }
  }
  
  // Add CSS for confetti animation if it was removed
  const confettiStyle = document.createElement('style');
  confettiStyle.innerHTML = `
    @keyframes fall {
      to {
        transform: translateY(100vh) rotate(720deg);
      }
    }
    
    .confetti {
      pointer-events: none;
    }
  `;
  document.head.appendChild(confettiStyle);

  // Add this function to show ships better with the proper images
  function applyShipStyles() {
    // Make sure ship images are properly displayed
    document.querySelectorAll('.destroyer-container div').forEach((cell, i) => {
      cell.style.backgroundImage = 'url("/images/1.png")';
      cell.style.backgroundSize = 'cover';
      cell.style.backgroundRepeat = 'no-repeat';
    });
    
    document.querySelectorAll('.submarine-container div').forEach((cell, i) => {
      cell.style.backgroundImage = 'url("/images/2.png")';
      cell.style.backgroundSize = 'cover';
      cell.style.backgroundRepeat = 'no-repeat';
    });
    
    document.querySelectorAll('.cruiser-container div').forEach((cell, i) => {
      cell.style.backgroundImage = 'url("/images/3.png")';
      cell.style.backgroundSize = 'cover';
      cell.style.backgroundRepeat = 'no-repeat';
    });
    
    document.querySelectorAll('.battleship-container div').forEach((cell, i) => {
      cell.style.backgroundImage = 'url("/images/4.png")';
      cell.style.backgroundSize = 'cover';
      cell.style.backgroundRepeat = 'no-repeat';
    });
    
    document.querySelectorAll('.carrier-container div').forEach((cell, i) => {
      cell.style.backgroundImage = 'url("/images/5.png")';
      cell.style.backgroundSize = 'cover';
      cell.style.backgroundRepeat = 'no-repeat';
    });
  }

  // Call this function at the end of the DOMContentLoaded event
  applyShipStyles();

  // Add this event listener for the play again button if it exists
  const playAgainBtn = document.getElementById('play-again');
  if (playAgainBtn) {
    playAgainBtn.addEventListener('click', function() {
      window.location.reload();
    });
  }

  // Show waiting modal in multiplayer if it exists
  if (gameMode === 'multiPlayer') {
    const waitingModal = document.getElementById('waiting-modal');
    if (waitingModal) {
      waitingModal.classList.add('active');
      
      // Hide when a second player connects
      socket.on('player-connection', num => {
        if (num !== playerNum) {
          waitingModal.classList.remove('active');
        }
      });
    }
  }

  // Add this function to handle theme-specific grid styling
  function updateGridThemeStyles() {
    // Check if dark theme is active
    const isDarkTheme = document.body.classList.contains('dark-theme');
    
    // Apply theme-specific styling to computer grid
    computerSquares.forEach(square => {
      if (isDarkTheme) {
        // For dark theme, ensure all grid cells have consistent color
        square.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--grid-bg');
      } else {
        // For light theme, reset to default
        square.style.backgroundColor = '';
      }
    });
  }

  // Call this when theme toggle is clicked
  function setupThemeChangeListener() {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('change', function() {
        setTimeout(updateGridThemeStyles, 50);
      });
    }
    
    // Also call it initially
    updateGridThemeStyles();
  }

  // Call this at the end of the DOMContentLoaded event
  setupThemeChangeListener();

  // Add ripple effect to all buttons
  function addRippleEffect() {
    const buttons = document.querySelectorAll('.btn, #rotate, #start, .splash-btn');
    
    buttons.forEach(button => {
      button.addEventListener('click', function(e) {
        // Create ripple element
        const ripple = document.createElement('span');
        ripple.classList.add('btn-ripple');
        this.appendChild(ripple);
        
        // Set ripple position based on click coordinates
        const rect = button.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        
        // Remove ripple after animation completes
        setTimeout(() => {
          ripple.remove();
        }, 600);
      });
    });
  }
  
  // Call function to add ripple effect
  addRippleEffect();

  // Add glowing border effect to splash buttons
  function addSplashButtonEffects() {
    const splashButtons = document.querySelectorAll('.splash-btn');
    
    splashButtons.forEach(button => {
      // Add mouseover effect
      button.addEventListener('mouseover', function() {
        // Add a glowing border pulse
        this.style.animation = 'borderPulse 1.5s infinite';
        
        // Add slight color shift
        this.style.backgroundColor = 'rgba(0, 120, 215, 0.8)';
        this.style.color = '#ffffff';
      });
      
      // Remove effects on mouseout
      button.addEventListener('mouseout', function() {
        this.style.animation = '';
        this.style.backgroundColor = '';
        this.style.color = '';
      });
    });
  }
  
  // Add this to DOMContentLoaded event
  addSplashButtonEffects();

  // Add some styles for win/loss messages
  const gameResultStyles = document.createElement('style');
  gameResultStyles.innerHTML = `
    .game-result {
      animation: pulseMessage 1.5s infinite;
      padding: 10px 20px;
      border-radius: 10px;
      margin-top: 10px;
      text-align: center;
    }
    
    .victory-text {
      color: #4CAF50;
      font-size: 2.5rem;
      font-weight: bold;
      text-shadow: 0 0 10px rgba(0, 255, 0, 0.7);
    }
    
    .defeat-text {
      color: #ff4444;
      font-size: 2.5rem;
      font-weight: bold;
      text-shadow: 0 0 10px rgba(255, 0, 0, 0.7);
    }
    
    @keyframes pulseMessage {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
    
    .winner {
      animation: winnerPulse 1.5s infinite;
    }
    
    @keyframes winnerPulse {
      0% { box-shadow: 0 0 15px rgba(0, 255, 255, 0.6); }
      50% { box-shadow: 0 0 25px rgba(0, 255, 255, 0.9); }
      100% { box-shadow: 0 0 15px rgba(0, 255, 255, 0.6); }
    }
  `;
  document.head.appendChild(gameResultStyles);

  // Add styles for the game state messages
  const gameStateStyles = document.createElement('style');
  gameStateStyles.innerHTML = `
    .highlight-text {
      color: #FFD700;
      font-weight: bold;
      text-shadow: 0 0 5px rgba(255, 215, 0, 0.5);
    }
    
    .start-text {
      color: #FFD700;
      font-size: 1.8rem;
      font-weight: bold;
      text-shadow: 0 0 10px rgba(255, 215, 0, 0.7);
      animation: startPulse 1.5s infinite;
      display: block;
      padding: 10px;
      text-align: center;
    }
    
    @keyframes startPulse {
      0% { transform: scale(1); text-shadow: 0 0 10px rgba(255, 215, 0, 0.7); }
      50% { transform: scale(1.05); text-shadow: 0 0 15px rgba(255, 215, 0, 0.9); }
      100% { transform: scale(1); text-shadow: 0 0 10px rgba(255, 215, 0, 0.7); }
    }
  `;
  document.head.appendChild(gameStateStyles);

  // Replace the turn styles with a new version that matches the images exactly
  const turnStyles = document.createElement('style');
  turnStyles.innerHTML = `
    /* Turn container styling - outer container with glow */
    .turn-container {
      width: 280px;
      margin: 10px auto;
      position: relative;
      border-radius: 10px;
      padding: 2px;
      background-color: transparent;
    }
    
    /* Player turn specific styling - outer border */
    .player-turn::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border-radius: 10px;
      border: 2px solid #00ff00;
      box-shadow: 0 0 15px #00ff00, 0 0 5px #00ff00 inset;
      z-index: -1;
    }
    
    /* Enemy turn specific styling - outer border */
    .enemy-turn::before, .computer-turn::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border-radius: 10px;
      border: 2px solid #ff0000;
      box-shadow: 0 0 15px #ff0000, 0 0 5px #ff0000 inset;
      z-index: -1;
    }
    
    /* Inner container that holds the text */
    .turn-text-container {
      width: 100%;
      height: 100%;
      background-color: rgba(5, 21, 50, 0.9);
      border-radius: 8px;
      position: relative;
      padding: 15px 0;
      /* Add inner border for depth */
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.8) inset;
    }
    
    /* Turn text styling */
    .your-turn, .enemy-turn, .computer-turn {
      display: block;
      font-size: 30px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 3px;
      text-align: center;
      line-height: 1.2;
    }
    
    .your-turn {
      color: #00ff00;
      text-shadow: 0 0 10px rgba(0, 255, 0, 0.7);
    }
    
    .enemy-turn, .computer-turn {
      color: #ff0000;
      text-shadow: 0 0 10px rgba(255, 0, 0, 0.7);
    }
    
    /* Indicator dots - outer large dots */
    .turn-container::before, .turn-container::after {
      content: "";
      position: absolute;
      width: 10px;
      height: 10px;
      background-color: #00ffff;
      border-radius: 50%;
      top: 50%;
      transform: translateY(-50%);
      z-index: 2;
      box-shadow: 0 0 8px #00ffff;
    }
    
    .turn-container::before {
      left: -18px;
    }
    
    .turn-container::after {
      right: -18px;
    }
    
    /* Inner smaller dots closer to the text */
    .turn-text-container::before, .turn-text-container::after {
      content: "";
      position: absolute;
      width: 6px;
      height: 6px;
      background-color: #00ffff;
      border-radius: 50%;
      top: 50%;
      transform: translateY(-50%);
      z-index: 2;
      box-shadow: 0 0 6px #00ffff;
    }
    
    .turn-text-container::before {
      left: 20px;
    }
    
    .turn-text-container::after {
      right: 20px;
    }
  `;
  document.head.appendChild(turnStyles);
  
  // Update the function to create the layered UI
  function updateTurnIndicator(currentPlayer, gameState) {
    const turnDisplayParent = document.getElementById('whose-go');
    if (!turnDisplayParent) return;
    
    // Create or get container
    let turnContainer = turnDisplayParent.querySelector('.turn-container');
    if (!turnContainer) {
      turnContainer = document.createElement('div');
      turnContainer.className = 'turn-container';
      turnDisplayParent.appendChild(turnContainer);
    }
    
    // Clear any previous content
    turnContainer.innerHTML = '';
    
    // Reset any previous classes but keep turn-container
    turnContainer.className = 'turn-container';
    
    // Create inner container for text
    const textContainer = document.createElement('div');
    textContainer.className = 'turn-text-container';
    
    // Create the turn text
    const turnText = document.createElement('span');
    
    if (gameState === 'setup') {
      // Pre-game state - show "Place Ships"
      turnText.className = 'waiting-text';
      turnText.textContent = 'PLACE SHIPS';
      turnText.style.color = '#00bfff';
      turnText.style.textShadow = '0 0 10px rgba(0, 191, 255, 0.7)';
      turnContainer.style.opacity = '0.7'; // Semi-visible during setup
    } else if (gameState === 'waiting') {
      // Waiting for opponent state
      turnText.className = 'waiting-text';
      turnText.textContent = 'WAITING';
      turnText.style.color = '#FFD700';
      turnText.style.textShadow = '0 0 10px rgba(255, 215, 0, 0.7)';
      turnContainer.style.opacity = '0.7'; // Semi-visible during waiting
    } else {
      // Active game state
      turnContainer.style.opacity = '1'; // Fully visible during game
      
      if (currentPlayer === 'user') {
        turnContainer.classList.add('player-turn');
        turnText.className = 'your-turn';
        turnText.textContent = 'YOUR TURN';
        
        // Highlight correct grid
        userGrid.classList.remove('active-grid');
        computerGrid.classList.add('active-grid');
      } else {
        turnContainer.classList.add('enemy-turn');
        turnText.className = 'enemy-turn';
        turnText.textContent = 'ENEMY TURN';
        
        // Highlight correct grid
        userGrid.classList.add('active-grid');
        computerGrid.classList.remove('active-grid');
      }
    }
    
    // Assemble the components
    textContainer.appendChild(turnText);
    turnContainer.appendChild(textContainer);
  }

  // Add immediate turn display setup on page load
  document.addEventListener('DOMContentLoaded', function() {
    // Set a default turn display that's hidden until the game starts
    initializeTurnDisplay();
  });
  
  // Function to initialize the turn display at page load
  function initializeTurnDisplay() {
    const turnDisplayParent = document.getElementById('whose-go');
    if (!turnDisplayParent) return;
    
    // Create container
    const turnContainer = document.createElement('div');
    turnContainer.className = 'turn-container';
    turnContainer.style.opacity = '0'; // Initially hidden
    
    // Create inner container
    const textContainer = document.createElement('div');
    textContainer.className = 'turn-text-container';
    
    // Create the turn text
    const turnText = document.createElement('span');
    turnText.className = 'waiting-text';
    turnText.textContent = 'PLACE SHIPS';
    turnText.style.color = '#00bfff';
    turnText.style.textShadow = '0 0 10px rgba(0, 191, 255, 0.7)';
    
    // Assemble the components
    textContainer.appendChild(turnText);
    turnContainer.appendChild(textContainer);
    
    // Replace existing content
    turnDisplayParent.innerHTML = '';
    turnDisplayParent.appendChild(turnContainer);
  }

  // Add styles for the waiting state
  const waitingStyles = document.createElement('style');
  waitingStyles.innerHTML = `
    .waiting-text {
      display: block;
      font-size: 28px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 3px;
      text-align: center;
      line-height: 1.2;
    }
    
    @keyframes fadeInOut {
      0% { opacity: 0.5; }
      50% { opacity: 1; }
      100% { opacity: 0.5; }
    }
    
    .turn-container {
      transition: opacity 0.5s ease;
    }
  `;
  document.head.appendChild(waitingStyles);

  // Add styles for various animations
  const animationStyles = document.createElement('style');
  animationStyles.innerHTML = `
    .rotate-ship {
      animation: rotateAnim 0.5s ease;
    }
    
    @keyframes rotateAnim {
      0% { transform: scale(1) rotate(0deg); }
      50% { transform: scale(1.1) rotate(90deg); transform-origin: center; }
      100% { transform: scale(1) rotate(0deg); }
    }
    
    .ship-placed {
      animation: placed 0.5s ease;
    }
    
    @keyframes placed {
      0% { transform: scale(1.1); }
      50% { transform: scale(0.9); }
      100% { transform: scale(1); }
    }
    
    .grid-click {
      animation: click 0.3s ease;
    }
    
    @keyframes click {
      0% { transform: scale(1); }
      50% { transform: scale(0.95); }
      100% { transform: scale(1); }
    }
    
    .active-grid {
      box-shadow: 0 0 20px rgba(0, 255, 255, 0.5);
      transform: translateY(-5px);
    }
    
    .player-ready {
      animation: ready 0.8s ease;
    }
    
    @keyframes ready {
      0% { transform: scale(1); }
      50% { transform: scale(1.1); }
      100% { transform: scale(1); }
    }
    
    .dragging {
      opacity: 0.5;
      transform: scale(1.05);
    }
    
    .drag-over {
      background-color: rgba(0, 255, 0, 0.1);
    }
    
    .ready-to-start {
      background-color: #4CAF50;
      box-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
    }
    
    .shake {
      animation: shake 0.5s ease;
    }
    
    .btn-click {
      animation: buttonClick 0.3s ease;
    }
    
    @keyframes buttonClick {
      0% { transform: scale(1); }
      50% { transform: scale(0.95); }
      100% { transform: scale(1); }
    }
    
    @keyframes shake {
      0% { transform: translate(0, 0); }
      10% { transform: translate(-5px, 0); }
      20% { transform: translate(5px, 0); }
      30% { transform: translate(-5px, 0); }
      40% { transform: translate(5px, 0); }
      50% { transform: translate(-5px, 0); }
      60% { transform: translate(5px, 0); }
      70% { transform: translate(-5px, 0); }
      80% { transform: translate(5px, 0); }
      90% { transform: translate(-5px, 0); }
      100% { transform: translate(0, 0); }
    }
  `;
  document.head.appendChild(animationStyles);

  // Helper function to count ships and verify victory conditions directly
  function forceCheckEndGame() {
    console.log("Forcing end game check...");
    
    // Direct hit count with ship types
    const shipTypes = ['destroyer', 'submarine', 'cruiser', 'battleship', 'carrier'];
    let totalPlayerShips = 0;
    let hitPlayerShips = 0;
    let totalEnemyShips = 0;
    let hitEnemyShips = 0;
    
    shipTypes.forEach(type => {
      // Player ships
      userSquares.forEach(square => {
        if (square.classList.contains(type)) {
          totalPlayerShips++;
          if (square.classList.contains('boom')) {
            hitPlayerShips++;
          }
        }
      });
      
      // Enemy ships
      computerSquares.forEach(square => {
        if (square.classList.contains(type)) {
          totalEnemyShips++;
          if (square.classList.contains('boom')) {
            hitEnemyShips++;
          }
        }
      });
    });
    
    console.log("DIRECT COUNT - Player:", hitPlayerShips, "/", totalPlayerShips);
    console.log("DIRECT COUNT - Enemy:", hitEnemyShips, "/", totalEnemyShips);
    
    // Show appropriate screen based on counts
    if (totalEnemyShips > 0 && hitEnemyShips === totalEnemyShips) {
      console.log("FORCE VICTORY - All enemy ships hit");
      isGameOver = true;
      showVictoryScreen();
      return true;
    }
    
    if (totalPlayerShips > 0 && hitPlayerShips === totalPlayerShips) {
      console.log("FORCE DEFEAT - All player ships hit");
      isGameOver = true;
      showDefeatScreen();
      return true;
    }
    
    return false;
  }

  // Debug button to force check end game
  function addDebugButton() {
    const debugBtn = document.createElement('button');
    debugBtn.textContent = 'Check End Game';
    debugBtn.style.position = 'fixed';
    debugBtn.style.bottom = '10px';
    debugBtn.style.right = '10px';
    debugBtn.style.zIndex = '1000';
    debugBtn.style.padding = '5px 10px';
    debugBtn.style.backgroundColor = '#333';
    debugBtn.style.color = '#fff';
    debugBtn.style.border = 'none';
    debugBtn.style.borderRadius = '5px';
    debugBtn.style.cursor = 'pointer';
    
    debugBtn.addEventListener('click', () => {
      forceCheckEndGame();
    });
    
    document.body.appendChild(debugBtn);
  }
  
  // Add debug button in development mode
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    addDebugButton();
  }

  // Add connection status styles to page
  const connectionStyles = document.createElement('style');
  connectionStyles.innerHTML = `
    .connection-status {
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 8px 15px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: bold;
      z-index: 1000;
      display: flex;
      align-items: center;
      transition: all 0.3s ease;
      background-color: rgba(0, 0, 0, 0.7);
      color: white;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    }
    
    .connection-status i {
      margin-right: 6px;
    }
    
    .connection-status.connected {
      background-color: rgba(0, 128, 0, 0.7);
    }
    
    .connection-status.disconnected {
      background-color: rgba(255, 0, 0, 0.7);
      animation: pulse 1.5s infinite;
    }
    
    @keyframes pulse {
      0% { opacity: 0.7; }
      50% { opacity: 1; }
      100% { opacity: 0.7; }
    }
    
    .sync-notification {
      position: fixed;
      top: 50px;
      right: 20px;
      background-color: rgba(0, 191, 255, 0.8);
      color: white;
      padding: 8px 15px;
      border-radius: 4px;
      z-index: 9999;
      animation: slideIn 0.3s ease;
      transition: opacity 0.5s ease;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    }
    
    .sync-notification.fade-out {
      opacity: 0;
    }
    
    @keyframes slideIn {
      from { transform: translateX(50px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    .turn-notification {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      padding: 20px 40px;
      font-size: 24px;
      font-weight: bold;
      color: white;
      border-radius: 10px;
      z-index: 9999;
      animation: popIn 0.5s ease;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
      text-transform: uppercase;
      letter-spacing: 2px;
      opacity: 0.9;
      pointer-events: none;
    }
    
    .turn-notification.your-turn-notify {
      background-color: rgba(40, 167, 69, 0.9);
      box-shadow: 0 0 20px rgba(40, 167, 69, 0.5);
    }
    
    .turn-notification.enemy-turn-notify {
      background-color: rgba(220, 53, 69, 0.9);
      box-shadow: 0 0 20px rgba(220, 53, 69, 0.5);
    }
    
    .turn-notification.fade-out {
      animation: fadeOut 1s ease forwards;
    }
    
    @keyframes popIn {
      0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
      70% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
      100% { transform: translate(-50%, -50%) scale(1); opacity: 0.9; }
    }
    
    @keyframes fadeOut {
      from { opacity: 0.9; transform: translate(-50%, -50%) scale(1); }
      to { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
    }
  `;
  document.head.appendChild(connectionStyles);

  // Sound effects for game interactions
  function setupSoundEffects() {
    console.log("Setting up sound effects");
    
    try {
      // Create audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        console.warn("Web Audio API not supported in this browser");
        return;
      }
      
      const audioContext = new AudioContext();
      
      // Sound bank
      const sounds = {
        'hit': createOscillator(440, 'sawtooth', 0.3),
        'miss': createOscillator(220, 'sine', 0.2),
        'ship-placed': createOscillator(660, 'square', 0.15),
        'turn-change': createOscillator(880, 'triangle', 0.25),
        'game-over': createOscillator(220, 'sawtooth', 0.5)
      };
      
      // Create oscillator function
      function createOscillator(frequency, type, duration) {
        return function() {
          try {
            // Check if context is suspended (autoplay policy)
            if (audioContext.state === 'suspended') {
              audioContext.resume();
            }
            
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.type = type;
            oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + duration);
          } catch (e) {
            console.error("Error playing sound:", e);
          }
        };
      }
      
      // Expose sound play function globally
      window.playSound = function(soundName) {
        if (sounds[soundName]) {
          sounds[soundName]();
        }
      };
      
      // Add sound effect to ship placement
      document.querySelectorAll('.ship').forEach(ship => {
        ship.addEventListener('dragend', () => {
          window.playSound('ship-placed');
        });
      });
      
      // Add mute button
      const muteButton = document.createElement('button');
      muteButton.className = 'mute-button';
      muteButton.innerHTML = '<i class="fas fa-volume-up"></i>';
      muteButton.title = "Mute Sounds";
      muteButton.style.position = 'fixed';
      muteButton.style.top = '60px';
      muteButton.style.right = '10px';
      muteButton.style.width = '40px';
      muteButton.style.height = '40px';
      muteButton.style.borderRadius = '50%';
      muteButton.style.backgroundColor = 'rgba(0,0,0,0.5)';
      muteButton.style.color = 'white';
      muteButton.style.border = 'none';
      muteButton.style.zIndex = '1000';
      muteButton.style.cursor = 'pointer';
      
      let isMuted = false;
      muteButton.addEventListener('click', () => {
        isMuted = !isMuted;
        
        if (isMuted) {
          muteButton.innerHTML = '<i class="fas fa-volume-mute"></i>';
          muteButton.title = "Unmute Sounds";
          
          // Store original playSound and replace with dummy
          window._originalPlaySound = window.playSound;
          window.playSound = function() {}; // No-op function
        } else {
          muteButton.innerHTML = '<i class="fas fa-volume-up"></i>';
          muteButton.title = "Mute Sounds";
          
          // Restore original playSound
          if (window._originalPlaySound) {
            window.playSound = window._originalPlaySound;
          }
        }
      });
      
      document.body.appendChild(muteButton);
      
    } catch (e) {
      console.error("Error setting up sound system:", e);
    }
  }
  
  // Initialize sound effects 
  document.addEventListener('click', function initAudio() {
    // Initialize on first user interaction to satisfy autoplay policy
    setupSoundEffects();
    document.removeEventListener('click', initAudio);
  }, { once: true });

});

