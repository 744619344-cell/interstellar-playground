# Microgravity cabin production candidates

Project-authored 2D inputs were explicitly authorized for free Tencent Hunyuan 3D generation on 2026-10-25. Official service: https://3d.hunyuan.tencent.com/creation . Original outputs and prompts are retained in output/hunyuan-adaptation/microgravity-cabin-20261025. No third-party reference media was uploaded.

The crew candidate preserves all original mesh/image bytes and appends the expressly authorized local skeleton and weights. These are review candidates, not a claim of engineering certification or final visual approval. Existing hull, outer door, cockpit furniture and suited crew retain their original manifest and credits.

2026-10-27: crew-bound-v3 refines only authorized mid-sleeve skin weights. Original vertex/normal/UV/index/image bytes are unchanged. v2 was rejected for exaggerated shoulder deformation. Runtime CPU and GPU dual-quaternion skinning share the same transformed source contacts; original assets remain available.

2026-10-27 final local candidate: crew-bound-v6 supersedes v3. Eight actual source joint rings fit the original 22-bone structure and scoped surface weights; mesh/image buffers remain byte-identical. v2–v5 are retained as rejected intermediate binding candidates under the production output directory.

## Microsoft Rocketbox indoor crew · 2026-10-27

The user approved the public preview of Medical_Female_03 and expressly authorized downloading and integrating that character. Copyright (c) 2020 Microsoft. Licensed under MIT; the complete copyright, permission notice and disclaimer are retained in `ROCKETBOX-LICENSE.txt` and must accompany distributed copies/substantial portions.

Official repository: https://github.com/microsoft/Microsoft-Rocketbox
Pinned revision: `0943055db6ec570bcef9f2c8b41c9e5467c808f9`.
Source, original FBX/TGA files, Git blob verification and SHA-256 ledger: `assets-source/characters/rocketbox-medical-female-03/`.

`crew-rocketbox.glb` converts the official facial FBX, retaining the original base mesh, normals, UVs, weights and bind skeleton, with 52 existing ARKit channels selected for runtime. TGA images are losslessly converted to PNG with the vertical-origin convention conversion needed by glTF; materials approximate the original Phong look using PBR, source normal/specular images and alpha cutouts. No new geometry, retopology or skin weights are authored. Source approval and import do not imply full gameplay-animation or final visual approval. Previous Hunyuan/local rig candidates above are retained as history and explicit comparisons.
