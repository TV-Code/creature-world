import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface TomatoProps {
  position?: THREE.Vector3;
  characterPosition?: THREE.Vector3;
  characterRotation?: number;
  onNearTomato?: () => void;
  onLeaveTomato?: () => void;
  isHeld?: boolean;
  handBone?: THREE.Bone | null;
}

const PICKUP_DISTANCE = 2;
const THROW_FORCE = 20;
const GRAVITY = -9.8;
const THROW_ANGLE = Math.PI / 4; // 45 degrees upward

interface ThrowState {
  initialPosition: THREE.Vector3;
  initialVelocity: THREE.Vector3;
  time: number;
}

export const Tomato: React.FC<TomatoProps> = ({ 
  position = new THREE.Vector3(-10, 1, -20),
  characterPosition,
  characterRotation = 0,
  onNearTomato,
  onLeaveTomato,
  isHeld = false,
  handBone = null
}) => {
  const group = useRef<THREE.Group>(null!);
  const { scene: tomatoModel } = useGLTF('/Tomato.glb');
  const wasNearRef = useRef(false);
  const [throwState, setThrowState] = useState<ThrowState | null>(null);
  const [isInAir, setIsInAir] = useState(false);
  const targetPosition = useRef(new THREE.Vector3());
  const targetRotation = useRef(new THREE.Euler());

  useFrame((_, delta) => {
    if (!group.current || !characterPosition) return;

    if (isHeld && handBone) {
      // Get world position and rotation of the hand bone
      const handWorldPosition = new THREE.Vector3();
      const handWorldQuaternion = new THREE.Quaternion();
      handBone.getWorldPosition(handWorldPosition);
      handBone.getWorldQuaternion(handWorldQuaternion);

      // Apply offset relative to hand bone
      const offset = new THREE.Vector3(0, 0.1, 0); // Adjust these values to position the tomato correctly
      offset.applyQuaternion(handWorldQuaternion);
      
      // Update target position and rotation
      targetPosition.current.copy(handWorldPosition).add(offset);
      targetRotation.current.setFromQuaternion(handWorldQuaternion);

      // Smoothly interpolate current position and rotation to target
      group.current.position.lerp(targetPosition.current, delta * 10);
      group.current.rotation.x += (targetRotation.current.x - group.current.rotation.x) * delta * 10;
      group.current.rotation.y += (targetRotation.current.y - group.current.rotation.y) * delta * 10;
      group.current.rotation.z += (targetRotation.current.z - group.current.rotation.z) * delta * 10;

      setIsInAir(true);
    } else if (throwState) {
      // Update throw physics
      throwState.time += delta;
      
      const newPosition = new THREE.Vector3(
        throwState.initialPosition.x + throwState.initialVelocity.x * throwState.time,
        throwState.initialPosition.y + 
        throwState.initialVelocity.y * throwState.time + 
        0.5 * GRAVITY * throwState.time * throwState.time,
        throwState.initialPosition.z + throwState.initialVelocity.z * throwState.time
      );

      if (newPosition.y <= 0) {
        newPosition.y = 0;
        setThrowState(null);
        setIsInAir(false);
        group.current.position.copy(newPosition);
      } else {
        group.current.position.copy(newPosition);
        group.current.rotation.x += delta * 5;
        group.current.rotation.z += delta * 5;
      }
    } else if (!isInAir) {
      // Rest state
      group.current.position.copy(position);
      group.current.rotation.set(0, 0, 0);
      
      const distance = position.distanceTo(characterPosition);
      const isNearNow = distance < PICKUP_DISTANCE;
      
      if (isNearNow && !wasNearRef.current) {
        onNearTomato?.();
      } else if (!isNearNow && wasNearRef.current) {
        onLeaveTomato?.();
      }
      wasNearRef.current = isNearNow;
    }
  });

  // Effect to handle transition from held to thrown
  React.useEffect(() => {
    if (!isHeld && group.current && throwState === null && isInAir) {
      const throwDir = new THREE.Vector3(0, Math.sin(THROW_ANGLE), Math.cos(THROW_ANGLE));
      throwDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), characterRotation);
      
      setThrowState({
        initialPosition: group.current.position.clone(),
        initialVelocity: throwDir.multiplyScalar(THROW_FORCE),
        time: 0
      });
    }
  }, [isHeld, characterRotation]);

  // Clone and prepare the tomato model
  const model = tomatoModel.clone();
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return (
    <group ref={group} position={position}>
      <primitive object={model} scale={0.5} />
    </group>
  );
};

export default Tomato;