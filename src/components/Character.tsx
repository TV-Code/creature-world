import { useFrame, useLoader, useThree } from "@react-three/fiber";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import * as THREE from "three";
import { Group } from "three";

interface CharacterProps {
  camera: THREE.PerspectiveCamera;
  isNearIdol?: boolean;
  isAscending?: boolean;
  onPositionUpdate?: (position: THREE.Vector3) => void;
  onRotationUpdate?: (rotation: number) => void;
  onTomatoPickup?: () => void;
  onTomatoThrow?: (position: THREE.Vector3, direction: THREE.Vector3) => void; // Must match how you call it
  isHoldingTomato?: boolean;
  isNearTomato?: boolean;
  handBoneRef?: React.MutableRefObject<THREE.Bone | null>;
}

declare global {
  interface Window {
    tomatoPickedUp: boolean;
  }
}

window.tomatoPickedUp = false;
window.tomatoThrown = false;

const Character: React.FC<CharacterProps> = ({ camera, isNearIdol = false, onPositionUpdate, onRotationUpdate, onTomatoThrow, onTomatoPickup, isHoldingTomato = false, isNearTomato, handBoneRef, isAscending }) => {
  const { scene } = useThree();
  const groupRef = useRef<Group>(null!);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const [animations, setAnimations] = useState<{ [key: string]: THREE.AnimationAction }>({});
  const [currentAction, setCurrentAction] = useState<THREE.AnimationAction | null>(null);
  const rotationRef = useRef(0);
  const isJumping = useRef(false);
  const isFirstFrame = useRef(true);
  const terrainRaycaster = useRef(new THREE.Raycaster());
  const cameraRaycaster = useRef(new THREE.Raycaster());
  const downVector = new THREE.Vector3(0, -1, 0);
  const [isPraying, setIsPraying] = useState(false);
  const isPlayingPrayer = useRef(false);
  const [characterPosition, setCharacterPosition] = useState(new THREE.Vector3());
  const prayerYOffset = useRef(1);
  const targetCameraRotation = useRef(0);
  const lastValidCameraPosition = useRef(new THREE.Vector3());
  const isColliding = useRef(false);
  const ascensionSpeed = 0.2;
  const initialHeight = useRef<number | null>(null);
  const [isPlayingLift, setIsPlayingLift] = useState(false);
  const [isPlayingThrow, setIsPlayingThrow] = useState(false);
  const rightHandBone = useRef<THREE.Bone | null>(null);
  const liftTimeRef = useRef(0);
  const throwTimeRef = useRef(0);
  


  // Track if camera is initialized to prevent resetting
  const cameraInitialized = useRef(false);

  // Camera control states
  const isRightMouseDown = useRef(false);
  const lastMouseX = useRef(0);
  const lastMouseY = useRef(0);
  const cameraRotation = useRef(0);
  const cameraPitch = useRef(1);

  // Settings
  const CAMERA_DISTANCE = 20;
  const CAMERA_HEIGHT = 25;
  const CAMERA_SMOOTHING = 0.08;
  const CHARACTER_SPEED = 0.25;
  const CHARACTER_HEIGHT_OFFSET = 0;
  const ROTATION_SPEED = 2.5;
  const JUMP_FORCE = 0.35;
  const GRAVITY = -0.015;
  const MOUSE_SENSITIVITY = 0.004;
  const ROTATION_SMOOTHING = 0.05; // New constant for rotation smoothing
  const MIN_CAMERA_DISTANCE = 5; // Minimum distance when colliding
  const CAMERA_COLLISION_PADDING = 1.0;
  const THROW_FORCE = 20;
  const THROW_ANGLE = Math.PI / 4;
  const LIFT_PICKUP_TIME = 1.5;  // 2 seconds into lift animation
  const THROW_RELEASE_TIME = 0.7;
  const verticalVelocity = useRef(0);

  // Find terrain in scene
  const terrainMesh = useRef<THREE.Mesh | null>(null);
  useEffect(() => {
    terrainMesh.current = scene.getObjectByName('terrain') as THREE.Mesh;
  }, [scene]);

  // Get terrain height at position
  const getTerrainHeight = (position: THREE.Vector3): number => {
    if (!terrainMesh.current) return CHARACTER_HEIGHT_OFFSET;

    terrainRaycaster.current.set(
      new THREE.Vector3(position.x, 100, position.z),
      downVector
    );

    const intersects = terrainRaycaster.current.intersectObject(terrainMesh.current);
    if (intersects.length > 0) {
      return intersects[0].point.y + CHARACTER_HEIGHT_OFFSET;
    }
    return CHARACTER_HEIGHT_OFFSET;
  };

  useFrame(() => {
    if (groupRef.current) {
      const currentPosition = groupRef.current.position.clone();
      setCharacterPosition(currentPosition);
      onPositionUpdate && onPositionUpdate(currentPosition);
    }
  });

  // Adjust camera position for collision
  const adjustCameraForCollision = (targetPosition: THREE.Vector3, characterPosition: THREE.Vector3) => {
    if (!terrainMesh.current) return { position: targetPosition, collision: false };

    const directionToCamera = targetPosition.clone().sub(characterPosition).normalize();
    const distance = characterPosition.distanceTo(targetPosition);
    
    // Cast ray from character to desired camera position
    cameraRaycaster.current.set(characterPosition, directionToCamera);
    const intersects = cameraRaycaster.current.intersectObject(terrainMesh.current, true);

    if (intersects.length > 0) {
        const hitDistance = intersects[0].distance;
        if (hitDistance < distance) {
            // Keep minimum distance and add padding
            const adjustedDistance = Math.max(MIN_CAMERA_DISTANCE, hitDistance - CAMERA_COLLISION_PADDING);
            return {
                position: characterPosition.clone().add(directionToCamera.multiplyScalar(adjustedDistance)),
                collision: true
            };
        }
    }

    // Check terrain height at camera position
    const terrainHeightAtCamera = getTerrainHeight(targetPosition);
    if (targetPosition.y < terrainHeightAtCamera + CAMERA_COLLISION_PADDING) {
        targetPosition.y = terrainHeightAtCamera + CAMERA_COLLISION_PADDING;
        return { position: targetPosition, collision: true };
    }

    return { position: targetPosition, collision: false };
};

  const [movement, setMovement] = useState({
    forward: false,
    backward: false,
    left: false,
    right: false,
    run: false,
    jump: false,
  });

  // Load character and animations
  const characterModel = useLoader(FBXLoader, "./character/Breathing Idle.fbx");
  const walkAnim = useLoader(FBXLoader, "./character/Walking.fbx");
  const runAnim = useLoader(FBXLoader, "./character/Running.fbx");
  const jumpAnim = useLoader(FBXLoader, "./character/Jump.fbx");
  const prayerAnim = useLoader(FBXLoader, "./character/Praying.fbx");
  const liftAnim = useLoader(FBXLoader, "./character/Lifting.fbx");
  const throwAnim = useLoader(FBXLoader, "./character/Throwing.fbx");
  const floatAnim = useLoader(FBXLoader, "./character/Floating.fbx");


  // Mouse handlers
  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (event.button === 2) {
      isRightMouseDown.current = true;
      lastMouseX.current = event.clientX;
      lastMouseY.current = event.clientY;
      event.preventDefault();
    }
  }, []);

  const handleMouseUp = useCallback((event: MouseEvent) => {
    if (event.button === 2) {
      isRightMouseDown.current = false;
    }
  }, []);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (isRightMouseDown.current) {
      const deltaX = event.clientX - lastMouseX.current;
      const deltaY = event.clientY - lastMouseY.current;

      cameraRotation.current -= deltaX * MOUSE_SENSITIVITY;
      cameraPitch.current = Math.max(0.1, Math.min(1.0, cameraPitch.current + deltaY * MOUSE_SENSITIVITY));

      lastMouseX.current = event.clientX;
      lastMouseY.current = event.clientY;
    }
  }, []);

  const handleContextMenu = useCallback((event: Event) => {
    event.preventDefault();
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (isPraying) return;
  
    switch (event.code) {
      case 'KeyW':
        setMovement(prev => ({ ...prev, forward: true }));
        break;
      case 'KeyS':
        setMovement(prev => ({ ...prev, backward: true }));
        break;
      case 'KeyA':
        setMovement(prev => ({ ...prev, left: true }));
        break;
      case 'KeyD':
        setMovement(prev => ({ ...prev, right: true }));
        break;
      case 'ShiftLeft':
        setMovement(prev => ({ ...prev, run: true }));
        break;
      case 'Space':
        if (!isJumping.current) {
          setMovement(prev => ({ ...prev, jump: true }));
          verticalVelocity.current = JUMP_FORCE;
          isJumping.current = true;
        }
        break;
      case 'KeyE':
        if (isNearIdol && !isPraying) {
          setIsPraying(true);
          setMovement({
            forward: false,
            backward: false,
            left: false,
            right: false,
            run: false,
            jump: false
          });
        } else if (isNearTomato && !isHoldingTomato && !isPlayingLift && !isPlayingThrow) {
          startPickupAnimation();
        }
        break;
      case 'KeyF':
        if (isHoldingTomato && !isPlayingLift && !isPlayingThrow) {
          startThrowAnimation();
        }
        break;
    }
  }, [isPraying, isNearIdol, isHoldingTomato, isPlayingLift, isPlayingThrow, isNearTomato]);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    switch (event.code) {
      case 'KeyW':
        setMovement(prev => ({ ...prev, forward: false }));
        break;
      case 'KeyS':
        setMovement(prev => ({ ...prev, backward: false }));
        break;
      case 'KeyA':
        setMovement(prev => ({ ...prev, left: false }));
        break;
      case 'KeyD':
        setMovement(prev => ({ ...prev, right: false }));
        break;
      case 'ShiftLeft':
        setMovement(prev => ({ ...prev, run: false }));
        break;
      case 'Space':
        setMovement(prev => ({ ...prev, jump: false }));
        break;
    }
  }, []);

  useEffect(() => {
    if (!characterModel || !walkAnim || !runAnim || !jumpAnim || !prayerAnim) return;

    console.log('Loaded animation files:');
    console.log('Lift FBX:', liftAnim);
    console.log('Lift animations array:', liftAnim.animations);
    console.log('Throw FBX:', throwAnim);
    console.log('Throw animations array:', throwAnim.animations);
    
    const model = characterModel;
    model.scale.setScalar(0.05);
    model.position.y = CHARACTER_HEIGHT_OFFSET;

    const mixer = new THREE.AnimationMixer(model);
    mixerRef.current = mixer;

    const animsDict: { [key: string]: THREE.AnimationAction } = {};
    
    model.traverse((child) => {
      if (child instanceof THREE.Bone && child.name.toLowerCase().includes('hand') && child.name.toLowerCase().includes('right')) {
        rightHandBone.current = child;
        if (handBoneRef) {
          handBoneRef.current = child;
        }
      }
    });

    // Setup idle animation
    if (model.animations.length > 0) {
      animsDict.idle = mixer.clipAction(model.animations[0]);
      animsDict.idle.setLoop(THREE.LoopRepeat, Infinity);
    }

    // Setup walk animation
    if (walkAnim.animations.length > 0) {
      const walkClip = walkAnim.animations[0].clone();
      walkClip.tracks = walkClip.tracks.filter(track => !track.name.toLowerCase().includes('position'));
      animsDict.walk = mixer.clipAction(walkClip);
      animsDict.walk.setLoop(THREE.LoopRepeat, Infinity);
    }

    // Setup run animation
    if (runAnim.animations.length > 0) {
      const runClip = runAnim.animations[0].clone();
      runClip.tracks = runClip.tracks.filter(track => !track.name.toLowerCase().includes('position'));
      animsDict.run = mixer.clipAction(runClip);
      animsDict.run.setLoop(THREE.LoopRepeat, Infinity);
    }

    // Setup jump animation
    if (jumpAnim.animations.length > 0) {
      const jumpClip = jumpAnim.animations[0].clone();
      jumpClip.tracks = jumpClip.tracks.filter(track => !track.name.toLowerCase().includes('position'));
      animsDict.jump = mixer.clipAction(jumpClip);
      animsDict.jump.setLoop(THREE.LoopOnce, 0);
      animsDict.jump.clampWhenFinished = true;
    }

    // Setup prayer animation
    if (prayerAnim.animations.length > 0) {
      const prayClip = prayerAnim.animations[0].clone();
      
      // Keep all tracks including position
      animsDict.prayer = mixer.clipAction(prayClip);
      animsDict.prayer.setLoop(THREE.LoopOnce, 1);
      animsDict.prayer.clampWhenFinished = true;
    
      // Calculate the maximum Y offset from the animation
      let maxY = 0;
      prayClip.tracks.forEach(track => {
        if (track.name.includes('position')) {
          for (let i = 1; i < track.values.length; i += 3) {
            maxY = Math.max(maxY, Math.abs(track.values[i]));
          }
        }
      });
      prayerYOffset.current = maxY;
    }

    if (floatAnim.animations.length > 0) {
      const floatClip = floatAnim.animations[0].clone();
      animsDict.float = mixer.clipAction(floatClip);
      animsDict.float.setLoop(THREE.LoopRepeat, Infinity);
    }

    if (liftAnim.animations.length > 0) {
      console.log('Setting up lift animation');
      const liftClip = liftAnim.animations[0].clone();
      
      // Remove position tracks if they exist
      liftClip.tracks = liftClip.tracks.filter(track => !track.name.toLowerCase().includes('position'));
      
      // Create the action
      animsDict.lift = mixer.clipAction(liftClip, model);
      
      // Configure the action
      animsDict.lift.setLoop(THREE.LoopOnce, 0);
      animsDict.lift.enabled = true;
  }

    // Setup throw animation
    if (throwAnim.animations.length > 0) {
      console.log('Setting up throw animation');
      const throwClip = throwAnim.animations[0].clone();
      
      // Remove position tracks if they exist
      throwClip.tracks = throwClip.tracks.filter(track => !track.name.toLowerCase().includes('position'));
      
      // Create the action
      animsDict.throw = mixer.clipAction(throwClip, model);
      
      // Configure the action
      animsDict.throw.setLoop(THREE.LoopOnce, 0);
      animsDict.throw.clampWhenFinished = true;
      animsDict.throw.enabled = true;
      animsDict.throw.weight = 1;
      animsDict.throw.setEffectiveTimeScale(1);
      animsDict.throw.setDuration(2.2);  // Original throw duration
      
      // Log the setup
      console.log('Throw animation setup:', {
          duration: animsDict.throw.getClip().duration,
          weight: animsDict.throw.getEffectiveWeight(),
          timeScale: animsDict.throw.getEffectiveTimeScale(),
          enabled: animsDict.throw.enabled
      });
  }

    setAnimations(animsDict);

    // Start with idle
    if (animsDict.idle) {
      animsDict.idle.play();
      setCurrentAction(animsDict.idle);
    }

    // Only initialize camera once
    if (!cameraInitialized.current) {
      console.log('camera init')
      const cameraOffset = new THREE.Vector3(
        Math.sin(rotationRef.current) * -CAMERA_DISTANCE,
        CAMERA_HEIGHT,
        Math.cos(rotationRef.current) * -CAMERA_DISTANCE
      );
      const initialPosition = model.position.clone().add(cameraOffset);
      camera.position.copy(initialPosition);

      const lookAtPosition = model.position.clone().add(
        new THREE.Vector3(0, CAMERA_HEIGHT * 0.3 + CHARACTER_HEIGHT_OFFSET, 0)
      );
      camera.lookAt(lookAtPosition);

      cameraInitialized.current = true;
    }
    return () => {
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        // We need to provide a no-op function as the listener
        mixerRef.current.removeEventListener('finished', () => {});
      }
    };
  }, [characterModel, walkAnim, runAnim, jumpAnim, prayerAnim, camera]);

  useEffect(() => {
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleMouseDown, handleMouseUp, handleMouseMove, handleContextMenu, handleKeyDown, handleKeyUp]);
  
