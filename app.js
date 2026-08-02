const DEFAULT_BLINDS = [
  { sb: 1, bb: 2, ante: 0, note: "", rebuyEnd: false },
  { sb: 2, bb: 5, ante: 0, note: "", rebuyEnd: false },
  { sb: 5, bb: 10, ante: 0, note: "", rebuyEnd: false },
  { sb: 10, bb: 20, ante: 2, note: "", rebuyEnd: false },
  { type: "interval" },
  { sb: 25, bb: 50, ante: 5, note: "", rebuyEnd: false },
  { type: "interval" },
  { sb: 50, bb: 100, ante: 10, note: "", rebuyEnd: false },
  { type: "interval" },
  { sb: 100, bb: 200, ante: 25, note: "", rebuyEnd: true },
  { sb: 200, bb: 400, ante: 50, note: "", rebuyEnd: true },
  { sb: 500, bb: 1000, ante: 100, note: "", rebuyEnd: true },
  { sb: 1000, bb: 2000, ante: 200, note: "", rebuyEnd: true },
  { sb: 2000, bb: 4000, ante: 500, note: "", rebuyEnd: true },
  { sb: 4000, bb: 8000, ante: 800, note: "", rebuyEnd: true },
];

const BASE_RATIOS = {
  1: 0.3,
  5: 0.35,
  10: 0.35,
  25: 0.28,
  100: 0.45,
  500: 0.25,
  1000: 0.1,
};

const SOUND_BLIND = [
  { id: "alarm", label: "Despertador" },
  { id: "bell", label: "Sino" },
  { id: "fanfare", label: "Fanfarra" },
  { id: "chime", label: "Chime" },
  { id: "trumpet", label: "Trompete" },
  { id: "claxon", label: "Claxon" },
  { id: "beeps", label: "Bipes" },
];

const SOUND_SHOT = [
  { id: "beeps", label: "Bipes" },
  { id: "claxon", label: "Buzzer" },
  { id: "whistle", label: "Apito" },
  { id: "tick", label: "Tique" },
  { id: "alarm", label: "Alarme" },
  { id: "pulse", label: "Pulso" },
];

const SOUND_CHAMP = [
  { id: "fanfare", label: "Fanfarra" },
  { id: "victory", label: "Vitória" },
  { id: "trumpet", label: "Trompete" },
  { id: "chime", label: "Sino" },
];

const state = {
  levelTime: 15,
  blinds: JSON.parse(JSON.stringify(DEFAULT_BLINDS)),
  players: ["Patrick", "Mariana", "Camila", "Denis"],
  ranking: {},
  playerStatus: {},
  currentLevel: 0,
  timerSec: 0,
  timerRunning: false,
  shotClockRunning: false,
  shotClockSec: 30,
  shotClockTimer: null,
  mainTimer: null,
  intervalTimer: null,
  intervalSec: 0,
  chips: [
    { value: 1, color: "#b0aca5", name: "Cinza", total: 150 },
    { value: 5, color: "#c0392b", name: "Vermelha", total: 100 },
    { value: 10, color: "#2980b9", name: "Azul", total: 100 },
    { value: 25, color: "#27ae60", name: "Verde", total: 50 },
    { value: 100, color: "#4a5568", name: "Preta", total: 50 },
    { value: 500, color: "#8e44ad", name: "Roxa", total: 40 },
    { value: 1000, color: "#f39c12", name: "Amarela", total: 40 },
  ],
  stackTarget: 5000,
  thresholdUse500: 2500,
  thresholdUse1000: 8000,
  chipPerPlayer: [15, 12, 10, 10, 6, 4, 2],
  sounds: { blindEnd: "alarm", shotClock: "beeps", champion: "fanfare" },
};

function saveState() {
  localStorage.setItem("pokerState", JSON.stringify(state));
}

function loadState() {
  const saved = localStorage.getItem("pokerState");
  if (!saved) return;
  const parsed = JSON.parse(saved);
  Object.assign(state, parsed);
}

function autosave() {
  saveState();
}

function getLevelSeconds() {
  return state.levelTime * 60;
}

function isRebuyEnded() {
  for (let i = 0; i <= state.currentLevel; i++) {
    if (state.blinds[i] && state.blinds[i].rebuyEnd) return true;
  }
  return false;
}

function getNextRebuyEndLevelIndex() {
  for (let i = state.currentLevel + 1; i < state.blinds.length; i++) {
    const b = state.blinds[i];
    if (b && b.type !== "interval" && b.rebuyEnd) return i;
  }
  return -1;
}

function isLastRoundBeforeRebuyEnd() {
  const nextEndIndex = getNextRebuyEndLevelIndex();
  if (nextEndIndex === -1) return false;
  let prev = nextEndIndex - 1;
  while (
    prev >= 0 &&
    state.blinds[prev] &&
    state.blinds[prev].type === "interval"
  ) {
    prev -= 1;
  }
  return prev === state.currentLevel;
}

let actx = null;

function getAC() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  return actx;
}

function playTone(ac, freq, start, dur, type = "sine", gain = 0.3) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.connect(g);
  g.connect(ac.destination);
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  o.start(start);
  o.stop(start + dur + 0.05);
}

