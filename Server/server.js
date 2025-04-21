import { createServer } from "http";
import { Server } from "socket.io";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const app = express();
const httpServer = createServer(app);

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === "production" 
    ? false // In production, we don't need CORS as we serve the files directly
    : [`http://localhost:${process.env.CLIENT_PORT || 5173}`], // In development, allow Vite dev server
  methods: ["GET", "POST"],
  credentials: true
};

const io = new Server(httpServer, {
  cors: corsOptions,
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  connectTimeout: 45000,
  maxHttpBufferSize: 1e8
});

//--------------------------------------------------DEPLOYMENT CODE-----------------------------------------------------------
if (process.env.NODE_ENV === "production") {
    // Set Content Security Policy headers
    app.use((req, res, next) => {
        res.setHeader(
            'Content-Security-Policy',
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' data: https://fonts.gstatic.com; " +
            "img-src 'self' data: blob:; " +
            "connect-src 'self' ws: wss: http://localhost:${process.env.PORT || 3000};"
        );
        next();
    });

    // Serve static files from the dist directory
    app.use(express.static(path.join(rootDir, 'Client', 'dist')));

    // Handle non-API routes by sending the index.html file
    app.get('*', (req, res) => {
        res.sendFile(path.join(rootDir, 'Client', 'dist', 'index.html'));
    });
} else {
    // In development mode, just respond with API running message
    app.get('/', (req, res) => {
        res.send('API is running in development mode');
    });
}
//--------------------------------------------------DEPLOYMENT CODE ENDS-------------------------------------------------------

// Add error handling for the HTTP server
httpServer.on('error', (error) => {
  console.error('HTTP Server Error:', error);
});

// Add error handling for the Socket.IO server
io.engine.on('connection_error', (err) => {
  console.error('Socket.IO Connection Error:', err);
});

