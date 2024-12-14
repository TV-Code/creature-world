import React, { useEffect, useRef } from 'react'
import { extend, useThree, useFrame } from '@react-three/fiber'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass'
import * as THREE from 'three'

extend({ EffectComposer, RenderPass, ShaderPass })

// 4x4 Bayer matrix normalized to [0, 1]
const BAYER_4X4 = [
  [0.0/16.0,  8.0/16.0,  2.0/16.0, 10.0/16.0],
  [12.0/16.0, 4.0/16.0, 14.0/16.0,  6.0/16.0],
  [3.0/16.0, 11.0/16.0,  1.0/16.0,  9.0/16.0],
  [15.0/16.0, 7.0/16.0, 13.0/16.0,  5.0/16.0]
];

const RetroShader = {
  uniforms: {
    'tDiffuse': { value: null },
    'resolution': { value: new THREE.Vector2() },
    'pixelSize': { value: 2.0 },
    'threshold': { value: 0.5 },
    'bayerMatrix': { value: BAYER_4X4.flat() }
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
    uniform vec2 resolution;
    uniform float pixelSize;
    uniform float threshold;
    uniform float bayerMatrix[16];
    varying vec2 vUv;

    float getBayerValue(vec2 coord) {
      int x = int(mod(coord.x, 4.0));
      int y = int(mod(coord.y, 4.0));
      return bayerMatrix[x + y * 4];
    }

    vec3 rgb2hsv(vec3 c) {
      vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
      vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
      vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
      float d = q.x - min(q.w, q.y);
      float e = 1.0e-10;
      return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
    }

    vec3 hsv2rgb(vec3 c) {
      vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
      vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
      return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    void main() {
      // Pixelate
      vec2 pixelatedUv = floor(vUv * resolution / pixelSize) * pixelSize / resolution;
      vec4 color = texture2D(tDiffuse, pixelatedUv);
      
      // Convert to HSV
      vec3 hsv = rgb2hsv(color.rgb);
      
      // Get dither threshold
      float dither = getBayerValue(gl_FragCoord.xy);
      
      // Apply dithering to value channel
      float value = hsv.z;
      value = step(dither * 1.2, value); // Multiply dither by 1.2 for stronger effect
      hsv.z = value;
      
      // Convert back to RGB
      color.rgb = hsv2rgb(hsv);
      
      gl_FragColor = color;
    }
  `
}

export function PostProcessing() {
  const { gl, scene, camera, size } = useThree()
  const composerRef = useRef<EffectComposer>(null!)

  useEffect(() => {
    const composer = new EffectComposer(gl)
    const renderPass = new RenderPass(scene, camera)
    composer.addPass(renderPass)

    const retroPass = new ShaderPass(RetroShader)
    retroPass.uniforms.resolution.value.set(size.width, size.height)
    retroPass.uniforms.pixelSize.value = 2.0
    composer.addPass(retroPass)

    composerRef.current = composer

    const handleResize = () => {
      composer.setSize(size.width, size.height)
      retroPass.uniforms.resolution.value.set(size.width, size.height)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      composer.passes.forEach(pass => {
        const p = pass as any
        if (p.dispose) p.dispose()
      })
      composer.passes = []
    }
  }, [gl, scene, camera, size])

  useFrame(() => {
    if (composerRef.current) {
      composerRef.current.render()
    }
  }, 1)

  return null
}