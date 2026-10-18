"""Complete the existing r2 rib at its crossbar junction; no new surfaces."""
from build_aligned_glass_r7 import *
from build_aligned_glass_r6 import smooth, surface

TARGET = BASE/'前挡玻璃-r2接缝对齐-r8.glb'


def main():
    doc, binary, raw = load(SOURCE)
    original = bytes(binary)
    prim = doc['meshes'][110]['primitives'][0]
    v, n = [accessor(doc, binary, prim['attributes'][k]).astype(float) for k in ['POSITION','NORMAL']]
    faces = accessor(doc, binary, prim['indices']).reshape(-1,3)
    x,y,z = v.T
    fit = (abs(x)<1.95)&(z>-5.4)&(z<-3)&(y>1.55)
    matrix = np.array([x**(2*i)*(z+4.5)**j for i,j in TERMS]).T
    coeff = np.linalg.lstsq(matrix[fit],y[fit],rcond=None)[0]
    moved = deform(v,coeff)
    # The first taper left the last section of the rib behind. Carry its entire
    # existing profile through the crossbar, with neighboring surface feathering.
    strength = ((1-smooth((abs(z+4.53)-.075)/.2))*smooth((y-1.45)/.18)
                *(1-smooth((abs(x)-2.02)/.08)))
    delta = np.maximum(moved[:,2]-z,.53*strength)
    moved[:,2] = z+delta
    moved[:,1] = y+surface(moved,coeff)-surface(v,coeff)
    moved,reference,report = constrain_faces(v,moved,faces,coeff,max_iterations=2000)
    changed = np.any(moved!=v,axis=1)
    normals = n.copy()
    jac = jacobian(v,coeff)
    normals[changed] = np.linalg.solve(jac[changed].transpose(0,2,1),n[changed,:,None])[:,:,0]
    normals[changed] /= np.linalg.norm(normals[changed],axis=1)[:,None]
    prim['attributes']['POSITION'] = append_vectors(doc,binary,moved)
    prim['attributes']['NORMAL'] = append_vectors(doc,binary,normals)
    assert bytes(binary[:len(original)]) == original
    content = write(TARGET,doc,binary)
    report.update(source=SOURCE.name,sourceSha256=hashlib.sha256(raw).hexdigest(),
        candidate=TARGET.name,candidateSha256=hashlib.sha256(content).hexdigest(),
        changedCanopyVertices=int(changed.sum()),totalCanopyVertices=len(v),
        changedSourceBounds=[v[changed].min(0).tolist(),v[changed].max(0).tolist()],
        maxDisplacement=float(np.linalg.norm(moved-v,axis=1).max()),
        materialRestoredExactlyFromR2=True,trianglesAddedOrRemoved=False,
        hullChanged=False,visualAccepted=False)
    (BASE/'接缝对齐-r8-制作记录.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    np.savez(BASE/'alignment-r8-orientation-reference.npz',normals=reference)
    print(json.dumps(report,ensure_ascii=False,indent=2))


if __name__ == '__main__':
    main()