const startPickupAnimation = () => {
  if (!animations.lift || !mixerRef.current || isPlayingLift) return;
  
  console.log('Starting pickup animation');
  setIsPlayingLift(true);
  liftTimeRef.current = 0;  // Reset timing
  window.tomatoPickedUp = false;  // Reset pickup state

  const liftAction = animations.lift;
  if (!liftAction) return;

  // Fade out current action
  if (currentAction && currentAction !== liftAction) {
    currentAction.fadeOut(0.2);
  }

  // Configure lift action
  liftAction.reset();
  liftAction.setLoop(THREE.LoopOnce, 0);
  liftAction.clampWhenFinished = true;
  liftAction.enabled = true;
  liftAction.setEffectiveWeight(5);
  liftAction.setEffectiveTimeScale(1);
  liftAction.fadeIn(0.2);

  const onLiftComplete = (e: any) => {
    if (e.action !== liftAction) return;
    mixerRef.current?.removeEventListener('finished', onLiftComplete);
    
    setIsPlayingLift(false);
    onTomatoPickup?.();

    // Return to idle
    if (animations.idle) {
      liftAction.fadeOut(0.2);
      animations.idle.reset().fadeIn(0.2).play();
      setCurrentAction(animations.idle);
    }
  };

  mixerRef.current.removeEventListener('finished', onLiftComplete);
  mixerRef.current.addEventListener('finished', onLiftComplete);

  liftAction.play();
  setCurrentAction(liftAction);
};

