import { useState, useEffect } from 'react';
import { MovementState } from '../components/Character/types';

export const useMovementControls = () => {
  const [movement, setMovement] = useState<MovementState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    run: false,
    jump: false,
    action: false
  });

  // Handle keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          setMovement(prev => ({ ...prev, forward: true }));
          break;
        case 'KeyS':
        case 'ArrowDown':
          setMovement(prev => ({ ...prev, backward: true }));
          break;
        case 'KeyA':
        case 'ArrowLeft':
          setMovement(prev => ({ ...prev, left: true }));
          break;
        case 'KeyD':
        case 'ArrowRight':
          setMovement(prev => ({ ...prev, right: true }));
          break;
        case 'ShiftLeft':
          setMovement(prev => ({ ...prev, run: true }));
          break;
        case 'Space':
          setMovement(prev => ({ ...prev, jump: true }));
          break;
        case 'KeyE':
          setMovement(prev => ({ ...prev, action: true }));
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          setMovement(prev => ({ ...prev, forward: false }));
          break;
        case 'KeyS':
        case 'ArrowDown':
          setMovement(prev => ({ ...prev, backward: false }));
          break;
        case 'KeyA':
        case 'ArrowLeft':
          setMovement(prev => ({ ...prev, left: false }));
          break;
        case 'KeyD':
        case 'ArrowRight':
          setMovement(prev => ({ ...prev, right: false }));
          break;
        case 'ShiftLeft':
          setMovement(prev => ({ ...prev, run: false }));
          break;
        case 'Space':
          setMovement(prev => ({ ...prev, jump: false }));
          break;
        case 'KeyE':
          setMovement(prev => ({ ...prev, action: false }));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleMobileMovement = (mobileMovement: MovementState) => {
    setMovement(mobileMovement);
  };

  return {
    movement,
    handleMobileMovement
  };
};