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
    acceptedFiles: ".cpp, .txt",
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

            // 在這裡處理成功的回應
            if (myDropzone.files.length > 0) {
                // 移除所有檔案
                myDropzone.removeAllFiles(true);
            }

            document.getElementById('homework-name').value = ''; // 清空備註欄位
            hideButton(); // 按鈕隱藏
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

