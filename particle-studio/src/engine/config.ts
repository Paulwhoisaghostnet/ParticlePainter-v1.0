
// Constants extracted from ParticleEngine.ts

export const MAX_ATTRACTION_POINTS = 8;

// Attraction type and effect mappings (constant to avoid recreation)
export const ATTRACTION_TYPE_MAP: Record<string, number> = { 
  direct: 0, spiral: 1, blackhole: 2, pulsing: 3, magnetic: 4 
};

export const ATTRACTION_EFFECT_MAP: Record<string, number> = { 
  none: 0, despawn: 1, orbit: 2, concentrate: 3, transform: 4, passToNext: 5 
};

// Spawn Region Mappings
export const SPAWN_REGION_MAP: Record<string, number> = {
  random: 0, topEdge: 1, bottomEdge: 2, leftEdge: 3, rightEdge: 4,
  offCanvasTop: 5, offCanvasBottom: 6, offCanvasLeft: 7, offCanvasRight: 8,
  center: 9, centerBurst: 10, mask: 11, maskEdge: 12, custom: 13
};

// Movement Pattern Mappings
export const MOVEMENT_PATTERN_MAP: Record<string, number> = {
  still: 0, linear: 1, spiral: 2, orbit: 3, radialOut: 4, radialIn: 5,
  wave: 6, figure8: 7, brownian: 8, followCurl: 9, vortex: 10
};

// Color Mode Mappings
export const COLOR_MODE_MAP: Record<string, number> = {
  single: 0, gradient: 1, scheme: 2, range: 3
};

// Shape Mappings
export const SHAPE_MAP: Record<string, number> = {
  dot: 0, star: 1, dash: 2, tilde: 3, square: 4, diamond: 5, ring: 6, cross: 7
};

// Type Mappings
export const TYPE_MAP: Record<string, number> = {
  sand: 0, dust: 1, sparks: 2, ink: 3, crumbs: 4, liquid: 5
};

// Mask Mode Mappings
export const MASK_MODE_MAP: Record<string, number> = {
  ignore: 0, visibility: 1, collision: 2, accumulate: 3
};

// Boundary Mode Mappings
export const BOUNDARY_MODE_MAP: Record<string, number> = {
  bounce: 1, wrap: 2
};

// Material Mode Mappings
export const MATERIAL_MODE_MAP: Record<string, number> = {
  binary: 0, palette: 1, rgb: 2
};

// Helper function to convert shape string to int (used in shader)
export function shapeToInt(shape: string): number {
  return SHAPE_MAP[shape as keyof typeof SHAPE_MAP] ?? 0;
}

// Default limits
export const TEXTURE_SIDE_MIN = 50;
export const TEXTURE_SIDE_MAX = 20000;
