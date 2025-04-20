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

const mysql = require('mysql2/promise');

// find path
const fs = require('fs');
const path = require('path');
const { createCipheriv } = require('crypto');
const { start } = require('repl');
const { decode } = require('punycode');

const port = 3000;

// 將程式碼轉換成utf-8
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
    // TEST為可以提供學生測資的範例網頁
    const regex = /^DEMO|^QUIZ|^TEST|^BEST|^SLOW/;
    const datas = [];

    try {
        const exe_file = await fs.promises.readdir(dirPath);
        for (const homeworks of exe_file) {
            // 所有資料夾(作業名稱)
            const homework_files = await fs.promises.readdir(path.join(dirPath, homeworks));
            var types = [];
            for (const type of homework_files) {
                // 一個資料夾裡的所有檔案，只取出.exe檔
                if (regex.test(type)) {
                    types.push(type);
                }
            } // for()

            datas.push({ "homework": homeworks, "type": types });

        } // for()

        res.render('index', { data: JSON.stringify(datas) });
    }

    catch (error) {
        console.log(error);
    }

});

// project 有沒有出現在 ./DS_exe 資料夾中
// 如果沒有就送出invalid project
// 如果有就送出xterm.ejs
app.get('/DS/:homework/:project', async (req, res) => {
    const homework = req.params.homework;
    const project = req.params.project;
    const filePath = path.join(__dirname, 'DS_exe', homework, project);
    const directoryPath = path.join(__dirname, 'DS_exe', homework);
    const id = uuid.v4() + Date.now();

    fs.access(filePath, fs.constants.F_OK, async (err) => {
        if (err) {
            res.send('Invalid project');
        } else {
            var test_regex = /^TEST/;

            //如果點進的project為TEST，在User_Containers內創造屬於該連線的資料夾

            if (test_regex.test(project)) {
                //創造資料夾
                /*
                await fs.promises.mkdir(newFilePath);
                //把範例程式複製到新的資料夾
                await fs.promises.copyFile(filePath, newFilePath+project);
                // buildProcess用來創建container內的process
                let buildProcess = pty.spawn('docker', [
                    'run', '--rm', '-v', `${newFilePath}:/usr/src/app/ExeFile ${containerName}`,
                    '-i', '--name', containerName, image,
                    'bash', '-c', `ls -la /usr/src/app/ExeFile`
                    // cp ${absPath} ${containerName}:/ExeFile && ls -la`
                    // `./${project}`
                ])
                    */
            }

            // else {
            let files = fs.readdirSync(directoryPath);
            // 選擇要展示的input檔案
            let inputFiles = files.filter(file => (file.startsWith('input') || file.startsWith('pairs')) && (path.extname(file) === '.txt' || path.extname(file) === '.bin'));
            let inputNumbers = inputFiles.map(file => file.match(/\d+/)[0]);
            res.render('xterm', { homework: homework, project: project, id: id, inputNumbers: JSON.stringify(inputNumbers) });
            // }
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
        const outputSyntax = /^(output|pairs|order|select|bubble|merge|quick|radix|copy|sorted)\d{3}(_\d{3})*\.(txt|adj|cnt|inf)$/;
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

// 獲得作業的狀態( 開或關 )，用來決定前端要不要顯示作業
app.get('/DS/get_homework_status', async (req, res) => {
    const status_collection = client.db('dsds').collection('status');
    const schedule_collection = client.db('dsds').collection('schedule');
    try {
        const all_hw_status = await status_collection.find({}, { projection: { _id: 0 } }).toArray();
        const res_hw = [];
        for (const hw of all_hw_status) {
            // 先確認作業在不在DS_exe裡面
            try {
                const hwDirPath = path.join('DS_exe', hw.homework);
                await fs.promises.access(hwDirPath);

                // 如果在DS_exe裡面，再確認有沒有符合規則
                const status = await status_collection.findOne({ homework: hw.homework });
                const permanent_status = status.permanent;
                const schedule_status = status.schedule;

                if (permanent_status === 'on') {
                    res_hw.push({ homework: hw.homework, action: 'on' });
                } else if (schedule_status === 'on') {
                    const schedules = await schedule_collection.find({ homework: hw.homework }).toArray();
                    // 獲取當前時間
                    const currentTime = new Date();

                    // 調整為台灣時區的時間 (UTC+8)
                    const taiwanOffset = 8 * 60; // 台灣的 UTC 偏移為 8 小時（分鐘計）
                    const current_time = new Date(currentTime.getTime() + taiwanOffset * 60 * 1000);

                    let is_on = false;
                    for (const schedule of schedules) {
                        const schedule_start = new Date(schedule.start);
                        const schedule_end = new Date(schedule.end);

                        if (current_time > schedule_end) {
                            // 排程失效 (過期) 刪除
                            await schedule_collection.deleteOne({ homework: hw.homework, start: schedule.start, end: schedule.end });
                        }

                        if (current_time > schedule_start && current_time < schedule_end) {
                            res_hw.push({ homework: hw.homework, action: 'on' });
                            is_on = true;
                            break;
                        }
                    }

                    if (!is_on) {
                        res_hw.push({ homework: hw.homework, action: 'off' });
                    }

                } else {
                    res_hw.push({ homework: hw.homework, action: 'off' });
                }

            }

            catch {
                ;
            }
        }

        res.send(JSON.stringify(res_hw));
    } catch (err) {
        console.log(err);
        // res.send(err.message);
    }

});

app.post('/DS/delete_schedule', async (req, res) => {
    const homeworkName = req.body.homeworkName;
    const start = req.body.start;
    const end = req.body.end;
    const schedule_collection = client.db('dsds').collection('schedule');

    try {
        await schedule_collection.deleteOne({ homework: homeworkName, start: start, end: end });
        res.send({ msg: "delete schedule success" });
    } catch {
        res.send({ msg: "delete schedule failed" });
    }
});

app.post('/DS/get_status', async (req, res) => {
    const homeworkName = req.body.homeworkName;
    const db = client.db('dsds');
    const status_collection = db.collection('status');
    const schedule_collection = db.collection('schedule');

    try {
        const permanent_switch = (await status_collection.findOne({ homework: homeworkName })).permanent;
        const schedule_switch = (await status_collection.findOne({ homework: homeworkName })).schedule;
        const schedules = await schedule_collection.find({ homework: homeworkName }).toArray();


        const result = {
            permanent_switch: permanent_switch,
            schedules_switch: schedule_switch,
            schedules: schedules.map(schedule => ({
                start: schedule.start,
                end: schedule.end
            }))
        };

        res.send(result);
    }

    catch {
        res.send({ error: "Homework undefined." });
    }
});

async function isInsideInterval(start_date, end_date, schedule_start, schedule_end) {

    start_date = new Date(start_date);          // start_A  start_B
    end_date = new Date(end_date);              // end_A    end_B
    schedule_start = new Date(schedule_start);  // start_B  start_A
    schedule_end = new Date(schedule_end);      // end_B    end_A
    // end_A ≥ start_B 且 end_B ≥ start_A

    if (end_date >= schedule_start && schedule_end >= start_date) {
        return true;
    } else if (schedule_end >= start_date && end_date >= schedule_start) {
        return true;

    } else {
        return false;
    }
}

// request need to send two dates that follows a certain format
// something like this: 
// FROM 2024/10/22, 10:00
// TILL 2024/10/22, 13:00
// current way of implementation: input
// hw_name correspond to status database
app.post('/DS/set_schedule', async (req, res) => {
    try {
        const schedule_collection = client.db('dsds').collection('schedule');
        const status_collection = client.db('dsds').collection('status');
        const start_date = req.body.start
        const end_date = req.body.end
        const hw_name = req.body.homeworkName
        const permanent_switch = req.body.permanent_switch;
        const schedule_switch = req.body.schedules_switch;


        if (start_date !== "" && end_date !== "") {
            const timeArray = [];
            timeArray.push(start_date);
            timeArray.push(end_date);

            let old_schedule = []
            try {
                old_schedule = await schedule_collection.find({ homework: hw_name }).toArray();
            } catch {
                ;
            }

            for (const schedule of old_schedule) {
                const [schedule_start, schedule_end] = [schedule.start, schedule.end];
                if ((await isInsideInterval(start_date, end_date, schedule_start, schedule_end))) {
                    res.send({ msg: "Time interval is overlapped with other schedule" });
                    return;
                }
            }

            await schedule_collection.insertOne({ homework: hw_name, start: start_date, end: end_date }, { upsert: true });

        }

        await status_collection.updateOne({ homework: hw_name }, { $set: { permanent: permanent_switch, schedule: schedule_switch } }, { upsert: true });

        res.send({ msg: "Schedule Set!" })
    }

    catch (err) {
        res.send(`Error: ${err.message}`);
    }
});


// 將程式碼生成的檔案傳給前端
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
        for (const file of files) {
            if (!inputfile_syntax.test(file) && !exe_syntax.test(file) && !bin_file.test(file)) {
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

// 將程式碼生成的檔案內容傳給前端，前端要顯示檔案內容
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

const Customize_source_storage = multer.diskStorage({
    destination: async function (req, file, cb) {
        await fs.promises.mkdir('temp/', { recursive: true });
        cb(null, 'temp/')
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname)
    }
})

var student_upload = multer({ storage: Customize_source_storage }).any();

// 老師上傳作業時，將檔案上傳到DS_source資料夾，在編譯成exe檔放到DS_exe資料夾
app.post('/upload', upload, async (req, res) => {
    const homeworkName = req.body.homeworkName;
    const path_to_source_dir = path.join('DS_source', homeworkName);

    for (const file of req.files) {
        await transcode(file['path']);
    }

    try {
        // 檢查老師上傳的檔案是否有符合規則
        await upload_tool.check_file();
    }

    catch (error) {
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

        for (const relation_file of relation_files) {
            // 把txt全部搬去DS_exe
            await fs.promises.copyFile(path.join('DS_source', homeworkName, relation_file), path.join('DS_exe', homeworkName, relation_file));
        } // for()

        const all_promise = await upload_tool.execute("DS_source", homeworkName); // 建立編譯promises
        const asyncQueue = new AsyncQueue();
        await asyncQueue.processQueue(all_promise); // 開始編譯

        const status_collection = client.db('dsds').collection('status');
        await status_collection.updateOne({ homework: homeworkName }, { $set: { action: 'on', permanent: 'on', schedule: 'off' } }, { upsert: true });

        res.send('upload demo complete');
    }
    catch (err) {
        res.send(err.message);
    }
});

// 刪除作業
app.post('/delete', async (req, res) => {
    const homeworkName = req.body.homeworkName;
    try {
        await fs.promises.rm(path.join('DS_exe', homeworkName), { recursive: true });
        await fs.promises.rm(path.join('DS_source', homeworkName), { recursive: true });
        // 刪掉資料庫的內容
        const status_collection = client.db('dsds').collection('status');
        await status_collection.deleteOne({ homework: homeworkName });
        const schedule_collection = client.db('dsds').collection('schedule');
        await schedule_collection.deleteMany({ homework: homeworkName });
        res.send('delete complete');
    } catch (err) {
        res.send(err.message);
    }
});

// 檢查是否已經登入
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
    const homework = await fs.promises.readdir('DS_exe');

    res.render('staffonly', { homeworklist: JSON.stringify(homework) });
});

// 回傳特定資料夾的所有檔案
app.post('/get_files', async (req, res) => {
    const id = req.body.id;
    try {
        const files = await fs.promises.readdir(`./exestation/${id}`);
        res.send({ files: JSON.stringify(files) });
    }

    catch {
        res.send('Invalid id in get_files');
    }

});

async function get_sql_connection() {
    const connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE
    });

    return connection;
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // 設置文件上傳的目錄
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // 設置文件名
    }
});

