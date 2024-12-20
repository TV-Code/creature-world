import React, { useEffect, useRef } from "react";
import { useLoader, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";

const HutNPC: React.FC = () => {
    const npcRef = useRef<THREE.Group>(null!);
    const mixerRef = useRef<THREE.AnimationMixer | null>(null);
    const hutModel = useLoader(FBXLoader, '/textures/nature/Creature Hut.fbx');
    const { scene: npcModel, animations } = useGLTF('/character/CreatureNPC.glb');

    useEffect(() => {
        // Basic setup for hut
        hutModel.scale.setScalar(0.012);
        hutModel.rotation.y = Math.PI / 4; // 45 degrees rotation

        // Basic setup for NPC
        npcModel.scale.setScalar(5);
        
        // Position NPC inside hut
        npcModel.rotation.y = Math.PI * 1.4; // Makes NPC face outward from hut

        // Setup animation
        if (animations && animations.length > 0) {
            console.log("Setting up animation:", animations[0]);
            const mixer = new THREE.AnimationMixer(npcModel);
            mixerRef.current = mixer;
            const action = mixer.clipAction(animations[0]);
            action.play();
        }
    }, [hutModel, npcModel, animations]);

    // Update animation
    useFrame((_, delta) => {
        if (mixerRef.current) {
            mixerRef.current.update(delta);
        }
    });

    return (
        <group position={[-30, 0, 150]}>
            {/* Hut */}
            <primitive object={hutModel} />
            {/* NPC */}
            <group ref={npcRef}>
                <primitive object={npcModel} />
            </group>
        </group>
    );
};

export default HutNPC;