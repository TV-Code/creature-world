import { useFrame } from "@react-three/fiber";
import React, { useEffect, useRef, useMemo } from "react";
import { useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";

interface IdolProps {
  position?: THREE.Vector3;
  onNearbyChange?: (isNear: boolean) => void;
  characterPosition?: THREE.Vector3;
}

const INTERACTION_DISTANCE = 20;
const DISTANCE_THRESHOLD = 1; // Only update if position changes by more than 1 unit

const Idol: React.FC<IdolProps> = ({ 
  position = new THREE.Vector3(10, 0, 10),
  characterPosition,
  onNearbyChange 
}) => {
  const group = useRef<THREE.Group>(null!);
  const { scene, animations } = useGLTF("/character/enlightenedcreature.glb");
  const { actions, mixer } = useAnimations(animations, group);
  const currentAnimation = useRef<THREE.AnimationAction | null>(null);
  const lastDistance = useRef<number>(Infinity);
  const wasNear = useRef<boolean>(false);
  const idolPosition = useMemo(() => position.clone(), [position]);

  useEffect(() => {
    scene.scale.setScalar(20); 
    scene.position.y = 2;
    
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    if (actions) {
      const defaultAnimation = actions[Object.keys(actions)[0]];
      if (defaultAnimation) {
        defaultAnimation.setLoop(THREE.LoopRepeat, Infinity);
        defaultAnimation.reset().fadeIn(0.5).play();
        currentAnimation.current = defaultAnimation;
      }
    }

    return () => {
      if (mixer) {
        mixer.stopAllAction();
      }
    };
  }, [scene, actions, mixer, animations]);

  useFrame((state, delta) => {
    if (mixer) {
      mixer.update(delta);
    }

    if (onNearbyChange && characterPosition) {
      const distanceXZ = Math.hypot(
        characterPosition.x - idolPosition.x,
        characterPosition.z - idolPosition.z
      );

      // Only update if distance changed significantly
      if (Math.abs(distanceXZ - lastDistance.current) > DISTANCE_THRESHOLD) {
        const isNear = distanceXZ < INTERACTION_DISTANCE;
        lastDistance.current = distanceXZ;

        if (isNear !== wasNear.current) {
          wasNear.current = isNear;
          onNearbyChange(isNear);
        }
      }
    }
  });

  return (
    <group ref={group} position={idolPosition}>
      <primitive object={scene} />
    </group>
  );
};

export default Idol;