
// 顯示按鈕的函數
function showButton() {
    var button = document.getElementById('send-btn');
    var delete_all_btn = document.getElementById('remove-all-btn');
    var upload_img = document.getElementById('upload-img');
    button.style.opacity = '1';
    button.style.visibility = 'visible';
    delete_all_btn.style.opacity = '1';
    delete_all_btn.style.visibility = 'visible';
    upload_img.style.opacity = '0';
    upload_img.style.visibility = 'hidden';
}

// 隱藏按鈕的函數
function hideButton() {
    var button = document.getElementById('send-btn');
    var delete_all_btn = document.getElementById('remove-all-btn');
    var upload_img = document.getElementById('upload-img');
    button.style.opacity = '0';
    button.style.visibility = 'hidden';
    delete_all_btn.style.opacity = '0';
    delete_all_btn.style.visibility = 'hidden';
    upload_img.style.opacity = '1';
    upload_img.style.visibility = 'visible';
}

document.getElementById('remove-all-btn').addEventListener('click', function () {
    // 檢查Dropzone中是否有檔案
    if (myDropzone.files.length > 0) {
        // 移除所有檔案
        myDropzone.removeAllFiles(true);
    }
});

// 假設Dropzone已經透過其他方式被初始化，例如透過class="dropzone"
var myDropzone = new Dropzone("#upload-widget", {
    url: "/upload",
    paramName: "files",
    uploadMultiple: true,
    acceptedFiles: ".cpp, .txt, .bin",
    parallelUploads: 20,
    autoProcessQueue: false,
    timeout: 100000, // 設置 timeout 為 30 秒
    init: function () {
        this.on("addedfile", function (file) {
            // 當至少有一個檔案被添加時，顯示按鈕
            showButton();
            // 創建一個自定義的刪除按鈕
            var removeButton = Dropzone.createElement("<button class='btn btn-danger btn-sm delete-btn' style='border-radius: 3vh; margin-top: 5px'>刪除</button>");

            // 處理刪除按鈕的點擊事件
            removeButton.addEventListener("click", function (e) {
                e.preventDefault();
                e.stopPropagation();

                // 從隊列中移除檔案
                myDropzone.removeFile(file);
            });

            // 將刪除按鈕添加到檔案預覽元素中
            file.previewElement.appendChild(removeButton);
        });

        this.on("removedfile", function () {
            // 當隊列中的檔案被移除且隊列為空時，隱藏按鈕
            if (this.files.length === 0) {
                hideButton();
            }
        });

        this.on("sendingmultiple", function (files, xhr, formData) {
            // 只添加一次 homeworkName
            var homeworkName = document.getElementById('homework-name').value;
            formData.append("homeworkName", homeworkName);
        });

        this.on("successmultiple", function (files, response) {
            console.log(response);

            if (response !== "upload demo complete") {
                // 伺服器返回了一個錯誤訊息
                alert('檔案上傳失敗：' + response);
            } else {
                alert('檔案上傳成功！');
            }

            location.reload();
        });
    }
});

// 這裡的按鈕事件處理保持不變
document.getElementById('send-btn').addEventListener('click', function (event) {
    var homeworkName = document.getElementById('homework-name').value;

    if (homeworkName === '') {
        alert('請輸入作業名稱！');
    } else {
        myDropzone.processQueue(); // 處理隊列中的檔案
    }
});

const parser = new DOMParser;
const dom = parser.parseFromString('<!doctype html><body>' + encodedJson, 'text/html');
const decodedJson = dom.body.textContent;
const homework_list = JSON.parse(decodedJson);

const delete_zone = document.getElementById('delete-zone');
// 變數來保存所有的作業狀態
let homeworkStatusMap = {};



for ( const homework of homework_list ) {
    // 最外面一層，負責包住沒個作業跟刪除按鈕
    const container = document.createElement('div');
    container.className = 'homework-container';

    // 作業名稱
    const homework_div = document.createElement('div');
    homework_div.className = 'homework-item';
    homework_div.innerText = homework;
    
    // 滑動按鈕容器
    const slideSwitch = document.createElement('div');
    slideSwitch.className = 'slide-switch';

    // 圓形按鈕
    const sliderCircle = document.createElement('div');
    sliderCircle.className = 'slider-circle';

    // 將圓形按鈕放入滑動按鈕容器
    slideSwitch.appendChild(sliderCircle);

    let action = undefined;
    fetch('/DS/get_homework_status')
    .then(response => response.json())
    .then(data => {
        // 創建一個 map 來儲存作業狀態
        for (const item of data) {
            
            if (item.homework === homework) {
                action = item.action;
            }
        }

        // 查詢每個 homework 的狀態，如果資料庫中沒有，設置為預設值 'on'
        const currentStatus = action || 'on';  // 預設狀態為 'on'
    
        if (currentStatus === 'off') {
            slideSwitch.classList.add('active');  // 如果狀態是 'off'，設置為 active
        } else {
            slideSwitch.classList.remove('active');  // 如果狀態是 'on'，保持非 active
        }
    })
    .catch(error => {
        console.error('Error fetching homework status:', error);
    });

    

    // 監聽滑動按鈕點擊事件
    slideSwitch.addEventListener('click', function () {
        this.classList.toggle('active'); // 切換滑動按鈕狀態
         // 檢查是否為 active 狀態
        let isActive = this.classList.contains('active');  // 判斷滑動按鈕是否為 active 狀態

        // 決定要發送的動作 (隱藏或顯示)
        let action;
        if (isActive) {
            action = "off";
        } else {
            action = "on";
        }  // 如果是 active 狀態，發送 'hide'；否則發送 'show'
        
        // 當前要隱藏或顯示的作業名稱
        fetch('/DS/homework_status', { //後端api
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ homeworkName: homework, action: action }),  // 發送 'on' 或 'off' 動作
            }).then(response => {
            if (response.ok) {
                if (action === "off") {
                    alert(`作業${homework} 已隱藏`);
                } else {
                    alert(`作業${homework} 已顯示`);
                }
            } else {
                console.error('Error:', response.statusText);
            }
        }).catch(error => {
            console.error('Error:', error);
        });

    });
    
    // 垃圾桶圖示
    const trashcan = document.createElement('img');
    trashcan.src = '/image/delete.png';
    trashcan.className = 'delete-icon';

    // 刪除按鈕
    const delete_btn = document.createElement('button');
    delete_btn.className = 'btn btn-danger btn-sm delete-btn delete-btn-mine';
    delete_btn.onclick = function() {
        fetch('/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ homeworkName: homework }),
        }).then(response => {
            if (response.ok) {
                alert(`作業${homework}，已刪除`);
                location.reload();
            }
        }).catch(error => {
            console.error('Error:', error);
        });

    };
    delete_btn.appendChild(trashcan);

    container.appendChild(homework_div);
    container.appendChild(slideSwitch);
    container.appendChild(delete_btn);

    delete_zone.appendChild(container);
}