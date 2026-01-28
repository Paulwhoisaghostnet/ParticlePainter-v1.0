import type { GlobalConfig, LayerConfig, AudioMapping, AudioSource } from "../state/types";
import { createFbo, createProgram, createTexture, makeQuadVAO, must, loadImageBitmap } from "./gl";
import { 
  simVS, simFS, renderVS, renderFS, blitVS, blitFS,
  depthGenVS, depthGenFS,
  smearUpdateVS, smearUpdateFS,
  rippleUpdateVS, rippleUpdateFS,
  dentUpdateVS, dentUpdateFS,
  fieldCompositeVS, fieldCompositeFS
} from "./shaders";
import type { AudioAnalysisData } from "./AudioEngine";

// Apply audio mapping to a base value
function applyAudioMapping(
  baseValue: number,
  mapping: AudioMapping | undefined,
  audioData: AudioAnalysisData | null
): number {
  if (!mapping?.enabled || !audioData) return baseValue;
  
  // Get the audio source value
  const sourceValue = audioData[mapping.source as keyof AudioAnalysisData] as number;
  
  // Apply inversion
  const effectiveSource = mapping.invert ? 1 - sourceValue : sourceValue;
  
  // Map to output range
  const mapped = mapping.min + effectiveSource * (mapping.max - mapping.min);
  
  // Blend with base value based on smoothing (higher smoothing = more base value)
  return baseValue * mapping.smoothing + mapped * (1 - mapping.smoothing);
}

type PingPong = {
  texA: WebGLTexture;
  texB: WebGLTexture;
  fboA: WebGLFramebuffer;
  fboB: WebGLFramebuffer;
  flip: boolean;
  w: number;
  h: number;
};

type MaskTex = { tex: WebGLTexture; w: number; h: number; url: string };

type FlowTex = { tex: WebGLTexture; pathHash: string };

type DepthTex = { tex: WebGLTexture; w: number; h: number; maskUrl: string; config: string };

type SurfaceField = {
  pingpong: PingPong;
  w: number;
  h: number;
};

type LayerGPU = {
  id: string;
  particleCount: number;
  side: number; // texture dimension (sqrt of particle count, rounded up)
  sim: PingPong;
  mask: MaskTex | null;
  eraseMask: MaskTex | null;
  flowTex: FlowTex | null;
  // Material system
  depthTex: DepthTex | null;
  smearField: SurfaceField | null;
  rippleField: SurfaceField | null;
  dentField: SurfaceField | null;
};

// Calculate optimal texture dimension from particle count
function calculateTextureSide(particleCount: number): number {
  return Math.ceil(Math.sqrt(Math.max(50, Math.min(20000, particleCount))));
}

export class ParticleEngine {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;

  private quad = { vao: null as WebGLVertexArrayObject | null, vbo: null as WebGLBuffer | null };

  private simProg: WebGLProgram;
  private renderProg: WebGLProgram;
  private blitProg: WebGLProgram;
  // Material system programs
  private depthGenProg: WebGLProgram;
  private smearUpdateProg: WebGLProgram;
  private rippleUpdateProg: WebGLProgram;
  private dentUpdateProg: WebGLProgram;
  private fieldCompositeProg: WebGLProgram;

  private layersCPU: LayerConfig[] = [];
  private layersGPU: Map<string, LayerGPU> = new Map();
  private global: GlobalConfig | null = null;
  private audioData: AudioAnalysisData | null = null;

  // accumulation buffers (for trails)
  private acc: PingPong;

