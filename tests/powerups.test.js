/* global COIN_DASH */
// Browser tests for the power-up system. Open tests/index.html through a local server.
// HIGH_SCORE_KEY comes from game.js; tests restore whatever high score was stored before they ran.
const savedHighScore = (() => { try { return localStorage.getItem(HIGH_SCORE_KEY); } catch (e) { return null; } })();

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const scene = () => window.coinDashGame.scene.getScene('CoinDash');
const P = COIN_DASH.powerUps;

function assert(condition, message) { if (!condition) throw new Error(message); }
function near(actual, expected, tolerance, message) {
  assert(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, got ${actual}`);
}
async function until(check, message, timeout = 4000) {
  const start = performance.now();
  while (!check()) {
    if (performance.now() - start > timeout) throw new Error(`Timed out: ${message}`);
    await wait(20);
  }
}
function key(code, name) {
  for (const type of ['keydown', 'keyup']) {
    const event = new KeyboardEvent(type, { key: name, bubbles: true });
    Object.defineProperty(event, 'keyCode', { get: () => code });
    Object.defineProperty(event, 'which', { get: () => code });
    window.dispatchEvent(event);
  }
}
const pressP = () => key(80, 'p');
const pressR = () => key(82, 'r');

// Random spawns are switched off unless a test is about spawning, so a stray power-up
// cannot be picked up by accident and change what the test measures.
async function freshRound({ spawns = false } = {}) {
  const old = scene() && scene().player;
  if (old) scene().scene.restart();
  await until(() => scene() && scene().player && scene().player !== old && scene().effects, 'scene to restart');
  if (!spawns) scene().nextSpawnAt = Infinity;
  await wait(50);
}
function moveTo(obj, x, y) { obj.setPosition(x, y); obj.body.reset(x, y); }
function addDroneOnPlayer() {
  const s = scene();
  const drone = s.add.rectangle(s.player.x, s.player.y, 26, 26, COIN_DASH.colors.drone);
  s.drones.add(drone);
  return drone;
}
function endText() {
  return scene().children.list.filter(o => o.type === 'Text' && o.depth === 4).map(o => o.text).join('\n');
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('a power-up spawns after the spawn delay, at a valid spot', async () => {
  await freshRound({ spawns: true });
  const s = scene();
  assert(s.pickup === null, 'no power-up at the start of a round');
  await until(() => s.pickup, 'a power-up to spawn');
  near(s.playMs, P.spawnEverySeconds * 1000, 100, 'spawn time in play ms');
  const { x, y } = s.pickup.shape;
  assert(x >= 30 && x <= COIN_DASH.width - 30 && y >= 80 && y <= COIN_DASH.height - 30, `inside the arena (${x}, ${y})`);
  assert(Phaser.Math.Distance.Between(x, y, s.player.x, s.player.y) >= 90, 'clear of the player');
  assert(Phaser.Math.Distance.Between(x, y, s.coin.x, s.coin.y) >= 40, 'clear of the coin');
});

test('an uncollected power-up fades after its lifetime, then another spawns', async () => {
  await freshRound({ spawns: true });
  const s = scene();
  const pickup = s.spawnPowerUp('speed', { x: 60, y: 120 });
  await until(() => s.playMs > pickup.expiresAt + 50, 'lifetime to pass');
  assert(s.pickup === null, 'the faded power-up is removed');
  assert(!pickup.shape.active && !pickup.label.active, 'its shape and label are destroyed');
  await until(() => s.pickup, 'the next power-up to spawn');
});

for (const type of ['shield', 'speed', 'double']) {
  test(`collecting ${type} activates it and shows it in the HUD`, async () => {
    await freshRound();
    const s = scene();
    s.spawnPowerUp(type, { x: s.player.x, y: s.player.y });
    await until(() => s.pickup === null, 'the power-up to be collected');
    assert(type === 'shield' ? s.effects.shield === true : s.effects[type] > 0, 'effect is active');
    const badge = s.powerHud[type];
    assert(badge.visible, 'HUD badge is visible');
    assert(badge.text.startsWith(type === 'double' ? 'x2 COINS' : type.toUpperCase()), `badge text "${badge.text}"`);
    if (type !== 'shield') assert(/\d+s$/.test(badge.text), 'timed badges show seconds left');
  });
}

test('speed boost multiplies movement speed, then wears off', async () => {
  await freshRound();
  const s = scene();
  s.keys.D.isDown = true;
  try {
    await wait(100);
    near(s.player.body.velocity.x, COIN_DASH.playerSpeed, 1, 'normal speed');
    s.activatePowerUp('speed');
    await wait(100);
    near(s.player.body.velocity.x, COIN_DASH.playerSpeed * P.speedMultiplier, 1, 'boosted speed');
    await until(() => s.effects.speed === 0, 'speed boost to expire');
    await wait(50);
    near(s.player.body.velocity.x, COIN_DASH.playerSpeed, 1, 'speed after expiry');
    assert(!s.powerHud.speed.visible, 'badge hidden after expiry');
  } finally {
    s.keys.D.isDown = false;
  }
});

test('double coins gives 2 per coin and feeds the high score', async () => {
  await freshRound();
  const s = scene();
  s.activatePowerUp('double');
  moveTo(s.player, s.coin.x, s.coin.y);
  await until(() => s.score > 0, 'a coin to be collected');
  assert(s.score === 2, `score is 2 after one doubled coin, got ${s.score}`);
  assert(s.highScore >= s.score, 'high score keeps up with the score');
  assert(Number(localStorage.getItem(HIGH_SCORE_KEY)) === s.highScore, 'high score saved to storage');
  await until(() => s.effects.double === 0, 'double coins to expire');
  moveTo(s.player, s.coin.x, s.coin.y);
  await until(() => s.score > 2, 'another coin to be collected');
  assert(s.score === 3, `normal coin after expiry adds 1, got ${s.score}`);
});

test('a drone ends the round when there is no shield', async () => {
  await freshRound();
  const s = scene();
  addDroneOnPlayer();
  await until(() => s.finished, 'the round to end');
  assert(endText().includes('A drone caught you!'), 'end screen names the drone');
});

test('the shield absorbs exactly one drone hit', async () => {
  await freshRound();
  const s = scene();
  s.activatePowerUp('shield');
  addDroneOnPlayer();
  await wait(100);
  assert(!s.finished, 'the shielded player survives the hit');
  assert(s.effects.shield === false, 'the shield is used up');
  assert(s.graceMs > 0, 'a grace period starts');
  assert(!s.powerHud.shield.visible, 'shield badge hidden once used');
  await until(() => s.finished, 'the drone (still overlapping) to end the round after the grace period');
  assert(s.player.alpha === 1, 'player is fully visible on the end screen');
});

test('taking an active power-up again refreshes it instead of stacking', async () => {
  await freshRound();
  const s = scene();
  s.activatePowerUp('speed');
  await wait(400);
  assert(s.effects.speed < P.speedSeconds * 1000, 'time has run down');
  s.activatePowerUp('speed');
  assert(s.effects.speed === P.speedSeconds * 1000, 'refreshed to the full duration');
});

test('pause freezes effect durations, the field timer and spawning', async () => {
  await freshRound();
  const s = scene();
  s.activatePowerUp('speed');
  s.activatePowerUp('double');
  s.activatePowerUp('shield');
  const pickup = s.spawnPowerUp('shield', { x: 60, y: 120 });
  await wait(200);
  s.popText(400, 300, 'test', 0xffffff);
  const floating = s.children.list[s.children.list.length - 1];
  pressP();
  await until(() => s.paused, 'the game to pause');
  const before = { speed: s.effects.speed, double: s.effects.double, playMs: s.playMs, badge: s.powerHud.speed.text };
  const floatingAlpha = floating.alpha;
  await wait(2500); // longer than every test duration
  assert(s.effects.speed === before.speed && s.effects.double === before.double, 'durations unchanged while paused');
  assert(floating.active && floating.alpha === floatingAlpha, 'feedback animations frozen while paused');
  assert(s.playMs === before.playMs, 'play clock stopped');
  assert(s.pickup === pickup && pickup.shape.active, 'the field power-up did not fade');
  assert(s.effects.shield, 'shield kept');
  assert(s.powerHud.speed.text === before.badge, 'HUD countdown frozen');
  pressP();
  await until(() => !s.paused, 'the game to resume');
  await wait(300);
  assert(s.effects.speed < before.speed && s.effects.speed > 0, 'durations run again after resume');
});

test('pause does not let a drone or a power-up be touched', async () => {
  await freshRound();
  const s = scene();
  pressP();
  await until(() => s.paused, 'the game to pause');
  s.spawnPowerUp('speed', { x: s.player.x, y: s.player.y });
  addDroneOnPlayer();
  await wait(500);
  assert(!s.finished, 'no drone hit while paused');
  assert(s.pickup && s.effects.speed === 0, 'no collection while paused');
  s.drones.clear(true, true);
  pressP();
  await until(() => s.pickup === null, 'the power-up to be collected after resuming');
  assert(s.effects.speed > 0, 'speed active after resuming');
});

test('restart (R) clears every effect and power-up', async () => {
  await freshRound();
  const s = scene();
  ['shield', 'speed', 'double'].forEach(t => s.activatePowerUp(t));
  s.spawnPowerUp('double', { x: 60, y: 120 });
  pressP(); // restart must also work while paused
  await until(() => s.paused, 'the game to pause');
  const old = s.player;
  pressR();
  await until(() => s.player !== old, 'the round to restart');
  await wait(50);
  assert(!s.paused && !s.physics.world.isPaused && !s.tweens.paused, 'new round is running, animations included');
  assert(!s.effects.shield && s.effects.speed === 0 && s.effects.double === 0, 'effects cleared');
  assert(s.pickup === null && s.playMs < 500, 'no power-up on the field, play clock reset');
  assert(!s.shieldRing.visible && !s.player.isStroked && !s.coin.isStroked, 'effect visuals cleared');
  assert(['shield', 'speed', 'double'].every(t => !s.powerHud[t].visible), 'HUD badges hidden');
});

test('game over freezes effects and ignores power-ups and P', async () => {
  await freshRound();
  const s = scene();
  s.activatePowerUp('speed');
  s.spawnPowerUp('double', { x: 60, y: 120 });
  s.finish('Time is up!');
  const speed = s.effects.speed;
  await wait(400);
  assert(s.effects.speed === speed, 'speed duration frozen after game over');
  s.collectPowerUp();
  assert(s.effects.double === 0, 'power-ups cannot be collected after game over');
  pressP();
  await wait(100);
  assert(!s.paused, 'P does nothing after game over');
});

test('a crowded arena delays the spawn instead of placing a power-up badly', async () => {
  await freshRound();
  const s = scene();
  s.findSpawnPoint = () => null;
  try {
    const result = s.spawnPowerUp('shield');
    assert(result === null && s.pickup === null, 'nothing spawned');
    near(s.nextSpawnAt, s.playMs + 500, 1, 'retry scheduled');
  } finally {
    delete s.findSpawnPoint;
  }
});

(async () => {
  const lines = [];
  let passed = 0;
  await until(() => scene() && scene().effects, 'the game to start', 10000);
  for (const t of tests) {
    try {
      await t.fn();
      passed++;
      lines.push(`PASS  ${t.name}`);
    } catch (err) {
      lines.push(`FAIL  ${t.name}\n      ${err.message}`);
    }
  }
  try {
    if (savedHighScore === null) localStorage.removeItem(HIGH_SCORE_KEY);
    else localStorage.setItem(HIGH_SCORE_KEY, savedHighScore);
  } catch (e) { /* storage unavailable: nothing to restore */ }
  const summary = `${passed === tests.length ? 'PASS' : 'FAIL'} ${passed}/${tests.length}`;
  const out = document.getElementById('results');
  out.className = passed === tests.length ? 'pass' : 'fail';
  out.textContent = `${summary}\n\n${lines.join('\n')}`;
  document.title = summary;
  window.testResults = { passed, total: tests.length, lines };
})();