function playSound(type) {
  const ac = getAC();
  const key =
    type === "blindEnd"
      ? state.sounds.blindEnd
      : type === "shotClock"
      ? state.sounds.shotClock
      : state.sounds.champion;
  const t = ac.currentTime;

  if (key === "alarm") {
    for (let i = 0; i < 6; i++)
      playTone(
        ac,
        i % 2 === 0 ? 800 : 600,
        t + i * 0.15,
        0.12,
        "sawtooth",
        0.25,
      );
  } else if (key === "beeps") {
    for (let i = 0; i < 3; i++)
      playTone(ac, 880, t + i * 0.25, 0.15, "square", 0.2);
  } else if (key === "fanfare") {
    [523, 659, 784, 1047].forEach((f, i) =>
      playTone(ac, f, t + i * 0.15, 0.3, "triangle", 0.3),
    );
  } else if (key === "bell") {
    playTone(ac, 1047, t, 0.8, "sine", 0.4);
    playTone(ac, 1319, t + 0.01, 0.6, "sine", 0.2);
  } else if (key === "trumpet") {
    [523, 523, 659, 784, 659, 784].forEach((f, i) =>
      playTone(ac, f, t + i * 0.12, 0.1, "sawtooth", 0.2),
    );
  } else if (key === "chime") {
    [1047, 1319, 1568].forEach((f, i) =>
      playTone(ac, f, t + i * 0.2, 0.5, "sine", 0.25),
    );
  } else if (key === "claxon") {
    [247, 311].forEach((f, i) =>
      playTone(ac, f, t + i * 0.3, 0.25, "sawtooth", 0.3),
    );
  } else if (key === "whistle") {
    playTone(ac, 1760, t, 0.2, "sine", 0.35);
  } else if (key === "tick") {
    for (let i = 0; i < 3; i++)
      playTone(ac, 1200, t + i * 0.1, 0.04, "square", 0.3);
  } else if (key === "pulse") {
    for (let i = 0; i < 4; i++)
      playTone(ac, 440, t + i * 0.2, 0.08, "sine", 0.3);
  } else if (key === "victory") {
    [523, 659, 784, 1047, 1319, 1047, 784, 1047].forEach((f, i) =>
      playTone(ac, f, t + i * 0.13, 0.2, "triangle", 0.3),
    );
  } else {
    for (let i = 0; i < 3; i++)
      playTone(ac, 880, t + i * 0.25, 0.15, "square", 0.2);
  }
}

function renderRanking() {
  const list = document.getElementById("ranking-list");
  if (!list) return;
  const sorted = Object.entries(state.ranking).sort((a, b) => b[1] - a[1]);
  list.innerHTML = "";

  if (!sorted.length) {
    list.innerHTML =
      '<div style="text-align:center;color:var(--text-muted);padding:40px;font-size:14px;letter-spacing:2px;">NENHUMA VITÓRIA REGISTRADA</div>';
    return;
  }

  sorted.forEach(([name, wins], i) => {
    const badges = ["🥇", "🥈", "🥉"];
    const div = document.createElement("div");
    div.className = "ranking-item";
    div.innerHTML = `
      <div class="emoji-rank">${badges[i] || `${i + 1}º`}</div>
      <div class="rank-name">${name}</div>
      <div class="rank-wins">${wins}</div>
      <div class="rank-btns">
        <button class="rank-btn minus" onclick="adjustWins('${name}',-1)">−</button>
        <button class="rank-btn" onclick="adjustWins('${name}', 1)">+</button>
        <button class="rank-btn delete" onclick="removeFromRanking('${name}')" title="Remover do ranking">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>
      </div>`;
    list.appendChild(div);
  });
}

function adjustWins(name, delta) {
  if (!state.ranking[name]) state.ranking[name] = 0;
  state.ranking[name] = Math.max(0, state.ranking[name] + delta);
  saveState();
  renderRanking();
}

function removeFromRanking(name) {
  if (!confirm(`Remover "${name}" do ranking?`)) return;
  delete state.ranking[name];
  saveState();
  renderRanking();
}

function renderVictorySelect() {
  const sel = document.getElementById("victory-select");
  if (!sel) return;
  sel.innerHTML = '<option value="">Selecionar campeão...</option>';
  state.players.forEach((p) => {
    const o = document.createElement("option");
    o.value = p;
    o.textContent = p;
    sel.appendChild(o);
  });
}

let ctxTarget = null;

function updateClockUI() {
  const total = state.levelTime * 60;
  const sec = state.timerSec;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  document.getElementById("clock-time").textContent =
    `${String(m).padStart(2, "0")} : ${String(s).padStart(2, "0")}`;
  const circ = 2 * Math.PI * 66;
  document.getElementById("clock-arc").style.strokeDashoffset =
    -circ * (1 - sec / total);
}

function updateMesaUI() {
  const blindLevels = state.blinds.filter((b) => b.type !== "interval");
  let levelNum = 0;
  for (let i = 0; i <= state.currentLevel; i++) {
    if (state.blinds[i] && state.blinds[i].type !== "interval")
      levelNum++;
  }
  document.getElementById("level-label").textContent =
    `NÍVEL ${levelNum} DE ${blindLevels.length}`;

  const cur = state.blinds[state.currentLevel];
  if (cur && cur.type !== "interval") {
    document.getElementById("blinds-display").textContent = cur.ante
      ? `${cur.sb.toLocaleString("pt-BR")} / ${cur.bb.toLocaleString("pt-BR")} / ${cur.ante.toLocaleString("pt-BR")}`
      : `${cur.sb.toLocaleString("pt-BR")} / ${cur.bb.toLocaleString("pt-BR")}`;
    document.getElementById("ante-display").textContent = "";
  }

  const showRebuyAlert = isRebuyEnded() || isLastRoundBeforeRebuyEnd();
  const rebuyAlert = document.getElementById("rebuy-alert");
  rebuyAlert.classList.toggle("show", showRebuyAlert);
  rebuyAlert.textContent = isLastRoundBeforeRebuyEnd()
    ? "⚠️ ÚLTIMA RODADA ANTES DO FIM DO RE-BUY"
    : "⛔ FIM DO RE-BUY";

  let ni = state.currentLevel + 1;
  while (ni < state.blinds.length && state.blinds[ni].type === "interval")
    ni++;
  const nb = document.getElementById("next-blind");
  if (ni < state.blinds.length) {
    const n = state.blinds[ni];
    nb.innerHTML = `Próximo: <span>${n.sb.toLocaleString("pt-BR")} / ${n.bb.toLocaleString("pt-BR")}</span>`;
  } else {
    nb.innerHTML = "";
  }

  updateClockUI();
  renderPlayers();
}

