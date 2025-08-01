"use strict";
const picoPreload = document.getElementById('picocss-preload');
if (picoPreload) {
    picoPreload.addEventListener('load', function handlePicoLoad() {
        picoPreload.removeEventListener('load', handlePicoLoad);
        picoPreload.rel = 'stylesheet';
    });
}
const QUALITY_ORDER = [
    'highres',
    'hd2880',
    'hd2160',
    'hd1440',
    'hd1080',
    'hd720',
    'large',
    'medium',
    'small',
    'tiny'
];
let activeTabId = null;
let availableQualities = [];
let currentQuality = null;
let qualitySliderManuallyChanged = false;
let qualityPollIntervalId = null;
const POLL_INTERVAL = 1000;
const qualitySlider = document.getElementById('qualitySlider');
const currentQualityDisplay = document.getElementById('currentQuality');
const lowestQualityRadio = document.getElementById('lowestQuality');
const highestQualityRadio = document.getElementById('highestQuality');
const statusMessage = document.getElementById('statusMessage');
document.addEventListener('DOMContentLoaded', initializePopup);
async function initializePopup() {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs || tabs.length === 0) {
            showMessage('No active tab found', 'error');
            return;
        }
        const activeTab = tabs[0];
        activeTabId = activeTab.id;
        if (!activeTab.url || !(activeTab.url.includes('youtube.com/watch') || activeTab.url.includes('www.youtube.com/watch'))) {
            showMessage('Not a YouTube video page', 'warning');
            disableControls();
            return;
        }
        initializeControls();
        getQualityInfo();
        startQualityPolling();
        window.addEventListener('unload', stopQualityPolling);
    }
    catch (error) {
        console.error('Error initializing popup:', error);
        showMessage('Failed to initialize controls', 'error');
    }
}
function startQualityPolling() {
    if (qualityPollIntervalId)
        return;
    qualityPollIntervalId = window.setInterval(() => {
        if (activeTabId) {
            refreshQualityInfo();
        }
    }, POLL_INTERVAL);
}
function stopQualityPolling() {
    if (qualityPollIntervalId) {
        clearInterval(qualityPollIntervalId);
        qualityPollIntervalId = null;
    }
}
function refreshQualityInfo() {
    if (!activeTabId)
        return;
    chrome.tabs.sendMessage(activeTabId, { command: 'get_quality_info' }, (response) => {
        const error = chrome.runtime.lastError;
        if (error || !response || !response.success) {
            return;
        }
        updateQualityDisplay(response);
    });
}
function updateQualityDisplay(response) {
    if (!response.availableQualities || response.availableQualities.length === 0) {
        return;
    }
    const newQualityId = response.currentQuality ? response.currentQuality.id : null;
    const oldQualityId = currentQuality ? currentQuality.id : null;
    if (newQualityId === oldQualityId) {
        return;
    }
    availableQualities = response.availableQualities
        .filter(q => q.id !== 'auto')
        .sort((a, b) => {
        return QUALITY_ORDER.indexOf(a.id) - QUALITY_ORDER.indexOf(b.id);
    });
    currentQuality = response.currentQuality || null;
    qualitySliderManuallyChanged = false;
    setSliderToCurrentQuality();
    updateRadioButtons();
}
function initializeControls() {
    qualitySlider.addEventListener('input', handleSliderInput);
    qualitySlider.addEventListener('change', handleSliderChange);
    lowestQualityRadio.addEventListener('change', () => {
        if (lowestQualityRadio.checked) {
            sendCommand('lowest_quality');
        }
    });
    highestQualityRadio.addEventListener('change', () => {
        if (highestQualityRadio.checked) {
            sendCommand('highest_quality');
        }
    });
    setupCoffeeButton();
}
function setupCoffeeButton() {
    const coffeeBtn = document.getElementById('coffeeBtn');
    if (coffeeBtn) {
        coffeeBtn.addEventListener('click', () => {
            window.open('https://buymeacoffee.com/vitamaxdh', '_blank');
        });
    }
}
function handleSliderInput() {
    if (!availableQualities.length)
        return;
    qualitySliderManuallyChanged = true;
    updateQualityDisplayFromSlider();
}
function handleSliderChange() {
    if (!availableQualities.length)
        return;
    const selectedIndex = getSelectedQualityIndex();
    const qualityId = availableQualities[selectedIndex]?.id;
    if (qualityId) {
        sendCommand('set_specific_quality', { quality: qualityId });
    }
}
function getSelectedQualityIndex() {
    const sliderPercentage = parseFloat(qualitySlider.value);
    const normalizedPercentage = 100 - sliderPercentage;
    let index = Math.round((normalizedPercentage / 100) * (availableQualities.length - 1));
    index = Math.max(0, Math.min(index, availableQualities.length - 1));
    return index;
}
function updateQualityDisplayFromSlider() {
    if (!availableQualities.length)
        return;
    const selectedIndex = getSelectedQualityIndex();
    const quality = availableQualities[selectedIndex];
    if (quality) {
        let qualityText = quality.label;
        if (quality.tag) {
            qualityText += ` <span class="quality-tag">${quality.tag}</span>`;
        }
        currentQualityDisplay.innerHTML = qualityText;
    }
}
function getQualityInfo() {
    if (!activeTabId)
        return;
    chrome.tabs.sendMessage(activeTabId, { command: 'get_quality_info' }, (response) => {
        const error = chrome.runtime.lastError;
        if (error) {
            console.error('Error getting quality info:', error.message);
            showMessage('Could not retrieve quality information', 'error');
            return;
        }
        if (response && response.success) {
            handleQualityInfoResponse(response);
        }
        else {
            showMessage('Failed to get quality information', 'error');
            disableControls();
        }
    });
}
function handleQualityInfoResponse(response) {
    if (!response.availableQualities || response.availableQualities.length === 0) {
        showMessage('No quality levels available', 'warning');
        disableControls();
        return;
    }
    availableQualities = response.availableQualities
        .filter(q => q.id !== 'auto')
        .sort((a, b) => {
        return QUALITY_ORDER.indexOf(a.id) - QUALITY_ORDER.indexOf(b.id);
    });
    currentQuality = response.currentQuality || null;
    enableControls();
    setSliderToCurrentQuality();
    updateRadioButtons();
    showMessage('Ready', 'success');
}
function setSliderToCurrentQuality() {
    if (!availableQualities.length || !currentQuality)
        return;
    const currentIndex = availableQualities.findIndex(q => q.id === currentQuality.id);
    if (currentIndex >= 0 && !qualitySliderManuallyChanged) {
        const sliderPercentage = 100 - ((currentIndex / (availableQualities.length - 1)) * 100);
        qualitySlider.value = sliderPercentage.toString();
        let qualityText = currentQuality.label;
        if (currentQuality.tag) {
            qualityText += ` <span class="quality-tag">${currentQuality.tag}</span>`;
        }
        currentQualityDisplay.innerHTML = qualityText;
    }
}
function updateRadioButtons() {
    if (!availableQualities.length || !currentQuality)
        return;
    const isHighest = currentQuality.id === availableQualities[0].id;
    const isLowest = currentQuality.id === availableQualities[availableQualities.length - 1].id;
    highestQualityRadio.checked = isHighest;
    lowestQualityRadio.checked = isLowest;
}
function enableControls() {
    qualitySlider.disabled = false;
    lowestQualityRadio.disabled = false;
    highestQualityRadio.disabled = false;
}
function disableControls() {
    qualitySlider.disabled = true;
    lowestQualityRadio.disabled = true;
    highestQualityRadio.disabled = true;
    currentQualityDisplay.textContent = 'Not available';
}
function sendCommand(command, params = {}) {
    if (!activeTabId)
        return;
    const message = { command, ...params };
    showMessage('Changing quality...', 'info');
    chrome.tabs.sendMessage(activeTabId, message, (response) => {
        const error = chrome.runtime.lastError;
        if (error) {
            console.error('Error sending command:', error.message);
            showMessage('Error changing quality', 'error');
            return;
        }
        if (response && response.success) {
            if (response.newQuality) {
                currentQuality = response.newQuality;
                setSliderToCurrentQuality();
                updateRadioButtons();
            }
            showMessage('Quality changed successfully', 'success');
        }
        else {
            showMessage('Failed to change quality', 'error');
        }
    });
}
function showMessage(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = 'status-message';
    statusMessage.classList.add(`status-${type}`);
}
