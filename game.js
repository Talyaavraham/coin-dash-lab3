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
      this.score++;
      if (this.score > this.highScore) {
        this.highScore = this.score;
        this.newRecord = true;
        saveHighScore(this.score);
      }
      this.placeCoin();
    });
    this.physics.add.overlap(this.player, this.drones, () => this.finish('A drone caught you!'));
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
    this.input.keyboard.on('keydown-M', () => this.scene.start('DifficultySelect'));
    this.paused = false;
    this.pauseText = this.add.text(c.width / 2, c.height / 2, 'PAUSED',
      { font: '48px monospace', color: '#ffffff' }).setOrigin(0.5).setDepth(1).setVisible(false);
    this.input.keyboard.on('keydown-P', () => this.togglePause());
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

  update() {
    if (this.finished || this.paused) return;
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(COIN_DASH.playerSpeed);
    this.player.body.setVelocity(direction.x, direction.y);
    const seconds = Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000));
    // No level-up on the frame the round runs out.
    if (seconds > 0) this.updateProgression();
    this.hud.setText(`Coins: ${this.score}    Best: ${this.highScore}    Time: ${seconds}s    `
      + `${this.difficulty.label} · Level ${this.level}`);
    if (seconds === 0) this.finish('Time is up!');
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    const c = COIN_DASH;
    // Depth 2 keeps the result above a level banner that may still be fading out.
    this.add.rectangle(c.width / 2, c.height / 2, 560, 190, 0x0a1120, 0.95).setDepth(2);
    this.add.text(c.width / 2, c.height / 2,
      `${reason}\n${this.score} coins collected\n`
        + (this.newRecord ? 'New high score!' : `High score: ${this.highScore}`)
        + '\nR: try again · M: change difficulty',
      { font: '24px monospace', color: '#ffffff', align: 'center', lineSpacing: 12 }
    ).setOrigin(0.5).setDepth(2);
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
