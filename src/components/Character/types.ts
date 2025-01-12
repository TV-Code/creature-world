import * as THREE from 'three';
import { AnimationName, PlayerState, PlayerUpdate } from '../../types/multiplayer';

export interface CharacterProps {
    camera: THREE.PerspectiveCamera;
    movement?: MovementState;
    isNearIdol?: boolean;
    isNearNPC?: boolean;
    onDialogProgress?: () => void;
    canAscend?: boolean;
    onCanAscend?: () => void;
    isAscending?: boolean;
    onPositionUpdate?: (position: THREE.Vector3) => void;
    onRotationUpdate?: (rotation: number) => void;
    onTomatoPickup?: () => void;
    onTomatoOffer?: () => void;
    onTomatoThrow?: (position: THREE.Vector3, direction: THREE.Vector3) => void;
    isHoldingTomato?: boolean;
    isNearTomato?: boolean;
    handBoneRef?: React.MutableRefObject<THREE.Bone | null>;
    isLocalPlayer: boolean;
    remoteState?: PlayerState;
  }
  
  export interface MovementState {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    run: boolean;
    jump: boolean;
    action: boolean;
  }
  
  export interface CollisionResult {
    position: THREE.Vector3;
    collision: boolean;
  }
  
  export interface CharacterRefs {
    groupRef: React.RefObject<THREE.Group>;
    mixerRef: React.MutableRefObject<THREE.AnimationMixer | null>;
    currentActionRef: React.MutableRefObject<THREE.AnimationAction | null>;
    rightHandBone: React.MutableRefObject<THREE.Bone | null>;
    isJumping: React.MutableRefObject<boolean>;
    verticalVelocity: React.MutableRefObject<number>;
    terrainMesh: React.MutableRefObject<THREE.Mesh | null>;
    terrainRaycaster: THREE.Raycaster;
    cameraRaycaster: THREE.Raycaster;
    lastValidCameraPosition: React.MutableRefObject<THREE.Vector3>;
    isColliding: React.MutableRefObject<boolean>;
    timeSinceLastCheck: React.MutableRefObject<number>;
    cameraInitialized: React.MutableRefObject<boolean>;
    isRightMouseDown: React.MutableRefObject<boolean>;
    lastMouseX: React.MutableRefObject<number>;
    lastMouseY: React.MutableRefObject<number>;
    cameraRotation: React.MutableRefObject<number>;
    cameraPitch: React.MutableRefObject<number>;
    rotationRef: React.MutableRefObject<number>;
    liftTimeRef: React.MutableRefObject<number>;
    throwTimeRef: React.MutableRefObject<number>;
    isPlayingPrayer: React.MutableRefObject<boolean>;
  }

export interface AnimationDict {
  [key: string]: THREE.AnimationAction;
}