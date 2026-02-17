#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o_col;

uniform sampler2D u_prev;
uniform sampler2D u_curr;
uniform float u_fade;
uniform float u_threshold;
uniform float u_thresholdSoft;
uniform float u_thresholdGain;
uniform int u_applyThreshold;

float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main(){
  vec4 p = texture(u_prev, v_uv);
  vec4 c = texture(u_curr, v_uv);
  // fade previous toward black, then add current
  vec3 col = p.rgb * (1.0 - u_fade) + c.rgb;

  if(u_applyThreshold == 1){
    float v = clamp(luma(col) * u_thresholdGain, 0.0, 1.0);
    float edge0 = max(0.0, u_threshold - u_thresholdSoft * 0.5);
    float edge1 = min(1.0, u_threshold + u_thresholdSoft * 0.5);
    float m = smoothstep(edge0, edge1, v);
    col *= m;
    o_col = vec4(col, m);
  } else {
    o_col = vec4(col, 1.0);
  }
}
