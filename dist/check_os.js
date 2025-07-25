"use strict";
document.addEventListener('DOMContentLoaded', () => {
    const extendedNavigator = navigator;
    const isMacOS = /Mac/i.test(extendedNavigator.userAgentData?.platform || navigator.platform || '');
    const windowsShortcutsElement = document.getElementById('windowsShortcuts');
    const macShortcutsElement = document.getElementById('macShortcuts');
    if (!windowsShortcutsElement || !macShortcutsElement) {
        console.error('YouTube Quality Shortcut: Shortcut elements not found');
        return;
    }
    if (isMacOS) {
        macShortcutsElement.style.display = 'block';
    }
    else {
        windowsShortcutsElement.style.display = 'block';
    }
});
