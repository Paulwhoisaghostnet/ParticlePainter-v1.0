import { create } from "zustand";
import type { 
  GlobalConfig, LayerConfig, ParticleType, ParticleShape, LayerKind, MaskTransform, 
  MaterialPreset, GlyphPaletteEntry, SpawnConfig, MovementConfig, BorderEffectConfig,
  ColorRegionEffect, AttractionPoint, BoundaryMode, WaveCardinalDirection, ResolutionPreset
} from "./types";

// START MONKEY PATCH
// We need to extend GlobalConfig interface here because we can't easily modify the types file right now 
// (it might be shared or I want to avoid touching it if possible, but actually I should probably check types.ts)
// For now, I will modify types.ts in a separate step to be clean.
// Actually, I'll check types.ts first.


const uid = () => Math.random().toString(36).slice(2, 10);

// Default shape is always "dot" - user can change via Shape parameter in RightPanel
// Shape selection is decoupled from particle type selection
const DEFAULT_SHAPE: ParticleShape = "dot";

// Default point size is 10 for all particle types (easy to see individual particles)
const DEFAULT_POINT_SIZE = 10;

import { 
  PARTICLE_PRESETS, defaultMaterialPresets, defaultSpawnConfig, 
  defaultMovementConfig, defaultMaskTransform, defaultBorderEffectConfig 
} from "./presets";

const defaultLayer = (name: string, type: ParticleType, particleCount: number, kind: LayerKind = "foreground"): LayerConfig => {
  const preset = PARTICLE_PRESETS[type] ?? PARTICLE_PRESETS.crumbs ?? {};

  return {
    id: uid(),
    name,
    kind,
    enabled: true,
    particleCount,
    type,
    shape: DEFAULT_SHAPE,
    
    // Explicitly merge preset values with defaults to satisfy TS
    spawnRate: preset.spawnRate ?? 0.0,
    spawnSpeed: preset.spawnSpeed ?? 0.5,
    gravity: preset.gravity ?? 0.0,
    drag: preset.drag ?? 0.0,
    jitter: preset.jitter ?? 0.0,
    curl: preset.curl ?? 0.0,
    attract: preset.attract ?? 0.0,
    attractPoint: preset.attractPoint ?? { x: 0.5, y: 0.5 },
    windAngle: preset.windAngle ?? 0,
    windStrength: preset.windStrength ?? 0.0,
    speed: preset.speed ?? 1.0,
    boundaryMode: preset.boundaryMode ?? "bounce",
    boundaryBounce: preset.boundaryBounce ?? 0.4,
    accumulationRate: preset.accumulationRate ?? 0.3,
    accumulationTime: preset.accumulationTime ?? 2.0,
    decayRate: preset.decayRate ?? 0.1,
    color: preset.color ?? "#ffffff",
    brightness: preset.brightness ?? 1.0,

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
    showMask: false,
    
    // flow paths
    flowPaths: [],
    
    // Defaults for fields not in all presets
    attractFalloff: 1.0,
    attractionPoints: [],
    massJitter: 0,
    pointSize: DEFAULT_POINT_SIZE,
    pointSizeMin: 0,
    pointSizeMax: 0,
    sizeJitter: 0,
    brightnessJitter: 0,
    dither: 0,
    trailLength: 0,
    colorJitter: 0,
    colorMode: "single",
    colorSecondary: undefined,
    colorTertiary: undefined,
    colorScheme: undefined,
    colorRangeStart: undefined,
    colorRangeEnd: undefined,
    
    // === MATERIAL SYSTEM ===
    depthEnabled: false,
    depthFromMask: true,
    depthBlur: 3,
    depthCurve: 1.0,
    depthInvert: false,
    depthScale: 0.5,

    groundPlaneEnabled: false,
    groundPlaneTilt: 30,
    groundPlaneY: 0.8,

    surfaceFieldsEnabled: false,
    smearFieldEnabled: false,
    smearDecayRate: 0.3,
    rippleFieldEnabled: false,
    rippleDamping: 0.05,
    rippleSpeed: 1.0,
    dentFieldEnabled: false,
    dentRecoveryRate: 0.02,

    materialMode: "binary",
    materialPalette: [...defaultMaterialPresets],

    glyphPalette: [{ shape: DEFAULT_SHAPE, weight: 1.0 }] as GlyphPaletteEntry[],
    glyphRotationJitter: 0,
    glyphScaleJitter: 0
  };
};

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
  toggleHotkeys: () => void;
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
  duplicateLayer: (id: string) => void;
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
    backgroundFade: 0.08, // DEPRECATED, use clearRate
    clearRate: 1.0, // Default: full clear each frame (opposite of backgroundFade behavior)
    monochrome: false,
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
    showWelcome: true, // Show welcome popup on first load
    
    // Hotkey Overlay
    showHotkeys: false
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

  duplicateLayer: (id: string) => {
    const layer = get().layers.find((l) => l.id === id);
    if (!layer) return;
    const newLayer = { 
      ...layer, 
      id: uid(), 
      name: `${layer.name} Copy` 
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
    set({ walletConnected: false, walletAddress: null, walletBalance: 0 }),
    
  toggleHotkeys: () => set((s) => ({ global: { ...s.global, showHotkeys: !s.global.showHotkeys } }))
}));

// initialize selected layer id on first import
const st = useStudioStore.getState();
if (!st.selectedLayerId) {
  useStudioStore.setState({ selectedLayerId: st.layers[0]?.id ?? "" });
}
