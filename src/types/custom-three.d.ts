declare module 'three/examples/jsm/utils/SkeletonUtils.js' {
    import { Object3D } from 'three';
  
    export function clone(object: Object3D): Object3D;
    export function retarget(
      target: Object3D,
      source: Object3D,
      options?: any
    ): void;
  }