export const CHARACTER_SPEED = 15;
export const JUMP_FORCE = 19;
export const GRAVITY = -50;
export const MAX_FALL_SPEED = -500;
export const GROUND_FRICTION = 0.8;
export const AIR_CONTROL = 1;
export const CAMERA_DISTANCE = 20;
export const CAMERA_HEIGHT = 25;
export const CAMERA_SMOOTHING = 0.08;
export const CHARACTER_HEIGHT_OFFSET = 0;
export const ROTATION_SPEED = 2.5;
export const MOUSE_SENSITIVITY = 0.004;
export const ROTATION_SMOOTHING = 0.05;
export const MIN_CAMERA_DISTANCE = 5;
export const CAMERA_COLLISION_PADDING = 1.0;
export const THROW_FORCE = 20;
export const THROW_ANGLE = Math.PI / 4;
export const LIFT_PICKUP_TIME = 1.5;
export const THROW_RELEASE_TIME = 0.7;
export const COLLISION_CHECK_INTERVAL = 0.1;
export const ASCENSION_SPEED = 20;

// Declare global window properties
declare global {
  interface Window {
    tomatoPickedUp: boolean;
    tomatoThrown: boolean;
  }
}

window.tomatoPickedUp = false;
window.tomatoThrown = false;