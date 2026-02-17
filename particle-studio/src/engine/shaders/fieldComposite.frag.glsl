#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o_col;

uniform sampler2D u_baseImage;
uniform sampler2D u_smearField;
uniform sampler2D u_rippleField;
uniform sampler2D u_dentField;
uniform vec3 u_smearColor;
uniform vec3 u_rippleColor;
uniform float u_smearOpacity;
uniform float u_rippleOpacity;
uniform float u_dentOpacity;

void main(){
  vec4 base = texture(u_baseImage, v_uv);
  
  // Smear overlay
  float smear = texture(u_smearField, v_uv).r;
  vec3 col = mix(base.rgb, u_smearColor, smear * u_smearOpacity);
  
  // Ripple normal mapping (simple height-based shading)
  vec2 texSize = vec2(textureSize(u_rippleField, 0));
  float hL = texture(u_rippleField, v_uv - vec2(1.0/texSize.x, 0.0)).r;
  float hR = texture(u_rippleField, v_uv + vec2(1.0/texSize.x, 0.0)).r;
  float hU = texture(u_rippleField, v_uv - vec2(0.0, 1.0/texSize.y)).r;
  float hD = texture(u_rippleField, v_uv + vec2(0.0, 1.0/texSize.y)).r;
  vec2 rippleNormal = vec2(hR - hL, hD - hU) * 10.0;
  float rippleShade = 0.5 + dot(rippleNormal, vec2(0.7, 0.7)) * 0.5;
  col = mix(col, col * rippleShade + u_rippleColor * abs(rippleNormal.x + rippleNormal.y) * 0.3, u_rippleOpacity);
  
  // Dent darkening
  float dent = texture(u_dentField, v_uv).r;
  col *= 1.0 - dent * u_dentOpacity * 0.5;
  
  o_col = vec4(col, base.a);
}
