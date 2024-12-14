import { extend, useThree, useFrame } from '@react-three/fiber';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

extend({ EffectComposer, RenderPass, ShaderPass });

// Custom shader for pixelation and color quantization
const PixelShader = {
  uniforms: {
    'tDiffuse': { value: null },
    'pixelSize': { value: 2.0 },
    'resolution': { value: new THREE.Vector2() },
    'colorLevels': { value: 10.0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float pixelSize;
    uniform vec2 resolution;
    uniform float colorLevels;
    varying vec2 vUv;

    void main() {
      vec2 dxy = pixelSize / resolution;
      vec2 coord = dxy * floor(vUv / dxy);
      vec4 color = texture2D(tDiffuse, coord);
      
      // Color quantization
      color = floor(color * colorLevels) / colorLevels;
      
      // Add slight dithering
      float dither = (mod(gl_FragCoord.x + gl_FragCoord.y, 2.0) * 0.1 - 0.05) / colorLevels;
      color.rgb += vec3(dither);
      
      gl_FragColor = color;
    }
  `
};

const Effects = () => {
  const { gl, scene, camera, size } = useThree();

  const composer = useMemo(() => {
    const composer = new EffectComposer(gl);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const pixelPass = new ShaderPass(PixelShader);
    pixelPass.uniforms.resolution.value.set(size.width, size.height);
    composer.addPass(pixelPass);

    return composer;
  }, [gl, scene, camera, size]);

  useEffect(() => {
    composer.setSize(size.width, size.height);
  }, [composer, size]);

  useFrame(() => {
    composer.render();
  }, 1);

  return null;
};

export default Effects;