export type ParticleType = "sand" | "dust" | "sparks" | "ink" | "crumbs" | "liquid";
export type ParticleShape = "dot" | "star" | "dash" | "tilde" | "square" | "diamond" | "ring" | "cross";
export type LayerKind = "mask" | "background" | "foreground" | "directedFlow";
export type ColorMode = "single" | "gradient" | "scheme" | "range";
export type ColorScheme = "warm" | "cool" | "earth" | "neon" | "mono";
export type MaskMode = 
  | "ignore"       // particles pass through, no effect
  | "visibility"   // mask controls particle visibility only
  | "collision"    // particles bounce off mask boundaries
  | "accumulate";  // particles stick to mask boundaries

// ============================================
// NEW MASK BEHAVIOR SYSTEM
// ============================================

// Primary mask behavior modes
export type MaskBehavior = 
  | "containment"    // Particles stay confined inside masked area
  | "borderEffect"   // Particles transform at mask boundary (smear, repel, etc.)
  | "colorRegions"   // Different colors define different particle behaviors
  | "pathing";       // Mask shape defines flow paths (particles follow contours)

// What happens when particles cross/interact with boundaries
export type BorderEffect = 
  | "deflect"        // Bounce off (like current collision)
  | "smear"          // Particle elongates and leaves trail
  | "absorb"         // Particle slows and sticks (like accumulate)
  | "repel"          // Push away from boundary (magnetism-like)
  | "transform"      // Change particle type/color on entry
  | "fragment"       // Break into smaller particles
  | "passThrough";   // Allow passage with optional velocity change

// Configuration for border effects
export type BorderEffectConfig = {
  effect: BorderEffect;
  strength: number;           // 0-1, how strongly the effect applies
  transformColor?: string;    // Color to change to (for transform effect)
  fragmentCount?: number;     // How many fragments (for fragment effect)
  smearLength?: number;       // Trail length (for smear effect)
  velocityScale?: number;     // Velocity multiplier after effect (0-2)
};

// ============================================
// SPAWN REGION SYSTEM
// ============================================

export type SpawnRegion = 
  | "random"         // Current behavior (noise within canvas)
  | "topEdge"        // Spawn from top edge (rain)
  | "bottomEdge"     // Spawn from bottom edge (rising)
  | "leftEdge"       // Spawn from left edge
  | "rightEdge"      // Spawn from right edge
  | "offCanvasTop"   // Spawn ABOVE canvas (falls in)
  | "offCanvasBottom"// Spawn BELOW canvas (rises in)
  | "offCanvasLeft"  // Spawn LEFT of canvas
  | "offCanvasRight" // Spawn RIGHT of canvas
  | "center"         // Spawn from center point
  | "centerBurst"    // Spawn from center and burst outward
  | "mask"           // Spawn within mask area only
  | "maskEdge"       // Spawn along mask edges
  | "custom";        // Drawable spawn region

export type SpawnConfig = {
  region: SpawnRegion;
  edgeOffset: number;        // How far off-canvas to spawn (0-0.5)
  edgeSpread: number;        // Horizontal/vertical spread along edge (0-1)
  centerPoint: { x: number; y: number }; // Center for center/orbit spawns
  burstSpeed: number;        // Initial outward velocity for burst (0-1)
  customMask?: string;       // Data URL for drawable spawn region
};

// ============================================
// MOVEMENT PATTERN SYSTEM
// ============================================

export type MovementPattern = 
  | "still"          // No intrinsic movement (current default when forces=0)
  | "linear"         // Move in direction at constant speed
  | "spiral"         // Spiral outward/inward from center
  | "orbit"          // Circular orbit around point
  | "radialOut"      // Expand outward from center
  | "radialIn"       // Contract inward toward center
  | "wave"           // Sinusoidal wave motion
  | "figure8"        // Figure-8 pattern
  | "brownian"       // Random walk (enhanced jitter)
  | "followCurl"     // Current curl noise behavior
  | "vortex";        // Spiral vortex (like water draining)

export type MovementConfig = {
  pattern: MovementPattern;
  direction: number;         // Angle for linear movement (0-360, 0=right, 90=up)
  speed: number;             // Base intrinsic speed (0-1)
  
  // Center point for orbital/radial patterns
  centerPoint: { x: number; y: number };
  
  // Spiral/orbit parameters
  spiralTightness: number;   // How quickly spiral tightens (0-1, 0=loose, 1=tight)
  orbitRadius: number;       // Base orbit radius (0-1)
  orbitEccentricity: number; // 0=circle, 1=very elliptical
  
  // Wave parameters  
  waveAmplitude: number;     // Wave height (0-0.5)
  waveFrequency: number;     // Wave cycles (0.5-5)
  waveDirection: number;     // Direction wave travels (0-360)
  
  // Vortex parameters
  vortexStrength: number;    // Rotational pull (0-1)
  vortexInward: number;      // Inward pull (0-1)
};

