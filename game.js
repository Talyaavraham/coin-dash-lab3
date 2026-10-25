/* global Phaser, COIN_DASH, COIN_DASH_DIFFICULTY */
// The best score survives page reloads via localStorage. If storage is blocked or broken
// (private browsing, quota, disabled cookies), the game keeps the record for this page only.
const HIGH_SCORE_KEY = 'coinDash.highScore';
let sessionHighScore = 0;

function loadHighScore() {
  try {
    const stored = Number.parseInt(window.localStorage.getItem(HIGH_SCORE_KEY), 10);
    if (Number.isFinite(stored) && stored > 0) sessionHighScore = Math.max(sessionHighScore, stored);
  } catch (err) {
    console.warn('Coin Dash: could not read the high score from localStorage.', err);
  }
  return sessionHighScore;
}

function saveHighScore(score) {
  sessionHighScore = Math.max(sessionHighScore, score);
  try {
    window.localStorage.setItem(HIGH_SCORE_KEY, String(sessionHighScore));
  } catch (err) {
    console.warn('Coin Dash: could not save the high score to localStorage.', err);
  }
}

// Power-up types: on-field symbol, HUD label, and which entry of COIN_DASH.colors they use.
const POWER_UPS = {
  shield: { symbol: 'S', label: 'SHIELD' },
  speed: { symbol: '>>', label: 'SPEED' },
  double: { symbol: 'x2', label: 'x2 COINS' }
};
const POWER_UP_TYPES = Object.keys(POWER_UPS);
const toCss = color => '#' + color.toString(16).padStart(6, '0');

// First screen: pick a difficulty. The choice lives in the game registry, so R keeps it.
class DifficultySelect extends Phaser.Scene {
  constructor() { super('DifficultySelect'); }

  create() {
    const c = COIN_DASH, order = COIN_DASH_DIFFICULTY.order;
    this.choice = Math.max(0, order.indexOf(this.registry.get('difficulty') || c.defaultDifficulty));
    this.add.grid(c.width / 2, c.height / 2, c.width, c.height, 40, 40,
      c.colors.background, 1, 0x24334b, 0.45);
    this.add.text(c.width / 2, 110, 'Choose difficulty', { font: '32px monospace', color: '#ffffff' })
      .setOrigin(0.5);
    this.options = order.map((key, i) => {
      const option = this.add.text(c.width / 2, 200 + i * 60, '', { font: '24px monospace' })
        .setOrigin(0.5).setInteractive({ useHandCursor: true });
      option.on('pointerover', () => this.highlight(i));
      option.on('pointerdown', () => this.begin(i));
      return option;
    });
    this.add.text(c.width / 2, 410, 'Up/Down or 1-3 to choose · Enter or click to start',
      { font: '16px monospace', color: '#9fb3cc' }).setOrigin(0.5);
    const keyboard = this.input.keyboard;
    for (const key of ['UP', 'W']) keyboard.on(`keydown-${key}`, () => this.highlight(this.choice - 1));
    for (const key of ['DOWN', 'S']) keyboard.on(`keydown-${key}`, () => this.highlight(this.choice + 1));
    ['ONE', 'TWO', 'THREE'].forEach((key, i) => keyboard.on(`keydown-${key}`, () => this.begin(i)));
    for (const key of ['ENTER', 'SPACE']) keyboard.on(`keydown-${key}`, () => this.begin(this.choice));
    this.highlight(this.choice);
  }

  highlight(index) {
    const order = COIN_DASH_DIFFICULTY.order;
    this.choice = (index + order.length) % order.length;
    this.options.forEach((option, i) => {
      const p = COIN_DASH.difficulties[order[i]];
      const marker = i === this.choice ? '>' : ' ';
      option.setText(`${marker} ${i + 1}. ${p.label.padEnd(6)}  ${p.droneCount} drones, up to level ${p.maxLevel}`)
        .setColor(i === this.choice ? '#71e8ce' : '#ffffff');
    });
  }

  begin(index) {
    this.registry.set('difficulty', COIN_DASH_DIFFICULTY.order[index]);
    this.scene.start('CoinDash');
  }
}

