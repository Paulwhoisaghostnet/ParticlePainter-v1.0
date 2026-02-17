#version 300 es
precision highp float;
precision highp int;

in float v_seed;
in vec2 v_velocity;
in float v_speed;
flat in float v_glyphRotation;
flat in int v_glyphShape;
out vec4 o_col;

uniform float u_brightness;
uniform float u_exposure;
uniform float u_dither;
uniform int u_monochrome;
uniform int u_invert;
uniform vec3 u_tint;
uniform vec3 u_tintSecondary;
uniform vec3 u_tintTertiary;
uniform int u_colorMode; // 0=single, 1=gradient, 2=scheme, 3=range
uniform int u_shape; // 0=dot, 1=star, 2=dash, 3=tilde, 4=square, 5=diamond, 6=ring, 7=cross
uniform int u_type;  // 0=sand, 1=dust, 2=sparks, 3=ink
uniform float u_trailLength;
uniform int u_glyphCount; // If > 0, use per-particle glyph from v_glyphShape

float hash(float n){ return fract(sin(n)*43758.5453123); }

// Shape SDFs (signed distance fields)
float sdCircle(vec2 p, float r) {
  return length(p) - r;
}

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdStar(vec2 p, float r, int n, float m) {
  float an = 3.141593 / float(n);
  float en = 3.141593 / m;
  vec2 acs = vec2(cos(an), sin(an));
  vec2 ecs = vec2(cos(en), sin(en));
  float bn = mod(atan(p.x, p.y), 2.0*an) - an;
  p = length(p) * vec2(cos(bn), abs(sin(bn)));
  p -= r * acs;
  p += ecs * clamp(-dot(p, ecs), 0.0, r*acs.y/ecs.y);
  return length(p) * sign(p.x);
}

float sdRing(vec2 p, float r, float w) {
  return abs(length(p) - r) - w;
}

float sdDiamond(vec2 p, float s) {
  p = abs(p);
  return (p.x + p.y - s) * 0.707;
}

float sdCross(vec2 p, float s, float w) {
  p = abs(p);
  return min(
    sdBox(p, vec2(s, w)),
    sdBox(p, vec2(w, s))
  );
}

