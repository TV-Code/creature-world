import { useLoader } from "@react-three/fiber";
import React, { useMemo } from "react";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";

const Nature: React.FC = () => {
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

  [birch3, birch4, berry1, grass2, grass, rock1, rock5, willow2, willow5, log, ctree3, ctree5].forEach(model => {
    model.traverse((o: THREE.Object3D) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
  });

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

  const objects = useMemo(() => {
    const arr: JSX.Element[] = [];
    for (let i = 0; i < 100; i++) {
      const idx = Math.floor(Math.random() * 5) + 1;
      const pos = new THREE.Vector3(
        Math.ceil(Math.random() * 300) * (Math.round(Math.random()) ? 1 : -1),
        0,
        Math.ceil(Math.random() * 300) * (Math.round(Math.random()) ? 1 : -1)
      );

      const modelClone =
        idx === 1 ? birch3.clone()
          : idx === 2 ? birch4.clone()
          : idx === 3 ? berry1.clone()
          : idx === 4 ? ctree3.clone()
          : idx === 5 ? ctree5.clone()
          : idx === 6 ? grass2.clone()
          : idx === 7 ? grass.clone()
          : idx === 8 ? rock1.clone()
          : idx === 9 ? rock5.clone()
          : idx === 10 ? willow2.clone()
          : idx === 11 ? willow5.clone()
          : log.clone();

      arr.push(
        <primitive
          key={i}
          position={pos}
          object={modelClone}
        />
      );
    }
    return arr;
  }, [birch3, birch4, berry1, ctree3, ctree5, grass2, grass, rock1, rock5, willow2, willow5, log]);

  return <group>{objects}</group>;
};

export default Nature;
