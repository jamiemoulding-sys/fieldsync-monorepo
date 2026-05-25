import React from 'react';
import { useNavigate } from 'react-router-dom';

function BackButton() {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(-1)}
      className="mb-4 text-sm text-blue-400 hover:text-blue-300"
    >
      ← Back
    </button>
  );
}

export default BackButton;