void main(){
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  
  // Apply glyph rotation
  float cosR = cos(v_glyphRotation);
  float sinR = sin(v_glyphRotation);
  p = vec2(p.x * cosR - p.y * sinR, p.x * sinR + p.y * cosR);
  
  // Determine which shape to use
  int shapeToUse = u_shape;
  if(u_glyphCount > 0) {
    shapeToUse = v_glyphShape;
  }
  
  // Rotate/stretch based on velocity for trail effect
  if(u_trailLength > 0.01 && v_speed > 0.001){
    vec2 dir = normalize(v_velocity);
    float stretch = 1.0 + v_speed * u_trailLength * 20.0;
    // Rotate p so velocity points along x
    float c = dir.x, s = dir.y;
    p = vec2(c*p.x + s*p.y, -s*p.x + c*p.y);
    // Stretch along velocity direction
    p.x /= stretch;
  }
  
  float sdf = 0.0;
  
  // Shape selection (use shapeToUse which respects glyph palette)
  if(shapeToUse == 0){ // dot
    sdf = sdCircle(p, 0.7);
  } else if(shapeToUse == 1){ // star (5-pointed)
    sdf = sdStar(p, 0.5, 5, 2.5);
  } else if(shapeToUse == 2){ // dash
    sdf = sdBox(p, vec2(0.8, 0.15));
  } else if(shapeToUse == 3){ // tilde (wavy)
    float wave = sin(p.x * 4.0) * 0.2;
    sdf = abs(p.y - wave) - 0.15;
  } else if(shapeToUse == 4){ // square
    sdf = sdBox(p, vec2(0.6, 0.6));
  } else if(shapeToUse == 5){ // diamond
    sdf = sdDiamond(p, 0.7);
  } else if(shapeToUse == 6){ // ring
    sdf = sdRing(p, 0.5, 0.15);
  } else if(shapeToUse == 7){ // cross
    sdf = sdCross(p, 0.7, 0.15);
  }
  
  // Convert SDF to alpha with antialiasing
  float a = 1.0 - smoothstep(-0.1, 0.1, sdf);
  
  // Type-specific visual effects
  if(u_type == 2){ // sparks: hot glow effect with ember flicker
    float glow = exp(-sdf * 2.0) * 0.5;
    a = max(a, glow);
    
    // Ember flicker: smaller/slower sparks flicker more (embers)
    float emberFactor = 1.0 - clamp(v_speed * 20.0, 0.0, 1.0); // slow = more ember-like
    float flicker = 0.7 + 0.3 * sin(v_seed * 100.0 + gl_FragCoord.x * 0.01 + gl_FragCoord.y * 0.01);
    flicker = mix(1.0, flicker, emberFactor);
    a *= flicker;
    
    // Embers persist longer (dimmer but sustained)
    a = mix(a, a * 0.6, emberFactor * 0.5);
  }
  if(u_type == 1){ // dust: very soft edges
    a *= smoothstep(1.0, 0.3, length(p));
  }
  if(u_type == 0){ // sand: hard edges, grainy
    a = step(0.3, a);
  }
  if(u_type == 4){ // crumbs: rough irregular edges
    float rough = hash(v_seed * 7.0 + p.x * 5.0 + p.y * 3.0) * 0.3;
    a *= 1.0 - rough;
  }
  if(u_type == 5){ // liquid: soft glossy appearance
    float highlight = max(0.0, dot(normalize(p + vec2(0.3, 0.5)), vec2(0.0, 1.0)));
    a *= 0.8 + highlight * 0.4;
  }

  // dither / stipple (helps mimic the "speckle" gif look)
  float d = (hash(v_seed*1000.0 + gl_FragCoord.x*0.13 + gl_FragCoord.y*0.17) - 0.5) * u_dither;
  float v = clamp((a + d) * u_brightness * u_exposure, 0.0, 1.0);

  vec3 col = vec3(v);
  
  if(u_monochrome == 0){
    // Apply color based on mode
    if(u_colorMode == 0){
      // Single color
      col = vec3(v) * u_tint;
    } else if(u_colorMode == 1){
      // Gradient: interpolate between 3 colors based on seed + velocity
      float t = fract(v_seed + v_speed * 2.0);
      if(t < 0.5){
        col = mix(u_tint, u_tintSecondary, t * 2.0) * v;
      } else {
        col = mix(u_tintSecondary, u_tintTertiary, (t - 0.5) * 2.0) * v;
      }
    } else if(u_colorMode == 2){
      // Scheme: use seed to pick from the 3 colors
      float pick = fract(v_seed * 3.14159);
      if(pick < 0.33){
        col = u_tint * v;
      } else if(pick < 0.66){
        col = u_tintSecondary * v;
      } else {
        col = u_tintTertiary * v;
      }
    } else if(u_colorMode == 3){
      // Range: interpolate in HSL-like space using seed
      // u_tint = rangeStart, u_tintSecondary = rangeEnd
      float t = fract(v_seed + v_speed);
      col = mix(u_tint, u_tintSecondary, t) * v;
    }
    
    // Type-specific coloring adjustments
    // Type-specific coloring adjustments
    if(u_type == 2){ // sparks: embers have warmer, deeper color
      float emberFactor = 1.0 - clamp(v_speed * 20.0, 0.0, 1.0);
      // Simplify ember effect: just modulate brightness/alpha, don't override color
      // distinct flicker is already applied to 'a' (alpha/intensity) loop above
      col = mix(col, col * vec3(1.0, 0.6, 0.4), emberFactor * 0.5); // Warm shift only
    }
    // Liquid blue tint removed to allow full user color control
  }
  
  if(u_invert==1) col = vec3(1.0) - col;

  if(v < 0.01) discard;
  o_col = vec4(col, v);
}
