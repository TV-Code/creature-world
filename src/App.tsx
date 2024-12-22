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
  // Original states
  const [isNearIdol, setIsNearIdol] = useState(false);
  const [isAscending, setIsAscending] = useState(false);
  const [isNearNPC, setIsNearNPC] = useState(false);
  const characterPositionRef = useRef(new THREE.Vector3());
  const characterRotationRef = useRef(0);
  const handBoneRef = useRef<THREE.Bone | null>(null);
  const [isTomatoHeld, setIsTomatoHeld] = useState(false);
  const [isNearTomato, setIsNearTomato] = useState(false);
  const [throwData, setThrowData] = useState<{
    position: THREE.Vector3;
    direction: THREE.Vector3;
  } | null>(null);

  // New quest-related states
  const [hasSpokenToNPC, setHasSpokenToNPC] = useState(false);
  const [canAscend, setCanAscend] = useState(false);
  const [dialogState, setDialogState] = useState(0);  // 0: no dialog, 1-3: NPC dialog states

  const handleDialogProgress = () => {
    if (!hasSpokenToNPC) {
      setDialogState(prev => {
        if (prev >= 3) {
          setHasSpokenToNPC(true);
          setIsNearNPC(false);
          return 0;
        }
        return prev + 1;
      });
    }
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
            isNearNPC={isNearNPC}
            onDialogProgress={handleDialogProgress}
            canAscend={canAscend}
            onCanAscend={() => setCanAscend(true)}
            onTomatoOffer={() => setIsTomatoHeld(false)}
          />
          <Nature />
          <HutNPC 
            onNearNPC={setIsNearNPC}
            characterPosition={characterPositionRef.current}
            hasSpokenToNPC={hasSpokenToNPC}
          />
          <Tomato 
            position={new THREE.Vector3(-100, 0, 40)}
            characterPosition={characterPositionRef.current}
            characterRotation={characterRotationRef.current}
            onNearTomato={() => setIsNearTomato(true)}
            onLeaveTomato={() => setIsNearTomato(false)}
            isHeld={isTomatoHeld}
            isOffered={canAscend}
            handBone={handBoneRef.current}
            throwData={throwData}
          />
          <Ascension 
            position={new THREE.Vector3(0, 0, -100)} 
            characterPosition={characterPositionRef.current}
            onAscensionStateChange={handleAscensionStateChange}
            canAscend={canAscend}
          />
          <Idol
            position={new THREE.Vector3(0, 0, -40)}
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

      {/* Quest UI */}
      {isNearNPC && !hasSpokenToNPC && dialogState === 0 && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 text-white bg-black bg-opacity-50 px-4 py-2 rounded">
          Press E to talk to the villager
        </div>
      )}

      {dialogState > 0 && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 text-white bg-black bg-opacity-80 px-6 py-4 rounded max-w-lg">
          {dialogState === 1 && (
            <>
              <p className="text-yellow-300 mb-2">Villager:</p>
              <p>Ah, a seeker of enlightenment! The ancient idol awaits an offering.</p>
            </>
          )}
          {dialogState === 2 && (
            <>
              <p className="text-yellow-300 mb-2">Villager:</p>
              <p>Bring the sacred tomato to the idol. Only then may you receive its blessing.</p>
            </>
          )}
          {dialogState === 3 && (
            <>
              <p className="text-yellow-300 mb-2">Villager:</p>
              <p>Go now. The tomato can be found to the east.</p>
            </>
          )}
          <p className="mt-4 text-gray-300 text-sm">Press E to continue</p>
        </div>
      )}

      {isNearTomato && !isTomatoHeld && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 text-white bg-black bg-opacity-50 px-4 py-2 rounded">
          Press E to pick up tomato
        </div>
      )}

      {isNearIdol && isTomatoHeld && !canAscend && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 text-white bg-black bg-opacity-50 px-4 py-2 rounded">
          Press E to offer the tomato to the idol
        </div>
      )}

      {isNearIdol && canAscend && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 text-white bg-black bg-opacity-50 px-4 py-2 rounded">
          Press E to pray and begin ascension
        </div>
      )}

      {/* {isTomatoHeld && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 text-white bg-black bg-opacity-50 px-4 py-2 rounded">
          Press F to throw tomato
        </div>
      )} */}
    </div>
  );
}

export default App;