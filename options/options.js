// 기본값 설정
const DEFAULT_SETTINGS = {
    focusTime: 25,
    restTime: 5,
    totalSets: 4,
    blacklist: ['youtube.com', 'instagram.com', 'facebook.com']
};

// 페이지 로드 시 저장된 설정 불러오기
document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
        document.getElementById('focusTime').value = items.focusTime;
        document.getElementById('restTime').value = items.restTime;
        document.getElementById('totalSets').value = items.totalSets;
        renderSiteList(items.blacklist);
    });
});

// 사이트 리스트 렌더링 함수
function renderSiteList(sites) {
    const list = document.getElementById('siteList');
    list.innerHTML = '';
    sites.forEach((site, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
        <span>${site}</span>
        <button class="delete-btn" data-index="${index}">삭제</button>
    `;
        list.appendChild(li);
    });
}

// 사이트 추가 버튼 이벤트
document.getElementById('addSiteBtn').addEventListener('click', () => {
    const newSite = document.getElementById('newSite').value.trim();
    if (newSite) {
        // 기존 목록을 먼저 가져온 뒤 새 사이트 추가
        chrome.storage.sync.get({ blacklist: ['youtube.com', 'instagram.com', 'facebook.com'] }, (items) => {
            if (!items.blacklist.includes(newSite)) {
                const updatedList = [...items.blacklist, newSite];
                chrome.storage.sync.set({ blacklist: updatedList }, () => {
                    renderSiteList(updatedList);
                    document.getElementById('newSite').value = '';
                });
            }
        });
    }
});

// 설정 최종 저장
document.getElementById('saveBtn').addEventListener('click', () => {
    const settings = {
        focusTime: parseInt(document.getElementById('focusTime').value),
        restTime: parseInt(document.getElementById('restTime').value),
        totalSets: parseInt(document.getElementById('totalSets').value)
    };

    chrome.storage.sync.set(settings, () => {
        const status = document.getElementById('statusMsg');
        status.textContent = '설정이 저장되었습니다!';
        setTimeout(() => { status.textContent = ''; }, 2000);
    });
});