// ============================================
// COLOR REGION SYSTEM (for colorRegions mask behavior)
// ============================================

export type ColorRegionEffect = {
  color: string;             // Hex color to match
  tolerance: number;         // Color matching tolerance (0-1)
  borderEffect: BorderEffect;
  effectStrength: number;    // 0-1
  particleColorOverride?: string; // Change particle color in this region
  gravityOverride?: number;  // Local gravity override
  flowDirection?: number;    // Local flow direction (0-360)
};

// Material system types
export type MaskMaterialMode = 
  | "binary"      // Existing: luminance threshold only
  | "palette"     // Quantized colors -> material IDs
  | "rgbParams";  // RGB channels drive response strengths directly

export type MaterialResponseChannels = {
  deflect: number;       // 0-1, hard surface bounce
  stick: number;         // 0-1, gel/tar cling
  passThrough: number;   // 0-1, gas/porous
  fragment: number;      // 0-1, spawn debris
  depositSmear: number;  // 0-1, wetness/stain field
  depositRipple: number; // 0-1, liquid membrane
  depositDent: number;   // 0-1, snow compression
  glow: number;          // 0-1, energy emission
};

export type MaterialPreset = {
  id: string;
  name: string;
  response: MaterialResponseChannels;
  fragmentCount: number;      // How many fragments to spawn on impact
  fragmentLifespan: number;   // Seconds before fragments decay
  decayRate: number;          // How fast surface deposits fade
  color?: string;             // Palette mapping color (hex)
};

// Glyph/shape variation
export type GlyphPaletteEntry = {
  shape: ParticleShape;
  weight: number;  // Selection probability weight
};

export type MaskTransform = {
  x: number;        // pan X (-1 to 1)
  y: number;        // pan Y (-1 to 1)
  scale: number;    // scale (0.1 to 3)
  rotation: number; // degrees (0 to 360)
  skewX: number;    // skew X (-45 to 45)
  skewY: number;    // skew Y (-45 to 45)
};

export type FlowPoint = { x: number; y: number };
export type FlowPath = FlowPoint[];