function renderPlayers() {
  const row = document.getElementById("players-row");
  const rebuyEnded = isRebuyEnded();
  row.innerHTML = "";

  state.players.forEach((name) => {
    const st = state.playerStatus[name] || "active";
    const chip = document.createElement("div");
    chip.className =
      "player-chip" +
      (st === "eliminated"
        ? " eliminated"
        : st === "rebought"
        ? " rebought"
        : st === "champion"
        ? " champion"
        : "");

    let icon = "";
    if (st === "champion")
      icon =
        '<path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17.3l-6.2 4L8.2 13.9 2 9.4h7.6z" fill="currentColor"/>';
    else if (st === "rebought")
      icon =
        '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>';
    else
      icon =
        '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>';

    const strokeAttr =
      st === "champion"
        ? ""
        : 'fill="none" stroke="currentColor" stroke-width="2"';
    chip.innerHTML = `<svg viewBox="0 0 24 24" ${strokeAttr}>${icon}</svg>${name}`;
    chip.onclick = (e) => openCtxMenu(e, name, rebuyEnded);
    row.appendChild(chip);
  });
}

function openCtxMenu(e, name, rebuyEnded) {
  e.stopPropagation();
  ctxTarget = name;
  const st = state.playerStatus[name] || "active";
  const m = document.getElementById("ctx-menu");

  const canEliminate = st === "active" || st === "rebought";
  document.getElementById("ctx-champion").style.display =
    st === "active" ? "flex" : "none";
  document.getElementById("ctx-eliminate").style.display =
    canEliminate ? "flex" : "none";
  document.getElementById("ctx-rebuy").style.display =
    st === "eliminated" && !rebuyEnded ? "flex" : "none";
  document.getElementById("ctx-restore").style.display =
    st !== "active" && st !== "rebought" ? "flex" : "none";

  m.style.left = Math.min(e.clientX, window.innerWidth - 180) + "px";
  m.style.top = Math.min(e.clientY - 20, window.innerHeight - 180) + "px";
  m.classList.add("show");
}

function ctxAction(action) {
  const name = ctxTarget;
  if (action === "champion") {
    state.playerStatus[name] = "champion";
    document.getElementById("champion-name-overlay").textContent =
      name.toUpperCase();
    document.getElementById("champion-overlay").classList.add("show");
    playSound("champion");
    if (!state.ranking[name]) state.ranking[name] = 0;
    state.ranking[name]++;
    renderRanking();
    renderVictorySelect();
  } else if (action === "eliminate") {
    state.playerStatus[name] = "eliminated";
  } else if (action === "rebuy") {
    state.playerStatus[name] = "rebought";
  } else if (action === "restore") {
    state.playerStatus[name] = "active";
  }
  document.getElementById("ctx-menu").classList.remove("show");
  autosave();
  renderPlayers();
}

function closeChampion() {
  document.getElementById("champion-overlay").classList.remove("show");
}
document.addEventListener("click", () =>
  document.getElementById("ctx-menu").classList.remove("show"),
);

function startLevel() {
  const b = state.blinds[state.currentLevel];
  if (!b) return;

  if (b.type === "interval") {
    state.intervalSec = 10;
    state.timerRunning = false;
    document.getElementById("next-blind-btn").classList.remove("show");
    document.getElementById("interval-banner").classList.add("show");

    let ni = state.currentLevel + 1;
    while (
      ni < state.blinds.length &&
      state.blinds[ni].type === "interval"
    )
      ni++;
    const next = state.blinds[ni];
    if (next) {
      document.getElementById("interval-next-blind").textContent =
        `${next.sb} / ${next.bb}`;
    }

    const txt = document.getElementById("interval-custom-text");
    txt.textContent = b.note || "";
    const msg = document.getElementById("blind-message");
    msg.textContent = "";
    msg.classList.remove("show");
    return;
  }

  document.getElementById("interval-banner").classList.remove("show");
  document.getElementById("next-blind-btn").classList.remove("show");
  const msg = document.getElementById("blind-message");
  if (b.note) {
    msg.textContent = b.note;
    msg.classList.add("show");
  } else {
    msg.textContent = "";
    msg.classList.remove("show");
  }
  state.timerSec = state.levelTime * 60;
  updateMesaUI();
  if (state.timerRunning) startMainTimer();
}

function toggleTimer() {
  const banner = document.getElementById("interval-banner");
  if (banner.classList.contains("show")) {
    startIntervalTimer();
    return;
  }

  if (state.timerRunning) pauseMainTimer();
  else startMainTimer();
}

function startMainTimer() {
  if (state.mainTimer) clearInterval(state.mainTimer);
  state.timerRunning = true;
  document.getElementById("next-blind-btn").classList.remove("show");
  document.getElementById("icon-play").style.display = "none";
  document.getElementById("icon-pause").style.display = "block";

  state.mainTimer = setInterval(() => {
    if (state.timerSec > 0) {
      state.timerSec--;
      updateClockUI();
    } else {
      clearInterval(state.mainTimer);
      state.timerRunning = false;
      document.getElementById("icon-play").style.display = "block";
      document.getElementById("icon-pause").style.display = "none";
      playSound("blindEnd");
      document.getElementById("next-blind-btn").classList.add("show");
    }
  }, 1000);
}

function pauseMainTimer() {
  if (state.mainTimer) clearInterval(state.mainTimer);
  state.timerRunning = false;
  document.getElementById("icon-play").style.display = "block";
  document.getElementById("icon-pause").style.display = "none";
}

