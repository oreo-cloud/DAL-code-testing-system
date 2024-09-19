const express = require('express');
const archiver = require('archiver');
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
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.MONGODB_URI);

const upload_tool = require('./upload');
const AsyncQueue = require('./AsyncQueue');

// find path
const fs = require('fs');
const path = require('path');

const port = 3000;

async function transcode(filename) {
    const encoding = chardet.detectFileSync(filename); // 檢測編碼
    const regex = /\.bin$/; // bin檔不轉換

    if (encoding != 'utf-8' && !regex.test(filename)) {
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
    // 控制主頁面要輸出的資料
    const dirPath = path.join(__dirname, 'DS_exe');

    // 控制執行檔的檔名 (要改在這裡改)
    const regex = /^DEMO|^QUIZ|^BEST|^SLOW/;
    const datas = [];

    try {
        const exe_file = await fs.promises.readdir(dirPath);
        for ( const homeworks of exe_file ) {
            // 所有資料夾(作業名稱)
            const homework_files = await fs.promises.readdir( path.join( dirPath, homeworks ) );
            var types = [];
            for ( const type of homework_files ) {
                // 一個資料夾裡的所有檔案，只取出.exe檔
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
            // 選擇要展示的input檔案
            let inputFiles = files.filter(file => (file.startsWith('input') || file.startsWith('pairs') ) && ( path.extname(file) === '.txt' || path.extname(file) === '.bin' ));
            let inputNumbers = inputFiles.map(file => file.match(/\d+/)[0]);
            res.render('xterm', { homework: homework, project: project, id: id, inputNumbers: JSON.stringify(inputNumbers) });
        }
    });
});


// 這邊要做一個api for download  all output file
// 前端傳送 { "id": "132138434613" }
// 這裡要把所有output file打包成zip檔案並傳給前端
// 先設定相關路徑
// 設定壓縮檔的動作
// 壓縮完成後下載檔案
// 定義輸出的檔案格式
app.post('/DS/download_output', async (req, res) => {
    try {
        const id = req.body.id;
        const directoryPath = path.join(__dirname, 'exestation', id);
        const zipPath = path.join(__dirname, 'exestation', id + '.zip');
        const files = await fs.promises.readdir(directoryPath);
        // 找到要給同學下載的檔案 ( 要更改在這裡改 )
        const outputSyntax = /^(output|pairs|order|select|bubble|merge|quick|radix)\d{3}\.(txt|adj|cnt|inf)$/;
        const outputFiles = files.filter(file => outputSyntax.test(file));
        const outputPaths = outputFiles.map(file => path.join(directoryPath, file));

        const output = fs.createWriteStream(zipPath);
        
        const archive = archiver('zip', {
            zlib: { level: 9 } // Sets the compression level.
        });

        // 壓縮完成後下載檔案
        output.on('close', () => {
            res.download(zipPath, 'output.zip', (err) => {
                if (err) {
                    console.error(err);
                } else {
                    fs.promises.rm(zipPath);
                }
            });
        });

        archive.on('error', (err) => {
            throw err;
        });

        // 將壓縮檔案寫入output
        archive.pipe(output);
        // 將output file加入壓縮檔案
        outputPaths.forEach(file => {
            archive.file(file, { name: path.basename(file) });
        });
        // 完成壓縮
        archive.finalize();
    }
    catch (err) {
        res.send(err.message);
    }
});

app.get('/DS/get_homework_status', async (req, res) =>  {
    const status_collection = client.db('dsds').collection('status');
    try {
        const all_hw_status = await status_collection.find({}, {projection: {_id: 0}}).toArray();
        res.send(JSON.stringify(all_hw_status));
    } catch (err) {
        // res.send(err.message);
    }

});

app.post('/DS/homework_status', async(req, res) => {
    const status_collection = client.db('dsds').collection('status');
    const hw = req.body.homeworkName;
    const action = req.body.action;
    await status_collection.updateOne({ homework: hw }, { $set: { action: action } }, { upsert: true });
    res.send();
}); 

