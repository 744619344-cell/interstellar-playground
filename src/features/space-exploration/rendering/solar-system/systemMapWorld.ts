import {
  ACESFilmicToneMapping, AmbientLight, BackSide, Color, DirectionalLight, HemisphereLight, Mesh,
  MeshBasicMaterial, PerspectiveCamera, Scene, SphereGeometry, SRGBColorSpace,
  WebGLRenderer
} from 'three'
import { CAMERA_FOV_DEG, SYSTEM_FAR_PLANE as FAR, SYSTEM_NEAR_PLANE as NEAR } from '../../domain/visualScale'
import type { VoyageResourceGate } from '../voyageResources'
import { createSystemStars } from './systemMapStars'

export interface SystemMapWorld {
  renderer: WebGLRenderer
  scene: Scene
  camera: PerspectiveCamera
  canvas: HTMLCanvasElement
}

export interface SystemMapWorldFactories {
  createRenderer(options: ConstructorParameters<typeof WebGLRenderer>[0]): WebGLRenderer
}

const DEFAULT_FACTORIES: SystemMapWorldFactories = {
  createRenderer: (options) => new WebGLRenderer(options)
}

export function createSystemMapWorld(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  pixelRatio: number,
  factories: SystemMapWorldFactories = DEFAULT_FACTORIES
): SystemMapWorld {
  const renderer = factories.createRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  })
  try {
    renderer.setPixelRatio(pixelRatio)
    renderer.setSize(width, height, false)
    renderer.outputColorSpace = SRGBColorSpace
    renderer.toneMapping = ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.02
    const scene = new Scene()
    scene.background = new Color(0x02060b)
    const camera = new PerspectiveCamera(CAMERA_FOV_DEG, width / Math.max(height, 1), NEAR, FAR)
    scene.add(new AmbientLight(0xb4c5dd, 0.92))
    scene.add(new HemisphereLight(0x739fd1, 0x171d2c, 0.52))
    const key = new DirectionalLight(0xfff1d6, 2.4)
    key.position.set(-220, 160, 280)
    scene.add(key)
    const fill = new DirectionalLight(0x6e8fff, 0.52)
    fill.position.set(180, -40, -160)
    scene.add(fill)
    return { renderer, scene, camera, canvas }
  } catch (error) {
    renderer.dispose()
    throw error
  }
}

export function addSystemSky(
  scene: Scene,
  _url: string,
  _loader: import('three').TextureLoader,
  _gate: VoyageResourceGate
) {
  const material = new MeshBasicMaterial({
    color: 0x010207, side: BackSide, depthTest: false, depthWrite: false,
    toneMapped: false
  })
  const sky = new Mesh(new SphereGeometry(1600, 32, 20), material)
  sky.renderOrder = -1000
  scene.add(sky)
  sky.add(createSystemStars())
  return sky
}
