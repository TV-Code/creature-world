export interface MovementState {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    run: boolean;
    jump: boolean;
    action: boolean;
  }
  
  export interface TouchPosition {
    x: number;
    y: number;
  }