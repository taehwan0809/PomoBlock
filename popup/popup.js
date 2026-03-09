// 1. 공통 타이머 텍스트 업데이트 함수
function updateTimerDisplay(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const display = document.getElementById('timerDisplay');
    if (display) {
        display.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

// 2. 전체 UI 렌더링 함수 (state 객체를 받아 화면 갱신)
function renderUI(state) {
    if (!state) return;

    // 타이머 숫자 업데이트
    updateTimerDisplay(state.timeLeft);

    // 모드 상태(집중/휴식) 및 색상 업데이트
    const modeStatus = document.getElementById('modeStatus');
    const circle = document.getElementById('progressCircle');

    if (state.mode === 'FOCUS') {
        modeStatus.textContent = '집중 모드';
        modeStatus.style.color = '#ff5252';
        circle.style.stroke = '#ff5252';
    } else {
        modeStatus.textContent = '휴식 시간';
        modeStatus.style.color = '#4caf50';
        circle.style.stroke = '#4caf50';
    }

    // 버튼 상태 전환
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    if (state.isRunning) {
        startBtn.classList.add('hidden');
        stopBtn.classList.remove('hidden');
    } else {
        startBtn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
    }

    // 세트 카운터(도트) 업데이트
    chrome.storage.sync.get(['totalSets'], (data) => {
        const totalSets = data.totalSets || 4;
        const setCounter = document.getElementById('setCounter');
        setCounter.innerHTML = '';

        for (let i = 1; i <= totalSets; i++) {
            const dot = document.createElement('div');
            dot.classList.add('dot');
            if (i < state.currentSet) {
                dot.classList.add('active');
            } else if (i === state.currentSet && state.isRunning) {
                dot.style.border = '1px solid #ff5252';
            }
            setCounter.appendChild(dot);
        }
    });

    // 프로그레스 링 업데이트
    chrome.storage.sync.get(['focusTime', 'restTime'], (data) => {
        const totalTime = (state.mode === 'FOCUS' ? (data.focusTime || 25) : (data.restTime || 5)) * 60;
        const offset = 440 - (440 * state.timeLeft / totalTime);
        circle.style.strokeDashoffset = offset;
    });
}

// 3. 페이지 로드 시 초기화 로직
document.addEventListener('DOMContentLoaded', () => {
    chrome.runtime.sendMessage({ action: 'getState' }, (state) => {
        if (state && state.isRunning) {
            // 1. 이미 타이머가 실행 중이면 현재 백그라운드 시간을 그대로 표시
            renderUI(state);
        } else {
            // 2. 실행 중이 아닐 때만 설정 페이지의 값을 가져와서 표시
            chrome.storage.sync.get(['focusTime', 'totalSets'], (data) => {
                const settingsTime = (data.focusTime || 25) * 60;

                // UI 업데이트 함수 호출 시 실행 중이지 않은 상태의 커스텀 시간을 강제로 주입
                renderUI({
                    ...state,
                    timeLeft: settingsTime,
                    isRunning: false,
                    currentSet: 1
                });
            });
        }
    });

    // 1초마다 반복 업데이트는 그대로 유지
    setInterval(() => {
        chrome.runtime.sendMessage({ action: 'getState' }, (state) => {
            renderUI(state);
        });
    }, 1000);
});

// 4. 이벤트 리스너들
document.getElementById('settingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
});

document.getElementById('startBtn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'start' });
});

document.getElementById('stopBtn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'getState' }, (state) => {
        chrome.storage.sync.get(['totalSets'], (data) => {
            const totalSets = data.totalSets || 4;
            const remainingSets = totalSets - state.currentSet + 1;

            const confirmQuit = confirm(
                `현재 ${state.currentSet}세트 진행 중입니다.\n` +
                `목표 달성까지 ${remainingSets}세트 남았어요!\n\n` +
                `정말로 몰입을 종료하시겠어요?`
            );

            if (confirmQuit) {
                chrome.runtime.sendMessage({ action: 'stop' });
            }
        });
    });
});