class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  create() {
    const c = COIN_DASH;
    this.difficulty = COIN_DASH_DIFFICULTY.preset(this.registry.get('difficulty'));
    this.level = 1;
    this.score = 0;
    this.highScore = loadHighScore();
    this.newRecord = false;
    this.finished = false;
    this.deadline = this.time.now + c.roundSeconds * 1000;
    this.physics.world.setBounds(0, 44, c.width, c.height - 44);
    this.add.grid(c.width / 2, c.height / 2, c.width, c.height, 40, 40,
      c.colors.background, 1, 0x24334b, 0.45);
    this.hud = this.add.text(18, 12, '', { font: '18px monospace', color: '#ffffff' });
    this.player = this.add.rectangle(c.width / 2, c.height / 2, 24, 24, c.colors.player);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.coin = this.add.circle(100, 100, 9, c.colors.coin);
    this.physics.add.existing(this.coin);
    this.coin.body.setCircle(9);
    this.placeCoin();
    this.drones = this.physics.add.group();
    // Spread the starting drones along the top, 270 px apart like the original three when they fit.
    const count = this.difficulty.droneCount;
    const gap = Math.min(270, (c.width - 180) / Math.max(1, count - 1));
    for (let i = 0; i < count; i++) this.addDrone(90 + i * gap, 100);
    this.physics.add.overlap(this.player, this.coin, () => {
      if (this.finished) return;
      const points = this.effects.double > 0 ? 2 : 1;
      this.score += points;
      if (points > 1) this.popText(this.coin.x, this.coin.y - 14, `+${points}`, c.colors.double);
      if (this.score > this.highScore) {
        this.highScore = this.score;
        this.newRecord = true;
        saveHighScore(this.score);
      }
      this.placeCoin();
    });
    this.physics.add.overlap(this.player, this.drones, () => this.hitDrone());
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
    this.input.keyboard.on('keydown-M', () => this.scene.start('DifficultySelect'));
    this.paused = false;
    this.pauseText = this.add.text(c.width / 2, c.height / 2, 'PAUSED',
      { font: '48px monospace', color: '#ffffff' }).setOrigin(0.5).setDepth(3).setVisible(false);
    this.input.keyboard.on('keydown-P', () => this.togglePause());
    this.createPowerUps();
  }

  // Power-up timers run on playMs, which only advances in update() while the round is live,
  // so pausing or ending the round freezes every duration without extra bookkeeping.
  createPowerUps() {
    const c = COIN_DASH;
    this.playMs = 0;
    this.effects = { shield: false, speed: 0, double: 0 }; // speed and double: ms remaining
    this.graceMs = 0;
    this.pickup = null;
    this.nextSpawnAt = c.powerUps.spawnEverySeconds * 1000;
    this.shieldRing = this.add.circle(this.player.x, this.player.y, 22)
      .setStrokeStyle(3, c.colors.shield).setVisible(false);
    this.powerHud = {};
    for (const type of POWER_UP_TYPES) {
      this.powerHud[type] = this.add.text(0, 13, '', { font: 'bold 16px monospace', color: toCss(c.colors[type]) })
        .setOrigin(1, 0).setVisible(false);
    }
  }

  spawnPowerUp(type = Phaser.Utils.Array.GetRandom(POWER_UP_TYPES), at = this.findSpawnPoint()) {
    const c = COIN_DASH;
    if (!at) {
      this.nextSpawnAt = this.playMs + 500; // arena too crowded right now; try again shortly
      return null;
    }
    const color = c.colors[type];
    let shape;
    if (type === 'shield') shape = this.add.circle(at.x, at.y, 13, color).setStrokeStyle(3, 0xffffff);
    else if (type === 'speed') shape = this.add.triangle(at.x, at.y, 0, 26, 13, 0, 26, 26, color);
    else shape = this.add.star(at.x, at.y, 5, 8, 16, color);
    const label = this.add.text(at.x, at.y + (type === 'speed' ? 4 : 0), POWER_UPS[type].symbol,
      { font: 'bold 12px monospace', color: '#0a1120' }).setOrigin(0.5);
    this.physics.add.existing(shape);
    shape.body.setImmovable(true);
    const collider = this.physics.add.overlap(this.player, shape, () => this.collectPowerUp());
    this.tweens.add({ targets: [shape, label], scale: { from: 0, to: 1 }, duration: 250, ease: 'Back.Out' });
    this.pickup = { type, shape, label, collider, expiresAt: this.playMs + c.powerUps.lifetimeSeconds * 1000 };
    return this.pickup;
  }

  // A free spot inside the arena, clear of the player, the coin and every drone.
  findSpawnPoint() {
    const c = COIN_DASH;
    const clear = (x, y, obj, gap) => Phaser.Math.Distance.Between(x, y, obj.x, obj.y) >= gap;
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = Phaser.Math.Between(30, c.width - 30);
      const y = Phaser.Math.Between(80, c.height - 30);
      if (clear(x, y, this.player, 90) && clear(x, y, this.coin, 40)
        && this.drones.getChildren().every(d => clear(x, y, d, 90))) return { x, y };
    }
    return null;
  }

  removePowerUp() {
    const { shape, label, collider } = this.pickup;
    collider.destroy();
    shape.destroy();
    label.destroy();
    this.pickup = null;
    this.nextSpawnAt = this.playMs + COIN_DASH.powerUps.spawnEverySeconds * 1000;
  }

  collectPowerUp() {
    if (this.finished || !this.pickup) return;
    const { type, shape } = this.pickup;
    const color = COIN_DASH.colors[type];
    this.burst(shape.x, shape.y, color);
    this.popText(shape.x, shape.y - 20, `${POWER_UPS[type].label}!`, color);
    this.removePowerUp();
    this.activatePowerUp(type);
  }

  // Taking a power-up that is already active refreshes it rather than stacking.
  activatePowerUp(type) {
    const p = COIN_DASH.powerUps;
    if (type === 'shield') this.effects.shield = true;
    else if (type === 'speed') this.effects.speed = p.speedSeconds * 1000;
    else this.effects.double = p.doubleSeconds * 1000;
    this.updatePowerVisuals();
    this.tweens.add({ targets: this.powerHud[type], scale: { from: 1.5, to: 1 }, duration: 300 });
  }

  hitDrone() {
    if (this.finished || this.graceMs > 0) return;
    if (!this.effects.shield) {
      this.finish('A drone caught you!');
      return;
    }
    // The shield absorbs this hit; a short grace period lets the player get clear of the drone.
    this.effects.shield = false;
    this.graceMs = COIN_DASH.powerUps.graceSeconds * 1000;
    this.burst(this.player.x, this.player.y, COIN_DASH.colors.shield, 3.5);
    this.popText(this.player.x, this.player.y - 26, 'SHIELD BROKEN', COIN_DASH.colors.shield);
    this.cameras.main.shake(150, 0.006);
    this.updatePowerVisuals();
  }

  tickPowerUps(delta) {
    for (const type of ['speed', 'double']) {
      if (this.effects[type] <= 0) continue;
      this.effects[type] = Math.max(0, this.effects[type] - delta);
      if (this.effects[type] === 0) {
        this.popText(this.player.x, this.player.y - 26, `${POWER_UPS[type].label} ended`, 0x9aa8bb);
      }
    }
    this.graceMs = Math.max(0, this.graceMs - delta);
    if (this.pickup) {
      const left = this.pickup.expiresAt - this.playMs;
      if (left <= 0) this.removePowerUp();
      else {
        // Blink during the last two seconds so the player knows it is about to fade.
        const alpha = left < 2000 && Math.floor(left / 150) % 2 ? 0.3 : 1;
        this.pickup.shape.setAlpha(alpha);
        this.pickup.label.setAlpha(alpha);
      }
    } else if (this.playMs >= this.nextSpawnAt) {
      this.spawnPowerUp();
    }
    this.updatePowerVisuals();
  }

  updatePowerVisuals() {
    const c = COIN_DASH;
    this.shieldRing.setVisible(this.effects.shield).setPosition(this.player.x, this.player.y);
    this.player.setAlpha(this.graceMs > 0 && Math.floor(this.graceMs / 100) % 2 ? 0.35 : 1);
    if (this.effects.speed > 0) this.player.setStrokeStyle(3, c.colors.speed);
    else this.player.setStrokeStyle();
    if (this.effects.double > 0) this.coin.setStrokeStyle(3, c.colors.double);
    else this.coin.setStrokeStyle();
    // HUD badges, right-aligned at the top; the shield lasts until hit so it shows no timer.
    let right = c.width - 18;
    for (const type of POWER_UP_TYPES) {
      const badge = this.powerHud[type];
      const ms = this.effects[type];
      badge.setVisible(Boolean(ms));
      if (!ms) continue;
      badge.setText(type === 'shield' ? POWER_UPS[type].label : `${POWER_UPS[type].label} ${Math.ceil(ms / 1000)}s`);
      badge.setX(right).setAlpha(type !== 'shield' && ms < 2000 && Math.floor(ms / 200) % 2 ? 0.4 : 1);
      right -= badge.width + 16;
    }
  }

  popText(x, y, message, color) {
    const text = this.add.text(x, y, message, { font: 'bold 16px monospace', color: toCss(color) })
      .setOrigin(0.5).setDepth(2);
    this.tweens.add({ targets: text, y: y - 30, alpha: 0, duration: 900, onComplete: () => text.destroy() });
  }

  burst(x, y, color, size = 2.5) {
    const ring = this.add.circle(x, y, 14).setStrokeStyle(3, color).setDepth(2);
    this.tweens.add({ targets: ring, scale: size, alpha: 0, duration: 350, onComplete: () => ring.destroy() });
  }

  togglePause() {
    if (this.finished) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.pausedAt = this.time.now;
      this.physics.pause();
      this.tweens.pauseAll();
    } else {
      // Push the deadline back so time spent paused does not count against the round.
      this.deadline += this.time.now - this.pausedAt;
      this.physics.resume();
      this.tweens.resumeAll();
    }
    this.pauseText.setVisible(this.paused);
  }

  addDrone(x, y) {
    const c = COIN_DASH;
    const drone = this.add.rectangle(x, y, 26, 26, c.colors.drone);
    this.drones.add(drone);
    drone.body.setCollideWorldBounds(true).setBounce(1, 1);
    const angle = (35 + (this.drones.getLength() - 1) * 105) * Math.PI / 180;
    const speed = COIN_DASH_DIFFICULTY.droneSpeed(this.difficulty, this.level);
    drone.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
  }

  // Raise the level when enough play time or coins have accumulated. Elapsed time comes from the
  // deadline, which pausing pushes back, and update() skips this while paused, so pauses never count.
  updateProgression() {
    const c = COIN_DASH, rules = COIN_DASH_DIFFICULTY;
    const elapsed = c.roundSeconds * 1000 - (this.deadline - this.time.now);
    const level = rules.levelFor(this.difficulty, elapsed, this.score);
    if (level <= this.level) return;
    this.level = level;
    const speed = rules.droneSpeed(this.difficulty, level);
    for (const drone of this.drones.getChildren()) drone.body.velocity.normalize().scale(speed);
    // New drones enter at the corner farthest from the player, so they never appear on top of them.
    const corners = [[40, 84], [c.width - 40, 84], [40, c.height - 40], [c.width - 40, c.height - 40]];
    const distance = ([x, y]) => Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y);
    const [x, y] = corners.reduce((best, corner) => (distance(corner) > distance(best) ? corner : best));
    while (this.drones.getLength() < rules.droneCount(this.difficulty, level)) this.addDrone(x, y);
    this.showLevelUp();
  }

  showLevelUp() {
    const c = COIN_DASH;
    this.cameras.main.flash(250, 255, 101, 122);
    const banner = this.add.text(c.width / 2, c.height / 2 - 70, `LEVEL ${this.level}`,
      { font: '40px monospace', color: '#ffd166' }).setOrigin(0.5).setDepth(1);
    this.tweens.add({ targets: banner, y: banner.y - 40, alpha: 0, duration: 1200,
      ease: 'Cubic.easeOut', onComplete: () => banner.destroy() });
    for (const drone of this.drones.getChildren()) {
      drone.setFillStyle(0xffffff);
      this.tweens.addCounter({ duration: 200, onComplete: () => drone.setFillStyle(c.colors.drone) });
    }
  }

  placeCoin() {
    const c = COIN_DASH;
    // Avoid spawning the next coin directly underneath the player.
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 60);
    this.coin.setPosition(x, y);
    this.coin.body.reset(x, y);
  }

  update(time, delta) {
    if (this.finished || this.paused) return;
    // Cap the step so a long frame (e.g. a background tab) cannot skip a whole power-up.
    const step = Math.min(delta, 100);
    this.playMs += step;
    this.tickPowerUps(step);
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const speed = COIN_DASH.playerSpeed * (this.effects.speed > 0 ? COIN_DASH.powerUps.speedMultiplier : 1);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(speed);
    this.player.body.setVelocity(direction.x, direction.y);
    const seconds = Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000));
    // No level-up on the frame the round runs out.
    if (seconds > 0) this.updateProgression();
    // Kept compact so the power-up badges fit on the right of the same row.
    this.hud.setText(`Coins: ${this.score}  Best: ${this.highScore}  Time: ${seconds}s  `
      + `${this.difficulty.label} · Level ${this.level}`);
    if (seconds === 0) this.finish('Time is up!');
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    this.player.setAlpha(1); // in case the round ends mid-blink during the shield grace period
    const c = COIN_DASH;
    // Depth 4 keeps the result above a fading level banner (1), feedback text (2) and PAUSED (3).
    this.add.rectangle(c.width / 2, c.height / 2, 560, 190, 0x0a1120, 0.95).setDepth(4);
    this.add.text(c.width / 2, c.height / 2,
      `${reason}\n${this.score} coins collected\n`
        + (this.newRecord ? 'New high score!' : `High score: ${this.highScore}`)
        + '\nR: try again · M: change difficulty',
      { font: '24px monospace', color: '#ffffff', align: 'center', lineSpacing: 12 }
    ).setOrigin(0.5).setDepth(4);
  }
}
window.coinDashGame = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: COIN_DASH.width,
  height: COIN_DASH.height,
  backgroundColor: COIN_DASH.colors.background,
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
  scene: [DifficultySelect, CoinDash]
});
