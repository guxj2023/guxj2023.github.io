

function loadScript(url, callback) {
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = url;
    script.onload = callback; // 脚本加载完成后执行回调
    document.head.appendChild(script);
}

loadScript('js/avgtime.js', function () {
    console.log('脚本加载完成');
});

document.getElementById('clickMe').addEventListener('click', function () {
    alert('按钮被点击了！');
});