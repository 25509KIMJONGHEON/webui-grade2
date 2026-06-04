async function getPokemon() {
    const name = document.getElementById('name').value;
    const url = `https://pokeapi.co/api/v2/pokemon/${name}`;

    const res = await fetch(url);
    const data = await res.json();

    const stats = data.stats
        .map(s => `<li>${s.stat.name}: ${s.base_stat}</li>`)
        .join('');

    document.getElementById('section1-result').innerHTML = `
        <img src="${data.sprites.front_default}" alt="${data.name}">
        <h3>${data.name}</h3>
        <ul>${stats}</ul>
    `;

}

document.getElementById('section1-btn').addEventListener('click', getPokemon);