import React, { useState } from "react";
import "./App.css";
import OfflineGame from "./components/OfflineGame";
import OnlineGame from "./components/OnlineGame";

function App() {
  const [gameMode, setGameMode] = useState(null); // null, 'offline', or 'online'

  const handleGoHome = () => {
    setGameMode(null);
  };

  return (
    <div className="main-div">
      {gameMode === null ? (
        <div className="main-menu">
          <h1 className="game-title">Tic Tac Toe</h1>
          <div className="game-options">
            <button 
              className="game-option-btn offline-btn"
              onClick={() => setGameMode('offline')}
            >
              Play Offline
            </button>
            <button 
              className="game-option-btn online-btn"
              onClick={() => setGameMode('online')}
            >
              Play Online
            </button>
          </div>
        </div>
      ) : gameMode === 'offline' ? (
        <OfflineGame onGoHome={handleGoHome} />
      ) : (
        <OnlineGame onGoHome={handleGoHome} />
      )}
    </div>
  );
}

export default App;
