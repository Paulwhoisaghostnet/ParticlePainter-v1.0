#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o_depth;

uniform sampler2D u_mask;        // Source mask (pass 0 only)
uniform sampler2D u_depthSrc;    // Source depth texture (blur passes)
uniform float u_curve;           // Gamma curve (0.1-3.0)
uniform float u_scale;           // Height scale (0-1)
uniform int u_invert;            // Invert depth
uniform int u_pass;              // 0 = extract luma, 1+ = blur passes

// Separable Gaussian blur weights (5 samples)
const float weights[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);

void main(){
  if(u_pass == 0){
    // Extract luminance from mask and apply curve
    vec4 mask = texture(u_mask, v_uv);
    float lum = dot(mask.rgb, vec3(0.299, 0.587, 0.114));
    if(u_invert == 1) lum = 1.0 - lum;
    float depth = pow(lum, u_curve) * u_scale;
    o_depth = vec4(depth, 0.0, 0.0, 1.0);
  } else {
    // Blur pass (alternates horizontal/vertical)
    // FIXED: Sample from u_depthSrc (depth texture) not u_mask
    vec2 texSize = vec2(textureSize(u_depthSrc, 0));
    vec2 offset = (u_pass % 2 == 1) ? vec2(1.0 / texSize.x, 0.0) : vec2(0.0, 1.0 / texSize.y);
    
    float result = texture(u_depthSrc, v_uv).r * weights[0];
    for(int i = 1; i < 5; i++){
      result += texture(u_depthSrc, v_uv + offset * float(i)).r * weights[i];
      result += texture(u_depthSrc, v_uv - offset * float(i)).r * weights[i];
    }
    o_depth = vec4(result, 0.0, 0.0, 1.0);
  }
}
