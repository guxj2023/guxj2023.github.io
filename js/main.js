

function loadScript(url, callback) {
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = url;
    script.onload = callback; // 脚本加载完成后执行回调
    document.head.appendChild(script);
}

loadScript('js/avgtime.js', function () { });