const std_upload = multer({ storage: storage });


// 處理學生上傳的檔案
app.post('/student_upload', std_upload.array('files'), async (req, res) => {
    const id = req.body.id;

    const project = req.body.project;
    const homework = req.body.homework;
    try {

        for (const file of req.files) {
            await transcode(file['path']);
        }

        // 把檔案儲存到mysql
        const connection = await get_sql_connection();
        for (const file of req.files) {
            const origin_content = await fs.promises.readFile(file.path, 'utf8');
            // const origin_content = fs.readFileSync(file.path, 'utf8');
            const content = origin_content.replace(/\r\n/g, '\n');
            // 生成新的檔案名稱
            const [rows] = await connection.query(
                'SELECT COUNT(*) as count FROM customize_file WHERE session_id = ?',
                [id]
            );
            const count = rows[0].count;
            const filename = `input9${String(count + 1).padStart(2, '0')}.txt`;

            // 插入新記錄
            await connection.query(
                `INSERT INTO customize_file (session_id, homework, project, filename, upload_time, content)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    homework,
                    project,
                    filename,
                    new Date(),
                    content
                ]
            );

            connection.end();

            const newFilePath = path.join('exestation', id, filename);
            await fs.promises.writeFile(newFilePath, content);
            // fs.writeFileSync(newFilePath, content);
        }

        connection.end();

        res.send('upload demo complete');
    }
    catch (err) {
        res.send(err.message);
    }
});

// 處理學生上傳的檔案
app.post('/get_student_upload', async (req, res) => {
    const id = req.body.id;
    try {
        // 把檔案儲存到mysql
        const connection = await get_sql_connection();

        // 取得學生上傳的檔案
        const [rows] = await connection.execute(
            'SELECT filename FROM customize_file WHERE session_id = ?',
            [id]
        );

        // 用json格式回傳
        res.send({ files: JSON.stringify(rows) });
    }
    catch (err) {
        res.send(err.message);
    }
});


// 使用http模塊創建伺服器，並將Express應用作為請求處理器
const server = http.createServer(app);

const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', async (ws, req) => {
    let ptyProcess = null;
    var exit = false;
    var id = null;
    let buildContainer = null;
    const inputs = [];
    var string_inputs = [];
    var detail_output = [];
    let realMsg = undefined;

    const containerName = `UserContainer_${uuid.v4()}`;  // 動態生成容器名稱，避免名稱衝突
    const image = 'ubuntu:22.04';  // 只執行一般C++程式，映像用ubuntu

    const detail_log = client.db('dsds').collection('detail_log');

    //在使用者結束後才寫進log裡面，但也是detail_log第一個的start time
    const currentStartDate = new Date();
    const startTime = currentStartDate.toLocaleString('en-US', {
        timeZone: 'Asia/Taipei'
    });

    var detail_start = startTime;
    var detail_start_Time = currentStartDate;

    // IP 和 UserAgent
    const web_uuid = uuid.v4();
    const ipAddress = req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    ws.on('message', async (message) => {
        if (exit) {
            ws.close();
            return;
        }

        // 兩個都沒有被創造
        if (!ptyProcess && !buildContainer) {
            // 解析收到的消息
            const data = JSON.parse(message);
            const project = data.project;
            const homework = data.homework;
            id = data.id;
            const cwd = `./exestation/${id}`;

            const test_project = /^TEST/;
            const isTest = test_project.test(project);

            let runCommand = null;
            // 建立Container
            /*
            if (isTest && !buildContainer) {
                try {
                    //這裡還要再修一下，因為docker內沒有安裝firejail
                    // firejail --quiet sh -c "ulimit -s 16384 &&
                    const newFilePath = path.join(__dirname, 'User_Containers', id);
                    const absPath = path.resolve(`./DS_exe/${homework}/${project}`);
                    const filePath = path.join(__dirname, 'DS_exe', homework, project);
                    //創造資料夾
                    await fs.promises.mkdir(newFilePath);
                    //把範例程式複製到新的資料夾
                    await fs.promises.copyFile(filePath, newFilePath + project);

                    // 複製輸入檔到container內
                    const regex = /^(input|pairs)\d{3}\.(txt|bin)$/;
                    const files = await fs.promises.readdir(`./DS_exe/${homework}`);

                    buildContainer = pty.spawn('docker', [
                        'run', '--rm', '-d', '-v', `${newFilePath}:/ExeFile ${containerName}`,
                        '-i', '--name', containerName, image,
                        'bash', '-c', `ls -la && mkdir -p ExeFile && sleep infinity`
                    ])

                    // buildContainer 順利建立完後，執行複製執行檔的步驟
                    buildContainer.on('exit', async (code) => {
                        if (code === 0) {

                            for (const file of files) {
                                if (file === project || regex.test(file)) {
                                    // 複製Input檔
                                    const absInputPath = path.resolve(`./DS_exe/${homework}/${file}`);
                                    let copyInput = pty.spawn('docker', [
                                        'cp', absInputPath, `${containerName}:/ExeFile`,
                                    ])
                                } // if()
                            }

                            // Proceed with copying files after confirming container creation
                            await new Promise((resolve, reject) => {
                                let copyExe = pty.spawn('docker', [
                                    'cp', absPath, `${containerName}:/ExeFile`
                                ], {
                                    name: 'xterm-color',
                                    cols: 80,
                                    rows: 30,
                                    env: process.env
                                });

                                // copyFile 順利執行完後，執行./${project}
                                copyExe.on('exit', (copyCode) => {
                                    if (copyCode === 0) {
                                        // Proceed to execute the file if copying was successful
                                        runCommand = pty.spawn('docker', [
                                            'exec', '-it', containerName, 'bash', '-c', `cd ExeFile && ./${project}`
                                        ], {
                                            name: 'xterm-color',
                                            cols: 80,
                                            rows: 30,
                                            env: process.env
                                        });

                                        ws.on('message', async (message) => {
                                            // Decode the message from base64 to normal text (you can adjust this if needed)
                                            const decodedMessage = Buffer.from(message, 'base64').toString('utf-8');
                                            // Send the input to the running shell in the container
                                            await runCommand.write(decodedMessage);
                                        });

                                        runCommand.on('data', (data) => {
                                            ws.send(data);
                                        });

                                        runCommand.on('exit', (runCode) => {
                                            ws.send(`程式已退出`)
                                            const stopContainer = pty.spawn('docker', [
                                                'stop', containerName
                                            ]);
                                            if (runCode !== 0) {
                                                console.log(`Run command exited with code: ${runCode}`);
                                            }
                                            exit = true;
                                        });

                                    } else {
                                        console.log(`Copy command exited with code: ${copyCode}`);
                                    }
                                });
                            }); // await new Promise
                        }
                    });
                }
                catch (err) {
                    console.log(`${err}`)
                }
            }
            */
            // 一般的process互動
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

                    // docker run --rm -v ${path.resolve(execute_path)}:/sandbox -w /sandbox --network none --memory=512m --cpus="1" \
                    // super_sandbox bash -c "timeout ${timeout}s firejail --quiet --net=none --private=~/sandbox /bin/bash -c 'ulimit -s 16384 && ./${executable_name}

                    var dockerCommand = `docker run --rm -it -v ${path.resolve(cwd)}:/sandbox -w /sandbox --network none --memory=512m --cpus="1" \
                                        jason89923/runtime_env_cpp bash -c "timeout 3600s firejail --quiet --net=none --private=~/sandbox /bin/bash -c 'ulimit -s 16384 && ./${project}'"`;
                    ptyProcess = pty.spawn('bash', ['-c', dockerCommand], {
                        name: 'xterm-color',
                        cols: 80,
                        rows: 30,
                        cwd: cwd,
                        env: process.env
                    });

                    ptyProcess.on('data', (data) => {
                        ws.send(data);
                        detail_output.push(data);
                    });

                    ws.on('message', async (message) => {
                        const decodedMessage = Buffer.from(message, 'base64').toString('utf-8');
                        // 在這邊檢測是否有enter，並加進detail_log裡面
                        // 這邊會一個一個char讀入，只要不是\n，字串相加，不然insertOne
                        if (decodedMessage !== '\r' && decodedMessage !== '\n') {
                            string_inputs.push(decodedMessage);
                        }
                        else {

                            const detail_end_Time = new Date();
                            const detail_endstamp = detail_end_Time.toLocaleString('en-US', {
                                timeZone: 'Asia/Taipei'
                            });
                            await detail_log.insertOne({
                                Web_UUID: web_uuid,
                                UserAgent: userAgent,
                                IP_Addr: ipAddress,
                                Input_Start: detail_start,
                                Input_End: detail_endstamp,
                                Interval: (detail_end_Time - detail_start_Time),
                                Input: string_inputs.join(''),
                                Output: detail_output.join('')
                            })
                            // 下一個資料的開始輸入時間
                            const next_detail_start = new Date();
                            const next_detail_startstamp = next_detail_start.toLocaleString('en-US', {
                                timeZone: 'Asia/Taipei'
                            });
                            detail_output = [];
                            string_inputs = [];
                            detail_start = next_detail_startstamp;
                            detail_start_Time = next_detail_start;
                        }

                        // 這邊是合起來的輸入
                        inputs.push(decodedMessage);
                        realMsg = inputs.join("");

                        ptyProcess.write(message);
                    });

                    ptyProcess.on('close', async (code) => {
                        ws.send(`程式已退出`);
                        const currentDate = new Date();
                        const stringTime = currentDate.toLocaleString('en-US', {
                            timeZone: 'Asia/Taipei'
                        });

                        const log_collection = client.db('dsds').collection('log');

                        await log_collection.insertOne({
                            Start: startTime,
                            End: stringTime,
                            homework: homework,
                            select: project,
                            content: realMsg === undefined ? 'without input (Irregular operations)' : realMsg
                        });
                        exit = true;
                    });
                }

                catch (err) {
                    console.log(`error: ${err}`);
                }
            }
        } // if ( !ptyProcess && !buildContainer )
    });  // ws.on('message', async (message)



    ws.on('close', async () => {
        if (!buildContainer) {
            await fs.promises.rm(`./exestation/${id}`, { recursive: true });
            if (ptyProcess && !exit) {
                ptyProcess.kill();
                console.log('Process killed');
            }
        }
    });
});

// 監聽與Express相同的端口
server.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
