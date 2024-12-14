import React, { useEffect, useRef } from 'react';
import { useLoader } from '@react-three/fiber';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import * as THREE from 'three';

// Define the positions of the three huts
const hutPositions = [
    new THREE.Vector3(200, 0, 20),
    new THREE.Vector3(-30, 0, 150)
];

const Hut: React.FC<{ position: THREE.Vector3 }> = ({ position }) => {
    const hutRef = useRef<THREE.Group>();
    const model = useLoader(FBXLoader, '/textures/nature/Creature Hut.fbx');

    useEffect(() => {
        if (hutRef.current) {
            // Get terrain height at hut position
            const raycaster = new THREE.Raycaster();
            raycaster.ray.direction.set(0, -1, 0);
            raycaster.ray.origin.set(position.x, 100, position.z);

            const terrain = hutRef.current.parent?.parent?.getObjectByName('terrain');
            if (terrain) {
                const intersects = raycaster.intersectObject(terrain);
                if (intersects.length > 0) {
                    position.y = intersects[0].point.y;
                    hutRef.current.position.copy(position);
                }
            }

            // Apply random rotation for variety
            hutRef.current.rotation.y = Math.random() * Math.PI * 2;
        }
    }, [position]);

    const hutModel = model.clone();
    // Apply settings to each hut
    hutModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    // Scale and initial position
    hutModel.scale.setScalar(0.015); // Much smaller scale
    hutModel.position.copy(position);

    return (
        <primitive 
            ref={hutRef} 
            object={hutModel} 
        />
    );
};

export const Huts: React.FC = () => {
    return (
        <group>
            {hutPositions.map((pos, index) => (
                <Hut key={index} position={pos} />
            ))}
        </group>
    );
};

export default Huts;