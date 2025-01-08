import { useLoader } from "@react-three/fiber";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { useMemo } from 'react';

export function useCharacterModel() {
  // Load all models/animations
  const characterModel = useLoader(FBXLoader, "./character/BreathingIdle.fbx");
  const walkAnim = useLoader(FBXLoader, "./character/Walking.fbx");
  const runAnim = useLoader(FBXLoader, "./character/Running.fbx");
  const jumpAnim = useLoader(FBXLoader, "./character/Jump.fbx");
  const prayerAnim = useLoader(FBXLoader, "./character/Praying.fbx");
  const liftAnim = useLoader(FBXLoader, "./character/Lifting.fbx");
  const throwAnim = useLoader(FBXLoader, "./character/Throwing.fbx");
  const floatAnim = useLoader(FBXLoader, "./character/Floating.fbx");

  // Return original loaded models
  return {
    characterModel,
    walkAnim,
    runAnim,
    jumpAnim,
    prayerAnim,
    liftAnim,
    throwAnim,
    floatAnim
  };
}