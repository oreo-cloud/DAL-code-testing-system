// staff.js
document.addEventListener('DOMContentLoaded', function() {
    var loginForm = document.querySelector('form');

    loginForm.addEventListener('submit', function(event) {
        event.preventDefault(); // 阻止表單默認提交行為

        var username = document.getElementById('username').value;
        var password = document.getElementById('password').value;

        fetch('/DS/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: username, password: password })
        })
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('Network response was not ok.');
            }
        })
        .then(data => {
            if (data.success) {
                window.location.href = '/staffonly';
            } else {
                alert('用戶名或密碼錯誤');
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
    });
});