function resetTimer() {
  pauseMainTimer();
  state.currentLevel = 0;
  Object.keys(state.playerStatus).forEach((p) => {
    state.playerStatus[p] = "active";
  });
  document.getElementById("champion-overlay").classList.remove("show");
  startLevel();
  autosave();
  renderPlayers();
}

function nextLevel(autoStart = false) {
  pauseMainTimer();
  state.currentLevel++;
  while (
    state.currentLevel < state.blinds.length &&
    state.blinds[state.currentLevel].type === "interval"
  ) {
    state.currentLevel++;
  }
  if (state.currentLevel >= state.blinds.length)
    state.currentLevel = state.blinds.length - 1;
  state.timerRunning = autoStart;
  startLevel();
  autosave();
}

function continueNextBlind() {
  document.getElementById("next-blind-btn").classList.remove("show");
  pauseMainTimer();
  state.currentLevel++;
  if (state.currentLevel >= state.blinds.length)
    state.currentLevel = state.blinds.length - 1;
  state.timerRunning = true;
  startLevel();
  autosave();
}

function prevLevel() {
  pauseMainTimer();
  state.currentLevel--;
  while (
    state.currentLevel > 0 &&
    state.blinds[state.currentLevel].type === "interval"
  ) {
    state.currentLevel--;
  }
  if (state.currentLevel < 0) state.currentLevel = 0;
  startLevel();
  autosave();
}

function startIntervalTimer() {
  const banner = document.getElementById("interval-banner");
  if (!banner.classList.contains("show")) return;

  state.intervalSec = 10;
  banner.querySelector("h2").textContent =
    `INTERVALO - ${state.intervalSec}s`;
  state.intervalTimer = setInterval(() => {
    state.intervalSec--;
    banner.querySelector("h2").textContent =
      `INTERVALO - ${state.intervalSec}s`;
    if (state.intervalSec <= 0) {
      clearInterval(state.intervalTimer);
      skipInterval();
    }
  }, 1000);
}

function skipInterval() {
  if (state.intervalTimer) clearInterval(state.intervalTimer);
  state.currentLevel++;
  while (
    state.currentLevel < state.blinds.length &&
    state.blinds[state.currentLevel].type === "interval"
  ) {
    state.currentLevel++;
  }
  if (state.currentLevel >= state.blinds.length)
    state.currentLevel = state.blinds.length - 1;
  startLevel();
  autosave();
}

function toggleShotClock() {
  const wrap = document.getElementById("shot-clock-wrap");
  const num = document.getElementById("shot-clock-num");
  if (state.shotClockRunning) {
    clearInterval(state.shotClockTimer);
    state.shotClockRunning = false;
    wrap.classList.remove("active");
    num.textContent = state.shotClockSec;
    return;
  }

  state.shotClockSec = 30;
  num.textContent = state.shotClockSec;
  wrap.classList.add("active");
  state.shotClockRunning = true;

  state.shotClockTimer = setInterval(() => {
    if (state.shotClockSec > 0) {
      state.shotClockSec--;
      num.textContent = state.shotClockSec;
    } else {
      clearInterval(state.shotClockTimer);
      state.shotClockRunning = false;
      wrap.classList.remove("active");
      playSound("shotClock");
    }
  }, 1000);
}

let dragSrcIndex = null;

function renderBlindsConfig() {
  const list = document.getElementById("blinds-list");
  list.innerHTML = "";
  let bIdx = 0;

  state.blinds.forEach((b, i) => {
    if (b.type === "interval") {
      const div = document.createElement("div");
      div.className = "interval-row";
      div.innerHTML = `
        <button class="drag-handle" type="button" title="Arrastar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px">
            <path d="M8 6h8M8 12h8M8 18h8" />
          </svg>
        </button>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;flex-shrink:0">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span style="flex:1;font-size:14px;font-weight:600;">Intervalo</span>
        <div style="flex:2;min-width:180px;">
          <label style="font-size:10px;color:var(--text-muted);letter-spacing:1px;display:block;margin-bottom:4px;">Mensagem do Nível</label>
          <input type="text" value="${b.note || ""}" onchange="updateBlind(${i},'note',this.value)">
        </div>
        <button class="btn-icon" onclick="removeBlind(${i})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>`;
      div.draggable = true;
      div.dataset.index = i;
      div.addEventListener("dragstart", handleBlindDragStart);
      div.addEventListener("dragover", handleBlindDragOver);
      div.addEventListener("drop", handleBlindDrop);
      div.addEventListener("dragleave", handleBlindDragLeave);
      div.addEventListener("dragend", handleBlindDragEnd);
      list.appendChild(div);
    } else {
      bIdx++;
      const div = document.createElement("div");
      div.className = "blind-row";
      div.innerHTML = `
        <div class="blind-row-header">
          <button class="drag-handle" type="button" title="Arrastar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px">
              <path d="M8 6h8M8 12h8M8 18h8" />
            </svg>
          </button>
          <span class="blind-num">NÍVEL ${bIdx}</span>
          ${b.rebuyEnd ? '<span style="font-size:10px;color:var(--red2);border:1px solid var(--red2);padding:2px 7px;border-radius:4px;letter-spacing:1px;">FIM RE-BUY</span>' : ""}
          <button class="btn-icon" onclick="removeBlind(${i})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>
        <div class="blind-fields">
          <div><label>SB</label>  <input type="number" value="${b.sb}" oninput="updateBlind(${i},'sb',this.value,false)" onchange="updateBlind(${i},'sb',this.value,true)"></div>
          <div><label>BB</label>  <input type="number" value="${b.bb}" oninput="updateBlind(${i},'bb',this.value,false)" onchange="updateBlind(${i},'bb',this.value,true)"></div>
          <div><label>ANTE</label><input type="number" value="${b.ante ?? 0}" oninput="updateBlind(${i},'ante',this.value,false)" onchange="updateBlind(${i},'ante',this.value,true)"></div>
        </div>
        <div class="blind-fields" style="grid-template-columns:1fr; margin-top:8px;">
          <div><label>Mensagem do Nível</label><input type="text" value="${b.note || ""}" onchange="updateBlind(${i},'note',this.value)"></div>
        </div>
        <label class="rebuy-end-toggle">
          <input type="checkbox" ${b.rebuyEnd ? "checked" : ""} onchange="updateBlind(${i},'rebuyEnd',this.checked)">
          Marcar como fim de re-buy
        </label>`;
      div.draggable = true;
      div.dataset.index = i;
      div.addEventListener("dragstart", handleBlindDragStart);
      div.addEventListener("dragover", handleBlindDragOver);
      div.addEventListener("drop", handleBlindDrop);
      div.addEventListener("dragleave", handleBlindDragLeave);
      div.addEventListener("dragend", handleBlindDragEnd);
      list.appendChild(div);
    }
  });
}

