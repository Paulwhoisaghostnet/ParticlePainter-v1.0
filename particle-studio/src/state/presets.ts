
import type { 
  ParticleType, SpawnConfig, MovementConfig, MaterialPreset, GlyphPaletteEntry, 
  BorderEffectConfig, LayerConfig, MaskTransform, ColorRegionEffect, AttractionPoint, BoundaryMode 
} from "./types";

// Default material presets
export const defaultMaterialPresets: MaterialPreset[] = [
  {
    id: "solid",
    name: "Solid",
    response: { deflect: 0.8, stick: 0.1, passThrough: 0, fragment: 0.2, depositSmear: 0.1, depositRipple: 0, depositDent: 0, glow: 0 },
    fragmentCount: 3,
    fragmentLifespan: 0.3,
    decayRate: 0.5,
    color: "#ffffff"
  },
  {
    id: "liquid",
    name: "Liquid",
    response: { deflect: 0.2, stick: 0.3, passThrough: 0, fragment: 0.1, depositSmear: 0.6, depositRipple: 0.8, depositDent: 0, glow: 0 },
    fragmentCount: 5,
    fragmentLifespan: 0.5,
    decayRate: 0.3,
    color: "#4488ff"
  },
  {
    id: "gel",
    name: "Gel/Sticky",
    response: { deflect: 0.1, stick: 0.9, passThrough: 0, fragment: 0, depositSmear: 0.8, depositRipple: 0.1, depositDent: 0.2, glow: 0 },
    fragmentCount: 0,
    fragmentLifespan: 0,
    decayRate: 0.1,
    color: "#ff4444"
  },
  {
    id: "porous",
    name: "Porous/Gas",
    response: { deflect: 0.1, stick: 0, passThrough: 0.7, fragment: 0, depositSmear: 0, depositRipple: 0, depositDent: 0, glow: 0 },
    fragmentCount: 0,
    fragmentLifespan: 0,
    decayRate: 0.8,
    color: "#000000"
  }
];

// Default mask transform
export const defaultMaskTransform = (): MaskTransform => ({
  x: 0, y: 0, scale: 1, rotation: 0, skewX: 0, skewY: 0
});

// Default border effect config
export const defaultBorderEffectConfig = (): BorderEffectConfig => ({
  effect: "deflect",
  strength: 0.5,
  transformColor: "#ffffff",
  fragmentCount: 3,
  smearLength: 0.3,
  velocityScale: 1.0
});

// Default spawn config based on particle type
export const defaultSpawnConfig = (type: ParticleType): SpawnConfig => {
  const region = type === "sand" || type === "liquid" ? "topEdge" 
               : type === "sparks" ? "bottomEdge" 
               : "random";
  
  return {
    region,
    edgeOffset: 0.05,
    edgeSpread: 1.0,
    centerPoint: { x: 0.5, y: 0.5 },
    burstSpeed: 0.3,
    customMask: undefined
  };
};

// Default movement config based on particle type
export const defaultMovementConfig = (type: ParticleType): MovementConfig => ({
  pattern: type === "ink" ? "followCurl" : type === "dust" ? "brownian" : "still",
  direction: 270,
  speed: 0.1,
  centerPoint: { x: 0.5, y: 0.5 },
  spiralTightness: 0.3,
  orbitRadius: 0.3,
  orbitEccentricity: 0,
  waveAmplitude: 0.1,
  waveFrequency: 2,
  waveDirection: 0,
  waveCardinalDirection: "east",
  vortexStrength: 0.5,
  vortexInward: 0.2,
  evadeStrength: 0.3,
  evadeRadius: 0.1,
  clusterStrength: 0.5,
  clusterBreakThreshold: 0.7,
  clusterBySize: false,
  clusterByColor: false,
  clusterByBrightness: false
});


// Type-specific Physics & Rendering Data
export const PARTICLE_PRESETS: Record<ParticleType, Partial<LayerConfig>> = {
  sand: {
    spawnRate: 0.15,
    spawnSpeed: 0.4,
    gravity: 0.02, // tuned for 50x scale (0.02 * 50 * 2.5 = 2.5)
    drag: 0.03,
    jitter: 0.08,
    curl: 0.1,
    attract: 0.0,
    windAngle: 270,
    windStrength: 0.0,
    speed: 0.9,
    boundaryBounce: 0.2,
    accumulationRate: 0.8,
    accumulationTime: 2.0,
    decayRate: 0.3,
    color: "#eecfa1",
    maskMode: "collision",
  },
  dust: {
    spawnRate: 0.0,
    spawnSpeed: 0.8,
    gravity: 0.005, // very floaty
    drag: 0.04,
    jitter: 0.2,
    curl: 0.6,
    attract: 0.05,
    windAngle: 0,
    windStrength: 0.2,
    speed: 1.0,
    boundaryBounce: 0.4,
    accumulationRate: 0.3,
    accumulationTime: 2.0,
    decayRate: 0.4,
    color: "#e0e0e0",
    maskMode: "collision",
  },
  sparks: {
    spawnRate: 0.0,
    spawnSpeed: 1.5,
    gravity: -0.01,
    drag: 0.12,
    jitter: 0.6,
    curl: 0.15,
    attract: 0.05,
    windAngle: 90,
    windStrength: 0.1,
    speed: 1.2,
    boundaryBounce: 0.6,
    accumulationRate: 0.3,
    accumulationTime: 0.5,
    decayRate: 0.8,
    brightness: 1.4,
    color: "#ffcc44",
    maskMode: "collision",
  },
  ink: {
    spawnRate: 0.0,
    spawnSpeed: 0.6,
    gravity: 0.0,
    drag: 0.06,
    jitter: 0.05,
    curl: 1.2,
    attract: 0.1,
    windAngle: 0,
    windStrength: 0.0,
    speed: 0.8,
    boundaryBounce: 0.1,
    accumulationRate: 0.3,
    accumulationTime: 2.0,
    decayRate: 0.2,
    color: "#4488ff",
    maskMode: "collision",
    trailLength: 0.4,
  },
  liquid: {
    spawnRate: 0.0,
    spawnSpeed: 0.8,
    gravity: 0.02,
    drag: 0.04,
    jitter: 0.08,
    curl: 0.3,
    attract: 0.05,
    windAngle: 0,
    windStrength: 0.0,
    speed: 1.0,
    boundaryBounce: 0.2,
    accumulationRate: 0.6,
    accumulationTime: 3.0,
    decayRate: 0.1,
    color: "#4488ff",
    maskMode: "accumulate",
  },
  crumbs: { // Fallback/Default
      spawnRate: 0.0,
      spawnSpeed: 0.8,
      gravity: 0.02,
      drag: 0.04,
      jitter: 0.08,
      curl: 0.1,
      attract: 0.05,
      windAngle: 0,
      windStrength: 0.0,
      speed: 1.0,
      boundaryBounce: 0.4,
      accumulationRate: 0.3,
      accumulationTime: 2.0,
      decayRate: 0.3,
      color: "#aaaaaa",
      maskMode: "collision",
  }
};
