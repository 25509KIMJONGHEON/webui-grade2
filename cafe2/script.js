// 席のご予約 기능
function reserve() {
    // 入力した内容を取得する
    const name = document.getElementById('guestName').value;
    const count = document.getElementById('guestCount').value;
   
    // 結果を表示する場所を取得する
    const result = document.getElementById('reserveResult');

    // 名前か人数が空だったら、注意メッセージを出して終了する
    if (name === '' || count === '') {
        result.textContent = '入力してください';
        return;
    } else {
        result.textContent = `✓ ご予約ありがとうございます、${name}様。${count}名様で承りました。`;
    }
}

// recommend
function pickRecommend() {
}