function handleBlindDragStart(e) {
  dragSrcIndex = Number(this.dataset.index);
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", dragSrcIndex);
  this.classList.add("dragging");
}

function handleBlindDragOver(e) {
  e.preventDefault();
  this.classList.add("drag-over");
  e.dataTransfer.dropEffect = "move";
}

function handleBlindDragLeave() {
  this.classList.remove("drag-over");
}

function handleBlindDrop(e) {
  e.preventDefault();
  const sourceIndex =
    dragSrcIndex !== null
      ? dragSrcIndex
      : Number(e.dataTransfer.getData("text/plain"));
  const targetIndex = Number(this.dataset.index);
  if (sourceIndex === targetIndex || sourceIndex < 0 || targetIndex < 0)
    return;

  const [moved] = state.blinds.splice(sourceIndex, 1);
  const insertIndex =
    targetIndex > sourceIndex ? targetIndex - 1 : targetIndex;
  state.blinds.splice(insertIndex, 0, moved);
  dragSrcIndex = null;
  renderBlindsConfig();
  autosave();
}

function handleBlindDragEnd() {
  this.classList.remove("dragging");
  document
    .querySelectorAll(".drag-over")
    .forEach((el) => el.classList.remove("drag-over"));
  dragSrcIndex = null;
}

function updateBlind(i, key, val, rerender = true) {
  if (key === "rebuyEnd") state.blinds[i][key] = val;
  else if (key === "note") state.blinds[i][key] = val;
  else if (key === "ante") {
    state.blinds[i].ante = parseInt(val) || 0;
  } else if (key === "bb") {
    state.blinds[i].bb = parseInt(val) || 0;
  } else {
    state.blinds[i][key] = parseInt(val) || 0;
  }

  if (rerender) {
    renderBlindsConfig();
  }

  updateMesaUI();
  saveState();
  autosave();
}

function addBlind() {
  const lasts = state.blinds.filter((b) => b.type !== "interval");
  const last = lasts[lasts.length - 1] || { sb: 1000, bb: 2000 };
  const newBB = last.bb * 2;
  state.blinds.push({
    sb: last.sb * 2,
    bb: newBB,
    ante: 0,
    note: "",
    rebuyEnd: false,
  });
  renderBlindsConfig();
  autosave();
}

function addInterval() {
  state.blinds.push({ type: "interval", note: "" });
  renderBlindsConfig();
}

function removeBlind(i) {
  state.blinds.splice(i, 1);
  if (state.currentLevel >= state.blinds.length)
    state.currentLevel = Math.max(0, state.blinds.length - 1);
  renderBlindsConfig();
  renderPlayers();
  autosave();
}

function updateLevelTime(v) {
  const n = parseInt(v);
  if (!n || n < 1) return;
  state.levelTime = n;
}

function updateStackTarget(v) {
  const n = parseInt(v);
  state.stackTarget = isNaN(n) ? 0 : n;
  calcChips();
}

function updateThresholdUse500(v) {
  const n = parseInt(v);
  state.thresholdUse500 = isNaN(n) ? 0 : n;
  calcChips();
}

function updateThresholdUse1000(v) {
  const n = parseInt(v);
  state.thresholdUse1000 = isNaN(n) ? 0 : n;
  calcChips();
}

function renderPlayersConfig() {
  const list = document.getElementById("players-config-list");
  list.innerHTML = "";

  state.players.forEach((name, i) => {
    const div = document.createElement("div");
    div.className = "player-list-item";
    div.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
      <span style="flex:1;font-size:15px;">${name}</span>
      <button class="btn-icon" onclick="removePlayer(${i})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </button>`;
    list.appendChild(div);
  });

  document.getElementById("player-count").textContent =
    `${state.players.length} jogadores`;
  renderPlayers();
  renderVictorySelect();
}

function addPlayer() {
  const inp = document.getElementById("new-player-input");
  const name = inp.value.trim();
  if (!name) return;
  if (!state.players.includes(name)) {
    state.players.push(name);
    if (!state.ranking[name]) state.ranking[name] = 0;
  }
  inp.value = "";
  renderPlayersConfig();
  renderVictorySelect();
  autosave();
}

function removePlayer(i) {
  const name = state.players[i];
  state.players.splice(i, 1);
  delete state.playerStatus[name];
  renderPlayersConfig();
  renderVictorySelect();
  renderPlayers();
  autosave();
}

