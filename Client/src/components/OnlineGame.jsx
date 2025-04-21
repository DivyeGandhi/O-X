import React, { useState, useEffect, useCallback } from "react";
import { io } from "socket.io-client";
import Square from "./Square";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";

const OnlineGame = ({ onGoHome }) => {
  const [gameState, setGameState] = useState([
    ["", "", ""],
    ["", "", ""],
    ["", "", ""]
  ]);
  const [currentPlayer, setCurrentPlayer] = useState("circle");
  const [finishedState, setFinishedState] = useState(false);
  const [finishedArrayState, setFinishedArrayState] = useState([]);
  const [playerName, setPlayerName] = useState("");
  const [opponentName, setOpponentName] = useState(null);
  const [playingAs, setPlayingAs] = useState(null);
  const [socket, setSocket] = useState(null);
  const [roomCode, setRoomCode] = useState("");
  const [gameMode, setGameMode] = useState("menu"); // menu, create, join, playing
  const [roomId, setRoomId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [rematchState, setRematchState] = useState("none"); // none, waiting, requested
  const [waitingForRematch, setWaitingForRematch] = useState(false);
  const navigate = useNavigate();

  const checkWinner = useCallback(() => {
    // Check rows
    for (let row = 0; row < gameState.length; row++) {
      if (
        gameState[row][0] !== "" &&
        gameState[row][0] === gameState[row][1] &&
        gameState[row][1] === gameState[row][2]
      ) {
        setFinishedArrayState([row * 3 + 0, row * 3 + 1, row * 3 + 2]);
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
        setFinishedArrayState([0 * 3 + col, 1 * 3 + col, 2 * 3 + col]);
        return gameState[0][col];
      }
    }

    // Check diagonals
    if (
      gameState[0][0] !== "" &&
      gameState[0][0] === gameState[1][1] &&
      gameState[1][1] === gameState[2][2]
    ) {
      setFinishedArrayState([0, 4, 8]);
      return gameState[0][0];
    }

    if (
      gameState[0][2] !== "" &&
      gameState[0][2] === gameState[1][1] &&
      gameState[1][1] === gameState[2][0]
    ) {
      setFinishedArrayState([2, 4, 6]);
      return gameState[0][2];
    }

    // Check for draw
    const isDrawMatch = gameState.flat().every((e) => e !== "");
    if (isDrawMatch) return "draw";

    return null;
  }, [gameState]);

  // Initialize socket connection
  useEffect(() => {
    const serverUrl = import.meta.env.PROD ? window.location.origin : "http://localhost:3000";
    const newSocket = io(serverUrl, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      transports: ['polling', 'websocket'],
      withCredentials: true,
      forceNew: true
    });

    // Basic connection events
    newSocket.on("connect", () => {
      console.log("Connected to server with ID:", newSocket.id);
      setIsConnected(true);
    });

    newSocket.on("connect_error", (error) => {
      console.error("Connection error:", error);
      setIsConnected(false);
      Swal.fire({
        title: "Connection Error",
        text: "Could not connect to the server. Please try again.",
        icon: "error"
      });
    });

    newSocket.on("disconnect", (reason) => {
      console.log("Disconnected from server:", reason);
      setIsConnected(false);
    });

    // Game-specific events
    newSocket.on("roomCreated", (data) => {
      console.log("Room created:", data);
      setRoomId(data.roomId);
      setGameMode("waiting");
      Swal.fire({
        title: "Room Created!",
        html: `Share this code with your friend:<br><strong>${data.roomId}</strong>`,
        icon: "success",
        confirmButtonText: "Copy Code",
      }).then((result) => {
        if (result.isConfirmed) {
          navigator.clipboard.writeText(data.roomId);
          Swal.fire({
            title: "Copied!",
            text: "Room code copied to clipboard",
            icon: "success",
            timer: 1500,
            showConfirmButton: false
          });
        }
      });
    });

    newSocket.on("roomJoined", (data) => {
      console.log("Room joined:", data);
      setOpponentName(data.opponentName);
      setPlayingAs(data.playingAs);
      setGameState(data.gameState || gameState);
      setCurrentPlayer(data.currentPlayer || "circle");
      setGameMode("playing");
    });

    newSocket.on("playerMoveFromServer", (data) => {
      console.log("Move received from server:", data);
      const { gameState: newGameState, currentPlayer: newCurrentPlayer } = data.state;
      
      setGameState(newGameState);
      setCurrentPlayer(newCurrentPlayer);
    });

    newSocket.on("gameFinished", ({ winner, winningPlayerId }) => {
      setFinishedState(winner);
      setGameMode("finished");
      
      if (winner === "draw") {
        Swal.fire({
          title: "Game Over!",
          text: "The game ended in a draw!",
          icon: "info",
          confirmButtonText: "Go Home"
        }).then((result) => {
          if (result.isConfirmed) {
            navigate("/");
          }
        });
      } else {
        const isWinner = socket.id === winningPlayerId;
        Swal.fire({
          title: isWinner ? "You Win!" : "You Lose!",
          text: isWinner ? "Congratulations! You won the game!" : "Better luck next time!",
          icon: isWinner ? "success" : "error",
          confirmButtonText: "Go Home"
        }).then((result) => {
          if (result.isConfirmed) {
            navigate("/");
          }
        });
      }
    });

    newSocket.on("opponentLeftMatch", () => {
      if (!finishedState) {
        setFinishedState("opponentLeftMatch");
        Swal.fire({
          title: "Opponent Left",
          text: "Your opponent has left the game",
          icon: "info"
        });
      }
    });

    newSocket.on("error", (data) => {
      console.error("Server error:", data);
      if (data.message === "Room not found") {
        Swal.fire({
          title: "Error",
          text: "The room you're trying to join doesn't exist.",
          icon: "error"
        }).then(() => {
          setGameMode("menu");
          setRoomId(null);
        });
      } else if (data.message === "Room is full") {
        Swal.fire({
          title: "Error",
          text: "This room is already full.",
          icon: "error"
        }).then(() => {
          setGameMode("menu");
          setRoomId(null);
        });
      } else {
        Swal.fire({
          title: "Error",
          text: data.message || "An error occurred",
          icon: "error"
        }).then(() => {
          if (gameMode === "waiting") {
            setGameMode("menu");
          }
        });
      }
    });

    newSocket.on("rematchRequested", () => {
      setRematchState("requested");
      Swal.fire({
        title: "Rematch Requested",
        text: "Your opponent wants to play again!",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Accept",
        cancelButtonText: "Decline"
      }).then((result) => {
        if (result.isConfirmed) {
          setGameState([
            ["", "", ""],
            ["", "", ""],
            ["", "", ""]
          ]);
          setFinishedState(false);
          setFinishedArrayState([]);
          setCurrentPlayer("circle");
          newSocket.emit("requestRematch", { roomId });
        } else {
          newSocket.emit("cancelRematch", { roomId });
          setRematchState("none");
        }
      });
    });

    newSocket.on("waitingForRematch", () => {
      setRematchState("waiting");
      setWaitingForRematch(true);
    });

    newSocket.on("rematchAccepted", (data) => {
      setRematchState("none");
      setWaitingForRematch(false);
      setGameState([
        ["", "", ""],
        ["", "", ""],
        ["", "", ""]
      ]);
      setCurrentPlayer("circle");
      setFinishedState(false);
      setFinishedArrayState([]);
      Swal.close();
    });

    newSocket.on("rematchCancelled", () => {
      setRematchState("none");
      setWaitingForRematch(false);
      // Reset the board back to the finished state
      setGameState(prevState => prevState);
      Swal.fire({
        title: "Rematch Cancelled",
        text: "The rematch request was cancelled.",
        icon: "info"
      });
    });

    // Connect the socket
    newSocket.connect();
    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [navigate]); // Empty dependency array since we want socket to persist

  // Separate useEffect for checking winner
  useEffect(() => {
    if (gameMode === "playing" && !finishedState && socket && socket.connected) {
      const winner = checkWinner();
      if (winner) {
        setFinishedState(winner);
        socket.emit("gameFinished", { 
          roomId, 
          winner
        });
      }
    }
  }, [gameState, gameMode, finishedState, checkWinner, socket, roomId]);

  const handleCreateRoom = useCallback(() => {
    if (!playerName) {
      Swal.fire({
        title: "Error",
        text: "Please enter your name",
        icon: "error"
      });
      return;
    }

    if (!socket || !socket.connected) {
      Swal.fire({
        title: "Error",
        text: "Not connected to server. Please try again.",
        icon: "error"
      });
      return;
    }

    console.log("Creating room with player name:", playerName);
    socket.emit("createRoom", { playerName });
  }, [socket, playerName]);

  const handleJoinWithCode = () => {
    if (!playerName) {
      Swal.fire({
        title: "Error",
        text: "Please enter your name first",
        icon: "error"
      });
      return;
    }

    Swal.fire({
      title: 'Enter Room Code',
      input: 'text',
      inputPlaceholder: 'Room Code',
      showCancelButton: true,
      confirmButtonText: 'Join',
      cancelButtonText: 'Cancel',
      inputValidator: (value) => {
        if (!value) {
          return 'Please enter a room code';
        }
      }
    }).then((result) => {
      if (result.isConfirmed) {
        handleJoinRoom(result.value.toUpperCase());
      }
    });
  };

  const handleJoinRoom = (code) => {
    if (!playerName) {
      Swal.fire({
        title: "Error",
        text: "Please enter your name",
        icon: "error"
      });
      return;
    }

    try {
      if (!socket.connected) {
        socket.connect();
      }
      socket.emit("joinRoom", { 
        playerName,
        roomId: code
      });
      setRoomId(code);
    } catch (error) {
      console.error("Error joining room:", error);
      Swal.fire({
        title: "Error",
        text: "Failed to join room. Please check the room code and try again.",
        icon: "error"
      });
    }
  };

  const handleSquareClick = (id) => {
    if (finishedState || !socket || !socket.connected || currentPlayer !== playingAs) {
      console.log("Cannot make move:", { finishedState, socketConnected: socket?.connected, currentPlayer, playingAs });
      return;
    }

    const rowIndex = Math.floor(id / 3);
    const colIndex = id % 3;

    if (gameState[rowIndex][colIndex] !== "") {
      console.log("Square already taken");
      return;
    }

    try {
      // Create a new game state with the move
      const newGameState = gameState.map(row => [...row]);
      newGameState[rowIndex][colIndex] = playingAs;

      // Update local state immediately for better UX
      setGameState(newGameState);
      setCurrentPlayer(playingAs === "circle" ? "cross" : "circle");

      // Send move to server
      socket.emit("playerMoveFromClient", {
        roomId,
        state: {
          id,
          sign: playingAs
        }
      });
    } catch (error) {
      console.error("Error sending move:", error);
      Swal.fire({
        title: "Error",
        text: "Failed to make move. Please try again.",
        icon: "error"
      });
    }
  };

  const handleRematchRequest = useCallback(() => {
    if (!socket || !roomId) {
      console.error("Socket or roomId not available");
      return;
    }
    
    setGameState([
      ["", "", ""],
      ["", "", ""],
      ["", "", ""]
    ]);
    setFinishedArrayState([]);
    setCurrentPlayer("circle");
    setWaitingForRematch(true);
    setRematchState("waiting");
    socket.emit("requestRematch", { roomId });
  }, [socket, roomId]);

  const handleCancelRematch = useCallback(() => {
    if (!socket || !roomId) {
      console.error("Socket or roomId not available");
      return;
    }

    setWaitingForRematch(false);
    setRematchState("none");
    setGameState(prevState => prevState);
    socket.emit("cancelRematch", { roomId });
  }, [socket, roomId]);

  if (gameMode === "menu") {
    return (
      <div className="menu-container">
        <div className="menu-content">
          <h2>Welcome to Tic Tac Toe</h2>
          
          <div className="name-section">
            <p>You are</p>
            <input
              type="text"
              placeholder="User"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="name-input"
            />
          </div>

          <div className="menu-buttons">
            <button 
              className="create-room-btn" 
              onClick={handleCreateRoom}
              disabled={!isConnected}
            >
              Create Room
            </button>
            
            <button 
              className="join-room-btn" 
              onClick={handleJoinWithCode}
              disabled={!isConnected}
            >
              Join Room
            </button>

            <button className="go-home-btn" onClick={onGoHome}>
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameMode === "waiting") {
    return (
      <div className="waiting-room">
        <h2>Waiting for opponent to join...</h2>
        <p>Room Code: {roomId}</p>
        <button 
          className="copy-room-btn"
          onClick={() => {
            navigator.clipboard.writeText(roomId);
            Swal.fire({
              title: "Copied!",
              text: "Room code copied to clipboard",
              icon: "success"
            });
          }}
        >
          Copy Room Code
        </button>
        <button className="go-home-btn" onClick={onGoHome}>
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div className="game-container">
      {waitingForRematch && (
        <div className="waiting-overlay">
          <div className="waiting-message">
            <h3>Waiting for opponent...</h3>
            <button 
              className="leave-rematch-btn"
              onClick={handleCancelRematch}
            >
              Leave Rematch
            </button>
          </div>
        </div>
      )}
      
      <div className="move-detection">
        <div className={`left ${currentPlayer === playingAs ? "current-move-" + currentPlayer : ""}`}>
          {playerName} ({playingAs === "circle" ? "O" : "X"})
        </div>
        <div className={`right ${currentPlayer !== playingAs ? "current-move-" + currentPlayer : ""}`}>
          {opponentName} ({playingAs === "circle" ? "X" : "O"})
        </div>
      </div>

      <div className={`game-board ${waitingForRematch ? 'waiting' : ''}`}>
        {gameState.map((arr, rowIndex) =>
          arr.map((e, colIndex) => (
            <Square
              key={rowIndex * 3 + colIndex}
              value={e === "circle" ? "O" : e === "cross" ? "X" : ""}
              onClick={() => handleSquareClick(rowIndex * 3 + colIndex)}
              disabled={finishedState || currentPlayer !== playingAs}
            />
          ))
        )}
      </div>

      {finishedState && !waitingForRematch && (
        <div className="game-result">
          {finishedState === "opponentLeftMatch" ? (
            <h2>Opponent Left the Game</h2>
          ) : finishedState === "draw" ? (
            <h2>It's a Draw!</h2>
          ) : (
            <h2>
              {finishedState === playingAs ? "You" : opponentName} Won!
            </h2>
          )}
          <div className="game-buttons">
            <button className="go-home-btn" onClick={onGoHome}>
              Go Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Update the styles
const styles = `
  .game-container {
    position: relative;
  }

  .waiting-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10;
  }

  .waiting-message {
    background: white;
    padding: 20px;
    border-radius: 10px;
    text-align: center;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  }

  .waiting-message h3 {
    margin: 0 0 15px 0;
    color: #333;
  }

  .game-board.waiting {
    opacity: 0.7;
    pointer-events: none;
  }

  .leave-rematch-btn {
    background-color: #f44336;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 5px;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .leave-rematch-btn:hover {
    background-color: #da190b;
  }

  .game-buttons {
    display: flex;
    gap: 10px;
    justify-content: center;
    margin-top: 20px;
  }

  .play-again-btn,
  .go-home-btn {
    padding: 10px 20px;
    border-radius: 5px;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .play-again-btn {
    background-color: #4CAF50;
    color: white;
    border: none;
  }

  .play-again-btn:hover {
    background-color: #45a049;
  }

  .go-home-btn {
    background-color: #2196F3;
    color: white;
    border: none;
  }

  .go-home-btn:hover {
    background-color: #0b7dda;
  }

  .menu-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background: #1a1a1a;
  }

  .menu-content {
    background: #2a2a2a;
    padding: 2rem;
    border-radius: 10px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 400px;
    text-align: center;
  }

  .menu-content h2 {
    color: white;
    margin-bottom: 2rem;
    font-size: 1.8rem;
  }

  .name-section {
    margin-bottom: 2rem;
    text-align: center;
  }

  .name-section p {
    color: #ffffff;
    margin-bottom: 0.5rem;
    font-size: 1.2rem;
  }

  .name-input {
    width: 100%;
    padding: 0.8rem;
    font-size: 1.1rem;
    background: #333;
    border: 1px solid #444;
    border-radius: 5px;
    color: white;
    margin-bottom: 1rem;
  }

  .name-input:focus {
    outline: none;
    border-color: #2196F3;
  }

  .menu-buttons {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .menu-buttons button {
    width: 100%;
    padding: 1rem;
    font-size: 1.1rem;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .create-room-btn {
    background-color: #2196F3;
    color: white;
  }

  .create-room-btn:hover {
    background-color: #1976D2;
  }

  .join-room-btn {
    background-color: #4CAF50;
    color: white;
  }

  .join-room-btn:hover {
    background-color: #388E3C;
  }

  .go-home-btn {
    background-color: #f44336;
    color: white;
  }

  .go-home-btn:hover {
    background-color: #d32f2f;
  }

  .menu-buttons button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    filter: grayscale(30%);
  }

  .menu-buttons button:disabled:hover {
    background-color: inherit;
  }

  .connection-status {
    position: absolute;
    top: 10px;
    right: 10px;
    padding: 5px 10px;
    border-radius: 15px;
    font-size: 0.8rem;
    color: white;
  }

  .connection-status.connected {
    background-color: #4CAF50;
  }

  .connection-status.disconnected {
    background-color: #f44336;
  }

  /* SweetAlert2 Custom Styles */
  .swal2-popup {
    background: #2a2a2a !important;
    color: white !important;
  }

  .swal2-title, .swal2-html-container {
    color: white !important;
  }

  .swal2-html-container strong {
    color: #4CAF50;
    font-size: 1.2em;
    display: block;
    margin-top: 10px;
    letter-spacing: 2px;
  }
`;

// Add style tag to document
const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);

export default OnlineGame; 