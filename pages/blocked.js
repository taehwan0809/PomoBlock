function updateBlockedTimer() {
  chrome.runtime.sendMessage({ action: "getState" }, (state) => {
    if (chrome.runtime.lastError) {
      return;
    }

    if (state?.isRunning && state.mode === "FOCUS") {
      const minutes = Math.floor(state.timeLeft / 60);
      const seconds = state.timeLeft % 60;
      document.getElementById("remainingTime").textContent =
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
      return;
    }

    window.close();
  });
}

setInterval(updateBlockedTimer, 1000);
updateBlockedTimer();