function renderChipsConfig() {
  const list = document.getElementById("chips-config-list");
  if (list) {
    list.innerHTML = "";
    state.chips.forEach((c, i) => {
      const row = document.createElement("div");
      row.className = "chip-row";
      row.innerHTML = `
        <div class="chip-dot" style="background:${c.color}"></div>
        <div class="chip-value">${c.value}</div>
        <input type="text" value="${c.name}" class="chip-input" style="max-width:90px;" onchange="state.chips[${i}].name=this.value">
        <input type="number" value="${c.total}" class="chip-input" style="max-width:70px;" onchange="state.chips[${i}].total=parseInt(this.value)||0;calcChips()">`;
      list.appendChild(row);
    });
  }

  const stInput = document.getElementById("stack-target-input");
  if (stInput) stInput.value = state.stackTarget || 0;

  const th500 = document.getElementById("threshold-500-input");
  if (th500) th500.value = state.thresholdUse500 || 0;
  const th1000 = document.getElementById("threshold-1000-input");
  if (th1000) th1000.value = state.thresholdUse1000 || 0;

  calcChips();
}

function calcChips() {
  const n = state.players.length || 1;
  const chips = state.chips;
  const target = state.stackTarget || 0;

  const maxPerPlayer = chips.map((c) => {
    const ratio =
      BASE_RATIOS[c.value] !== undefined ? BASE_RATIOS[c.value] : 0.4;
    const available = Math.floor(c.total * (1 - ratio));
    return Math.floor(available / n);
  });

  chips.forEach((c, i) => {
    const reserveSafe = Math.floor((c.total || 0) / (2 * n));
    maxPerPlayer[i] = Math.min(maxPerPlayer[i], reserveSafe);
  });

  chips.forEach((c, i) => {
    if (c.value === 1000) {
      if (target < state.thresholdUse1000) maxPerPlayer[i] = 0;
    }
    if (c.value === 500) {
      if (target < state.thresholdUse500)
        maxPerPlayer[i] = Math.floor(maxPerPlayer[i] * 0.15);
      else if (target < state.thresholdUse500 * 1.6)
        maxPerPlayer[i] = Math.floor(maxPerPlayer[i] * 0.6);
    }
  });

  const order = chips
    .map((c, i) => i)
    .sort((a, b) => chips[a].value - chips[b].value);
  let remaining = target;
  const perPlayer = Array(chips.length).fill(0);

  for (const idx of order) {
    const v = chips[idx].value;
    const cap = maxPerPlayer[idx] || 0;
    if (v <= 0 || cap <= 0) continue;
    const want = Math.min(cap, Math.floor(remaining / v));
    perPlayer[idx] = want;
    remaining -= want * v;
  }

  if (remaining > 0) {
    const idx100 = chips.findIndex((c) => c.value === 100);
    const smallIndices = chips
      .map((c, i) => i)
      .filter((i) => chips[i].value < 500)
      .sort((a, b) => chips[a].value - chips[b].value);
    const largeIndices = chips
      .map((c, i) => i)
      .filter((i) => chips[i].value >= 500)
      .sort((a, b) => chips[a].value - chips[b].value);

    if (idx100 !== -1) {
      const cap = maxPerPlayer[idx100] || 0;
      const canAdd = Math.max(0, cap - (perPlayer[idx100] || 0));
      const want = Math.min(canAdd, Math.floor(remaining / 100));
      if (want > 0) {
        perPlayer[idx100] = (perPlayer[idx100] || 0) + want;
        remaining -= want * 100;
      }
    }

    for (const idx of smallIndices) {
      if (remaining <= 0) break;
      if (chips[idx].value === 100) continue;
      const v = chips[idx].value;
      const cap = maxPerPlayer[idx] || 0;
      while ((perPlayer[idx] || 0) < cap && remaining >= v) {
        perPlayer[idx] = (perPlayer[idx] || 0) + 1;
        remaining -= v;
      }
    }

    const smallCapacityLeft = smallIndices.some(
      (i) => (perPlayer[i] || 0) < (maxPerPlayer[i] || 0),
    );
    if (remaining > 0 && !smallCapacityLeft) {
      for (const idx of largeIndices) {
        if (remaining <= 0) break;
        const v = chips[idx].value;
        const cap = maxPerPlayer[idx] || 0;
        while ((perPlayer[idx] || 0) < cap && remaining > 0) {
          perPlayer[idx] = (perPlayer[idx] || 0) + 1;
          remaining -= v;
        }
      }
    }
  }

  if (remaining < 0) {
    const revOrder = chips
      .map((c, i) => i)
      .sort((a, b) => chips[b].value - chips[a].value);
    for (const idx of revOrder) {
      while ((perPlayer[idx] || 0) > 0 && remaining < 0) {
        perPlayer[idx] = perPlayer[idx] - 1;
        remaining += chips[idx].value;
      }
      if (remaining >= 0) break;
    }
  }

  for (let i = 0; i < perPlayer.length; i++) {
    perPlayer[i] = Math.max(
      0,
      Math.min(perPlayer[i] || 0, maxPerPlayer[i] || 0),
    );
  }

  const playersCount = n;
  const usedPerChip = perPlayer.map((q) => q * playersCount);
  const totalKitValue = chips.reduce(
    (s, c) => s + (c.total || 0) * c.value,
    0,
  );
  const desiredBankValue = Math.max(
    Math.round(totalKitValue * 0.25),
    Math.round(playersCount * (state.stackTarget || 0) * 0.15),
  );

  let bankAvailableValue = chips.reduce(
    (s, c, i) =>
      s + Math.max(0, (c.total || 0) - usedPerChip[i]) * c.value,
    0,
  );

  if (bankAvailableValue < desiredBankValue) {
    const desc = chips
      .map((c, i) => i)
      .sort((a, b) => chips[b].value - chips[a].value);
    for (const idx of desc) {
      while (
        (perPlayer[idx] || 0) > 0 &&
        bankAvailableValue < desiredBankValue
      ) {
        perPlayer[idx] = perPlayer[idx] - 1;
        usedPerChip[idx] -= playersCount;
        bankAvailableValue += chips[idx].value * playersCount;
      }
      if (bankAvailableValue >= desiredBankValue) break;
    }
  }

  state.chipPerPlayer = perPlayer;
  state.fullReturns = calculateFullReturns(
    chips,
    perPlayer,
    playersCount,
  );

  const actual = perPlayer.reduce(
    (s, q, i) => s + q * (chips[i]?.value || 0),
    0,
  );
  const spp = document.getElementById("stack-per-player");
  if (spp)
    spp.textContent = `${n} jogador(es) · Objetivo: ${target.toLocaleString("pt-BR")} · Stack real: ${actual.toLocaleString("pt-BR")}`;

  renderChipDistTable();
  autosave();
}

