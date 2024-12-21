import React, { useEffect, useRef } from "react";
import { useLoader, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";

interface HutNPCProps {
    onNearNPC?: (isNear: boolean) => void;
    characterPosition?: THREE.Vector3;
    hasSpokenToNPC?: boolean;
}

const NPC_INTERACTION_DISTANCE = 20;

const HutNPC: React.FC<HutNPCProps> = ({ 
    onNearNPC, 
    characterPosition,
    hasSpokenToNPC = false 
}) => {
    const npcRef = useRef<THREE.Group>(null!);
    const mixerRef = useRef<THREE.AnimationMixer | null>(null);
    const lastDistance = useRef<number>(Infinity);
    const wasNear = useRef<boolean>(false);

    const hutModel = useLoader(FBXLoader, '/textures/nature/Creature Hut.fbx');
    const { scene: npcModel, animations } = useGLTF('/character/CreatureNPC.glb');

    useEffect(() => {
        // Setup hut
        hutModel.scale.setScalar(0.012);
        hutModel.rotation.y = Math.PI / -5;

        // Setup NPC
        npcModel.scale.setScalar(5);
        npcModel.rotation.y = Math.PI * 1; // Face outward from hut

        // Setup animation
        if (animations && animations.length > 0) {
            const mixer = new THREE.AnimationMixer(npcModel);
            mixerRef.current = mixer;
            const action = mixer.clipAction(animations[0]);
            action.play();
        }
    }, [hutModel, npcModel, animations]);

    useFrame((_, delta) => {
        // Update animation
        if (mixerRef.current) {
            mixerRef.current.update(delta);
        }

        // Check player distance for interaction
        if (onNearNPC && characterPosition && !hasSpokenToNPC) {
            const npcPosition = new THREE.Vector3(-30, 0, 50);
            const distance = characterPosition.distanceTo(npcPosition);

            if (Math.abs(distance - lastDistance.current) > 1) {
                const isNear = distance < NPC_INTERACTION_DISTANCE;
                lastDistance.current = distance;

                if (isNear !== wasNear.current) {
                    wasNear.current = isNear;
                    onNearNPC(isNear);
                }
            }
        }
    });

    return (
        <group position={[-30, 1, 50]}>
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