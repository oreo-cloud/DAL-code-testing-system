

var term = new Terminal();
term.open(document.getElementById('terminal'));

var wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
var wsHost = window.location.host;
var wsPath = "ws";
var socketUrl = wsProtocol + '//' + wsHost + '/' + wsPath;

console.log(socketUrl);
var socket = new WebSocket(socketUrl);

socket.onopen = function (event) {
    socket.send(JSON.stringify({ "project": project, "id": id, "homework": homework }));
};

socket.onclose = function (event) {
    window.location.href = "/";
};

var attachAddon = new AttachAddon.AttachAddon(socket);
term.loadAddon(attachAddon);

window.onbeforeunload = function () {
    socket.close();
};

// 可選：根據窗口大小動態調整xterm的尺寸
window.addEventListener('resize', function () {
    // 在這裡實現根據視窗大小調整終端尺寸的邏輯
    // term.fit(); // 假設使用了fit插件
});

// 獲取按鈕元素
let button19 = document.querySelector('.button-19');

// 為按鈕添加 'animationend' 事件監聽器
button19.addEventListener('animationend', () => {
    // 當動畫完成後，移除 'flip' 類別
    button19.classList.remove('animate__flip');
});

function test_click() {
    console.log("click!");
    fetch('/DS/get_output', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ "id": "e9e26000-deea-449e-9e7a-d86c4919c9201711101373526" })
    })
    .then(response => response.json())
    .then(data => {
        const out = JSON.parse(data.filename);
        console.log("id:");
        console.log(id);
        console.log("out:");
        console.log(out);
    
        let buttonContainer = document.getElementById('buttonContainer');
        while (buttonContainer.firstChild) {
            buttonContainer.removeChild(buttonContainer.firstChild);
        }
    
        // 遍歷每個檔案名稱並為每個檔案創建一個按鈕
        out.forEach((filename, index) => {
            setTimeout(() => {
                const newButton = document.createElement('button');
                newButton.id = filename;
                newButton.textContent = filename;
                newButton.title = filename;  // 懸停在按鈕上時，會顯示完整的文本內容
                newButton.classList.add('button-55', 'animate__animated','animate__fadeIn');
                // 為按鈕添加 onclick 屬性
                newButton.setAttribute('onclick', `get_file_content('${filename}')`);
        
                // 將新的按鈕添加到 DOM 中
                buttonContainer.appendChild(newButton);
            }, index * 300);  // 每個按鈕的創建被延遲了 index * 300 毫秒, index=1,2,3,...
        });
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}

function get_file_content(filename) {
    console.log("preview!");
    fetch('/DS/get_file_content', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ "id": "e9e26000-deea-449e-9e7a-d86c4919c9201711101373526", "filename": filename })
    })
    .then(response => response.json())
    .then(data => {
        // 獲取卡片元素
        
        let card = document.querySelector('#previewfile');
        let cardTitle = card.querySelector('.card-title');
        let cardText = card.querySelector('.card-text');

        // 設定卡片的標題和內容
        cardTitle.textContent = filename;
        cardText.textContent = data.content;

        // 顯示卡片
        card.style.display = 'block';
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}