app.post('/DS/get_output', async (req, res) => {
    // { "id": "132138434613" }
    // 輸出檔格式(JSON): output_*.txt
    const id = req.body.id;
    const directoryPath = path.join(__dirname, 'exestation', id);
    let outputFiles = [];

    try {
        const files = await fs.promises.readdir(directoryPath);
        // 排除掉input檔、bin檔、exe檔 (如果有要更改可以在這裡修改)
        const inputfile_syntax = /^(input|pairs)\d{3}\.(txt|bin)$/;
        const bin_file = /.bin$/
        const exe_syntax = /^DEMO|^QUIZ|^SLOW|^BEST/;
        for ( const file of files ) {
            if ( !inputfile_syntax.test(file) && !exe_syntax.test(file) && !bin_file.test(file) ) {
                // not a input file and bin file, we let bin file can not show at front end
                outputFiles.push(file);
            }
        } // for()

        outputFiles.sort();

        res.send({ filename: JSON.stringify(outputFiles) });
    }

    catch {
        res.send('Invalid id in get_output');
    }

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
        const relation_files = files.filter(file => file.endsWith('.txt') || file.endsWith('.bin'));

        for ( const relation_file of relation_files ) {
            // 把txt全部搬去DS_exe
            await fs.promises.copyFile(path.join('DS_source', homeworkName, relation_file), path.join('DS_exe', homeworkName, relation_file));
        } // for()

        const all_promise = await upload_tool.execute( "DS_source", homeworkName ); // 建立編譯promises
        const asyncQueue = new AsyncQueue();
        await asyncQueue.processQueue(all_promise); // 開始編譯
        
        const status_collection = client.db('dsds').collection('status');
        await status_collection.updateOne({ homework: homeworkName }, { $set: { action: 'on' } }, { upsert: true });
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
        // 刪掉資料庫的內容
        const status_collection = client.db('dsds').collection('status');
        await status_collection.deleteOne({ homework: homeworkName });
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

app.post('/get_files' , async (req, res) => {
    const id = req.body.id;
    try {
        const files = await fs.promises.readdir(`./exestation/${id}`);
        res.send({files: JSON.stringify(files)});
    }

    catch {
        res.send('Invalid id in get_files');
    }

});


// 使用http模塊創建伺服器，並將Express應用作為請求處理器
const server = http.createServer(app);

const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (ws) => {
    let ptyProcess = null;
    var exit = false;
    var id = null;
    const inputs = [];
    let realMsg = undefined;

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
                // 要放甚麼input檔案進去firejail (要改在這裡改)
                const regex = /^(input|pairs)\d{3}\.(txt|bin)$/;
                await fs.promises.mkdir(cwd);
                const files = await fs.promises.readdir(`./DS_exe/${homework}`);
                for (const file of files) {
                    if (file === project || regex.test(file)) {
                        await fs.promises.copyFile(`./DS_exe/${homework}/${file}`, `./exestation/${id}/${file}`);
                    } // if()
                }

                // 初始化虛擬終端
                ptyProcess = pty.spawn('bash', ['-c', `firejail --quiet sh -c "ulimit -s 16384 && ./${project}"`], {
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
                ptyProcess.on('exit', async () => {
                    ws.send('程式已退出');
                    const currentDate = new Date();
                    const stringTime = currentDate.toLocaleString('en-US', {
                        timeZone: 'Asia/Taipei'
                    });

                    const log_collection = client.db('dsds').collection('log');

                    await log_collection.insertOne({
                        time:   stringTime,
                        homework:   homework,
                        select: project,
                        content: realMsg === undefined ? 'without input (Irregular operations)' : realMsg
                    });
                    
                    exit = true;
                });

            }

            catch {
                console.log('error');
            }

        } else {
            // 將客戶端消息傳遞給虛擬終端
            const decodedMessage = Buffer.from(message, 'base64').toString('utf-8');
            inputs.push(decodedMessage);
            realMsg = inputs.join("");
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
