// const name = prompt("名前は？");
// alert("こんにちは、" + name + "さん！");

// const target = "<h1 id='target'>Hello world</h1>";
const target = document.getElementById("target");
target.textContent = "こんにちは!";
target.style.color = "red";
target.style.fontSize = "10px";
target.style.backgroundColor = "yellow";