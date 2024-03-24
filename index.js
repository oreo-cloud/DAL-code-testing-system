const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const chardet = require('chardet');
const iconv = require('iconv-lite');
require('dotenv').config();
const app = express();
const http = require('http');
const WebSocket = require('ws');
const pty = require('node-pty');
const { exec } = require('child_process');
const uuid = require('uuid');
const multer = require('multer');

const upload_tool = require('./upload');
const AsyncQueue = require('./AsyncQueue');

// find path
const fs = require('fs');
const path = require('path');

const port = 3000;

async function transcode(filename) {
    const encoding = chardet.detectFileSync(filename); // 檢測編碼

    if (encoding != 'utf-8') {
        const data = await fs.promises.readFile(filename)
        const convertedData = iconv.decode(data, encoding); // 藉由偵測到的編碼解碼
        const newData = iconv.encode(convertedData, 'utf-8'); // 轉換成utf-8
        await fs.promises.writeFile(filename, newData)
    }
}

app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.secret, // 用來簽名會話ID的密鑰，可隨意填寫
    resave: false,
    saveUninitialized: true
}));

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

const demo_code_storage = multer.diskStorage({
    destination: async function (req, file, cb) {
        await fs.promises.mkdir('DS_source/upload/', { recursive: true });
        cb(null, 'DS_source/upload/')
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname)
    }
})

var upload = multer({ storage: demo_code_storage }).any();

app.post('/upload', upload, async (req, res) => {
    const homeworkName = req.body.homeworkName;
    const path_to_source_dir = path.join('DS_source', homeworkName);

    for (const file of req.files) {
        await transcode(file['path']);
    }

    try {
        // 檢查老師上傳的檔案是否有符合規則
        await upload_tool.check_file() ;
    }

    catch(error) {
        await fs.promises.rm(path.join('DS_source', 'upload'), { recursive: true, force: true });
        res.send(error.message);
        return;
    }

    try {
        // 確認有沒有重複的資料夾，有的話就刪掉(替代)
        await fs.promises.readdir(path.join('DS_source', homeworkName));
        await fs.promises.rm(path.join('DS_source', homeworkName), { recursive: true, force: true });
    }

    catch (err) { }

    await fs.promises.mkdir(path_to_source_dir); // 建立資料夾

    const files = await fs.promises.readdir('DS_source/upload'); // 讀出upload的檔案

    for (const file of files) {
        // 全部copy到新的資料夾
        await fs.promises.copyFile(path.join('DS_source/upload', file), path.join(path_to_source_dir, file));
    }

    // 刪掉upload
    await fs.promises.rm(path.join('DS_source', 'upload'), { recursive: true, force: true });

    try {
        await fs.promises.mkdir(path.join("DS_exe", homeworkName), { recursive: true });
        const files = await fs.promises.readdir(path.join('DS_source', homeworkName));
        const txt_files = files.filter(file => file.endsWith('.txt'));
        for ( const txt_file of txt_files ) {
            // 把txt全部搬去DS_exe
            await fs.promises.copyFile(path.join('DS_source', homeworkName, txt_file), path.join('DS_exe', homeworkName, txt_file));
        } // for()
        const all_promise = await upload_tool.execute( "DS_source", homeworkName ); // 建立編譯promises
        const asyncQueue = new AsyncQueue();
        await asyncQueue.processQueue(all_promise); // 開始編譯
        res.send('upload demo complete');
    }
    catch (err) {
        res.send(err.message);
    }
});

app.post('/delete', async (req, res) => {
    const homeworkName = req.body.homeworkName;
    try {
        await fs.promises.rm(path.join('DS_exe', homeworkName), { recursive: true });
        await fs.promises.rm(path.join('DS_source', homeworkName), { recursive: true });
        res.send('delete complete');
    } catch (err) {
        res.send(err.message);
    }
});

function checkAuthentication(req, res, next) {
    if (req.session.isAuthenticated) {
        next(); // 用戶已登入，繼續執行下一個路由處理函數
    } else {
        res.redirect('/login'); // 用戶未登入，重定向到登入頁面
    }
}

// 實做一個staff only route 
// 1. 只能用url進入
// 2. 進入後會渲染staffonly.ejs
app.get('/login', (req, res) => {
    res.render('login');
});

// 登入路由
// 設置 /DS/login 路由來處理 POST 請求
app.post('/DS/login', (req, res) => {
    const { username, password } = req.body;

    if (username === process.env.account && password === process.env.password) {
        // 驗證成功
        req.session.isAuthenticated = true; // 設置會話變量
        res.json({ success: true });
    } else {
        // 驗證失敗
        res.json({ success: false, message: '用戶名或密碼錯誤' });
    }
});

// upload.ejs的路由
app.get('/staffonly', checkAuthentication, async (req, res) => {
    const homework = await fs.promises.readdir('DS_exe') ;

    res.render('staffonly', {homeworklist: JSON.stringify(homework)});
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