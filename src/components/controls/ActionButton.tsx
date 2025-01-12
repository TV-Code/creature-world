import React from 'react';

interface ActionButtonProps {
  label: string;
  position: { bottom: number; right: number };
  onPress: () => void;
  onRelease?: () => void;
}

export const ActionButton: React.FC<ActionButtonProps> = ({ 
  label, 
  position, 
  onPress, 
  onRelease 
}) => (
  <button
    className="absolute w-16 h-16 rounded-full bg-gray-700 bg-opacity-50 flex items-center justify-center text-white"
    style={position}
    onTouchStart={(e) => {
      e.preventDefault();
      onPress();
    }}
    onTouchEnd={(e) => {
      e.preventDefault();
      onRelease?.();
    }}
  >
    {label}
  </button>
);