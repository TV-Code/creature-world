import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useCharacterSetup } from './hooks/useCharacterSetup';
import { useCharacterInput } from './hooks/useCharacterInput';
import { useCharacterUpdate } from './hooks/useCharacterUpdate';
import { CharacterProps, MovementState, CharacterRefs } from './types';
import { useMultiplayerStore } from '../MultiplayerManager';

const Character: React.FC<CharacterProps> = ({
  camera,
  isLocalPlayer,
  isNearIdol = false,
  isNearNPC = false,
  onDialogProgress,
  canAscend = false,
  onCanAscend,
  isAscending = false,
  onPositionUpdate,
  onRotationUpdate,
  onTomatoPickup,
  onTomatoOffer,
  onTomatoThrow,
  isHoldingTomato = false,
  isNearTomato = false,
  handBoneRef,
  remoteState
}) => {
  const { scene } = useThree();

  // Initialize all refs
  const refs: CharacterRefs = {
    groupRef: useRef<THREE.Group>(null!),
    mixerRef: useRef<THREE.AnimationMixer | null>(null),
    currentActionRef: useRef<THREE.AnimationAction | null>(null),
    rightHandBone: useRef<THREE.Bone | null>(null),
    isJumping: useRef(false),
    verticalVelocity: useRef(0),
    terrainMesh: useRef<THREE.Mesh | null>(null),
    terrainRaycaster: useMemo(() => new THREE.Raycaster(), []),
    cameraRaycaster: useMemo(() => new THREE.Raycaster(), []),
    lastValidCameraPosition: useRef(new THREE.Vector3()),
    isColliding: useRef(false),
    timeSinceLastCheck: useRef(0),
    cameraInitialized: useRef(false),
    isRightMouseDown: useRef(false),
    lastMouseX: useRef(0),
    lastMouseY: useRef(0),
    cameraRotation: useRef(0),
    cameraPitch: useRef(1),
    rotationRef: useRef(0),
    liftTimeRef: useRef(0),
    throwTimeRef: useRef(0),
    isPlayingPrayer: useRef(false),
  };

  // States
  const [movement, setMovement] = useState<MovementState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    run: false,
    jump: false,
  });
  const [isPraying, setIsPraying] = useState(false);
  const [isPlayingLift, setIsPlayingLift] = useState(false);
  const [isPlayingThrow, setIsPlayingThrow] = useState(false);

  // Get terrain reference
  useEffect(() => {
    refs.terrainMesh.current = scene.getObjectByName("terrain") as THREE.Mesh;
  }, [scene]);

  // Setup character and animations
  const { animations, crossFadeTo } = useCharacterSetup({
    isLocalPlayer,
    camera,
    handBoneRef,
    refs,
  });

  // Input handling
  const { startPickupAnimation, startThrowAnimation } = useCharacterInput({
    isLocalPlayer,
    isPraying,
    isNearNPC,
    isNearIdol,
    isHoldingTomato,
    isPlayingLift,
    isPlayingThrow,
    canAscend,
    isNearTomato,
    refs,
    setMovement,
    setIsPraying,
    setIsPlayingLift,
    setIsPlayingThrow,
    onDialogProgress,
    onTomatoOffer,
    onTomatoPickup,
    onCanAscend,
    animations,
    crossFadeTo,
  });

  // Update handlers
  const { handleLocalPlayerUpdate, handleRemotePlayerUpdate } = useCharacterUpdate({
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
    remoteState,
  });

  // Position tracking
  useFrame(() => {
    if (refs.groupRef.current) {
      const pos = refs.groupRef.current.position.clone();
      onPositionUpdate?.(pos);
    }
  });

  // Main update loop
  useFrame((_, delta) => {
    if (!refs.groupRef.current || !refs.mixerRef.current) return;

    // Update animation mixer
    refs.mixerRef.current.update(delta);

    // Handle updates based on player type
    if (isLocalPlayer) {
      handleLocalPlayerUpdate(delta);
    } else if (remoteState) {
      handleRemotePlayerUpdate();
    }
  });

  return <group ref={refs.groupRef} />;
};

export default Character;