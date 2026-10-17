/** Replace compatible assets here; flight, navigation and map entry share this one source. */
// Assembly contract: current master metadata, seven interaction anchors and door clips.
// Exterior contract: the same origin, units, forward -Z and assembly envelope.
export const SHIP_MODEL_ASSETS = Object.freeze({
  assembly: new URL('../../../../assets/models/spacecraft-master-lod0.glb', import.meta.url).href,
  exterior: new URL('../../../../assets/models/spacecraft-redesign-exterior-lod1.glb', import.meta.url).href
})
