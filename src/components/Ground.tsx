import React, { useLayoutEffect, useMemo, useRef } from "react";
import SimplexNoise from "simplex-noise";
import * as THREE from "three";

const Ground: React.FC = () => {
  const simplex = useMemo(() => new SimplexNoise(), []);
  const terrain = useRef<THREE.PlaneGeometry>(null!);
  
  // Memoize the geometry generation
  useLayoutEffect(() => {
    let pos = terrain.current.getAttribute("position");
    let pa = pos.array;
  
    const hVerts = terrain.current.parameters.heightSegments + 1;
    const wVerts = terrain.current.parameters.widthSegments + 1;
    
    // Precalculate noise values
    const noiseMap = new Float32Array(hVerts * wVerts);
    for (let j = 0; j < hVerts; j++) {
      for (let i = 0; i < wVerts; i++) {
        const ex = 1.3;  // Remove random variation to improve performance
        noiseMap[j * wVerts + i] = 
          (simplex.noise2D(i / 100, j / 100) +
           simplex.noise2D((i + 200) / 50, j / 50) * Math.pow(ex, 1) +
           simplex.noise2D((i + 400) / 25, j / 25) * Math.pow(ex, 2)) / 2;  // Reduced noise layers
      }
    }
    
    // Apply height values
    for (let j = 0; j < hVerts; j++) {
      for (let i = 0; i < wVerts; i++) {
        // @ts-ignore
        pa[3 * (j * wVerts + i) + 2] = noiseMap[j * wVerts + i];
      }
    }
  
    pos.needsUpdate = true;
    terrain.current.computeVertexNormals();
  }, [simplex]);

  const material = useMemo(() => {
    const mat = new THREE.MeshPhongMaterial({ 
      color: "#3E8C47",
      shadowSide: THREE.FrontSide
    });
    return mat;
  }, []);

  return (
    <mesh 
      name="terrain" 
      position={[0, 0, 0]} 
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeBufferGeometry
        attach="geometry"
        args={[700, 700, 150, 150]}  // Reduced resolution
        ref={terrain}
      />
      <primitive object={material} attach="material" />
    </mesh>
  );
};

export default Ground;