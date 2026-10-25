# Coin Dash — Lab 3 starter

Setup test: Talya's laptop is connected.

Collect coins, avoid drones, and survive a 45-second round. Move with arrow keys or WASD;
press P to pause or resume and R to restart. This is deliberately small so you can add features during the lab.

## Controls

| Key | Action |
|---|---|
| Arrow keys / WASD | Move |
| P | Pause or resume |
| R | Restart the round (also works while paused or on the end screen) |

## Power-ups

A power-up appears every few seconds at a free spot in the arena, away from you, the coin and the
drones. Run over it to take it. If you leave it, it blinks and fades after a while. Only one is on the
field at a time.

| Power-up | Looks like | Effect |
|---|---|---|
| Shield | blue circle marked **S** | Absorbs one drone hit. A blue ring surrounds you while it lasts; when it breaks you blink and are safe for a moment to get clear. |
| Speed Boost | green triangle marked **>>** | Move 60% faster for 6 seconds. You get a green outline. |
| Double Coins | purple star marked **x2** | Each coin is worth 2 for 8 seconds. The coin gets a purple outline and shows +2 when taken. |

Active power-ups are listed at the top right with the seconds left; a badge blinks during its last
two seconds. Taking a power-up that is already active resets its time rather than stacking.
Durations freeze while the game is paused and stop when the round ends; restarting clears them all.
Doubled coins count towards the high score. Timings live in `settings.js` under `powerUps`.

## Tests

Serve the folder (see below) and open `/tests/` in a browser, for example
`http://localhost:8000/tests/`. The page runs the real game with short timings and lists each check
as PASS or FAIL. It puts your saved high score back when it finishes.

**Play it here:** https://www.avivz.net/coin-dash/

## Run it locally

Clone the repository and open `index.html` in a browser. Everything is in the repository;
there is no package to install, no build step, no backend, and nothing is fetched from the network.
If your agent prefers a local server, let it serve this folder, for example with
`python3 -m http.server 8000`, and open `http://localhost:8000`.

## Use it in the lab

This is a template repository. One partner creates the pair's own repository from it
(the **Use this template** button, or `gh repo create <name> --template avivz/coin-dash --public --clone`)
and adds the other partner as a collaborator. Both clone it and open `index.html`.

## Lab report

The repository includes a `lab-report` skill: use `/lab-report` in Claude Code or `$lab-report`
in Codex, for the pre-lab practice run and at the end of the lab. Give it your name, a unique
laptop label, and the session's start and end times with timezone. If it is not listed, ask
your agent to read `.claude/skills/lab-report/SKILL.md` and follow it.

The skill writes a JSON export and a report page under `reports/`, which Git ignores.
Open that page, load your JSON, and check the result. For the final pair report, load both
laptops' JSON files together and save the combined HTML. Use the same time window on both laptops.

## Files

- `.claude/skills/lab-report/`: reporting skill and offline HTML page.
- `.agents/skills/lab-report`: link to the same skill for Codex.
- `.gitignore`: keeps generated reports out of Git.
- `index.html`: page and script loading.
- `style.css`: page appearance.
- `settings.js`: round duration, speeds, power-up timings, colours and dimensions.
- `game.js`: scene, input, collisions, score, power-ups and end-of-round behaviour.
- `tests/`: in-browser tests for the power-ups (`index.html` runs `powerups.test.js`).
- `vendor/phaser-3.90.0.min.js`: the pinned Phaser runtime, byte for byte the file published at
  `https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js`; `vendor/LICENSE.phaser.txt` is its MIT licence.

The game draws its own shapes; there are no image or audio assets. The authored files are under the
MIT licence in LICENSE.txt. Phaser documentation:
https://docs.phaser.io/phaser/getting-started/making-your-first-phaser-game
