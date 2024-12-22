import { useFrame, useLoader, useThree } from "@react-three/fiber";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import * as THREE from "three";
import { Group } from "three";

// Constants
const CHARACTER_SPEED = 15; // Units per second
const JUMP_FORCE = 19;
const GRAVITY = -50;
const MAX_FALL_SPEED = -500;
const GROUND_FRICTION = 0.8;
const AIR_CONTROL = 1;
const CAMERA_DISTANCE = 20;
const CAMERA_HEIGHT = 25;
const CAMERA_SMOOTHING = 0.08;
const CHARACTER_HEIGHT_OFFSET = 0;
const ROTATION_SPEED = 2.5;
const MOUSE_SENSITIVITY = 0.004;
const ROTATION_SMOOTHING = 0.05;
const MIN_CAMERA_DISTANCE = 5;
const CAMERA_COLLISION_PADDING = 1.0;
const THROW_FORCE = 20;
const THROW_ANGLE = Math.PI / 4;
const LIFT_PICKUP_TIME = 1.5;
const THROW_RELEASE_TIME = 0.7;
const COLLISION_CHECK_INTERVAL = 0.1;
const ASCENSION_SPEED = 0.2;

// Types
interface CharacterProps {
  camera: THREE.PerspectiveCamera;
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
}

// Extend global interface
declare global {
  interface Window {
    tomatoPickedUp: boolean;
    tomatoThrown: boolean;
  }
}

// Initialize globals
window.tomatoPickedUp = false;
window.tomatoThrown = false;

