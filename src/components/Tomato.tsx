import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

declare global {
  interface Window {
    tomatoPickedUp: boolean;
    tomatoThrown: boolean;
  }
}

interface TomatoProps {
  position?: THREE.Vector3;
  characterPosition?: THREE.Vector3;
  characterRotation?: number;
  onNearTomato?: () => void;
  onLeaveTomato?: () => void;
  isHeld?: boolean;
  isOffered?: boolean;
  handBone?: THREE.Bone | null;
  throwData?: {
    position: THREE.Vector3;
    direction: THREE.Vector3;
  } | null;
}

const PICKUP_DISTANCE = 3;
const GRAVITY = -9.8;
const THROW_FORCE = 20;

interface ThrowState {
  initialPosition: THREE.Vector3;
  initialVelocity: THREE.Vector3;
  time: number;
}

export const Tomato: React.FC<TomatoProps> = ({
  position = new THREE.Vector3(-10, 1, -20),
  characterPosition,
  onNearTomato,
  onLeaveTomato,
  isHeld = false,
  handBone = null,
  throwData = null,
  isOffered
}) => {
  const basePath = process.env.PUBLIC_URL || "";
  const group = useRef<THREE.Group>(null!);
  const { scene: tomatoModel } = useGLTF(`${basePath}/Tomato.glb`);
  const wasNearRef = useRef(false);
  const [throwState, setThrowState] = useState<ThrowState | null>(null);
  const [restingPosition, setRestingPosition] = useState(position.clone());

  // Handle throw initiation
  useEffect(() => {
    if (throwData) {
      console.log("Received throw data:", throwData);
      setThrowState({
        initialPosition: throwData.position.clone(),
        initialVelocity: throwData.direction.clone().multiplyScalar(THROW_FORCE),
        time: 0
      });
    }
  }, [throwData]);

  // useEffect(() => {
  //   if (!isHeld && throwState === null) {
  //     // Reset to resting position if not held and not being thrown
  //     if (group.current) {
  //       group.current.position.copy(restingPosition);
  //     }
  //   }
  // }, [isHeld, throwState, restingPosition]);

  useFrame((_, delta) => {
    if (!group.current) return;

    // Handle being held by hand
    if (isHeld && handBone) {
      const handWorldPosition = new THREE.Vector3();
      const handWorldQuaternion = new THREE.Quaternion();
      handBone.getWorldPosition(handWorldPosition);
      handBone.getWorldQuaternion(handWorldQuaternion);

      // Apply offset relative to hand
      const offset = new THREE.Vector3(0, 0.1, 0.8).applyQuaternion(handWorldQuaternion);
      const targetPosition = handWorldPosition.clone().add(offset);

      // Smooth transition to hand position
      group.current.position.lerp(targetPosition, delta * 100);

      // Match hand rotation
      const targetRotation = new THREE.Euler().setFromQuaternion(handWorldQuaternion);
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, targetRotation.x + 1, delta * 10);
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, targetRotation.y - 2.5, delta * 10);
      group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, targetRotation.z + 1, delta * 10);
    }
    // Handle being thrown
    else if (throwState) {
      throwState.time += delta;
      const t = throwState.time;

      const newPosition = new THREE.Vector3(
        throwState.initialPosition.x + throwState.initialVelocity.x * t,
        throwState.initialPosition.y + throwState.initialVelocity.y * t + 0.5 * GRAVITY * t * t,
        throwState.initialPosition.z + throwState.initialVelocity.z * t
      );

      // Check ground collision
      if (newPosition.y <= 0) {
        newPosition.y = 0;
        setRestingPosition(newPosition.clone());
        setThrowState(null);
      } else {
        group.current.position.copy(newPosition);
        // Add spin while in air
        group.current.rotation.x += delta * 5;
        group.current.rotation.z += delta * 5;
      }
    }
    // Handle resting state
    else if (isOffered) {
      console.log('offered')
      group.current.position.copy(new THREE.Vector3(0, 0.6, -32));
      group.current.rotation.set(0, 0, 0);
      
    } else if (!isHeld) {
      // group.current.position.copy(restingPosition);
      // group.current.rotation.set(0, 0, 0);
      
      // Check proximity to character
      if (characterPosition) {
        const distance = restingPosition.distanceTo(characterPosition);
        const isNearNow = distance < PICKUP_DISTANCE;

        if (isNearNow && !wasNearRef.current) {
          onNearTomato?.();
        } else if (!isNearNow && wasNearRef.current) {
          onLeaveTomato?.();
        }
        wasNearRef.current = isNearNow;
      }
    }
  });

  // Clone and prepare the tomato model
  const model = tomatoModel.clone();
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return (
    <group ref={group} position={restingPosition}>
      <primitive object={model} scale={1} />
    </group>
  );
};

export default Tomato;