import { useCallback, useEffect } from 'react';
import { CharacterRefs } from '../types';
import { MOUSE_SENSITIVITY } from '../constants';
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

  const handleAction = useCallback((actionType: 'interact' | 'throw') => {
    if (isPraying) return;

    if (actionType === 'interact') {
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
    } else if (actionType === 'throw') {
      if (isHoldingTomato && !isPlayingLift && !isPlayingThrow) {
        startThrowAnimation();
      }
    }
  }, [
    isPraying,
    isNearNPC,
    isNearIdol,
    isHoldingTomato,
    isPlayingLift,
    isPlayingThrow,
    canAscend,
    isNearTomato,
  ]);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (e.button === 0) { // Changed to 0 for left click
      refs.isRightMouseDown.current = true; // We can keep the same ref name
      refs.lastMouseX.current = e.clientX;
      refs.lastMouseY.current = e.clientY;
      e.preventDefault();
    }
  }, [refs]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (e.button === 0) { // Changed to 0 for left click
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

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches[0].clientX >= window.innerWidth / 3) {
        refs.isRightMouseDown.current = true;
        refs.lastMouseX.current = e.touches[0].clientX;
        refs.lastMouseY.current = e.touches[0].clientY;
      }
    
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (refs.isRightMouseDown.current && e.touches[0].clientX >= window.innerWidth / 3) {
        const deltaX = e.touches[0].clientX - refs.lastMouseX.current;
        const deltaY = e.touches[0].clientY - refs.lastMouseY.current;
        refs.cameraRotation.current -= deltaX * MOUSE_SENSITIVITY;
        refs.cameraPitch.current = Math.max(
          0.1,
          Math.min(1.0, refs.cameraPitch.current + deltaY * MOUSE_SENSITIVITY)
        );
        refs.lastMouseX.current = e.touches[0].clientX;
        refs.lastMouseY.current = e.touches[0].clientY;
      }
  };

  const handleTouchEnd = () => {
    refs.isRightMouseDown.current = false;
  };

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
  
    lift.reset();
    lift.setLoop(THREE.LoopOnce, 1);
    lift.clampWhenFinished = true;
    
    crossFadeTo(lift);
  
    const onLiftComplete = (e: any) => {
      console.log("Lift animation complete", e.action.getClip().name);
      if (e.action !== lift) return;

      if (idle) {
        idle.reset();
        idle.setEffectiveTimeScale(1);
        idle.setEffectiveWeight(1);
        idle.play();
        lift.crossFadeTo(idle, 0.3, true);
      }
      
      refs.mixerRef.current?.removeEventListener("finished", onLiftComplete);
      setIsPlayingLift(false);
    };
    
    refs.mixerRef.current.removeEventListener("finished", onLiftComplete);
    refs.mixerRef.current.addEventListener("finished", onLiftComplete);
  }, [animations, crossFadeTo, isPlayingLift]);
  
  const startThrowAnimation = useCallback(() => {
    const { throw: throwAnim, idle } = animations;
    if (!throwAnim || !refs.mixerRef.current || isPlayingThrow) return;
    
    setIsPlayingThrow(true);
    refs.throwTimeRef.current = 0;
    window.tomatoThrown = false;
  
    throwAnim.setLoop(THREE.LoopOnce, 1);
    throwAnim.clampWhenFinished = true;
    crossFadeTo(throwAnim, 0.2);
  
    const onThrowComplete = (e: any) => {
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
    window.addEventListener("touchstart", handleTouchStart);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
        window.removeEventListener("mousedown", handleMouseDown);
        window.removeEventListener("mouseup", handleMouseUp);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("touchstart", handleTouchStart);
        window.removeEventListener("touchmove", handleTouchMove);
        window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [
    isLocalPlayer,
    handleMouseDown,
    handleMouseUp,
    handleMouseMove,
  ]);

  return {
    startPickupAnimation,
    startThrowAnimation,
    handleAction,
  };
}