const express = require('express');
const session = require('express-session');
const app = express();
const http = require('http');
const WebSocket = require('ws');
const pty = require('node-pty');
const { exec } = require('child_process');
const uuid = require('uuid');

// find path
const fs = require('fs');
const path = require('path');

const port = 3000;

// 解析 JSON 請求體
app.use(express.json());


app.set('view engine', 'ejs');
const path_to_views = path.join(__dirname, 'views');
app.set('views', path_to_views);

// 設定靜態文件目錄
app.use(express.static('public'));

app.get('/', async (req, res) => {
    const dirPath = path.join(__dirname, 'DS_exe');
    const regex = /^DEMO|^QUIZ/;
    const datas = [];

    try {
        const exe_file = await fs.promises.readdir(dirPath);
        for ( const homeworks of exe_file ) {
            const homework_files = await fs.promises.readdir( path.join( dirPath, homeworks ) );
            var types = [];
            for ( const type of homework_files ) {
                if ( regex.test(type) ) {
                    types.push(type);
                }
            } // for()

            datas.push( { "homework": homeworks, "type": types } );

        } // for()

        res.render('index', { data: JSON.stringify(datas) });
    }

    catch(error) {
        console.log(error);
    }


    // fs.readdir(dirPath, (err, homeworks) => {
    //     if (err) {
    //         console.error(err);
    //         res.status(500).send('Server error');
    //         return;
    //     }

    //     const data = homeworks.map(homework => {
    //         const homeworkPath = path.join(dirPath, homework);
    //         let types = fs.readdirSync(homeworkPath);
    //         types = types.filter(type => type.endsWith('.cpp')); // 過濾出所有 .cpp 結尾的文件
    //         types = types.map(type => type.replace('.cpp', '')); // 刪除 .cpp 後綴
    //         return { homework, type: types };
    //     });

    //     res.render('index', { data: JSON.stringify(data) });
    // });
});

// project 有沒有出現在 ./DS_exe 資料夾中
// 如果沒有就送出invalid project
// 如果有就送出xterm.ejs
app.get('/DS/:homework/:project', (req, res) => {
    const homework = req.params.homework;
    const project = req.params.project;
    const filePath = path.join(__dirname, 'DS_exe', homework, project);
    const directoryPath = path.join(__dirname, 'DS_exe', homework);
    const id = uuid.v4() + Date.now();
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            res.send('Invalid project');
        } else {
            let files = fs.readdirSync(directoryPath);
            let inputFiles = files.filter(file => file.startsWith('input') && path.extname(file) === '.txt');
            let inputNumbers = inputFiles.map(file => file.match(/\d+/)[0]);
            console.log(inputNumbers);
            res.render('xterm', { homework: homework, project: project, id: id, inputNumbers: JSON.stringify(inputNumbers) });
        }
    });
});

app.post('/DS/get_output', (req, res) => {
    // { "id": "132138434613" }
    // 輸出檔格式(JSON): output_*.txt
    const id = req.body.id;
    const directoryPath = path.join(__dirname, 'exestation', id);

    fs.access(directoryPath, fs.constants.F_OK, (err) => {
        if (err) {
            res.send('Invalid id in get_output');
        } else {
            let files = fs.readdirSync(directoryPath);
            let outputFiles = files.filter(file => file.includes('output') && path.extname(file) === '.txt');
            res.send({ filename: JSON.stringify(outputFiles) });
        }
    });

});

app.post('/DS/get_file_content', (req, res) => {
    // 前端傳送 { "id": "132138434613", "filename": "output1.txt" }
    // 這裡要讀取檔案內容並傳給前端
    const id = req.body.id;
    const filename = req.body.filename;
    console.log("id,filename");
    console.log(id);
    console.log(filename);
    const filePath = path.join(__dirname, 'exestation', id, filename);

    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            res.send('Invalid id or filename in get_file_content');
        } else {
            fs.readFile(filePath, 'utf8', (err, data) => {
                if (err) {
                    res.send('Error reading file');
                } else {
                    res.send({ content: data });
                }
            });
        }
    });
});

// 實做一個staff only route 
// 1. 只能用url進入
// 2. 進入後會渲染staffonly.ejs
app.get('/staffonly', (req, res) => {
    console.log( );
    res.render('staffonly');
});

// 登入路由
// 設置 /DS/login 路由來處理 POST 請求
app.post('/DS/login', (req, res) => {
    const { username, password } = req.body;

    // 讀取 shadow.txt
    const shadowPath = path.join(__dirname, 'shadow.txt');
    fs.readFile(shadowPath, 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: '無法讀取驗證資料' });
        }
        
        // 分析檔案內容以獲取用戶名和密碼
        const [validUsername, validPassword] = data.trim().split(':');

        // 執行驗證過程
        if (username === validUsername && password === validPassword) {
            // 驗證成功
            res.json({ success: true });
        } else {
            // 驗證失敗
            res.json({ success: false, message: '用戶名或密碼錯誤' });
        }
    });
});

// upload.ejs的路由
app.get('/upload', (req, res) => {
    res.render('upload'); // 假定您有一個upload.ejs檔案
});



// 使用http模塊創建伺服器，並將Express應用作為請求處理器
const server = http.createServer(app);

const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (ws) => {
    let ptyProcess = null;
    var exit = false;
    var id = null;

    ws.on('message', async (message) => {
        if (exit) {
            ws.close();
            return;
        }

        if (!ptyProcess) {
            // 解析收到的消息
            const data = JSON.parse(message);
            const project = data.project;
            const homework = data.homework;
            id = data.id;
            const cwd = `./exestation/${id}`;
            try {
                const regex = /^input\d{3}\.txt$/;
                await fs.promises.mkdir(cwd);
                const files = await fs.promises.readdir(`./DS_exe/${homework}`);
                for (const file of files) {
                    if (file === project || regex.test(file)) {
                        await fs.promises.copyFile(`./DS_exe/${homework}/${file}`, `./exestation/${id}/${file}`);
                    } // if()
                }

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

                
            }

            catch {
                console.log('error');
            }

        } else {
            // 將客戶端消息傳遞給虛擬終端
            ptyProcess.write(message);
        }
    });


    ws.on('close', async () => {
        await fs.promises.rm(`./exestation/${id}`, { recursive: true });
        if (ptyProcess && !exit) {
            ptyProcess.kill();
        }
    });
});



// 監聽與Express相同的端口
server.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});