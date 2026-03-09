// 1. 초기 상태 설정
let timerState = {
    isRunning: false,
    mode: 'FOCUS',
    currentSet: 1,
    timeLeft: 1500,
};

// 2. 사이트 차단 엔진 (declarativeNetRequest)
async function updateBlocking(isFocusMode) {
    const { blacklist = ['youtube.com', 'instagram.com', 'facebook.com'] } = await chrome.storage.sync.get('blacklist');
    const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldRules.map(r => r.id) });

    if (isFocusMode) {
        const newRules = blacklist.map((domain, index) => ({
            id: index + 1,
            priority: 1,
            action: { type: 'block' },
            condition: {
                // 특정 문자열이 포함된 모든 도메인과 서브도메인을 막음
                urlFilter: `||${domain}^`,
                resourceTypes: ['main_frame']
            }
        }));
        await chrome.declarativeNetRequest.updateDynamicRules({ addRules: newRules });
    }
}
// 3. 타이머 알람 리스너 (실시간 배지 업데이트 핵심)
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'pomoTimer') {
        timerState.timeLeft--;

        // 상단 아이콘 위에 남은 시간 표시 (Badge)
        const minutes = Math.floor(timerState.timeLeft / 60);
        const seconds = timerState.timeLeft % 60;
        const badgeText = minutes > 0 ? `${minutes}m` : `${seconds}s`;

        chrome.action.setBadgeText({ text: badgeText });
        chrome.action.setBadgeBackgroundColor({
            color: timerState.mode === 'FOCUS' ? '#ff5252' : '#4caf50'
        });

        if (timerState.timeLeft <= 0) {
            handlePhaseEnd();
        }
    }
});

// 4. 집중/휴식 종료 처리
async function handlePhaseEnd() {
    const settings = await chrome.storage.sync.get(['focusTime', 'restTime', 'totalSets']);

    if (timerState.mode === 'FOCUS') {
        timerState.mode = 'REST';
        timerState.timeLeft = (settings.restTime || 5) * 60;
        updateBlocking(false); // 휴식 중엔 차단 해제
        showNotification("휴식 시간입니다!", "잠시 눈을 붙이고 쉬어보세요.");
    } else {
        if (timerState.currentSet < (settings.totalSets || 4)) {
            timerState.currentSet++;
            timerState.mode = 'FOCUS';
            timerState.timeLeft = (settings.focusTime || 25) * 60;
            updateBlocking(true); // 다시 차단
            showNotification(`${timerState.currentSet}세트 시작!`, "다시 집중해볼까요?");
        } else {
            resetTimer();
            showNotification("축하합니다!", "오늘의 모든 세트를 완료했습니다.");
        }
    }
}

// 5. 타이머 초기화
function resetTimer() {
    timerState = { isRunning: false, mode: 'FOCUS', currentSet: 1, timeLeft: 1500 };
    chrome.alarms.clear('pomoTimer');
    chrome.action.setBadgeText({ text: '' });
    updateBlocking(false);
}

// 6. 알림 띄우기
function showNotification(title, message) {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: '../icons/icon128.png',
        title: title,
        message: message
    });
}

// 7. 메시지 수신 (Popup과 대화)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getState') {
        sendResponse(timerState);
    } else if (request.action === 'start') {
        chrome.storage.sync.get(['focusTime'], (settings) => {
            timerState.isRunning = true;
            timerState.mode = 'FOCUS';
            timerState.timeLeft = (settings.focusTime || 25) * 60;

            updateBlocking(true);
            chrome.alarms.create('pomoTimer', { periodInMinutes: 1 / 60 });
        });
    } else if (request.action === 'stop') {
        resetTimer();
    }
    return true; // 비동기 응답 필수
});