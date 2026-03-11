function heartbeat() {
  chrome.runtime.sendMessage({
    action: "heartbeatTick",
    now: Date.now(),
  });
}

heartbeat();
setInterval(heartbeat, 1000);
