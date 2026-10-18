import RAPIER from '@dimforge/rapier3d-compat';
import { WORLD } from './config.js';

export let R = null;

export async function initPhysics() {
  await RAPIER.init();
  R = RAPIER;
}

export class Physics {
  constructor() {
    this.world = new R.World({ x: 0, y: WORLD.gravity, z: 0 });
    this.acc = 0;
    this.step = 1 / 60;
    // ground
    const g = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0, -5, 0));
    this.world.createCollider(R.ColliderDesc.cuboid(3000, 5, 3000).setFriction(0.9), g);
  }

  update(dt) {
    this.acc += Math.min(dt, 0.1);
    let n = 0;
    while (this.acc >= this.step && n < 3) {
      this.world.step();
      this.acc -= this.step;
      n++;
    }
    if (n === 3) this.acc = 0;
  }

  fixedBox(x, y, z, hx, hy, hz) {
    const b = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(x, y, z));
    this.world.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setFriction(0.8), b);
    return b;
  }

  dynamicBox(x, y, z, hx, hy, hz, q) {
    const desc = R.RigidBodyDesc.dynamic().setTranslation(x, y, z)
      .setLinearDamping(0.15).setAngularDamping(0.4);
    if (q) desc.setRotation(q);
    const b = this.world.createRigidBody(desc);
    this.world.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setDensity(1).setFriction(0.8).setRestitution(0.1), b);
    return b;
  }

  kinematicBall(x, y, z, r) {
    const b = this.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z));
    this.world.createCollider(R.ColliderDesc.ball(r), b);
    return b;
  }

  remove(body) {
    if (body) this.world.removeRigidBody(body);
  }
}
