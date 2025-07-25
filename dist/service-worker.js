"use strict";
const ICONS = Object.freeze({
    active: './images/icon_active_32.png',
    inactive: './images/icon_32.png'
});
const YOUTUBE_WATCH_PATTERNS = ['youtube.com/watch', 'www.youtube.com/watch'];
const EXTENSION_NAME_SW = 'YouTube Quality Shortcut';
chrome.commands.onCommand.addListener((command) => {
    try {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || !tabs.length) {
                console.debug(`${EXTENSION_NAME_SW}: No active tabs found`);
                return;
            }
            const activeTab = tabs[0];
            if (isYouTubeWatchPage(activeTab.url)) {
                const message = { command, ...(activeTab.id && { tabId: activeTab.id }) };
                chrome.tabs.sendMessage(activeTab.id, message, () => {
                    const error = chrome.runtime.lastError;
                    if (error) {
                        console.debug(`${EXTENSION_NAME_SW}: ${error.message}`);
                    }
                });
            }
        });
    }
    catch (error) {
        console.error(`${EXTENSION_NAME_SW}: Command handler error`, error);
    }
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo, _tab) => {
    try {
        if (!changeInfo.url)
            return;
        const iconPath = isYouTubeWatchPage(changeInfo.url) ?
            ICONS.active :
            ICONS.inactive;
        chrome.action.setIcon({
            path: iconPath,
            tabId
        }).catch((error) => {
            console.debug(`${EXTENSION_NAME_SW}: Icon update error`, error);
        });
    }
    catch (error) {
        console.error(`${EXTENSION_NAME_SW}: Tab update handler error`, error);
    }
});
function isYouTubeWatchPage(url) {
    if (!url || typeof url !== 'string')
        return false;
    return YOUTUBE_WATCH_PATTERNS.some(pattern => url.includes(pattern));
}
