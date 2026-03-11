const DEFAULT_SETTINGS = {
  focusTime: 25,
  restTime: 5,
  totalSets: 4,
  blacklist: ["youtube.com", "instagram.com", "facebook.com"],
};

let currentBlacklist = [...DEFAULT_SETTINGS.blacklist];

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

function renderSiteList(sites) {
  const list = document.getElementById("siteList");
  list.innerHTML = "";

  sites.forEach((site, index) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>${site}</span>
      <button class="delete-btn" data-index="${index}">삭제</button>
    `;
    list.appendChild(li);
  });
}

function showStatus(message) {
  const status = document.getElementById("statusMsg");
  status.textContent = message;
  setTimeout(() => {
    status.textContent = "";
  }, 2000);
}

async function loadSettings() {
  const items = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  currentBlacklist = Array.isArray(items.blacklist) ? [...items.blacklist] : [...DEFAULT_SETTINGS.blacklist];

  document.getElementById("focusTime").value = items.focusTime;
  document.getElementById("restTime").value = items.restTime;
  document.getElementById("totalSets").value = items.totalSets;
  renderSiteList(currentBlacklist);
}

document.addEventListener("DOMContentLoaded", () => {
  loadSettings().catch(console.error);
});

document.getElementById("addSiteBtn").addEventListener("click", async () => {
  const input = document.getElementById("newSite");
  const newSite = normalizeDomain(input.value);

  if (!newSite) {
    return;
  }

  const mergedList = [...currentBlacklist];
  if (!mergedList.includes(newSite)) {
    mergedList.push(newSite);
  }

  currentBlacklist = mergedList;
  await chrome.storage.sync.set({ blacklist: currentBlacklist });
  renderSiteList(currentBlacklist);
  input.value = "";
});

document.getElementById("siteList").addEventListener("click", async (event) => {
  const button = event.target.closest(".delete-btn");
  if (!button) {
    return;
  }

  const index = Number(button.dataset.index);
  if (Number.isNaN(index)) {
    return;
  }

  currentBlacklist = currentBlacklist.filter((_, itemIndex) => itemIndex !== index);
  await chrome.storage.sync.set({ blacklist: currentBlacklist });
  renderSiteList(currentBlacklist);
});

document.getElementById("saveBtn").addEventListener("click", async () => {
  const settings = {
    focusTime: parseInt(document.getElementById("focusTime").value, 10),
    restTime: parseInt(document.getElementById("restTime").value, 10),
    totalSets: parseInt(document.getElementById("totalSets").value, 10),
  };

  await chrome.storage.sync.set(settings);
  showStatus("설정이 저장되었습니다.");
});
