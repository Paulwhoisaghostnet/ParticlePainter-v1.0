#version 300 es
precision highp float;
precision highp int;

uniform sampler2D u_state;
uniform vec2 u_stateSize;
uniform vec2 u_canvasSize;
uniform float u_pointSize;
uniform float u_pointSizeMin;  // Offset from base size (negative, e.g., -3 to 0)
uniform float u_pointSizeMax;  // Offset from base size (positive, e.g., 0 to +3)
uniform float u_sizeJitter;    // 0-1, randomness in particle size
uniform float u_trailLength;
uniform int u_type;

// Glyph jitter uniforms
uniform float u_glyphRotationJitter; // 0-360 degrees
uniform float u_glyphScaleJitter;    // 0-1 variation
uniform int u_glyphCount;            // Number of shapes in palette (0 = use u_shape)
uniform vec4 u_glyphPalette;         // Shape indices (packed into vec4, up to 4 shapes)
uniform vec4 u_glyphWeights;         // Weights for each shape (normalized)

out float v_seed;
out vec2 v_velocity;
out float v_speed;
flat out float v_glyphRotation;      // Random rotation for this particle
flat out int v_glyphShape;           // Shape index for this particle

void main(){
  // gl_VertexID maps into state texture
  int idx = gl_VertexID;
  int w = int(u_stateSize.x);
  int x = idx % w;
  int y = idx / w;
  vec2 uv = (vec2(float(x), float(y)) + 0.5) / u_stateSize;

  vec4 s = texture(u_state, uv);
  vec2 p = s.xy;
  vec2 vel = s.zw;

  // map 0..1 to clip
  vec2 clip = p * 2.0 - 1.0;
  gl_Position = vec4(clip, 0.0, 1.0);

  // Calculate seed first (used for size variation)
  v_seed = fract(sin(float(idx) * 12.9898) * 43758.5453);
  float seed2 = fract(sin(float(idx) * 78.233) * 43758.5453);
  float seed3 = fract(sin(float(idx) * 43.789) * 43758.5453);

  // Pass velocity for motion-based effects
  v_velocity = vel;
  v_speed = length(vel);

  // ======== GLYPH JITTER ========
  // Compute per-particle rotation
  v_glyphRotation = (seed2 - 0.5) * 2.0 * u_glyphRotationJitter * 3.14159 / 180.0;
  
  // Select shape from palette based on weighted random
  v_glyphShape = 0; // Default shape
  if(u_glyphCount > 0) {
    float r = seed3;
    float cumWeight = 0.0;
    for(int i = 0; i < 4; i++) {
      if(i >= u_glyphCount) break;
      cumWeight += u_glyphWeights[i];
      if(r < cumWeight) {
        v_glyphShape = int(u_glyphPalette[i]);
        break;
      }
    }
  }

  // Calculate size range from base size + offsets
  float minSize = max(0.5, u_pointSize + u_pointSizeMin);
  float maxSize = u_pointSize + u_pointSizeMax;
  
  // Apply jitter within the size range
  float jitterAmount = v_seed * u_sizeJitter;
  float baseSize = mix(u_pointSize, mix(minSize, maxSize, v_seed), jitterAmount);
  
  // Apply glyph scale jitter
  float scaleJitter = 1.0 + (seed2 - 0.5) * u_glyphScaleJitter;
  baseSize *= scaleJitter;
  
  // Accumulated particles (slow/stopped) grow slightly to show piling up
  float accumulationGrowth = 1.0 + (1.0 - clamp(v_speed * 50.0, 0.0, 1.0)) * 0.3;
  baseSize *= accumulationGrowth;
  
  if(u_type == 2){ // sparks - get bigger when fast
    baseSize *= 1.0 + v_speed * 8.0;
  } else if(u_type == 4){ // crumbs - variable sizes (0.5x to 1.5x)
    float sizeVar = 0.5 + v_seed * 1.0;
    baseSize *= sizeVar;
  } else if(u_type == 5){ // liquid - slight size variation, pooled liquid bigger
    float sizeVar = 0.8 + v_seed * 0.4;
    float poolGrowth = 1.0 + (1.0 - clamp(v_speed * 30.0, 0.0, 1.0)) * 0.5;
    baseSize *= sizeVar * poolGrowth;
  }
  
  gl_PointSize = clamp(baseSize, 0.5, 32.0);
}
