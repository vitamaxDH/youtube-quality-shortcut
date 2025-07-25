"use strict";
let controlScriptInitialized = false;
let shortcutGuideModified = false;
let dialogObserverActive = false;
const extendedNavigator = navigator;
const isMacOS = /Mac/i.test(extendedNavigator.userAgentData?.platform || navigator.platform || '');
const KEYBOARD_SHORTCUTS = Object.freeze({
    qualityDown: isMacOS ? '⌘ + ⇧ + 1' : 'Ctrl + Shift + 1',
    qualityUp: isMacOS ? '⌘ + ⇧ + 2' : 'Ctrl + Shift + 2'
});
const SELECTORS = Object.freeze({
    popupContainer: 'ytd-popup-container',
    dialogElement: 'TP-YT-PAPER-DIALOG',
    dialogScrollable: 'tp-yt-paper-dialog-scrollable',
    sectionRenderer: 'ytd-hotkey-dialog-section-renderer',
    subTitle: 'div[id="sub-title"]',
    options: 'div[id="options"]',
    shortcutOption: 'ytd-hotkey-dialog-section-option-renderer',
    label: 'div[id="label"]',
    hotkey: 'div[id="hotkey"]'
});
const RETRY_DELAY = 1000;
const EXTENSION_NAME_CONTENT = 'YouTube Quality Shortcut';
async function injectControlScript(scriptPath) {
    if (controlScriptInitialized) {
        return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
        try {
            const script = document.createElement('script');
            script.src = scriptPath;
            script.addEventListener('load', () => {
                controlScriptInitialized = true;
                resolve();
            }, { once: true });
            script.addEventListener('error', () => {
                reject(new Error(`Failed to load ${EXTENSION_NAME_CONTENT} control script`));
            }, { once: true });
            document.body.appendChild(script);
        }
        catch (error) {
            reject(error);
        }
    });
}
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    console.log(`${EXTENSION_NAME_CONTENT}: Received message:`, request);
    if (request.command === 'get_quality_info') {
        getYouTubeQualityInfo()
            .then(qualityInfo => {
            sendResponse({
                success: true,
                currentQuality: qualityInfo.currentQuality,
                availableQualities: qualityInfo.availableQualities
            });
        })
            .catch(error => {
            console.error(`${EXTENSION_NAME_CONTENT}:`, error);
            sendResponse({ success: false, error: error.message });
        });
        return true;
    }
    injectControlScript(chrome.runtime.getURL('./dist/control.js'))
        .then(() => {
        let eventDetail = { command: request.command };
        if (request.command === 'set_specific_quality' && request.quality) {
            eventDetail.quality = request.quality;
        }
        if (request.command === 'lowest_quality') {
            eventDetail.command = 'lowest_quality';
        }
        else if (request.command === 'highest_quality') {
            eventDetail.command = 'highest_quality';
        }
        const event = new CustomEvent('controlEvent', { detail: eventDetail });
        document.dispatchEvent(event);
        const qualityChangeCommands = ['increase_quality', 'decrease_quality', 'highest_quality', 'lowest_quality', 'set_specific_quality'];
        if (qualityChangeCommands.includes(request.command)) {
            setTimeout(() => {
                getYouTubeQualityInfo()
                    .then(qualityInfo => {
                    sendResponse({
                        success: true,
                        newQuality: qualityInfo.currentQuality
                    });
                })
                    .catch(() => {
                    sendResponse({ success: true });
                });
            }, 100);
        }
        else {
            sendResponse({ success: true });
        }
    })
        .catch(error => {
        console.error(`${EXTENSION_NAME_CONTENT}:`, error);
        sendResponse({ success: false, error: error.message });
    });
    return true;
});
function getYouTubeQualityInfo() {
    return new Promise((resolve, reject) => {
        try {
            injectControlScript(chrome.runtime.getURL('./dist/control.js'))
                .then(() => {
                const requestId = Date.now().toString();
                const qualityInfoListener = (event) => {
                    if (event.detail && event.detail.requestId === requestId) {
                        document.removeEventListener('qualityInfoResponse', qualityInfoListener);
                        resolve({
                            success: true,
                            currentQuality: event.detail.currentQuality,
                            availableQualities: event.detail.availableQualities
                        });
                    }
                };
                document.addEventListener('qualityInfoResponse', qualityInfoListener);
                const event = new CustomEvent('getQualityInfo', {
                    detail: { requestId }
                });
                document.dispatchEvent(event);
                setTimeout(() => {
                    document.removeEventListener('qualityInfoResponse', qualityInfoListener);
                    reject(new Error('Timed out waiting for quality info'));
                }, 1000);
            })
                .catch(error => {
                reject(error);
            });
        }
        catch (error) {
            reject(error);
        }
    });
}
function observeYouTubeShortcutDialog() {
    if (dialogObserverActive)
        return;
    const container = document.querySelector(SELECTORS.popupContainer);
    if (!container) {
        setTimeout(observeYouTubeShortcutDialog, RETRY_DELAY);
        return;
    }
    dialogObserverActive = true;
    const containerObserver = new MutationObserver((mutations) => {
        for (const { type, addedNodes } of mutations) {
            if (type !== 'childList')
                continue;
            for (const node of Array.from(addedNodes)) {
                if (node.nodeName === SELECTORS.dialogElement && !node.observed) {
                    node.observed = true;
                    watchForDialogVisibility(node);
                    containerObserver.disconnect();
                    dialogObserverActive = false;
                    break;
                }
            }
        }
    });
    containerObserver.observe(container, {
        childList: true,
        subtree: true
    });
}
function watchForDialogVisibility(dialogElement) {
    const styleObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const isVisible = window.getComputedStyle(dialogElement).display !== 'none';
                if (isVisible && !shortcutGuideModified) {
                    shortcutGuideModified = true;
                    requestAnimationFrame(() => {
                        addQualityShortcutsToGuide();
                        styleObserver.disconnect();
                    });
                    break;
                }
            }
        }
    });
    styleObserver.observe(dialogElement, {
        attributes: true,
        attributeFilter: ['style']
    });
}
function addQualityShortcutsToGuide() {
    try {
        const dialog = document.querySelector(SELECTORS.dialogScrollable);
        if (!dialog)
            return;
        const sectionRenderers = Array.from(dialog.querySelectorAll(SELECTORS.sectionRenderer));
        if (!sectionRenderers.length)
            return;
        const generalSection = sectionRenderers.find(section => {
            const titleDiv = section.querySelector(SELECTORS.subTitle);
            return titleDiv?.textContent?.toLowerCase() === 'general';
        });
        if (!generalSection)
            return;
        const existingSubtitleDiv = generalSection.querySelector(SELECTORS.subTitle);
        const existingOptionsDiv = generalSection.querySelector(SELECTORS.options);
        const existingShortcutOption = existingOptionsDiv?.querySelector(SELECTORS.shortcutOption);
        if (!existingSubtitleDiv || !existingOptionsDiv || !existingShortcutOption)
            return;
        const fragment = document.createDocumentFragment();
        const customSectionTitle = existingSubtitleDiv.cloneNode(false);
        customSectionTitle.textContent = EXTENSION_NAME_CONTENT;
        fragment.appendChild(customSectionTitle);
        const customOptionsDiv = existingOptionsDiv.cloneNode(false);
        const qualityUpOption = createShortcutEntry(existingShortcutOption, 'Quality Up', KEYBOARD_SHORTCUTS.qualityUp);
        const qualityDownOption = createShortcutEntry(existingShortcutOption, 'Quality Down', KEYBOARD_SHORTCUTS.qualityDown);
        customOptionsDiv.append(qualityDownOption, qualityUpOption);
        fragment.appendChild(customOptionsDiv);
        generalSection.appendChild(fragment);
    }
    catch (error) {
        console.error(`${EXTENSION_NAME_CONTENT}: Failed to modify keyboard shortcut guide`, error);
        shortcutGuideModified = false;
    }
}
function createShortcutEntry(template, labelText, hotkeyText) {
    const shortcutEntry = template.cloneNode(true);
    const labelElement = shortcutEntry.querySelector(SELECTORS.label);
    const hotkeyElement = shortcutEntry.querySelector(SELECTORS.hotkey);
    if (labelElement)
        labelElement.textContent = labelText;
    if (hotkeyElement)
        hotkeyElement.textContent = hotkeyText;
    return shortcutEntry;
}
console.log(`${EXTENSION_NAME_CONTENT}: Content script loaded on`, window.location.href);
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeYouTubeShortcutDialog);
}
else {
    observeYouTubeShortcutDialog();
}
