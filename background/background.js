const DEFAULT_SETTINGS = {
  focusTime: 25,
  restTime: 5,
  totalSets: 4,
  blacklist: ["youtube.com", "instagram.com", "facebook.com"],
};

const TIMER_STORAGE_KEY = "timerSession";
const BADGE_COLORS = {
  FOCUS: "#ff5252",
  REST: "#4caf50",
};

let settingsCache = { ...DEFAULT_SETTINGS };
let timerSession = null;
let initPromise = null;

function normalizeDomain(input) {
  if (!input) {
    return "";
  }

  let value = String(input).trim().toLowerCase();
  value = value.replace(/^https?:\/\//, "");
  value = value.replace(/^www\./, "");
  value = value.split("/")[0];
  value = value.split("?")[0];
  value = value.split("#")[0];
  value = value.replace(/:\d+$/, "");

  return value;
}

function expandDomainAliases(domains) {
  const expanded = new Set(domains.map(normalizeDomain).filter(Boolean));

  if (expanded.has("youtube.com")) {
    expanded.add("youtu.be");
    expanded.add("youtube-nocookie.com");
  }

  return [...expanded];
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getPhaseDurationSeconds(mode) {
  return (mode === "FOCUS" ? settingsCache.focusTime : settingsCache.restTime) * 60;
}

function getTimeLeft(session, now = Date.now()) {
  if (!session?.isRunning) {
    return settingsCache.focusTime * 60;
  }

  return Math.max(0, Math.ceil((session.endsAt - now) / 1000));
}

function getSnapshot(now = Date.now()) {
  if (!timerSession?.isRunning) {
    return {
      isRunning: false,
      mode: "FOCUS",
      currentSet: 1,
      startedAt: null,
      endsAt: null,
      timeLeft: settingsCache.focusTime * 60,
      phaseDuration: settingsCache.focusTime * 60,
      totalSets: settingsCache.totalSets,
    };
  }

  return {
    isRunning: true,
    mode: timerSession.mode,
    currentSet: timerSession.currentSet,
    startedAt: timerSession.startedAt,
    endsAt: timerSession.endsAt,
    timeLeft: getTimeLeft(timerSession, now),
    phaseDuration: getPhaseDurationSeconds(timerSession.mode),
    totalSets: settingsCache.totalSets,
  };
}

async function persistTimerSession() {
  await chrome.storage.local.set({ [TIMER_STORAGE_KEY]: timerSession });
}

async function loadSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  settingsCache = {
    ...DEFAULT_SETTINGS,
    ...stored,
    blacklist: Array.isArray(stored.blacklist) ? stored.blacklist : [...DEFAULT_SETTINGS.blacklist],
  };
}

async function ensureDefaultSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  const patch = {};

  if (typeof stored.focusTime !== "number" || Number.isNaN(stored.focusTime)) {
    patch.focusTime = DEFAULT_SETTINGS.focusTime;
  }

  if (typeof stored.restTime !== "number" || Number.isNaN(stored.restTime)) {
    patch.restTime = DEFAULT_SETTINGS.restTime;
  }

  if (typeof stored.totalSets !== "number" || Number.isNaN(stored.totalSets)) {
    patch.totalSets = DEFAULT_SETTINGS.totalSets;
  }

  if (!Array.isArray(stored.blacklist)) {
    patch.blacklist = [...DEFAULT_SETTINGS.blacklist];
  }

  if (Object.keys(patch).length > 0) {
    await chrome.storage.sync.set(patch);
  }
}

function buildBlockingRules(blacklist) {
  const domains = expandDomainAliases(blacklist);
  const rules = [];

  domains.forEach((domain, index) => {
    const regex = `^https?:\\/\\/([^\\/]+\\.)?${escapeRegex(domain)}(?::\\d+)?(?:[\\/]|$)`;
    const ruleBase = index * 2 + 1;

    rules.push({
      id: ruleBase,
      priority: 1,
      action: {
        type: "redirect",
        redirect: { extensionPath: "/pages/blocked.html" },
      },
      condition: {
        regexFilter: regex,
        resourceTypes: ["main_frame"],
      },
    });

    rules.push({
      id: ruleBase + 1,
      priority: 1,
      action: { type: "block" },
      condition: {
        regexFilter: regex,
        resourceTypes: [
          "sub_frame",
          "xmlhttprequest",
          "script",
          "image",
          "media",
          "font",
          "stylesheet",
          "other",
        ],
      },
    });
  });

  return rules;
}

async function updateBlocking(isFocusMode) {
  const currentRules = await chrome.declarativeNetRequest.getDynamicRules();

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: currentRules.map((rule) => rule.id),
    addRules: isFocusMode ? buildBlockingRules(settingsCache.blacklist) : [],
  });
}

