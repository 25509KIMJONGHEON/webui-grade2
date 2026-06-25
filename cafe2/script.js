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
    const items = [
        '本日のコーヒー',
        'カフェラテ',
        'チーズケーキ',
        'カプチーノ',
        '抹茶ラテ',
        'プレーンスコーン',
    ];

    const i = Math.floor(Math.random() * items.length);

    document.getElementById('recommendResult').textContent = items[i];
}

// ============================================
// テーマ変更（ボタンを押すたびに色を切り替える）
// ============================================
const themes = [
  { name: 'coffee', main: '#78350F', accent: '#F59E0B', bg: '#FFFBEB' },
  { name: 'forest', main: '#15803D', accent: '#F97316', bg: '#F0FDF4' },
  { name: 'sunset', main: '#DB2777', accent: '#7C3AED', bg: '#FDF2F8' },
  { name: 'ocean',  main: '#0369A1', accent: '#FBBF24', bg: '#F0F9FF' },
];

let themeIndex = 0;

function toggleTheme() {
    themeIndex = (themeIndex + 1) % themes.length;

    // 今のテーマを取り出す
  const theme = themes[themeIndex];

  // CSS変数（--main-color など）を上書きして、ページ全体の色を変える
  document.documentElement.style.setProperty('--main-color', theme.main);
  document.documentElement.style.setProperty('--accent-color', theme.accent);
  document.documentElement.style.setProperty('--bg-color', theme.bg);
}

// ============================================
// localStorage アクセスカウンター
// ============================================
function countVisit() {
    let count = localStorage.getItem('visitCount');

    if (count === null ) {
        count = 0;
    } else {
        count = Number(count);
    }

    count = count + 1;
    
    localStorage.setItem('visitCount', count);
    document.getElementById('visitCount').textContent = count;
}

countVisit();