function calculateFullReturns(chips, perPlayer, playersCount) {
  if (!playersCount || playersCount <= 0) return 0;
  let fullReturns = Infinity;
  chips.forEach((c, i) => {
    const required = perPlayer[i] || 0;
    if (required <= 0) return;
    const available = Math.max(
      0,
      (c.total || 0) - (required || 0) * playersCount,
    );
    fullReturns = Math.min(fullReturns, Math.floor(available / required));
  });
  return fullReturns === Infinity ? 0 : fullReturns;
}

function renderChipDistTable() {
  const tbody = document.getElementById("chip-dist-tbody");
  if (!tbody) return;
  const n = state.players.length || 1;
  tbody.innerHTML = "";
  let totalReserva = 0;

  state.chips.forEach((c, i) => {
    const pp = state.chipPerPlayer[i] || 0;
    const used = pp * n;
    const reserva = c.total - used;
    totalReserva += reserva * c.value;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="display:flex;align-items:center;gap:8px;">
        <div class="chip-dot" style="background:${c.color}"></div>
        <span style="color:var(--text-dim)">${c.name}</span>
        <span style="color:var(--text-muted);font-family:'IBM Plex Mono',monospace;font-size:11px;">(${c.value})</span>
      </td>
      <td><div class="per-player-val">
        <input type="number" value="${pp}" min="0" onchange="state.chipPerPlayer[${i}]=parseInt(this.value)||0;updateChipDist()">
      </div></td>
      <td>${used}</td>
      <td style="color:${reserva >= 0 ? "var(--text-dim)" : "var(--red2)"}">${reserva}</td>`;
    tbody.appendChild(tr);
  });

  const rv = document.getElementById("reserva-total-val");
  if (rv) rv.textContent = totalReserva.toLocaleString("pt-BR");

  const returnsEl = document.getElementById("retornos-possiveis");
  if (returnsEl) {
    const fullReturns = calculateFullReturns(
      state.chips,
      state.chipPerPlayer,
      n,
    );
    returnsEl.textContent = `${fullReturns} / ${n}`;
  }
}

function updateChipDist() {
  const n = state.players.length || 1;
  const chips = state.chips;
  const tbody = document.getElementById("chip-dist-tbody");
  if (!tbody) return;
  let totalReserva = 0;

  tbody.querySelectorAll("tr").forEach((tr, i) => {
    const pp = state.chipPerPlayer[i] || 0;
    const used = pp * n;
    const reserva = chips[i].total - used;
    totalReserva += reserva * chips[i].value;
    const tds = tr.querySelectorAll("td");
    if (tds[2]) tds[2].textContent = used;
    if (tds[3]) {
      tds[3].textContent = reserva;
      tds[3].style.color =
        reserva >= 0 ? "var(--text-dim)" : "var(--red2)";
    }
  });

  const rv = document.getElementById("reserva-total-val");
  if (rv) rv.textContent = totalReserva.toLocaleString("pt-BR");

  state.fullReturns = calculateFullReturns(chips, state.chipPerPlayer, n);
  const returnsEl = document.getElementById("retornos-possiveis");
  if (returnsEl) returnsEl.textContent = `${state.fullReturns} / ${n}`;

  const actual = state.chipPerPlayer.reduce(
    (s, q, i) => s + q * (chips[i]?.value || 0),
    0,
  );
  const spp = document.getElementById("stack-per-player");
  if (spp)
    spp.textContent = `${n} jogador(es) · Stack: ${actual.toLocaleString("pt-BR")} / jogador`;

  autosave();
}

function renderSoundsConfig() {
  renderSoundGroup("sound-blind-chips", SOUND_BLIND, "blindEnd");
  renderSoundGroup("sound-shot-chips", SOUND_SHOT, "shotClock");
  renderSoundGroup("sound-champion-chips", SOUND_CHAMP, "champion");
}

function renderSoundGroup(cid, sounds, key) {
  const c = document.getElementById(cid);
  if (!c) return;
  c.innerHTML = "";
  sounds.forEach((s) => {
    const btn = document.createElement("div");
    btn.className =
      "sound-chip" + (state.sounds[key] === s.id ? " active" : "");
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
      </svg>${s.label}`;
    btn.onclick = () => {
      state.sounds[key] = s.id;
      playSound(key);
      renderSoundsConfig();
    };
    c.appendChild(btn);
  });
}

function runChipTest(playersCount, target) {
  state.players = Array.from({ length: playersCount }, (_, i) => `P${i + 1}`);
  state.stackTarget = target;
  const stInput = document.getElementById("stack-target-input");
  if (stInput) stInput.value = target;
  renderPlayersConfig();
  calcChips();

  const chips = state.chips;
  const perPlayer = state.chipPerPlayer.slice();
  const usedPerChip = perPlayer.map((q) => q * playersCount);
  const usedTotalValue = usedPerChip.reduce(
    (s, q, i) => s + q * (chips[i].value || 0),
    0,
  );
  const perPlayerTotal = perPlayer.reduce(
    (s, q, i) => s + q * (chips[i].value || 0),
    0,
  );
  const perPlayerCount = perPlayer.reduce((s, q) => s + q, 0);
  const reserveByChip = chips.map(
    (c, i) => (c.total || 0) - (usedPerChip[i] || 0),
  );
  const reserveTotalValue = reserveByChip.reduce(
    (s, r, i) => s + r * (chips[i].value || 0),
    0,
  );
  const fullReturns = calculateFullReturns(chips, perPlayer, playersCount);

  const result = {
    players: playersCount,
    target,
    perPlayerTotal,
    perPlayerCount,
    usedPerChip,
    usedTotalValue,
    reserveByChip,
    reserveTotalValue,
    fullReturns,
  };

  renderTestResults(result);
}

