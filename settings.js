// Keep tuning separate from game behaviour so features can be developed independently.
window.COIN_DASH = {
  width: 800,
  height: 500,
  roundSeconds: 45,
  playerSpeed: 240,
  // Power-up timings are in seconds of play: they stand still while the game is paused.
  powerUps: {
    spawnEverySeconds: 7,     // wait after the previous power-up is taken or fades
    lifetimeSeconds: 7,       // how long an uncollected power-up stays on the field
    speedSeconds: 6,
    speedMultiplier: 1.6,
    doubleSeconds: 8,
    graceSeconds: 1.2         // invulnerability after the shield absorbs a hit
  },
  colors: {
    background: 0x101c31, player: 0x71e8ce, coin: 0xffd166, drone: 0xff657a,
    shield: 0x4da3ff, speed: 0xb6f36b, double: 0xd77dff
  },
  defaultDifficulty: 'normal',
  // Drones start at droneSpeed and gain speedStep (a fraction of droneSpeed) per level.
  // The level rises every levelSeconds of play or every levelCoins coins, whichever comes
  // first, up to maxLevel; one extra drone joins at each level in extraDroneLevels.
  // Top drone speed stays below playerSpeed on every difficulty so drones can always be outrun.
  difficulties: {
    easy: { label: 'Easy', droneCount: 2, droneSpeed: 80, speedStep: 0.10,
      levelSeconds: 15, levelCoins: 8, maxLevel: 4, extraDroneLevels: [] },
    normal: { label: 'Normal', droneCount: 3, droneSpeed: 105, speedStep: 0.12,
      levelSeconds: 12, levelCoins: 6, maxLevel: 5, extraDroneLevels: [4] },
    hard: { label: 'Hard', droneCount: 4, droneSpeed: 125, speedStep: 0.14,
      levelSeconds: 10, levelCoins: 5, maxLevel: 6, extraDroneLevels: [4] }
  }
};
