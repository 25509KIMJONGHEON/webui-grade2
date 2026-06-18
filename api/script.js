let myParty = [];
let playerParty = [];
let activePlayerIndex = 0;
let opponentPokemon = null;
let inventory = {
    potion: { count: 3, name: 'キズぐすり', img: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/potion.png' },
    pokeball: { count: 5, name: 'モンスターボール', rate: 1, img: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png' },
    greatball: { count: 5, name: 'スーパーボール', rate: 1.5, img: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/great-ball.png' },
    ultraball: { count: 5, name: 'ハイパーボール', rate: 2, img: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ultra-ball.png' },
    masterball: { count: 1, name: 'マスターボール', rate: 255, img: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/master-ball.png' }
};
let isPlayerTurn = true;
let pokemonBox = [];
let pendingCaughtPokemon = null;
let pokedex = {};
let money = 3000; // 초기 소지금 3000엔

const itemPrices = {
    potion: 300,
    pokeball: 200,
    greatball: 600,
    ultraball: 1200,
    masterball: 100000 // 마스터볼은 판매하지 않음
};

// 저장된 게임 데이터 불러오기 (초기화 방지)
if (localStorage.getItem('pokeGame_myParty')) {
    myParty = JSON.parse(localStorage.getItem('pokeGame_myParty'));
}
if (localStorage.getItem('pokeGame_pokemonBox')) {
    pokemonBox = JSON.parse(localStorage.getItem('pokeGame_pokemonBox'));
}
if (localStorage.getItem('pokeGame_pokedex')) {
    pokedex = JSON.parse(localStorage.getItem('pokeGame_pokedex'));
}
if (localStorage.getItem('pokeGame_money')) {
    money = parseInt(localStorage.getItem('pokeGame_money'));
}
if (localStorage.getItem('pokeGame_inventory')) {
    inventory = JSON.parse(localStorage.getItem('pokeGame_inventory'));
}

function updateMoneyUI() {
    const mDisplay = document.getElementById('money-display');
    const smDisplay = document.getElementById('shop-money-display');
    if (mDisplay) mDisplay.innerText = money;
    if (smDisplay) smDisplay.innerText = money;
}

function saveGameState() {
    localStorage.setItem('pokeGame_myParty', JSON.stringify(myParty));
    localStorage.setItem('pokeGame_pokemonBox', JSON.stringify(pokemonBox));
    localStorage.setItem('pokeGame_pokedex', JSON.stringify(pokedex));
    localStorage.setItem('pokeGame_money', money);
    localStorage.setItem('pokeGame_inventory', JSON.stringify(inventory));
}

function updatePokedex(pokemon, caught = false) {
    if (!pokedex[pokemon.id]) {
        pokedex[pokemon.id] = {
            id: pokemon.id,
            name: pokemon.name,
            sprite: pokemon.spriteFront,
            caught: false
        };
    }
    if (caught) pokedex[pokemon.id].caught = true;
    saveGameState();
}

function handleRadioChange(role) {
    document.querySelectorAll(`input[name="${role}-type"]`).forEach(radio => {
        radio.addEventListener('change', (e) => {
            const type = e.target.value;
            document.getElementById(`${role}-name`).disabled = (type !== 'manual');
            
            if (role === 'p') {
                if (type === 'existing') {
                    document.getElementById('p-input-container').classList.add('hidden');
                    document.getElementById('p-level-container').classList.add('hidden');
                    document.getElementById('p-existing-container').classList.remove('hidden');
                    updateExistingPokemonSelect();
                } else {
                    document.getElementById('p-input-container').classList.remove('hidden');
                    document.getElementById('p-level-container').classList.remove('hidden');
                    document.getElementById('p-existing-container').classList.add('hidden');
                }
            }
        });
    });
}
handleRadioChange('p');
handleRadioChange('o');

async function getPokemonIdByJapaneseName(jaName) {
    const query = `
        query {
          pokemon_v2_pokemonspeciesname(where: {name: {_eq: "${jaName}"}, pokemon_v2_language: {name: {_in: ["ja-Hrkt", "ja"]}}}) {
            pokemon_species_id
          }
        }
    `;
    const res = await fetch('https://beta.pokeapi.co/graphql/v1beta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
    });
    const data = await res.json();
    const names = data.data?.pokemon_v2_pokemonspeciesname;
    if (names && names.length > 0) {
        return names[0].pokemon_species_id;
    }
    return null;
}

function calculateStat(base, level, isHp) {
    if (isHp) return Math.floor(0.01 * (2 * base + 31) * level) + level + 10;
    return Math.floor(0.01 * (2 * base + 31) * level) + 5;
}

async function fetchPokemonData(pokemonId, level) {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
    const data = await res.json();

    const speciesRes = await fetch(data.species.url);
    const speciesData = await speciesRes.json();
    const jaNameObj = speciesData.names.find(n => n.language.name === 'ja-Hrkt') ||
                      speciesData.names.find(n => n.language.name === 'ja') ||
                      { name: data.name };
    const displayName = jaNameObj.name;

    const hpBase = data.stats.find(s => s.stat.name === 'hp').base_stat;
    const atkBase = data.stats.find(s => s.stat.name === 'attack').base_stat;
    const defBase = data.stats.find(s => s.stat.name === 'defense').base_stat;
    const spdBase = data.stats.find(s => s.stat.name === 'speed').base_stat;
    const captureRate = speciesData.capture_rate || 255;

    // 스킬 무작위 4개 추출
    const shuffledMoves = data.moves.sort(() => 0.5 - Math.random()).slice(0, 4);
    const fetchedMoves = await Promise.all(shuffledMoves.map(async m => {
        try {
            const moveRes = await fetch(m.move.url);
            const moveData = await moveRes.json();
            const jaNameObj = moveData.names.find(n => n.language.name === 'ja-Hrkt') || moveData.names.find(n => n.language.name === 'ja');
            const moveJaName = jaNameObj ? jaNameObj.name : moveData.name;
            const ft = moveData.flavor_text_entries.find(e => e.language.name === 'ja-Hrkt' || e.language.name === 'ja');
            const flavorText = ft ? ft.flavor_text.replace(/\n|\f/g, ' ') : "説明なし";
            return { name: moveJaName, power: moveData.power || 40, desc: flavorText, type: moveData.type.name };
        } catch(e) { 
            return { name: "たいあたり", power: 40, desc: "いりょくは よわいが あいてに ぶつかって こうげきする。", type: "normal" }; 
        }
    }));

    // 스킬이 없을 경우 기본 스킬 부여
    if(fetchedMoves.length === 0) fetchedMoves.push({ name: "たいあたり", power: 40, desc: "いりょくは よわいが あいてに ぶつかって こうげきする。", type: "normal" });

    const maxHp = calculateStat(hpBase, level, true);
    return {
        id: data.id,
        name: displayName,
        spriteFront: data.sprites.front_default || '',
        spriteBack: data.sprites.back_default || data.sprites.front_default || '',
        level: level,
        maxHp: maxHp,
        currentHp: maxHp,
        attack: calculateStat(atkBase, level, false),
        defense: calculateStat(defBase, level, false),
        speed: calculateStat(spdBase, level, false),
        captureRate: captureRate,
        moves: fetchedMoves
    };
}

async function selectPokemon(role) {
    const prefix = role === 'player' ? 'p' : 'o';
    const type = document.querySelector(`input[name="${prefix}-type"]:checked`).value;
    const resultDiv = document.getElementById(`${prefix}-result`);

    if (role === 'player' && type === 'existing') {
        const selectVal = document.getElementById('p-existing-select').value;
        if (!selectVal) return alert('ポケモンを選択してください！');
        
        const [loc, idxStr] = selectVal.split('-');
        const idx = parseInt(idxStr);
        let selectedPokemon;

        if (loc === 'party') {
            // 이미 파티에 있는 포켓몬을 선두(첫 번째)로 올림
            selectedPokemon = myParty.splice(idx, 1)[0];
            myParty.unshift(selectedPokemon);
        } else if (loc === 'box') {
            // 박스에 있는 포켓몬을 파티 선두로 영입함
            selectedPokemon = pokemonBox.splice(idx, 1)[0];
            if (myParty.length >= 6) {
                // 파티가 6마리로 꽉 찬 경우 기존 선두를 박스로 보냄
                const oldLead = myParty.splice(0, 1)[0];
                pokemonBox.push(oldLead);
            }
            myParty.unshift(selectedPokemon);
        }

        updateMyPartyUI();
        updatePokemonBoxUI();
        
        resultDiv.innerHTML = `
            <img src="${selectedPokemon.spriteFront}" alt="${selectedPokemon.name}" style="width:80px">
            <h4>${selectedPokemon.name} (Lv.${selectedPokemon.level})</h4>
            <p>HP: ${selectedPokemon.maxHp} | 攻撃: ${selectedPokemon.attack} | 防御: ${selectedPokemon.defense} | すばやさ: ${selectedPokemon.speed}</p>
        `;

        if (myParty.length > 0 && opponentPokemon) {
            document.getElementById('start-battle-btn').disabled = false;
        }
        return;
    }

    const level = parseInt(document.getElementById(`${prefix}-level`).value);
    let pokemonId;
    if (type === 'random') {
        pokemonId = Math.floor(Math.random() * 898) + 1; 
    } else {
        const jaName = document.getElementById(`${prefix}-name`).value.trim();
        if (!jaName) {
            alert('ポケモンの名前を日本語で入力してください！');
            return;
        }
        resultDiv.innerHTML = '検索中...';
        pokemonId = await getPokemonIdByJapaneseName(jaName);
        if (!pokemonId) {
            resultDiv.innerHTML = '<span style="color:red">見つかりませんでした。</span>';
            return;
        }
    }

    try {
        const stats = await fetchPokemonData(pokemonId, level);

        if (role === 'player') {
            if (myParty.length < 6) {
                myParty.push(stats);
            } else {
                alert('手持ちがいっぱいです！ボックスに送られました。');
                pokemonBox.push(stats);
            }
            updatePokedex(stats, true);
            updateMyPartyUI();
            updatePokemonBoxUI();
        } else {
            opponentPokemon = stats;
            updatePokedex(stats, false);
        }

        resultDiv.innerHTML = `
            <img src="${stats.spriteFront}" alt="${stats.name}" style="width:80px">
            <h4>${stats.name} (Lv.${level})</h4>
            <p>HP: ${stats.maxHp} | 攻撃: ${stats.attack} | 防御: ${stats.defense} | すばやさ: ${stats.speed}</p>
        `;

        if (myParty.length > 0 && opponentPokemon) {
            document.getElementById('start-battle-btn').disabled = false;
        }
    } catch (error) {
        console.error(error);
        resultDiv.innerHTML = 'エラーが発生しました。';
    }
}

document.getElementById('p-select-btn').addEventListener('click', () => selectPokemon('player'));
document.getElementById('o-select-btn').addEventListener('click', () => selectPokemon('opponent'));

// --- 배틀 시스템 ---
const battleLog = document.getElementById('battle-log');

function logMessage(msg) {
    battleLog.innerHTML += `<div>${msg}</div>`;
    battleLog.scrollTop = battleLog.scrollHeight;
}

function updateArenaUI() {
    const p = playerParty[activePlayerIndex];
    const o = opponentPokemon;

    document.getElementById('p-battle-name').innerHTML = `<span>${p.name}</span><span>Lv.${p.level}</span>`;
    document.getElementById('p-hp-text').innerText = `${p.currentHp}/${p.maxHp}`;
    const pPercent = (p.currentHp / p.maxHp) * 100;
    const pBar = document.getElementById('p-hp-bar');
    pBar.style.width = `${pPercent}%`;
    pBar.style.backgroundColor = pPercent > 50 ? '#4caf50' : pPercent > 25 ? '#ffeb3b' : '#f44336';
    document.getElementById('p-sprite').src = p.spriteBack;

    document.getElementById('o-battle-name').innerHTML = `<span>${o.name}</span><span>Lv.${o.level}</span>`;
    const oPercent = (o.currentHp / o.maxHp) * 100;
    const oBar = document.getElementById('o-hp-bar');
    oBar.style.width = `${oPercent}%`;
    oBar.style.backgroundColor = oPercent > 50 ? '#4caf50' : oPercent > 25 ? '#ffeb3b' : '#f44336';
    document.getElementById('o-sprite').src = o.spriteFront;
}

function toggleMenu(menuId) {
    ['main-menu', 'moves-menu', 'items-menu', 'party-menu'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    document.getElementById(menuId).classList.remove('hidden');
}

document.getElementById('start-battle-btn').addEventListener('click', async () => {
    if (myParty.length === 0) return alert('手持ちポケモンがいません！');
    document.getElementById('start-battle-btn').disabled = true;
    playerParty = myParty; // 실제 전투에는 내가 꾸린 파티를 내보냄

    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('start-container').classList.add('hidden');
    document.getElementById('battle-screen').classList.remove('hidden');

    battleLog.innerHTML = "";
    logMessage(`ああっ！ やせいの <b>${opponentPokemon.name}</b> が とびだしてきた！`);
    logMessage(`ゆけっ！ <b>${playerParty[0].name}</b>！`);
    
    updateArenaUI();
});

// 메인 메뉴 액션
document.getElementById('btn-fight').addEventListener('click', () => {
    const movesMenu = document.getElementById('moves-menu');
    movesMenu.innerHTML = '';
    const p = playerParty[activePlayerIndex];
    p.moves.forEach(move => {
        const btn = document.createElement('button');
        btn.innerHTML = `<span style="font-size: 14px; font-weight: bold;">${move.name}</span><br><span style="font-size: 10px; color: #555;">${move.desc.substring(0, 15)}${move.desc.length > 15 ? '...' : ''}</span>`;
        btn.title = move.desc;
        btn.onclick = () => handlePlayerAction('attack', move);
        movesMenu.appendChild(btn);
    });
    const backBtn = document.createElement('button');
    backBtn.innerText = 'もどる';
    backBtn.className = 'back-btn';
    backBtn.onclick = () => toggleMenu('main-menu');
    movesMenu.appendChild(backBtn);
    toggleMenu('moves-menu');
});

document.getElementById('btn-bag').addEventListener('click', () => {
    const itemsMenu = document.getElementById('items-menu');
    itemsMenu.innerHTML = '';
    Object.keys(inventory).forEach(key => {
        const item = inventory[key];
        const btn = document.createElement('button');
        btn.innerHTML = `<img src="${item.img}" style="width:20px; vertical-align:middle; margin-right:5px;">${item.name}<br><span style="font-size: 11px;">(残り${item.count})</span>`;
        if (item.count <= 0) btn.disabled = true;
        btn.onclick = () => handlePlayerAction('item', key);
        itemsMenu.appendChild(btn);
    });
    const backBtn = document.createElement('button');
    backBtn.innerText = 'もどる';
    backBtn.className = 'back-btn';
    backBtn.onclick = () => toggleMenu('main-menu');
    itemsMenu.appendChild(backBtn);
    toggleMenu('items-menu');
});

document.getElementById('btn-pokemon').addEventListener('click', () => {
    const partyMenu = document.getElementById('party-menu');
    partyMenu.innerHTML = '';
    playerParty.forEach((pkmn, index) => {
        const btn = document.createElement('button');
        btn.innerText = `${pkmn.name} (HP: ${pkmn.currentHp}/${pkmn.maxHp})`;
        if(index === activePlayerIndex || pkmn.currentHp === 0) btn.disabled = true;
        btn.onclick = () => handlePlayerAction('switch', index);
        partyMenu.appendChild(btn);
    });
    const backBtn = document.createElement('button');
    backBtn.innerText = 'もどる';
    backBtn.className = 'back-btn';
    backBtn.onclick = () => toggleMenu('main-menu');
    partyMenu.appendChild(backBtn);
    toggleMenu('party-menu');
});

document.getElementById('btn-run').addEventListener('click', () => {
    logMessage('うまく にげきれた！');
    endGame();
});

// 배틀 턴 처리 로직
async function handlePlayerAction(actionType, payload) {
    toggleMenu('main-menu'); // 메뉴 닫기
    const p = playerParty[activePlayerIndex];
    const o = opponentPokemon;

    // 아이템이나 교체는 무조건 선공
    if (actionType === 'item') {
        const item = inventory[payload];
        if (item.count <= 0) return alert('どうぐが ありません！');
        item.count--;
        saveGameState(); // 아이템 사용 시 저장

        if (payload === 'potion') {
            p.currentHp = Math.min(p.maxHp, p.currentHp + 50);
            logMessage(`<img src="${item.img}" style="width:20px; vertical-align:middle;"> ${p.name} に ${item.name} を つかった！ HPが かいふくした！`);
            updateArenaUI();
        } else {
            logMessage(`<img src="${item.img}" style="width:20px; vertical-align:middle;"> ${item.name} を なげた！`);
            
            let catchProb = 1; // 마스터볼은 100%
            if (payload !== 'masterball') {
                let hpFactor = (3 * o.maxHp - 2 * o.currentHp) / (3 * o.maxHp);
                catchProb = hpFactor * (o.captureRate / 255) * item.rate;
            }
            
            if (Math.random() <= catchProb) {
                logMessage(`やったー！ <b>${o.name}</b> を つかまえた！`);
                updatePokedex(o, true);
                pendingCaughtPokemon = o;
                return endGame();
            } else {
                logMessage(`ああっ！ つかまらなかった！`);
            }
        }
        await sleep(1000);
        executeOpponentTurn();
    } 
    else if (actionType === 'switch') {
        logMessage(`${p.name}！ もどれ！`);
        activePlayerIndex = payload;
        const newP = playerParty[activePlayerIndex];
        logMessage(`ゆけっ！ <b>${newP.name}</b>！`);
        updateArenaUI();
        await sleep(1000);
        executeOpponentTurn();
    } 
    else if (actionType === 'attack') {
        const pMove = payload;
        const oMove = o.moves[Math.floor(Math.random() * o.moves.length)];

        // 스피드 비교
        if (p.speed >= o.speed) {
            if(await executeMove(p, o, pMove, 'player')) return;
            if(await executeMove(o, p, oMove, 'opponent')) return checkPlayerLoss();
        } else {
            if(await executeMove(o, p, oMove, 'opponent')) return checkPlayerLoss();
            if(await executeMove(p, o, pMove, 'player')) return;
        }
    }
}

async function executeOpponentTurn() {
    const p = playerParty[activePlayerIndex];
    const o = opponentPokemon;
    if(o.currentHp <= 0) return;
    
    const oMove = o.moves[Math.floor(Math.random() * o.moves.length)];
    if(await executeMove(o, p, oMove, 'opponent')) {
        checkPlayerLoss();
    }
}

async function executeMove(attacker, defender, move, role) {
    const attackerName = role === 'player' ? attacker.name : `あいての ${attacker.name}`;
    logMessage(`${attackerName} の <b>${move.name}</b>！`);
    
    const isPlayer = role === 'player';
    const attackerImg = document.getElementById(isPlayer ? 'p-sprite' : 'o-sprite');
    const defenderImg = document.getElementById(isPlayer ? 'o-sprite' : 'p-sprite');
    const effectEl = document.getElementById(isPlayer ? 'o-effect' : 'p-effect');

    // 1. 공격자 모션 애니메이션
    attackerImg.classList.add(isPlayer ? 'anim-attack-player' : 'anim-attack-opp');
    await sleep(300);
    attackerImg.classList.remove('anim-attack-player', 'anim-attack-opp');

    let damage = Math.floor((((2 * attacker.level / 5 + 2) * move.power * (attacker.attack / defender.defense)) / 50) + 2);
    damage = Math.floor(damage * (0.85 + Math.random() * 0.15)); // 85% ~ 100% 난수 데미지
    if(damage <= 0) damage = 1;

    defender.currentHp = Math.max(0, defender.currentHp - damage);
    
    // 2. 타입 이모지 이펙트 및 피격 애니메이션
    const typeEmojiMap = { normal: '💥', fire: '🔥', water: '💧', grass: '🍃', electric: '⚡', ice: '❄️', fighting: '🥊', poison: '☠️', ground: '🪨', flying: '🌪️', psychic: '🔮', bug: '🐛', rock: '🪨', ghost: '👻', dragon: '🐉', dark: '🌑', steel: '⚙️', fairy: '✨' };
    effectEl.innerText = typeEmojiMap[move.type] || '💥';
    effectEl.classList.add('show-effect');
    defenderImg.classList.add('anim-shake');
    
    const defenderStr = role === 'player' ? `あいての ${defender.name}` : defender.name;
    logMessage(`${defenderStr} に ${damage}の ダメージ！`);
    updateArenaUI();
    
    await sleep(500);
    effectEl.classList.remove('show-effect');
    defenderImg.classList.remove('anim-shake');
    await sleep(500);

    if (defender.currentHp <= 0) {
        logMessage(`<b>${defenderStr} は たおれた！</b>`);
        if (role === 'player') {
            const earnedMoney = defender.level * 50;
            money += earnedMoney;
            logMessage('<b>たたかいに かった！ ✨</b>');
            logMessage(`<b>${earnedMoney}円 を 手に入れた！</b>`);
            updateMoneyUI();
            saveGameState();
            endGame();
        } else {
            // 플레이어 포켓몬이 쓰러진 경우
            document.getElementById('p-sprite').src = '';
        }
        return true;
    }
    return false;
}

function checkPlayerLoss() {
    const isAllDead = playerParty.every(p => p.currentHp <= 0);
    if (isAllDead) {
        logMessage('<b>てもちの ポケモンが いない！<br>めのまえが まっくらになった... 💀</b>');
        endGame();
    } else {
        logMessage('<b>どの ポケモンを だす？</b>');
        document.getElementById('btn-pokemon').click(); // 파티 메뉴 강제 오픈
        // 뒤로가기 버튼 제거 (무조건 선택해야 함)
        const backBtn = document.querySelector('#party-menu .back-btn');
        if(backBtn) backBtn.remove();
    }
}

function endGame() {
    ['main-menu', 'moves-menu', 'items-menu', 'party-menu', 'catch-action-menu', 'catch-swap-menu'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    document.getElementById('end-battle-menu').classList.remove('hidden');
}

document.getElementById('btn-end-battle').addEventListener('click', () => {
    if (pendingCaughtPokemon) {
        document.getElementById('end-battle-menu').classList.add('hidden');
        document.getElementById('catch-action-text').innerText = `${pendingCaughtPokemon.name}を手持ちに加えますか？`;
        document.getElementById('catch-action-menu').classList.remove('hidden');
    } else {
        exitBattle();
    }
});

document.getElementById('btn-catch-yes').addEventListener('click', () => {
    if (myParty.length < 6) {
        myParty.push(pendingCaughtPokemon);
        pendingCaughtPokemon = null;
        exitBattle();
    } else {
        document.getElementById('catch-action-menu').classList.add('hidden');
        const swapList = document.getElementById('catch-swap-list');
        swapList.innerHTML = '';
        myParty.forEach((p, index) => {
            const btn = document.createElement('button');
            btn.innerText = `${p.name} (Lv.${p.level})`;
            btn.style.cssText = "flex: 1 1 45%; font-size: 14px; padding: 5px;";
            btn.onclick = () => {
                pokemonBox.push(myParty[index]);
                myParty[index] = pendingCaughtPokemon;
                pendingCaughtPokemon = null;
                exitBattle();
            };
            swapList.appendChild(btn);
        });
        document.getElementById('catch-swap-menu').classList.remove('hidden');
    }
});

document.getElementById('btn-catch-no').addEventListener('click', () => {
    pokemonBox.push(pendingCaughtPokemon);
    pendingCaughtPokemon = null;
    exitBattle();
});

function exitBattle() {
    document.getElementById('battle-screen').classList.add('hidden');
    ['end-battle-menu', 'catch-action-menu', 'catch-swap-menu'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    document.getElementById('setup-screen').classList.remove('hidden');
    document.getElementById('start-container').classList.remove('hidden');
    document.getElementById('main-menu').classList.remove('hidden'); 
    
    activePlayerIndex = 0; 
    
    if(myParty.length > 0) {
        myParty.forEach(p => p.currentHp = p.maxHp);
        document.getElementById('start-battle-btn').disabled = false;
    }
    updateMyPartyUI();
    updatePokemonBoxUI();
}

window.releasePokemon = function(event, location, index) {
    event.stopPropagation(); // 카드 클릭(교환) 이벤트가 동시에 실행되는 것을 방지
    if (location === 'party') {
        if (myParty.length <= 1) {
            alert('手持ちポケモンは1匹以上必要です！');
            return;
        }
        if (confirm(`${myParty[index].name} を 本当に にがしますか？`)) {
            myParty.splice(index, 1);
            updateMyPartyUI();
        }
    } else if (location === 'box') {
        if (confirm(`${pokemonBox[index].name} を 本当に にがしますか？`)) {
            pokemonBox.splice(index, 1);
            updatePokemonBoxUI();
        }
    }
};

function updatePokemonBoxUI() {
    const list = document.getElementById('pokemon-box-list');
    if (pokemonBox.length === 0) {
        list.innerHTML = '<p style="color: #777;">まだ つかまえた ポケモンがいません。</p>';
        return;
    }
    list.innerHTML = '';
    pokemonBox.forEach((p, index) => {
        const div = document.createElement('div');
        div.style.cssText = "border: 2px solid #555; border-radius: 8px; padding: 5px; text-align: center; background: #fff; min-width: 80px; cursor: pointer;";
        div.innerHTML = `
            <img src="${p.spriteFront}" style="width: 60px; height: 60px; object-fit: contain;">
            <div style="font-size: 12px; font-weight: bold;">${p.name}</div>
            <div style="font-size: 10px;">Lv.${p.level}</div>
            <button style="margin-top: 5px; font-size: 10px; padding: 2px 5px; background: #ffcccc; border: 1px solid #f44336; border-radius: 3px; cursor: pointer;" onclick="releasePokemon(event, 'box', ${index})">にがす</button>
        `;
        div.onclick = () => {
            if (myParty.length < 6) {
                myParty.push(p);
                pokemonBox.splice(index, 1);
                updateMyPartyUI();
                updatePokemonBoxUI();
            } else {
                alert('手持ちがいっぱいです！');
            }
        };
        list.appendChild(div);
    });
    updateExistingPokemonSelect();
    saveGameState();
}

function updateMyPartyUI() {
    const list = document.getElementById('my-party-list');
    if (myParty.length === 0) {
        list.innerHTML = '<p style="color: #777;">ポケモンを選択して追加してください。</p>';
        document.getElementById('p-result').innerHTML = '';
        return;
    }
    list.innerHTML = '';
    myParty.forEach((p, index) => {
        const div = document.createElement('div');
        div.style.cssText = "border: 2px solid #555; border-radius: 8px; padding: 5px; text-align: center; background: #fff; min-width: 80px; cursor: pointer;";
        div.innerHTML = `
            <img src="${p.spriteFront}" style="width: 60px; height: 60px; object-fit: contain;">
            <div style="font-size: 12px; font-weight: bold;">${p.name}</div>
            <div style="font-size: 10px;">Lv.${p.level}</div>
            <button style="margin-top: 5px; font-size: 10px; padding: 2px 5px; background: #ffcccc; border: 1px solid #f44336; border-radius: 3px; cursor: pointer;" onclick="releasePokemon(event, 'party', ${index})">にがす</button>
        `;
        div.onclick = () => {
            if (myParty.length > 1) {
                pokemonBox.push(p);
                myParty.splice(index, 1);
                updateMyPartyUI();
                updatePokemonBoxUI();
            } else {
                alert('手持ちポケモンは1匹以上必要です！');
            }
        };
        list.appendChild(div);
    });
    
    // 파티가 갱신될 때마다 선두(첫 번째) 포켓몬을 '자신의 포켓몬' 결과창에 자동 표시
    const lead = myParty[0];
    document.getElementById('p-result').innerHTML = `
        <img src="${lead.spriteFront}" alt="${lead.name}" style="width:80px">
        <h4>${lead.name} (Lv.${lead.level})</h4>
        <p>HP: ${lead.maxHp} | 攻撃: ${lead.attack} | 防御: ${lead.defense} | すばやさ: ${lead.speed}</p>
    `;

    updateExistingPokemonSelect();
    saveGameState();
}

function updateExistingPokemonSelect() {
    const select = document.getElementById('p-existing-select');
    if (!select) return;
    select.innerHTML = '';
    let hasPokemon = false;

    if (myParty.length > 0) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = "手持ち";
        myParty.forEach((p, index) => {
            const opt = document.createElement('option');
            opt.value = `party-${index}`;
            opt.text = `${p.name} (Lv.${p.level})`;
            optgroup.appendChild(opt);
            hasPokemon = true;
        });
        select.appendChild(optgroup);
    }

    if (pokemonBox.length > 0) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = "ボックス";
        pokemonBox.forEach((p, index) => {
            const opt = document.createElement('option');
            opt.value = `box-${index}`;
            opt.text = `${p.name} (Lv.${p.level})`;
            optgroup.appendChild(opt);
            hasPokemon = true;
        });
        select.appendChild(optgroup);
    }

    if (!hasPokemon) {
        const opt = document.createElement('option');
        opt.value = "";
        opt.text = "ポケモンがいません";
        select.appendChild(opt);
    }
}

// --- 도감 시스템 ---
document.getElementById('pokedex-btn').addEventListener('click', () => {
    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('start-container').classList.add('hidden');
    document.getElementById('pokedex-screen').classList.remove('hidden');
    renderPokedex();
});

document.getElementById('close-pokedex-btn').addEventListener('click', () => {
    document.getElementById('pokedex-screen').classList.add('hidden');
    document.getElementById('setup-screen').classList.remove('hidden');
    document.getElementById('start-container').classList.remove('hidden');
});

function renderPokedex() {
    const list = document.getElementById('pokedex-list');
    list.innerHTML = '';
    let seenCount = 0;
    let caughtCount = 0;
    
    for (let id = 1; id <= 898; id++) {
        const p = pokedex[id];
        if (p) seenCount++;
        if (p && p.caught) caughtCount++;

        const isCaught = p && p.caught;
        const spriteUrl = p ? p.sprite : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
        const displayName = isCaught ? p.name : '???';

        const div = document.createElement('div');
        div.style.cssText = `border: 2px solid ${isCaught ? '#4caf50' : '#888'}; border-radius: 8px; padding: 5px; text-align: center; background: ${isCaught ? '#fff' : '#eee'}; width: 80px; opacity: ${isCaught ? '1' : '0.6'};`;
        div.innerHTML = `<div style="font-size: 10px; color: #555;">No.${id}</div><img src="${spriteUrl}" loading="lazy" style="width: 60px; height: 60px; object-fit: contain; filter: ${isCaught ? 'none' : 'contrast(0) brightness(0.5)'};"><div style="font-size: 11px; font-weight: bold;">${displayName}</div>`;
        list.appendChild(div);
    }
    document.getElementById('seen-count').innerText = seenCount;
    document.getElementById('caught-count').innerText = caughtCount;
}

// --- 상점(Shop) 시스템 ---
document.getElementById('shop-btn').addEventListener('click', () => {
    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('start-container').classList.add('hidden');
    document.getElementById('shop-screen').classList.remove('hidden');
    renderShop();
});

document.getElementById('close-shop-btn').addEventListener('click', () => {
    document.getElementById('shop-screen').classList.add('hidden');
    document.getElementById('setup-screen').classList.remove('hidden');
    document.getElementById('start-container').classList.remove('hidden');
});

function renderShop() {
    const list = document.getElementById('shop-items-list');
    list.innerHTML = '';
    Object.keys(inventory).forEach(key => {
        if (key === 'masterball') return; // 마스터볼은 상점 판매 제외
        const item = inventory[key];
        const price = itemPrices[key];
        const div = document.createElement('div');
        div.style.cssText = "border: 2px solid #ccc; border-radius: 8px; padding: 10px; display: flex; align-items: center; justify-content: space-between; background: #fff;";
        div.innerHTML = `
            <div style="display: flex; align-items: center;">
                <img src="${item.img}" style="width: 40px; height: 40px; object-fit: contain; margin-right: 10px;">
                <div>
                    <div style="font-weight: bold; font-size: 14px;">${item.name}</div>
                    <div style="font-size: 12px; color: #555;">所持: ${item.count}個</div>
                    <div style="font-size: 14px; color: #d32f2f; font-weight: bold;">${price}円</div>
                </div>
            </div>
            <button style="padding: 5px 10px;" onclick="buyItem('${key}')">買う</button>
        `;
        list.appendChild(div);
    });
}

window.buyItem = function(key) {
    const price = itemPrices[key];
    if (money >= price) {
        money -= price;
        inventory[key].count++;
        updateMoneyUI();
        saveGameState();
        renderShop();
    } else {
        alert('お金が足りません！');
    }
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 페이지 로드 시 기존 데이터로 UI 세팅
updateMyPartyUI();
updatePokemonBoxUI();
updateMoneyUI(); // 페이지 로드 시 돈 UI 업데이트

// 저장된 포켓몬이 있다면 기본 선택을 '소지 포켓몬' 탭으로 자동 변경
if (myParty.length > 0) {
    const existingRadio = document.querySelector('input[name="p-type"][value="existing"]');
    if (existingRadio) {
        existingRadio.checked = true;
        existingRadio.dispatchEvent(new Event('change'));
    }
}