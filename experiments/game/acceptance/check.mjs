#!/usr/bin/env node
/**
 * The held-out checks of the game experiment (handoff 0082): what a player can do, where a machine can tell.
 *
 *   node experiments/game/acceptance/check.mjs <address> [--headed] [--only <id>,<id>] [--json <file>] [--patience <share>]
 *
 * <address> is where a build of the game is served, for example http://127.0.0.1:4361/. Each check opens the page
 * afresh with `test=1&seed=7` (SPEC.md §7), does what a player would do with real keys and a real mouse, and reads the
 * game's test surface, `window.__game`, to see what happened. It prints one line a check and exits 1 when one fails.
 *
 * No builder sees this file: it lives in grooph's repository, not in the game's, and nothing a run is given names it
 * (README.md beside it, PROTOCOL.md §3). The list it checks, with the lines only a person can judge, is LIST.md.
 *
 * It uses the browser Playwright installs for grooph's own web tests, and nothing else. A request the page makes to
 * another host is recorded and refused, so nothing leaves the machine. `--headed` shows the browser, which the frame
 * rate check needs for a real game: a browser with no window draws 3D on the processor.
 */
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const { chromium } = createRequire(join(root, "apps", "web", "package.json"))("@playwright/test");

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const address = args.find((a) => /^https?:\/\//.test(a));
if (!address) {
  console.error("usage: node experiments/game/acceptance/check.mjs <address> [--headed] [--only <id>,<id>] [--json <file>] [--patience <share>]");
  process.exit(2);
}
const only = option("--only")?.split(",");
const SEED = 7;
/** A share of the long waits (a minute for an enemy to arrive, three to win a round), for a stand-in that is quick. */
const patience = Number(option("--patience") ?? 1);
const wait = (ms) => Math.round(ms * patience);

// ─── small tools ─────────────────────────────────────────────────────────────

class Fail extends Error {}
const fail = (message) => {
  throw new Fail(message);
};
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a) => Math.hypot(a.x, a.y, a.z);
const unit = (a) => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};
const flat = (a) => ({ x: a.x, y: 0, z: a.z });
/** To the right of a direction, seen from above, in three.js's world: y up, right-handed. */
const rightOf = (f) => unit({ x: -f.z, y: 0, z: f.x });
const degrees = (radians) => (radians * 180) / Math.PI;
const round = (n, places = 2) => Math.round(n * 10 ** places) / 10 ** places;
const where = (p) => `(${round(p.x, 1)}, ${round(p.y, 1)}, ${round(p.z, 1)})`;

/** The address of a fresh visit: the caller's own query kept, the test flags added. */
function visit(seed = SEED) {
  const url = new URL(address);
  url.searchParams.set("test", "1");
  url.searchParams.set("seed", String(seed));
  return url.href;
}

const browser = await chromium.launch({ headless: !flag("--headed") });
/** Every request any check's page made to another host, for the `opens` check to answer for at the end. */
const everOutside = [];
/** A browser with a window asks for an icon by itself; a game without one is still a game. */
const icon = (url) => new URL(url).pathname === "/favicon.ico";

