#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 o_pos; // RG = pos, BA = vel
// pos/vel stored in one RGBA32F for simplicity

uniform sampler2D u_state;
uniform sampler2D u_mask; // optional, if not bound -> 1x1 white
uniform sampler2D u_eraseMask; // erase overlay texture
uniform float u_hasEraseMask;
uniform sampler2D u_flowTex; // flow direction texture for directed flow layers
uniform float u_hasFlowTex;
uniform vec2 u_stateSize;
uniform float u_dt;
uniform float u_time;

uniform int u_type; // 0 sand,1 dust,2 sparks,3 ink

uniform float u_gravity;
uniform float u_drag;
uniform float u_jitter;
uniform float u_curl;
// uniform float u_attract; // REMOVED standard attraction
// uniform float u_attractFalloff; // REMOVED standard attraction
// uniform vec2  u_attractPoint; // REMOVED standard attraction

// Multiple attraction points system
#define MAX_ATTRACTION_POINTS 8
#define TWO_PI 6.28318530718
uniform int u_attractionPointCount;
uniform vec2 u_attractionPositions[MAX_ATTRACTION_POINTS];
uniform float u_attractionStrengths[MAX_ATTRACTION_POINTS];
uniform float u_attractionFalloffs[MAX_ATTRACTION_POINTS];
uniform int u_attractionTypes[MAX_ATTRACTION_POINTS]; // 0=direct, 1=spiral, 2=blackhole, 3=pulsing, 4=magnetic
uniform int u_attractionEffects[MAX_ATTRACTION_POINTS]; // 0=none, 1=despawn, 2=orbit, 3=concentrate, 4=transform, 5=passToNext
uniform float u_attractionPulseFreqs[MAX_ATTRACTION_POINTS];
uniform int u_attractionEnabled[MAX_ATTRACTION_POINTS];

uniform float u_windAngle; // radians
uniform float u_windStrength;

uniform float u_spawnRate;
uniform float u_maskThreshold;
uniform float u_maskInvert;
uniform int u_boundaryMode; // 0 respawn, 1 bounce, 2 wrap
uniform float u_boundaryBounce; // 0..1
uniform float u_speed; // velocity scale
uniform float u_spawnSpeed; // initial velocity scale

// Mask transform uniforms
uniform vec2 u_maskPan;      // x, y offset (-1 to 1)
uniform float u_maskScale;   // scale (0.1 to 3)
uniform float u_maskRotation;// rotation in radians
uniform vec2 u_maskSkew;     // skew X, skew Y (in tan of angle)

// Mask mode and physics uniforms
uniform int u_maskMode;      // 0=ignore, 1=visibility, 2=collision, 3=accumulate
uniform float u_stickiness;  // 0-1, how much particles stick on collision
uniform float u_magnetism;   // -1 to 1, attract/repel near mask edges
uniform float u_magnetismRadius; // 0-1, distance of magnetic effect

// Lifecycle uniforms
uniform float u_accumulationRate;  // 0-1, how quickly particles slow down on contact
uniform float u_accumulationTime;  // seconds before decay starts
uniform float u_decayRate;         // 0-1, how quickly particles fade after accumulation

// ============ MATERIAL SYSTEM UNIFORMS ============
uniform sampler2D u_depthTex;      // Depth/height field (R16F)
uniform float u_hasDepthTex;       // 0 or 1
uniform float u_depthScale;        // Height multiplier

uniform int u_materialMode;        // 0=binary, 1=palette, 2=rgbParams
uniform sampler2D u_materialTex;   // Material map (RGBA8) - same as mask for palette/rgb modes

// Material response for palette mode (up to 4 presets)
uniform vec4 u_matDeflectStick;    // x,y,z,w = deflect for materials 0,1,2,3
uniform vec4 u_matPassFragment;    // x,y,z,w = passThrough for materials 0,1,2,3
uniform vec4 u_matDepositSmear;    // x,y,z,w = depositSmear for materials 0,1,2,3
uniform vec4 u_matDepositRipple;   // x,y,z,w = depositRipple for materials 0,1,2,3
uniform vec4 u_matColors[4];       // Palette colors for material ID lookup

// Ground plane uniforms
uniform float u_groundPlaneEnabled;
uniform float u_groundY;           // Y position (0-1)
uniform float u_groundTilt;        // Tilt angle in radians
uniform mat3 u_groundUVMatrix;     // Perspective warp for ripples

// ============ SPAWN REGION UNIFORMS ============
uniform int u_spawnRegion;         // 0=random, 1=topEdge, 2=bottomEdge, 3=leftEdge, 4=rightEdge, 
                                   // 5=offCanvasTop, 6=offCanvasBottom, 7=offCanvasLeft, 8=offCanvasRight,
                                   // 9=center, 10=centerBurst, 11=mask, 12=maskEdge, 13=custom
uniform float u_spawnEdgeOffset;   // How far off-canvas to spawn (0-0.5)
uniform float u_spawnEdgeSpread;   // Spread along edge (0-1)
uniform vec2 u_spawnCenterPoint;   // Center point for center/orbit spawns
uniform float u_spawnBurstSpeed;   // Initial outward velocity for burst
uniform sampler2D u_spawnMask;     // Custom spawn region mask
uniform float u_hasSpawnMask;      // 0 or 1

// ============ MOVEMENT PATTERN UNIFORMS ============
uniform int u_movementPattern;     // 0=still, 1=linear, 2=spiral, 3=orbit, 4=radialOut, 5=radialIn,
                                   // 6=wave, 7=figure8, 8=brownian, 9=followCurl, 10=vortex
uniform float u_patternDirection;  // Direction for linear (radians)
uniform float u_patternSpeed;      // Base intrinsic speed
uniform vec2 u_patternCenter;      // Center for orbital/radial patterns
uniform float u_spiralTightness;   // How quickly spiral tightens
uniform float u_orbitRadius;       // Base orbit radius
uniform float u_orbitEccentricity; // Orbit shape (0=circle, 1=ellipse)
uniform float u_waveAmplitude;     // Wave height
uniform float u_waveFrequency;     // Wave cycles
uniform float u_waveDirection;     // Direction wave travels (radians)
uniform float u_vortexStrength;    // Rotational pull
uniform float u_vortexInward;      // Inward pull

// Surface field deposit output (written to separate texture)
// Note: In WebGL2 we can't write to multiple targets easily in simulation,
// so we'll compute deposits during simulation and store in particle state

// ============ MATERIAL RESPONSE STRUCT ============
struct MaterialResponse {
  float deflect;       // 0-1, hard surface bounce
  float stick;         // 0-1, gel/tar cling
  float passThrough;   // 0-1, gas/porous
  float fragment;      // 0-1, spawn debris
  float depositSmear;  // 0-1, wetness/stain field
  float depositRipple; // 0-1, liquid membrane
  float depositDent;   // 0-1, snow compression
  float glow;          // 0-1, energy emission
};