async function updateBadge(now = Date.now()) {
  const snapshot = getSnapshot(now);

  if (!snapshot.isRunning) {
    await chrome.action.setBadgeText({ text: "" });
    await chrome.action.setTitle({ title: "PomoBlock" });
    return;
  }

  const minutes = Math.floor(snapshot.timeLeft / 60);
  const seconds = snapshot.timeLeft % 60;

  let badgeText = "";
  if (minutes >= 10) {
    badgeText = `${minutes}m`;
  } else if (minutes > 0) {
    badgeText = `${minutes}:${String(seconds).padStart(2, "0")}`;
  } else {
    badgeText = `${seconds}s`;
  }

  await chrome.action.setBadgeText({ text: badgeText });
  await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLORS[snapshot.mode] });
  await chrome.action.setTitle({
    title: `PomoBlock ${snapshot.mode === "FOCUS" ? "집중" : "휴식"} ${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")} | ${snapshot.currentSet}/${snapshot.totalSets} 세트`,
  });
}

function showNotification(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "../icons/icon128.png",
    title,
    message,
  });
}

async function startPhase(mode, currentSet, now = Date.now()) {
  const durationSeconds = getPhaseDurationSeconds(mode);

  timerSession = {
    isRunning: true,
    mode,
    currentSet,
    startedAt: now,
    endsAt: now + durationSeconds * 1000,
  };

  await persistTimerSession();
  await updateBlocking(mode === "FOCUS");
  await updateBadge(now);
}

async function stopTimer() {
  timerSession = null;
  await chrome.storage.local.remove(TIMER_STORAGE_KEY);
  await updateBlocking(false);
  await updateBadge();
}

async function handlePhaseTransition(now = Date.now()) {
  if (!timerSession?.isRunning) {
    await updateBadge(now);
    return;
  }

  if (now < timerSession.endsAt) {
    await updateBadge(now);
    return;
  }

  if (timerSession.mode === "FOCUS") {
    await startPhase("REST", timerSession.currentSet, now);
    showNotification("휴식 시간입니다", "잠깐 쉬고 다음 집중 세트를 준비하세요.");
    return;
  }

  if (timerSession.currentSet < settingsCache.totalSets) {
    const nextSet = timerSession.currentSet + 1;
    await startPhase("FOCUS", nextSet, now);
    showNotification(`${nextSet}세트 시작`, "다시 집중 모드로 전환됩니다.");
    return;
  }

  await stopTimer();
  showNotification("모든 세트 완료", "오늘의 목표 세트를 모두 마쳤습니다.");
}

async function ensureOffscreenHeartbeat() {
  if (!chrome.offscreen) {
    return;
  }

  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [chrome.runtime.getURL("offscreen/offscreen.html")],
  });

  if (contexts.length > 0) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: "offscreen/offscreen.html",
    reasons: ["WORKERS"],
    justification: "Keep the timer badge synchronized every second while the extension is active.",
  });
}

async function initialize() {
  await ensureDefaultSettings();
  await loadSettings();

  const stored = await chrome.storage.local.get(TIMER_STORAGE_KEY);
  timerSession = stored[TIMER_STORAGE_KEY] ?? null;

  await updateBlocking(Boolean(timerSession?.isRunning && timerSession.mode === "FOCUS"));
  await handlePhaseTransition();
  await ensureOffscreenHeartbeat();
}

function ensureInitialized() {
  if (!initPromise) {
    initPromise = initialize().catch((error) => {
      console.error("PomoBlock initialization failed", error);
      initPromise = null;
      throw error;
    });
  }

  return initPromise;
}

chrome.runtime.onInstalled.addListener(() => {
  ensureInitialized();
});

chrome.runtime.onStartup.addListener(() => {
  ensureInitialized();
});

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== "sync") {
    return;
  }

  const relevantKeys = ["focusTime", "restTime", "totalSets", "blacklist"];
  if (!relevantKeys.some((key) => key in changes)) {
    return;
  }

  await loadSettings();

  if (timerSession?.isRunning && timerSession.mode === "FOCUS") {
    await updateBlocking(true);
  }

  if (!timerSession?.isRunning) {
    await updateBadge();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    await ensureInitialized();

    switch (request.action) {
      case "getState":
        await handlePhaseTransition();
        sendResponse(getSnapshot());
        return;

      case "getSnapshot":
        await handlePhaseTransition();
        sendResponse({ state: getSnapshot(), settings: settingsCache });
        return;

      case "start":
        await loadSettings();
        await startPhase("FOCUS", 1);
        sendResponse({ state: getSnapshot(), settings: settingsCache });
        return;

      case "stop":
        await stopTimer();
        sendResponse({ state: getSnapshot(), settings: settingsCache });
        return;

      case "refreshBlocking":
        await updateBlocking(Boolean(timerSession?.isRunning && timerSession.mode === "FOCUS"));
        sendResponse({ ok: true });
        return;

      case "heartbeatTick":
        await handlePhaseTransition(request.now || Date.now());
        sendResponse({ ok: true });
        return;

      default:
        sendResponse({ ok: false });
    }
  })().catch((error) => {
    console.error("PomoBlock message handling failed", error);
    sendResponse({ ok: false, error: error.message });
  });

  return true;
});

ensureInitialized();