function renderTestResults(r) {
  const out = document.getElementById("test-results");
  if (!out) return;
  const chips = state.chips;
  let html = `<div style="padding:10px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;">
          <div style="font-weight:600;color:var(--gold);margin-bottom:6px;">Teste — ${r.players} jogador(es) · alvo ${r.target.toLocaleString("pt-BR")}</div>
          <div style="margin-bottom:6px;">Stack real / jogador: <strong style="color:var(--gold)">${r.perPlayerTotal.toLocaleString("pt-BR")}</strong> · Fichas por jogador: <strong style="color:var(--text)">${r.perPlayerCount}</strong></div>
          <div style="margin-bottom:8px;color:var(--text-dim)">Distribuição:</div>
          <div style="max-height:200px;overflow:auto;margin-bottom:8px;"><table style="width:100%;border-collapse:collapse;"><thead><tr style="color:var(--text-muted);font-size:12px;text-align:left"><th>FICHA</th><th>P/J</th><th>USADAS</th><th>RESERVA</th></tr></thead><tbody>`;

  chips.forEach((c, i) => {
    const pp = state.chipPerPlayer[i] || 0;
    const used = r.usedPerChip[i] || 0;
    const reserva = (c.total || 0) - used;
    html += `<tr style="border-top:1px solid var(--border);"><td style="padding:6px 4px;">${c.name} (${c.value})</td><td style="padding:6px 4px;">${pp}</td><td style="padding:6px 4px;">${used}</td><td style="padding:6px 4px;">${reserva}</td></tr>`;
  });

  html += `</tbody></table></div>
          <div style="color:var(--text-dim);">Total usado (valor): <strong style="color:var(--gold)">${r.usedTotalValue.toLocaleString("pt-BR")}</strong></div>
          <div style="color:var(--text-dim);">Reserva total (valor): <strong style="color:var(--gold)">${r.reserveTotalValue.toLocaleString("pt-BR")}</strong></div>
          <div style="color:var(--text-dim);">Retornos completos possíveis: <strong style="color:var(--gold)">${r.fullReturns} / ${r.players}</strong></div>
        </div>`;

  out.innerHTML = html;
}

function showPage(name, btn) {
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document.getElementById(`page-${name}`).classList.add("active");
  document
    .querySelectorAll("nav button")
    .forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");

  if (name === "config") {
    renderBlindsConfig();
    renderPlayersConfig();
    renderSoundsConfig();
    renderChipsConfig();
  }

  if (name === "ranking") {
    renderRanking();
  }
}

function showConfigTab(tab, btn) {
  document
    .querySelectorAll(".config-tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelectorAll(".config-panel")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".config-tabs button")
    .forEach((b) => b.classList.remove("active"));
  const panel =
    document.getElementById(`panel-${tab}`) ||
    document.getElementById(tab);
  panel?.classList.add("active");
  if (btn) btn.classList.add("active");
}

function addVictory() {
  const sel = document.getElementById("victory-select");
  const name = sel.value;
  if (!name) return;
  if (!state.ranking[name]) state.ranking[name] = 0;
  state.ranking[name]++;
  saveState();
  renderRanking();
  sel.value = "";
}

function bindGlobals() {
  window.state = state;
  window.showPage = showPage;
  window.showConfigTab = showConfigTab;
  window.toggleTimer = toggleTimer;
  window.resetTimer = resetTimer;
  window.nextLevel = nextLevel;
  window.prevLevel = prevLevel;
  window.skipInterval = skipInterval;
  window.toggleShotClock = toggleShotClock;
  window.continueNextBlind = continueNextBlind;
  window.addBlind = addBlind;
  window.addInterval = addInterval;
  window.updateBlind = updateBlind;
  window.updateLevelTime = updateLevelTime;
  window.renderBlindsConfig = renderBlindsConfig;
  window.renderPlayersConfig = renderPlayersConfig;
  window.renderSoundsConfig = renderSoundsConfig;
  window.renderChipsConfig = renderChipsConfig;
  window.addPlayer = addPlayer;
  window.removePlayer = removePlayer;
  window.calcChips = calcChips;
  window.updateChipDist = updateChipDist;
  window.updateThresholdUse500 = updateThresholdUse500;
  window.updateThresholdUse1000 = updateThresholdUse1000;
  window.adjustWins = adjustWins;
  window.removeFromRanking = removeFromRanking;
  window.addVictory = addVictory;
  window.ctxAction = ctxAction;
  window.closeChampion = closeChampion;
  window.saveState = saveState;
}

function init() {
  loadState();
  bindGlobals();
  renderBlindsConfig();
  renderPlayersConfig();
  renderSoundsConfig();
  renderChipsConfig();
  renderRanking();
  renderPlayers();
  updateMesaUI();
  startLevel();
  window.dispatchEvent(new Event("poker-app-ready"));
}

window.addEventListener("load", init);

function shouldRegisterServiceWorker() {
  const hostname = window.location.hostname;
  const isLocalHost = ["", "localhost", "127.0.0.1", "::1"].includes(hostname);
  const isSecureContext =
    window.location.protocol === "https:" || window.location.protocol === "http:";
  return !isLocalHost && isSecureContext && "serviceWorker" in navigator;
}

if (shouldRegisterServiceWorker()) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("service-worker.js")
      .then(() => {
        console.log("Service Worker registrado com sucesso.");
      })
      .catch((error) => {
        console.warn("Falha ao registrar o Service Worker:", error);
      });
  });
}
