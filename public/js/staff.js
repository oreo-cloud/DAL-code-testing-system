
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
            // console.log(response);

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
    // 最外面一層，負責包住每個作業跟刪除按鈕
    const container = document.createElement('div');
    container.className = 'homework-container';

    // 作業名稱
    const homework_div = document.createElement('div');
    homework_div.className = 'homework-item';
    homework_div.innerText = homework;

    // 排程按鈕
    const scheduleBtn = document.createElement('button');
    scheduleBtn.className = 'schedule-btn-mine';
    // scheduleBtn.textContent = 'Set Time'; 
    // 創建 Schedule 圖片圖示
    const scheduleIcon = document.createElement('img');
    scheduleIcon.src = '/image/clock.png'; 
    scheduleIcon.className = 'schedule-icon';
 
    // 將圖片圖示添加到按鈕
    scheduleBtn.appendChild(scheduleIcon);
 
    // 彈跳視窗
    const modelBox = document.createElement('div');
    modelBox.id = `datePickermodel_${homework}`;
    modelBox.className = 'model-box';

    document.body.appendChild(modelBox);

    document.addEventListener('click', function(event) {
        const displayStyle = window.getComputedStyle(modelBox).display;
        if (displayStyle === 'block') {
            if (!modelBox.contains(event.target)) {
                // 點擊發生在 modelbox 之外，關閉 modelbox
                modelBox.style.display = 'none';
            }
        }
    });

    // 新增叉叉按鈕
    const closeButton = document.createElement('button');
    closeButton.className = 'close-btn';
    closeButton.innerHTML = '&times;'; // 使用叉叉符號
    closeButton.onclick = function() {
        modelBox.style.display = 'none';
    };

    // 將叉叉按鈕添加到 modelBox 中
    modelBox.appendChild(closeButton);

    const OKBtn = document.createElement('div');
    OKBtn.className = 'btn btn-success btn-sm ok-btn';
    OKBtn.textContent = 'OK';

    OKBtn.onclick = function() {

        modelBox.style.display = 'none';
        const startDate = document.querySelector("#datePicker1."+homework)._flatpickr.input.value;
        const endDate = document.querySelector("#datePicker2."+homework)._flatpickr.input.value;

        let permSwitch;
        let scheduleSwitch;

        let isForever = slideSwitch_forever.classList.contains('active');
        if (isForever) {
            permSwitch = "off";
        }
        else {
            permSwitch = "on";
        }

        let isSchedule = slideSwitch_schedule.classList.contains('active');
        if (isSchedule) {
            scheduleSwitch = "off";
        }
        else {
            scheduleSwitch = "on";
        }
        
        fetch('/DS/set_schedule', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({   
                permanent_switch: permSwitch,
                schedules_switch: scheduleSwitch,
                start: startDate,
                end: endDate,
                homeworkName: homework }),
        }).then(response => {
            if (response.ok) {
                response.json().then(data => {
                    if ( data.msg === "Time interval is overlapped with other schedule" ) {
                        alert(`Time overlap with other schedule!`);
                    } else {
                        location.reload();
                        alert(`Schedule Set!`);
                    }
                });
            }
            else {
                // Process the error response JSON
                return response.json().then(errorData => {
                    alert(`Error: ${errorData.error}`);
                });
            }
        }).catch(error => {
            alert(`${error}`);
        });
        
        
    };
    
    modelBox.appendChild(OKBtn);

    /* 日期設定錯誤訊息 */
    const errorMessage = document.createElement('div');
    errorMessage.id = 'date-error';
    errorMessage.className = 'date-error';
    errorMessage.textContent = '日期設定異常，請再重新檢查!';
    errorMessage.style.color = 'red';
    errorMessage.style.display = 'none'; // 先藏起來

    /* flatpickr套件的兩個輸入 */
    const datePickerInput1 = document.createElement('input');
    datePickerInput1.id = 'datePicker1';
    datePickerInput1.className = homework;
    const datePickerInput2 = document.createElement('input');
    datePickerInput2.id = 'datePicker2';
    datePickerInput2.className = homework;

    /* 在前端檢查日期是否正確 */
    function validateDates() {
        const startDate = new Date(datePickerInput1.value);
        const endDate = new Date(datePickerInput2.value);

        // 檢查日期
        if (startDate && endDate && startDate > endDate) {
            errorMessage.style.display = 'block';
        } else {
            errorMessage.style.display = 'none';
        }
    }

    // ====================================
    /* 建立滑動式開關 */
    /* 把 滑動式按鈕和文字 整合成一個 div */
    // 滑動式按鈕的橢圓形部分
    const slideSwitch_forever = document.createElement('div');
    slideSwitch_forever.className = 'slide-switch';
    // 創造圓圈圈
    const sliderCircle_forever = document.createElement('div');
    sliderCircle_forever.className = 'slider-circle';
    // 加在一起
    slideSwitch_forever.appendChild(sliderCircle_forever);
    // Create the label text
    const label_forever = document.createElement('span');
    label_forever.textContent = '無限期開啟作業';

    // Create the switch row container and append the elements
    const switchRow_forever = document.createElement('div');
    switchRow_forever.className = 'switch-row';
    switchRow_forever.appendChild(slideSwitch_forever);
    switchRow_forever.appendChild(label_forever);

    // Add event listener for the slide switch click
    slideSwitch_forever.addEventListener('click', function () {
        // Toggle the 'active' state of the switch
        this.classList.toggle('active');

        // Check if the switch is active
        let isActive = this.classList.contains('active');

        if (isActive) {
            disablePart.style.display = 'none';
        }
        else {
            disablePart.style.display = 'flex';
        }

    });
    // ====================================

    const slideSwitch_schedule = document.createElement('div');
    slideSwitch_schedule.className = 'slide-switch';
    // 創造圓圈圈
    const sliderCircle_schedule = document.createElement('div');
    sliderCircle_schedule.className = 'slider-circle';
    // 加在一起
    slideSwitch_schedule.appendChild(sliderCircle_schedule);
    // Create the label text
    const label_schedule = document.createElement('span');
    label_schedule.textContent = '依日期開放使用';

    // Create the switch row container and append the elements
    const switchRow_schedule = document.createElement('div');
    switchRow_schedule.className = 'switch-row';
    switchRow_schedule.appendChild(slideSwitch_schedule);
    switchRow_schedule.appendChild(label_schedule);

    // Add event listener for the slide switch click
    slideSwitch_schedule.addEventListener('click', function () {
        // Toggle the 'active' state of the switch

        this.classList.toggle('active');

        // Check if the switch is active
        let isActive = this.classList.contains('active');
    });
    // ====================================

    
    modelBox.appendChild(switchRow_forever);

    /* 禁用的部分 */
    const disablePart = document.createElement('div');
    disablePart.id = 'disable-part';
    disablePart.className = 'disable-part';
    modelBox.appendChild(disablePart);

    modelBox.appendChild(switchRow_schedule);

    /* 選擇日期的框框 */
    const selectionBox = document.createElement('div');
    selectionBox.className = 'select-box';

    /* 這邊把文字和日期輸入合起來視為一個container對待   */
    const textStartTime = document.createElement('span');
    textStartTime.textContent = '開始時間';
    const textEndTime = document.createElement('span');
    textEndTime.textContent = '結束時間';

    /* 把 開始日期/結束日期 與 排程輸入 整合成一個 div */
    const rowStartTime = document.createElement('div');
    rowStartTime.className = 'input-row';
    rowStartTime.appendChild(textStartTime);
    rowStartTime.appendChild(datePickerInput1);
    
    const rowEndTime = document.createElement('div');
    rowEndTime.className = 'input-row';
    rowEndTime.appendChild(textEndTime);
    rowEndTime.appendChild(datePickerInput2);

    selectionBox.appendChild(rowStartTime);
    selectionBox.appendChild(rowEndTime);
    selectionBox.appendChild(errorMessage);

    modelBox.appendChild(selectionBox);
    modelBox.style.display = 'none'; // 預設為隱藏

    scheduleBtn.onclick = function() {
        if (modelBox.style.display === 'none') {
            setTimeout(() => {
                modelBox.style.display = 'block';
            }, 100);
            
        }

        else {
            modelBox.style.display = 'none';
        }

        modelBox.style.flexDirection = 'column';          /* Align children vertically */
        modelBox.style.alignItems = 'flex-start';         /* Align items to the left */
        const datePicker1 = document.querySelector("#datePicker1." + homework);
        const datePicker2 = document.querySelector("#datePicker2." + homework);
    
        fetch('/DS/get_status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ homeworkName: homework }),
        })
        .then(response => response.json())
        .then(data => {

            const Is_permanent = data.permanent_switch;
            if (Is_permanent === "on" ) {
                slideSwitch_forever.classList.remove('active');
                disablePart.style.display = 'flex';
            }
            else {
                slideSwitch_forever.classList.add('active');
                disablePart.style.display = 'none';
            }

            const use_schedule = data.schedules_switch;
            if (use_schedule === "on" ) {
                slideSwitch_schedule.classList.remove('active');
            }
            else {
                slideSwitch_schedule.classList.add('active');
                
            }

            /* 桌子 */
            const times = data.schedules;
            const tbody = document.querySelector("#tbody."+homework);
            // Clear the table first to remove existing rows
            tbody.innerHTML = ''; 
            // console.log(`schedules: ${times}`);
            if (times.length > 0) {
                times.forEach(item => {
                    const row = document.createElement('tr');
                    const startCell = document.createElement('td');
                    startCell.textContent = item.start;
                    const endCell = document.createElement('td');
                    endCell.textContent = item.end;

                    const deleteCell = document.createElement('td');

                    const btnContainer = document.createElement('div');
                    btnContainer.style.display = 'flex';
                    btnContainer.style.justifyContent = 'center';
                    btnContainer.style.alignItems = 'center';
                    btnContainer.style.height = '100%'; // 確保容器高度撐滿單元格

                    const btn = document.createElement('button');
                    btn.style.textAlign = 'center'; // 水平置中
                    deleteCell.appendChild(btn);
                    btn.className = 'btn btn-danger btn-sm delete-btn delete-btn-mine cell-btn';
                    btn.onclick = function() {
                        fetch('/DS/delete_schedule', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ homeworkName: homework, start: item.start, end: item.end }),
                        }).then(response => {
                            if (response.ok) {
                                response.json().then(data => {
                                    if ( data.msg === "delete schedule success" ) {
                                        alert(`Schedule Deleted!`);
                                        location.reload();
                                    } else {
                                        alert(`Failed to delete schedule!`);
                                    }
                                });

                                
                            }
                        }).catch(error => {
                            console.error('Error:', error);
                        });
                    };

                    // 垃圾桶圖示
                    const trashcan = document.createElement('img');
                    trashcan.src = '/image/delete.png';
                    trashcan.className = 'delete-icon';
                    btn.appendChild(trashcan);
                    btnContainer.appendChild(btn);
                    deleteCell.appendChild(btnContainer);
                    
                    row.appendChild(startCell);
                    row.appendChild(endCell);
                    row.appendChild(deleteCell);
                    tbody.appendChild(row);
                });
            }

            const start_time = data.start_time || "Select Start Time";
            const end_time = data.end_time || "Select End Time";
    
            // Initialize Flatpickr with the fetched times
            if (!datePicker1._flatpickr) {
                flatpickr(datePicker1, {
                    enableTime: true,
                    dateFormat: "Y/m/d, H:i",
                    time_24hr: true,
                    defaultDate: start_time !== "Select Start Time" ? start_time : null,
                    onChange: validateDates,
                    // onClose: function (selectedDates, dateStr) {
                    //     console.log('Date 1 selected:', dateStr);
                    // }
                });
                datePicker1.placeholder = start_time;
            }
    
            if (!datePicker2._flatpickr) {
                flatpickr(datePicker2, {
                    enableTime: true,
                    dateFormat: "Y/m/d, H:i",
                    time_24hr: true,
                    defaultDate: end_time !== "Select End Time" ? end_time : null,
                    onChange: validateDates,
                    // onClose: function (selectedDates, dateStr) {
                    //     console.log('Date 2 selected:', dateStr);
                    // }
                });
                datePicker2.placeholder = end_time;
            }
        })
        .catch(error => {
            alert(`Error: ${error}`);
        });
    };

    const tableContainer = document.createElement('div');
    tableContainer.className = 'table-container'; // Add class for styling

    const table = document.createElement('table');
    table.className = 'schedule-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const headers = ['Start Time', 'End Time', '刪除'];

    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    tbody.id = 'tbody';
    tbody.className = homework;

    table.appendChild(tbody);
    tableContainer.appendChild(table);

    const selectBoxes = document.querySelectorAll('.select-box');
    if (selectBoxes.length > 0) {
        // Get the last .select-box and append the table container
        const lastBox = selectBoxes[selectBoxes.length - 1];
        lastBox.appendChild(tableContainer);
    }

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

    // 垃圾桶圖示
    const trashcan = document.createElement('img');
    trashcan.src = '/image/delete.png';
    trashcan.className = 'delete-icon';
    delete_btn.appendChild(trashcan);

    container.appendChild(homework_div);
    container.appendChild(scheduleBtn);
    container.appendChild(delete_btn);

    delete_zone.appendChild(container);
}


