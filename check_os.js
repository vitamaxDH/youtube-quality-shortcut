window.onload = function() {
    const isMac = navigator.userAgent.indexOf('Mac OS X') != -1;

    const windowsShortcuts = document.getElementById('windowsShortcuts');
    const macShortcuts = document.getElementById('macShortcuts');

    if (isMac) {
        macShortcuts.style.display = 'block';
    } else {
        windowsShortcuts.style.display = 'block';
    }
};
