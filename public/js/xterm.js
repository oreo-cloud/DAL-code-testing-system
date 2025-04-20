var term = new Terminal();
term.open(document.getElementById('terminal'));

var wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
var wsHost = window.location.host;
var wsPath = "ws";
var socketUrl = wsProtocol + '//' + wsHost + '/' + wsPath;

var socket = new WebSocket(socketUrl);
const download_zone = document.querySelector('#download_zone');

var file_list = [] ;
var original_file = [];

function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

socket.onopen = function (event) {
    socket.send(JSON.stringify({ "project": project, "id": id, "homework": homework }));
    setTimeout(() => {
        fetch('/get_files', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ "id": id })
        })
        .then(response => response.json())
        .then(data => {
            const files = JSON.parse(data.files);
            for ( const file of files ) {
                file_list.push(file);
            }
            original_file = files.length;
    
        })
        .catch((error) => {
            console.error('Error:', error);
        });
    }, 100);
    
    
};

socket.onclose = function (event) {
    setTimeout(() => {
        window.location.href = "/";
    }, 5000);
};

term.attachCustomKeyEventHandler(function (event) {
    if (event.key === 'Enter' && event.type === 'keydown') {
        setTimeout(() => {
            fetch('/get_files', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ "id": id })
            })
            .then(response => response.json())
            .then(data => {
                const files = JSON.parse(data.files);

                if ( arraysEqual(files, file_list) ) {
                    ;
                }
    
                else {
                    test_click();
                    file_list = files;
                }
        
            })
            .catch((error) => {
                console.error('Error:', error);
            });
        }, 550);
        
    }

    
});



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

const parser = new DOMParser;
const dom = parser.parseFromString('<!doctype html><body>' + encodedJson, 'text/html');
const decodedJson = dom.body.textContent;
const inputfile = JSON.parse(decodedJson);

const input_file = document.getElementById('input');

for ( const file of inputfile ) {
    var file_span = document.createElement('li');
    file_span.className = 'file';
    file_span.innerText = file;
    input_file.appendChild(file_span);
}

// 獲取按鈕元素
let button19 = document.querySelector('.button-19');

// 為按鈕添加 'animationend' 事件監聽器
button19.addEventListener('animationend', () => {
    // 當動畫完成後，移除 'flip' 類別
    button19.classList.remove('animate__flip');
});

function test_click() {
    
    fetch('/DS/get_output', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ "id": id })
    })
    .then(response => response.json())
    .then(data => {
        const out = JSON.parse(data.filename);
    
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
                newButton.classList.add('button-55', 'animate__animated');
                // ,'animate__fadeIn'
                // 為按鈕添加 onclick 屬性
                newButton.setAttribute('onclick', `get_file_content('${filename}')`);
        
                // 將新的按鈕添加到 DOM 中
                buttonContainer.appendChild(newButton);
            }, 0);  // 每個按鈕的創建被延遲了 index * 300 毫秒, index=1,2,3,...
        });

        if ( out.length != 0 ) {
            download_zone.classList.add('show');
            download_zone.classList.remove('hide');
        }

        else {
            download_zone.classList.add('hide');
            download_zone.classList.remove('show');
        }
        
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}

function get_file_content(filename) {
    fetch('/DS/get_file_content', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ "id": id , "filename": filename })
    })
    .then(response => response.json())
    .then(data => {
        // 獲取卡片元素
        console.log(data);
        let card = document.querySelector('#previewfile');
        let cardHeader = card.querySelector('.card-header');
        let cardText = card.querySelector('.card-text');
        var cardBody = document.querySelector('.card-body');

        // 移除原本的入場動畫類別
        card.style.display = 'none';
        // 設定卡片的標題和內容
        cardHeader.textContent = filename;
        // 將換行符號替換為 <br> 標籤
        cardText.innerHTML = data.content.replace(/\n/g, '<br>');

        // 強制瀏覽器重新計算元素的樣式
        void card.offsetWidth;
        
        // 顯示卡片
        card.style.display = 'block';

        setTimeout(() => {
            cardBody.scrollTop = 0 ;
            cardBody.scrollLeft = 0 ;
        }, 300);

    })
    .catch((error) => {
        console.error('Error:', error);
    });
}

// 獲取按鈕元素
let closeButton = document.querySelector('.btn-close');

// 為按鈕添加點擊事件監聽器
closeButton.addEventListener('click', function() {
    // 負責處理使用者點擊叉叉的動作
    let card = document.querySelector('#previewfile');
    card.style.display = 'none';
});

function download_file() {
    fetch('/DS/download_output', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: id })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok.');
        }
        return response.blob();
    })
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'output.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    })
    .catch((error) => {
        console.error('Error:', error);
    });
    
}

new_files = [];

// 假設 API 位址為 /api/addItem
async function get_new_input_file() {
    try {
        // 呼叫 API 並取得回應資料
        fetch('/get_student_upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ "id": id })
        })
        .then(response => response.json())
        .then(data => {
            const files = JSON.parse(data.files);

            if ( new_files.length === 0 ) {
                // 第一次新增檔案
                const user_input_hint = document.createElement('span');
                user_input_hint.id = 'user-discription';
                user_input_hint.textContent = '使用者檔案：';
                document.getElementById('input').appendChild(user_input_hint);
            }

            for ( const file of files ) {
                const fileName = file.filename;
                
        
                // 使用正則表達式提取 input 後面的部分和 .txt 前面的部分
                const match = fileName.match(/input(\d+)\.txt/);
                if (match && new_files.includes(fileName) === false) {
                    const extractedPart = match[1]; // 提取的部分
                    new_files.push(fileName);
        
                    // 創建新的 <li> 元素
                    const newItem = document.createElement('li');
                    newItem.classList.add('file');
                    newItem.textContent = extractedPart;
                    newItem.style.color = 'rgba(255, 117, 117, 1)';
        
                    // 將新的 <li> 元素插入到目標元素底下
                    document.getElementById('input').appendChild(newItem);
                }
            }
        })

    } catch (error) {
        console.error('新增項目失敗：', error);
    }
}

document.getElementById('file-upload').addEventListener('change', function(event) {
    const files = event.target.files;
    if (files.length === 1) {
        const formData = new FormData();
        console.log( files.length );
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileExtension = file.name.split('.').pop().toLowerCase();
            if (fileExtension === 'txt') {
                formData.append('files', file);
            } else {
                alert(`${file.name} 不是文字檔案!!! ( 僅提供上傳.txt ).`);
                return ; 
            }
        }

        // const data = {
        //     id: id,
        //     project: project,
        //     homework: homework,
        //     files: formData
        // }

        // 添加其他數據到 FormData
        formData.append('id', id);
        formData.append('project', project);
        formData.append('homework', homework);

        fetch('/student_upload', {
            method: 'POST',
            body: formData,
        })
        .then(response => response.text())
        .then(text => {
            if ( text === 'upload demo complete' ) {
                alert('檔案上傳成功!!!');
                setTimeout(() => {
                    get_new_input_file();
                }, 500);
            }
        })
        .catch(error => {
            alert('Error:', error);
        });
    } else if (files.length === 0) {
        alert('未選擇任何檔案!!!');
        // console.warn('No valid .txt files were selected.');
    } else {
        alert('僅能選擇一個檔案!!!');
        // console.warn('Only one .txt file can be selected.');
    }
});