import { useEffect, useCallback, useState } from 'react';
import { useLoader } from '@react-three/fiber';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
import { CHARACTER_HEIGHT_OFFSET, CAMERA_DISTANCE, CAMERA_HEIGHT } from '../constants';
import { CharacterRefs } from '../types';

interface CharacterSetupProps {
  isLocalPlayer: boolean;
  camera: THREE.PerspectiveCamera;
  handBoneRef?: React.MutableRefObject<THREE.Bone | null>;
  refs: CharacterRefs;
}

export function useCharacterSetup({
  isLocalPlayer,
  camera,
  handBoneRef,
  refs,
}: CharacterSetupProps) {
    const [animations, setAnimations] = useState<{ [key: string]: THREE.AnimationAction }>({});
  // Load models
  const characterModel = useLoader(FBXLoader, "./character/BreathingIdle.fbx");
  const walkAnim = useLoader(FBXLoader, "./character/Walking.fbx");
  const runAnim = useLoader(FBXLoader, "./character/Running.fbx");
  const jumpAnim = useLoader(FBXLoader, "./character/Jump.fbx");
  const prayerAnim = useLoader(FBXLoader, "./character/Praying.fbx");
  const liftAnim = useLoader(FBXLoader, "./character/Lifting.fbx");
  const throwAnim = useLoader(FBXLoader, "./character/Throwing.fbx");
  const floatAnim = useLoader(FBXLoader, "./character/Floating.fbx");

  const crossFadeTo = useCallback(
    (newAction: THREE.AnimationAction, duration = 0.3) => {
      const oldAction = refs.currentActionRef.current;
  
      // If no new action or same as current, do nothing
      if (!newAction || newAction === oldAction) return;
  
      // If we want to start newAction from frame 0:
      newAction.reset();
      newAction.setEffectiveTimeScale(1.0);
      newAction.setEffectiveWeight(1.0);
      newAction.enabled = true;
      newAction.play();
  
      // If we have an old action, do a crossfade
      if (oldAction) {
        oldAction.enabled = true;
        oldAction.setEffectiveTimeScale(1.0);
        oldAction.setEffectiveWeight(1.0);
        oldAction.play();
  
        // If you don't want warping, use "false" for the 3rd param
        newAction.crossFadeFrom(oldAction, duration, false);
      } else {
        // If there's no old action, fade in from weight=0
        newAction.fadeIn(duration);
      }
  
      // If you want idle *always* in background at 0.1:
      const idleAction = animations.idle;
    //   if (idleAction && newAction !== idleAction) {
    //     idleAction.enabled = true;
    //     idleAction.setEffectiveWeight(1.0);
    //     idleAction.play();
    //   }
  
      refs.currentActionRef.current = newAction;
    },
    [animations, refs]
  );
  

  // Setup model and animations
  useEffect(() => {
    if (!characterModel || !walkAnim || !runAnim || !jumpAnim || 
        !prayerAnim || !liftAnim || !throwAnim || !floatAnim) return;

    console.log("Starting animation setup:", { isLocalPlayer });

    // Clone model
    const model = SkeletonUtils.clone(characterModel) as THREE.Group;
    model.scale.setScalar(0.05);
    model.position.y = CHARACTER_HEIGHT_OFFSET;

    // Setup mixer
    const mixer = new THREE.AnimationMixer(model);
    refs.mixerRef.current = mixer;

  const animDict: { [key: string]: THREE.AnimationAction } = {};

    // Find hand bone
    model.traverse((child) => {
      if (child instanceof THREE.Bone && 
          child.name.toLowerCase().includes("hand") && 
          child.name.toLowerCase().includes("right")) {
        refs.rightHandBone.current = child;
        if (handBoneRef) {
          handBoneRef.current = child;
        }
      }
    });

    // Animation setup helper
    const setupAnimation = (
        source: THREE.Object3D,
        key: string,
        removePosition: boolean,
        loopType: THREE.AnimationActionLoopStyles = THREE.LoopRepeat,
        clamp: boolean = false
      ) => {
        if (source.animations.length) {
          const clip = source.animations[0].clone();  // Important: Clone the clip
          clip.name = key;
          
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
          
          // If this is a one-shot animation (lift, throw, prayer)
          if (['lift', 'throw', 'prayer'].includes(key)) {
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
          }
          
          animDict[key] = action;
        }
      };

      

    // Setup all animations
    setupAnimation(characterModel, "idle", false, THREE.LoopRepeat, false);
    setupAnimation(walkAnim, "walk", true, THREE.LoopRepeat, false);
    setupAnimation(runAnim, "run", true, THREE.LoopRepeat, false);
    setupAnimation(jumpAnim, "jump", true, THREE.LoopOnce, true);
    setupAnimation(prayerAnim, "prayer", false, THREE.LoopOnce, true);
    setupAnimation(floatAnim, "float", false, THREE.LoopRepeat, false);
    setupAnimation(liftAnim, "lift", false, THREE.LoopOnce, true);
    setupAnimation(throwAnim, "throw", false, THREE.LoopOnce, true);

    setAnimations(animDict);

    if (animDict.idle) {
        animDict.idle.play();
        refs.currentActionRef.current = animDict.idle;
      }
      

    // Add to group
    refs.groupRef.current?.add(model);

    // Initialize camera if local player
    if (isLocalPlayer && !refs.cameraInitialized.current && camera) {
      const offset = new THREE.Vector3(
        Math.sin(refs.rotationRef.current) * -CAMERA_DISTANCE,
        CAMERA_HEIGHT,
        Math.cos(refs.rotationRef.current) * -CAMERA_DISTANCE
      );
      const initPos = model.position.clone().add(offset);
      camera.position.copy(initPos);
      const lookAt = model.position.clone().add(
        new THREE.Vector3(0, CAMERA_HEIGHT * 0.3 + CHARACTER_HEIGHT_OFFSET, 0)
      );
      camera.lookAt(lookAt);
      refs.cameraInitialized.current = true;
    }

    return () => {
      mixer.stopAllAction();
      refs.groupRef.current?.remove(model);
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

  return { animations, crossFadeTo };
}