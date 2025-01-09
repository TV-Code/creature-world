import { useFrame, useLoader, useThree } from "@react-three/fiber";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import { useMultiplayerStore } from './MultiplayerManager';
import { AnimationName, PlayerUpdate, PlayerState } from '../types/multiplayer';
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from "three";
import { Group } from "three";

//////////////////////////////////////////////
//               CONSTANTS
//////////////////////////////////////////////
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

//////////////////////////////////////////////
//            GLOBAL FLAGS
//////////////////////////////////////////////
declare global {
  interface Window {
    tomatoPickedUp: boolean;
    tomatoThrown: boolean;
  }
}
window.tomatoPickedUp = false;
window.tomatoThrown = false;

//////////////////////////////////////////////
//            TYPES & INTERFACES
//////////////////////////////////////////////
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
  isLocalPlayer: boolean;
  remoteState?: PlayerState;
}

// Utility to map FBX clip name => your custom enum
const getAnimationName = (clipName: string | undefined): AnimationName => {
  // First log the incoming name for debugging
  console.log('Converting animation name:', clipName);
  
  if (!clipName) return 'idle';
  
  const lowerClip = clipName.toLowerCase();
  
  // Handle exact matches first
  if (lowerClip.includes('walk')) return 'walk';
  if (lowerClip.includes('run')) return 'run';
  if (lowerClip.includes('jump')) return 'jump';
  if (lowerClip.includes('pray')) return 'prayer';
  if (lowerClip.includes('float')) return 'float';
  if (lowerClip.includes('lift')) return 'lift';
  if (lowerClip.includes('throw')) return 'throw';
  
  // Add this debug log to see what cases we're missing
  console.log('No animation match found for:', clipName);
  return 'idle';
};

