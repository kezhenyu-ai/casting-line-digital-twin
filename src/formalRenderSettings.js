/**
 * Snapshot copied from the formal v1.1.5 worktree:
 * C:\Users\25853\Desktop\铸铁件数字孪生\src\scene\viewer.js
 *
 * Keep this as the reference for the 5180 model scene so the two dashboards
 * do not drift apart again.
 */
export const FORMAL_RENDER_SETTINGS = {
  renderer: {
    toneMapping: 'ACESFilmicToneMapping',
    toneMappingExposure: 1.08,
    pixelRatioCap: 1.6,
    shadowMap: true,
    shadowType: 'PCFSoftShadowMap',
  },
  environmentIntensity: 0.82,
  camera: { fov: 38, near: 0.1, far: 420 },
  lights: {
    hemisphere: { color: 0x8fc9d2, groundColor: 0x10130f, intensity: 1.25 },
    sun: {
      color: 0xffe4c6,
      intensity: 3.15,
      position: [44, 58, 38],
      castShadow: true,
      shadowMapSize: [2048, 2048],
      shadowCamera: { left: -56, right: 56, top: 54, bottom: -46, near: 1, far: 170 },
      shadowBias: -0.00035,
      shadowNormalBias: 0.035,
      shadowRadius: 3,
    },
    rim: { color: 0x72dce3, intensity: 1.15, position: [-52, 35, -46] },
    edge: { color: 0xffb478, intensity: 0.5, position: [55, 12, -30] },
    spots: [
      { color: 0xffe7c9, intensity: 520, position: [-28, 13.2, 0], target: [-24, 0, -6], angle: 0.62, penumbra: 0.85, decay: 1.6, distance: 38 },
      { color: 0xffe7c9, intensity: 460, position: [-3, 13.2, 8], target: [0, 0, 5], angle: 0.6, penumbra: 0.85, decay: 1.6, distance: 38 },
      { color: 0xffebd3, intensity: 480, position: [18, 13.2, 2], target: [17, 0, -5], angle: 0.62, penumbra: 0.85, decay: 1.6, distance: 38 },
      { color: 0xe0f4ff, intensity: 360, position: [31, 13.2, 7], target: [28, 0, 1], angle: 0.55, penumbra: 0.85, decay: 1.6, distance: 38 },
    ],
  },
  post: {
    bloom: { strength: 0.46, radius: 0.6, threshold: 0.82 },
    fxaa: true,
  },
};
