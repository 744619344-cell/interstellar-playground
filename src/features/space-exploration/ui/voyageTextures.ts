import earthClouds from '../../../assets/textures/voyage-earth_clouds.jpg'
import earthDay from '../../../assets/textures/voyage-earth_day.jpg'
import earthNight from '../../../assets/textures/voyage-earth_night.jpg'
import jupiter from '../../../assets/textures/voyage-jupiter.jpg'
import mars from '../../../assets/textures/voyage-mars.jpg'
import mercury from '../../../assets/textures/voyage-mercury.jpg'
import milkyWay from '../../../assets/textures/voyage-milkyway.jpg'
import moon from '../../../assets/textures/voyage-moon.jpg'
import neptune from '../../../assets/textures/voyage-neptune.jpg'
import saturnRing from '../../../assets/textures/voyage-saturn-ring.png'
import saturn from '../../../assets/textures/voyage-saturn.jpg'
import sun from '../../../assets/textures/voyage-sun.jpg'
import uranus from '../../../assets/textures/voyage-uranus.jpg'
import venus from '../../../assets/textures/voyage-venus_surface.jpg'
import type { VoyageTextureSet } from '../rendering/voyagePublicTypes'

export const VOYAGE_TEXTURES: VoyageTextureSet = {
  surface: { sun, mercury, venus, earth: earthDay, moon, mars, jupiter, saturn, uranus, neptune },
  earthNight,
  earthClouds,
  saturnRing,
  milkyWay
}
