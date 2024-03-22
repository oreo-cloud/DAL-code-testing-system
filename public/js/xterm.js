

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

function test_click() {
    console.log("click!");
    fetch('/DS/get_output', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ "id": "6b192716-7466-45b7-a415-c501bfbc39221711092753209" })
    })
    .then(response => response.json())
    .then(data => {
        const out = JSON.parse(data.filename);
        console.log("id,out:");
        console.log(id);
        console.log(out);

        // 創建一個新的按鈕並將 filename 屬性的值設置為該按鈕的文本
        const newButton = document.createElement('button');
        newButton.textContent = out;

        // 將新的按鈕添加到 DOM 中
        const buttonContainer = document.getElementById('buttonContainer');
        buttonContainer.appendChild(newButton);
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}
