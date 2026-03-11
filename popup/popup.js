const DEFAULT_SETTINGS = {
  focusTime: 25,
  restTime: 5,
  totalSets: 4,
};

const RING_CIRCUMFERENCE = 440;
const MODE_META = {
  FOCUS: { label: "집중 모드", color: "#ff5252" },
  REST: { label: "휴식 시간", color: "#4caf50" },
};

let currentState = null;
let currentSettings = { ...DEFAULT_SETTINGS };
let localTickIntervalId = null;
let refreshIntervalId = null;

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response);
    });
  });
}

function getRenderableState() {
  if (!currentState?.isRunning) {
    return {
      isRunning: false,
      mode: "FOCUS",
      currentSet: 1,
      timeLeft: currentSettings.focusTime * 60,
      phaseDuration: currentSettings.focusTime * 60,
      totalSets: currentSettings.totalSets,
    };
  }

  return {
    ...currentState,
    timeLeft: Math.max(0, Math.ceil((currentState.endsAt - Date.now()) / 1000)),
    phaseDuration:
      currentState.mode === "FOCUS"
        ? currentSettings.focusTime * 60
        : currentSettings.restTime * 60,
  };
}

function updateTimerDisplay(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  document.getElementById("timerDisplay").textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function renderDots(state) {
  const setCounter = document.getElementById("setCounter");
  setCounter.innerHTML = "";

  for (let index = 1; index <= currentSettings.totalSets; index += 1) {
    const dot = document.createElement("div");
    dot.className = "dot";

    if (index < state.currentSet) {
      dot.classList.add("active");
    } else if (index === state.currentSet) {
      dot.classList.add(state.isRunning ? "current" : "pending");
    }

    setCounter.appendChild(dot);
  }
}

function renderUI() {
  const state = getRenderableState();
  const modeMeta = MODE_META[state.mode];
  const progressCircle = document.getElementById("progressCircle");
  const progress = state.phaseDuration > 0 ? 1 - state.timeLeft / state.phaseDuration : 0;

  updateTimerDisplay(state.timeLeft);
  document.getElementById("modeStatus").textContent = modeMeta.label;
  document.getElementById("modeStatus").style.color = modeMeta.color;
  progressCircle.style.stroke = modeMeta.color;
  progressCircle.style.strokeDashoffset =
    RING_CIRCUMFERENCE - RING_CIRCUMFERENCE * Math.min(Math.max(progress, 0), 1);

  document.getElementById("startBtn").classList.toggle("hidden", state.isRunning);
  document.getElementById("stopBtn").classList.toggle("hidden", !state.isRunning);

  renderDots(state);
}

function startLocalTicker() {
  if (localTickIntervalId) {
    clearInterval(localTickIntervalId);
  }

  localTickIntervalId = window.setInterval(() => {
    renderUI();
  }, 250);
}

async function refreshSnapshot() {
  const snapshot = await sendMessage({ action: "getSnapshot" });
  currentState = snapshot.state;
  currentSettings = { ...DEFAULT_SETTINGS, ...snapshot.settings };
  renderUI();
}

async function initializePopup() {
  const snapshot = await sendMessage({ action: "getSnapshot" });
  currentState = snapshot.state;
  currentSettings = { ...DEFAULT_SETTINGS, ...snapshot.settings };
  renderUI();
  document.body.classList.remove("loading");

  startLocalTicker();
  refreshIntervalId = window.setInterval(() => {
    refreshSnapshot().catch(console.error);
  }, 1000);
}

document.addEventListener("DOMContentLoaded", () => {
  initializePopup().catch((error) => {
    console.error(error);
    document.body.classList.remove("loading");
  });

  document.getElementById("settingsBtn").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById("startBtn").addEventListener("click", async () => {
    const snapshot = await sendMessage({ action: "start" });
    currentState = snapshot.state;
    currentSettings = { ...DEFAULT_SETTINGS, ...snapshot.settings };
    renderUI();
  });

  document.getElementById("stopBtn").addEventListener("click", async () => {
    const state = getRenderableState();
    const remainingSets = currentSettings.totalSets - state.currentSet + 1;
    const shouldStop = confirm(
      `현재 ${state.currentSet}세트 진행 중입니다.\n목표 달성까지 ${remainingSets}세트 남아있어요.\n\n정말로 몰입을 종료하시겠어요?`
    );

    if (!shouldStop) {
      return;
    }

    const snapshot = await sendMessage({ action: "stop" });
    currentState = snapshot.state;
    currentSettings = { ...DEFAULT_SETTINGS, ...snapshot.settings };
    renderUI();
  });
});

window.addEventListener("unload", () => {
  if (localTickIntervalId) {
    clearInterval(localTickIntervalId);
  }

  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
  }
});
