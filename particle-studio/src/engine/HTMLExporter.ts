/**
 * HTML Scene Exporter
 * 
 * Exports the current particle scene as a self-contained HTML file
 * that can recreate the scene without external dependencies.
 */

import type { LayerConfig, GlobalConfig } from "../state/types";
import { useStudioStore } from "../state/store";

// Version for tracking export format changes
const HTML_EXPORT_VERSION = "1.0.0";

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
// SIMPLIFIED PARTICLE ENGINE
// This is a standalone implementation that recreates the particle simulation
// ============================================================================

class StandaloneParticleEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2');
    if (!this.gl) {
      throw new Error('WebGL2 not supported');
    }
    
    this.paused = false;
    this.time = 0;
    this.layers = [];
    this.global = SCENE_DATA.global;
    
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
    this.gl.viewport(0, 0, w, h);
  }
  
  initShaders() {
    const gl = this.gl;
    
    // Vertex shader for particles
    const vsSource = \`#version 300 es
      in vec2 aPosition;
      in vec2 aVelocity;
      in float aAge;
      
      uniform vec2 uResolution;
      uniform float uPointSize;
      uniform float uBrightness;
      
      out float vAge;
      out float vBrightness;
      
      void main() {
        vec2 pos = (aPosition / uResolution) * 2.0 - 1.0;
        pos.y = -pos.y;
        gl_Position = vec4(pos, 0.0, 1.0);
        gl_PointSize = uPointSize;
        vAge = aAge;
        vBrightness = uBrightness;
      }
    \`;
    
    // Fragment shader for particles
    const fsSource = \`#version 300 es
      precision highp float;
      
      uniform vec3 uColor;
      
      in float vAge;
      in float vBrightness;
      
      out vec4 fragColor;
      
      void main() {
        vec2 cxy = gl_PointCoord * 2.0 - 1.0;
        float d = length(cxy);
        if (d > 1.0) discard;
        
        float alpha = (1.0 - d * d) * min(1.0, vAge * 2.0) * vBrightness;
        fragColor = vec4(uColor * alpha, alpha);
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
    
    // Get attribute and uniform locations
    this.aPosition = gl.getAttribLocation(this.program, 'aPosition');
    this.aVelocity = gl.getAttribLocation(this.program, 'aVelocity');
    this.aAge = gl.getAttribLocation(this.program, 'aAge');
    
    this.uResolution = gl.getUniformLocation(this.program, 'uResolution');
    this.uPointSize = gl.getUniformLocation(this.program, 'uPointSize');
    this.uColor = gl.getUniformLocation(this.program, 'uColor');
    this.uBrightness = gl.getUniformLocation(this.program, 'uBrightness');
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
    const count = config.particleCount;
    const positions = new Float32Array(count * 2);
    const velocities = new Float32Array(count * 2);
    const ages = new Float32Array(count);
    
    // Initialize particles
    for (let i = 0; i < count; i++) {
      const region = config.spawnConfig?.region || 'random';
      this.initParticle(i, positions, velocities, ages, config, region);
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
    
    const ageBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ageBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, ages, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.aAge);
    gl.vertexAttribPointer(this.aAge, 1, gl.FLOAT, false, 0, 0);
    
    gl.bindVertexArray(null);
    
    return {
      config,
      count,
      positions,
      velocities,
      ages,
      vao,
      positionBuffer,
      velocityBuffer,
      ageBuffer,
    };
  }
  
  initParticle(i, positions, velocities, ages, config, region) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    let x, y;
    switch (region) {
      case 'topEdge':
      case 'offCanvasTop':
        x = Math.random() * w;
        y = region === 'offCanvasTop' ? -10 : 10;
        break;
      case 'bottomEdge':
      case 'offCanvasBottom':
        x = Math.random() * w;
        y = region === 'offCanvasBottom' ? h + 10 : h - 10;
        break;
      case 'leftEdge':
      case 'offCanvasLeft':
        x = region === 'offCanvasLeft' ? -10 : 10;
        y = Math.random() * h;
        break;
      case 'rightEdge':
      case 'offCanvasRight':
        x = region === 'offCanvasRight' ? w + 10 : w - 10;
        y = Math.random() * h;
        break;
      case 'center':
        x = w / 2 + (Math.random() - 0.5) * 100;
        y = h / 2 + (Math.random() - 0.5) * 100;
        break;
      case 'centerBurst':
        x = w / 2;
        y = h / 2;
        break;
      default: // random
        x = Math.random() * w;
        y = Math.random() * h;
    }
    
    positions[i * 2] = x;
    positions[i * 2 + 1] = y;
    
    // Initial velocity based on spawn type
    const spawnSpeed = config.spawnSpeed || 0.5;
    let vx = (Math.random() - 0.5) * spawnSpeed * 50;
    let vy = (Math.random() - 0.5) * spawnSpeed * 50;
    
    if (region === 'centerBurst') {
      const angle = Math.random() * Math.PI * 2;
      const speed = spawnSpeed * 100 * Math.random();
      vx = Math.cos(angle) * speed;
      vy = Math.sin(angle) * speed;
    }
    
    velocities[i * 2] = vx;
    velocities[i * 2 + 1] = vy;
    
    ages[i] = Math.random() * 2;
  }
  
  update(dt) {
    if (this.paused) return;
    
    this.time += dt;
    const gl = this.gl;
    
    for (const layer of this.layers) {
      if (!layer.config.enabled) continue;
      
      this.updateLayer(layer, dt);
      
      // Update buffers
      gl.bindBuffer(gl.ARRAY_BUFFER, layer.positionBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, layer.positions);
      
      gl.bindBuffer(gl.ARRAY_BUFFER, layer.velocityBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, layer.velocities);
      
      gl.bindBuffer(gl.ARRAY_BUFFER, layer.ageBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, layer.ages);
    }
  }
  
  updateLayer(layer, dt) {
    const { config, positions, velocities, ages, count } = layer;
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    const gravity = config.gravity || 0;
    const drag = config.drag || 0.02;
    const jitter = config.jitter || 0;
    const speed = config.speed || 1;
    const windAngle = (config.windAngle || 0) * Math.PI / 180;
    const windStrength = config.windStrength || 0;
    const attract = config.attract || 0;
    const attractPoint = config.attractPoint || { x: 0.5, y: 0.5 };
    const curl = config.curl || 0;
    
    // Calculate wind direction
    const windX = Math.cos(windAngle) * windStrength * 500;
    const windY = Math.sin(windAngle) * windStrength * 500;
    
    for (let i = 0; i < count; i++) {
      let x = positions[i * 2];
      let y = positions[i * 2 + 1];
      let vx = velocities[i * 2];
      let vy = velocities[i * 2 + 1];
      let age = ages[i];
      
      // Apply forces
      vy += gravity * 500 * dt;
      vx += windX * dt;
      vy += windY * dt;
      
      // Attraction to point
      if (attract > 0) {
        const ax = attractPoint.x * w;
        const ay = attractPoint.y * h;
        const dx = ax - x;
        const dy = ay - y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.1;
        const force = attract * 500 / dist;
        vx += (dx / dist) * force * dt;
        vy += (dy / dist) * force * dt;
      }
      
      // Curl noise (simplified)
      if (curl > 0) {
        const noiseScale = 0.003;
        const nx = Math.sin(x * noiseScale + this.time) * curl * 100;
        const ny = Math.cos(y * noiseScale + this.time) * curl * 100;
        vx += nx * dt;
        vy += ny * dt;
      }
      
      // Jitter
      if (jitter > 0) {
        vx += (Math.random() - 0.5) * jitter * 100 * dt;
        vy += (Math.random() - 0.5) * jitter * 100 * dt;
      }
      
      // Apply drag
      vx *= 1 - drag;
      vy *= 1 - drag;
      
      // Update position
      x += vx * speed * dt;
      y += vy * speed * dt;
      
      // Boundary handling
      const boundaryMode = config.boundaryMode || 'bounce';
      const bounce = config.boundaryBounce || 0.5;
      
      if (boundaryMode === 'bounce') {
        if (x < 0) { x = 0; vx = -vx * bounce; }
        if (x > w) { x = w; vx = -vx * bounce; }
        if (y < 0) { y = 0; vy = -vy * bounce; }
        if (y > h) { y = h; vy = -vy * bounce; }
      } else if (boundaryMode === 'wrap') {
        if (x < 0) x += w;
        if (x > w) x -= w;
        if (y < 0) y += h;
        if (y > h) y -= h;
      } else { // respawn
        if (x < -50 || x > w + 50 || y < -50 || y > h + 50) {
          this.initParticle(i, positions, velocities, ages, config, config.spawnConfig?.region || 'random');
          continue;
        }
      }
      
      // Update age
      age += dt;
      
      // Store updated values
      positions[i * 2] = x;
      positions[i * 2 + 1] = y;
      velocities[i * 2] = vx;
      velocities[i * 2 + 1] = vy;
      ages[i] = age;
    }
  }
  
  render() {
    const gl = this.gl;
    const fade = this.global.backgroundFade || 0.08;
    
    // Clear with fade
    gl.clearColor(0, 0, 0, fade);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // Enable blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    
    gl.useProgram(this.program);
    gl.uniform2f(this.uResolution, this.canvas.width, this.canvas.height);
    
    // Render each layer
    for (const layer of this.layers) {
      if (!layer.config.enabled) continue;
      
      const color = hexToRGB(layer.config.color || '#ffffff');
      gl.uniform3f(this.uColor, color.r, color.g, color.b);
      gl.uniform1f(this.uPointSize, layer.config.pointSize || 3);
      gl.uniform1f(this.uBrightness, layer.config.brightness || 1);
      
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
      const region = layer.config.spawnConfig?.region || 'random';
      for (let i = 0; i < layer.count; i++) {
        this.initParticle(i, layer.positions, layer.velocities, layer.ages, layer.config, region);
      }
    }
  }
}

// Utility: Convert hex color to RGB
function hexToRGB(hex) {
  const result = /^#?([a-f\\\\d]{2})([a-f\\\\d]{2})([a-f\\\\d]{2})$/i.exec(hex);
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
