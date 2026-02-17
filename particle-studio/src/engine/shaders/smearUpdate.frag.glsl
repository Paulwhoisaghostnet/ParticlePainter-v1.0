#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o_smear;

uniform sampler2D u_prevSmear;    // Previous smear field (RGBA16F)
uniform sampler2D u_deposits;     // New deposits this frame
uniform float u_decayRate;        // How fast smear fades (0-1)
uniform float u_dt;

// Smear data layout:
// R: amount (0-1)
// G: age (seconds)
// B: tangent X
// A: tangent Y

void main(){
  vec4 prev = texture(u_prevSmear, v_uv);
  vec4 deposit = texture(u_deposits, v_uv);
  
  // Decay existing smear
  float amount = prev.r * (1.0 - u_decayRate * u_dt);
  float age = prev.g + u_dt;
  vec2 tangent = prev.ba;
  
  // Add new deposits
  if(deposit.r > 0.01){
    amount = min(1.0, amount + deposit.r);
    age = 0.0; // Reset age on new deposit
    tangent = mix(tangent, deposit.ba, deposit.r);
  }
  
  // Advect along tangent (directional blur)
  vec2 texSize = vec2(textureSize(u_prevSmear, 0));
  vec2 offset = tangent / texSize * 0.5;
  float advected = texture(u_prevSmear, v_uv - offset).r * 0.1;
  amount = max(amount, advected);
  
  o_smear = vec4(amount, age, tangent);
}
