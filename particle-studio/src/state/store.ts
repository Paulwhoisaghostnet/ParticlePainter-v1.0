import { create } from "zustand";
import type { 
  GlobalConfig, LayerConfig, ParticleType, ParticleShape, LayerKind, MaskTransform, 
  MaterialPreset, GlyphPaletteEntry, SpawnConfig, MovementConfig, BorderEffectConfig,
  ColorRegionEffect, AttractionPoint, BoundaryMode, WaveCardinalDirection, ResolutionPreset
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
  waveCardinalDirection: "east" as WaveCardinalDirection,
  vortexStrength: 0.5,
  vortexInward: 0.2,
  // Evade parameters
  evadeStrength: 0.3,
  evadeRadius: 0.1,
  // Cluster parameters
  clusterStrength: 0.5,
  clusterBreakThreshold: 0.7,
  clusterBySize: false,
  clusterByColor: false,
  clusterByBrightness: false
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
  showMask: false, // Don't show mask overlay by default
  
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
  attractionPoints: [] as AttractionPoint[], // Multiple attraction points (empty by default)
  windAngle: type === "sand" ? 270 : type === "sparks" ? 90 : 0, // sand falls down, sparks rise
  windStrength: 0.0, // off by default
  speed: type === "sparks" ? 1.2 : type === "sand" ? 0.9 : 1.0,
  massJitter: 0, // No mass jitter by default
  boundaryMode: "bounce" as BoundaryMode,
  boundaryBounce: type === "sand" ? 0.2 : type === "sparks" ? 0.6 : 0.4,
  
  // render
  pointSize: DEFAULT_POINT_SIZE, // 10 by default for visibility
  pointSizeMin: 0, // offset from base size (0 to -6)
  pointSizeMax: 0, // offset from base size (0 to +6)
  sizeJitter: 0, // 0 by default per user request (now 0..2 range)
  brightness: type === "sparks" ? 1.4 : 1.0,
  brightnessJitter: 0, // No brightness jitter by default (0..2 range)
  dither: 0, // 0 by default per user request
  trailLength: 0, // 0 by default per user request
  colorJitter: 0, // No color jitter by default
  
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

// Helper function to get current resolution dimensions based on global config
export function getResolutionDimensions(global: GlobalConfig): { width: number; height: number } {
  if (global.resolutionPreset === "custom") {
    return {
      width: Math.max(256, Math.min(4096, global.customWidth)),
      height: Math.max(256, Math.min(4096, global.customHeight))
    };
  }
  
  // Parse preset (e.g., "512x512" -> { width: 512, height: 512 })
  const match = global.resolutionPreset.match(/^(\d+)x(\d+)$/);
  if (match) {
    const size = parseInt(match[1], 10);
    return { width: size, height: size };
  }
  
  // Fallback to 2048x2048
  return { width: 2048, height: 2048 };
}

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
  exportProgress: number;
  exportStatusMessage: string;

  // Wallet state
  walletConnected: boolean;
  walletAddress: string | null;
  walletBalance: number;

  setGlobal: (patch: Partial<GlobalConfig>) => void;

  addLayer: (kind?: LayerKind, particleType?: ParticleType) => void;
  importLayer: (settings: Omit<LayerConfig, "id">) => void;
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
  setExportProgress: (progress: number, message?: string) => void;

  // Wallet actions
  setWalletConnected: (connected: boolean, address: string | null, balance: number) => void;
  disconnectWallet: () => void;
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
    // Loop mode defaults
    loopMode: false,
    loopDuration: 3, // defaults to GIF duration
    audioUrl: undefined,
    audioPlaying: false,
    audioVolume: 0.8,
    audioGain: 1.0, // Default gain multiplier for audio reactivity
    // Resolution settings
    resolutionPreset: "2048x2048" as ResolutionPreset,
    customWidth: 1920,
    customHeight: 1080,
    // Rolling buffer defaults (disabled by default to save resources)
    bufferEnabled: false,
    bufferDuration: 5,
    bufferFps: 24,
    // Welcome popup
    showWelcome: true // Show welcome popup on first load
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

  // Wallet state
  walletConnected: false,
  walletAddress: null,
  walletBalance: 0,

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

  importLayer: (settings: Omit<LayerConfig, "id">) => {
    // Generate new ID and create the layer with imported settings
    const newLayer: LayerConfig = {
      id: uid(),
      ...settings,
      // Append "(imported)" to name to indicate it was imported
      name: `${settings.name} (imported)`,
    };
    set((s) => ({ layers: [newLayer, ...s.layers], selectedLayerId: newLayer.id }));
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

  setIsMp4Exporting: (v) => set({ isMp4Exporting: v }),
  
  exportProgress: 0,
  exportStatusMessage: "",
  setExportProgress: (progress: number, message: string = "") => set({ exportProgress: progress, exportStatusMessage: message }),

  // Wallet actions
  setWalletConnected: (connected, address, balance) =>
    set({ walletConnected: connected, walletAddress: address, walletBalance: balance }),

  disconnectWallet: () =>
    set({ walletConnected: false, walletAddress: null, walletBalance: 0 })
}));

// initialize selected layer id on first import
const st = useStudioStore.getState();
if (!st.selectedLayerId) {
  useStudioStore.setState({ selectedLayerId: st.layers[0]?.id ?? "" });
}
