/**
 * HTML Scene Exporter
 * 
 * Exports the current particle scene as a self-contained HTML file
 * that can recreate the scene without external dependencies.
 * 
 * This exporter recreates the full particle engine with all effects:
 * - Particle type-specific physics (sand, dust, sparks, ink, crumbs, liquid)
 * - Movement patterns (spiral, orbit, wave, vortex, etc.)
 * - Spawn regions and spawn velocities
 * - All physics parameters
 * - Color modes (single, gradient, scheme, range)
 * - Particle shapes (dot, star, dash, tilde, square, diamond, ring, cross)
 * - Trail length / motion blur effects
 * - Proper curl noise implementation
 * - Type-specific visual effects
 */

import type { LayerConfig, GlobalConfig } from "../state/types";
import { useStudioStore } from "../state/store";

// Version for tracking export format changes
const HTML_EXPORT_VERSION = "2.0.0";

export type SceneExportData = {
  version: string;
  exportedAt: string;
  global: GlobalConfig;
  layers: LayerConfig[];
};

/**
 * Get the current scene data from the store
 */
function getSceneData(): SceneExportData {
  const state = useStudioStore.getState();
  return {
    version: HTML_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    global: state.global,
    layers: state.layers,
  };
}

/**
 * Generate a self-contained HTML file that recreates the particle scene
 */
