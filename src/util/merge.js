import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Merges sibling meshes that share a material into one mesh, recursively.
// Joints (Groups) stay separate so procedural animation still works,
// but each joint draws in a handful of calls instead of dozens.
export function mergeStatic(group) {
  const byMat = new Map();
  for (const c of group.children) {
    if (c.isMesh && !c.isInstancedMesh && c.children.length === 0 && !c.userData.noMerge) {
      const k = c.material.uuid;
      if (!byMat.has(k)) byMat.set(k, []);
      byMat.get(k).push(c);
    }
  }
  for (const list of byMat.values()) {
    if (list.length < 2) continue;
    const anyNonIndexed = list.some((m) => !m.geometry.index);
    const geos = list.map((m) => {
      m.updateMatrix();
      let g = m.geometry.clone();
      g.applyMatrix4(m.matrix);
      if (anyNonIndexed && g.index) g = g.toNonIndexed();
      // keep only the attributes every geometry has
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      return g;
    });
    const merged = mergeGeometries(geos);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, list[0].material);
    mesh.castShadow = list.some((m) => m.castShadow);
    mesh.receiveShadow = list.some((m) => m.receiveShadow);
    mesh.userData = { ...list[0].userData };
    for (const m of list) group.remove(m);
    group.add(mesh);
  }
  for (const c of [...group.children]) if (!c.isMesh) mergeStatic(c);
  return group;
}
