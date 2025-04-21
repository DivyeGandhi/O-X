import React from 'react';

const Square = ({ value, onClick, disabled }) => {
  return (
    <button
      className={`square ${value === 'X' ? 'cross' : value === 'O' ? 'circle' : ''}`}
      onClick={onClick}
      disabled={disabled || value}
    >
      {value}
    </button>
  );
};

export default Square; 