import { useLoader } from "@react-three/fiber";
import React, { useState, useRef } from "react";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import seedrandom from "seedrandom";

const Nature: React.FC = () => {
  // 1) Load FBX models
  const [
    birch3,
    birch4,
    berry1,
    ctree3,
    ctree5,
    grass2,
    grass,
    rock1,
    rock5,
    willow2,
    willow5,
    log,
  ] = useLoader(FBXLoader, [
    "./textures/nature/BirchTree_3.fbx",
    "./textures/nature/BirchTree_4.fbx",
    "./textures/nature/BushBerries_1.fbx",
    "./textures/nature/CommonTree_3.fbx",
    "./textures/nature/CommonTree_5.fbx",
    "./textures/nature/Grass_2.fbx",
    "./textures/nature/Grass.fbx",
    "./textures/nature/Rock_1.fbx",
    "./textures/nature/Rock_5.fbx",
    "./textures/nature/Willow_2.fbx",
    "./textures/nature/Willow_5.fbx",
    "./textures/nature/WoodLog_Moss.fbx",
  ]);

  // 2) Ensure all models cast/receive shadows
  const allModels = [
    birch3, birch4, berry1, ctree3, ctree5,
    grass2, grass, rock1, rock5, willow2, willow5, log
  ];
  allModels.forEach((model) => {
    model.traverse((obj: THREE.Object3D) => {
      obj.castShadow = true;
      obj.receiveShadow = true;
    });
  });

  // 3) Scale them once
  birch3.scale.setScalar(0.4);
  birch4.scale.setScalar(0.3);
  berry1.scale.setScalar(0.08);
  grass2.scale.setScalar(0.05);
  grass.scale.setScalar(0.05);
  rock1.scale.setScalar(0.2);
  rock5.scale.setScalar(0.2);
  willow2.scale.setScalar(0.4);
  willow5.scale.setScalar(0.5);
  log.scale.setScalar(0.1);
  ctree3.scale.setScalar(0.4);
  ctree5.scale.setScalar(0.4);

  // 4) Create a stable seedrandom instance
  //    so we always get the same pseudo-random sequence
  const rngRef = useRef<() => number>();
  if (!rngRef.current) {
    rngRef.current = seedrandom("creature.world");
  }

  // 5) Generate the objects array EXACTLY ONCE
  //    useState with an initializer -> never changes after mount
  const [objects] = useState(() => {
    const generated: JSX.Element[] = [];
    // Decide how many items you want:
    for (let i = 0; i < 137; i++) {
      const random = rngRef.current!;

      // pick a model index (0 to 11)
      const idx = Math.floor(random() * allModels.length);

      // pick X/Z positions
      const x = Math.floor(random() * 300) * (random() > 0.5 ? 1 : -1);
      const z = Math.floor(random() * 300) * (random() > 0.5 ? 1 : -1);

      const modelClone = allModels[idx].clone();
      generated.push(
        <primitive
          key={i}
          position={[x, 0, z]}
          object={modelClone}
        />
      );
    }
    return generated;
  });

  return <group>{objects}</group>;
};

export default Nature;
