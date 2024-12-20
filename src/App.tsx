import React, { Suspense, useState, useRef } from "react";
import { Loader, softShadows } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import Ground from "./components/Ground";
import Character from "./components/Character";
import * as THREE from "three";
import Nature from "./components/Nature";
import Idol from "./components/Idol";
import HutNPC from "./components/HutNPC";
import Tomato from "./components/Tomato";
import { PostProcessing } from "./components/PostProcessing";
import Ascension from "./components/Ascension";

softShadows();

// Initialize camera outside component
const camera = new THREE.PerspectiveCamera(60, 1920 / 1080, 1.0, 1000.0);
camera.position.set(25, 10, 25);

// Initialize lights outside component
const hemiLight = new THREE.HemisphereLight(0xffffff, 0xfffffff, 0.6);
hemiLight.color.setHSL(0.6, 1, 0.6);
hemiLight.groundColor.setHSL(0.095, 1, 0.75);

const light = new THREE.DirectionalLight(0xffffff, 1.0);
light.position.set(-100, 100, 100);
light.target.position.set(0, 0, 0);
light.castShadow = true;
light.shadow.bias = -0.001;
light.shadow.mapSize.width = 2048;
light.shadow.mapSize.height = 2048;
light.shadow.camera.near = 0.5;
light.shadow.camera.far = 500.0;
light.shadow.camera.left = -500;
light.shadow.camera.right = 500;
light.shadow.camera.top = 500;
light.shadow.camera.bottom = -500;

function App() {
  const [isNearIdol, setIsNearIdol] = useState(false);
  const [isAscending, setIsAscending] = useState(false);
  const characterPositionRef = useRef(new THREE.Vector3());
  const characterRotationRef = useRef(0);
  const handBoneRef = useRef<THREE.Bone | null>(null);
  const [tomatoThrowPosition, setTomatoThrowPosition] = useState<THREE.Vector3 | undefined>();
const [tomatoThrowDirection, setTomatoThrowDirection] = useState<THREE.Vector3 | undefined>();

  
  // Tomato states
  const [isNearTomato, setIsNearTomato] = useState(false);
  const [isTomatoHeld, setIsTomatoHeld] = useState(false);
  const [throwState, setThrowState] = useState<{
    initialPosition: THREE.Vector3;
    initialVelocity: THREE.Vector3;
    time: number;
  } | null>(null);
  const [throwData, setThrowData] = useState<{
    position: THREE.Vector3;
    direction: THREE.Vector3;
  } | null>(null);

  const handleTomatoPickup = () => {
    // The character picked up the tomato
    setIsTomatoHeld(true);
    setThrowState(null);
  };

  const handleTomatoThrow = (position: THREE.Vector3, direction: THREE.Vector3) => {
    // The character throws the tomato from the given position and direction
    setIsTomatoHeld(false);
    setThrowState({
      initialPosition: position.clone(),
      initialVelocity: direction.clone(), 
      time: 0,
    });
  };

  const handlePositionUpdate = (pos: THREE.Vector3) => {
    characterPositionRef.current.copy(pos);
  };

  const handleRotationUpdate = (rotation: number) => {
    characterRotationRef.current = rotation;
  };

  const handleAscensionStateChange = (isInBeam: boolean) => {
    setIsAscending(isInBeam);
    console.log("Ascension state changed:", isInBeam);
  };

  return (
    <div className="w-full h-screen bg-blue-400">
      <Canvas 
        shadows
        camera={camera}
        gl={{
          antialias: true,
          powerPreference: "high-performance"
        }}
      >
        <hemisphereLight {...hemiLight} />
        <directionalLight {...light} />
        <ambientLight intensity={0.2} />
        <Suspense fallback={null}>
          <Ground />
          <Character 
            camera={camera} 
            isNearIdol={isNearIdol}
            isAscending={isAscending}
            onPositionUpdate={handlePositionUpdate}
            onRotationUpdate={handleRotationUpdate}
            onTomatoPickup={() => setIsTomatoHeld(true)}
            onTomatoThrow={(position: THREE.Vector3, direction: THREE.Vector3) => {
              setThrowData({ position, direction });
              setIsTomatoHeld(false);
            }}
            isHoldingTomato={isTomatoHeld}
            isNearTomato={isNearTomato}
            handBoneRef={handBoneRef}
          />
          <Nature />
          <HutNPC />
          <Tomato 
            position={new THREE.Vector3(-10, 0, -20)}
            characterPosition={characterPositionRef.current}
            characterRotation={characterRotationRef.current}
            onNearTomato={() => setIsNearTomato(true)}
            onLeaveTomato={() => setIsNearTomato(false)}
            isHeld={isTomatoHeld}
            handBone={handBoneRef.current}
            throwData={throwData}
          />
          <Ascension 
            position={new THREE.Vector3(50, 0, 0)} 
            characterPosition={characterPositionRef.current}
            onAscensionStateChange={handleAscensionStateChange}
          />
          <Idol
            position={new THREE.Vector3(10, 0, 10)}
            characterPosition={characterPositionRef.current}
            onNearbyChange={setIsNearIdol}
          />
        </Suspense>
        <PostProcessing />
        <fog attach="fog" color="#ADD8E6" near={100} far={400} />
      </Canvas>
      <Loader
        dataInterpolation={(p) => `Loading ${p.toFixed(2)}%`}
        initialState={(active) => active}
      />

      {isNearIdol && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 text-white bg-black bg-opacity-50 px-4 py-2 rounded">
          Press E to interact
        </div>
      )}

      {isNearTomato && !isTomatoHeld && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 text-white bg-black bg-opacity-50 px-4 py-2 rounded">
          Press E to pick up tomato
        </div>
      )}

      {isTomatoHeld && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 text-white bg-black bg-opacity-50 px-4 py-2 rounded">
          Press F to throw tomato
        </div>
      )}
    </div>
  );
}

export default App;