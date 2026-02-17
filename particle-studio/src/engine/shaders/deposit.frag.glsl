#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o_deposit;

uniform sampler2D u_particleState;
uniform vec2 u_stateSize;
uniform float u_depositRadius;
uniform int u_fieldType; // 0=smear, 1=ripple, 2=dent

// This shader is called for each pixel in the field texture
// It checks all particles to see if any deposited at this location
void main(){
  vec2 fieldPos = v_uv;
  float totalDeposit = 0.0;
  vec2 avgTangent = vec2(0.0);
  
  // Sample particles near this position
  // For performance, we use a sparse sampling approach
  int stateW = int(u_stateSize.x);
  int stateH = int(u_stateSize.y);
  
  for(int y = 0; y < stateH; y++){
    for(int x = 0; x < stateW; x++){
      vec2 sampleUV = (vec2(float(x), float(y)) + 0.5) / u_stateSize;
      vec4 particle = texture(u_particleState, sampleUV);
      vec2 particlePos = particle.xy;
      vec2 particleVel = particle.zw;
      
      // Check if particle is near this field position
      float dist = length(particlePos - fieldPos);
      if(dist < u_depositRadius){
        float strength = 1.0 - dist / u_depositRadius;
        float energy = length(particleVel);
        totalDeposit += strength * energy * 0.1;
        avgTangent += normalize(particleVel + vec2(0.001)) * strength;
      }
    }
  }
  
  avgTangent = length(avgTangent) > 0.001 ? normalize(avgTangent) : vec2(0.0);
  o_deposit = vec4(min(1.0, totalDeposit), 0.0, avgTangent);
}