// Store active rooms and their states
const rooms = new Map();

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function checkWinner(gameState) {
  // Check rows
  for (let row = 0; row < gameState.length; row++) {
    if (
      gameState[row][0] !== "" &&
      gameState[row][0] === gameState[row][1] &&
      gameState[row][1] === gameState[row][2]
    ) {
      return gameState[row][0];
    }
  }

  // Check columns
  for (let col = 0; col < gameState.length; col++) {
    if (
      gameState[0][col] !== "" &&
      gameState[0][col] === gameState[1][col] &&
      gameState[1][col] === gameState[2][col]
    ) {
      return gameState[0][col];
    }
  }

  // Check diagonals
  if (
    gameState[0][0] !== "" &&
    gameState[0][0] === gameState[1][1] &&
    gameState[1][1] === gameState[2][2]
  ) {
    return gameState[0][0];
  }

  if (
    gameState[0][2] !== "" &&
    gameState[0][2] === gameState[1][1] &&
    gameState[1][1] === gameState[2][0]
  ) {
    return gameState[0][2];
  }

  // Check for draw
  const isDrawMatch = gameState.flat().every((e) => e !== "");
  if (isDrawMatch) return "draw";

  return null;
}

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // Handle connection errors
  socket.on("connect_error", (error) => {
    console.error("Connection error for socket", socket.id, ":", error);
  });

  // Handle room creation
  socket.on("createRoom", (data) => {
    try {
      if (!data || !data.playerName) {
        socket.emit("error", { message: "Player name is required" });
        return;
      }

      const roomId = generateRoomId();
      const playerName = data.playerName;

      console.log(`Creating room ${roomId} for player ${playerName} (${socket.id})`);

      // Create new room
      const room = {
        players: [{ id: socket.id, name: playerName, symbol: "circle" }],
        gameState: [
          ["", "", ""],
          ["", "", ""],
          ["", "", ""]
        ],
        currentPlayer: "circle",
        gameFinished: false,
        createdAt: Date.now()
      };

      // Store the room
      rooms.set(roomId, room);

      // Join the socket to the room
      socket.join(roomId);

      // Emit success event
      socket.emit("roomCreated", { roomId });
      
      console.log(`Room ${roomId} created successfully by ${playerName} (${socket.id})`);
      console.log(`Current rooms: ${Array.from(rooms.keys()).join(", ")}`);
    } catch (error) {
      console.error("Error creating room:", error);
      socket.emit("error", { message: "Failed to create room" });
    }
  });

  // Handle room joining
  socket.on("joinRoom", (data) => {
    try {
      const { roomId, playerName } = data;
      console.log(`Attempting to join room ${roomId} by ${playerName} (${socket.id})`);

      const room = rooms.get(roomId);

      if (!room) {
        console.log(`Room ${roomId} not found`);
        socket.emit("error", { message: "Room not found" });
        return;
      }

      if (room.players.length >= 2) {
        console.log(`Room ${roomId} is full`);
        socket.emit("error", { message: "Room is full" });
        return;
      }

      // Check if player is already in the room
      const existingPlayer = room.players.find(p => p.id === socket.id);
      if (existingPlayer) {
        console.log(`Player ${socket.id} is already in room ${roomId}`);
        socket.emit("error", { message: "Already in room" });
        return;
      }

      // Add second player
      room.players.push({ id: socket.id, name: playerName, symbol: "cross" });
      socket.join(roomId);

      // Notify both players
      room.players.forEach((player) => {
        const opponent = room.players.find(p => p.id !== player.id);
        io.to(player.id).emit("roomJoined", {
          opponentName: opponent.name,
          playingAs: player.symbol,
          gameState: room.gameState,
          currentPlayer: room.currentPlayer
        });
      });

      console.log(`Player ${playerName} (${socket.id}) joined room ${roomId}`);
    } catch (error) {
      console.error("Error joining room:", error);
      socket.emit("error", { message: "Failed to join room" });
    }
  });

  // Handle player moves
  socket.on("playerMoveFromClient", (data) => {
    try {
      const { roomId, state } = data;
      const room = rooms.get(roomId);

      if (!room) {
        console.error(`Room ${roomId} not found for move`);
        socket.emit("error", { message: "Room not found" });
        return;
      }

      const { id, sign } = state;
      const rowIndex = Math.floor(id / 3);
      const colIndex = id % 3;

      // Validate move
      if (room.gameState[rowIndex][colIndex] !== "") {
        socket.emit("error", { message: "Invalid move" });
        return;
      }

      // Validate player turn
      const currentPlayer = room.players.find(p => p.id === socket.id);
      if (!currentPlayer || currentPlayer.symbol !== room.currentPlayer) {
        socket.emit("error", { message: "Not your turn" });
        return;
      }

      // Update game state
      room.gameState[rowIndex][colIndex] = sign;
      room.currentPlayer = sign === "circle" ? "cross" : "circle";

      // Check for winner
      const winner = checkWinner(room.gameState);
      if (winner) {
        room.gameFinished = true;
        const winningPlayer = room.players.find(p => p.symbol === winner);
        io.to(roomId).emit("gameFinished", { 
          winner,
          winningPlayerId: winningPlayer ? winningPlayer.id : null 
        });
      }

      // Broadcast move to all players in the room
      io.to(roomId).emit("playerMoveFromServer", { 
        state: {
          id,
          sign,
          gameState: room.gameState,
          currentPlayer: room.currentPlayer
        }
      });

      console.log(`Move made in room ${roomId} by ${currentPlayer.name} (${socket.id})`);
    } catch (error) {
      console.error("Error processing move:", error);
      socket.emit("error", { message: "Failed to process move" });
    }
  });

  // Handle disconnection
  socket.on("disconnect", (reason) => {
    console.log("Client disconnected:", socket.id, "Reason:", reason);

    // Find rooms where this player was
    for (const [roomId, room] of rooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        const otherPlayer = room.players.find(p => p.id !== socket.id);
        if (otherPlayer) {
          // Only notify if the game is still in progress
          if (!room.gameFinished) {
            io.to(otherPlayer.id).emit("opponentLeftMatch");
          }
        }
        // Remove the disconnected player from the room
        room.players.splice(playerIndex, 1);
        // Only delete the room if it's empty
        if (room.players.length === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted due to being empty`);
        }
      }
    }
  });

  // Handle rematch request
  socket.on("requestRematch", ({ roomId }) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        socket.emit("error", { message: "Room not found" });
        return;
      }

      // Initialize rematch state if it doesn't exist
      if (!room.rematchState) {
        room.rematchState = { accepted: new Set() };
      }

      // Add this player to accepted set
      room.rematchState.accepted.add(socket.id);

      // Check if both players have accepted
      if (room.rematchState.accepted.size === 2) {
        // Reset game state
        room.gameState = [
          ["", "", ""],
          ["", "", ""],
          ["", "", ""]
        ];
        room.currentPlayer = "circle";
        room.gameFinished = false;
        room.rematchState = null;

        // Notify both players to restart
        io.to(roomId).emit("rematchAccepted");

        // Log the rematch
        console.log(`Rematch started in room ${roomId}`);
      } else {
        // Notify other player about rematch request
        const otherPlayer = room.players.find(p => p.id !== socket.id);
        if (otherPlayer) {
          io.to(otherPlayer.id).emit("rematchRequested");
        }
        // Notify requesting player to wait
        socket.emit("waitingForRematch");
      }
    } catch (error) {
      console.error("Error handling rematch request:", error);
      socket.emit("error", { message: "Failed to process rematch request" });
    }
  });

  // Handle rematch cancellation
  socket.on("cancelRematch", ({ roomId }) => {
    try {
      const room = rooms.get(roomId);
      if (room && room.rematchState) {
        room.rematchState.accepted.delete(socket.id);
        // Notify other player about cancellation
        const otherPlayer = room.players.find(p => p.id !== socket.id);
        if (otherPlayer) {
          io.to(otherPlayer.id).emit("rematchCancelled");
        }
      }
    } catch (error) {
      console.error("Error cancelling rematch:", error);
      socket.emit("error", { message: "Failed to cancel rematch" });
    }
  });
});

// Clean up inactive rooms periodically
setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    if (now - room.createdAt > 3600000) { // 1 hour
      rooms.delete(roomId);
      console.log(`Room ${roomId} deleted due to inactivity`);
    }
  }
}, 300000); // Check every 5 minutes

// Update the server listen port
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Node Version: ${process.env.NODE_VERSION}`);
});
