import { useCallback, useEffect } from 'react';
import { MovementState, CharacterRefs } from '../types';
import { JUMP_FORCE, MOUSE_SENSITIVITY } from '../constants';
import * as THREE from 'three';

interface InputHandlerProps {
  isLocalPlayer: boolean;
  isPraying: boolean;
  isNearNPC: boolean;
  isNearIdol: boolean;
  isHoldingTomato: boolean;
  isPlayingLift: boolean;
  isPlayingThrow: boolean;
  canAscend: boolean;
  isNearTomato: boolean;
  refs: CharacterRefs;
  setMovement: (value: React.SetStateAction<MovementState>) => void;
  setIsPraying: (value: boolean) => void;
  setIsPlayingLift: (value: boolean) => void;
  setIsPlayingThrow: (value: boolean) => void;
  onDialogProgress?: () => void;
  onTomatoOffer?: () => void;
  onTomatoPickup?: () => void;
  onCanAscend?: () => void;
  animations: { [key: string]: THREE.AnimationAction };
  crossFadeTo: (action: THREE.AnimationAction, duration?: number) => void;
}

export function useCharacterInput({
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
  onTomatoPickup,
  onTomatoOffer,
  onCanAscend,
  animations,
  crossFadeTo,
}: InputHandlerProps) {

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
        if (!refs.isJumping.current) {
          setMovement((prev) => ({ ...prev, jump: true }));
          refs.verticalVelocity.current = JUMP_FORCE;
          refs.isJumping.current = true;
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
    animations,
    canAscend,
    isNearTomato,
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
      refs.isRightMouseDown.current = true;
      refs.lastMouseX.current = e.clientX;
      refs.lastMouseY.current = e.clientY;
      e.preventDefault();
    }
  }, [refs]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (e.button === 2) {
      refs.isRightMouseDown.current = false;
    }
  }, [refs]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (refs.isRightMouseDown.current) {
      const deltaX = e.clientX - refs.lastMouseX.current;
      const deltaY = e.clientY - refs.lastMouseY.current;
      refs.cameraRotation.current -= deltaX * MOUSE_SENSITIVITY;
      refs.cameraPitch.current = Math.max(
        0.1,
        Math.min(1.0, refs.cameraPitch.current + deltaY * MOUSE_SENSITIVITY)
      );
      refs.lastMouseX.current = e.clientX;
      refs.lastMouseY.current = e.clientY;
    }
  }, [refs]);

  const handleContextMenu = useCallback((e: Event) => {
    e.preventDefault();
  }, []);

  const startPickupAnimation = useCallback(() => {
    const { lift, idle } = animations;
    console.log("Lift animation attempt:", {
      hasLift: !!animations.lift,
      hasMixer: !!refs.mixerRef.current,
      isPlayingLift
    });
    
    if (!lift || !refs.mixerRef.current || isPlayingLift) {
      console.log("Cannot start lift animation - conditions not met");
      return;
    }
    
    console.log("Starting lift animation...");
    setIsPlayingLift(true);
    refs.liftTimeRef.current = 0;
    window.tomatoPickedUp = false;
  
    // Set up lift animation properly
    lift.reset();
    lift.setLoop(THREE.LoopOnce, 1);
    lift.clampWhenFinished = true;
    
    crossFadeTo(lift);
  
    const onLiftComplete = (e: any) => {
      console.log("Lift animation complete", e.action.getClip().name);
      if (e.action !== lift) return;

      if (idle) {
        // Start crossfade to idle BEFORE we cleanup the lift animation
        idle.reset();
        idle.setEffectiveTimeScale(1);
        idle.setEffectiveWeight(1);
        idle.play();
        lift.crossFadeTo(idle, 0.3, true);
      }
      
      // Remove listener first
      refs.mixerRef.current?.removeEventListener("finished", onLiftComplete);

      // Set state after animation is fully reset
      setIsPlayingLift(false);
    };
    
    // Clean up any existing listeners before adding new one
    refs.mixerRef.current.removeEventListener("finished", onLiftComplete);
    refs.mixerRef.current.addEventListener("finished", onLiftComplete);
  }, [animations, crossFadeTo, isPlayingLift]);
  
  // Similarly for throw animation:
  const startThrowAnimation = useCallback(() => {
    const { throw: throwAnim, idle } = animations;
    if (!throwAnim || !refs.mixerRef.current || isPlayingThrow) return;
    
    setIsPlayingThrow(true);
    refs.throwTimeRef.current = 0;
    window.tomatoThrown = false;
  
    throwAnim.setLoop(THREE.LoopOnce, 1);
    throwAnim.clampWhenFinished = true;
    crossFadeTo(throwAnim, 0.2);
  
    const onThrowComplete = (e: THREE.Event) => {
      if (e.action !== throwAnim) return;
      refs.mixerRef.current?.removeEventListener("finished", onThrowComplete);
      setIsPlayingThrow(false);
      window.tomatoThrown = true;
      if (idle) crossFadeTo(idle, 0.2);
    };
  
    refs.mixerRef.current.removeEventListener("finished", onThrowComplete);
    refs.mixerRef.current.addEventListener("finished", onThrowComplete);
  }, [animations, crossFadeTo, isPlayingThrow]);

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

  return {
    startPickupAnimation,
    startThrowAnimation
  };
}