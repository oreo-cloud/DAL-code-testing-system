const parser = new DOMParser;
const dom = parser.parseFromString('<!doctype html><body>' + encodedJson, 'text/html');
const decodedJson = dom.body.textContent;
const data = JSON.parse(decodedJson);

let buttonsDiv = document.getElementById('buttons');
let body_part = document.getElementById('body');
buttonsDiv.innerHTML = '';
let content_count = 1 ;



for (const item of data) {
    // 側邊欄按鈕
    var button = document.createElement('button');
    button.className = 'button-19';
    buttonsDiv.appendChild(button);

    // 畫面中間內容
    var content = document.createElement('div');
    content.className = `content content${content_count} row animate__animated animate__fadeIn`;
    content.style.display = 'none';

    // 作業名稱
    var text = document.createElement('span');
    text.style.position = 'absolute';
    text.style.color = 'black';
    text.style.fontWeight = 'bold';
    text.innerText = item.homework;
    button.innerText = item.homework;
    content.appendChild(text);

    var a_bar = document.createElement('div');
    var b_bar = document.createElement('div');
    a_bar.className = "a_bar col";
    b_bar.className = "b_bar col";
    a_syntax = /a$/;
    b_syntax = /b$/;
    for ( const type of item.type ) {
        if ( a_syntax.test( type ) ) {
            let button_a = document.createElement('button');
            button_a.className = 'button-54';
            button_a.innerText = type;
            button_a.onclick = function() {
                location.href = `/DS/${item.homework}/${type}`;
            }

            a_bar.appendChild(button_a);
        }

        else if ( b_syntax.test( type ) ) {
            let button_b = document.createElement('button');
            button_b.className = 'button-54';
            button_b.innerText = type;
            button_b.onclick = function() {
                location.href = `/DS/${item.homework}/${type}`;
            }

            b_bar.appendChild(button_b);
        }

        else {
            console.log('Error');
        } // else()

    }

    var a_span = document.createElement('span');
    a_span.style.position = 'absolute';
    a_span.style.bottom = '5%';
    a_span.style.color = 'black';
    a_span.style.fontWeight = 'bold';
    a_span.innerText = '甲班';
    a_bar.appendChild(a_span);

    var b_span = document.createElement('span');
    b_span.style.position = 'absolute';
    b_span.style.bottom = '5%';
    b_span.style.color = 'black';
    b_span.style.fontWeight = 'bold';
    b_span.innerText = '乙班';
    b_bar.appendChild(b_span);

    content.appendChild(a_bar);
    content.appendChild(b_bar);

    body_part.appendChild(content);
    content_count+= 1 ;

}

var buttons = document.querySelectorAll('.button-19');
var contents = document.querySelectorAll('[class^="content"]');  // 選擇class包含content的

buttons.forEach(function (button, index) {  // index依序設定為0, 1, 2, 3, 4

    button.addEventListener('click', function () {
        // 隱藏所有內容
        contents.forEach(function (content) {
            content.style.display = 'none';
        });

        // 顯示相應的內容
        var content = document.querySelector('.content' + (index + 1));
        content.style.display = 'flex';
    });
});


var buttons = document.querySelectorAll('.button-19');
for (const button of buttons) {
   
    button.style.display = 'none';// 將按鈕初始設為隱藏
    
    fetch('/DS/get_homework_status', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        // 'data' : 從後端返回的作業狀態列表，格式假設 [{homework: "TEST1", action: "on"}, {homework: "TEST2", action: "off"}, ...]
        for (const state of data) {
            if (state.homework === button.textContent) {
                if (state.action === 'off') {
                    button.style.display = 'none';  // 隱藏按鈕
                } else if (state.action === 'on') {
                    button.style.display = 'block';  // 顯示按鈕
                }

                break;
            }
    
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });

}