const Character: React.FC<CharacterProps> = ({
  camera,
  isNearIdol = false,
  onPositionUpdate,
  onRotationUpdate,
  onTomatoThrow,
  onTomatoPickup,
  isHoldingTomato = false,
  isNearTomato,
  handBoneRef,
  isAscending,
  isNearNPC,
  canAscend,
  onDialogProgress,
  onCanAscend,
  onTomatoOffer,
}) => {
  // Scene and references
  const { scene } = useThree();
  const groupRef = useRef<Group>(null!);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const rightHandBone = useRef<THREE.Bone | null>(null);

  // currentAction as a ref (not state) to avoid extra re-renders
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);

  // State
  const [animations, setAnimations] = useState<{ [key: string]: THREE.AnimationAction }>({});
  const [isPraying, setIsPraying] = useState(false);
  const [isPlayingLift, setIsPlayingLift] = useState(false);
  const [isPlayingThrow, setIsPlayingThrow] = useState(false);
  const [characterPosition, setCharacterPosition] = useState(new THREE.Vector3());

  // Memoized vectors and raycasters
  const downVector = useMemo(() => new THREE.Vector3(0, -1, 0), []);
  const terrainRaycaster = useMemo(() => new THREE.Raycaster(), []);
  const cameraRaycaster = useMemo(() => new THREE.Raycaster(), []);

  // Movement + physics refs
  const rotationRef = useRef(0);
  const isJumping = useRef(false);
  const verticalVelocity = useRef(0);
  const isFirstFrame = useRef(true);
  const isPlayingPrayer = useRef(false);
  const targetCameraRotation = useRef(0);
  const lastValidCameraPosition = useRef(new THREE.Vector3());
  const isColliding = useRef(false);
  const liftTimeRef = useRef(0);
  const throwTimeRef = useRef(0);
  const timeSinceLastCheck = useRef(0);

  // Camera controls
  const cameraInitialized = useRef(false);
  const isRightMouseDown = useRef(false);
  const lastMouseX = useRef(0);
  const lastMouseY = useRef(0);
  const cameraRotation = useRef(0);
  const cameraPitch = useRef(1);

  // Terrain reference
  const terrainMesh = useRef<THREE.Mesh | null>(null);
  useEffect(() => {
    terrainMesh.current = scene.getObjectByName("terrain") as THREE.Mesh;
  }, [scene]);

  // Movement state
  const [movement, setMovement] = useState({
    forward: false,
    backward: false,
    left: false,
    right: false,
    run: false,
    jump: false,
  });

  // ---- HELPER: Crossfade from oldAction to newAction ----
  const crossFadeTo = useCallback(
    (newAction: THREE.AnimationAction, fadeDuration: number = 0.2) => {
      const oldAction = currentActionRef.current;
      if (oldAction === newAction) return; // Already playing this action

      newAction.enabled = true;
      newAction.setEffectiveTimeScale(1.0);
      newAction.setEffectiveWeight(1.0);
      newAction.reset();
      newAction.play();

      if (oldAction) {
        // Crossfade from old to new
        newAction.crossFadeFrom(oldAction, fadeDuration, true);
      }
      currentActionRef.current = newAction;
    },
    []
  );

  // Terrain height calculation
  const getTerrainHeight = useCallback(
    (position: THREE.Vector3): number => {
      if (!terrainMesh.current) return CHARACTER_HEIGHT_OFFSET;
      terrainRaycaster.set(new THREE.Vector3(position.x, 100, position.z), downVector);
      const intersects = terrainRaycaster.intersectObject(terrainMesh.current);
      return intersects.length > 0
        ? intersects[0].point.y + CHARACTER_HEIGHT_OFFSET
        : CHARACTER_HEIGHT_OFFSET;
    },
    [downVector]
  );

  // Camera collision check
  const adjustCameraForCollision = useCallback(
    (targetPosition: THREE.Vector3, characterPos: THREE.Vector3, delta: number) => {
      if (!terrainMesh.current) {
        return { position: targetPosition, collision: false };
      }

      // Maintain interval-based checking
      timeSinceLastCheck.current += delta;
      if (timeSinceLastCheck.current < COLLISION_CHECK_INTERVAL) {
        return {
          position: isColliding.current ? lastValidCameraPosition.current : targetPosition,
          collision: isColliding.current,
        };
      }
      timeSinceLastCheck.current = 0;

      const directionToCamera = targetPosition.clone().sub(characterPos).normalize();
      const distance = characterPos.distanceTo(targetPosition);

      // Enhanced collision detection
      cameraRaycaster.set(characterPos, directionToCamera);
      const intersects = cameraRaycaster.intersectObject(terrainMesh.current);

      if (intersects.length > 0) {
        const hitDistance = intersects[0].distance;
        if (hitDistance < distance) {
          const adjustedDistance = Math.max(
            MIN_CAMERA_DISTANCE + 1, // Slightly increased minimum distance
            hitDistance - CAMERA_COLLISION_PADDING
          );
          
          const newPosition = characterPos.clone().add(
            directionToCamera.multiplyScalar(adjustedDistance)
          );

          // Store last valid position
          lastValidCameraPosition.current.copy(newPosition);
          
          return {
            position: newPosition,
            collision: true,
          };
        }
      }

      // Enhanced terrain height check
      const terrainHeight = getTerrainHeight(targetPosition);
      if (targetPosition.y < terrainHeight + CAMERA_COLLISION_PADDING) {
        const adjustedPosition = targetPosition.clone();
        adjustedPosition.y = terrainHeight + CAMERA_COLLISION_PADDING;
        
        // Store last valid position
        lastValidCameraPosition.current.copy(adjustedPosition);
        
        return { 
          position: adjustedPosition, 
          collision: true 
        };
      }

      // No collision - update last valid position
      lastValidCameraPosition.current.copy(targetPosition);
      isColliding.current = false;

      return { position: targetPosition, collision: false };
    },
    [getTerrainHeight]
  );

  // Animation handlers
  const startPickupAnimation = useCallback(() => {
    const { lift, idle } = animations;
    console.log("Cannot start lift:", {
      hasLift: !!animations.lift,
      hasMixer: !!mixerRef.current,
      isPlayingLift
    });
    if (!lift || !mixerRef.current || isPlayingLift) return;

    setIsPlayingLift(true);
    liftTimeRef.current = 0;
    window.tomatoPickedUp = false;

    crossFadeTo(lift);

    // Listen for finishing
    const onLiftComplete = (e: any) => {
      if (e.action !== lift) return;
      mixerRef.current?.removeEventListener("finished", onLiftComplete);

      setIsPlayingLift(false);
      // Crossfade back to idle
      if (idle) crossFadeTo(idle);
    };

    mixerRef.current.addEventListener("finished", onLiftComplete);
  }, [animations, crossFadeTo, isPlayingLift]);

  const startThrowAnimation = useCallback(() => {
    const { throw: throwAnim, idle } = animations;
    if (!throwAnim || !mixerRef.current || isPlayingThrow) return;

    setIsPlayingThrow(true);
    throwTimeRef.current = 0;
    window.tomatoThrown = false;

    crossFadeTo(throwAnim);

    const onThrowComplete = (e: any) => {
      if (e.action !== throwAnim) return;
      mixerRef.current?.removeEventListener("finished", onThrowComplete);

      setIsPlayingThrow(false);
      window.tomatoPickedUp = false; // No longer holding tomato
      if (idle) crossFadeTo(idle);
    };

    mixerRef.current.removeEventListener("finished", onThrowComplete);
    mixerRef.current.addEventListener("finished", onThrowComplete);
  }, [animations, crossFadeTo, isPlayingThrow]);

  // Update the character position (separate small useFrame)
  useFrame(() => {
    if (groupRef.current) {
      const currentPosition = groupRef.current.position.clone();
      setCharacterPosition(currentPosition);
      onPositionUpdate?.(currentPosition);
    }
  });

  // Mouse control
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
      cameraPitch.current = Math.max(
        0.1,
        Math.min(1.0, cameraPitch.current + deltaY * MOUSE_SENSITIVITY)
      );

      lastMouseX.current = event.clientX;
      lastMouseY.current = event.clientY;
    }
  }, []);

  const handleContextMenu = useCallback((event: Event) => {
    event.preventDefault();
  }, []);

  // Keyboard handlers
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (isPraying) return;

      switch (event.code) {
        case "KeyW":
          setMovement((prev) => ({ ...prev, forward: true }));
          break;
        case "KeyS":
          setMovement((prev) => ({ ...prev, backward: true }));
          break;
        case "KeyA":
          setMovement((prev) => ({ ...prev, left: true }));
          break;
        case "KeyD":
          setMovement((prev) => ({ ...prev, right: true }));
          break;
        case "ShiftLeft":
          setMovement((prev) => ({ ...prev, run: true }));
          break;
        case "Space":
          if (!isJumping.current) {
            setMovement((prev) => ({ ...prev, jump: true }));
            verticalVelocity.current = JUMP_FORCE;
            isJumping.current = true;

            if (animations.jump) {
              crossFadeTo(animations.jump, 0.1);
            }
          }
          break;
        case "KeyE":
          if (isNearNPC) {
            onDialogProgress?.();
          } else if (isNearTomato && !isHoldingTomato && !isPlayingLift && !isPlayingThrow && !canAscend) {
            startPickupAnimation();
          } else if (isNearIdol && isHoldingTomato && !canAscend) {
            onTomatoOffer?.();
            onCanAscend?.();
          } else if (isNearIdol && canAscend) {
            setIsPraying(true);
          }
          break;
        case "KeyF":
          if (isHoldingTomato && !isPlayingLift && !isPlayingThrow) {
            startThrowAnimation();
          }
          break;
      }
    },
    [
      isPraying,
      isNearIdol,
      isNearNPC,
      isHoldingTomato,
      canAscend,
      isNearTomato,
      isPlayingLift,
      isPlayingThrow,
      animations.jump,
      crossFadeTo,
      onDialogProgress,
      onCanAscend,
      onTomatoOffer,
      startPickupAnimation,
      startThrowAnimation,
    ]
  );

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    switch (event.code) {
      case "KeyW":
        setMovement((prev) => ({ ...prev, forward: false }));
        break;
      case "KeyS":
        setMovement((prev) => ({ ...prev, backward: false }));
        break;
      case "KeyA":
        setMovement((prev) => ({ ...prev, left: false }));
        break;
      case "KeyD":
        setMovement((prev) => ({ ...prev, right: false }));
        break;
      case "ShiftLeft":
        setMovement((prev) => ({ ...prev, run: false }));
        break;
      case "Space":
        setMovement((prev) => ({ ...prev, jump: false }));
        break;
    }
  }, []);

  // Load all models/animations
  const characterModel = useLoader(FBXLoader, "./character/BreathingIdle.fbx");
  const walkAnim = useLoader(FBXLoader, "./character/Walking.fbx");
  const runAnim = useLoader(FBXLoader, "./character/Running.fbx");
  const jumpAnim = useLoader(FBXLoader, "./character/Jump.fbx");
  const prayerAnim = useLoader(FBXLoader, "./character/Praying.fbx");
  const liftAnim = useLoader(FBXLoader, "./character/Lifting.fbx");
  const throwAnim = useLoader(FBXLoader, "./character/Throwing.fbx");
  const floatAnim = useLoader(FBXLoader, "./character/Floating.fbx");

  // Model and animation setup
  useEffect(() => {
    if (
      !characterModel ||
      !walkAnim ||
      !runAnim ||
      !jumpAnim ||
      !prayerAnim ||
      !liftAnim ||
      !throwAnim ||
      !floatAnim
    )
      return;

    const model = characterModel;
    model.scale.setScalar(0.05);
    model.position.y = CHARACTER_HEIGHT_OFFSET;

    // Create mixer
    const mixer = new THREE.AnimationMixer(model);
    mixerRef.current = mixer;

    const animsDict: { [key: string]: THREE.AnimationAction } = {};

    // Locate the right hand bone
    model.traverse((child) => {
      if (
        child instanceof THREE.Bone &&
        child.name.toLowerCase().includes("hand") &&
        child.name.toLowerCase().includes("right")
      ) {
        rightHandBone.current = child;
        if (handBoneRef) {
          handBoneRef.current = child;
        }
      }
    });

    // Helper to set up an animation with optional position-track removal
    const setupAnimation = (
      source: THREE.Object3D,
      key: string,
      removePosition: boolean,
      loopType: THREE.AnimationActionLoopStyles = THREE.LoopRepeat,
      clampWhenFinished = false
    ) => {
      if (source.animations.length > 0) {
        const clip = source.animations[0].clone();

        if (removePosition) {
          clip.tracks = clip.tracks.filter(
            (track) => !track.name.toLowerCase().includes("position")
          );
        }

        const action = mixer.clipAction(clip);
        action.setLoop(loopType, Infinity);
        action.clampWhenFinished = clampWhenFinished;
        action.enabled = true;
        action.setEffectiveWeight(1.0);
        animsDict[key] = action;
      }
    };

    // Here we selectively remove or keep position tracks:
    setupAnimation(model, "idle", false); // Idle keeps position if any (usually none).
    setupAnimation(walkAnim, "walk", true); // Remove position from walk
    setupAnimation(runAnim, "run", true);   // Remove position from run
    setupAnimation(jumpAnim, "jump", true, THREE.LoopOnce, true); // Remove root motion from jump
    setupAnimation(prayerAnim, "prayer", false, THREE.LoopOnce, true); // Typically no root motion anyway
    setupAnimation(floatAnim, "float", false); // For ascension—no position removal if you want
    setupAnimation(liftAnim, "lift", false, THREE.LoopOnce, true); // Usually stays in place
    setupAnimation(throwAnim, "throw", false, THREE.LoopOnce, true); // Usually stays in place

    setAnimations(animsDict);

    // Start with Idle
    if (animsDict.idle) {
      animsDict.idle.reset().play();
      currentActionRef.current = animsDict.idle;
    }

    // Initialize camera once
    if (!cameraInitialized.current) {
      const cameraOffset = new THREE.Vector3(
        Math.sin(rotationRef.current) * -CAMERA_DISTANCE,
        CAMERA_HEIGHT,
        Math.cos(rotationRef.current) * -CAMERA_DISTANCE
      );
      const initialPosition = model.position.clone().add(cameraOffset);
      camera.position.copy(initialPosition);

      const lookAtPosition = model.position
        .clone()
        .add(new THREE.Vector3(0, CAMERA_HEIGHT * 0.3 + CHARACTER_HEIGHT_OFFSET, 0));
      camera.lookAt(lookAtPosition);

      cameraInitialized.current = true;
    }

    return () => {
      mixer.stopAllAction();
    };
  }, [
    characterModel,
    walkAnim,
    runAnim,
    jumpAnim,
    prayerAnim,
    liftAnim,
    throwAnim,
    floatAnim,
    camera,
    handBoneRef,
  ]);

  // Input event listeners
  useEffect(() => {
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    handleMouseDown,
    handleMouseUp,
    handleMouseMove,
    handleContextMenu,
    handleKeyDown,
    handleKeyUp,
  ]);

  // Main update loop
  useFrame((_, delta) => {
    if (!groupRef.current || !mixerRef.current) return;

    // Update animations
    mixerRef.current.update(delta);

    // Throw animation release
    if (
      currentActionRef.current === animations.throw &&
      isPlayingThrow &&
      throwTimeRef.current !== undefined
    ) {
      throwTimeRef.current = currentActionRef.current.time;
      if (throwTimeRef.current >= THROW_RELEASE_TIME && !window.tomatoThrown) {
        window.tomatoThrown = true;

        // Compute throw direction
        const throwDir = new THREE.Vector3(0, Math.sin(THROW_ANGLE), Math.cos(THROW_ANGLE))
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationRef.current)
          .normalize();

        if (handBoneRef?.current) {
          const tomatoPosition = new THREE.Vector3();
          handBoneRef.current.getWorldPosition(tomatoPosition);
          onTomatoThrow?.(tomatoPosition, throwDir);
        }
      }
      // Return so we don't do normal movement while throwing
      return;
    }

    // Lift animation
    if (currentActionRef.current === animations.lift && isPlayingLift) {
      liftTimeRef.current = currentActionRef.current.time;
      // Force the character to remain on the ground
      const terrainHeight = getTerrainHeight(groupRef.current.position);
      groupRef.current.position.y = terrainHeight;

      if (liftTimeRef.current >= LIFT_PICKUP_TIME && !window.tomatoPickedUp) {
        window.tomatoPickedUp = true;
        onTomatoPickup?.();
      }
      return;
    }

    // Ascension
    if (isAscending) {
      if (currentActionRef.current !== animations.float && animations.float) {
        crossFadeTo(animations.float, 0.2);
      }
      // Move upward
      const nextPos = groupRef.current.position.clone();
      nextPos.y += ASCENSION_SPEED;
      groupRef.current.position.copy(nextPos);
      camera.position.y += ASCENSION_SPEED;
      return;
    }

    // Prayer
    if (isPraying) {
      if (!isPlayingPrayer.current) {
        isPlayingPrayer.current = true;
  
        if (animations.prayer) {
          // Stop any current animation immediately
          if (currentActionRef.current) {
            currentActionRef.current.stop();
          }
  
          // Start prayer animation
          animations.prayer.reset();
          animations.prayer.setLoop(THREE.LoopOnce, 0);
          animations.prayer.clampWhenFinished = true;
          animations.prayer.play();
          currentActionRef.current = animations.prayer;
  
          const onPrayerComplete = () => {
            // Remove listener first
            mixerRef.current?.removeEventListener('finished', onPrayerComplete);
            
            // Stop the prayer animation
            animations.prayer.stop();
            
            // Reset flags
            isPlayingPrayer.current = false;
            setIsPraying(false);
            
            // Start idle animation
            if (animations.idle) {
              animations.idle.reset();
              animations.idle.play();
              currentActionRef.current = animations.idle;
            }
          };
  
          mixerRef.current.removeEventListener('finished', onPrayerComplete);
          mixerRef.current.addEventListener('finished', onPrayerComplete);
        }
      }
      
      // Keep character grounded during prayer
      const terrainHeight = getTerrainHeight(groupRef.current.position);
      groupRef.current.position.y = terrainHeight;
      
      return; // Skip other updates while praying
    }

    // ----- Normal Movement & Physics -----
    // Distinguish "translating" vs. "rotating only"
    //  - If the user only presses A/D, we do NOT walk/run, we just rotate in place.
    //  - If the user presses W/S (with optional A/D), we walk/run.
    const isForwardBackPressed = movement.forward || movement.backward;
    const isSideOnly = (movement.left || movement.right) && !isForwardBackPressed;

    // Speed if actually translating forward/back
    const speed = movement.run ? CHARACTER_SPEED * 2 : CHARACTER_SPEED;

    // Apply rotation if left/right pressed (always).
    if (movement.left) rotationRef.current += ROTATION_SPEED * delta;
    if (movement.right) rotationRef.current -= ROTATION_SPEED * delta;

    // Camera rotation smoothing if actually translating
    if (isForwardBackPressed) {
      let angleDiff = rotationRef.current - cameraRotation.current;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      cameraRotation.current += angleDiff * ROTATION_SMOOTHING;
    }

    // Movement / Jump if actually moving forward/back
    if (isForwardBackPressed || isJumping.current) {
      const forwardBack = movement.forward ? 1 : movement.backward ? -1 : 0;
      const moveDir = new THREE.Vector3(0, 0, forwardBack);
      moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationRef.current).normalize();

      const nextPos = groupRef.current.position.clone();

      // Move horizontally if forward/back pressed
      if (isForwardBackPressed) {
        const movementDelta = moveDir.multiplyScalar(speed * delta);
        movementDelta.multiplyScalar(isJumping.current ? AIR_CONTROL : GROUND_FRICTION);
        nextPos.add(movementDelta);
      }

      // Apply jump/fall
      if (isJumping.current) {
        verticalVelocity.current += GRAVITY * delta;
        verticalVelocity.current = Math.max(verticalVelocity.current, MAX_FALL_SPEED);
        nextPos.y += verticalVelocity.current * delta;
      }

      // Ground collision
      const terrainHeight = getTerrainHeight(nextPos);
      if (nextPos.y <= terrainHeight) {
        nextPos.y = terrainHeight;
        if (isJumping.current) {
          verticalVelocity.current = 0;
          isJumping.current = false;

          // Crossfade landing
          if (currentActionRef.current === animations.jump) {
            if (isForwardBackPressed) {
              const landingAction = movement.run ? animations.run : animations.walk;
              if (landingAction) crossFadeTo(landingAction, 0.1);
            } else if (animations.idle) {
              crossFadeTo(animations.idle, 0.1);
            }
          }
        }
      }
      groupRef.current.position.copy(nextPos);
    } else {
      // If not jumping or moving forward/back, keep on the ground
      const terrainHeight = getTerrainHeight(groupRef.current.position);
      groupRef.current.position.y = terrainHeight;
    }

    // Update rotation for the character
    groupRef.current.rotation.y = rotationRef.current;
    onRotationUpdate?.(rotationRef.current);

    // Animation transitions if not jumping
    if (!isJumping.current) {
      if (isForwardBackPressed) {
        // If pressing W/S (with optional A/D), use walk or run
        const targetAction = movement.run ? animations.run : animations.walk;
        if (targetAction && currentActionRef.current !== targetAction) {
          crossFadeTo(targetAction, 0.1);
        }
      } else {
        // If only A/D pressed, we rotate in place => remain in idle
        if (animations.idle && currentActionRef.current !== animations.idle) {
          crossFadeTo(animations.idle, 0.1);
        }
      }
    }

    // Camera positioning
    const theta = cameraRotation.current;
    const phi = Math.PI * cameraPitch.current;
    
    const idealOffset = new THREE.Vector3(
      CAMERA_DISTANCE * Math.sin(theta) * Math.sin(phi),
      CAMERA_HEIGHT * Math.cos(phi),
      CAMERA_DISTANCE * Math.cos(theta) * Math.sin(phi)
    );

    let targetPosition = groupRef.current.position.clone().sub(idealOffset);
    const collisionResult = adjustCameraForCollision(
      targetPosition,
      groupRef.current.position,
      delta
    );
    
    // Smooth camera movement based on collision state
    if (collisionResult.collision) {
      if (!isColliding.current) {
        targetCameraRotation.current = cameraRotation.current;
      }
      isColliding.current = true;
      
      if (lastValidCameraPosition.current) {
        camera.position.lerp(collisionResult.position, CAMERA_SMOOTHING * 0.7); // Slower smoothing during collision
      }
    } else {
      camera.position.lerp(collisionResult.position, CAMERA_SMOOTHING);
    }

    // Update look-at
    const lookAtPosition = groupRef.current.position.clone().add(
      new THREE.Vector3(0, CAMERA_HEIGHT * 0.3 + CHARACTER_HEIGHT_OFFSET, 0)
    );
    camera.lookAt(lookAtPosition);
  });

  // Final render
  return (
    <group ref={groupRef}>
      {characterModel && <primitive object={characterModel} />}
    </group>
  );
};

export default Character;
