// src/components/controls/MobileControls.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { MovementState, TouchPosition } from '../../types/controls';

interface MobileControlsProps {
  onMovementChange: (movement: MovementState) => void;
  onCameraMove?: (deltaX: number, deltaY: number) => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({ 
  onMovementChange, 
  onCameraMove 
}) => {
  // Joystick states
  const [joystickTouch, setJoystickTouch] = useState<TouchPosition | null>(null);
  const [joystickStart, setJoystickStart] = useState<TouchPosition | null>(null);

  // Camera states
  const [cameraTouch, setCameraTouch] = useState<TouchPosition | null>(null);
  const [lastCameraPosition, setLastCameraPosition] = useState<TouchPosition | null>(null);

  // Initialize movement state
  const [movement, setMovement] = useState<MovementState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    run: false,
    jump: false,
    action: false
  });

  useEffect(() => {
    // Prevent default touch behaviors
    const preventBehavior = (e: TouchEvent) => {
      e.preventDefault();
    };

    document.addEventListener('touchmove', preventBehavior, { passive: false });
    document.addEventListener('touchstart', preventBehavior, { passive: false });

    return () => {
      document.removeEventListener('touchmove', preventBehavior);
      document.removeEventListener('touchstart', preventBehavior);
    };
  }, []);

  // Handle joystick movement
  const handleJoystick = useCallback((currentPos: TouchPosition, startPos: TouchPosition) => {
    const deltaX = currentPos.x - startPos.x;
    const deltaY = currentPos.y - startPos.y;
    const threshold = 20;
    const runThreshold = 60;

    const newMovement = {
      ...movement,
      forward: deltaY < -threshold,
      backward: deltaY > threshold,
      left: deltaX < -threshold,
      right: deltaX > threshold,
      run: Math.abs(deltaY) > runThreshold
    };

    setMovement(newMovement);
    onMovementChange(newMovement);
  }, [movement, onMovementChange]);

  // Handle camera movement
  const handleCamera = useCallback((currentPos: TouchPosition, lastPos: TouchPosition) => {
    const deltaX = currentPos.x - lastPos.x;
    const deltaY = currentPos.y - lastPos.y;
    onCameraMove?.(deltaX, deltaY);
  }, [onCameraMove]);

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const touchPos = { x: touch.clientX, y: touch.clientY };

    // Left side of screen is joystick
    if (touch.clientX < window.innerWidth / 2) {
      setJoystickStart(touchPos);
      setJoystickTouch(touchPos);
    } 
    // Right side is camera control
    else {
      setCameraTouch(touchPos);
      setLastCameraPosition(touchPos);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    const touchPos = { x: touch.clientX, y: touch.clientY };

    if (joystickStart && touch.clientX < window.innerWidth / 3) {
      setJoystickTouch(touchPos);
      
      const deltaX = touchPos.x - joystickStart.x;
      const deltaY = touchPos.y - joystickStart.y;
      
      // Calculate angle from vertical
      const angle = Math.atan2(deltaX, -deltaY) * (180 / Math.PI);
      const magnitude = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      // If within 30 degrees of forward and moving forward
      const isInDeadzone = Math.abs(angle) < 17 && deltaY < 0;
      
      const threshold = 20;
      const runThreshold = 60;
  
      const newMovement = {
        ...movement,
        forward: deltaY < -threshold,
        backward: deltaY > threshold,
        left: !isInDeadzone && deltaX < -threshold,
        right: !isInDeadzone && deltaX > threshold,
        run: magnitude > runThreshold
      };
  
      if (isInDeadzone) {
        newMovement.left = false;
        newMovement.right = false;
      }
  
      setMovement(newMovement);
      onMovementChange(newMovement);
    }
  };

  const handleTouchEnd = () => {
    setJoystickTouch(null);
    setJoystickStart(null);
    setCameraTouch(null);
    setLastCameraPosition(null);
    
    // Reset movement when joystick is released
    const resetMovement = {
      ...movement,
      forward: false,
      backward: false,
      left: false,
      right: false,
      run: false
    };
    setMovement(resetMovement);
    onMovementChange(resetMovement);
  };

  return (
    <>
      {/* Full screen touch area */}
      <div 
        className="fixed inset-0 touch-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Only render joystick when active */}
        {joystickTouch && joystickStart && (
          <div 
            className="absolute w-32 h-32 rounded-full bg-white bg-opacity-20 border-2 border-white"
            style={{
              left: joystickStart.x - 64,
              top: joystickStart.y - 64,
              transform: 'translate3d(0,0,0)'
            }}
          >
            <div 
              className="absolute w-20 h-20 rounded-full bg-white bg-opacity-30"
              style={{
                left: '50%',
                top: '50%',
                transform: `translate3d(
                  ${joystickTouch.x - joystickStart.x}px, 
                  ${joystickTouch.y - joystickStart.y}px, 
                  0
                )`
              }}
            />
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-4 z-10">
        <button
          className="w-16 h-16 rounded-full bg-white bg-opacity-20 border-2 border-white text-white"
          onTouchStart={(e) => {
            e.stopPropagation();
            onMovementChange({ ...movement, jump: true });
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            onMovementChange({ ...movement, jump: false });
          }}
        >
          Jump
        </button>
        <button
          className="w-16 h-16 rounded-full bg-white bg-opacity-20 border-2 border-white text-white"
          onTouchStart={(e) => {
            e.stopPropagation();
            onMovementChange({ ...movement, action: true });
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            onMovementChange({ ...movement, action: false });
          }}
        >
          E
        </button>
      </div>
    </>
  );
};