//////////////////////////////////////////////
//           CHARACTER COMPONENT
//////////////////////////////////////////////
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
  isLocalPlayer = false,
  remoteState
}) => {
  ////////////////////////////////////////////////////
  //                 REFS & STATES
  ////////////////////////////////////////////////////
  const { scene } = useThree();
  const groupRef = useRef<Group>(null!);

  // For local animations
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);

  // For bones & states
  const rightHandBone = useRef<THREE.Bone | null>(null);
  const [animations, setAnimations] = useState<{ [key: string]: THREE.AnimationAction }>({});

  // Movement states
  const [movement, setMovement] = useState({
    forward: false,
    backward: false,
    left: false,
    right: false,
    run: false,
    jump: false,
  });

  // Various flags
  const [isPraying, setIsPraying] = useState(false);
  const [isPlayingLift, setIsPlayingLift] = useState(false);
  const [isPlayingThrow, setIsPlayingThrow] = useState(false);
  const [characterPosition, setCharacterPosition] = useState(new THREE.Vector3());

  // Refs for jump & physics
  const isJumping = useRef(false);
  const verticalVelocity = useRef(0);

  // Timers
  const liftTimeRef = useRef(0);
  const throwTimeRef = useRef(0);
  const isPlayingPrayer = useRef(false);

  // Camera and collision
  const terrainMesh = useRef<THREE.Mesh | null>(null);
  const terrainRaycaster = useMemo(() => new THREE.Raycaster(), []);
  const cameraRaycaster = useMemo(() => new THREE.Raycaster(), []);
  const lastValidCameraPosition = useRef(new THREE.Vector3());
  const isColliding = useRef(false);
  const timeSinceLastCheck = useRef(0);

  // Camera control
  const cameraInitialized = useRef(false);
  const isRightMouseDown = useRef(false);
  const lastMouseX = useRef(0);
  const lastMouseY = useRef(0);
  const cameraRotation = useRef(0);
  const cameraPitch = useRef(1);
  const rotationRef = useRef(0);

  // Multiplayer
  const socket = useMultiplayerStore((state) => state.socket);

  ////////////////////////////////////////////////////
  //               LOAD FBX MODELS
  ////////////////////////////////////////////////////
  const characterModel = useLoader(FBXLoader, "./character/BreathingIdle.fbx");
  const walkAnim = useLoader(FBXLoader, "./character/Walking.fbx");
  const runAnim = useLoader(FBXLoader, "./character/Running.fbx");
  const jumpAnim = useLoader(FBXLoader, "./character/Jump.fbx");
  const prayerAnim = useLoader(FBXLoader, "./character/Praying.fbx");
  const liftAnim = useLoader(FBXLoader, "./character/Lifting.fbx");
  const throwAnim = useLoader(FBXLoader, "./character/Throwing.fbx");
  const floatAnim = useLoader(FBXLoader, "./character/Floating.fbx");

  ////////////////////////////////////////////////////
  //        CROSSFADE THAT STOPS OLD ACTIONS
  ////////////////////////////////////////////////////
  const crossFadeTo = useCallback(
    (newAction: THREE.AnimationAction, duration: number = 0.2) => {
      const oldAction = currentActionRef.current;
      if (!newAction || oldAction === newAction) return;
  
      // Configure new action
      newAction.reset();
      newAction.setEffectiveTimeScale(1);
      newAction.setEffectiveWeight(1);
      newAction.clampWhenFinished = false; // Only set true for one-shot animations
      
      // Start new action
      newAction.play();
  
      // Crossfade if we have an old action
      if (oldAction) {
        // Don't stop the old action, let it fade out naturally
        newAction.crossFadeFrom(oldAction, duration, true);
      } else {
        // If no old action, just fade in the new one
        newAction.fadeIn(duration);
      }
  
      currentActionRef.current = newAction;
    },
    []
  );

  ////////////////////////////////////////////////////
  //          HELPER: GET TERRAIN HEIGHT
  ////////////////////////////////////////////////////
  const getTerrainHeight = useCallback(
    (pos: THREE.Vector3): number => {
      if (!terrainMesh.current) return CHARACTER_HEIGHT_OFFSET;
      terrainRaycaster.set(new THREE.Vector3(pos.x, 100, pos.z), new THREE.Vector3(0, -1, 0));
      const hits = terrainRaycaster.intersectObject(terrainMesh.current);
      return hits.length > 0 ? hits[0].point.y + CHARACTER_HEIGHT_OFFSET : CHARACTER_HEIGHT_OFFSET;
    },
    []
  );

  ////////////////////////////////////////////////////
  //        CAMERA COLLISION / ADJUSTMENT
  ////////////////////////////////////////////////////
  const adjustCameraForCollision = useCallback(
    (targetPos: THREE.Vector3, charPos: THREE.Vector3, delta: number) => {
      if (!terrainMesh.current) return { position: targetPos, collision: false };

      timeSinceLastCheck.current += delta;
      if (timeSinceLastCheck.current < COLLISION_CHECK_INTERVAL) {
        return {
          position: isColliding.current ? lastValidCameraPosition.current : targetPos,
          collision: isColliding.current,
        };
      }
      timeSinceLastCheck.current = 0;

      // Basic geometry collision
      const dirToCam = targetPos.clone().sub(charPos).normalize();
      const dist = charPos.distanceTo(targetPos);
      cameraRaycaster.set(charPos, dirToCam);
      const intersects = cameraRaycaster.intersectObject(terrainMesh.current);
      if (intersects.length > 0) {
        const hitDistance = intersects[0].distance;
        if (hitDistance < dist) {
          const newDist = Math.max(MIN_CAMERA_DISTANCE + 1, hitDistance - CAMERA_COLLISION_PADDING);
          const newPos = charPos.clone().add(dirToCam.multiplyScalar(newDist));
          lastValidCameraPosition.current.copy(newPos);
          return { position: newPos, collision: true };
        }
      }

      // Terrain height collision
      const terrainY = getTerrainHeight(targetPos);
      if (targetPos.y < terrainY + CAMERA_COLLISION_PADDING) {
        const adjPos = targetPos.clone();
        adjPos.y = terrainY + CAMERA_COLLISION_PADDING;
        lastValidCameraPosition.current.copy(adjPos);
        return { position: adjPos, collision: true };
      }

      lastValidCameraPosition.current.copy(targetPos);
      isColliding.current = false;
      return { position: targetPos, collision: false };
    },
    [getTerrainHeight]
  );

  ////////////////////////////////////////////////////
  //          ANIMATION HANDLERS
  ////////////////////////////////////////////////////
  const startPickupAnimation = useCallback(() => {
    const { lift, idle } = animations;
    if (!lift || !mixerRef.current || isPlayingLift) return;
    setIsPlayingLift(true);
    liftTimeRef.current = 0;
    window.tomatoPickedUp = false;

    crossFadeTo(lift);

    const onLiftComplete = (e: THREE.Event) => {
      if (e.action !== lift) return;
      mixerRef.current?.removeEventListener("finished", onLiftComplete);
      setIsPlayingLift(false);
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

    const onThrowComplete = (e: THREE.Event) => {
      if (e.action !== throwAnim) return;
      mixerRef.current?.removeEventListener("finished", onThrowComplete);
      setIsPlayingThrow(false);
      window.tomatoPickedUp = false;
      if (idle) crossFadeTo(idle);
    };
    mixerRef.current.removeEventListener("finished", onThrowComplete);
    mixerRef.current.addEventListener("finished", onThrowComplete);
  }, [animations, crossFadeTo, isPlayingThrow]);

  ////////////////////////////////////////////////////
  //          KEYBOARD + MOUSE HANDLERS
  ////////////////////////////////////////////////////
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
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
          if (animations.jump) crossFadeTo(animations.jump, 0.1);
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
  }, [
    isPraying,
    isNearNPC,
    isNearIdol,
    isHoldingTomato,
    isPlayingLift,
    isPlayingThrow,
    animations.jump,
    canAscend,
    isNearTomato,
    onDialogProgress,
    onCanAscend,
    onTomatoOffer,
    crossFadeTo,
    startPickupAnimation,
    startThrowAnimation,
  ]);

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

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (e.button === 2) {
      isRightMouseDown.current = true;
      lastMouseX.current = e.clientX;
      lastMouseY.current = e.clientY;
      e.preventDefault();
    }
  }, []);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (e.button === 2) {
      isRightMouseDown.current = false;
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isRightMouseDown.current) {
      const deltaX = e.clientX - lastMouseX.current;
      const deltaY = e.clientY - lastMouseY.current;
      cameraRotation.current -= deltaX * MOUSE_SENSITIVITY;
      cameraPitch.current = Math.max(
        0.1,
        Math.min(1.0, cameraPitch.current + deltaY * MOUSE_SENSITIVITY)
      );
      lastMouseX.current = e.clientX;
      lastMouseY.current = e.clientY;
    }
  }, []);

  const handleContextMenu = useCallback((e: Event) => {
    e.preventDefault();
  }, []);

  ////////////////////////////////////////////////////
  //         SETUP THE MODEL & ANIMATIONS
  ////////////////////////////////////////////////////
  useEffect(() => {
    terrainMesh.current = scene.getObjectByName("terrain") as THREE.Mesh;
  }, [scene]);

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

    console.log("Starting animation setup:", { isLocalPlayer });

    // 1) Clone the model
    const model = SkeletonUtils.clone(characterModel) as THREE.Group;
    model.scale.setScalar(0.05);
    model.position.y = CHARACTER_HEIGHT_OFFSET;

    // 2) Mixer
    const mixer = new THREE.AnimationMixer(model);
    mixerRef.current = mixer;

    const animDict: { [key: string]: THREE.AnimationAction } = {};

    // 3) Find right-hand bone
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

    console.log("Animation sources:", {
      characterModel: characterModel.animations,
      walkAnim: walkAnim.animations,
      // ... etc
    });

    // 4) Setup helper
    const setupAnimation = (
      source: THREE.Object3D,
      key: string,
      removePosition: boolean,
      loopType: THREE.AnimationActionLoopStyles,
      clamp: boolean
    ) => {
      console.log(`Setting up ${key} animation for ${isLocalPlayer ? 'local' : 'remote'} player`);
      
      if (source.animations.length) {
        const clip = source.animations[0].clone();
        // Set the correct name for the animation
        clip.name = key;  // Add this line
        
        if (removePosition) {
          clip.tracks = clip.tracks.filter(
            (track) => !track.name.toLowerCase().includes("position")
          );
        }
        
        const action = mixer.clipAction(clip);
        action.setLoop(loopType, Infinity);
        action.clampWhenFinished = clamp;
        action.enabled = true;
        action.setEffectiveWeight(1.0);
        
        animDict[key] = action;
        
        // If this is the idle animation, start it immediately
        if (key === 'idle') {
          console.log('Starting idle animation');
          action.reset();
          action.play();
          currentActionRef.current = action;
        }
      }
    };

    // 5) Setup each
    // Idle, walk, run, float => Repeat
    // jump, prayer, lift, throw => LoopOnce
    setupAnimation(characterModel, "idle", false, THREE.LoopRepeat, false);
    setupAnimation(walkAnim, "walk", true, THREE.LoopRepeat, false);
    setupAnimation(runAnim, "run", true, THREE.LoopRepeat, false);
    setupAnimation(jumpAnim, "jump", true, THREE.LoopOnce, true);
    setupAnimation(prayerAnim, "prayer", false, THREE.LoopOnce, true);
    setupAnimation(floatAnim, "float", false, THREE.LoopRepeat, false);
    setupAnimation(liftAnim, "lift", false, THREE.LoopOnce, true);
    setupAnimation(throwAnim, "throw", false, THREE.LoopOnce, true);

    setAnimations(animDict);

    console.log(animDict)

    // 6) Start idle
    if (animDict.idle) {
      console.log('Initializing idle animation');
      const idleAction = animDict.idle;
      idleAction.reset();
      idleAction.setEffectiveTimeScale(1);
      idleAction.setEffectiveWeight(1);
      idleAction.play();
      currentActionRef.current = idleAction;
    
      // Add debug to verify it started
      console.log('Idle animation started:', {
        action: idleAction.getClip().name,
        isPlaying: idleAction.isRunning(),
        weight: idleAction.getEffectiveWeight()
      });
    }

    // 7) Add to group
    groupRef.current.add(model);

    // 8) If local: init camera
    if (isLocalPlayer && !cameraInitialized.current && camera) {
      const offset = new THREE.Vector3(
        Math.sin(rotationRef.current) * -CAMERA_DISTANCE,
        CAMERA_HEIGHT,
        Math.cos(rotationRef.current) * -CAMERA_DISTANCE
      );
      const initPos = model.position.clone().add(offset);
      camera.position.copy(initPos);

      const lookAt = model.position
        .clone()
        .add(new THREE.Vector3(0, CAMERA_HEIGHT * 0.3 + CHARACTER_HEIGHT_OFFSET, 0));
      camera.lookAt(lookAt);

      cameraInitialized.current = true;
    }

    return () => {
      mixer.stopAllAction();
      groupRef.current.remove(model);
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
    isLocalPlayer,
    handBoneRef,
  ]);

  ////////////////////////////////////////////////////
  //     INPUT EVENT LISTENERS IF LOCAL
  ////////////////////////////////////////////////////
  useEffect(() => {
    if (!isLocalPlayer) return;

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
    isLocalPlayer,
    handleMouseDown,
    handleMouseUp,
    handleMouseMove,
    handleContextMenu,
    handleKeyDown,
    handleKeyUp,
  ]);

  ////////////////////////////////////////////////////
  //   SMALL USEFRAME TO TRACK CHARACTER POSITION
  ////////////////////////////////////////////////////
  useFrame(() => {
    if (groupRef.current) {
      const pos = groupRef.current.position.clone();
      setCharacterPosition(pos);
      onPositionUpdate?.(pos);
    }
  });

  ////////////////////////////////////////////////////
  //             MAIN UPDATE LOOP
  ////////////////////////////////////////////////////
  useFrame((_, delta) => {
    if (!groupRef.current || !mixerRef.current) return;

    if (Math.random() < 0.01) { // Only log occasionally
      console.log('Animation state:', {
        isLocal: isLocalPlayer,
        currentAction: currentActionRef.current?.getClip().name,
        isPlaying: currentActionRef.current?.isRunning(),
        mixer: mixerRef.current.time
      });
    }

    // 1) Update the mixer
    mixerRef.current.update(delta);

    // 2) If local => do camera, movement, etc.
    if (isLocalPlayer) {
      // --- CAMERA COLLISION / ADJUST ---
      const theta = cameraRotation.current;
      const phi = Math.PI * cameraPitch.current;
      const idealOffset = new THREE.Vector3(
        CAMERA_DISTANCE * Math.sin(theta) * Math.sin(phi),
        CAMERA_HEIGHT * Math.cos(phi),
        CAMERA_DISTANCE * Math.cos(theta) * Math.sin(phi)
      );
      const desiredPos = groupRef.current.position.clone().sub(idealOffset);
      const collisionResult = adjustCameraForCollision(
        desiredPos,
        groupRef.current.position,
        delta
      );

      if (collisionResult.collision) {
        isColliding.current = true;
        camera.position.lerp(collisionResult.position, CAMERA_SMOOTHING * 0.7);
      } else {
        camera.position.lerp(collisionResult.position, CAMERA_SMOOTHING);
      }
      const lookAtPos = groupRef.current.position
        .clone()
        .add(new THREE.Vector3(0, CAMERA_HEIGHT * 0.3 + CHARACTER_HEIGHT_OFFSET, 0));
      camera.lookAt(lookAtPos);
    }

    // 3) Throw release
    if (currentActionRef.current === animations.throw && isPlayingThrow) {
      throwTimeRef.current = currentActionRef.current.time;
      if (throwTimeRef.current >= THROW_RELEASE_TIME && !window.tomatoThrown) {
        window.tomatoThrown = true;
        // Compute direction
        const throwDir = new THREE.Vector3(0, Math.sin(THROW_ANGLE), Math.cos(THROW_ANGLE))
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationRef.current)
          .normalize();
        if (handBoneRef?.current) {
          const tomatoPos = new THREE.Vector3();
          handBoneRef.current.getWorldPosition(tomatoPos);
          onTomatoThrow?.(tomatoPos, throwDir);
        }
      }
      // skip normal movement while throwing
      return;
    }

    // 4) Lift
    if (currentActionRef.current === animations.lift && isPlayingLift) {
      liftTimeRef.current = currentActionRef.current.time;
      const terrainY = getTerrainHeight(groupRef.current.position);
      groupRef.current.position.y = terrainY;
      if (liftTimeRef.current >= LIFT_PICKUP_TIME && !window.tomatoPickedUp) {
        window.tomatoPickedUp = true;
        onTomatoPickup?.();
      }
      return;
    }

    // 5) Ascension
    if (isAscending) {
      if (currentActionRef.current !== animations.float && animations.float) {
        crossFadeTo(animations.float, 0.2);
      }
      const nextPos = groupRef.current.position.clone();
      nextPos.y += ASCENSION_SPEED;
      groupRef.current.position.copy(nextPos);
      if (isLocalPlayer) {
        camera.position.y += ASCENSION_SPEED;
      }
      return;
    }

    // 6) Prayer
    if (isPraying) {
      if (!isPlayingPrayer.current && animations.prayer) {
        isPlayingPrayer.current = true;
        const prayerAction = animations.prayer;
        const idleAction = animations.idle;
        crossFadeTo(prayerAction, 0.2);

        const onPrayerComplete = () => {
          mixerRef.current?.removeEventListener("finished", onPrayerComplete);
          isPlayingPrayer.current = false;
          setIsPraying(false);
          requestAnimationFrame(() => {
            if (idleAction && mixerRef.current) {
              crossFadeTo(idleAction, 0.2);
            }
          });
        };
        mixerRef.current.removeEventListener("finished", onPrayerComplete);
        mixerRef.current.addEventListener("finished", onPrayerComplete);
      }
      const terrainY = getTerrainHeight(groupRef.current.position);
      groupRef.current.position.y = terrainY;
      return;
    }

    // 7) Local Movement & Sync
    if (isLocalPlayer) {
      if (groupRef.current && socket) {
        const pos = groupRef.current.position;
        const clipName = currentActionRef.current?.getClip().name; // e.g. "Walking", "Idle"
        const update: PlayerUpdate = {
          position: { x: pos.x, y: pos.y, z: pos.z },
          rotation: rotationRef.current,
          animation: getAnimationName(clipName),
          isHoldingTomato,
        };
        socket.emit("playerUpdate", update);
      }

      // Movement logic
      const isForwardBack = movement.forward || movement.backward;
      const speed = movement.run ? CHARACTER_SPEED * 2 : CHARACTER_SPEED;

      // rotate if A/D
      if (movement.left) rotationRef.current += ROTATION_SPEED * delta;
      if (movement.right) rotationRef.current -= ROTATION_SPEED * delta;

      // camera rotation smoothing if W/S pressed
      if (isForwardBack) {
        let angleDiff = rotationRef.current - cameraRotation.current;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        cameraRotation.current += angleDiff * ROTATION_SMOOTHING;
      }

      // compute next position
      const nextPos = groupRef.current.position.clone();
      if (isForwardBack || isJumping.current) {
        const forwardVal = movement.forward ? 1 : movement.backward ? -1 : 0;
        const moveDir = new THREE.Vector3(0, 0, forwardVal);
        moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationRef.current).normalize();

        if (isForwardBack) {
          const movementDelta = moveDir.multiplyScalar(speed * delta);
          movementDelta.multiplyScalar(isJumping.current ? AIR_CONTROL : GROUND_FRICTION);
          nextPos.add(movementDelta);
        }

        // jump/fall
        if (isJumping.current) {
          verticalVelocity.current += GRAVITY * delta;
          verticalVelocity.current = Math.max(verticalVelocity.current, MAX_FALL_SPEED);
          nextPos.y += verticalVelocity.current * delta;
        }

        // ground clamp
        const terrainY = getTerrainHeight(nextPos);
        if (nextPos.y <= terrainY) {
          nextPos.y = terrainY;
          if (isJumping.current) {
            verticalVelocity.current = 0;
            isJumping.current = false;
            // land => either run/walk or idle
            if (currentActionRef.current === animations.jump) {
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
        // not W/S => keep on ground
        const terrainY = getTerrainHeight(nextPos);
        nextPos.y = terrainY;
      }

      groupRef.current.position.copy(nextPos);
      groupRef.current.rotation.y = rotationRef.current;
      onRotationUpdate?.(rotationRef.current);

      // Animate if not jumping
      if (!isJumping.current) {
        if (isForwardBack) {
          const targetAction = movement.run ? animations.run : animations.walk;
          if (targetAction && currentActionRef.current !== targetAction) {
            crossFadeTo(targetAction, 0.1);
          }
        } else {
          // if not pressing W/S => idle
          if (animations.idle && currentActionRef.current !== animations.idle) {
            crossFadeTo(animations.idle, 0.1);
          }
        }
      }
    }

    // 8) REMOTE Player
    else if (remoteState) {
      // Debug what we're receiving
      console.log('Remote state update:', {
        animation: remoteState.animation,
        currentAction: currentActionRef.current?.getClip().name
      });
    
      // Position & rotation interpolation
      const remotePos = new THREE.Vector3(
        remoteState.position.x,
        remoteState.position.y,
        remoteState.position.z
      );
      groupRef.current.position.lerp(remotePos, 0.3);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        remoteState.rotation,
        0.3
      );
    
      // Make sure we have the animation
      const desiredAnimName = remoteState.animation;
      const newAction = animations[desiredAnimName];
      
      if (newAction && currentActionRef.current !== newAction) {
        console.log('Transitioning remote animation:', {
          from: currentActionRef.current?.getClip().name,
          to: desiredAnimName
        });
        crossFadeTo(newAction, 0.2);
      }
    }
  });

  ////////////////////////////////////////////////////
  //               RENDER OUTPUT
  ////////////////////////////////////////////////////
  return <group ref={groupRef} />;
};

export default Character;