export type LayerConfig = {
  id: string;
  name: string;
  kind: LayerKind; // determines layer behavior

  enabled: boolean;

  // particle count (50-20000)
  particleCount: number; // direct count, GPU texture size calculated from this
  spawnRate: number; // 0..1 relative spawn per frame (used mainly for sand replenishment)
  spawnSpeed: number; // initial velocity scale on respawn
  type: ParticleType;
  shape: ParticleShape; // visual shape of particles

  // === SPAWN REGION SYSTEM ===
  spawnConfig: SpawnConfig;

  // === MOVEMENT PATTERN SYSTEM ===
  movementConfig: MovementConfig;

  // mask (BW). black = inside boundary; white = outside (for mask layers)
  maskUrl?: string;
  maskInvert: boolean;
  maskThreshold: number; // 0..1
  maskTransform: MaskTransform; // transform for mask image
  maskEraseMask?: string; // data URL for eraser strokes overlay
  maskMode: MaskMode; // how the mask affects particles (legacy)
  
  // === NEW MASK BEHAVIOR SYSTEM ===
  maskBehavior: MaskBehavior;
  borderEffectConfig: BorderEffectConfig;
  colorRegions: ColorRegionEffect[];
  
  maskStickiness: number; // 0-1, how much particles stick on collision
  maskMagnetism: number; // -1 to 1, negative repels, positive attracts
  maskMagnetismRadius: number; // 0-1, distance of magnetic effect

  // flow paths (for directed flow layers)
  flowPaths: FlowPath[];

  // physics
  gravity: number; // -0.5..1.0 (tighter range for usable values)
  drag: number; // 0..0.5
  jitter: number; // 0..1 (scaled internally by type)
  curl: number; // 0..1 (flow field strength)
  attract: number; // 0..0.5 (attraction to point)
  attractFalloff: number; // 0..2 (how fast attraction weakens with distance, 0=constant, 2=inverse square)
  attractPoint: { x: number; y: number }; // normalized 0..1
  windAngle: number; // 0..360 degrees (uniform directional force)
  windStrength: number; // 0..0.5 (uniform push strength)
  speed: number; // velocity scale
  boundaryMode: "respawn" | "bounce" | "wrap";
  boundaryBounce: number; // 0..1

  // render
  pointSize: number; // px
  pointSizeMin: number; // offset from pointSize for min (-3 to 0)
  pointSizeMax: number; // offset from pointSize for max (0 to +3)
  sizeJitter: number; // 0..1 (randomness in particle size)
  brightness: number; // 0..2
  dither: number; // 0..1
  trailLength: number; // 0..1 (how much velocity affects shape stretch)

  // color options
  colorMode: ColorMode;
  color: string; // primary hex color
  colorSecondary?: string; // secondary hex color (for gradient)
  colorTertiary?: string; // tertiary hex color (for gradient)
  colorScheme?: ColorScheme; // preset color scheme
  colorRangeStart?: string; // range start color (HSL range mode)
  colorRangeEnd?: string; // range end color (HSL range mode)
  
  // audio reactivity
  audio?: LayerAudioConfig;
  
  // particle lifecycle
  accumulationRate: number;  // 0-1, how quickly particles slow down on contact
  accumulationTime: number;  // seconds before decay starts
  decayRate: number;         // 0-1, how quickly particles fade after accumulation

  // === MATERIAL SYSTEM ===
  
  // Depth field (2.5D)
  depthEnabled: boolean;
  depthFromMask: boolean;     // Auto-generate depth from mask luminance
  depthBlur: number;          // Smoothing passes (0-10)
  depthCurve: number;         // Gamma/pow curve (0.1-3.0)
  depthInvert: boolean;
  depthScale: number;         // Height multiplier (0-1)

  // Ground plane
  groundPlaneEnabled: boolean;
  groundPlaneTilt: number;    // Tilt angle in degrees (0-90)
  groundPlaneY: number;       // Y position (0-1, where 1 is bottom)

  // Surface field buffers
  surfaceFieldsEnabled: boolean;
  smearFieldEnabled: boolean;
  smearDecayRate: number;     // 0-1, how fast smear fades
  rippleFieldEnabled: boolean;
  rippleDamping: number;      // 0-1, wave damping
  rippleSpeed: number;        // Wave propagation speed
  dentFieldEnabled: boolean;
  dentRecoveryRate: number;   // 0-1, how fast dents recover

  // Material mode
  materialMode: MaskMaterialMode;
  materialPalette: MaterialPreset[];

  // Glyph/shape jitter
  glyphPalette: GlyphPaletteEntry[];
  glyphRotationJitter: number;  // 0-360 degrees of random rotation
  glyphScaleJitter: number;     // 0-1, scale variation
};

// Audio reactivity types
export type AudioSource = "amplitude" | "bass" | "mid" | "treble" | "beat" | "brightness" | "centroid";

export type AudioMapping = {
  enabled: boolean;
  source: AudioSource;
  min: number;      // output range min
  max: number;      // output range max
  smoothing: number; // 0-1, how much to smooth the signal
  invert: boolean;
};

export type LayerAudioConfig = {
  enabled: boolean;
  spawnRate?: AudioMapping;
  gravity?: AudioMapping;
  pointSize?: AudioMapping;
  colorIntensity?: AudioMapping;
  speed?: AudioMapping;
  curl?: AudioMapping;
  jitter?: AudioMapping;
  windStrength?: AudioMapping;
};

export type ExportFormat = "gif" | "webm" | "mp4" | "png";
export type GifDuration = 1 | 3 | 4.2 | 5 | 6.66;
export type WebmDuration = 0 | 5 | 15 | 30 | 60; // 0 = open/manual stop
export type Mp4Duration = 15 | 30 | 60 | -1; // -1 = audio track length
export type BufferQuality = "low" | "medium" | "high";

export type GlobalConfig = {
  paused: boolean;
  timeScale: number; // 0..2
  exposure: number; // 0..2
  backgroundFade: number; // 0..1 (how much we fade previous frame)
  monochrome: boolean;
  invert: boolean;
  threshold: number; // 0..1
  thresholdSoft: number; // 0..1
  thresholdGain: number; // 0..3
  recordingFps: 24 | 30 | 60;
  // Export settings
  gifDuration: GifDuration;
  webmDuration: WebmDuration;
  mp4Duration: Mp4Duration;
  recordingResetOnStart: boolean;
  // Loop mode - when enabled, particle simulation time wraps to create seamless loops
  loopMode: boolean;
  loopDuration: number; // seconds - duration of the loop (matches selected export duration)
  // Audio settings
  audioUrl?: string;
  audioPlaying: boolean;
  audioVolume: number; // 0-1
  // Rolling buffer settings for quick export
  bufferEnabled: boolean;
  bufferDuration: number; // seconds (2-10)
  bufferFps: number; // frames per second (15-30)
  bufferQuality: BufferQuality;
};
