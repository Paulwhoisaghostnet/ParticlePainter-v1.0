#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o_ripple;

uniform sampler2D u_prevRipple;   // Previous ripple field (RG16F: R=height, G=velocity)
uniform sampler2D u_deposits;     // New impulses this frame
uniform float u_damping;          // Wave damping (0-1)
uniform float u_speed;            // Wave propagation speed
uniform float u_dt;

void main(){
  vec2 texSize = vec2(textureSize(u_prevRipple, 0));
  vec2 texel = 1.0 / texSize;
  
  // Sample neighbors for Laplacian
  float hC = texture(u_prevRipple, v_uv).r;
  float hL = texture(u_prevRipple, v_uv - vec2(texel.x, 0.0)).r;
  float hR = texture(u_prevRipple, v_uv + vec2(texel.x, 0.0)).r;
  float hU = texture(u_prevRipple, v_uv - vec2(0.0, texel.y)).r;
  float hD = texture(u_prevRipple, v_uv + vec2(0.0, texel.y)).r;
  
  // Laplacian
  float laplacian = (hL + hR + hU + hD) * 0.25 - hC;
  
  // Current velocity
  float vel = texture(u_prevRipple, v_uv).g;
  
  // Wave equation: acceleration = c² * laplacian
  float acc = u_speed * u_speed * laplacian;
  
  // Update velocity with damping
  vel = vel * (1.0 - u_damping * u_dt) + acc * u_dt;
  
  // Update height
  float height = hC + vel * u_dt;
  
  // Add new impulses
  float impulse = texture(u_deposits, v_uv).r;
  if(impulse > 0.01){
    vel += impulse * 5.0; // Impulse adds velocity
  }
  
  // Decay toward zero
  height *= (1.0 - 0.01 * u_dt);
  
  o_ripple = vec4(height, vel, 0.0, 1.0);
}
