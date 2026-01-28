import { create } from "zustand";
import type { 
  GlobalConfig, LayerConfig, ParticleType, ParticleShape, LayerKind, MaskTransform, 
  MaterialPreset, GlyphPaletteEntry, SpawnConfig, MovementConfig, BorderEffectConfig,
  ColorRegionEffect
} from "./types";

// Default material presets
const defaultMaterialPresets: MaterialPreset[] = [
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

const uid = () => Math.random().toString(36).slice(2, 10);

// Default shape is always "dot" - user can change via Shape parameter in RightPanel
// Shape selection is decoupled from particle type selection
const DEFAULT_SHAPE: ParticleShape = "dot";

// Default point size is 10 for all particle types (easy to see individual particles)
const DEFAULT_POINT_SIZE = 10;

// Default mask transform
const defaultMaskTransform = (): MaskTransform => ({
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  skewX: 0,
  skewY: 0
});

// Default spawn config based on particle type
const defaultSpawnConfig = (type: ParticleType): SpawnConfig => {
  // Rain-like particles (sand, liquid) spawn from top
  // Rising particles (sparks) spawn from bottom
  // Everything else spawns randomly
  const region = type === "sand" || type === "liquid" ? "topEdge" 
               : type === "sparks" ? "bottomEdge" 
               : "random";
  
  return {
    region,
    edgeOffset: 0.05,           // Slightly off edge
    edgeSpread: 1.0,            // Full spread across edge
    centerPoint: { x: 0.5, y: 0.5 },
    burstSpeed: 0.3,
    customMask: undefined
  };
};

// Default movement config based on particle type
const defaultMovementConfig = (type: ParticleType): MovementConfig => ({
  // Most particles are still by default - forces drive movement
  pattern: type === "ink" ? "followCurl" : type === "dust" ? "brownian" : "still",
  direction: 270,              // Default direction: down (for linear)
  speed: 0.1,                  // Low intrinsic speed
  centerPoint: { x: 0.5, y: 0.5 },
  spiralTightness: 0.3,
  orbitRadius: 0.3,
  orbitEccentricity: 0,
  waveAmplitude: 0.1,
  waveFrequency: 2,
  waveDirection: 0,
  vortexStrength: 0.5,
  vortexInward: 0.2
});

// Default border effect config
const defaultBorderEffectConfig = (): BorderEffectConfig => ({
  effect: "deflect",
  strength: 0.5,
  transformColor: "#ffffff",
  fragmentCount: 3,
  smearLength: 0.3,
  velocityScale: 1.0
});

const defaultLayer = (name: string, type: ParticleType, particleCount: number, kind: LayerKind = "foreground"): LayerConfig => ({
  id: uid(),
  name,
  kind,
  enabled: true,
  particleCount,
  spawnRate: type === "sand" ? 0.15 : 0.0,
  spawnSpeed: type === "sand" ? 0.4 : type === "sparks" ? 1.5 : type === "ink" ? 0.6 : 0.8,
  type,
  shape: DEFAULT_SHAPE, // Always "dot" by default - user changes via UI
  
  // === SPAWN REGION SYSTEM ===
  spawnConfig: defaultSpawnConfig(type),
  
  // === MOVEMENT PATTERN SYSTEM ===
  movementConfig: defaultMovementConfig(type),
  
  // mask settings
  maskUrl: undefined,
  maskInvert: true,
  maskThreshold: 0.5,
  maskTransform: defaultMaskTransform(),
  maskEraseMask: undefined,
  maskMode: "collision",
  
  // === NEW MASK BEHAVIOR SYSTEM ===
  maskBehavior: "containment",
  borderEffectConfig: defaultBorderEffectConfig(),
  colorRegions: [] as ColorRegionEffect[],
  
  maskStickiness: 0.3,
  maskMagnetism: 0,
  maskMagnetismRadius: 0.1,
  
  // flow paths (for directed flow layers)
  flowPaths: [],
  
  // Distinct physics per type (tighter, more usable ranges)
  gravity: type === "sparks" ? -0.15 : type === "sand" ? 0.4 : type === "dust" ? 0.02 : 0.08,
  drag: type === "sand" ? 0.03 : type === "sparks" ? 0.12 : type === "ink" ? 0.06 : 0.04,
  jitter: type === "sparks" ? 0.6 : type === "ink" ? 0.1 : type === "dust" ? 0.2 : 0.08,
  curl: type === "ink" ? 0.7 : type === "dust" ? 0.4 : type === "sparks" ? 0.15 : 0.1,
  attract: type === "sand" ? 0.0 : type === "ink" ? 0.1 : 0.05,
  attractFalloff: 1.0, // linear falloff by default
  attractPoint: { x: 0.5, y: 0.5 },
  windAngle: type === "sand" ? 270 : type === "sparks" ? 90 : 0, // sand falls down, sparks rise
  windStrength: 0.0, // off by default
  speed: type === "sparks" ? 1.2 : type === "sand" ? 0.9 : 1.0,
  boundaryMode: "bounce",
  boundaryBounce: type === "sand" ? 0.2 : type === "sparks" ? 0.6 : 0.4,
  
  // render
  pointSize: DEFAULT_POINT_SIZE, // 10 by default for visibility
  pointSizeMin: 0, // offset from base size (0 to -3)
  pointSizeMax: 0, // offset from base size (0 to +3)
  sizeJitter: 0, // 0 by default per user request
  brightness: type === "sparks" ? 1.4 : 1.0,
  dither: 0, // 0 by default per user request
  trailLength: 0, // 0 by default per user request
  
  // color options
  colorMode: "single",
  color: type === "sparks" ? "#ffcc44" : type === "ink" ? "#4488ff" : type === "liquid" ? "#4488ff" : "#ffffff",
  colorSecondary: undefined,
  colorTertiary: undefined,
  colorScheme: undefined,
  colorRangeStart: undefined,
  colorRangeEnd: undefined,
  
  // particle lifecycle
  accumulationRate: type === "sand" ? 0.8 : type === "liquid" ? 0.6 : 0.3,
  accumulationTime: type === "sparks" ? 0.5 : type === "liquid" ? 3.0 : 2.0,
  decayRate: type === "sparks" ? 0.8 : type === "dust" ? 0.4 : type === "liquid" ? 0.1 : 0.3,

  // === MATERIAL SYSTEM ===
  
  // Depth field (2.5D) - disabled by default
  depthEnabled: false,
  depthFromMask: true,
  depthBlur: 3,
  depthCurve: 1.0,
  depthInvert: false,
  depthScale: 0.5,

  // Ground plane - disabled by default
  groundPlaneEnabled: false,
  groundPlaneTilt: 30,
  groundPlaneY: 0.8,

  // Surface field buffers - disabled by default per user request
  surfaceFieldsEnabled: false,
  smearFieldEnabled: false,
  smearDecayRate: 0.3,
  rippleFieldEnabled: false,
  rippleDamping: 0.05,
  rippleSpeed: 1.0,
  dentFieldEnabled: false,
  dentRecoveryRate: 0.02,

  // Material mode
  materialMode: "binary",
  materialPalette: [...defaultMaterialPresets],

  // Glyph/shape jitter - all 0 by default per user request
  glyphPalette: [{ shape: DEFAULT_SHAPE, weight: 1.0 }] as GlyphPaletteEntry[],
  glyphRotationJitter: 0,
  glyphScaleJitter: 0
});

type StudioState = {
  global: GlobalConfig;
  layers: LayerConfig[];
  selectedLayerId: string;

  resetNonce: number;
  screenshotNonce: number;
  startRecordingNonce: number;
  stopRecordingNonce: number;
  isRecording: boolean;
  exportGifNonce: number;
  isGifExporting: boolean;
  exportMp4Nonce: number;
  isMp4Exporting: boolean;

  setGlobal: (patch: Partial<GlobalConfig>) => void;

  addLayer: (kind?: LayerKind, particleType?: ParticleType) => void;
  removeLayer: (id: string) => void;
  selectLayer: (id: string) => void;
  setLayer: (id: string, patch: Partial<LayerConfig>) => void;
  reorderLayer: (id: string, newIndex: number) => void;
  moveLayerUp: (id: string) => void;
  moveLayerDown: (id: string) => void;

  togglePause: () => void;
  requestResetAll: () => void;
  requestScreenshot: () => void;
  requestStartRecording: () => void;
  requestStopRecording: () => void;
  setIsRecording: (v: boolean) => void;
  requestExportGif: () => void;
  setIsGifExporting: (v: boolean) => void;
  requestExportMp4: () => void;
  setIsMp4Exporting: (v: boolean) => void;
};

export const useStudioStore = create<StudioState>((set, get) => ({
  global: {
    paused: false,
    timeScale: 1,
    exposure: 1,
    backgroundFade: 0.08,
    monochrome: true,
    invert: false,
    threshold: 0.2,
    thresholdSoft: 0.08,
    thresholdGain: 1.2,
    recordingFps: 30,
    gifDuration: 3,
    webmDuration: 0,
    mp4Duration: 15,
    recordingResetOnStart: false,
    audioUrl: undefined,
    audioPlaying: false,
    audioVolume: 0.8
  },
  layers: [],
  selectedLayerId: "",

  resetNonce: 0,
  screenshotNonce: 0,
  startRecordingNonce: 0,
  stopRecordingNonce: 0,
  isRecording: false,
  exportGifNonce: 0,
  isGifExporting: false,
  exportMp4Nonce: 0,
  isMp4Exporting: false,

  setGlobal: (patch) => set((s) => ({ global: { ...s.global, ...patch } })),

  addLayer: (kind: LayerKind = "foreground", particleType: ParticleType = "dust") => {
    const kindLabels: Record<LayerKind, string> = {
      mask: "Mask",
      background: "BG",
      foreground: "FG",
      directedFlow: "Flow"
    };
    const label = kindLabels[kind];
    const next = defaultLayer(`${label} ${get().layers.length + 1}`, particleType, 5000, kind);
    set((s) => ({ layers: [next, ...s.layers], selectedLayerId: next.id }));
  },

  removeLayer: (id) => {
    const layers = get().layers.filter((l) => l.id !== id);
    const selectedLayerId =
      get().selectedLayerId === id ? (layers[0]?.id ?? "") : get().selectedLayerId;
    set({ layers, selectedLayerId });
  },

  selectLayer: (id) => set({ selectedLayerId: id }),

  setLayer: (id, patch) =>
    set((s) => ({
      layers: s.layers.map((l) => (l.id === id ? { ...l, ...patch } : l))
    })),

  reorderLayer: (id, newIndex) => {
    const layers = [...get().layers];
    const currentIndex = layers.findIndex((l) => l.id === id);
    if (currentIndex === -1) return;
    const [layer] = layers.splice(currentIndex, 1);
    const clampedIndex = Math.max(0, Math.min(layers.length, newIndex));
    layers.splice(clampedIndex, 0, layer);
    set({ layers });
  },

  moveLayerUp: (id) => {
    const layers = [...get().layers];
    const currentIndex = layers.findIndex((l) => l.id === id);
    if (currentIndex <= 0) return; // Already at top or not found
    [layers[currentIndex - 1], layers[currentIndex]] = [layers[currentIndex], layers[currentIndex - 1]];
    set({ layers });
  },

  moveLayerDown: (id) => {
    const layers = [...get().layers];
    const currentIndex = layers.findIndex((l) => l.id === id);
    if (currentIndex === -1 || currentIndex >= layers.length - 1) return; // At bottom or not found
    [layers[currentIndex], layers[currentIndex + 1]] = [layers[currentIndex + 1], layers[currentIndex]];
    set({ layers });
  },

  togglePause: () => set((s) => ({ global: { ...s.global, paused: !s.global.paused } })),

  requestResetAll: () => set((s) => ({ resetNonce: s.resetNonce + 1 })),

  requestScreenshot: () => set((s) => ({ screenshotNonce: s.screenshotNonce + 1 })),

  requestStartRecording: () => set((s) => ({ startRecordingNonce: s.startRecordingNonce + 1 })),

  requestStopRecording: () => set((s) => ({ stopRecordingNonce: s.stopRecordingNonce + 1 })),

  setIsRecording: (v) => set({ isRecording: v }),

  requestExportGif: () => set((s) => ({ exportGifNonce: s.exportGifNonce + 1 })),

  setIsGifExporting: (v) => set({ isGifExporting: v }),

  requestExportMp4: () => set((s) => ({ exportMp4Nonce: s.exportMp4Nonce + 1 })),

  setIsMp4Exporting: (v) => set({ isMp4Exporting: v })
}));

// initialize selected layer id on first import
const st = useStudioStore.getState();
if (!st.selectedLayerId) {
  useStudioStore.setState({ selectedLayerId: st.layers[0]?.id ?? "" });
}
