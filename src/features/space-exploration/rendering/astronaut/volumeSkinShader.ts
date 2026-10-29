/** Dual-quaternion skinning with the skeleton's shared uniform scale retained. */
export const volumeSkinGLSL = /* glsl */`
uniform vec2 microUpperArms;
uniform float microArmBlend;
vec4 microQMul(vec4 a, vec4 b) { return vec4(a.w*b.xyz+b.w*a.xyz+cross(a.xyz,b.xyz),a.w*b.w-dot(a.xyz,b.xyz)); }
vec3 microQRotate(vec4 q, vec3 v) { return v+2.0*cross(q.xyz,cross(q.xyz,v)+q.w*v); }
vec4 microRotation(mat4 m, float s) {
  mat3 r=mat3(m)/s; float t=r[0][0]+r[1][1]+r[2][2]; vec4 q;
  if(t>0.0) { float a=sqrt(t+1.0)*2.0; q=vec4((r[1][2]-r[2][1])/a,(r[2][0]-r[0][2])/a,(r[0][1]-r[1][0])/a,a*.25); }
  else if(r[0][0]>r[1][1]&&r[0][0]>r[2][2]) { float a=sqrt(1.0+r[0][0]-r[1][1]-r[2][2])*2.0; q=vec4(a*.25,(r[1][0]+r[0][1])/a,(r[2][0]+r[0][2])/a,(r[1][2]-r[2][1])/a); }
  else if(r[1][1]>r[2][2]) { float a=sqrt(1.0+r[1][1]-r[0][0]-r[2][2])*2.0; q=vec4((r[1][0]+r[0][1])/a,a*.25,(r[2][1]+r[1][2])/a,(r[2][0]-r[0][2])/a); }
  else { float a=sqrt(1.0+r[2][2]-r[0][0]-r[1][1])*2.0; q=vec4((r[2][0]+r[0][2])/a,(r[2][1]+r[1][2])/a,a*.25,(r[0][1]-r[1][0])/a); }
  return normalize(q);
}
void microAddDQ(mat4 m, float weight, vec4 reference, inout vec4 real, inout vec4 dual, float s) {
  vec4 q=microRotation(m,s); float w=weight*(dot(q,reference)<0.0?-1.0:1.0);
  real+=q*w; dual+=microQMul(vec4(m[3].xyz,0.0),q)*(.5*w);
}
mat4 microSkin(mat4 a,mat4 b,mat4 c,mat4 d,vec4 weights) {
  float s=length(a[0].xyz); vec4 reference=microRotation(a,s), real=vec4(0.0), dual=vec4(0.0);
  microAddDQ(a,weights.x,reference,real,dual,s); microAddDQ(b,weights.y,reference,real,dual,s);
  microAddDQ(c,weights.z,reference,real,dual,s); microAddDQ(d,weights.w,reference,real,dual,s);
  float magnitude=length(real); real/=magnitude; dual/=magnitude; dual-=real*dot(real,dual);
  vec3 translation=2.0*microQMul(dual,vec4(-real.xyz,real.w)).xyz;
  return mat4(vec4(microQRotate(real,vec3(s,0.0,0.0)),0.0),vec4(microQRotate(real,vec3(0.0,s,0.0)),0.0),vec4(microQRotate(real,vec3(0.0,0.0,s)),0.0),vec4(translation,1.0));
}
mat4 microHybridSkin(mat4 a,mat4 b,mat4 c,mat4 d,vec4 weights,vec4 ids) {
  vec4 arms=vec4(float(ids.x==microUpperArms.x||ids.x==microUpperArms.y),float(ids.y==microUpperArms.x||ids.y==microUpperArms.y),float(ids.z==microUpperArms.x||ids.z==microUpperArms.y),float(ids.w==microUpperArms.x||ids.w==microUpperArms.y));
  float blend=microArmBlend*dot(weights,arms);
  return microSkin(a,b,c,d,weights)*(1.0-blend)+(a*weights.x+b*weights.y+c*weights.z+d*weights.w)*blend;
}
`
const blended = 'microHybridSkin(boneMatX,boneMatY,boneMatZ,boneMatW,skinWeight,skinIndex)'
export function volumeSkinVertexShader(source: string) {
  return source.replace('#include <skinning_pars_vertex>', `#include <skinning_pars_vertex>\n#ifdef USE_SKINNING\n${volumeSkinGLSL}\n#endif`)
    .replace('#include <skinning_vertex>', `#ifdef USE_SKINNING\ntransformed=(bindMatrixInverse*${blended}*bindMatrix*vec4(transformed,1.0)).xyz;\n#endif`)
    .replace('#include <skinnormal_vertex>', `#ifdef USE_SKINNING\nmat4 microNormalSkin=bindMatrixInverse*${blended}*bindMatrix;\nobjectNormal=(microNormalSkin*vec4(objectNormal,0.0)).xyz;\n#ifdef USE_TANGENT\nobjectTangent=(microNormalSkin*vec4(objectTangent,0.0)).xyz;\n#endif\n#endif`)
}
