window.onload = function() {
    var isMac = navigator.userAgent.indexOf('Mac OS X') != -1;
    var windowsShortcuts = document.getElementById('windowsShortcuts');
    var macShortcuts = document.getElementById('macShortcuts');

    if (isMac) {
        windowsShortcuts.style.display = 'none';
        macShortcuts.style.display = 'block';
    } else {
        windowsShortcuts.style.display = 'block';
        macShortcuts.style.display = 'none';
    }
};