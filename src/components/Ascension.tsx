import React, { useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface AscensionProps {
  position?: THREE.Vector3;
  characterPosition?: THREE.Vector3;
  onAscensionStart?: () => void;
}

const AscensionShader = {
  uniforms: {
    time: { value: 0 }
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vNormal;
    
    void main() {
      vUv = uv;
      vPosition = position;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vNormal;
    uniform float time;
    
    void main() {
      // Calculate angle around the cylinder
      vec3 viewDir = normalize(cameraPosition - vPosition);
      float angle = atan(vPosition.x, vPosition.z);
      
      // Convert angle to 0-1 range for color selection
      float normalizedAngle = (angle + 3.14159) / (2.0 * 3.14159);
      
      // Define the four colors
      vec3 color1 = vec3(0.8, 0.2, 0.2); // Red
      vec3 color2 = vec3(1.0, 0.6, 0.0); // Orange
      vec3 color3 = vec3(1.0, 0.8, 0.0); // Yellow
      vec3 color4 = vec3(0.6, 0.8, 0.9); // Light blue
      
      // Determine which quarter we're in
      float section = normalizedAngle * 4.0;
      vec3 finalColor;
      
      if(section < 1.0) {
          finalColor = color1;
      } else if(section < 2.0) {
          finalColor = color2;
      } else if(section < 3.0) {
          finalColor = color3;
      } else {
          finalColor = color4;
      }
      
      // Add some vertical movement
      float verticalMovement = mod(vPosition.y * 0.1 + time * 0.5, 1.0);
      
      // Add glow and movement effects
      float glow = pow(0.7 - dot(vNormal, viewDir), 3.0);
      float moveEffect = sin(verticalMovement * 6.28) * 0.1;
      finalColor += vec3(0.2) * glow + vec3(moveEffect);
      
      // Add slight transparency at edges
      float edgeFade = pow(abs(dot(vNormal, viewDir)), 0.5);
      float alpha = 0.9 * edgeFade;
      
      gl_FragColor = vec4(finalColor, alpha);
    }
  `
};

export const Ascension: React.FC<AscensionProps> = ({ 
  position = new THREE.Vector3(0, 0, 0),
  characterPosition,
  onAscensionStart 
}) => {
  const [isAscending, setIsAscending] = useState(false);
  const cylinderRadius = 5;

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: AscensionShader.uniforms,
      vertexShader: AscensionShader.vertexShader,
      fragmentShader: AscensionShader.fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
  }, []);

  useFrame((state, delta) => {
    // Update shader time
    shaderMaterial.uniforms.time.value += delta;

    // Check for character collision
    if (characterPosition && !isAscending) {
      const distance = new THREE.Vector2(
        characterPosition.x - position.x,
        characterPosition.z - position.z
      ).length();

      if (distance < cylinderRadius) {
        setIsAscending(true);
        onAscensionStart?.();
      }
    }
  });

  return (
    <mesh position={position}>
      <cylinderGeometry args={[cylinderRadius, cylinderRadius, 300, 32]} />
      <primitive object={shaderMaterial} attach="material" />
    </mesh>
  );
};

export default Ascension;