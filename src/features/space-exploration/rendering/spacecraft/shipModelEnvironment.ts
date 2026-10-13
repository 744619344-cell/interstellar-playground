import { PMREMGenerator, type Scene, type WebGLRenderer, type WebGLRenderTarget } from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

/** Gives metal cabin surfaces a reflection field owned by the isolated ship pass. */
function environmentTarget(renderer: WebGLRenderer) {
  const generator = new PMREMGenerator(renderer), room = new RoomEnvironment()
  try { return generator.fromScene(room, .04) }
  finally { room.dispose(); generator.dispose() }
}

export class ShipModelEnvironment {
  private target?: WebGLRenderTarget
  constructor(private scene: Scene, private create = environmentTarget) {}
  ensure(renderer: WebGLRenderer) {
    if (this.target) return
    this.target = this.create(renderer); this.scene.environment = this.target.texture
  }
  dispose() { this.scene.environment = null; this.target?.dispose(); this.target = undefined }
}