  private t0 = performance.now();
  private time = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const glContext = canvas.getContext("webgl2", { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
    const gl = must(glContext, "WebGL2 not supported. Use a WebGL2-capable browser.");
    this.gl = gl;

    // Required extensions for float textures as render targets
    const extColorFloat = gl.getExtension("EXT_color_buffer_float");
    if (!extColorFloat) throw new Error("Missing EXT_color_buffer_float (needed for RGBA32F simulation).");

    this.quad = makeQuadVAO(gl);

    this.simProg = createProgram(gl, simVS, simFS);
    this.renderProg = createProgram(gl, renderVS, renderFS);
    this.blitProg = createProgram(gl, blitVS, blitFS);
    // Material system programs
    this.depthGenProg = createProgram(gl, depthGenVS, depthGenFS);
    this.smearUpdateProg = createProgram(gl, smearUpdateVS, smearUpdateFS);
    this.rippleUpdateProg = createProgram(gl, rippleUpdateVS, rippleUpdateFS);
    this.dentUpdateProg = createProgram(gl, dentUpdateVS, dentUpdateFS);
    this.fieldCompositeProg = createProgram(gl, fieldCompositeVS, fieldCompositeFS);

    // create accumulation ping-pong (RGBA8 is fine)
    this.acc = this.makePingPong(canvas.width || 2, canvas.height || 2, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE); // additive
  }

  destroy() {
    // minimal cleanup (browser will reclaim on refresh)
  }

  setGlobal(g: GlobalConfig) {
    this.global = g;
  }

  setAudioData(data: AudioAnalysisData | null) {
    this.audioData = data;
  }

  setLayers(layers: LayerConfig[]) {
    this.layersCPU = layers;

    if (layers.length === 0) {
      this.layersGPU.clear();
      this.clearAccumulation();
      return;
    }

    // sync gpu layers
    for (const l of layers) {
      const existing = this.layersGPU.get(l.id);
      if (!existing || existing.particleCount !== l.particleCount) {
        // rebuild layer buffers when particle count changes
        const side = calculateTextureSide(l.particleCount);
        const sim = this.makePingPong(side, side, this.gl.RGBA32F, this.gl.RGBA, this.gl.FLOAT);
        const lg: LayerGPU = { 
          id: l.id, 
          particleCount: l.particleCount, 
          side, 
          sim, 
          mask: null, 
          eraseMask: null, 
          flowTex: null,
          // Material system
          depthTex: null,
          smearField: null,
          rippleField: null,
          dentField: null
        };
        this.layersGPU.set(l.id, lg);
      }
      // masks are loaded async
      void this.ensureMask(l);
      void this.ensureEraseMask(l);
      // Material system updates
      void this.ensureDepthTex(l);
      this.ensureSurfaceFields(l);
      this.ensureFlowTex(l);
    }

    // remove deleted layers
    for (const id of Array.from(this.layersGPU.keys())) {
      if (!layers.some((l) => l.id === id)) this.layersGPU.delete(id);
    }
  }

  resize(width?: number, height?: number) {
    const w = Math.floor(width ?? this.canvas.clientWidth);
    const h = Math.floor(height ?? this.canvas.clientHeight);
    if (w <= 0 || h <= 0) return;
    if (this.canvas.width === w && this.canvas.height === h) return;

    this.canvas.width = w;
    this.canvas.height = h;

    this.acc = this.makePingPong(w, h, this.gl.RGBA8, this.gl.RGBA, this.gl.UNSIGNED_BYTE);
    this.gl.viewport(0, 0, w, h);
  }

  resetAll() {
    // "reset" by clearing sim textures to 0 (uninitialized -> will reseed)
    const gl = this.gl;
    for (const lg of this.layersGPU.values()) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, lg.sim.fboA);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, lg.sim.fboB);
      gl.clear(gl.COLOR_BUFFER_BIT);
      lg.sim.flip = false;
    }
    // clear accumulation
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.acc.fboA);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.acc.fboB);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.acc.flip = false;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  screenshot(): string | null {
    try {
      return this.canvas.toDataURL("image/png");
    } catch {
      return null;
    }
  }

  step() {
    const g = this.global;
    if (!g) return;

    const now = performance.now();
    const dt = Math.min(0.033, (now - this.t0) / 1000);
    this.t0 = now;

    if (!g.paused) this.time += dt * g.timeScale;

    const gl = this.gl;

    // 1) simulate each layer into its ping-pong float texture
    if (!g.paused) {
      for (const l of this.layersCPU) {
        if (!l.enabled) continue;
        const lg = this.layersGPU.get(l.id);
        if (!lg) continue;
        this.simulateLayer(l, lg, dt * g.timeScale);
        // Update surface fields (smear, ripple, dent)
        if (l.surfaceFieldsEnabled) {
          this.updateSurfaceFields(l, lg, dt * g.timeScale);
        }
      }
    }

    // 2) render all layers into a "curr" color buffer
    const curr = this.acc.flip ? this.acc.fboB : this.acc.fboA;
    const prevTex = this.acc.flip ? this.acc.texA : this.acc.texB;

    gl.bindFramebuffer(gl.FRAMEBUFFER, curr);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // draw particles additively into curr
    gl.useProgram(this.renderProg);
    gl.disable(gl.BLEND);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    const u_state = gl.getUniformLocation(this.renderProg, "u_state");
    const u_stateSize = gl.getUniformLocation(this.renderProg, "u_stateSize");
    const u_canvasSize = gl.getUniformLocation(this.renderProg, "u_canvasSize");
    const u_pointSize = gl.getUniformLocation(this.renderProg, "u_pointSize");
    const u_pointSizeMin = gl.getUniformLocation(this.renderProg, "u_pointSizeMin");
    const u_pointSizeMax = gl.getUniformLocation(this.renderProg, "u_pointSizeMax");
    const u_sizeJitter = gl.getUniformLocation(this.renderProg, "u_sizeJitter");
    const u_glyphRotationJitter = gl.getUniformLocation(this.renderProg, "u_glyphRotationJitter");
    const u_glyphScaleJitter = gl.getUniformLocation(this.renderProg, "u_glyphScaleJitter");
    const u_glyphCount = gl.getUniformLocation(this.renderProg, "u_glyphCount");
    const u_glyphPalette = gl.getUniformLocation(this.renderProg, "u_glyphPalette");
    const u_glyphWeights = gl.getUniformLocation(this.renderProg, "u_glyphWeights");
    const u_brightness = gl.getUniformLocation(this.renderProg, "u_brightness");
    const u_exposure = gl.getUniformLocation(this.renderProg, "u_exposure");
    const u_dither = gl.getUniformLocation(this.renderProg, "u_dither");
    const u_monochrome = gl.getUniformLocation(this.renderProg, "u_monochrome");
    const u_invert = gl.getUniformLocation(this.renderProg, "u_invert");
    const u_tint = gl.getUniformLocation(this.renderProg, "u_tint");
    const u_tintSecondary = gl.getUniformLocation(this.renderProg, "u_tintSecondary");
    const u_tintTertiary = gl.getUniformLocation(this.renderProg, "u_tintTertiary");
    const u_colorMode = gl.getUniformLocation(this.renderProg, "u_colorMode");
    const u_shape = gl.getUniformLocation(this.renderProg, "u_shape");
    const u_type = gl.getUniformLocation(this.renderProg, "u_type");
    const u_trailLength = gl.getUniformLocation(this.renderProg, "u_trailLength");

    gl.uniform2f(u_canvasSize, this.canvas.width, this.canvas.height);
    gl.uniform1f(u_exposure, g.exposure);
    gl.uniform1i(u_monochrome, g.monochrome ? 1 : 0);
    gl.uniform1i(u_invert, g.invert ? 1 : 0);

    for (const l of this.layersCPU) {
      if (!l.enabled) continue;
      const lg = this.layersGPU.get(l.id);
      if (!lg) continue;

      const stateTex = lg.sim.flip ? lg.sim.texB : lg.sim.texA;

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, stateTex);
      gl.uniform1i(u_state, 0);
      gl.uniform2f(u_stateSize, lg.side, lg.side);

      // Get audio config for this layer
      const audioConfig = l.audio;
      const audioEnabled = audioConfig?.enabled && this.audioData;

      // Apply audio modulation to visual parameters
      const effectivePointSize = audioEnabled
        ? applyAudioMapping(l.pointSize, audioConfig?.pointSize, this.audioData)
        : l.pointSize;
      const effectiveColorIntensity = audioEnabled
        ? applyAudioMapping(1.0, audioConfig?.colorIntensity, this.audioData)
        : 1.0;

      gl.uniform1f(u_pointSize, effectivePointSize);
      gl.uniform1f(u_pointSizeMin, l.pointSizeMin ?? 0);
      gl.uniform1f(u_pointSizeMax, l.pointSizeMax ?? 0);
      gl.uniform1f(u_sizeJitter, l.sizeJitter ?? 0.1);
      
      // Glyph jitter uniforms
      gl.uniform1f(u_glyphRotationJitter, l.glyphRotationJitter ?? 0);
      gl.uniform1f(u_glyphScaleJitter, l.glyphScaleJitter ?? 0);
      
      const glyphPalette = l.glyphPalette || [];
      const layerShape = l.shape ?? "dot";
      
      // Always use layer shape parameter for single-entry palettes to avoid sync issues
      // Only use glyph palette system when there are multiple shapes
      let effectiveGlyphCount = glyphPalette.length;
      if (effectiveGlyphCount <= 1) {
        // Use layer shape parameter for 0 or 1 entry palettes
        effectiveGlyphCount = 0;
      }
      
      gl.uniform1i(u_glyphCount, effectiveGlyphCount);
      
      if (effectiveGlyphCount > 0) {
        // Pack shape indices into vec4
        const shapes = new Float32Array(4);
        const weights = new Float32Array(4);
        let totalWeight = 0;
        
        for (let i = 0; i < Math.min(4, effectiveGlyphCount); i++) {
          shapes[i] = shapeToInt(glyphPalette[i].shape);
          weights[i] = glyphPalette[i].weight;
          totalWeight += weights[i];
        }
        
        // Normalize weights
        if (totalWeight > 0) {
          for (let i = 0; i < 4; i++) {
            weights[i] /= totalWeight;
          }
        }
        
        gl.uniform4fv(u_glyphPalette, shapes);
        gl.uniform4fv(u_glyphWeights, weights);
      } else {
        gl.uniform4fv(u_glyphPalette, new Float32Array([0, 0, 0, 0]));
        gl.uniform4fv(u_glyphWeights, new Float32Array([1, 0, 0, 0]));
      }
      
      gl.uniform1f(u_brightness, l.brightness * effectiveColorIntensity);
      gl.uniform1f(u_dither, l.dither);
      
      // Color mode and colors
      const colorModeInt = l.colorMode === "gradient" ? 1 : l.colorMode === "scheme" ? 2 : l.colorMode === "range" ? 3 : 0;
      gl.uniform1i(u_colorMode, colorModeInt);
      
      const tint = hexToRgb(l.color);
      gl.uniform3f(u_tint, tint.r, tint.g, tint.b);
      
      // Secondary and tertiary colors
      const getSecondaryColor = () => {
        if (l.colorMode === "gradient" && l.colorSecondary) return hexToRgb(l.colorSecondary);
        if (l.colorMode === "scheme") return getSchemeColors(l.colorScheme)[1];
        if (l.colorMode === "range" && l.colorRangeEnd) return hexToRgb(l.colorRangeEnd);
        return { r: 0.5, g: 0.5, b: 0.5 };
      };
      const getTertiaryColor = () => {
        if (l.colorMode === "gradient" && l.colorTertiary) return hexToRgb(l.colorTertiary);
        if (l.colorMode === "scheme") return getSchemeColors(l.colorScheme)[2];
        return { r: 0.3, g: 0.3, b: 0.3 };
      };
      
      const secondary = l.colorMode === "scheme" ? getSchemeColors(l.colorScheme)[0] : getSecondaryColor();
      const tertiary = getTertiaryColor();
      
      // For scheme mode, use scheme colors instead of layer colors
      if (l.colorMode === "scheme") {
        const schemeColors = getSchemeColors(l.colorScheme);
        gl.uniform3f(u_tint, schemeColors[0].r, schemeColors[0].g, schemeColors[0].b);
        gl.uniform3f(u_tintSecondary, schemeColors[1].r, schemeColors[1].g, schemeColors[1].b);
        gl.uniform3f(u_tintTertiary, schemeColors[2].r, schemeColors[2].g, schemeColors[2].b);
      } else {
        gl.uniform3f(u_tintSecondary, secondary.r, secondary.g, secondary.b);
        gl.uniform3f(u_tintTertiary, tertiary.r, tertiary.g, tertiary.b);
      }
      
      // Shape: dot=0, star=1, dash=2, tilde=3, square=4, diamond=5, ring=6, cross=7
      const shapeInt = shapeToInt(l.shape ?? "dot");
      gl.uniform1i(u_shape, shapeInt);
      
      // Type: sand=0, dust=1, sparks=2, ink=3
      const typeInt = l.type === "sand" ? 0 : l.type === "dust" ? 1 : l.type === "sparks" ? 2 : 3;
      gl.uniform1i(u_type, typeInt);
      
      gl.uniform1f(u_trailLength, l.trailLength ?? 0);

      // Draw only the actual particle count, not the full texture size
      gl.drawArrays(gl.POINTS, 0, lg.particleCount);
    }

    // 3) composite prev + curr into backbuffer ping-pong
    const outFbo = this.acc.flip ? this.acc.fboA : this.acc.fboB;
    gl.bindFramebuffer(gl.FRAMEBUFFER, outFbo);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.blitProg);

    gl.bindVertexArray(this.quad.vao);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, prevTex);
    gl.uniform1i(gl.getUniformLocation(this.blitProg, "u_prev"), 0);

    // bind curr as texture: curr is fbo, but we have textures
    const currTex = this.acc.flip ? this.acc.texB : this.acc.texA;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, currTex);
    gl.uniform1i(gl.getUniformLocation(this.blitProg, "u_curr"), 1);

    gl.uniform1f(gl.getUniformLocation(this.blitProg, "u_fade"), g.backgroundFade);
    gl.uniform1f(gl.getUniformLocation(this.blitProg, "u_threshold"), g.threshold);
    gl.uniform1f(gl.getUniformLocation(this.blitProg, "u_thresholdSoft"), g.thresholdSoft);
    gl.uniform1f(gl.getUniformLocation(this.blitProg, "u_thresholdGain"), g.thresholdGain);
    gl.uniform1i(gl.getUniformLocation(this.blitProg, "u_applyThreshold"), 0);

    gl.disable(gl.BLEND);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    this.acc.flip = !this.acc.flip;

    // 4) present final accumulation to screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.blitProg);

    gl.activeTexture(gl.TEXTURE0);
    // prev = final
    const finalTex = this.acc.flip ? this.acc.texB : this.acc.texA;
    gl.bindTexture(gl.TEXTURE_2D, finalTex);
    gl.uniform1i(gl.getUniformLocation(this.blitProg, "u_prev"), 0);

    // curr unused; bind same
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, finalTex);
    gl.uniform1i(gl.getUniformLocation(this.blitProg, "u_curr"), 1);

    gl.uniform1f(gl.getUniformLocation(this.blitProg, "u_fade"), 0.0);
    gl.uniform1f(gl.getUniformLocation(this.blitProg, "u_threshold"), g.threshold);
    gl.uniform1f(gl.getUniformLocation(this.blitProg, "u_thresholdSoft"), g.thresholdSoft);
    gl.uniform1f(gl.getUniformLocation(this.blitProg, "u_thresholdGain"), g.thresholdGain);
    gl.uniform1i(gl.getUniformLocation(this.blitProg, "u_applyThreshold"), 1);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }

  private simulateLayer(l: LayerConfig, lg: LayerGPU, dt: number) {
    const gl = this.gl;

    const srcTex = lg.sim.flip ? lg.sim.texB : lg.sim.texA;
    const dstFbo = lg.sim.flip ? lg.sim.fboA : lg.sim.fboB;

    gl.bindFramebuffer(gl.FRAMEBUFFER, dstFbo);
    gl.viewport(0, 0, lg.side, lg.side);

    gl.useProgram(this.simProg);
    gl.bindVertexArray(this.quad.vao);

    // state sampler
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.uniform1i(gl.getUniformLocation(this.simProg, "u_state"), 0);

    // mask sampler: if none, bind 1x1 white
    gl.activeTexture(gl.TEXTURE1);
    const hasMask = Boolean(lg.mask);
    const maskTex = lg.mask?.tex ?? this.getWhiteTex();
    gl.bindTexture(gl.TEXTURE_2D, maskTex);
    gl.uniform1i(gl.getUniformLocation(this.simProg, "u_mask"), 1);

    // erase mask sampler
    gl.activeTexture(gl.TEXTURE2);
    const hasEraseMask = Boolean(lg.eraseMask);
    const eraseMaskTex = lg.eraseMask?.tex ?? this.getWhiteTex();
    gl.bindTexture(gl.TEXTURE_2D, eraseMaskTex);
    gl.uniform1i(gl.getUniformLocation(this.simProg, "u_eraseMask"), 2);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_hasEraseMask"), hasEraseMask ? 1.0 : 0.0);

    // flow texture sampler (for directed flow layers)
    gl.activeTexture(gl.TEXTURE3);
    const hasFlowTex = Boolean(lg.flowTex);
    const flowTex = lg.flowTex?.tex ?? this.getWhiteTex();
    gl.bindTexture(gl.TEXTURE_2D, flowTex);
    gl.uniform1i(gl.getUniformLocation(this.simProg, "u_flowTex"), 3);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_hasFlowTex"), hasFlowTex ? 1.0 : 0.0);

    gl.uniform2f(gl.getUniformLocation(this.simProg, "u_stateSize"), lg.side, lg.side);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_dt"), dt);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_time"), this.time);

    const typeInt = l.type === "sand" ? 0 : l.type === "dust" ? 1 : l.type === "sparks" ? 2 : l.type === "crumbs" ? 4 : l.type === "liquid" ? 5 : 3;
    gl.uniform1i(gl.getUniformLocation(this.simProg, "u_type"), typeInt);

    // Get audio config for this layer
    const audioConfig = l.audio;
    const audioEnabled = audioConfig?.enabled && this.audioData;

    // Apply audio modulation to physics parameters
    const effectiveGravity = audioEnabled
      ? applyAudioMapping(l.gravity, audioConfig?.gravity, this.audioData)
      : l.gravity;
    const effectiveJitter = audioEnabled
      ? applyAudioMapping(l.jitter, audioConfig?.jitter, this.audioData)
      : l.jitter;
    const effectiveCurl = audioEnabled
      ? applyAudioMapping(l.curl, audioConfig?.curl, this.audioData)
      : l.curl;
    const effectiveSpeed = audioEnabled
      ? applyAudioMapping(l.speed, audioConfig?.speed, this.audioData)
      : l.speed;
    const effectiveWindStrength = audioEnabled
      ? applyAudioMapping(l.windStrength ?? 0, audioConfig?.windStrength, this.audioData)
      : (l.windStrength ?? 0);
    const effectiveSpawnRate = audioEnabled
      ? applyAudioMapping(l.spawnRate, audioConfig?.spawnRate, this.audioData)
      : l.spawnRate;

    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_gravity"), effectiveGravity);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_drag"), l.drag);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_jitter"), effectiveJitter);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_curl"), effectiveCurl);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_attract"), l.attract);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_attractFalloff"), l.attractFalloff ?? 1.0);
    gl.uniform2f(gl.getUniformLocation(this.simProg, "u_attractPoint"), l.attractPoint.x, l.attractPoint.y);
    // Wind: convert degrees to radians
    const windAngleRad = ((l.windAngle ?? 0) * Math.PI) / 180;
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_windAngle"), windAngleRad);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_windStrength"), effectiveWindStrength);

    // spawnRate: for sand, replenishment is the feature; for others it's basically off by default
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_spawnRate"), effectiveSpawnRate);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_maskThreshold"), hasMask ? l.maskThreshold : 0.0);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_maskInvert"), hasMask && l.maskInvert ? 1.0 : 0.0);
    const boundaryMode = l.boundaryMode === "bounce" ? 1 : l.boundaryMode === "wrap" ? 2 : 0;
    gl.uniform1i(gl.getUniformLocation(this.simProg, "u_boundaryMode"), boundaryMode);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_boundaryBounce"), l.boundaryBounce);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_speed"), effectiveSpeed);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_spawnSpeed"), l.spawnSpeed);

    // Mask transform uniforms
    const maskTransform = l.maskTransform || { x: 0, y: 0, scale: 1, rotation: 0, skewX: 0, skewY: 0 };
    gl.uniform2f(gl.getUniformLocation(this.simProg, "u_maskPan"), maskTransform.x, maskTransform.y);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_maskScale"), maskTransform.scale);
    // Convert rotation from degrees to radians
    const rotationRad = (maskTransform.rotation * Math.PI) / 180;
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_maskRotation"), rotationRad);
    // Convert skew from degrees to tan
    const skewXTan = Math.tan((maskTransform.skewX * Math.PI) / 180);
    const skewYTan = Math.tan((maskTransform.skewY * Math.PI) / 180);
    gl.uniform2f(gl.getUniformLocation(this.simProg, "u_maskSkew"), skewXTan, skewYTan);

    // Mask mode and physics uniforms
    const maskModeInt = l.maskMode === "ignore" ? 0 : l.maskMode === "visibility" ? 1 : l.maskMode === "accumulate" ? 3 : 2;
    gl.uniform1i(gl.getUniformLocation(this.simProg, "u_maskMode"), maskModeInt);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_stickiness"), l.maskStickiness ?? 0.3);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_magnetism"), l.maskMagnetism ?? 0);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_magnetismRadius"), l.maskMagnetismRadius ?? 0.1);

    // Material system uniforms
    gl.activeTexture(gl.TEXTURE4);
    const hasDepthTex = Boolean(lg.depthTex);
    const depthTex = lg.depthTex?.tex ?? this.getWhiteTex();
    gl.bindTexture(gl.TEXTURE_2D, depthTex);
    gl.uniform1i(gl.getUniformLocation(this.simProg, "u_depthTex"), 4);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_hasDepthTex"), hasDepthTex ? 1.0 : 0.0);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_depthScale"), l.depthScale ?? 0.5);

    // Material mode and palette
    const materialModeInt = l.materialMode === "binary" ? 0 : l.materialMode === "palette" ? 1 : 2;
    gl.uniform1i(gl.getUniformLocation(this.simProg, "u_materialMode"), materialModeInt);
    
    // Use mask texture as material texture for palette/rgb modes
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, lg.mask?.tex ?? this.getWhiteTex());
    gl.uniform1i(gl.getUniformLocation(this.simProg, "u_materialTex"), 5);

    // Material palette response values (pack into vec4s for efficiency)
    const palette = l.materialPalette || [];
    const deflectStick = new Float32Array(4);
    const passFragment = new Float32Array(4);
    const depositSmear = new Float32Array(4);
    const depositRipple = new Float32Array(4);
    const matColors: number[] = [];
    
    for (let i = 0; i < 4; i++) {
      const mat = palette[i];
      if (mat) {
        deflectStick[i] = mat.response.deflect;
        passFragment[i] = mat.response.passThrough;
        depositSmear[i] = mat.response.depositSmear;
        depositRipple[i] = mat.response.depositRipple;
        const col = hexToRgb(mat.color || "#ffffff");
        matColors.push(col.r, col.g, col.b, 1.0);
      } else {
        deflectStick[i] = 0.5;
        passFragment[i] = 0.0;
        depositSmear[i] = 0.0;
        depositRipple[i] = 0.0;
        matColors.push(1.0, 1.0, 1.0, 1.0);
      }
    }
    
    gl.uniform4fv(gl.getUniformLocation(this.simProg, "u_matDeflectStick"), deflectStick);
    gl.uniform4fv(gl.getUniformLocation(this.simProg, "u_matPassFragment"), passFragment);
    gl.uniform4fv(gl.getUniformLocation(this.simProg, "u_matDepositSmear"), depositSmear);
    gl.uniform4fv(gl.getUniformLocation(this.simProg, "u_matDepositRipple"), depositRipple);
    gl.uniform4fv(gl.getUniformLocation(this.simProg, "u_matColors[0]"), new Float32Array(matColors));

    // Ground plane uniforms
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_groundPlaneEnabled"), l.groundPlaneEnabled ? 1.0 : 0.0);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_groundY"), l.groundPlaneY ?? 0.8);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_groundTilt"), ((l.groundPlaneTilt ?? 30) * Math.PI) / 180);

    // === SPAWN REGION UNIFORMS ===
    const spawnConfig = l.spawnConfig;
    const spawnRegionMap: Record<string, number> = {
      random: 0, topEdge: 1, bottomEdge: 2, leftEdge: 3, rightEdge: 4,
      offCanvasTop: 5, offCanvasBottom: 6, offCanvasLeft: 7, offCanvasRight: 8,
      center: 9, centerBurst: 10, mask: 11, maskEdge: 12, custom: 13
    };
    gl.uniform1i(gl.getUniformLocation(this.simProg, "u_spawnRegion"), spawnRegionMap[spawnConfig?.region ?? "random"] ?? 0);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_spawnEdgeOffset"), spawnConfig?.edgeOffset ?? 0.05);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_spawnEdgeSpread"), spawnConfig?.edgeSpread ?? 1.0);
    gl.uniform2f(gl.getUniformLocation(this.simProg, "u_spawnCenterPoint"), 
      spawnConfig?.centerPoint?.x ?? 0.5, spawnConfig?.centerPoint?.y ?? 0.5);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_spawnBurstSpeed"), spawnConfig?.burstSpeed ?? 0.3);
    // Spawn mask texture (use white texture if no custom mask)
    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, this.getWhiteTex());
    gl.uniform1i(gl.getUniformLocation(this.simProg, "u_spawnMask"), 6);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_hasSpawnMask"), 0.0);

    // === MOVEMENT PATTERN UNIFORMS ===
    const moveConfig = l.movementConfig;
    const patternMap: Record<string, number> = {
      still: 0, linear: 1, spiral: 2, orbit: 3, radialOut: 4, radialIn: 5,
      wave: 6, figure8: 7, brownian: 8, followCurl: 9, vortex: 10
    };
    gl.uniform1i(gl.getUniformLocation(this.simProg, "u_movementPattern"), patternMap[moveConfig?.pattern ?? "still"] ?? 0);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_patternDirection"), ((moveConfig?.direction ?? 270) * Math.PI) / 180);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_patternSpeed"), moveConfig?.speed ?? 0.1);
    gl.uniform2f(gl.getUniformLocation(this.simProg, "u_patternCenter"),
      moveConfig?.centerPoint?.x ?? 0.5, moveConfig?.centerPoint?.y ?? 0.5);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_spiralTightness"), moveConfig?.spiralTightness ?? 0.3);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_orbitRadius"), moveConfig?.orbitRadius ?? 0.3);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_orbitEccentricity"), moveConfig?.orbitEccentricity ?? 0);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_waveAmplitude"), moveConfig?.waveAmplitude ?? 0.1);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_waveFrequency"), moveConfig?.waveFrequency ?? 2);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_waveDirection"), ((moveConfig?.waveDirection ?? 0) * Math.PI) / 180);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_vortexStrength"), moveConfig?.vortexStrength ?? 0.5);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_vortexInward"), moveConfig?.vortexInward ?? 0.2);

    // Lifecycle uniforms
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_accumulationRate"), l.accumulationRate ?? 0.3);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_accumulationTime"), l.accumulationTime ?? 2.0);
    gl.uniform1f(gl.getUniformLocation(this.simProg, "u_decayRate"), l.decayRate ?? 0.3);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    lg.sim.flip = !lg.sim.flip;

    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private whiteTex: WebGLTexture | null = null;
  private getWhiteTex() {
    if (this.whiteTex) return this.whiteTex;
    const gl = this.gl;
    const data = new Uint8Array([255, 255, 255, 255]);
    this.whiteTex = createTexture(gl, 1, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return this.whiteTex;
  }

  private makePingPong(w: number, h: number, internal: number, format: number, type: number): PingPong {
    const gl = this.gl;
    const texA = createTexture(gl, w, h, internal, format, type, null);
    const texB = createTexture(gl, w, h, internal, format, type, null);
    const fboA = createFbo(gl, texA);
    const fboB = createFbo(gl, texB);
    return { texA, texB, fboA, fboB, flip: false, w, h };
  }

  private clearAccumulation() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.acc.fboA);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.acc.fboB);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.acc.flip = false;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private async ensureMask(l: LayerConfig) {
    const lg = this.layersGPU.get(l.id);
    if (!lg) return;

    if (!l.maskUrl) {
      lg.mask = null;
      return;
    }

    if (lg.mask?.url === l.maskUrl) return;

    try {
      const bmp = await loadImageBitmap(l.maskUrl);
      const gl = this.gl;
      const tex = must(gl.createTexture(), "mask createTexture failed");
      gl.bindTexture(gl.TEXTURE_2D, tex);
      // Ensure correct texture parameters (no tiling)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      // Don't flip Y - keep image oriented as user expects (top = top)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
      // Reset pixel store state
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      gl.bindTexture(gl.TEXTURE_2D, null);

      lg.mask = { tex, w: bmp.width, h: bmp.height, url: l.maskUrl };
    } catch {
      // ignore bad mask load
      lg.mask = null;
    }
  }

  private async ensureEraseMask(l: LayerConfig) {
    const lg = this.layersGPU.get(l.id);
    if (!lg) return;

    if (!l.maskEraseMask) {
      lg.eraseMask = null;
      return;
    }

    if (lg.eraseMask?.url === l.maskEraseMask) return;

    try {
      const bmp = await loadImageBitmap(l.maskEraseMask);
      const gl = this.gl;
      const tex = must(gl.createTexture(), "eraseMask createTexture failed");
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      gl.bindTexture(gl.TEXTURE_2D, null);

      lg.eraseMask = { tex, w: bmp.width, h: bmp.height, url: l.maskEraseMask };
    } catch {
      lg.eraseMask = null;
    }
  }

  private ensureFlowTex(l: LayerConfig) {
    const lg = this.layersGPU.get(l.id);
    if (!lg) return;

    const paths = l.flowPaths || [];
    if (paths.length === 0) {
      lg.flowTex = null;
      return;
    }

    // Create a hash of the paths to detect changes
    const pathHash = JSON.stringify(paths);
    if (lg.flowTex?.pathHash === pathHash) return;

    // Generate flow texture on CPU, then upload
    // R = direction X (0.5 + dir * 0.5)
    // G = direction Y (0.5 + dir * 0.5)
    // B = flow strength (0-1)
    // A = path info: 255 = spawn point, 128 = mid-path, 0 = end point/decay zone
    const size = 256; // flow field resolution
    const data = new Uint8Array(size * size * 4);

    // Initialize to neutral (0.5, 0.5, 0, 128) = no flow, neutral path
    for (let i = 0; i < size * size; i++) {
      data[i * 4 + 0] = 128; // R = 0.5 (no X direction)
      data[i * 4 + 1] = 128; // G = 0.5 (no Y direction)
      data[i * 4 + 2] = 0;   // B = 0 (no strength)
      data[i * 4 + 3] = 128; // A = 128 (neutral - not spawn or end)
    }

    // Collect all spawn points and end points for marking
    const spawnPoints: { x: number; y: number }[] = [];
    const endPoints: { x: number; y: number }[] = [];

    // Rasterize each path into the flow field
    for (const path of paths) {
      if (path.length < 2) continue;

      // Mark spawn point (first point of path)
      spawnPoints.push(path[0]);
      // Mark end point (last point of path)
      endPoints.push(path[path.length - 1]);

      // Calculate total path length for progress tracking
      let totalLen = 0;
      for (let i = 0; i < path.length - 1; i++) {
        const dx = path[i + 1].x - path[i].x;
        const dy = path[i + 1].y - path[i].y;
        totalLen += Math.sqrt(dx * dx + dy * dy);
      }

      let accLen = 0;
      for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i];
        const p2 = path[i + 1];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const segLen = Math.sqrt(dx * dx + dy * dy);
        if (segLen < 0.001) continue;

        // Normalized direction
        const dirX = dx / segLen;
        const dirY = dy / segLen;

        // Rasterize line segment with thickness
        const steps = Math.max(1, Math.ceil(segLen * size * 2));
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const x = p1.x + dx * t;
          const y = p1.y + dy * t;

          // Progress along entire path (0 = start, 1 = end)
          const progress = (accLen + segLen * t) / totalLen;

          // Paint a larger radius for better flow coverage
          const radius = 8;
          for (let oy = -radius; oy <= radius; oy++) {
            for (let ox = -radius; ox <= radius; ox++) {
              const dist = Math.sqrt(ox * ox + oy * oy);
              if (dist > radius) continue;

              const px = Math.floor(x * size) + ox;
              const py = Math.floor(y * size) + oy;
              if (px < 0 || px >= size || py < 0 || py >= size) continue;

              const idx = (py * size + px) * 4;
              const falloff = 1 - dist / radius;

              // Encode direction as 0.5 + dir * 0.5 (maps -1..1 to 0..1)
              const existingStrength = data[idx + 2] / 255;
              const newStrength = Math.min(1, existingStrength + falloff * 0.8);

              // Blend directions weighted by strength
              if (newStrength > existingStrength) {
                const blend = falloff * 0.7;
                const oldDirX = (data[idx + 0] / 255 - 0.5) * 2;
                const oldDirY = (data[idx + 1] / 255 - 0.5) * 2;
                const newDirX = oldDirX * (1 - blend) + dirX * blend;
                const newDirY = oldDirY * (1 - blend) + dirY * blend;

                data[idx + 0] = Math.floor((newDirX * 0.5 + 0.5) * 255);
                data[idx + 1] = Math.floor((newDirY * 0.5 + 0.5) * 255);
                data[idx + 2] = Math.floor(newStrength * 255);
                // Encode path progress in alpha: 255 = start (spawn), 0 = end (decay)
                data[idx + 3] = Math.floor((1 - progress) * 255);
              }
            }
          }
        }
        accLen += segLen;
      }
    }

    // Mark spawn points with larger radius and high alpha
    const spawnRadius = 12;
    for (const sp of spawnPoints) {
      for (let oy = -spawnRadius; oy <= spawnRadius; oy++) {
        for (let ox = -spawnRadius; ox <= spawnRadius; ox++) {
          const dist = Math.sqrt(ox * ox + oy * oy);
          if (dist > spawnRadius) continue;
          const px = Math.floor(sp.x * size) + ox;
          const py = Math.floor(sp.y * size) + oy;
          if (px < 0 || px >= size || py < 0 || py >= size) continue;
          const idx = (py * size + px) * 4;
          // Mark as spawn zone (alpha = 255)
          if (dist < spawnRadius * 0.5) {
            data[idx + 3] = 255;
          }
        }
      }
    }

    // Mark end points with decay zone (low alpha)
    const endRadius = 15;
    for (const ep of endPoints) {
      for (let oy = -endRadius; oy <= endRadius; oy++) {
        for (let ox = -endRadius; ox <= endRadius; ox++) {
          const dist = Math.sqrt(ox * ox + oy * oy);
          if (dist > endRadius) continue;
          const px = Math.floor(ep.x * size) + ox;
          const py = Math.floor(ep.y * size) + oy;
          if (px < 0 || px >= size || py < 0 || py >= size) continue;
          const idx = (py * size + px) * 4;
          // Mark as decay zone (alpha approaching 0)
          const decayFactor = dist / endRadius;
          data[idx + 3] = Math.min(data[idx + 3], Math.floor(decayFactor * 64));
        }
      }
    }

    // Upload to GPU
    const gl = this.gl;
    const tex = must(gl.createTexture(), "flowTex createTexture failed");
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.bindTexture(gl.TEXTURE_2D, null);

    lg.flowTex = { tex, pathHash };
  }

  // ============================================
  // MATERIAL SYSTEM - DEPTH & SURFACE FIELDS
  // ============================================

  private async ensureDepthTex(l: LayerConfig) {
    const lg = this.layersGPU.get(l.id);
    if (!lg) return;

    // Skip if depth not enabled or no mask
    if (!l.depthEnabled || !l.maskUrl || !lg.mask) {
      lg.depthTex = null;
      return;
    }

    // Create config hash to detect changes
    const configHash = `${l.depthBlur}-${l.depthCurve}-${l.depthInvert}-${l.depthScale}`;
    if (lg.depthTex?.maskUrl === l.maskUrl && lg.depthTex?.config === configHash) {
      return; // Already up to date
    }

    const gl = this.gl;
    const maskW = lg.mask.w;
    const maskH = lg.mask.h;

    // Create depth texture (R16F for single-channel float)
    const depthTex = must(gl.createTexture(), "depthTex createTexture failed");
    gl.bindTexture(gl.TEXTURE_2D, depthTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, maskW, maskH, 0, gl.RED, gl.HALF_FLOAT, null);

    // Create FBO for depth generation
    const depthFbo = createFbo(gl, depthTex);

    // Create temp texture for blur passes
    const tempTex = must(gl.createTexture(), "tempTex createTexture failed");
    gl.bindTexture(gl.TEXTURE_2D, tempTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, maskW, maskH, 0, gl.RED, gl.HALF_FLOAT, null);
    const tempFbo = createFbo(gl, tempTex);

    gl.useProgram(this.depthGenProg);
    gl.bindVertexArray(this.quad.vao);

    // Pass 0: Extract luminance from mask
    gl.bindFramebuffer(gl.FRAMEBUFFER, depthFbo);
    gl.viewport(0, 0, maskW, maskH);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, lg.mask.tex);
    gl.uniform1i(gl.getUniformLocation(this.depthGenProg, "u_mask"), 0);
    gl.uniform1f(gl.getUniformLocation(this.depthGenProg, "u_curve"), l.depthCurve);
    gl.uniform1f(gl.getUniformLocation(this.depthGenProg, "u_scale"), l.depthScale);
    gl.uniform1i(gl.getUniformLocation(this.depthGenProg, "u_invert"), l.depthInvert ? 1 : 0);
    gl.uniform1i(gl.getUniformLocation(this.depthGenProg, "u_pass"), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Blur passes - FIXED: bind depth source to u_depthSrc uniform
    const blurPasses = Math.floor(l.depthBlur * 2);
    for (let i = 0; i < blurPasses; i++) {
      const srcTex = i % 2 === 0 ? depthTex : tempTex;
      const dstFbo = i % 2 === 0 ? tempFbo : depthFbo;

      gl.bindFramebuffer(gl.FRAMEBUFFER, dstFbo);
      // Bind depth source texture to TEXTURE1 for u_depthSrc
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.uniform1i(gl.getUniformLocation(this.depthGenProg, "u_depthSrc"), 1);
      gl.uniform1i(gl.getUniformLocation(this.depthGenProg, "u_pass"), i + 1);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // Cleanup temp resources
    gl.deleteTexture(tempTex);
    gl.deleteFramebuffer(tempFbo);

    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    lg.depthTex = { tex: depthTex, w: maskW, h: maskH, maskUrl: l.maskUrl, config: configHash };
  }

  private ensureSurfaceFields(l: LayerConfig) {
    const lg = this.layersGPU.get(l.id);
    if (!lg) return;

    const gl = this.gl;
    const fieldSize = 256; // Surface fields at fixed resolution

    // Smear field
    if (l.surfaceFieldsEnabled && l.smearFieldEnabled) {
      if (!lg.smearField) {
        const pingpong = this.makePingPong(fieldSize, fieldSize, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
        lg.smearField = { pingpong, w: fieldSize, h: fieldSize };
      }
    } else {
      if (lg.smearField) {
        gl.deleteTexture(lg.smearField.pingpong.texA);
        gl.deleteTexture(lg.smearField.pingpong.texB);
        gl.deleteFramebuffer(lg.smearField.pingpong.fboA);
        gl.deleteFramebuffer(lg.smearField.pingpong.fboB);
        lg.smearField = null;
      }
    }

    // Ripple field
    if (l.surfaceFieldsEnabled && l.rippleFieldEnabled) {
      if (!lg.rippleField) {
        const pingpong = this.makePingPong(fieldSize, fieldSize, gl.RG16F, gl.RG, gl.HALF_FLOAT);
        lg.rippleField = { pingpong, w: fieldSize, h: fieldSize };
      }
    } else {
      if (lg.rippleField) {
        gl.deleteTexture(lg.rippleField.pingpong.texA);
        gl.deleteTexture(lg.rippleField.pingpong.texB);
        gl.deleteFramebuffer(lg.rippleField.pingpong.fboA);
        gl.deleteFramebuffer(lg.rippleField.pingpong.fboB);
        lg.rippleField = null;
      }
    }

    // Dent field (single texture, no ping-pong needed for simple accumulation)
    if (l.surfaceFieldsEnabled && l.dentFieldEnabled) {
      if (!lg.dentField) {
        const pingpong = this.makePingPong(fieldSize, fieldSize, gl.R16F, gl.RED, gl.HALF_FLOAT);
        lg.dentField = { pingpong, w: fieldSize, h: fieldSize };
      }
    } else {
      if (lg.dentField) {
        gl.deleteTexture(lg.dentField.pingpong.texA);
        gl.deleteTexture(lg.dentField.pingpong.texB);
        gl.deleteFramebuffer(lg.dentField.pingpong.fboA);
        gl.deleteFramebuffer(lg.dentField.pingpong.fboB);
        lg.dentField = null;
      }
    }
  }

  // Update surface fields each frame
  private updateSurfaceFields(l: LayerConfig, lg: LayerGPU, dt: number) {
    const gl = this.gl;

    // Update smear field
    if (lg.smearField) {
      const sf = lg.smearField;
      const srcTex = sf.pingpong.flip ? sf.pingpong.texB : sf.pingpong.texA;
      const dstFbo = sf.pingpong.flip ? sf.pingpong.fboA : sf.pingpong.fboB;

      gl.useProgram(this.smearUpdateProg);
      gl.bindFramebuffer(gl.FRAMEBUFFER, dstFbo);
      gl.viewport(0, 0, sf.w, sf.h);
      gl.bindVertexArray(this.quad.vao);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.uniform1i(gl.getUniformLocation(this.smearUpdateProg, "u_prevSmear"), 0);

      // Use a black texture for deposits (will be filled by particle sim later)
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.getWhiteTex());
      gl.uniform1i(gl.getUniformLocation(this.smearUpdateProg, "u_deposits"), 1);

      gl.uniform1f(gl.getUniformLocation(this.smearUpdateProg, "u_decayRate"), l.smearDecayRate);
      gl.uniform1f(gl.getUniformLocation(this.smearUpdateProg, "u_dt"), dt);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      sf.pingpong.flip = !sf.pingpong.flip;
    }

    // Update ripple field
    if (lg.rippleField) {
      const rf = lg.rippleField;
      const srcTex = rf.pingpong.flip ? rf.pingpong.texB : rf.pingpong.texA;
      const dstFbo = rf.pingpong.flip ? rf.pingpong.fboA : rf.pingpong.fboB;

      gl.useProgram(this.rippleUpdateProg);
      gl.bindFramebuffer(gl.FRAMEBUFFER, dstFbo);
      gl.viewport(0, 0, rf.w, rf.h);
      gl.bindVertexArray(this.quad.vao);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.uniform1i(gl.getUniformLocation(this.rippleUpdateProg, "u_prevRipple"), 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.getWhiteTex());
      gl.uniform1i(gl.getUniformLocation(this.rippleUpdateProg, "u_deposits"), 1);

      gl.uniform1f(gl.getUniformLocation(this.rippleUpdateProg, "u_damping"), l.rippleDamping);
      gl.uniform1f(gl.getUniformLocation(this.rippleUpdateProg, "u_speed"), l.rippleSpeed);
      gl.uniform1f(gl.getUniformLocation(this.rippleUpdateProg, "u_dt"), dt);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      rf.pingpong.flip = !rf.pingpong.flip;
    }

    // Update dent field
    if (lg.dentField) {
      const df = lg.dentField;
      const srcTex = df.pingpong.flip ? df.pingpong.texB : df.pingpong.texA;
      const dstFbo = df.pingpong.flip ? df.pingpong.fboA : df.pingpong.fboB;

      gl.useProgram(this.dentUpdateProg);
      gl.bindFramebuffer(gl.FRAMEBUFFER, dstFbo);
      gl.viewport(0, 0, df.w, df.h);
      gl.bindVertexArray(this.quad.vao);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.uniform1i(gl.getUniformLocation(this.dentUpdateProg, "u_prevDent"), 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.getWhiteTex());
      gl.uniform1i(gl.getUniformLocation(this.dentUpdateProg, "u_deposits"), 1);

      gl.uniform1f(gl.getUniformLocation(this.dentUpdateProg, "u_recoveryRate"), l.dentRecoveryRate);
      gl.uniform1f(gl.getUniformLocation(this.dentUpdateProg, "u_dt"), dt);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      df.pingpong.flip = !df.pingpong.flip;
    }

    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
}

function hexToRgb(hex: string) {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = parseInt(cleaned.slice(4, 6), 16) / 255;
  return { r: Number.isFinite(r) ? r : 1, g: Number.isFinite(g) ? g : 1, b: Number.isFinite(b) ? b : 1 };
}

function shapeToInt(shape: string): number {
  switch (shape) {
    case "dot": return 0;
    case "star": return 1;
    case "dash": return 2;
    case "tilde": return 3;
    case "square": return 4;
    case "diamond": return 5;
    case "ring": return 6;
    case "cross": return 7;
    default: return 0;
  }
}

type RGB = { r: number; g: number; b: number };

function getSchemeColors(scheme?: string): [RGB, RGB, RGB] {
  const schemes: Record<string, [string, string, string]> = {
    warm: ["#ff6b35", "#f7931e", "#ffd23f"],
    cool: ["#3a86ff", "#8338ec", "#06d6a0"],
    earth: ["#8d6346", "#bc8034", "#d4a373"],
    neon: ["#ff00ff", "#00ffff", "#ffff00"],
    mono: ["#ffffff", "#888888", "#333333"]
  };
  
  const colors = schemes[scheme || "mono"] || schemes.mono;
  return colors.map(hexToRgb) as [RGB, RGB, RGB];
}
