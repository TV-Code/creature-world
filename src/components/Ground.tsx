import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

// If you still want to keep the library installed, that's fine; or remove it entirely:
import SimplexNoise from "simplex-noise"; // optional if you're no longer using it

const Ground: React.FC = () => {
  // no need for a seed if it’s purely flat. 
  // But you could do: const simplex = useMemo(() => new SimplexNoise("my-seed"), []);

  const terrain = useRef<THREE.PlaneGeometry>(null!);

  // 1) Keep geometry generation but remove noise offsets
  useLayoutEffect(() => {
    // Access geometry
    let pos = terrain.current.getAttribute("position");
    let pa = pos.array as Float32Array;

    // Just set Z=0 for all vertices
    for (let i = 2; i < pa.length; i += 3) {
      pa[i] = 0; // the z-component (since it's x,y,z in array)
    }

    pos.needsUpdate = true;
    terrain.current.computeVertexNormals();
  }, []);

  // 2) Material
  const material = useMemo(() => {
    const mat = new THREE.MeshPhongMaterial({
      color: "#3E8C47",
      shadowSide: THREE.FrontSide,
    });
    return mat;
  }, []);

  // 3) Return the plane
  return (
    <mesh
      name="terrain"
      position={[0, 0, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeBufferGeometry
        attach="geometry"
        // size could be anything you like, with fewer segments if you want
        args={[700, 700, 1, 1]}
        ref={terrain}
      />
      <primitive object={material} attach="material" />
    </mesh>
  );
};

export default Ground;
