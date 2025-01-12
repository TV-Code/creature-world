import { useCallback, useState } from 'react';
import * as THREE from 'three';
import { CharacterRefs } from '../types';
import { 
  CHARACTER_SPEED, 
  GRAVITY, 
  MAX_FALL_SPEED, 
  AIR_CONTROL,
  GROUND_FRICTION,
  ROTATION_SPEED,
  ROTATION_SMOOTHING,
  THROW_ANGLE,
  THROW_RELEASE_TIME,
  LIFT_PICKUP_TIME,
  ASCENSION_SPEED,
  CAMERA_DISTANCE,
  CAMERA_HEIGHT,
  CAMERA_SMOOTHING,
  CHARACTER_HEIGHT_OFFSET
} from '../constants';
import { getTerrainHeight, adjustCameraForCollision, getAnimationName } from '../utils';
import { useMultiplayerStore } from '../../MultiplayerManager';
import { ref, set } from 'firebase/database';
import { database } from '../../../firebase';
import { PlayerUpdate, AnimationName } from '../../../types/multiplayer';

interface UpdateHandlerProps {
  refs: CharacterRefs;
  movement: {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    run: boolean;
    jump: boolean;
    action: boolean;
  };
  animations: { [key: string]: THREE.AnimationAction };
  crossFadeTo: (action: THREE.AnimationAction, duration?: number) => void;
  camera: THREE.PerspectiveCamera;
  isLocalPlayer: boolean;
  isPraying: boolean;
  setIsPraying: (value: boolean) => void;
  isPlayingLift: boolean;
  isPlayingThrow: boolean;
  isAscending: boolean;
  isHoldingTomato: boolean;
  onRotationUpdate?: (rotation: number) => void;
  onTomatoPickup?: () => void;
  onTomatoThrow?: (position: THREE.Vector3, direction: THREE.Vector3) => void;
  remoteState?: any;
}

