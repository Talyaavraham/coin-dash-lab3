// Keep tuning separate from game behaviour so features can be developed independently.
window.COIN_DASH = {
  width: 800,
  height: 500,
  roundSeconds: 45,
  playerSpeed: 240,
  droneSpeed: 105,
  droneCount: 3,
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
  }
};