// Update the startThrowAnimation:
const startThrowAnimation = () => {
  if (!animations.throw || !mixerRef.current || isPlayingThrow) return;
  
  console.log('Starting throw animation');
  setIsPlayingThrow(true);
  throwTimeRef.current = 0;
  window.tomatoThrown = false;  // Reset throw flag

  const throwAction = animations.throw;

  if (currentAction && currentAction !== throwAction) {
    currentAction.fadeOut(0.2);
  }

  throwAction.reset();
  throwAction.setLoop(THREE.LoopOnce, 0);
  throwAction.clampWhenFinished = true;
  throwAction.enabled = true;
  throwAction.setEffectiveTimeScale(1);
  throwAction.setEffectiveWeight(1);
  throwAction.fadeIn(0.2);

  const onThrowComplete = (e: any) => {
    if (e.action !== throwAction) return;
    mixerRef.current?.removeEventListener('finished', onThrowComplete);
    
    setIsPlayingThrow(false);
    window.tomatoPickedUp = false;  // Reset pickup flag after animation
    
    // Return to idle
    if (animations.idle) {
      throwAction.fadeOut(0.2);
      animations.idle.reset().fadeIn(0.2).play();
      setCurrentAction(animations.idle);
    }
  };

  mixerRef.current.removeEventListener('finished', onThrowComplete);
  mixerRef.current.addEventListener('finished', onThrowComplete);

  throwAction.play();
  setCurrentAction(throwAction);
};

  useFrame((state, delta) => {
    if (!groupRef.current || !mixerRef.current || !animations.idle) return;

    if (currentAction === animations.throw && isPlayingThrow) {
      throwTimeRef.current = currentAction.time;
      
      // Check for throw point
      if (throwTimeRef.current >= THROW_RELEASE_TIME && !window.tomatoThrown) {
        window.tomatoThrown = true;  // Flag to prevent multiple throws
        
        const throwDir = new THREE.Vector3(0, Math.sin(THROW_ANGLE), Math.cos(THROW_ANGLE))
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationRef.current)
          .normalize(); // Don't multiply by force here
        
        if (handBoneRef?.current) {
          const tomatoPosition = new THREE.Vector3();
          handBoneRef.current.getWorldPosition(tomatoPosition);
          console.log("Throwing tomato from position:", tomatoPosition);
          onTomatoThrow?.(tomatoPosition, throwDir);
        }
      }
    }

    if (currentAction === animations.lift && isPlayingLift) {
      liftTimeRef.current = currentAction.time;
    
      // If we reached the pickup point and haven't triggered pickup yet
      if (liftTimeRef.current >= LIFT_PICKUP_TIME && !window.tomatoPickedUp) {
        window.tomatoPickedUp = true;
        // Trigger the tomato pickup callback here
        onTomatoPickup?.();
      }
    }
    
    
    if (isPlayingLift || isPlayingThrow) {
      mixerRef.current.update(delta);
      return;
    }

    mixerRef.current.update(delta);

    if (onPositionUpdate) {
      onPositionUpdate(groupRef.current.position);
    }

    if (isAscending) {
      // Smoothly transition to float animation if not already floating
      if (currentAction !== animations.float) {
        currentAction?.fadeOut(0.2);
        animations.float.reset().fadeIn(0.2).play();
        setCurrentAction(animations.float);
      }
  
      // Move character up
      const nextPosition = groupRef.current.position.clone();
      nextPosition.y += ascensionSpeed;
      groupRef.current.position.copy(nextPosition);
  
      // Update camera position
      if (camera) {
        camera.position.y += ascensionSpeed;
      }
    }

  // Prayer logic
  if (isPraying) {
    if (!isPlayingPrayer.current && currentAction !== animations.prayer) {
        isPlayingPrayer.current = true;
        
        // Fade out current action
        if (currentAction) {
            currentAction.fadeOut(0.2);
        }

        animations.prayer
            .reset()
            .fadeIn(0.2)
            .play();
        
        const onPrayerDone = () => {
            mixerRef.current?.removeEventListener('finished', onPrayerDone);
            
            // Reset the entire mixer
            const oldTime = mixerRef.current?.time || 0;
            mixerRef.current?.stopAllAction();
            mixerRef.current?.update(0);
            mixerRef.current?.setTime(0);
            
            // Clear states
            setIsPraying(false);
            isPlayingPrayer.current = false;
            
            // Start fresh with idle
            animations.idle
                .reset()
                .fadeIn(0.2)
                .play();
                
            setCurrentAction(animations.idle);
            
            // Update mixer to maintain timing
            mixerRef.current?.update(oldTime);
        };
        
        mixerRef.current?.addEventListener('finished', onPrayerDone);
        setCurrentAction(animations.prayer);
    }
    
    // Maintain terrain height
    const terrainHeight = getTerrainHeight(groupRef.current.position);
    if (groupRef.current.position.y < terrainHeight) {
        groupRef.current.position.y = terrainHeight;
    }
}

  if (!isPraying && !isAscending) {
    const speed = movement.run ? CHARACTER_SPEED * 2 : CHARACTER_SPEED;
    const isMoving = movement.forward || movement.backward;

    // Handle rotation
    if (movement.left) rotationRef.current += ROTATION_SPEED * delta;
    if (movement.right) rotationRef.current -= ROTATION_SPEED * delta;

    // When moving, smoothly return camera behind character
    if (isMoving) {
      // Normalize the angle difference to prevent unnecessary spinning
      let angleDiff = rotationRef.current - cameraRotation.current;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      
      cameraRotation.current += angleDiff * ROTATION_SMOOTHING;
  }
    
    // Apply movement
    if (isMoving) {
      const moveDir = new THREE.Vector3(0, 0, movement.forward ? 1 : -1);
      moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationRef.current);
      moveDir.normalize();
      
      const nextPosition = groupRef.current.position.clone().add(moveDir.multiplyScalar(speed));
      const terrainHeight = getTerrainHeight(nextPosition);
      
      if (!isJumping.current) {
        nextPosition.y = terrainHeight;
      }
      
      groupRef.current.position.copy(nextPosition);
    }

    if (onRotationUpdate) {
      onRotationUpdate(rotationRef.current);
    }

    // Jump handling
    if (isJumping.current) {
      if (currentAction !== animations.jump) {
        currentAction?.fadeOut(0.1);
        animations.jump.reset().fadeIn(0.1).play();
        setCurrentAction(animations.jump);
      }

      verticalVelocity.current += GRAVITY;
      const nextPosition = groupRef.current.position.clone();
      nextPosition.y += verticalVelocity.current;
      
      const terrainHeight = getTerrainHeight(nextPosition);

      if (nextPosition.y <= terrainHeight) {
        nextPosition.y = terrainHeight;
        verticalVelocity.current = 0;
        isJumping.current = false;

        if (isMoving) {
          const landingAction = movement.run ? animations.run : animations.walk;
          currentAction?.fadeOut(0.1);
          landingAction.reset().fadeIn(0.1).play();
          setCurrentAction(landingAction);
        } else {
          currentAction?.fadeOut(0.1);
          animations.idle.reset().fadeIn(0.1).play();
          setCurrentAction(animations.idle);
        }
      }

      groupRef.current.position.copy(nextPosition);
    } else {
      // Non-jumping animations
      if (isMoving) {
        const targetAction = movement.run ? animations.run : animations.walk;
        if (currentAction !== targetAction) {
          currentAction?.fadeOut(0.1);
          targetAction.reset().fadeIn(0.1).play();
          setCurrentAction(targetAction);
        }
      } else if (currentAction !== animations.idle) {
        currentAction?.fadeOut(0.1);
        animations.idle.reset().fadeIn(0.1).play();
        setCurrentAction(animations.idle);
      }

      if (!isAscending) {
      const terrainHeight = getTerrainHeight(groupRef.current.position);
      groupRef.current.position.y = terrainHeight;
    }
    }
  }
    // Rotation
    groupRef.current.rotation.y = rotationRef.current;

    // Camera positioning with free-look
    const theta = cameraRotation.current;
    const phi = Math.PI * cameraPitch.current;
    
    const idealOffset = new THREE.Vector3(
        CAMERA_DISTANCE * Math.sin(theta) * Math.sin(phi),
        CAMERA_HEIGHT * Math.cos(phi),
        CAMERA_DISTANCE * Math.cos(theta) * Math.sin(phi)
    );

    let targetPosition = groupRef.current.position.clone().sub(idealOffset);
    const collisionResult = adjustCameraForCollision(targetPosition, groupRef.current.position);
    
    // If we're colliding, try to maintain the camera's view direction
    if (collisionResult.collision) {
        if (!isColliding.current) {
            // Just started colliding, store the current rotation
            targetCameraRotation.current = cameraRotation.current;
        }
        isColliding.current = true;
        
        // Use lastValidPosition if available
        if (lastValidCameraPosition.current) {
            targetPosition.lerp(lastValidCameraPosition.current, 0.5);
        }
    } else {
        isColliding.current = false;
        lastValidCameraPosition.current.copy(targetPosition);
    }

    // Apply camera position with smoothing
    if (isFirstFrame.current) {
        camera.position.copy(targetPosition);
        isFirstFrame.current = false;
    } else {
        camera.position.lerp(targetPosition, CAMERA_SMOOTHING);
    }

    // Update camera look-at
    const lookAtPosition = groupRef.current.position.clone().add(
        new THREE.Vector3(0, CAMERA_HEIGHT * 0.3 + CHARACTER_HEIGHT_OFFSET, 0)
    );
    camera.lookAt(lookAtPosition);
  });

  return (
    <group ref={groupRef}>
      <primitive object={characterModel} />
    </group>
  );
};

export default Character;