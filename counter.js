let counter = 0;

function increment() {
    counter++;
    document.getElementById('counter').textContent = counter;
}

function decrement() {
    counter--;
    document.getElementById('counter').textContent = counter;
}

function reset() {
    counter = 0;
    document.getElementById('counter').textContent = counter;
}