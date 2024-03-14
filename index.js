const express = require('express');
const app = express();
const http = require('http');
const WebSocket = require('ws');
const pty = require('node-pty');
const { exec } = require('child_process');

// find path
const fs = require('fs');
const path = require('path');


const port = 3000;

// 解析 JSON 請求體
app.use(express.json());

app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.render('index');
});


// project 有沒有出現在 ./DS_exe 資料夾中
// 如果沒有就送出invalid project
// 如果有就送出xterm.ejs
app.get('/DS/:project', (req, res) => {
    const project = req.params.project;
    const filePath = path.join( __dirname, 'DS_exe', project );
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            res.send('Invalid project');
        } else {
            res.render('index', { project: project });
        }
    });
});

// 使用http模塊創建伺服器，並將Express應用作為請求處理器
const server = http.createServer(app);

const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (ws) => {
    let ptyProcess = null;
    let cwd = './DS_exe';
    var exit = false;

    ws.on('message', (message) => {
        if (exit) {
            ws.close();
            return;
        }

        if (!ptyProcess) {
            // 解析收到的消息
            const data = JSON.parse(message);
            const project = data.project;

            // 初始化虛擬終端
            ptyProcess = pty.spawn('bash', ['-c', `firejail --quiet ./${project}`], {
                name: 'xterm-color',
                cols: 80,
                rows: 30,
                cwd: cwd,
                env: process.env
            });

            ptyProcess.on('data', (data) => {
                ws.send(data);
            });

            // 監聽ptyProcess的退出事件
            ptyProcess.on('exit', () => {
                ws.send('程式已退出');
                exit = true;
            });

        } else {
            // 將客戶端消息傳遞給虛擬終端
            ptyProcess.write(message);
        }
    });

    ws.on('close', () => {
        if (ptyProcess && !exit) {
            ptyProcess.kill();
        }
    });
});

// 監聽與Express相同的端口
server.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});