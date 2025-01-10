import * as THREE from 'three';
import { CharacterRefs } from './types';
import { AnimationName } from '../../types/multiplayer';
import { 
  CHARACTER_HEIGHT_OFFSET, 
  COLLISION_CHECK_INTERVAL, 
  MIN_CAMERA_DISTANCE,
  CAMERA_COLLISION_PADDING
} from './constants';

export const getTerrainHeight = (
  refs: CharacterRefs,
  pos: THREE.Vector3
): number => {
  if (!refs.terrainMesh.current) return CHARACTER_HEIGHT_OFFSET;
  
  refs.terrainRaycaster.set(
    new THREE.Vector3(pos.x, 100, pos.z), 
    new THREE.Vector3(0, -1, 0)
  );
  
  const hits = refs.terrainRaycaster.intersectObject(refs.terrainMesh.current);
  return hits.length > 0 
    ? hits[0].point.y + CHARACTER_HEIGHT_OFFSET 
    : CHARACTER_HEIGHT_OFFSET;
};

export const adjustCameraForCollision = (
  refs: CharacterRefs,
  targetPos: THREE.Vector3,
  charPos: THREE.Vector3,
  delta: number
) => {
  if (!refs.terrainMesh.current) return { position: targetPos, collision: false };

  refs.timeSinceLastCheck.current += delta;
  if (refs.timeSinceLastCheck.current < COLLISION_CHECK_INTERVAL) {
    return {
      position: refs.isColliding.current ? refs.lastValidCameraPosition.current : targetPos,
      collision: refs.isColliding.current,
    };
  }
  refs.timeSinceLastCheck.current = 0;

  // Basic geometry collision
  const dirToCam = targetPos.clone().sub(charPos).normalize();
  const dist = charPos.distanceTo(targetPos);
  refs.cameraRaycaster.set(charPos, dirToCam);
  const intersects = refs.cameraRaycaster.intersectObject(refs.terrainMesh.current);
  
  if (intersects.length > 0) {
    const hitDistance = intersects[0].distance;
    if (hitDistance < dist) {
      const newDist = Math.max(MIN_CAMERA_DISTANCE + 1, hitDistance - CAMERA_COLLISION_PADDING);
      const newPos = charPos.clone().add(dirToCam.multiplyScalar(newDist));
      refs.lastValidCameraPosition.current.copy(newPos);
      return { position: newPos, collision: true };
    }
  }

  // Terrain height collision
  const terrainY = getTerrainHeight(refs, targetPos);
  if (targetPos.y < terrainY + CAMERA_COLLISION_PADDING) {
    const adjPos = targetPos.clone();
    adjPos.y = terrainY + CAMERA_COLLISION_PADDING;
    refs.lastValidCameraPosition.current.copy(adjPos);
    return { position: adjPos, collision: true };
  }

  refs.lastValidCameraPosition.current.copy(targetPos);
  refs.isColliding.current = false;
  return { position: targetPos, collision: false };
};

export const getAnimationName = (clipName: string | undefined): AnimationName => {
    console.log('raw:', clipName)
    if (!clipName) return 'idle';
    
    const lowerClip = clipName.toLowerCase();
    console.log('Converting animation name:', clipName); // Debug log
    
    if (lowerClip.includes('lift')) return 'lift';
    if (lowerClip.includes('throw')) return 'throw';
    if (lowerClip.includes('pray')) return 'prayer';
    if (lowerClip.includes('float')) return 'float';
    if (lowerClip.includes('walk')) return 'walk';
    if (lowerClip.includes('run')) return 'run';
    if (lowerClip.includes('jump')) return 'jump';
    
    return 'idle';
  };