#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o_dent;

uniform sampler2D u_prevDent;     // Previous dent field (R16F)
uniform sampler2D u_deposits;     // New dent deposits this frame
uniform float u_recoveryRate;     // How fast dents recover (0-1)
uniform float u_dt;

void main(){
  float dent = texture(u_prevDent, v_uv).r;
  float deposit = texture(u_deposits, v_uv).r;
  
  // Add new dents
  dent = min(1.0, dent + deposit);
  
  // Recover slowly
  dent = max(0.0, dent - u_recoveryRate * u_dt);
  
  o_dent = vec4(dent, 0.0, 0.0, 1.0);
}