/** A fresh page on the game, with what it did wrong while loading and running kept in `trouble`. */
async function open(seed = SEED) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: "block" });
  const page = await context.newPage();
  const origin = new URL(address).origin;
  const trouble = { errors: [], failed: [], outside: [] };
  page.on("pageerror", (error) => trouble.errors.push(`uncaught: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !icon(message.location().url || "http://x/")) trouble.errors.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    if (new URL(request.url()).origin === origin && !icon(request.url())) trouble.failed.push(request.url());
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && new URL(response.url()).origin === origin && !icon(response.url())) trouble.failed.push(`${response.status()} ${response.url()}`);
  });
  // A request to another host is written down and refused: nothing leaves this machine.
  await context.route(
    (url) => /^https?:$/.test(url.protocol) && url.origin !== origin,
    (route) => {
      trouble.outside.push(route.request().url());
      everOutside.push(route.request().url());
      return route.abort();
    },
  );
  await page.goto(visit(seed), { waitUntil: "load" });
  await page.mouse.move(640, 360);
  return { page, context, trouble };
}

/** The test surface as it is now, or null when the page has none. */
const snap = (page) => page.evaluate(() => (typeof window.__game === "object" && window.__game !== null ? JSON.parse(JSON.stringify(window.__game)) : null));

/** Waits until the surface satisfies `test`; gives back the snapshot that did, or null when the time ran out. */
async function until(page, test, ms) {
  const end = Date.now() + ms;
  for (;;) {
    const s = await snap(page);
    if (s !== null && test(s)) return s;
    if (Date.now() > end) return null;
    await sleep(50);
  }
}

/** Starts a round as a player in test mode does: Enter on the menu. */
async function start(page) {
  const menu = await until(page, (s) => typeof s.phase === "string", 15_000);
  if (menu === null) fail("the page has no test surface: window.__game is not there after 15 s");
  await page.keyboard.press("Enter");
  const playing = await until(page, (s) => s.phase === "playing", 10_000);
  if (playing === null) fail(`Enter did not start a round: the phase is still "${(await snap(page))?.phase}"`);
  return playing;
}

/** Presses Enter until a round is being played, as a player who is not sure the screen is ready would. */
async function startAgain(page, ms) {
  const end = Date.now() + ms;
  for (;;) {
    await page.keyboard.press("Enter");
    const s = await until(page, (now) => now.phase === "playing", 500);
    if (s !== null) return s;
    if (Date.now() > end) return null;
  }
}

/** Holds keys for a while, as a player holds them. */
async function hold(page, keys, ms) {
  for (const key of keys) await page.keyboard.down(key);
  await sleep(ms);
  for (const key of keys) await page.keyboard.up(key);
  await sleep(120);
}

/**
 * A player who can aim. It reads where the nearest enemy is and where the view points, turns with the arrow keys test
 * mode gives (SPEC.md §7), fires when the line is good, reloads when empty, and backs away from an enemy that is close.
 * It stops when `done` is true of the surface, the round ends, or the time runs out, and gives back the last snapshot.
 */
async function play(page, done, ms) {
  const down = new Set();
  const set = async (key, on) => {
    if (on && !down.has(key)) {
      down.add(key);
      await page.keyboard.down(key);
    } else if (!on && down.has(key)) {
      down.delete(key);
      await page.keyboard.up(key);
    }
  };
  const release = async () => {
    for (const key of [...down]) await set(key, false);
  };
  const end = Date.now() + ms;
  let last = null;
  try {
    for (;;) {
      const s = await snap(page);
      last = s;
      if (s === null || done(s) || s.phase !== "playing" || Date.now() > end) return last;
      if (s.view !== "first") {
        await page.keyboard.press("KeyV");
        await sleep(100);
        continue;
      }
      if (s.player.ammo === 0) {
        // One press, then wait for the magazine: a second press might start the reload over.
        await release();
        await page.keyboard.press("KeyR");
        await until(page, (now) => now.player.ammo > 0 || now.phase !== "playing", 5000);
        continue;
      }
      const alive = s.enemies.filter((enemy) => enemy.alive);
      if (alive.length === 0) {
        await release();
        await sleep(50);
        continue;
      }
      const target = alive.reduce((a, b) => (len(sub(a.position, s.player.position)) <= len(sub(b.position, s.player.position)) ? a : b));
      const to = sub(target.position, s.camera.position);
      const far = len(to);
      const d = unit(to);
      const f = unit(s.player.forward);
      const across = Math.atan2(dot(flat(d), rightOf(f)), dot(flat(d), unit(flat(f))));
      const up = Math.asin(Math.max(-1, Math.min(1, d.y))) - Math.asin(Math.max(-1, Math.min(1, f.y)));
      // A body is 0.6 m across or more (SPEC.md section 3): aim within 0.2 m of its middle, so there is room to spare.
      const good = Math.max(0.008, Math.atan(0.2 / far));
      await set("KeyS", far < 8);
      if (Math.abs(across) < good && Math.abs(up) < good) {
        await set("ArrowLeft", false);
        await set("ArrowRight", false);
        await set("ArrowUp", false);
        await set("ArrowDown", false);
        await page.mouse.down();
        await page.mouse.up();
        await sleep(120);
        continue;
      }
      // Far off the line: hold the key. Close to it: a short press, so the view does not swing past.
      const turn = async (plus, minus, error) => {
        const key = error > 0 ? plus : minus;
        await set(error > 0 ? minus : plus, false);
        if (Math.abs(error) < good * 0.6) await set(key, false);
        else if (Math.abs(error) > 0.1) await set(key, true);
        else {
          await set(key, true);
          await sleep(18);
          await set(key, false);
        }
      };
      await turn("ArrowRight", "ArrowLeft", across);
      await turn("ArrowUp", "ArrowDown", up);
      await sleep(25);
    }
  } finally {
    await release();
  }
}

/** A PNG's pixels, enough of the format for a screenshot: 8 bits a channel, RGB or RGBA, not interlaced. */
function pixels(png) {
  let at = 8;
  let width = 0;
  let height = 0;
  let channels = 4;
  const data = [];
  while (at < png.length) {
    const size = png.readUInt32BE(at);
    const type = png.toString("latin1", at + 4, at + 8);
    const body = png.subarray(at + 8, at + 8 + size);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      channels = body[9] === 6 ? 4 : 3;
    } else if (type === "IDAT") data.push(body);
    at += 12 + size;
  }
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x += 1) {
      const value = raw[y * (stride + 1) + 1 + x];
      const a = x >= channels ? out[y * stride + x - channels] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0;
      const p = a + b - c;
      const paeth = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c;
      out[y * stride + x] = (value + [0, a, b, (a + b) >> 1, paeth][filter]) & 255;
    }
  }
  return { width, height, channels, data: out };
}

// ─── the checks ──────────────────────────────────────────────────────────────

/** Each check: an id, what a player can do (LIST.md's words), and a function that does it and says what it saw. */
const CHECKS = [
  {
    id: "opens",
    does: "The page opens: no error, no file of its own missing, nothing asked of another host",
    async run({ page, trouble }) {
      await sleep(1500);
      // The menu, and then a few seconds of a round: a game may fetch when play starts.
      await page.keyboard.press("Enter");
      await sleep(3000);
      // The browser reports a refused request as a console error of its own; it is named as what it is, below.
      const errors = trouble.errors.filter((e) => !(trouble.outside.length > 0 && e.startsWith("console: Failed to load resource")));
      const wrong = [];
      if (trouble.outside.length > 0) wrong.push(`the page asked another host: ${trouble.outside[0]}`);
      if (trouble.failed.length > 0) wrong.push(`a file of the page's own did not load: ${trouble.failed[0]}`);
      if (errors.length > 0) wrong.push(`the page raised ${errors.length} error(s): ${errors[0]}`);
      if (wrong.length > 0) fail(wrong.join("; "));
      return "no error, no failed request, no request to another host";
    },
  },
  {
    id: "drawn",
    does: "Something is drawn: the picture is not one flat color",
    async run({ page }) {
      // The round's own picture when a round starts; the menu's when it does not.
      await until(page, () => true, 5000);
      await page.keyboard.press("Enter");
      await sleep(1000);
      const shot = pixels(await page.screenshot());
      const counts = new Map();
      let samples = 0;
      for (let y = 4; y < shot.height; y += 8) {
        for (let x = 4; x < shot.width; x += 8) {
          const i = (y * shot.width + x) * shot.channels;
          // Colors within a few steps of each other count as one: a gradient or a dither is still drawing.
          const key = `${shot.data[i] >> 3},${shot.data[i + 1] >> 3},${shot.data[i + 2] >> 3}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
          samples += 1;
        }
      }
      const most = Math.max(...counts.values()) / samples;
      if (counts.size < 4 || most > 0.9) fail(`the picture is one flat color: ${counts.size} color(s), the commonest covering ${round(most * 100, 1)}% of it`);
      return `${counts.size} colors, the commonest covering ${round(most * 100, 1)}%`;
    },
  },
  {
    id: "surface",
    does: "The test surface is there and whole: window.__game, as SPEC.md §7 describes it",
    async run({ page }) {
      const s = await until(page, () => true, 15_000);
      if (s === null) fail("window.__game is not there after 15 s");
      const vector = (v) => v !== null && typeof v === "object" && ["x", "y", "z"].every((k) => typeof v[k] === "number" && Number.isFinite(v[k]));
      const wrong = [];
      if (s.surface !== 1) wrong.push("surface is not 1");
      if (!["menu", "playing", "paused", "won", "lost"].includes(s.phase)) wrong.push(`phase is ${JSON.stringify(s.phase)}`);
      if (s.phase !== "menu") wrong.push(`the page does not open on the menu (phase ${JSON.stringify(s.phase)})`);
      if (s.seed !== SEED) wrong.push(`seed is ${JSON.stringify(s.seed)}, not ${SEED}`);
      if (s.test !== true) wrong.push("test is not true");
      if (!["first", "third"].includes(s.view)) wrong.push(`view is ${JSON.stringify(s.view)}`);
      if (!s.player || !vector(s.player.position) || !vector(s.player.forward)) wrong.push("player.position or player.forward is not a vector");
      for (const key of ["health", "maxHealth", "ammo", "reserve"]) if (typeof s.player?.[key] !== "number") wrong.push(`player.${key} is not a number`);
      if (typeof s.player?.grounded !== "boolean") wrong.push("player.grounded is not a boolean");
      if (!vector(s.camera?.position)) wrong.push("camera.position is not a vector");
      if (!Array.isArray(s.enemies)) wrong.push("enemies is not a list");
      for (const key of ["score", "wave", "waves", "time", "frames"]) if (typeof s[key] !== "number") wrong.push(`${key} is not a number`);
      if (s.enemies.length !== 0 || s.score !== 0 || s.wave !== 0 || s.time !== 0) wrong.push(`on the menu there are ${s.enemies.length} enemies, score ${s.score}, wave ${s.wave}, time ${s.time}`);
      if (s.player.health !== s.player.maxHealth || !(s.player.ammo > 0)) wrong.push(`on the menu the player has health ${s.player.health} of ${s.player.maxHealth} and ammunition ${s.player.ammo}`);
      if (wrong.length > 0) fail(wrong.join("; "));
      // Nothing written to it changes the game. A few pictures later the game says what it said before.
      await page.evaluate(() => {
        try {
          window.__game.player.health = 1;
          window.__game.phase = "won";
        } catch {}
      });
      await sleep(300);
      const kept = await snap(page);
      if (kept.phase !== "menu" || kept.player.health !== s.player.health) fail("writing to window.__game changed the game: the surface is not read-only");
      // A started round holds its wave, each enemy of the right shape, from the moment it is being played.
      const playing = await start(page);
      const bad = playing.enemies.filter((e) => typeof e.id !== "string" || typeof e.kind !== "string" || !vector(e.position) || typeof e.health !== "number" || typeof e.alive !== "boolean");
      if (playing.enemies.length === 0 || bad.length > 0) fail(`a started round has ${playing.enemies.length} enemies, ${bad.length} of them not {id, kind, position, health, alive}`);
      return `every field as described; ${playing.enemies.length} enemies in the test round`;
    },
  },
  {
    id: "start",
    does: "A round starts: from the menu to playing",
    async run({ page }) {
      const s = await start(page);
      if (s.player.health <= 0 || s.player.ammo <= 0) fail(`the round starts with health ${s.player.health} and ammunition ${s.player.ammo}`);
      const later = await until(page, (now) => now.time > s.time, 3000);
      if (later === null) fail("the round's clock does not run: time stays where it was");
      return `playing, health ${s.player.health}, ammunition ${s.player.ammo}, the clock running`;
    },
  },
  {
    id: "walk",
    does: "W walks forward and S walks back",
    async run({ page }) {
      const a = await start(page);
      await hold(page, ["KeyW"], 1000);
      const b = await snap(page);
      const went = flat(sub(b.player.position, a.player.position));
      const ahead = unit(flat(a.player.forward));
      if (len(went) < 1) fail(`holding W for a second moved the player ${round(len(went))} m`);
      if (dot(unit(went), ahead) < 0.8) fail(`holding W moved the player ${round(len(went))} m, but not the way the view points`);
      await hold(page, ["KeyS"], 1000);
      const c = await snap(page);
      const back = flat(sub(c.player.position, b.player.position));
      if (len(back) < 1 || dot(unit(back), ahead) > -0.8) fail(`holding S for a second moved the player ${round(len(back))} m, not backward`);
      return `W: ${round(len(went))} m forward in a second; S: ${round(len(back))} m back`;
    },
  },
  {
    id: "strafe",
    does: "D steps right and A steps left",
    async run({ page }) {
      const a = await start(page);
      const right = rightOf(a.player.forward);
      await hold(page, ["KeyD"], 1000);
      const b = await snap(page);
      const went = flat(sub(b.player.position, a.player.position));
      if (len(went) < 1 || dot(unit(went), right) < 0.8) fail(`holding D for a second moved the player ${round(len(went))} m, not to the right of where the view points`);
      await hold(page, ["KeyA"], 1000);
      const c = await snap(page);
      const back = flat(sub(c.player.position, b.player.position));
      if (len(back) < 1 || dot(unit(back), right) > -0.8) fail(`holding A for a second moved the player ${round(len(back))} m, not to the left`);
      return `D: ${round(len(went))} m right; A: ${round(len(back))} m left`;
    },
  },
  {
    id: "look",
    does: "The mouse turns the view: right turns right, up looks up",
    async run({ page }) {
      const a = await start(page);
      await page.mouse.move(640, 360);
      await page.mouse.move(840, 360, { steps: 10 });
      const b = await snap(page);
      const turned = Math.atan2(dot(flat(unit(b.player.forward)), rightOf(a.player.forward)), dot(flat(unit(b.player.forward)), unit(flat(a.player.forward))));
      if (degrees(turned) < 2) fail(`moving the mouse 200 px right turned the view ${round(degrees(turned), 1)} degrees to the right`);
      await page.mouse.move(840, 260, { steps: 10 });
      const c = await snap(page);
      if (c.player.forward.y - b.player.forward.y < 0.03) fail(`moving the mouse 100 px up did not raise the view (forward.y ${round(b.player.forward.y)} to ${round(c.player.forward.y)})`);
      return `200 px right: ${round(degrees(turned), 1)} degrees right; 100 px up: forward.y ${round(b.player.forward.y)} to ${round(c.player.forward.y)}`;
    },
  },
  {
    id: "turn",
    does: "In test mode the arrow keys turn the view, so a script can aim",
    async run({ page }) {
      const a = await start(page);
      await hold(page, ["ArrowRight"], 500);
      const b = await snap(page);
      const turned = degrees(Math.atan2(dot(flat(unit(b.player.forward)), rightOf(a.player.forward)), dot(flat(unit(b.player.forward)), unit(flat(a.player.forward)))));
      if (turned < 15 || turned > 60) fail(`holding the right arrow for half a second turned the view ${round(turned, 1)} degrees right; 60 degrees a second is 30`);
      await hold(page, ["ArrowUp"], 500);
      const c = await snap(page);
      const raised = degrees(Math.asin(c.player.forward.y) - Math.asin(b.player.forward.y));
      if (raised < 7 || raised > 30) fail(`holding the up arrow for half a second raised the view ${round(raised, 1)} degrees; 30 degrees a second is 15`);
      return `right arrow, half a second: ${round(turned, 1)} degrees; up arrow: ${round(raised, 1)} degrees`;
    },
  },
  {
    id: "jump",
    does: "Space jumps, and the player comes down again",
    async run({ page }) {
      const a = await start(page);
      await page.keyboard.down("Space");
      const top = await until(page, (s) => s.player.position.y - a.player.position.y >= 0.3, 1500);
      await page.keyboard.up("Space");
      if (top === null) fail("Space did not lift the player 0.3 m within a second and a half");
      const down = await until(page, (s) => Math.abs(s.player.position.y - a.player.position.y) < 0.15 && s.player.grounded, 4000);
      if (down === null) fail(`the player did not land: height ${round((await snap(page)).player.position.y)} m four seconds after the jump`);
      return `up at least ${round(top.player.position.y - a.player.position.y)} m, and down again`;
    },
  },
  {
    id: "world",
    does: "The arena holds the player: a sprint in one direction ends at its edge, not outside it or under it",
    async run({ page }) {
      const a = await start(page);
      // Turn away from the enemies, so that what stops the player is the arena and not a fight.
      await hold(page, ["ArrowRight"], 3000);
      await page.keyboard.down("ShiftLeft");
      await page.keyboard.down("KeyW");
      let lowest = a.player.position.y;
      let farthest = 0;
      let s = a;
      const end = Date.now() + 45_000;
      while (Date.now() < end) {
        await sleep(250);
        s = await snap(page);
        lowest = Math.min(lowest, s.player.position.y);
        farthest = Math.max(farthest, len(flat(sub(s.player.position, a.player.position))));
      }
      await page.keyboard.up("KeyW");
      await page.keyboard.up("ShiftLeft");
      const p = s.player.position;
      if (![p.x, p.y, p.z].every(Number.isFinite)) fail("the player's position is no longer a number");
      if (lowest < a.player.position.y - 20) fail(`the player fell ${round(a.player.position.y - lowest, 1)} m below where the round started`);
      // The arena is about 120 m across, corner to corner about 170: nobody inside it gets 200 m from where they began,
      // and 45 seconds of sprinting at 6 m a second or more would take a player past that if nothing stopped them.
      if (farthest > 200) fail(`the player ran ${round(farthest, 1)} m from the start and was not stopped: the arena has no edge there`);
      if (farthest < 5) fail(`45 seconds of sprinting moved the player ${round(farthest, 1)} m`);
      return `a 45-second sprint ended ${round(farthest, 1)} m from the start, at ${where(p)}, never more than ${round(Math.max(0, a.player.position.y - lowest), 1)} m below it`;
    },
  },
  {
    id: "view",
    does: "V switches between first and third person, and the camera moves with it",
    async run({ page }) {
      const a = await start(page);
      if (a.view !== "first") fail(`a round starts in ${a.view} person, not first`);
      const head = len(sub(a.camera.position, a.player.position));
      if (head > 2.5) fail(`in first person the camera is ${round(head)} m from the player's feet`);
      await page.keyboard.press("KeyV");
      const b = await until(page, (s) => s.view === "third", 2000);
      if (b === null) fail("V did not switch the view to third person");
      // Third person: the camera has left the eyes, by a meter and a half or more, to somewhere behind the player.
      // The eyes are where the first-person camera stood above the feet. A camera may glide there, so it is given time.
      const eyes = (s) => ({ x: s.player.position.x + (a.camera.position.x - a.player.position.x), y: s.player.position.y + (a.camera.position.y - a.player.position.y), z: s.player.position.z + (a.camera.position.z - a.player.position.z) });
      const out = (s) => sub(s.camera.position, eyes(s));
      const c = await until(page, (s) => len(out(s)) >= 1.5 && dot(flat(out(s)), flat(unit(s.player.forward))) < 0, 2500);
      if (c === null) {
        const now = await snap(page);
        fail(`in third person the camera is ${round(len(out(now)))} m from where the eyes are${dot(flat(out(now)), flat(unit(now.player.forward))) >= 0 ? ", and not behind the player" : ""}`);
      }
      if (len(out(c)) > 12) fail(`in third person the camera is ${round(len(out(c)))} m from the eyes`);
      await page.keyboard.press("KeyV");
      const d = await until(page, (s) => s.view === "first" && len(out(s)) < 0.5, 2500);
      if (d === null) fail("V did not bring the view and the camera back to first person");
      return `first person: camera ${round(head)} m above the feet; third: ${round(len(out(c)))} m from the eyes, behind; and back`;
    },
  },
  {
    id: "fire",
    does: "A click fires, and a shot uses ammunition",
    async run({ page }) {
      const a = await start(page);
      await page.mouse.down();
      await page.mouse.up();
      const b = await until(page, (s) => s.player.ammo < a.player.ammo, 2000);
      if (b === null) fail(`a click left the ammunition at ${a.player.ammo}`);
      return `ammunition ${a.player.ammo} to ${b.player.ammo}`;
    },
  },
  {
    id: "hit",
    does: "A shot that lands lowers a target's health, and one aimed away does not",
    async run({ page }) {
      const a = await start(page);
      const total = (s) => s.enemies.reduce((n, e) => n + e.health, 0);
      // Away first: the test round's enemies are within 45 degrees of ahead, so two seconds of turning leaves none in line.
      await hold(page, ["ArrowRight"], 2000);
      for (let i = 0; i < 2; i += 1) {
        await page.mouse.down();
        await page.mouse.up();
        await sleep(250);
      }
      const away = await snap(page);
      if (total(away) < total(a)) fail("a shot fired away from every enemy lowered an enemy's health: clicks land wherever they point");
      const b = await play(page, (s) => total(s) < total(a), wait(45_000));
      if (b === null || total(b) >= total(a)) fail(`aimed shots for ${wait(45_000) / 1000} s lowered no enemy's health (the round is ${b?.phase}; ammunition ${b?.player.ammo})`);
      const target = b.enemies.find((e) => e.health < a.enemies.find((was) => was.id === e.id)?.health);
      return `aimed away: nothing; aimed: ${target?.id ?? "an enemy"} from health ${a.enemies.find((was) => was.id === target?.id)?.health} to ${target?.health}`;
    },
  },
  {
    id: "defeat",
    does: "An enemy can be defeated, and the score says so",
    async run({ page }) {
      const a = await start(page);
      const b = await play(page, (s) => s.enemies.some((e) => !e.alive), wait(90_000));
      if (b === null || !b.enemies.some((e) => !e.alive)) fail(`no enemy was defeated in ${wait(90_000) / 1000} s of aimed shots (the round is ${b?.phase})`);
      const c = await until(page, (s) => s.score > a.score, 2000);
      if (c === null) fail(`an enemy was defeated and the score stayed at ${b.score}`);
      return `${b.enemies.filter((e) => !e.alive).length} defeated; score ${a.score} to ${c.score}`;
    },
  },
  {
    id: "reload",
    does: "R reloads from the reserve",
    async run({ page }) {
      const a = await start(page);
      for (let i = 0; i < 3; i += 1) {
        await page.mouse.down();
        await page.mouse.up();
        await sleep(250);
      }
      const b = await snap(page);
      if (b.player.ammo >= a.player.ammo) fail("three clicks used no ammunition, so there is nothing to reload");
      await page.keyboard.press("KeyR");
      const c = await until(page, (s) => s.player.ammo > b.player.ammo, 5000);
      if (c === null) fail(`R left the ammunition at ${b.player.ammo}`);
      if (c.player.reserve >= b.player.reserve) fail(`R filled the weapon and the reserve stayed at ${b.player.reserve}`);
      return `ammunition ${b.player.ammo} to ${c.player.ammo}, reserve ${b.player.reserve} to ${c.player.reserve}`;
    },
  },
  {
    id: "threat",
    does: "An enemy reaches a player who stands still, and hurts",
    async run({ page }) {
      const a = await start(page);
      const b = await until(page, (s) => s.player.health < a.player.health, wait(60_000));
      if (b === null) fail(`a player who stood still for ${wait(60_000) / 1000} s was not hurt`);
      const near = Math.min(...b.enemies.filter((e) => e.alive).map((e) => len(flat(sub(e.position, b.player.position)))));
      // A chaser strikes from within 3 m (SPEC.md section 7); a little more is allowed for the step it took since.
      if (!(near <= 5)) fail(`the player was hurt with the nearest enemy ${round(near, 1)} m away: something other than a chaser's strike did it`);
      return `health ${a.player.health} to ${b.player.health} after ${round(b.time, 1)} s; the nearest enemy ${round(near, 1)} m away`;
    },
  },
  {
    id: "lose",
    does: "A round can be lost",
    async run({ page }) {
      await start(page);
      const b = await until(page, (s) => s.phase === "lost", wait(120_000));
      if (b === null) {
        const now = await snap(page);
        fail(`a player who stood still for ${wait(120_000) / 1000} s did not lose: the round is ${now.phase}, health ${now.player.health}`);
      }
      if (b.player.health > 0) fail(`the round is lost with health ${b.player.health}`);
      return `lost after ${round(b.time, 1)} s, health 0`;
    },
  },
  {
    id: "again",
    does: "After a round ends, Enter starts another",
    async run({ page }) {
      await start(page);
      const lost = await until(page, (s) => s.phase === "lost", wait(120_000));
      if (lost === null) fail("the round did not end, so there is no second one to start");
      const b = await startAgain(page, 10_000);
      if (b === null) fail("Enter after a lost round did not start another within ten seconds");
      if (b.player.health !== b.player.maxHealth || b.score !== 0 || b.enemies.filter((e) => e.alive).length === 0) fail(`the second round starts with health ${b.player.health} of ${b.player.maxHealth}, score ${b.score} and ${b.enemies.filter((e) => e.alive).length} enemies alive`);
      return `a second round: health ${b.player.health}, score 0, ${b.enemies.length} enemies`;
    },
  },
  {
    id: "win",
    does: "A round can be won",
    async run({ page }) {
      await start(page);
      const b = await play(page, (s) => s.phase === "won", wait(180_000));
      const now = (await snap(page)) ?? b;
      if (now?.phase !== "won") fail(`${wait(180_000) / 1000} s of aimed shots did not win the test round: the round is ${now?.phase}, ${now?.enemies.filter((e) => e.alive).length} enemies alive, health ${now?.player.health}`);
      return `won after ${round(now.time, 1)} s, health ${now.player.health}, score ${now.score}`;
    },
  },
  {
    id: "seed",
    does: "The same seed starts the same round; another seed starts another",
    async run({ page }) {
      const first = (await start(page)).enemies;
      const again = await open(SEED);
      const other = await open(SEED + 1);
      try {
        const second = (await start(again.page)).enemies;
        const third = (await start(other.page)).enemies;
        const apart = (a, b) => Math.max(...a.map((e, i) => (b[i] ? len(sub(e.position, b[i].position)) : Infinity)));
        if (first.length !== second.length || apart(first, second) > 2) fail(`two visits with seed ${SEED} started ${round(apart(first, second), 1)} m apart`);
        if (apart(first, third) < 2) fail(`seed ${SEED} and seed ${SEED + 1} started the same round: the seed is not read`);
        return `seed ${SEED} twice: within ${round(apart(first, second), 1)} m; seed ${SEED + 1}: ${round(apart(first, third), 1)} m away`;
      } finally {
        await again.context.close();
        await other.context.close();
      }
    },
  },
  {
    id: "frames",
    does: "The picture keeps up: 30 frames a second or more on a still scene",
    async run({ page }) {
      await start(page);
      // The game's own count of pictures drawn, over eight seconds; and beside it how long the browser's frames took,
      // which says whether drawing them held the page up. (Timing the browser alone would pass a game that draws
      // eight pictures a second on a timer: the proof against the stand-ins found exactly that.)
      const seen = await page.evaluate(
        () =>
          new Promise((done) => {
            const gaps = [];
            const began = performance.now();
            const first = window.__game.frames;
            let last = began;
            const tick = (now) => {
              gaps.push(now - last);
              last = now;
              if (now < began + 8000) requestAnimationFrame(tick);
              else done({ drawn: window.__game.frames - first, seconds: (now - began) / 1000, gaps });
            };
            requestAnimationFrame(tick);
          }),
      );
      const sorted = [...seen.gaps].sort((a, b) => a - b);
      const slow = sorted[Math.floor(sorted.length * 0.95)];
      const rate = round(seen.drawn / seen.seconds, 1);
      const window_ = flag("--headed") ? "" : " (no window)";
      if (!(rate >= 30)) fail(`${rate} pictures a second: the game drew ${seen.drawn} in ${round(seen.seconds, 1)} s${flag("--headed") ? "" : "; run with --headed for a real game, since a browser with no window draws 3D on the processor"}`);
      if (slow > 50) fail(`${rate} pictures a second, but 1 browser frame in 20 took ${round(slow, 1)} ms or more: it stutters${window_}`);
      return `${rate} pictures a second; 19 browser frames in 20 took ${round(slow, 1)} ms or less${window_}`;
    },
  },
];

// ─── running them ────────────────────────────────────────────────────────────

const results = [];
for (const check of CHECKS) {
  if (only && !only.includes(check.id)) continue;
  const began = Date.now();
  let visitOpen;
  let result;
  try {
    visitOpen = await open();
    result = { id: check.id, does: check.does, passed: true, saw: await check.run(visitOpen) };
  } catch (error) {
    // A check that breaks for a reason of its own (a missing field read as a number, say) is a failure of the page too.
    result = { id: check.id, does: check.does, passed: false, saw: error instanceof Fail ? error.message : `the check could not finish: ${String(error?.message ?? error).split("\n")[0]}` };
  } finally {
    await visitOpen?.context.close().catch(() => undefined);
  }
  result.seconds = round((Date.now() - began) / 1000, 1);
  results.push(result);
  console.log(`${result.passed ? "pass" : "FAIL"}  ${check.id.padEnd(8)} ${check.does}\n      ${result.saw}`);
}
await browser.close();

// A page that asked another host during any check did so as the game: `opens` answers for all of them.
const opens = results.find((r) => r.id === "opens");
if (opens?.passed && everOutside.length > 0) {
  opens.passed = false;
  opens.saw = `during a later check the page asked another host: ${everOutside[0]}`;
  console.log(`FAIL  opens    (changed after the other checks ran)\n      ${opens.saw}`);
}

const failed = results.filter((r) => !r.passed);
console.log(`\n${results.length - failed.length} of ${results.length} checks pass${failed.length > 0 ? `; failing: ${failed.map((r) => r.id).join(", ")}` : ""}`);
const out = option("--json");
if (out) writeFileSync(out, `${JSON.stringify({ address, results }, null, 2)}\n`);
process.exit(failed.length > 0 ? 1 : 0);