export function exportSceneAsHTML(): void {
  const sceneData = getSceneData();
  
  // Generate the HTML content
  const html = generateStandaloneHTML(sceneData);
  
  // Download the HTML file
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = `particle-scene-${Date.now()}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate the standalone HTML content with embedded particle engine
 * This is a full-featured implementation matching the studio's ParticleEngine
 */
function generateStandaloneHTML(sceneData: SceneExportData): string {
  // Escape the JSON data for embedding in HTML
  // Replace </script> to prevent script tag injection
  const sceneDataJson = JSON.stringify(sceneData, null, 2)
    .replace(/<\/script>/gi, "<\\/script>");
  
  // Use the timestamp from sceneData for consistency
  const exportDate = new Date(sceneData.exportedAt).toLocaleDateString();
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Particle Scene - Exported ${exportDate}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      background: #000;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      overflow: hidden;
    }
    canvas {
      max-width: 100vw;
      max-height: 100vh;
      display: block;
    }
    .controls {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 10px;
      z-index: 100;
    }
    button {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #fff;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    button:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    .info {
      position: fixed;
      top: 10px;
      left: 10px;
      color: rgba(255, 255, 255, 0.5);
      font-family: monospace;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <canvas id="canvas"></canvas>
  <div class="controls">
    <button id="pauseBtn">⏸ Pause</button>
    <button id="resetBtn">🔄 Reset</button>
  </div>
  <div class="info" id="info">Particle Scene (exported)</div>

<script>
// Scene configuration data
const SCENE_DATA = ${sceneDataJson};

// ============================================================================
// FULL-FEATURED PARTICLE ENGINE
// This implementation matches the studio's ParticleEngine with all effects
// ============================================================================

// Color scheme presets (matching studio)
const COLOR_SCHEMES = {
  warm: [{ r: 1.0, g: 0.4, b: 0.2 }, { r: 1.0, g: 0.7, b: 0.0 }, { r: 1.0, g: 0.2, b: 0.4 }],
  cool: [{ r: 0.2, g: 0.6, b: 1.0 }, { r: 0.4, g: 0.8, b: 0.9 }, { r: 0.6, g: 0.3, b: 1.0 }],
  earth: [{ r: 0.6, g: 0.4, b: 0.2 }, { r: 0.4, g: 0.5, b: 0.3 }, { r: 0.3, g: 0.25, b: 0.15 }],
  neon: [{ r: 1.0, g: 0.0, b: 0.5 }, { r: 0.0, g: 1.0, b: 0.8 }, { r: 0.8, g: 0.0, b: 1.0 }],
  mono: [{ r: 1.0, g: 1.0, b: 1.0 }, { r: 0.7, g: 0.7, b: 0.7 }, { r: 0.4, g: 0.4, b: 0.4 }],
};

// Type-specific physical properties (matching studio)
const TYPE_PROPS = {
  sand: { mass: 2.5, airResistance: 0.3, windResponse: 0.2, attractResponse: 0.4, curlResponse: 0.15, jitterScale: 0.3, cling: 0.7, buoyancy: 0.0 },
  dust: { mass: 0.15, airResistance: 2.0, windResponse: 3.0, attractResponse: 1.5, curlResponse: 1.8, jitterScale: 0.6, cling: 0.1, buoyancy: 0.8 },
  sparks: { mass: 0.4, airResistance: 1.2, windResponse: 1.0, attractResponse: 0.8, curlResponse: 0.5, jitterScale: 2.5, cling: 0.0, buoyancy: 1.5 },
  ink: { mass: 1.0, airResistance: 0.8, windResponse: 0.6, attractResponse: 1.2, curlResponse: 2.5, jitterScale: 0.2, cling: 0.4, buoyancy: 0.2 },
  crumbs: { mass: 1.8, airResistance: 0.5, windResponse: 0.3, attractResponse: 0.5, curlResponse: 0.2, jitterScale: 0.4, cling: 0.6, buoyancy: 0.0 },
  liquid: { mass: 1.2, airResistance: 0.6, windResponse: 0.4, attractResponse: 1.0, curlResponse: 0.8, jitterScale: 0.15, cling: 0.3, buoyancy: 0.1 },
};

// Movement pattern constants
const PATTERN_STILL = 0;
const PATTERN_LINEAR = 1;
const PATTERN_SPIRAL = 2;
const PATTERN_ORBIT = 3;
const PATTERN_RADIAL_OUT = 4;
const PATTERN_RADIAL_IN = 5;
const PATTERN_WAVE = 6;
const PATTERN_FIGURE8 = 7;
const PATTERN_BROWNIAN = 8;
const PATTERN_FOLLOW_CURL = 9;
const PATTERN_VORTEX = 10;

const PATTERN_MAP = {
  still: PATTERN_STILL, linear: PATTERN_LINEAR, spiral: PATTERN_SPIRAL, orbit: PATTERN_ORBIT,
  radialOut: PATTERN_RADIAL_OUT, radialIn: PATTERN_RADIAL_IN, wave: PATTERN_WAVE,
  figure8: PATTERN_FIGURE8, brownian: PATTERN_BROWNIAN, followCurl: PATTERN_FOLLOW_CURL, vortex: PATTERN_VORTEX,
};

class StandaloneParticleEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!this.gl) {
      throw new Error('WebGL2 not supported');
    }
    
    this.paused = false;
    this.time = 0;
    this.layers = [];
    this.global = SCENE_DATA.global;
    
    // Accumulation texture for trail effects
    this.accumulationCanvas = document.createElement('canvas');
    this.accumulationCtx = this.accumulationCanvas.getContext('2d');
    
    // Initialize
    this.resize(2048, 2048);
    this.initShaders();
    this.initLayers();
    
    // Start animation loop
    this.lastTime = performance.now();
    this.animate();
  }
  
  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
    this.accumulationCanvas.width = w;
    this.accumulationCanvas.height = h;
    this.gl.viewport(0, 0, w, h);
  }
  
  initShaders() {
    const gl = this.gl;
    
    // Enhanced vertex shader with velocity-based sizing and all parameters
    const vsSource = \`#version 300 es
      precision highp float;
      
      in vec2 aPosition;
      in vec2 aVelocity;
      in float aSeed;
      
      uniform vec2 uResolution;
      uniform float uPointSize;
      uniform float uPointSizeMin;
      uniform float uPointSizeMax;
      uniform float uSizeJitter;
      uniform float uTrailLength;
      uniform int uType;
      
      out float vSeed;
      out vec2 vVelocity;
      out float vSpeed;
      
      void main() {
        vec2 pos = aPosition / uResolution;
        vec2 clip = pos * 2.0 - 1.0;
        gl_Position = vec4(clip, 0.0, 1.0);
        
        vSeed = aSeed;
        vVelocity = aVelocity;
        vSpeed = length(aVelocity);
        
        // Calculate size range from base size + offsets
        float minSize = max(0.5, uPointSize + uPointSizeMin);
        float maxSize = uPointSize + uPointSizeMax;
        
        // Apply jitter within the size range
        float jitterAmount = vSeed * uSizeJitter;
        float baseSize = mix(uPointSize, mix(minSize, maxSize, vSeed), jitterAmount);
        
        // Type-specific size adjustments
        if(uType == 2) { // sparks - get bigger when fast
          baseSize *= 1.0 + vSpeed * 8.0;
        } else if(uType == 4) { // crumbs - variable sizes
          float sizeVar = 0.5 + vSeed * 1.0;
          baseSize *= sizeVar;
        } else if(uType == 5) { // liquid - slight size variation, pooled liquid bigger
          float sizeVar = 0.8 + vSeed * 0.4;
          float poolGrowth = 1.0 + (1.0 - clamp(vSpeed * 30.0, 0.0, 1.0)) * 0.5;
          baseSize *= sizeVar * poolGrowth;
        }
        
        // Accumulated particles grow slightly
        float accumulationGrowth = 1.0 + (1.0 - clamp(vSpeed * 50.0, 0.0, 1.0)) * 0.3;
        baseSize *= accumulationGrowth;
        
        gl_PointSize = clamp(baseSize, 0.5, 32.0);
      }
    \`;
    
    // Enhanced fragment shader with shapes, colors, and type-specific effects
    const fsSource = \`#version 300 es
      precision highp float;
      
      in float vSeed;
      in vec2 vVelocity;
      in float vSpeed;
      
      uniform float uBrightness;
      uniform float uExposure;
      uniform float uDither;
      uniform int uMonochrome;
      uniform int uInvert;
      uniform vec3 uTint;
      uniform vec3 uTintSecondary;
      uniform vec3 uTintTertiary;
      uniform int uColorMode;
      uniform int uShape;
      uniform int uType;
      uniform float uTrailLength;
      
      out vec4 oCol;
      
      float hash(float n) { return fract(sin(n) * 43758.5453123); }
      
      // Shape SDFs
      float sdCircle(vec2 p, float r) { return length(p) - r; }
      
      float sdBox(vec2 p, vec2 b) {
        vec2 d = abs(p) - b;
        return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
      }
      
      float sdStar(vec2 p, float r, int n, float m) {
        float an = 3.141593 / float(n);
        float en = 3.141593 / m;
        vec2 acs = vec2(cos(an), sin(an));
        vec2 ecs = vec2(cos(en), sin(en));
        float bn = mod(atan(p.x, p.y), 2.0*an) - an;
        p = length(p) * vec2(cos(bn), abs(sin(bn)));
        p -= r * acs;
        p += ecs * clamp(-dot(p, ecs), 0.0, r*acs.y/ecs.y);
        return length(p) * sign(p.x);
      }
      
      float sdRing(vec2 p, float r, float w) { return abs(length(p) - r) - w; }
      
      float sdDiamond(vec2 p, float s) {
        p = abs(p);
        return (p.x + p.y - s) * 0.707;
      }
      
      float sdCross(vec2 p, float s, float w) {
        p = abs(p);
        return min(sdBox(p, vec2(s, w)), sdBox(p, vec2(w, s)));
      }
      
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        
        // Rotate/stretch based on velocity for trail effect
        if(uTrailLength > 0.01 && vSpeed > 0.001) {
          vec2 dir = normalize(vVelocity);
          float stretch = 1.0 + vSpeed * uTrailLength * 20.0;
          float c = dir.x, s = dir.y;
          p = vec2(c*p.x + s*p.y, -s*p.x + c*p.y);
          p.x /= stretch;
        }
        
        float sdf = 0.0;
        
        // Shape selection
        if(uShape == 0) { // dot
          sdf = sdCircle(p, 0.7);
        } else if(uShape == 1) { // star
          sdf = sdStar(p, 0.5, 5, 2.5);
        } else if(uShape == 2) { // dash
          sdf = sdBox(p, vec2(0.8, 0.15));
        } else if(uShape == 3) { // tilde
          float wave = sin(p.x * 4.0) * 0.2;
          sdf = abs(p.y - wave) - 0.15;
        } else if(uShape == 4) { // square
          sdf = sdBox(p, vec2(0.6, 0.6));
        } else if(uShape == 5) { // diamond
          sdf = sdDiamond(p, 0.7);
        } else if(uShape == 6) { // ring
          sdf = sdRing(p, 0.5, 0.15);
        } else if(uShape == 7) { // cross
          sdf = sdCross(p, 0.7, 0.15);
        }
        
        // Convert SDF to alpha with antialiasing
        float a = 1.0 - smoothstep(-0.1, 0.1, sdf);
        
        // Type-specific visual effects
        if(uType == 2) { // sparks: hot glow effect
          float glow = exp(-sdf * 2.0) * 0.5;
          a = max(a, glow);
          float emberFactor = 1.0 - clamp(vSpeed * 20.0, 0.0, 1.0);
          float flicker = 0.7 + 0.3 * sin(vSeed * 100.0 + gl_FragCoord.x * 0.01);
          flicker = mix(1.0, flicker, emberFactor);
          a *= flicker;
        }
        if(uType == 1) { // dust: very soft edges
          a *= smoothstep(1.0, 0.3, length(p));
        }
        if(uType == 0) { // sand: hard edges, grainy
          a = step(0.3, a);
        }
        if(uType == 4) { // crumbs: rough irregular edges
          float rough = hash(vSeed * 7.0 + p.x * 5.0 + p.y * 3.0) * 0.3;
          a *= 1.0 - rough;
        }
        if(uType == 5) { // liquid: soft glossy appearance
          float highlight = max(0.0, dot(normalize(p + vec2(0.3, 0.5)), vec2(0.0, 1.0)));
          a *= 0.8 + highlight * 0.4;
        }
        
        // Dither
        float d = (hash(vSeed*1000.0 + gl_FragCoord.x*0.13 + gl_FragCoord.y*0.17) - 0.5) * uDither;
        float v = clamp((a + d) * uBrightness * uExposure, 0.0, 1.0);
        
        vec3 col = vec3(v);
        
        if(uMonochrome == 0) {
          if(uColorMode == 0) { // Single color
            col = vec3(v) * uTint;
          } else if(uColorMode == 1) { // Gradient
            float t = fract(vSeed + vSpeed * 2.0);
            if(t < 0.5) {
              col = mix(uTint, uTintSecondary, t * 2.0) * v;
            } else {
              col = mix(uTintSecondary, uTintTertiary, (t - 0.5) * 2.0) * v;
            }
          } else if(uColorMode == 2) { // Scheme
            float pick = fract(vSeed * 3.14159);
            if(pick < 0.33) {
              col = uTint * v;
            } else if(pick < 0.66) {
              col = uTintSecondary * v;
            } else {
              col = uTintTertiary * v;
            }
          } else if(uColorMode == 3) { // Range
            float t = fract(vSeed + vSpeed);
            col = mix(uTint, uTintSecondary, t) * v;
          }
          
          // Type-specific coloring
          if(uType == 2) { // sparks: embers have warmer color
            float emberFactor = 1.0 - clamp(vSpeed * 20.0, 0.0, 1.0);
            vec3 sparkColor = vec3(1.0, 0.9, 0.7);
            vec3 emberColor = vec3(1.0, 0.3, 0.1);
            vec3 tempColor = mix(sparkColor, emberColor, emberFactor);
            col = mix(col, tempColor * v, 0.5);
          }
          if(uType == 5) { // liquid: slight blue tint
            col = mix(col, vec3(0.6, 0.8, 1.0) * v, 0.2);
          }
        }
        
        if(uInvert == 1) col = vec3(1.0) - col;
        
        if(v < 0.01) discard;
        oCol = vec4(col, v);
      }
    \`;
    
    // Compile shaders
    const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);
    
    // Create program
    this.program = gl.createProgram();
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);
    
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error('Program link failed:', gl.getProgramInfoLog(this.program));
    }
    
    // Get attribute locations
    this.aPosition = gl.getAttribLocation(this.program, 'aPosition');
    this.aVelocity = gl.getAttribLocation(this.program, 'aVelocity');
    this.aSeed = gl.getAttribLocation(this.program, 'aSeed');
    
    // Get uniform locations
    this.uniforms = {};
    const uniformNames = [
      'uResolution', 'uPointSize', 'uPointSizeMin', 'uPointSizeMax', 'uSizeJitter',
      'uTrailLength', 'uType', 'uBrightness', 'uExposure', 'uDither', 'uMonochrome',
      'uInvert', 'uTint', 'uTintSecondary', 'uTintTertiary', 'uColorMode', 'uShape'
    ];
    for (const name of uniformNames) {
      this.uniforms[name] = gl.getUniformLocation(this.program, name);
    }
  }
  
  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile failed:', gl.getShaderInfoLog(shader));
    }
    
    return shader;
  }
  
  initLayers() {
    this.layers = SCENE_DATA.layers.map(config => this.createLayer(config));
  }
  
  createLayer(config) {
    const count = config.particleCount || 1000;
    const positions = new Float32Array(count * 2);
    const velocities = new Float32Array(count * 2);
    const seeds = new Float32Array(count);
    
    // Initialize particles
    for (let i = 0; i < count; i++) {
      seeds[i] = Math.random();
      this.initParticle(i, positions, velocities, seeds, config);
    }
    
    const gl = this.gl;
    
    // Create VAO and buffers
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.aPosition);
    gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, 0, 0);
    
    const velocityBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, velocityBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, velocities, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.aVelocity);
    gl.vertexAttribPointer(this.aVelocity, 2, gl.FLOAT, false, 0, 0);
    
    const seedBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, seedBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this.aSeed);
    gl.vertexAttribPointer(this.aSeed, 1, gl.FLOAT, false, 0, 0);
    
    gl.bindVertexArray(null);
    
    return {
      config,
      count,
      positions,
      velocities,
      seeds,
      vao,
      positionBuffer,
      velocityBuffer,
      seedBuffer,
    };
  }
  
  initParticle(i, positions, velocities, seeds, config) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const region = config.spawnConfig?.region || 'random';
    const spawnConfig = config.spawnConfig || {};
    const edgeSpread = spawnConfig.edgeSpread ?? 1.0;
    const edgeOffset = spawnConfig.edgeOffset ?? 0.05;
    const centerPoint = spawnConfig.centerPoint || { x: 0.5, y: 0.5 };
    const burstSpeed = spawnConfig.burstSpeed ?? 0.3;
    
    let x, y;
    const rand = Math.random;
    const spread = edgeSpread;
    const offset = edgeOffset;
    
    switch (region) {
      case 'topEdge':
        x = (rand() * spread + (1 - spread) * 0.5) * w;
        y = h - 10;
        break;
      case 'offCanvasTop':
        x = (rand() * spread + (1 - spread) * 0.5) * w;
        y = h + offset * h;
        break;
      case 'bottomEdge':
        x = (rand() * spread + (1 - spread) * 0.5) * w;
        y = 10;
        break;
      case 'offCanvasBottom':
        x = (rand() * spread + (1 - spread) * 0.5) * w;
        y = -offset * h;
        break;
      case 'leftEdge':
        x = 10;
        y = (rand() * spread + (1 - spread) * 0.5) * h;
        break;
      case 'offCanvasLeft':
        x = -offset * w;
        y = (rand() * spread + (1 - spread) * 0.5) * h;
        break;
      case 'rightEdge':
        x = w - 10;
        y = (rand() * spread + (1 - spread) * 0.5) * h;
        break;
      case 'offCanvasRight':
        x = w + offset * w;
        y = (rand() * spread + (1 - spread) * 0.5) * h;
        break;
      case 'center':
        x = centerPoint.x * w + (rand() - 0.5) * 0.05 * w;
        y = centerPoint.y * h + (rand() - 0.5) * 0.05 * h;
        break;
      case 'centerBurst':
        x = centerPoint.x * w;
        y = centerPoint.y * h;
        break;
      default: // random
        x = rand() * w;
        y = rand() * h;
    }
    
    positions[i * 2] = x;
    positions[i * 2 + 1] = y;
    
    // Get spawn velocity based on region and type
    const seed = seeds[i];
    const typeProps = TYPE_PROPS[config.type] || TYPE_PROPS.dust;
    const spawnSpeed = config.spawnSpeed ?? 0.5;
    const baseSpawnMag = 0.04 / Math.max(typeProps.mass, 0.1);
    
    let vx = 0, vy = 0;
    
    // Region-specific initial velocities
    switch (region) {
      case 'offCanvasTop':
        vx = (seed - 0.5) * 0.02 * w;
        vy = -0.05 * h;
        break;
      case 'offCanvasBottom':
        vx = (seed - 0.5) * 0.02 * w;
        vy = 0.05 * h;
        break;
      case 'offCanvasLeft':
        vx = 0.05 * w;
        vy = (seed - 0.5) * 0.02 * h;
        break;
      case 'offCanvasRight':
        vx = -0.05 * w;
        vy = (seed - 0.5) * 0.02 * h;
        break;
      case 'centerBurst':
        const angle = rand() * Math.PI * 2;
        const burstMag = burstSpeed * w * 0.3;
        vx = Math.cos(angle) * burstMag * rand();
        vy = Math.sin(angle) * burstMag * rand();
        break;
      default:
        // Type-specific spawn velocities
        const type = config.type || 'dust';
        if (type === 'sand') {
          vx = (seed - 0.5) * baseSpawnMag * 0.3 * w;
          vy = -Math.abs(rand()) * baseSpawnMag * h;
        } else if (type === 'dust') {
          vx = (seed - 0.5) * baseSpawnMag * 0.5 * w;
          vy = (rand() - 0.5) * baseSpawnMag * 0.5 * h;
        } else if (type === 'sparks') {
          vx = (seed - 0.5) * baseSpawnMag * w;
          vy = Math.abs(rand()) * baseSpawnMag * 2.0 * h;
        } else if (type === 'crumbs') {
          vx = (seed - 0.5) * baseSpawnMag * 0.5 * w;
          vy = -Math.abs(rand()) * baseSpawnMag * 0.8 * h;
        } else if (type === 'liquid') {
          vx = (seed - 0.5) * baseSpawnMag * 0.2 * w;
          vy = -Math.abs(rand()) * baseSpawnMag * 0.6 * h;
        } else { // ink
          vx = (seed - 0.5) * baseSpawnMag * 0.3 * w;
          vy = (rand() - 0.5) * baseSpawnMag * 0.3 * h;
        }
    }
    
    velocities[i * 2] = vx * spawnSpeed;
    velocities[i * 2 + 1] = vy * spawnSpeed;
  }
  
  // Curl noise flow field (matching studio implementation)
  curlFlow(px, py, t) {
    const x = px / this.canvas.width;
    const y = py / this.canvas.height;
    const a = Math.sin(x * 6.2831 + t * 0.7) + Math.cos(y * 6.2831 - t * 0.5);
    const c = Math.cos(a), s = Math.sin(a);
    const qx = (x - 0.5) * c - (y - 0.5) * s;
    const qy = (x - 0.5) * s + (y - 0.5) * c;
    return {
      x: Math.sin((qy + t * 0.35) * 12.0),
      y: Math.cos((qx - t * 0.30) * 12.0)
    };
  }
  
  // Movement pattern calculation (matching studio)
  patternMovement(x, y, seed, config) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const moveConfig = config.movementConfig || {};
    const pattern = PATTERN_MAP[moveConfig.pattern] ?? PATTERN_STILL;
    const patternSpeed = moveConfig.speed ?? 0.1;
    const centerX = (moveConfig.centerPoint?.x ?? 0.5) * w;
    const centerY = (moveConfig.centerPoint?.y ?? 0.5) * h;
    const direction = (moveConfig.direction ?? 270) * Math.PI / 180;
    
    let fx = 0, fy = 0;
    
    switch (pattern) {
      case PATTERN_LINEAR:
        fx = Math.cos(direction) * patternSpeed * w;
        fy = Math.sin(direction) * patternSpeed * h;
        break;
        
      case PATTERN_SPIRAL: {
        const toX = centerX - x;
        const toY = centerY - y;
        const dist = Math.sqrt(toX * toX + toY * toY);
        if (dist > 0.001) {
          const radialX = toX / dist;
          const radialY = toY / dist;
          const tangentX = -radialY;
          const tangentY = radialX;
          const tightness = moveConfig.spiralTightness ?? 0.3;
          fx = (tangentX * patternSpeed + radialX * tightness * patternSpeed) * w;
          fy = (tangentY * patternSpeed + radialY * tightness * patternSpeed) * h;
        }
        break;
      }
      
      case PATTERN_ORBIT: {
        const toX = centerX - x;
        const toY = centerY - y;
        const dist = Math.sqrt(toX * toX + toY * toY);
        if (dist > 0.001) {
          const radialX = toX / dist;
          const radialY = toY / dist;
          const tangentX = -radialY;
          const tangentY = radialX;
          const orbitRadius = (moveConfig.orbitRadius ?? 0.3) * w;
          const radiusDiff = orbitRadius - dist;
          fx = (tangentX * patternSpeed + radialX * radiusDiff * 2.0 / w) * w;
          fy = (tangentY * patternSpeed + radialY * radiusDiff * 2.0 / h) * h;
        }
        break;
      }
      
      case PATTERN_RADIAL_OUT: {
        const fromX = x - centerX;
        const fromY = y - centerY;
        const dist = Math.sqrt(fromX * fromX + fromY * fromY);
        if (dist > 0.001) {
          fx = (fromX / dist) * patternSpeed * w;
          fy = (fromY / dist) * patternSpeed * h;
        } else {
          fx = (seed - 0.5) * patternSpeed * w;
          fy = (seed * 0.7 - 0.35) * patternSpeed * h;
        }
        break;
      }
      
      case PATTERN_RADIAL_IN: {
        const toX = centerX - x;
        const toY = centerY - y;
        const dist = Math.sqrt(toX * toX + toY * toY);
        if (dist > 0.001) {
          fx = (toX / dist) * patternSpeed * w;
          fy = (toY / dist) * patternSpeed * h;
        }
        break;
      }
      
      case PATTERN_WAVE: {
        const waveDir = moveConfig.waveDirection ?? 0;
        const waveAmp = moveConfig.waveAmplitude ?? 0.1;
        const waveFreq = moveConfig.waveFrequency ?? 2;
        const waveDirRad = waveDir * Math.PI / 180;
        const waveDirX = Math.cos(waveDirRad);
        const waveDirY = Math.sin(waveDirRad);
        const perpX = -waveDirY;
        const perpY = waveDirX;
        const phase = ((x / w) * waveDirX + (y / h) * waveDirY) * waveFreq * 6.28318 + this.time;
        fx = (waveDirX * patternSpeed + perpX * Math.cos(phase) * waveAmp * patternSpeed * 3.0) * w;
        fy = (waveDirY * patternSpeed + perpY * Math.cos(phase) * waveAmp * patternSpeed * 3.0) * h;
        break;
      }
      
      case PATTERN_FIGURE8: {
        const t = this.time * patternSpeed * 2.0 + seed * 6.28318;
        const scale = (moveConfig.orbitRadius ?? 0.3) * w;
        const targetX = centerX + scale * Math.cos(t);
        const targetY = centerY + scale * Math.sin(t) * Math.cos(t);
        fx = (targetX - x) * patternSpeed * 5.0;
        fy = (targetY - y) * patternSpeed * 5.0;
        break;
      }
      
      case PATTERN_BROWNIAN: {
        const angle = Math.random() * 6.28318;
        const mag = patternSpeed * (0.5 + Math.random() * 0.5);
        fx = Math.cos(angle) * mag * w;
        fy = Math.sin(angle) * mag * h;
        break;
      }
      
      case PATTERN_VORTEX: {
        const toX = centerX - x;
        const toY = centerY - y;
        const dist = Math.sqrt(toX * toX + toY * toY);
        if (dist > 0.001) {
          const radialX = toX / dist;
          const radialY = toY / dist;
          const tangentX = -radialY;
          const tangentY = radialX;
          const vortexStrength = moveConfig.vortexStrength ?? 0.5;
          const vortexInward = moveConfig.vortexInward ?? 0.2;
          const inwardPull = vortexInward / Math.max(dist / w, 0.1);
          fx = (tangentX * vortexStrength * patternSpeed + radialX * inwardPull * patternSpeed) * w;
          fy = (tangentY * vortexStrength * patternSpeed + radialY * inwardPull * patternSpeed) * h;
        }
        break;
      }
    }
    
    return { x: fx, y: fy };
  }
  
  update(dt) {
    if (this.paused) return;
    
    const timeScale = this.global.timeScale ?? 1;
    this.time += dt * timeScale;
    const gl = this.gl;
    
    for (const layer of this.layers) {
      if (!layer.config.enabled) continue;
      
      this.updateLayer(layer, dt * timeScale);
      
      // Update buffers
      gl.bindBuffer(gl.ARRAY_BUFFER, layer.positionBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, layer.positions);
      
      gl.bindBuffer(gl.ARRAY_BUFFER, layer.velocityBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, layer.velocities);
    }
  }
  
  updateLayer(layer, dt) {
    const { config, positions, velocities, seeds, count } = layer;
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    // Get physics parameters
    const gravity = config.gravity ?? 0;
    const drag = config.drag ?? 0.02;
    const jitter = config.jitter ?? 0;
    const speed = config.speed ?? 1;
    const windAngle = (config.windAngle ?? 0) * Math.PI / 180;
    const windStrength = config.windStrength ?? 0;
    const attract = config.attract ?? 0;
    const attractFalloff = config.attractFalloff ?? 1.0;
    const attractPoint = config.attractPoint || { x: 0.5, y: 0.5 };
    const curl = config.curl ?? 0;
    const boundaryMode = config.boundaryMode || 'bounce';
    const boundaryBounce = config.boundaryBounce ?? 0.5;
    const spawnRate = config.spawnRate ?? 0;
    const decayRate = config.decayRate ?? 0.3;
    
    // Get type-specific properties
    const typeProps = TYPE_PROPS[config.type] || TYPE_PROPS.dust;
    
    // Calculate wind direction
    const windDirX = Math.cos(windAngle);
    const windDirY = Math.sin(windAngle);
    
    for (let i = 0; i < count; i++) {
      let x = positions[i * 2];
      let y = positions[i * 2 + 1];
      let vx = velocities[i * 2];
      let vy = velocities[i * 2 + 1];
      const seed = seeds[i];
      
      // ===== FORCE CALCULATIONS =====
      
      // Gravity with type-specific mass and buoyancy
      const effectiveGravity = gravity * typeProps.mass - typeProps.buoyancy * 0.1;
      vy -= effectiveGravity * h * dt;
      
      // Wind with type-specific response
      vx += windDirX * windStrength * typeProps.windResponse * w * dt;
      vy += windDirY * windStrength * typeProps.windResponse * h * dt;
      
      // Attraction to point with falloff
      if (attract > 0) {
        const ax = attractPoint.x * w;
        const ay = attractPoint.y * h;
        const dx = ax - x;
        const dy = ay - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const dSafe = Math.max(dist, 0.02 * w);
        const dirX = dx / dSafe;
        const dirY = dy / dSafe;
        let falloff = 1.0 / Math.max(0.01, Math.pow(dSafe / w, attractFalloff));
        falloff = Math.min(falloff, 10.0);
        const attractForce = attract * typeProps.attractResponse * w * falloff;
        vx += dirX * attractForce * dt;
        vy += dirY * attractForce * dt;
      }
      
      // Curl noise flow field with type-specific response
      if (curl > 0) {
        const flow = this.curlFlow(x, y, this.time);
        vx += flow.x * curl * typeProps.curlResponse * w * 0.1 * dt;
        vy += flow.y * curl * typeProps.curlResponse * h * 0.1 * dt;
      }
      
      // Jitter with type-specific scaling
      if (jitter > 0) {
        const jt = jitter * typeProps.jitterScale;
        vx += (Math.random() - 0.5) * jt * w * 0.1 * dt;
        vy += (Math.random() - 0.5) * jt * h * 0.1 * dt;
      }
      
      // Movement pattern force
      const patternForce = this.patternMovement(x, y, seed, config);
      const inertiaFactor = 1.0 / Math.max(typeProps.mass, 0.1);
      vx += patternForce.x * dt * inertiaFactor;
      vy += patternForce.y * dt * inertiaFactor;
      
      // ===== TYPE-SPECIFIC BEHAVIORS =====
      
      // Terminal velocity
      const terminalVel = (0.08 + typeProps.mass * 0.06) * h;
      if (vy < -terminalVel) vy = -terminalVel;
      
      const type = config.type || 'dust';
      
      // Sparks rise and decay
      if (type === 'sparks') {
        vy += typeProps.buoyancy * 0.15 * h * dt;
        vx *= (1.0 - 0.4 * dt);
        vy *= (1.0 - 0.4 * dt);
      }
      
      // Ink swirls
      if (type === 'ink') {
        const c = Math.cos(0.3 * dt);
        const s = Math.sin(0.3 * dt);
        const nvx = vx * c - vy * s;
        const nvy = vx * s + vy * c;
        vx = nvx;
        vy = nvy;
      }
      
      // Sand settles horizontally
      if (type === 'sand') {
        vx *= (1.0 - 0.5 * dt);
      }
      
      // Liquid cohesion and pooling
      if (type === 'liquid') {
        const speedMag = Math.sqrt(vx * vx + vy * vy);
        const slowFactor = 1.0 - Math.min(speedMag / (w * 0.03), 1.0);
        
        // Surface tension / cohesion
        const linkPhase = Math.sin(x / w * 20.0 + this.time * 3.0) * Math.cos(y / h * 20.0 + this.time * 2.5);
        const tensionForce = linkPhase * 0.003 * slowFactor;
        const tensionDirX = 0.5 * w - x;
        const tensionDirY = 0.3 * h - y;
        const tensionDist = Math.sqrt(tensionDirX * tensionDirX + tensionDirY * tensionDirY);
        if (tensionDist > 0.001) {
          vx += (tensionDirX / tensionDist) * tensionForce * w * dt;
          vy += (tensionDirY / tensionDist) * tensionForce * h * dt;
        }
        
        // Pooling behavior
        if (slowFactor > 0.5) {
          vx += (Math.random() - 0.5) * 0.015 * w * slowFactor * dt;
          vy *= 0.98;
        }
      }
      
      // Crumbs tumble
      if (type === 'crumbs') {
        const speedMag = Math.sqrt(vx * vx + vy * vy);
        const tumble = Math.sin(this.time * 5.0 + seed * 10.0) * speedMag * 0.3;
        const c = Math.cos(tumble * dt);
        const s = Math.sin(tumble * dt);
        const nvx = vx * c - vy * s;
        const nvy = vx * s + vy * c;
        vx = nvx;
        vy = nvy;
      }
      
      // Apply drag with type-specific air resistance
      const effectiveDrag = drag * typeProps.airResistance;
      vx *= (1.0 - Math.min(effectiveDrag, 0.95));
      vy *= (1.0 - Math.min(effectiveDrag, 0.95));
      
      // Update position
      x += vx * speed * dt;
      y += vy * speed * dt;
      
      // ===== DEATH/RESPAWN LOGIC =====
      let shouldRespawn = false;
      const speedMag = Math.sqrt(vx * vx + vy * vy) / w;
      
      // Type-specific respawn
      if (type === 'sand') {
        if (y < 0.01 * h && Math.abs(vy) < 0.001 * h && Math.random() < spawnRate) shouldRespawn = true;
      } else if (type === 'sparks') {
        if (speedMag < 0.003 && Math.random() < spawnRate * 0.5 + decayRate * 0.1) shouldRespawn = true;
      } else if (type === 'crumbs') {
        if (Math.random() < spawnRate * 0.01) shouldRespawn = true;
      } else if (type === 'liquid') {
        if (speedMag < 0.005 && Math.random() < decayRate * 0.2 * dt) shouldRespawn = true;
      } else {
        if (Math.random() < spawnRate * 0.02) shouldRespawn = true;
      }
      
      // ===== BOUNDARY HANDLING =====
      const outOfBounds = x < 0 || y < 0 || x > w || y > h;
      
      if (outOfBounds) {
        if (boundaryMode === 'wrap') {
          if (x < 0) x += w;
          if (x > w) x -= w;
          if (y < 0) y += h;
          if (y > h) y -= h;
        } else if (boundaryMode === 'bounce') {
          if (x < 0) { x = 0; vx = -vx * boundaryBounce; }
          if (x > w) { x = w; vx = -vx * boundaryBounce; }
          if (y < 0) { y = 0; vy = -vy * boundaryBounce; }
          if (y > h) { y = h; vy = -vy * boundaryBounce; }
        } else { // respawn
          shouldRespawn = true;
        }
      }
      
      if (shouldRespawn) {
        this.initParticle(i, positions, velocities, seeds, config);
        continue;
      }
      
      // Store updated values
      positions[i * 2] = x;
      positions[i * 2 + 1] = y;
      velocities[i * 2] = vx;
      velocities[i * 2 + 1] = vy;
    }
  }
  
  render() {
    const gl = this.gl;
    const fade = this.global.backgroundFade ?? 0.08;
    
    // Clear with fade effect
    gl.clearColor(0, 0, 0, fade);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // Enable blending (additive)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    
    gl.useProgram(this.program);
    gl.uniform2f(this.uniforms.uResolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uniforms.uExposure, this.global.exposure ?? 1);
    gl.uniform1i(this.uniforms.uMonochrome, this.global.monochrome ? 1 : 0);
    gl.uniform1i(this.uniforms.uInvert, this.global.invert ? 1 : 0);
    
    // Render each layer
    for (const layer of this.layers) {
      if (!layer.config.enabled) continue;
      
      const config = layer.config;
      
      // Point size parameters
      gl.uniform1f(this.uniforms.uPointSize, config.pointSize ?? 3);
      gl.uniform1f(this.uniforms.uPointSizeMin, config.pointSizeMin ?? 0);
      gl.uniform1f(this.uniforms.uPointSizeMax, config.pointSizeMax ?? 0);
      gl.uniform1f(this.uniforms.uSizeJitter, config.sizeJitter ?? 0);
      gl.uniform1f(this.uniforms.uTrailLength, config.trailLength ?? 0);
      
      // Type
      const typeMap = { sand: 0, dust: 1, sparks: 2, ink: 3, crumbs: 4, liquid: 5 };
      gl.uniform1i(this.uniforms.uType, typeMap[config.type] ?? 1);
      
      // Shape
      const shapeMap = { dot: 0, star: 1, dash: 2, tilde: 3, square: 4, diamond: 5, ring: 6, cross: 7 };
      gl.uniform1i(this.uniforms.uShape, shapeMap[config.shape] ?? 0);
      
      // Visual parameters
      gl.uniform1f(this.uniforms.uBrightness, config.brightness ?? 1);
      gl.uniform1f(this.uniforms.uDither, config.dither ?? 0);
      
      // Color mode and colors
      const colorModeMap = { single: 0, gradient: 1, scheme: 2, range: 3 };
      gl.uniform1i(this.uniforms.uColorMode, colorModeMap[config.colorMode] ?? 0);
      
      // Primary color
      const tint = hexToRGB(config.color || '#ffffff');
      gl.uniform3f(this.uniforms.uTint, tint.r, tint.g, tint.b);
      
      // Secondary and tertiary colors based on color mode
      let secondary = { r: 0.5, g: 0.5, b: 0.5 };
      let tertiary = { r: 0.3, g: 0.3, b: 0.3 };
      
      if (config.colorMode === 'gradient') {
        secondary = hexToRGB(config.colorSecondary || '#888888');
        tertiary = hexToRGB(config.colorTertiary || '#444444');
      } else if (config.colorMode === 'scheme') {
        const scheme = COLOR_SCHEMES[config.colorScheme] || COLOR_SCHEMES.warm;
        gl.uniform3f(this.uniforms.uTint, scheme[0].r, scheme[0].g, scheme[0].b);
        secondary = scheme[1];
        tertiary = scheme[2];
      } else if (config.colorMode === 'range') {
        secondary = hexToRGB(config.colorRangeEnd || '#ffffff');
      }
      
      gl.uniform3f(this.uniforms.uTintSecondary, secondary.r, secondary.g, secondary.b);
      gl.uniform3f(this.uniforms.uTintTertiary, tertiary.r, tertiary.g, tertiary.b);
      
      gl.bindVertexArray(layer.vao);
      gl.drawArrays(gl.POINTS, 0, layer.count);
    }
    
    gl.bindVertexArray(null);
  }
  
  animate() {
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    
    this.update(dt);
    this.render();
    
    requestAnimationFrame(() => this.animate());
  }
  
  togglePause() {
    this.paused = !this.paused;
    return this.paused;
  }
  
  reset() {
    for (const layer of this.layers) {
      for (let i = 0; i < layer.count; i++) {
        this.initParticle(i, layer.positions, layer.velocities, layer.seeds, layer.config);
      }
    }
  }
}

// Utility: Convert hex color to RGB
function hexToRGB(hex) {
  const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  } : { r: 1, g: 1, b: 1 };
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('canvas');
  const engine = new StandaloneParticleEngine(canvas);
  
  // Controls
  const pauseBtn = document.getElementById('pauseBtn');
  const resetBtn = document.getElementById('resetBtn');
  
  pauseBtn.addEventListener('click', () => {
    const paused = engine.togglePause();
    pauseBtn.textContent = paused ? '▶ Play' : '⏸ Pause';
  });
  
  resetBtn.addEventListener('click', () => {
    engine.reset();
  });
  
  // Update info
  const info = document.getElementById('info');
  info.textContent = \`Particle Scene | \${SCENE_DATA.layers.length} layers | Exported \${SCENE_DATA.exportedAt.split('T')[0]}\`;
});
</script>
</body>
</html>`;
}
