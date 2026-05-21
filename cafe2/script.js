// 席のご予約 기능
function reserve() {
    // 🌟 대소문자 구분을 위해 guestName으로 수정했습니다!
    const name = document.getElementById('guestName').value;
    const count = document.getElementById('guestCount').value;
    const result = document.getElementById('reserveResult');

    // 이름이나 인원수가 비어있는지 확인하는 안전장치 추가
    if (!name || !count) {
        alert('お名前と人数を入力してください。');
        return;
    }

    // 결과 텍스트 출력
    result.textContent = `ご予約ありがとうございます！お名前: ${name}様, 人数: ${count}名`;
}