// Sample depth at position
float sampleDepth(vec2 pos) {
  if(u_hasDepthTex < 0.5) return 0.0;
  return texture(u_depthTex, pos).r * u_depthScale;
}

// Get depth gradient (surface normal in 2D)
vec2 getDepthGradient(vec2 pos) {
  if(u_hasDepthTex < 0.5) return vec2(0.0);
  float eps = 0.01;
  float dL = sampleDepth(pos - vec2(eps, 0.0));
  float dR = sampleDepth(pos + vec2(eps, 0.0));
  float dU = sampleDepth(pos - vec2(0.0, eps));
  float dD = sampleDepth(pos + vec2(0.0, eps));
  return vec2(dR - dL, dD - dU) / (2.0 * eps);
}

// Quantize color to palette index (nearest neighbor in RGB space)
int quantizeToPalette(vec3 color) {
  float minDist = 999.0;
  int bestIdx = 0;
  for(int i = 0; i < 4; i++) {
    float dist = length(color - u_matColors[i].rgb);
    if(dist < minDist) {
      minDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// Get material response based on mode
MaterialResponse getMaterialResponse(vec2 pos) {
  MaterialResponse r;
  r.deflect = 0.5;
  r.stick = 0.0;
  r.passThrough = 0.0;
  r.fragment = 0.0;
  r.depositSmear = 0.0;
  r.depositRipple = 0.0;
  r.depositDent = 0.0;
  r.glow = 0.0;
  
  if(u_materialMode == 0) {
    // Binary mode - use mask mode settings
    r.deflect = 0.5;
    r.stick = u_stickiness;
    return r;
  }
  
  vec4 matSample = texture(u_materialTex, pos);
  
  if(u_materialMode == 1) {
    // Palette mode - quantize to nearest preset
    int idx = quantizeToPalette(matSample.rgb);
    r.deflect = idx == 0 ? u_matDeflectStick.x : idx == 1 ? u_matDeflectStick.y : idx == 2 ? u_matDeflectStick.z : u_matDeflectStick.w;
    r.stick = idx == 0 ? u_matPassFragment.x : idx == 1 ? u_matPassFragment.y : idx == 2 ? u_matPassFragment.z : u_matPassFragment.w;
    r.depositSmear = idx == 0 ? u_matDepositSmear.x : idx == 1 ? u_matDepositSmear.y : idx == 2 ? u_matDepositSmear.z : u_matDepositSmear.w;
    r.depositRipple = idx == 0 ? u_matDepositRipple.x : idx == 1 ? u_matDepositRipple.y : idx == 2 ? u_matDepositRipple.z : u_matDepositRipple.w;
  } else if(u_materialMode == 2) {
    // RGB params mode - channels directly control response
    r.stick = matSample.r;
    r.depositRipple = matSample.g;
    r.passThrough = matSample.b;
    float strength = dot(matSample.rgb, vec3(0.333));
    r.deflect = 1.0 - r.passThrough;
    r.depositSmear = strength * 0.5;
  }
  
  return r;
}

// Detect border crossing (impact event)
bool detectBorderCrossing(vec2 posPrev, vec2 posNow, float maskPrev, float maskNow) {
  // Check if we crossed from outside to inside mask (or vice versa)
  bool wasOutside = maskPrev < u_maskThreshold;
  bool isOutside = maskNow < u_maskThreshold;
  return wasOutside != isOutside;
}

// Helper: Check if a mask value is "inside" the boundary with small tolerance
// to reduce grid artifacts from pure binary thresholding
bool isInsideMask(float maskValue, vec2 pos) {
  // Add tiny spatial dither to break up grid patterns
  float dither = (fract(sin(dot(pos.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.001;
  return maskValue >= (u_maskThreshold + dither);
}

bool isOutsideMask(float maskValue, vec2 pos) {
  float dither = (fract(sin(dot(pos.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.001;
  return maskValue < (u_maskThreshold + dither);
}

// ImpactMetrics struct definition (calculateImpact function defined after maskGradient)
struct ImpactMetrics {
  float energy;        // Speed * mass
  vec2 normal;         // Surface normal at impact
  vec2 tangent;        // Tangential direction (for smear)
  float angle;         // Impact angle (0 = perpendicular, 1 = grazing)
};

// ============ TYPE-SPECIFIC PHYSICAL PROPERTIES ============
// These are intrinsic to each particle type and modify how parameters affect them
struct TypeProps {
  float mass;           // affects gravity, wind resistance, inertia (higher = heavier)
  float airResistance;  // how much drag affects this type (higher = more affected by drag)
  float windResponse;   // how much wind affects this type (lower for heavy particles)
  float attractResponse;// how quickly it responds to attraction (lower = sluggish)
  float curlResponse;   // how much flow field affects it
  float jitterScale;    // inherent jitter multiplier
  float cling;          // velocity damping near boundaries (stickiness)
  float buoyancy;       // upward force that counters gravity
};

TypeProps getTypeProps(int t){
  TypeProps p;
  if(t == 0){ // SAND - heavy, dense, falls fast, resists wind
    p.mass = 2.5;
    p.airResistance = 0.3;
    p.windResponse = 0.2;
    p.attractResponse = 0.4;
    p.curlResponse = 0.15;
    p.jitterScale = 0.3;
    p.cling = 0.7;        // sticks to surfaces
    p.buoyancy = 0.0;
  } else if(t == 1){ // DUST - very light, floats, blown by wind
    p.mass = 0.15;
    p.airResistance = 2.0;
    p.windResponse = 3.0;
    p.attractResponse = 1.5;
    p.curlResponse = 1.8;
    p.jitterScale = 0.6;
    p.cling = 0.1;
    p.buoyancy = 0.8;     // floats in air
  } else if(t == 2){ // SPARKS - light but fast, erratic
    p.mass = 0.4;
    p.airResistance = 1.2;
    p.windResponse = 1.0;
    p.attractResponse = 0.8;
    p.curlResponse = 0.5;
    p.jitterScale = 2.5;  // very erratic
    p.cling = 0.0;        // doesn't stick
    p.buoyancy = 1.5;     // rises naturally
  } else if(t == 3){ // INK - medium weight, flows smoothly
    p.mass = 1.0;
    p.airResistance = 0.8;
    p.windResponse = 0.6;
    p.attractResponse = 1.2;
    p.curlResponse = 2.5; // follows flow strongly
    p.jitterScale = 0.2;  // smooth
    p.cling = 0.4;
    p.buoyancy = 0.2;
  } else if(t == 4){ // CRUMBS - variable size, breaks on collision
    p.mass = 1.8;         // moderately heavy
    p.airResistance = 0.5;
    p.windResponse = 0.3;
    p.attractResponse = 0.5;
    p.curlResponse = 0.2;
    p.jitterScale = 0.4;
    p.cling = 0.6;        // sticks somewhat
    p.buoyancy = 0.0;
  } else { // LIQUID (t == 5) - droplets with cohesion
    p.mass = 1.2;
    p.airResistance = 0.6;
    p.windResponse = 0.4;
    p.attractResponse = 1.0;
    p.curlResponse = 0.8;
    p.jitterScale = 0.15; // smooth
    p.cling = 0.3;
    p.buoyancy = 0.1;
  }
  return p;
}

uint hash1(uvec2 p){
  p = 1103515245U*((p>>1U) ^ (p.yx));
  uint h = 1103515245U*((p.x) ^ (p.y>>3U));
  return h;
}
float rand(in vec2 x){
  uvec2 p = uvec2(floatBitsToUint(x.x), floatBitsToUint(x.y));
  // Map to range [0.001, 0.999] to avoid pure black/white values
  // This prevents noise artifacts at mask thresholds
  float raw = float(hash1(p)) / 4294967295.0;
  return 0.001 + raw * 0.998;
}

vec2 rot(vec2 p, float a){
  float c=cos(a), s=sin(a);
  return mat2(c,-s,s,c)*p;
}

// cheap curl-ish field (not true curl noise, but gives the "swirl scribble" look)
vec2 curlFlow(vec2 p, float t){
  float a = sin(p.x*6.2831 + t*0.7) + cos(p.y*6.2831 - t*0.5);
  vec2 q = rot(p-0.5, a);
  return vec2(
    sin((q.y + t*0.35)*12.0),
    cos((q.x - t*0.30)*12.0)
  );
}

// Sample directed flow from texture (RG = direction, B = strength, A = path progress)
// Alpha: 255 = spawn zone, 128 = mid-path, 0 = decay zone
vec2 sampleDirectedFlow(vec2 p){
  if(u_hasFlowTex < 0.5) return vec2(0.0);
  vec4 f = texture(u_flowTex, vec2(p.x, 1.0 - p.y));
  // Decode direction from RG (stored as 0.5 + dir * 0.5)
  vec2 dir = (f.rg - 0.5) * 2.0;
  float strength = f.b;
  return dir * strength;
}

// Get flow info for spawn/decay decisions
// Returns: x = strength, y = path progress (1 = spawn, 0 = decay)
vec2 getFlowInfo(vec2 p){
  if(u_hasFlowTex < 0.5) return vec2(0.0, 0.5);
  vec4 f = texture(u_flowTex, vec2(p.x, 1.0 - p.y));
  return vec2(f.b, f.a); // strength, path progress
}

// Check if position is in a spawn zone
bool isSpawnZone(vec2 p){
  if(u_hasFlowTex < 0.5) return false;
  vec4 f = texture(u_flowTex, vec2(p.x, 1.0 - p.y));
  return f.a > 0.9 && f.b > 0.1; // high alpha AND has flow
}

// Check if position is in a decay zone
bool isDecayZone(vec2 p){
  if(u_hasFlowTex < 0.5) return false;
  vec4 f = texture(u_flowTex, vec2(p.x, 1.0 - p.y));
  return f.a < 0.2 && f.b > 0.1; // low alpha AND has flow
}

// Combined flow function
vec2 flow(vec2 p, float t){
  // Check for directed flow first
  vec2 directed = sampleDirectedFlow(p);
  float directedStrength = length(directed);
  
  // Blend between curl noise and directed flow
  vec2 curl = curlFlow(p, t);
  
  if(directedStrength > 0.01){
    // Use directed flow STRONGLY where available - this is the main driver
    // Multiply by 10 to make particles follow paths much more closely
    return mix(curl * 0.2, directed * 10.0, min(directedStrength * 4.0, 1.0));
  }
  return curl;
}

// Apply inverse mask transform to get UV coordinates in mask space
vec2 transformMaskUV(vec2 uv){
  // Center at 0.5, 0.5
  vec2 p = uv - 0.5;
  
  // Apply inverse skew
  p = vec2(p.x - p.y * u_maskSkew.x, p.y - p.x * u_maskSkew.y);
  
  // Apply inverse rotation
  float c = cos(-u_maskRotation), s = sin(-u_maskRotation);
  p = vec2(c*p.x - s*p.y, s*p.x + c*p.y);
  
  // Apply inverse scale
  p /= max(u_maskScale, 0.01);
  
  // Apply inverse pan
  p -= u_maskPan * 0.5;
  
  // Move back to 0-1 range
  return p + 0.5;
}

float maskSampleRaw(vec2 uv){
  // Apply mask transform
  vec2 transformedUv = transformMaskUV(uv);
  
  // Flip Y to match image coordinates (image Y=0 is top, particle Y=0 is bottom)
  vec2 maskUv = vec2(transformedUv.x, 1.0 - transformedUv.y);
  
  // Return white (outside) if UV is out of bounds after transform
  if(maskUv.x < 0.0 || maskUv.x > 1.0 || maskUv.y < 0.0 || maskUv.y > 1.0){
    return u_maskInvert > 0.5 ? 0.0 : 1.0;
  }
  
  vec4 m = texture(u_mask, maskUv);
  float v = m.r; // assume grayscale
  if(u_maskInvert > 0.5) v = 1.0 - v;
  
  // Apply erase mask (white areas in erase mask = erased = outside boundary)
  if(u_hasEraseMask > 0.5){
    // Sample erase mask at original (non-transformed) UV for easier painting
    vec2 eraseUv = vec2(uv.x, 1.0 - uv.y);
    float erase = texture(u_eraseMask, eraseUv).r;
    // Erased areas should be treated as "outside" (white in non-inverted, black in inverted)
    if(erase > 0.5){
      v = u_maskInvert > 0.5 ? 0.0 : 1.0;
    }
  }
  
  return v;
}

float maskSample(vec2 uv){
  return maskSampleRaw(clamp(uv, 0.0, 1.0));
}

// Compute gradient of mask to get surface normal
vec2 maskGradient(vec2 uv){
  float eps = 0.005; // sample distance
  float dx = maskSampleRaw(uv + vec2(eps, 0.0)) - maskSampleRaw(uv - vec2(eps, 0.0));
  float dy = maskSampleRaw(uv + vec2(0.0, eps)) - maskSampleRaw(uv - vec2(0.0, eps));
  return vec2(dx, dy);
}

// Calculate impact metrics (must be after maskGradient definition)
ImpactMetrics calculateImpact(vec2 pos, vec2 vel, float mass) {
  ImpactMetrics im;
  im.energy = length(vel) * mass;
  
  // Get surface normal from mask gradient or depth gradient
  vec2 maskGrad = maskGradient(pos);
  vec2 depthGrad = getDepthGradient(pos);
  vec2 combinedGrad = maskGrad + depthGrad * 2.0;
  
  if(length(combinedGrad) > 0.001) {
    im.normal = normalize(combinedGrad);
  } else {
    im.normal = vec2(0.0, 1.0);
  }
  
  // Tangent is perpendicular to normal
  im.tangent = vec2(-im.normal.y, im.normal.x);
  
  // Project velocity onto tangent to get smear direction
  if(length(vel) > 0.001) {
    float tangentDot = dot(normalize(vel), im.tangent);
    im.tangent *= sign(tangentDot);
  }
  
  // Impact angle: 0 = head-on, 1 = grazing
  if(length(vel) > 0.001) {
    im.angle = abs(dot(normalize(vel), im.tangent));
  } else {
    im.angle = 0.0;
  }
  
  return im;
}

// Spawn position based on region type
vec2 pickSpawnByRegion(vec2 seed, int region) {
  float spread = u_spawnEdgeSpread;
  float offset = u_spawnEdgeOffset;
  
  if(region == 0) {
    // Random - original behavior
    return fract(seed);
  }
  else if(region == 1) {
    // Top edge - spawn along top, inside canvas
    return vec2(seed.x * spread + (1.0 - spread) * 0.5, 1.0 - 0.01);
  }
  else if(region == 2) {
    // Bottom edge - spawn along bottom, inside canvas  
    return vec2(seed.x * spread + (1.0 - spread) * 0.5, 0.01);
  }
  else if(region == 3) {
    // Left edge - spawn along left, inside canvas
    return vec2(0.01, seed.y * spread + (1.0 - spread) * 0.5);
  }
  else if(region == 4) {
    // Right edge - spawn along right, inside canvas
    return vec2(0.99, seed.y * spread + (1.0 - spread) * 0.5);
  }
  else if(region == 5) {
    // Off canvas top - spawn ABOVE canvas (y > 1)
    return vec2(seed.x * spread + (1.0 - spread) * 0.5, 1.0 + offset);
  }
  else if(region == 6) {
    // Off canvas bottom - spawn BELOW canvas (y < 0)
    return vec2(seed.x * spread + (1.0 - spread) * 0.5, -offset);
  }
  else if(region == 7) {
    // Off canvas left - spawn LEFT of canvas (x < 0)
    return vec2(-offset, seed.y * spread + (1.0 - spread) * 0.5);
  }
  else if(region == 8) {
    // Off canvas right - spawn RIGHT of canvas (x > 1)
    return vec2(1.0 + offset, seed.y * spread + (1.0 - spread) * 0.5);
  }
  else if(region == 9) {
    // Center - spawn at center point with small random offset
    return u_spawnCenterPoint + (seed - 0.5) * 0.05;
  }
  else if(region == 10) {
    // Center burst - spawn at center, velocity is set separately
    return u_spawnCenterPoint;
  }
  else if(region == 11) {
    // Mask - spawn only where mask is valid (search for valid spot)
    vec2 uv = fract(seed);
    for(int i = 0; i < 24; i++) {
      float v = maskSample(uv);
      if(isInsideMask(v, uv)) return uv;
      uv = fract(uv * 1.37 + vec2(0.123, 0.456) + float(i) * 0.071);
    }
    return uv;
  }
  else if(region == 12) {
    // Mask edge - spawn along mask boundary
    vec2 uv = fract(seed);
    for(int i = 0; i < 24; i++) {
      float v = maskSample(uv);
      vec2 grad = maskGradient(uv);
      float gradLen = length(grad);
      // Look for edge: near threshold with gradient
      if(abs(v - u_maskThreshold) < 0.1 && gradLen > 0.01) return uv;
      uv = fract(uv * 1.37 + vec2(0.123, 0.456) + float(i) * 0.071);
    }
    return uv;
  }
  else if(region == 13) {
    // Custom spawn mask
    if(u_hasSpawnMask > 0.5) {
      vec2 uv = fract(seed);
      for(int i = 0; i < 24; i++) {
        float spawnVal = texture(u_spawnMask, uv).r;
        if(spawnVal > 0.5) return uv;
        uv = fract(uv * 1.37 + vec2(0.123, 0.456) + float(i) * 0.071);
      }
    }
    return fract(seed);
  }
  
  return fract(seed);
}

vec2 pickSpawn(vec2 seed){
  vec2 uv = fract(seed);
  
  // For layers with flow textures, try to spawn in spawn zones first
  if(u_hasFlowTex > 0.5){
    // Search for a spawn zone
    for(int i=0; i<24; i++){
      vec2 testUv = fract(uv + vec2(float(i) * 0.0731, float(i) * 0.0917));
      if(isSpawnZone(testUv)){
        // Also check mask
        float v = maskSample(testUv);
        if(isInsideMask(v, testUv)) return testUv;
      }
      uv = fract(uv*1.37 + vec2(0.123, 0.456) + float(i)*0.071);
    }
    // Fallback: try to find any point with flow
    for(int i=0; i<12; i++){
      vec2 testUv = fract(seed * 1.5 + vec2(float(i) * 0.13, float(i) * 0.17));
      vec2 flowInfo = getFlowInfo(testUv);
      if(flowInfo.x > 0.1){ // has flow
        float v = maskSample(testUv);
        if(isInsideMask(v, testUv)) return testUv;
      }
    }
  }
  
  // Use spawn region system
  vec2 spawnPos = pickSpawnByRegion(seed, u_spawnRegion);
  
  // For regions that aren't off-canvas, validate against mask if not mask-specific region
  if(u_spawnRegion < 5 || u_spawnRegion > 8) {
    if(u_spawnRegion != 11 && u_spawnRegion != 12 && u_spawnRegion != 13) {
      // Check mask for non-mask-specific, non-off-canvas spawns
      vec2 clampedSpawn = clamp(spawnPos, 0.0, 1.0);
      float v = maskSample(clampedSpawn);
      if(isOutsideMask(v, clampedSpawn)) {
        // Fall back to random spawn within mask
        uv = fract(seed);
        for(int i = 0; i < 12; i++) {
          v = maskSample(uv);
          if(isInsideMask(v, uv)) return uv;
          uv = fract(uv * 1.37 + vec2(0.123, 0.456) + float(i) * 0.071);
        }
      }
    }
  }
  
  return spawnPos;
}

// Reflect velocity off a surface normal
vec2 reflect2D(vec2 v, vec2 n){
  return v - 2.0 * dot(v, n) * n;
}

// ============ MOVEMENT PATTERN SYSTEM ============
// Calculate intrinsic movement based on pattern type
vec2 patternMovement(vec2 pos, float seed, float time) {
  if(u_movementPattern == 0) {
    // Still - no intrinsic movement
    return vec2(0.0);
  }
  else if(u_movementPattern == 1) {
    // Linear - move in specified direction
    return vec2(cos(u_patternDirection), sin(u_patternDirection)) * u_patternSpeed;
  }
  else if(u_movementPattern == 2) {
    // Spiral - rotate around center while moving inward/outward
    vec2 toCenter = u_patternCenter - pos;
    float dist = length(toCenter);
    if(dist < 0.001) return vec2(0.0);
    vec2 radial = normalize(toCenter);
    vec2 tangent = vec2(-radial.y, radial.x);
    // Combine tangential (rotation) with radial (spiral in/out)
    return tangent * u_patternSpeed + radial * u_spiralTightness * u_patternSpeed;
  }
  else if(u_movementPattern == 3) {
    // Orbit - circular motion around center
    vec2 toCenter = u_patternCenter - pos;
    float dist = length(toCenter);
    if(dist < 0.001) return vec2(0.0);
    vec2 radial = normalize(toCenter);
    vec2 tangent = vec2(-radial.y, radial.x);
    // Pull toward orbit radius + tangential motion
    float radiusDiff = u_orbitRadius - dist;
    return tangent * u_patternSpeed + radial * radiusDiff * 2.0;
  }
  else if(u_movementPattern == 4) {
    // Radial out - expand from center
    vec2 fromCenter = pos - u_patternCenter;
    float dist = length(fromCenter);
    if(dist < 0.001) return vec2(seed - 0.5, seed * 0.7 - 0.35) * u_patternSpeed;
    return normalize(fromCenter) * u_patternSpeed;
  }
  else if(u_movementPattern == 5) {
    // Radial in - contract toward center
    vec2 toCenter = u_patternCenter - pos;
    float dist = length(toCenter);
    if(dist < 0.001) return vec2(0.0);
    return normalize(toCenter) * u_patternSpeed;
  }
  else if(u_movementPattern == 6) {
    // Wave - sinusoidal motion
    vec2 waveDir = vec2(cos(u_waveDirection), sin(u_waveDirection));
    vec2 perpDir = vec2(-waveDir.y, waveDir.x);
    float phase = dot(pos, waveDir) * u_waveFrequency * 6.28318 + time;
    float offset = sin(phase) * u_waveAmplitude;
    return waveDir * u_patternSpeed + perpDir * cos(phase) * u_waveAmplitude * u_patternSpeed * 3.0;
  }
  else if(u_movementPattern == 7) {
    // Figure 8 - lemniscate pattern
    vec2 toCenter = pos - u_patternCenter;
    float t = time * u_patternSpeed * 2.0 + seed * 6.28318;
    float scale = u_orbitRadius;
    vec2 target = u_patternCenter + vec2(
      scale * cos(t),
      scale * sin(t) * cos(t)
    );
    return (target - pos) * u_patternSpeed * 5.0;
  }
  else if(u_movementPattern == 8) {
    // Brownian - random walk
    float angle = rand(pos + time * 0.1) * 6.28318;
    return vec2(cos(angle), sin(angle)) * u_patternSpeed * (0.5 + rand(pos.yx + time) * 0.5);
  }
  else if(u_movementPattern == 9) {
    // Follow curl - use existing curl flow system (handled separately)
    return vec2(0.0); // Curl is applied via u_curl uniform
  }
  else if(u_movementPattern == 10) {
    // Vortex - spiral drain effect
    vec2 toCenter = u_patternCenter - pos;
    float dist = length(toCenter);
    if(dist < 0.001) return vec2(0.0);
    vec2 radial = normalize(toCenter);
    vec2 tangent = vec2(-radial.y, radial.x);
    // Strong rotation + inward pull that increases near center
    float inwardPull = u_vortexInward / max(dist, 0.1);
    return tangent * u_vortexStrength * u_patternSpeed + radial * inwardPull * u_patternSpeed;
  }
  
  return vec2(0.0);
}

// Get initial spawn velocity based on region and pattern
vec2 getSpawnVelocity(vec2 pos, vec2 seed, int region) {
  vec2 baseVel = vec2(0.0);
  
  // Region-specific initial velocities
  if(region == 5) {
    // Off canvas top - falling down
    baseVel = vec2((seed.x - 0.5) * 0.02, -0.05);
  }
  else if(region == 6) {
    // Off canvas bottom - rising up
    baseVel = vec2((seed.x - 0.5) * 0.02, 0.05);
  }
  else if(region == 7) {
    // Off canvas left - moving right
    baseVel = vec2(0.05, (seed.y - 0.5) * 0.02);
  }
  else if(region == 8) {
    // Off canvas right - moving left
    baseVel = vec2(-0.05, (seed.y - 0.5) * 0.02);
  }
  else if(region == 10) {
    // Center burst - radial outward
    vec2 dir = normalize(seed - 0.5 + vec2(0.001));
    baseVel = dir * u_spawnBurstSpeed;
  }
  else {
    // Default: small random velocity
    baseVel = (seed - 0.5) * 0.01;
  }
  
  return baseVel;
}

// Calculate attraction force from multiple attraction points
vec2 calculateMultiPointAttraction(vec2 pos, TypeProps tp, float time) {
  vec2 totalForce = vec2(0.0);
  
  for(int i = 0; i < u_attractionPointCount; i++) {
    if(u_attractionEnabled[i] == 0) continue;
    
    vec2 toPoint = u_attractionPositions[i] - pos;
    float dist = length(toPoint);
    float distSafe = max(dist, 0.02);
    vec2 direction = toPoint / distSafe;
    
    // Calculate base falloff
    float falloff = 1.0 / max(0.01, pow(distSafe, u_attractionFalloffs[i]));
    falloff = min(falloff, 10.0);
    
    float strength = u_attractionStrengths[i];
    int type = u_attractionTypes[i];
    
    // Apply type-specific behavior
    if(type == 1) {
      // Spiral - add tangential component
      vec2 tangent = vec2(-direction.y, direction.x);
      float spiralStrength = strength * falloff * 0.3;
      direction = normalize(direction + tangent * 0.5);
      strength = strength * 1.2; // boost to compensate for spiral
    }
    else if(type == 2) {
      // Blackhole - stronger inverse square
      falloff = 1.0 / max(0.01, distSafe * distSafe);
      falloff = min(falloff, 20.0);
      strength = strength * 1.5; // stronger pull
    }
    else if(type == 3) {
      // Pulsing - oscillate strength
      float pulse = sin(time * u_attractionPulseFreqs[i] * TWO_PI) * 0.5 + 0.5;
      strength = strength * (0.3 + pulse * 0.7);
    }
    else if(type == 4) {
      // Magnetic - field lines (perpendicular forces)
      vec2 tangent = vec2(-direction.y, direction.x);
      float magneticAngle = atan(toPoint.y, toPoint.x);
      float fieldStrength = sin(magneticAngle * 4.0) * 0.3;
      direction = normalize(direction + tangent * fieldStrength);
    }
    // type == 0 (direct) uses direction as-is
    
    vec2 pointForce = direction * strength * falloff * tp.attractResponse;
    totalForce += pointForce;
  }
  
  return totalForce;
}

void main(){
  vec4 s = texture(u_state, v_uv);
  vec2 pos = s.xy;
  vec2 vel = s.zw;

  // If uninitialized (pos==0 and vel==0), seed it
  if(pos==vec2(0.0) && vel==vec2(0.0)){
    vec2 seed = vec2(rand(v_uv + u_time), rand(v_uv.yx + u_time*1.3));
    pos = pickSpawn(seed);
    vel = getSpawnVelocity(pos, seed, u_spawnRegion);
  }

  // Store previous position for collision detection
  vec2 prevPos = pos;
  
  // Get type-specific physical properties
  TypeProps tp = getTypeProps(u_type);

  // ============ FORCE CALCULATIONS (modified by type properties) ============
  
  // Gravity: heavier particles (higher mass) fall faster
  // Buoyancy counters gravity for light particles
  // Scale by 50.0 to make the -0.5..1.0 UI range effective
  float effectiveGravity = (u_gravity * 50.0) * tp.mass - tp.buoyancy * 0.1;
  vec2 g = vec2(0.0, -effectiveGravity);
  
  // LEGACY attraction removed - use Multi-point attraction system (u_attractionPositions)
  vec2 aForce = vec2(0.0);
  
  // NEW multi-point attraction system
  vec2 multiPointForce = calculateMultiPointAttraction(pos, tp, u_time);
  aForce += multiPointForce;

  // Wind: light particles are blown more easily
  vec2 windDir = vec2(cos(u_windAngle), sin(u_windAngle));
  vec2 windForce = windDir * u_windStrength * tp.windResponse;

  // Flow field (curl noise): some types follow flow more than others
  vec2 f = flow(pos, u_time) * u_curl * tp.curlResponse;

  // Jitter: type-specific scaling
  float jt = u_jitter * tp.jitterScale;
  vec2 j = (vec2(rand(pos+u_time), rand(pos.yx-u_time)) - 0.5) * jt;

  // Depth gradient force: particles roll down slopes in the depth field
  // The gradient points uphill, so we negate it to get downhill force
  // Scale by gravity to make it feel like natural rolling (heavier particles roll faster)
  vec2 depthForce = -getDepthGradient(pos) * abs(effectiveGravity) * 5.0;

  // Ground plane slope force: particles roll down the tilted ground plane
  // Only apply when ground plane is enabled and particle is near the ground
  vec2 groundForce = vec2(0.0);
  if(u_groundPlaneEnabled > 0.5) {
    float cosT = cos(u_groundTilt);
    float sinT = sin(u_groundTilt);
    // u_groundTilt is the angle from horizontal (0° = flat, 90° = vertical wall)
    // Ground plane normal: (sinT, cosT) points upward/perpendicular to the plane
    // Downhill direction (tangent): perpendicular to normal, rotated 90° clockwise
    // From normal (sinT, cosT), tangent is (cosT, -sinT) pointing downhill
    vec2 groundDownhill = vec2(cosT, -sinT);
    // Simplified distance from particle to ground plane
    // Uses Y-distance approximation instead of true perpendicular distance for performance
    // This is acceptable because the downhill force direction is correct,
    // and the proximity calculation only needs relative distance
    float distToGround = pos.y - u_groundY;
    // Apply force proportional to distance (stronger when closer)
    // Only apply when particle is above and near the ground (within 0.3 units)
    if(distToGround > 0.0 && distToGround < 0.3) {
      float proximity = 1.0 - (distToGround / 0.3); // 1.0 at ground, 0.0 at distance 0.3
      groundForce = groundDownhill * abs(effectiveGravity) * 3.0 * proximity;
    }
  }

  // Calculate intrinsic movement from pattern system
  vec2 patternForce = patternMovement(pos, v_uv.x, u_time);

  // Integrate velocity - mass affects inertia (heavier = slower acceleration)
  float inertiaFactor = 1.0 / max(tp.mass, 0.1);
  vel += (g + aForce + windForce + f + j + depthForce + groundForce + patternForce) * u_dt * inertiaFactor;

  // ============ TYPE-SPECIFIC BEHAVIORS ============
  
  // Terminal velocity based on mass (heavier falls faster max)
  float terminalVel = 0.08 + tp.mass * 0.06;
  if(vel.y < -terminalVel) vel.y = -terminalVel;
  
  // Sparks rise and decay
  if(u_type == 2){
    vel.y += tp.buoyancy * 0.15 * u_dt;
    vel *= (1.0 - 0.4*u_dt); // sparks burn out
  }
  
  // Ink swirls
  if(u_type == 3){
    vel = rot(vel, 0.3*u_dt);
  }
  
  // Sand settles horizontally
  if(u_type == 0){
    vel.x *= (1.0 - 0.5*u_dt);
  }
  
  // Liquid cohesion, linking, and pooling behavior
  if(u_type == 5){
    // Liquid tends to pool when slow (surface tension effect)
    float slowFactor = 1.0 - clamp(length(vel) * 30.0, 0.0, 1.0);
    
    // Simulated linked particle behavior: 
    // Use position-based pseudo-neighbors to create cohesion waves
    float linkPhase = sin(pos.x * 20.0 + u_time * 3.0) * cos(pos.y * 20.0 + u_time * 2.5);
    
    // Energy transfer simulation: ripple effect propagates through "linked" mass
    vec2 ripple = vec2(
      cos(length(pos - vec2(0.5)) * 30.0 - u_time * 8.0),
      sin(length(pos - vec2(0.5)) * 30.0 - u_time * 8.0)
    ) * 0.002 * slowFactor;
    
    // Surface tension: particles at edges of pools are pulled inward
    float surfaceTension = linkPhase * 0.003 * slowFactor;
    vec2 tensionForce = normalize(vec2(0.5, 0.3) - pos) * surfaceTension;
    
    // Apply cohesion and energy transfer
    vel += (tensionForce + ripple) * u_dt;
    
    // Liquid spreads horizontally when settling (mimics pooling)
    if(slowFactor > 0.5){
      vel.x += (rand(pos + u_time * 3.0) - 0.5) * 0.015 * slowFactor;
      // Dampen vertical movement to encourage pooling
      vel.y *= 0.98;
    }
    
    // New particles joining pool cause displacement ripple (energy propagation)
    float recentSpawn = step(length(vel), 0.05) * step(0.95, rand(pos + u_time * 0.1));
    if(recentSpawn > 0.5){
      // This particle just joined - add outward push to neighbors (simulated)
      vel += normalize(pos - vec2(0.5)) * 0.01;
    }
  }
  
  // Crumbs tumble behavior
  if(u_type == 4){
    // Add rotational-like perturbation when moving
    float tumble = sin(u_time * 5.0 + v_uv.x * 10.0) * length(vel) * 0.3;
    vel = rot(vel, tumble * u_dt);
  }

  // Drag: scaled by air resistance and time step to prevent freezing
  // Improved formula: vel *= (1.0 - resistance * dt)
  float effectiveDrag = u_drag * tp.airResistance;
  // Use a scaling factor (60.0) to make the UI slider feel similar to before but without the hard clamp issues
  // The old formula was vel *= (1.0 - clamp(drag, 0, 0.95)), which is frame-rate dependent and aggressive
  float damping = clamp(effectiveDrag * u_dt * 60.0, 0.0, 0.95);
  vel *= (1.0 - damping);

  // Apply velocity
  pos += vel * (u_dt * u_speed);

  // "death" condition + respawn with lifecycle
  float die = 0.0;
  float speed = length(vel);
  
  // ======== FLOW PATH DECAY ========
  // Particles in decay zones (end of paths) should die
  if(u_hasFlowTex > 0.5){
    vec2 flowInfo = getFlowInfo(pos);
    float pathProgress = flowInfo.y; // 1 = spawn, 0 = decay
    float flowStrength = flowInfo.x;
    
    // If in a decay zone (end of path), high chance to die
    if(flowStrength > 0.05 && pathProgress < 0.15){
      float decayChance = (0.15 - pathProgress) * 2.0; // stronger decay closer to end
      if(rand(pos + u_time * 1.3) < decayChance * u_dt * 10.0){
        die = 1.0;
      }
    }
    
    // If particle drifts far from any flow path, respawn it at a spawn point
    if(flowStrength < 0.02 && rand(pos + u_time * 0.5) < 0.1 * u_dt){
      die = 1.0;
    }
  }
  
  // Accumulation phase: particles that are nearly stopped
  bool isAccumulating = speed < 0.005;
  
  // Apply accumulation rate damping when near surfaces or settled
  if(isAccumulating){
    // Further slow down based on accumulation rate
    vel *= (1.0 - u_accumulationRate * u_dt * 2.0);
    
    // Decay probability based on decayRate and accumulation time
    // Higher decayRate = faster decay after accumulation
    float decayChance = u_decayRate * u_dt * 0.5 / max(u_accumulationTime, 0.1);
    if(rand(pos + u_time * 0.7) < decayChance){
      die = 1.0;
    }
  }
  
  // Type-specific respawn logic (on top of lifecycle)
  if(u_type == 0){
    // sand "dies" if it settles at bottom
    if(pos.y < 0.01 && abs(vel.y) < 0.001 && rand(pos + u_time*0.9) < u_spawnRate) die = 1.0;
  } else if(u_type == 2){
    // sparks die when they slow down (burnt out) - faster decay
    float sparkDecay = u_decayRate * 2.0;
    if(speed < 0.003 && rand(pos + u_time) < u_spawnRate * 0.5 + sparkDecay * 0.1) die = 1.0;
  } else if(u_type == 4){
    // crumbs - break apart on impact (handled in collision)
    if(rand(pos + u_time) < u_spawnRate * 0.01) die = 1.0;
  } else if(u_type == 5){
    // liquid - slow decay, can pool
    float liquidDecay = u_decayRate * 0.2;
    if(isAccumulating && rand(pos + u_time) < liquidDecay * u_dt) die = 1.0;
  } else {
    if(rand(pos + u_time) < u_spawnRate * 0.02) die = 1.0;
  }

  // ======== MAGNETISM (applied before collision) ========
  if(u_magnetism != 0.0 && u_magnetismRadius > 0.0){
    vec2 grad = maskGradient(pos);
    float gradLen = length(grad);
    if(gradLen > 0.001){
      float maskVal = maskSample(pos);
      // Distance to edge approximation
      float distToEdge = abs(maskVal - u_maskThreshold);
      if(distToEdge < u_magnetismRadius){
        vec2 normal = normalize(grad);
        float falloff = 1.0 - distToEdge / u_magnetismRadius;
        // Magnetism: positive attracts (pull toward edge), negative repels
        vec2 magForce = normal * u_magnetism * falloff * 0.5;
        vel += magForce * u_dt;
      }
    }
  }

  // ======== BOUNDARY COLLISION WITH MATERIAL SYSTEM ========
  bool outOfBounds = pos.x < 0.0 || pos.y < 0.0 || pos.x > 1.0 || pos.y > 1.0;
  vec2 posClamped = clamp(pos, 0.001, 0.999);
  float maskVal = maskSample(posClamped);
  float prevMaskVal = maskSample(prevPos);
  bool outsideMask = isOutsideMask(maskVal, posClamped);
  
  // Mask mode: 0=ignore, 1=visibility, 2=collision, 3=accumulate
  // For ignore (0) and visibility (1), mask doesn't affect physics
  bool maskAffectsPhysics = u_maskMode >= 2;
  
  // ======== MATERIAL SYSTEM: Impact Detection ========
  bool borderCrossed = detectBorderCrossing(prevPos, pos, prevMaskVal, maskVal);
  MaterialResponse matResp = getMaterialResponse(posClamped);
  ImpactMetrics impact;
  
  if(borderCrossed && maskAffectsPhysics) {
    impact = calculateImpact(posClamped, vel, tp.mass);
    
    // Apply material-based pass-through
    if(matResp.passThrough > 0.0 && rand(v_uv + u_time) < matResp.passThrough) {
      // Particle passes through - reduce velocity slightly
      vel *= 0.9;
      outsideMask = false; // Allow passage
    }
  }
  
  // ======== GROUND PLANE COLLISION ========
  if(u_groundPlaneEnabled > 0.5) {
    float cosT = cos(u_groundTilt);
    float sinT = sin(u_groundTilt);
    vec3 groundNormal = vec3(sinT, cosT, 0.0);
    
    // Distance from ground plane
    vec3 pos3d = vec3(pos, 0.0);
    vec3 groundPoint = vec3(0.5, u_groundY, 0.0);
    float groundDist = dot(pos3d - groundPoint, groundNormal);
    
    // Previous distance
    vec3 prevPos3d = vec3(prevPos, 0.0);
    float prevGroundDist = dot(prevPos3d - groundPoint, groundNormal);
    
    if(groundDist < 0.0 && prevGroundDist >= 0.0) {
      // Ground impact!
      ImpactMetrics groundImpact = calculateImpact(pos, vel, tp.mass);
      MaterialResponse groundMat = getMaterialResponse(pos);
      
      // Bounce off ground with material deflect
      vec2 groundNormal2d = vec2(sinT, cosT);
      float groundBounce = u_boundaryBounce * groundMat.deflect;
      vel = reflect2D(vel, groundNormal2d) * groundBounce;
      
      // Apply ground stickiness
      vel *= (1.0 - groundMat.stick * 0.5);
      
      // Push back above ground
      pos = prevPos;
    }
  }
  
  if(outOfBounds || (outsideMask && maskAffectsPhysics)){
    if(u_boundaryMode == 2){
      // WRAP: teleport to other side (only for canvas edges)
      if(outOfBounds) pos = fract(pos);
      else if(outsideMask && maskAffectsPhysics){
        // For mask collisions in wrap mode, still handle collision
        if(u_maskMode == 3){
          // ACCUMULATE mode: stop and stick
          vel *= (1.0 - u_stickiness);
          if(length(vel) < 0.001) vel = vec2(0.0);
          pos = prevPos;
        } else {
          die = 1.0;
        }
      }
    } else if(u_boundaryMode == 1 || u_boundaryMode == 5 || maskAffectsPhysics){
      // BOUNCE (1), SLOWBOUNCE (5), or mask collision
      // For slowBounce, reduce bounce energy significantly
      float bounceMult = (u_boundaryMode == 5) ? 0.3 : 1.0;
      float bounceEnergy = u_boundaryBounce * bounceMult * (1.0 - tp.cling * 0.5);
      
      // Handle canvas edge bounces
      if(pos.x < 0.0){ pos.x = 0.001; vel.x = abs(vel.x) * bounceEnergy; }
      if(pos.x > 1.0){ pos.x = 0.999; vel.x = -abs(vel.x) * bounceEnergy; }
      if(pos.y < 0.0){ pos.y = 0.001; vel.y = abs(vel.y) * bounceEnergy; }
      if(pos.y > 1.0){ pos.y = 0.999; vel.y = -abs(vel.y) * bounceEnergy; }
      
      // Apply cling: particles with high cling slow down significantly on contact
      vel *= (1.0 - tp.cling * 0.3);
      
      // Handle mask boundary interactions
      if(outsideMask && !outOfBounds && maskAffectsPhysics){
        vec2 grad = maskGradient(posClamped);
        float gradLen = length(grad);
        
        if(gradLen > 0.001){
          vec2 normal = normalize(grad);
          
          if(u_maskMode == 3){
            // ACCUMULATE mode: particles stick to surface
            // Use material-based stickiness if available
            float effectiveStick = max(u_stickiness, matResp.stick);
            float dampFactor = 1.0 - effectiveStick;
            vel *= dampFactor;
            
            // If nearly stopped, freeze in place
            if(length(vel) < 0.002){
              vel = vec2(0.0);
            }
            
            // Push back to valid position
            pos = prevPos;
            
            // Slowly slide down along surface if there's gravity
            if(effectiveStick < 0.99){
              vec2 tangent = vec2(-normal.y, normal.x);
              float gravitySlide = dot(vec2(0.0, -effectiveGravity), tangent);
              vel += tangent * gravitySlide * (1.0 - effectiveStick) * 0.1 * u_dt;
            }
          } else {
            // COLLISION mode: bounce off surface with material response
            // Use material deflect to modulate bounce
            float materialDeflect = matResp.deflect;
            float stickyBounce = bounceEnergy * materialDeflect * (1.0 - matResp.stick * 0.5);
            vel = reflect2D(vel, normal) * stickyBounce;
            
            // Extra cling damping on mask collision
            vel *= (1.0 - tp.cling * 0.4);
            
            // Material stick effect
            vel *= (1.0 - matResp.stick * 0.3);
            
            // Push position back inside along normal
            pos = prevPos;
            
            // Try stepping along normal to find valid position
            for(int i = 0; i < 8; i++){
              pos += normal * 0.01;
              if(isInsideMask(maskSample(pos), pos)) break;
            }
            
            // If still outside, respawn
            if(isOutsideMask(maskSample(pos), pos)){
              die = 1.0;
            }
          }
        } else {
          // Flat gradient = we're deep inside boundary
          if(u_maskMode == 3){
            // In accumulate mode, just stop
            vel = vec2(0.0);
            pos = prevPos;
          } else {
            die = 1.0;
          }
        }
      }
      
      // Final check - if still outside valid area and in collision mode, respawn
      vec2 finalCheckPos = clamp(pos, 0.0, 1.0);
      if(maskAffectsPhysics && u_maskMode == 2 && isOutsideMask(maskSample(finalCheckPos), finalCheckPos)){
        die = 1.0;
      }
    } else if(u_boundaryMode == 3) {
      // STICK: stop at boundary
      if(pos.x < 0.0){ pos.x = 0.001; vel = vec2(0.0); }
      if(pos.x > 1.0){ pos.x = 0.999; vel = vec2(0.0); }
      if(pos.y < 0.0){ pos.y = 0.001; vel = vec2(0.0); }
      if(pos.y > 1.0){ pos.y = 0.999; vel = vec2(0.0); }
    } else {
      // RESPAWN (0) or DESTROY (4): die and respawn inside
      // Only die if moving AWAY from canvas (allows off-screen spawns to enter)
      bool leaving = false;
      if(pos.x < 0.0 && vel.x < 0.0) leaving = true;
      else if(pos.x > 1.0 && vel.x > 0.0) leaving = true;
      else if(pos.y < 0.0 && vel.y < 0.0) leaving = true;
      else if(pos.y > 1.0 && vel.y > 0.0) leaving = true;
      
      // Safety: kill if way out of bounds
      if(pos.x < -0.5 || pos.x > 1.5 || pos.y < -0.5 || pos.y > 1.5) leaving = true;
      
      if(leaving) die = 1.0;
    }
  }

  // Handle respawn
  if(die > 0.5){
    vec2 seed = vec2(rand(v_uv + u_time*2.1), rand(v_uv.yx + u_time*1.7));
    pos = pickSpawn(seed);
    
    // Get base spawn velocity from region system
    vec2 regionVel = getSpawnVelocity(pos, seed, u_spawnRegion);
    
    // Type-specific spawn velocity using physical properties
    float baseSpawnMag = 0.04 / max(tp.mass, 0.1); // lighter particles spawn faster
    vec2 typeVel;
    
    if(u_type == 0){
      // Sand: falls from above, heavy so starts slower
      typeVel = vec2((seed.x-0.5)*baseSpawnMag*0.3, -abs(seed.y)*baseSpawnMag);
    } else if(u_type == 1){
      // Dust: gentle random drift, very light
      typeVel = (seed-0.5) * baseSpawnMag * 0.5;
    } else if(u_type == 2){
      // Sparks: burst upward with energy
      typeVel = vec2((seed.x-0.5)*baseSpawnMag, abs(seed.y)*baseSpawnMag*2.0);
    } else if(u_type == 4){
      // Crumbs: similar to sand but with bounce tendency
      typeVel = vec2((seed.x-0.5)*baseSpawnMag*0.5, -abs(seed.y)*baseSpawnMag*0.8);
    } else if(u_type == 5){
      // Liquid: smooth drop with slight horizontal drift
      typeVel = vec2((seed.x-0.5)*baseSpawnMag*0.2, -abs(seed.y)*baseSpawnMag*0.6);
    } else {
      // Ink: follows flow field
      typeVel = flow(pos, u_time) * baseSpawnMag * 0.8;
    }
    
    // Blend region velocity with type velocity
    // For off-canvas spawns, region velocity dominates
    // For in-canvas spawns, blend 50/50
    float regionWeight = (u_spawnRegion >= 5 && u_spawnRegion <= 8) ? 0.8 : 0.5;
    vel = mix(typeVel, regionVel, regionWeight);
    vel *= u_spawnSpeed;
  }

  o_pos = vec4(pos, vel);
}