export function useCharacterUpdate({
  refs,
  movement,
  animations,
  crossFadeTo,
  camera,
  isLocalPlayer,
  isPraying,
  setIsPraying,
  isPlayingLift,
  isPlayingThrow,
  isAscending,
  isHoldingTomato,
  onRotationUpdate,
  onTomatoPickup,
  onTomatoThrow,
  remoteState
}: UpdateHandlerProps) {
  const localPlayerId = useMultiplayerStore((state) => state.localPlayerId);
  const [currentAnimation, setCurrentAnimation] = useState<AnimationName>('idle');

  const handleLocalPlayerUpdate = useCallback((delta: number) => {
    if (!refs.groupRef.current) return;

    let activeAnimation: AnimationName = 'idle';
        
    // Determine current animation based on states
    if (isPlayingLift) activeAnimation = 'lift';
    else if (isPlayingThrow) activeAnimation = 'throw';
    else if (isPraying) activeAnimation = 'prayer';
    else if (isAscending) activeAnimation = 'float';
    else if (movement.forward || movement.backward) {
    activeAnimation = movement.run ? 'run' : 'walk';
    }
    else if (refs.isJumping.current) activeAnimation = 'jump';

    const playerRef = ref(database, `players/${localPlayerId}`);
    const update: PlayerUpdate = {
      position: { 
        x: refs.groupRef.current.position.x, 
        y: refs.groupRef.current.position.y, 
        z: refs.groupRef.current.position.z 
      },
      rotation: refs.rotationRef.current,
      animation: activeAnimation,
      isHoldingTomato
    };
    set(playerRef, update);
    
    if (camera) {
        const theta = refs.cameraRotation.current;
        const phi = Math.PI * refs.cameraPitch.current;
        const idealOffset = new THREE.Vector3(
          CAMERA_DISTANCE * Math.sin(theta) * Math.sin(phi),
          CAMERA_HEIGHT * Math.cos(phi),
          CAMERA_DISTANCE * Math.cos(theta) * Math.sin(phi)
        );
        const desiredPos = refs.groupRef.current.position.clone().sub(idealOffset);
        const collisionResult = adjustCameraForCollision(
          refs,
          desiredPos,
          refs.groupRef.current.position,
          delta
        );
      
        if (collisionResult.collision) {
          refs.isColliding.current = true;
          camera.position.lerp(collisionResult.position, CAMERA_SMOOTHING * 0.7);
        } else {
          camera.position.lerp(collisionResult.position, CAMERA_SMOOTHING);
        }
        const lookAtPos = refs.groupRef.current.position
          .clone()
          .add(new THREE.Vector3(0, CAMERA_HEIGHT * 0.3 + CHARACTER_HEIGHT_OFFSET, 0));
        camera.lookAt(lookAtPos);
      }


    // Handle special states first
    if (isPlayingThrow && refs.currentActionRef.current === animations.throw) {
      refs.throwTimeRef.current = refs.currentActionRef.current.time;
      if (refs.throwTimeRef.current >= THROW_RELEASE_TIME && !window.tomatoThrown) {
        window.tomatoThrown = true;
        const throwDir = new THREE.Vector3(0, Math.sin(THROW_ANGLE), Math.cos(THROW_ANGLE))
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), refs.rotationRef.current)
          .normalize();
        if (refs.rightHandBone?.current) {
          const tomatoPos = new THREE.Vector3();
          refs.rightHandBone.current.getWorldPosition(tomatoPos);
          onTomatoThrow?.(tomatoPos, throwDir);
        }
      }
      return;
    }

    if (refs.currentActionRef.current === animations.lift && isPlayingLift) {
        refs.liftTimeRef.current = refs.currentActionRef.current.time;
        const terrainHeight = getTerrainHeight(refs, refs.groupRef.current.position);
        refs.groupRef.current.position.y = terrainHeight;
        
        if (refs.liftTimeRef.current >= LIFT_PICKUP_TIME && !window.tomatoPickedUp) {
          window.tomatoPickedUp = true;
          onTomatoPickup?.();
        }
        
        // Don't do any other animations/transitions during lift
        return;
      }

    if (isAscending) {
      if (refs.currentActionRef.current !== animations.float && animations.float) {
        crossFadeTo(animations.float, 0.2);
      }
      refs.groupRef.current.position.y += ASCENSION_SPEED * delta;
      if (isLocalPlayer && camera) {
        camera.position.y += ASCENSION_SPEED * delta;
      }
      return;
    }

    if (isPraying) {
        if (!refs.isPlayingPrayer.current && animations.prayer && refs.mixerRef.current) {
          refs.isPlayingPrayer.current = true;
          const prayerAction = animations.prayer;
          const idleAction = animations.idle;
      
          // Start prayer animation
          crossFadeTo(prayerAction, 0.2);
      
          const onPrayerComplete = () => {
            if (!refs.mixerRef.current) return;
            // Clean up first
            refs.mixerRef.current.removeEventListener("finished", onPrayerComplete);
            // Set states before animation changes
            refs.isPlayingPrayer.current = false;
            setIsPraying(false);
            // Wait a frame before transitioning
            requestAnimationFrame(() => {
              if (idleAction && refs.mixerRef.current) {
                crossFadeTo(idleAction, 0.2);
              }
            });
          };
      
          // Clean up old listener first
          refs.mixerRef.current.removeEventListener("finished", onPrayerComplete);
          refs.mixerRef.current.addEventListener("finished", onPrayerComplete);
        }
        
        // Keep character grounded during prayer
        const terrainHeight = getTerrainHeight(refs, refs.groupRef.current.position);
        refs.groupRef.current.position.y = terrainHeight;
        return;
      }

    // Normal movement handling
    const isForwardBack = movement.forward || movement.backward;
    const speed = movement.run ? CHARACTER_SPEED * 2 : CHARACTER_SPEED;

    // Handle rotation
    if (movement.left) refs.rotationRef.current += ROTATION_SPEED * delta;
    if (movement.right) refs.rotationRef.current -= ROTATION_SPEED * delta;

    // Camera rotation smoothing
    if (isForwardBack) {
      let angleDiff = refs.rotationRef.current - refs.cameraRotation.current;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      refs.cameraRotation.current += angleDiff * ROTATION_SMOOTHING;
    }

    // Movement and physics
    const nextPos = refs.groupRef.current.position.clone();
    if (isForwardBack || refs.isJumping.current) {
      const forwardVal = movement.forward ? 1 : movement.backward ? -1 : 0;
      const moveDir = new THREE.Vector3(0, 0, forwardVal)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), refs.rotationRef.current)
        .normalize();

      if (isForwardBack) {
        const movementDelta = moveDir.multiplyScalar(speed * delta);
        movementDelta.multiplyScalar(refs.isJumping.current ? AIR_CONTROL : GROUND_FRICTION);
        nextPos.add(movementDelta);
      }

      // Handle jumping/falling
      if (refs.isJumping.current) {
        refs.verticalVelocity.current += GRAVITY * delta;
        refs.verticalVelocity.current = Math.max(refs.verticalVelocity.current, MAX_FALL_SPEED);
        nextPos.y += refs.verticalVelocity.current * delta;
      }

      // Ground check
      const terrainY = getTerrainHeight(refs, nextPos);
      if (nextPos.y <= terrainY) {
        nextPos.y = terrainY;
        if (refs.isJumping.current) {
          refs.verticalVelocity.current = 0;
          refs.isJumping.current = false;
          if (refs.currentActionRef.current === animations.jump) {
            if (isForwardBack) {
              const landingAction = movement.run ? animations.run : animations.walk;
              if (landingAction) crossFadeTo(landingAction, 0.1);
            } else if (animations.idle) {
              crossFadeTo(animations.idle, 0.1);
            }
          }
        }
      }
    } else {
      // Keep on ground when not moving
      const terrainY = getTerrainHeight(refs, nextPos);
      nextPos.y = terrainY;
    }

    // Update position and rotation
    refs.groupRef.current.position.copy(nextPos);
    refs.groupRef.current.rotation.y = refs.rotationRef.current;
    onRotationUpdate?.(refs.rotationRef.current);

    // Update animations
    if (!refs.isJumping.current) {
      if (isForwardBack) {
        const targetAction = movement.run ? animations.run : animations.walk;
        if (targetAction && refs.currentActionRef.current !== targetAction) {
          crossFadeTo(targetAction, 0.1);
        }
      } else if (animations.idle && refs.currentActionRef.current !== animations.idle) {
        crossFadeTo(animations.idle, 0.1);
      }
    }
  }, [
    refs,
    movement,
    animations,
    crossFadeTo,
    camera,
    isLocalPlayer,
    isPraying,
    setIsPraying,
    isPlayingLift,
    isPlayingThrow,
    isAscending,
    isHoldingTomato,
    onRotationUpdate,
    onTomatoPickup,
    onTomatoThrow,
    localPlayerId
  ]);

  const handleRemotePlayerUpdate = useCallback(() => {
    if (!remoteState || !refs.groupRef.current || !refs.mixerRef.current) return;
  
    // Debug the incoming state
  
    // Position and rotation update
    const remotePos = new THREE.Vector3(
      remoteState.position.x,
      remoteState.position.y,
      remoteState.position.z
    );
    refs.groupRef.current.position.lerp(remotePos, 0.3);
    refs.groupRef.current.rotation.y = THREE.MathUtils.lerp(
      refs.groupRef.current.rotation.y,
      remoteState.rotation,
      0.3
    );
  
    // Get the target animation
    const targetAnimation = animations[remoteState.animation];
    
    if (targetAnimation && refs.currentActionRef.current !== targetAnimation) {
      
      // Handle specific animations
      switch(remoteState.animation) {
        case 'lift':
        case 'throw':
        case 'prayer':
        case 'float':
          targetAnimation.setLoop(THREE.LoopOnce, 1);
          targetAnimation.clampWhenFinished = true;
          crossFadeTo(targetAnimation, 0.2);
          
          // Set up completion handler
          const onComplete = () => {
            if (!refs.mixerRef.current) return;
            refs.mixerRef.current.removeEventListener("finished", onComplete);
            if (animations.idle) {
              crossFadeTo(animations.idle, 0.2);
            }
          };
          
          refs.mixerRef.current.removeEventListener("finished", onComplete);
          refs.mixerRef.current.addEventListener("finished", onComplete);
          break;
          
        default:
          crossFadeTo(targetAnimation, 0.2);
          break;
      }
    }
  }, [remoteState, refs, animations, crossFadeTo]);

  return {
    handleLocalPlayerUpdate,
    handleRemotePlayerUpdate
  };
}