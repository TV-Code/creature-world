export type AnimationName = 'idle' | 'walk' | 'run' | 'jump' | 'prayer' | 'float' | 'lift' | 'throw';

export interface PlayerState {
  id: string;
  position: { x: number; y: number; z: number };
  rotation: number;
  animation: AnimationName;
  isHoldingTomato: boolean;
}

export interface GameState {
  players: Map<string, PlayerState>;
}