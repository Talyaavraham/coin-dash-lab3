/* global COIN_DASH */
// Difficulty and progression rules. No Phaser here, so tests/difficulty.test.html can load it alone.
window.COIN_DASH_DIFFICULTY = (() => {
  const order = ['easy', 'normal', 'hard'];

  function preset(key) {
    return COIN_DASH.difficulties[order.includes(key) ? key : COIN_DASH.defaultDifficulty];
  }

  // Level 1 at the start, then one more per levelSeconds of play or per levelCoins coins,
  // whichever is further along. Both inputs only grow during a round, so the level never drops.
  function levelFor(p, elapsedMs, coins) {
    const byTime = Math.floor(Math.max(0, elapsedMs) / (p.levelSeconds * 1000));
    const byCoins = Math.floor(Math.max(0, coins) / p.levelCoins);
    return Math.min(p.maxLevel, 1 + Math.max(byTime, byCoins));
  }

  function droneSpeed(p, level) {
    return p.droneSpeed * (1 + p.speedStep * (level - 1));
  }

  function droneCount(p, level) {
    return p.droneCount + p.extraDroneLevels.filter(l => l <= level).length;
  }

  return { order, preset, levelFor, droneSpeed, droneCount };
})();
