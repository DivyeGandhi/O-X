import React, { useState, useEffect } from "react";
import Square from "./Square";
import Swal from "sweetalert2";

const OfflineGame = ({ onGoHome }) => {
  const [gameState, setGameState] = useState([
    ["", "", ""],
    ["", "", ""],
    ["", "", ""]
  ]);
  const [currentPlayer, setCurrentPlayer] = useState("circle");
  const [finishedState, setFinishedState] = useState(false);
  const [finishedArrayState, setFinishedArrayState] = useState([]);
  const [player1Name, setPlayer1Name] = useState("");
  const [player2Name, setPlayer2Name] = useState("");
  const [gameStarted, setGameStarted] = useState(false);

  const checkWinner = () => {
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
  };

  useEffect(() => {
    if (gameStarted && !finishedState) {
      const winner = checkWinner();
      if (winner) {
        setFinishedState(winner);
      }
    }
  }, [gameState, gameStarted, finishedState]);

  const handleStartGame = () => {
    if (!player1Name || !player2Name) {
      Swal.fire({
        title: "Error",
        text: "Please enter both players' names",
        icon: "error"
      });
      return;
    }
    setGameStarted(true);
  };

  const handleSquareClick = (id) => {
    if (finishedState || !gameStarted) return;

    const rowIndex = Math.floor(id / 3);
    const colIndex = id % 3;

    if (gameState[rowIndex][colIndex] !== "") {
      return;
    }

    const newGameState = [...gameState];
    newGameState[rowIndex] = [...newGameState[rowIndex]];
    newGameState[rowIndex][colIndex] = currentPlayer;
    setGameState(newGameState);
    setCurrentPlayer(currentPlayer === "circle" ? "cross" : "circle");
  };

  if (!gameStarted) {
    return (
      <div className="player-names-container">
        <h2>Enter Player Names</h2>
        <div className="player-inputs">
          <input
            type="text"
            placeholder="Player 1 Name"
            value={player1Name}
            onChange={(e) => setPlayer1Name(e.target.value)}
          />
          <input
            type="text"
            placeholder="Player 2 Name"
            value={player2Name}
            onChange={(e) => setPlayer2Name(e.target.value)}
          />
        </div>
        <div className="button-group">
          <button className="start-game-btn" onClick={handleStartGame}>
            Start Game
          </button>
          <button className="go-home-btn" onClick={onGoHome}>
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-container">
      <div className="move-detection">
        <div className={`left ${currentPlayer === "circle" ? "current-move-circle" : ""}`}>
          {player1Name} (Circle)
        </div>
        <div className={`right ${currentPlayer === "cross" ? "current-move-cross" : ""}`}>
          {player2Name} (Cross)
        </div>
      </div>
      <div className="game-board">
        {gameState.map((arr, rowIndex) =>
          arr.map((e, colIndex) => (
            <Square
              key={rowIndex * 3 + colIndex}
              value={e === "circle" ? "O" : e === "cross" ? "X" : ""}
              onClick={() => handleSquareClick(rowIndex * 3 + colIndex)}
              disabled={finishedState}
            />
          ))
        )}
      </div>
      {finishedState && (
        <div className="game-result">
          {finishedState === "draw" ? (
            <h2>It's a Draw!</h2>
          ) : (
            <h2>
              {finishedState === "circle" ? player1Name : player2Name} Wins!
            </h2>
          )}
          <div className="game-buttons">
            <button
              className="play-again-btn"
              onClick={() => {
                setGameState([
                  ["", "", ""],
                  ["", "", ""],
                  ["", "", ""]
                ]);
                setCurrentPlayer("circle");
                setFinishedState(false);
                setFinishedArrayState([]);
              }}
            >
              Play Again
            </button>
            <button
              className="go-home-btn"
              onClick={onGoHome}
            >
              Go Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfflineGame; 