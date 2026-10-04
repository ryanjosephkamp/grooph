/*
 * A stand-in for the game (handoff 0082): the test surface of experiments/game/SPEC.md §7 on a page with no game behind
 * it, so the held-out checks can be shown to pass and to fail before any game exists.
 *
 * It is a flat drawing seen from above, not three.js: a player, three chasers, a rifle that hits what it points at.
 * Everything a check looks at is here and nothing else is. It is not a start for the game and is never given to a
 * builder.
 *
 * `window.STAND_IN_BREAK`, or `?break=a,b` in the address, turns behaviors off by name, one for each thing a check
 * should catch. good.html sets none; broken.html sets every one. The names are in BREAKS below.
 */
(function () {
  const BREAKS = ["error", "outside", "blank", "surface", "start", "move", "strafe", "look", "turn", "jump", "fall", "wall", "view", "ammo", "aimless", "damage", "defeat", "reload", "chase", "ambient", "lose", "restart", "win", "slow", "seed"];
  const params = new URLSearchParams(location.search);
  const named = window.STAND_IN_BREAK === "all" ? BREAKS : (window.STAND_IN_BREAK || params.get("break") || "").split(",").filter(Boolean);
  const broken = (name) => named.includes(name);

  const test = params.get("test") === "1";
  const seedText = params.get("seed");
  const seed = seedText !== null && /^\d+$/.test(seedText) ? Number(seedText) : null;

  /* mulberry32: the same numbers for the same seed. */
  function randomFrom(start) {
    let a = start >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const random = seed === null || broken("seed") ? Math.random : randomFrom(seed);

  const EYE = 1.7;
  const state = {
    phase: "menu",
    view: "first",
    x: 0,
    y: 0,
    z: 0,
    vy: 0,
    yaw: 0, // 0 looks along -z; positive turns to the right, seen from above
    pitch: 0,
    health: 100,
    ammo: 12,
    reserve: 48,
    enemies: [],
    score: 0,
    time: 0,
    frames: 0,
  };
  const keys = new Set();

  function forward() {
    const c = Math.cos(state.pitch);
    return { x: Math.sin(state.yaw) * c, y: Math.sin(state.pitch), z: -Math.cos(state.yaw) * c };
  }
  function camera() {
    const eye = { x: state.x, y: state.y + EYE, z: state.z };
    if (state.view === "first" || broken("view")) return eye;
    // Over the shoulder: behind the player and a little above.
    return { x: state.x - Math.sin(state.yaw) * 4, y: state.y + EYE + 0.8, z: state.z + Math.cos(state.yaw) * 4 };
  }

  function startRound() {
    Object.assign(state, { phase: "playing", view: "first", x: 0, y: 0, z: 0, vy: 0, yaw: 0, pitch: 0, health: 100, ammo: 12, reserve: 48, score: 0, time: 0 });
    // The test round of SPEC.md §7: three chasers, 20 to 30 m away, within 45 degrees of where the player faces.
    state.enemies = [0, 1, 2].map((i) => {
      const angle = (random() - 0.5) * (Math.PI / 2);
      const far = 20 + random() * 10;
      return { id: "chaser-" + (i + 1), kind: "chaser", x: Math.sin(angle) * far, y: 1, z: -Math.cos(angle) * far, health: 100, alive: true, hitAt: 0 };
    });
  }

  function fire() {
    if (state.phase !== "playing" || state.ammo <= 0) return;
    if (!broken("ammo")) state.ammo -= 1;
    const from = { x: state.x, y: state.y + EYE, z: state.z };
    const f = forward();
    let hit = null;
    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      const d = { x: enemy.x - from.x, y: enemy.y - from.y, z: enemy.z - from.z };
      const far = Math.hypot(d.x, d.y, d.z);
      const along = (d.x * f.x + d.y * f.y + d.z * f.z) / far;
      // A body 0.6 m across: hit when the line of fire passes within it.
      // "aimless": every click lands on someone, wherever it points.
      const inLine = along > 0 && Math.acos(Math.min(1, along)) < Math.atan(0.3 / far);
      if ((inLine || broken("aimless")) && (hit === null || far < hit.far)) hit = { enemy, far };
    }
    if (hit === null || broken("damage")) return;
    hit.enemy.health = Math.max(0, hit.enemy.health - 34);
    if (hit.enemy.health === 0 && !broken("defeat")) {
      hit.enemy.alive = false;
      state.score += 100;
    }
  }

  addEventListener("keydown", (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === "Enter" && test && !broken("start")) {
      if (state.phase === "menu") startRound();
      else if ((state.phase === "won" || state.phase === "lost") && !broken("restart")) startRound();
    }
    if (state.phase !== "playing") return;
    if (event.code === "KeyV") state.view = state.view === "first" ? "third" : "first";
    if (event.code === "Space" && state.y === 0 && !broken("jump")) state.vy = 5;
    if (event.code === "KeyR" && !broken("reload")) {
      const take = Math.min(12 - state.ammo, state.reserve);
      state.ammo += take;
      state.reserve -= take;
    }
  });
  addEventListener("keyup", (event) => keys.delete(event.code));
  addEventListener("mousedown", (event) => {
    if (event.button === 0) fire();
  });
  addEventListener("mousemove", (event) => {
    if (state.phase !== "playing" || broken("look")) return;
    state.yaw += event.movementX * 0.0025;
    state.pitch = Math.max(-1.4, Math.min(1.4, state.pitch - event.movementY * 0.0025));
  });

  function step(dt) {
    if (state.phase !== "playing") return;
    state.time += dt;
    if (test && !broken("turn")) {
      // Test mode: the arrow keys turn the view, 60 degrees a second across and 30 up and down.
      const across = (keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0);
      const up = (keys.has("ArrowUp") ? 1 : 0) - (keys.has("ArrowDown") ? 1 : 0);
      state.yaw += across * (Math.PI / 3) * dt;
      state.pitch = Math.max(-1.4, Math.min(1.4, state.pitch + up * (Math.PI / 6) * dt));
    }
    if (!broken("move")) {
      const ahead = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
      const side = ((keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0)) * (broken("strafe") ? -1 : 1);
      const speed = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 9 : 5;
      state.x += (Math.sin(state.yaw) * ahead + Math.cos(state.yaw) * side) * speed * dt;
      state.z += (-Math.cos(state.yaw) * ahead + Math.sin(state.yaw) * side) * speed * dt;
      // The arena's wall: a square 60 m from the middle. "wall": there is none.
      if (!broken("wall")) {
        state.x = Math.max(-60, Math.min(60, state.x));
        state.z = Math.max(-60, Math.min(60, state.z));
      }
    }
    state.vy -= 12 * dt;
    state.y += state.vy * dt;
    if (broken("fall")) {
      // No ground: the player falls out of the world.
    } else if (state.y <= 0) {
      state.y = 0;
      state.vy = 0;
    }
    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      const dx = state.x - enemy.x;
      const dz = state.z - enemy.z;
      const far = Math.hypot(dx, dz);
      if (far > 1.5) {
        if (!broken("chase")) {
          enemy.x += (dx / far) * 3 * dt;
          enemy.z += (dz / far) * 3 * dt;
        }
      } else if (state.time - enemy.hitAt > 0.5) {
        enemy.hitAt = state.time;
        state.health = Math.max(0, state.health - 10);
      }
    }
    // "ambient": the player is hurt by nothing at all, a little every second.
    if (broken("ambient") && Math.floor(state.time) > Math.floor(state.time - dt)) state.health = Math.max(0, state.health - 5);
    if (state.health === 0 && !broken("lose")) state.phase = "lost";
    else if (state.enemies.every((enemy) => !enemy.alive) && !broken("win")) state.phase = "won";
  }

  const canvas = document.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  function draw() {
    state.frames += 1;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = "#16241f";
    ctx.fillRect(0, 0, w, h);
    if (broken("blank")) return;
    const scale = 8; // pixels to the meter
    const at = (x, z) => [w / 2 + (x - state.x) * scale, h / 2 + (z - state.z) * scale];
    // The arena's floor, in tiles ten meters across.
    for (let gx = -60; gx < 60; gx += 10) {
      for (let gz = -60; gz < 60; gz += 10) {
        const [px, pz] = at(gx, gz);
        ctx.fillStyle = (gx + gz) % 20 === 0 ? "#0d261f" : "#183129";
        ctx.fillRect(px, pz, 10 * scale, 10 * scale);
      }
    }
    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      const [ex, ez] = at(enemy.x, enemy.z);
      ctx.fillStyle = "#eb9a45";
      ctx.beginPath();
      ctx.arc(ex, ez, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    const f = forward();
    ctx.fillStyle = "#64eab7";
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#64eab7";
    ctx.beginPath();
    ctx.moveTo(w / 2, h / 2);
    ctx.lineTo(w / 2 + f.x * 40, h / 2 + f.z * 40);
    ctx.stroke();
    ctx.fillStyle = "#edf4f0";
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillText(`${state.phase} · ${state.view} person · health ${state.health} · ammo ${state.ammo}/${state.reserve} · score ${state.score}`, 16, 28);
    if (state.phase === "menu") ctx.fillText("A stand-in for the game. With ?test=1, Enter starts a round.", 16, 56);
  }

  /* The surface: a snapshot made when it is read. Nothing written to it changes anything. */
  Object.defineProperty(window, "__game", {
    get() {
      const snapshot = {
        surface: 1,
        phase: state.phase,
        seed,
        test,
        view: state.view,
        player: { position: { x: state.x, y: state.y, z: state.z }, forward: forward(), health: state.health, maxHealth: 100, ammo: state.ammo, reserve: state.reserve, grounded: state.y === 0 },
        camera: { position: camera() },
        enemies: state.enemies.map((enemy) => ({ id: enemy.id, kind: enemy.kind, position: { x: enemy.x, y: enemy.y, z: enemy.z }, health: enemy.health, alive: enemy.alive })),
        score: state.score,
        wave: state.phase === "menu" ? 0 : 1,
        waves: 1,
        time: state.time,
        frames: state.frames,
      };
      if (broken("surface")) delete snapshot.camera;
      return snapshot;
    },
  });

  let last = performance.now();
  function frame(now) {
    step(Math.min(0.1, (now - last) / 1000));
    last = now;
    draw();
    if (broken("slow")) setTimeout(() => requestAnimationFrame(frame), 110);
    else requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  if (broken("outside")) fetch("https://outside.example/telemetry", { mode: "no-cors" }).catch(() => undefined);
  if (broken("error")) setTimeout(() => {
    throw new Error("stand-in: an uncaught error, on purpose");
  }, 50);
})();
