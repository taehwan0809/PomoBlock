function updateBlockedTimer() {
    chrome.runtime.sendMessage({ action: 'getState' }, (state) => {
        if (state && state.isRunning) {
            const minutes = Math.floor(state.timeLeft / 60);
            const seconds = state.timeLeft % 60;
            document.getElementById('remainingTime').textContent =
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            // 집중 모드가 아니면 (혹시나 들어왔을 경우) 이전 페이지로 이동 시도
            window.history.back();
        }
    });
}

setInterval(updateBlockedTimer, 1000);
updateBlockedTimer();