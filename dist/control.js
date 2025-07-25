"use strict";
document.addEventListener('controlEvent', (event) => {
    const { detail } = event;
    const { command } = detail;
    if (command === "set_specific_quality" && detail.quality) {
        setSpecificQuality(detail.quality);
        return;
    }
    switch (command) {
        case "decrease_quality":
            changeQuality(false);
            break;
        case "increase_quality":
            changeQuality(true);
            break;
        case "lowest_quality":
            setQualityExtreme(false);
            break;
        case "highest_quality":
            setQualityExtreme(true);
            break;
    }
});
document.addEventListener('getQualityInfo', (event) => {
    const customEvent = event;
    const requestId = customEvent.detail.requestId;
    sendQualityInfo(requestId);
});
const policy = globalThis.trustedTypes?.createPolicy('youtube-quality-policy', {
    createHTML: (input) => input
}) || { createHTML: (input) => input };
let qualityChangeTimeoutId = null;
const RESOLUTION_MAP = Object.freeze({
    tiny: { label: '144p' },
    small: { label: '240p' },
    medium: { label: '360p' },
    large: { label: '480p' },
    hd720: { label: '720p' },
    hd1080: { label: '1080p', tag: 'HD' },
    hd1440: { label: '1440p', tag: 'HD+' },
    hd2160: { label: '2160p', tag: '4K' },
    hd2880: { label: '2880p', tag: '5K' },
    highres: { label: '4320p', tag: '8K' }
});
const QUALITY_DISPLAY_DURATION = 700;
function sendQualityInfo(requestId) {
    const player = document.getElementById('movie_player');
    if (!player?.getAvailableQualityLevels) {
        document.dispatchEvent(new CustomEvent('qualityInfoResponse', {
            detail: { requestId, currentQuality: { id: '', label: '' }, availableQualities: [] }
        }));
        return;
    }
    try {
        const currentQuality = player.getPlaybackQuality();
        const availableQualities = player.getAvailableQualityLevels();
        let formattedCurrentQuality = { id: currentQuality, label: currentQuality };
        if (RESOLUTION_MAP[currentQuality]) {
            formattedCurrentQuality = {
                id: currentQuality,
                label: RESOLUTION_MAP[currentQuality].label,
                ...(RESOLUTION_MAP[currentQuality].tag && { tag: RESOLUTION_MAP[currentQuality].tag })
            };
        }
        const formattedAvailableQualities = availableQualities.map(q => {
            if (RESOLUTION_MAP[q]) {
                return {
                    id: q,
                    label: RESOLUTION_MAP[q].label,
                    ...(RESOLUTION_MAP[q].tag && { tag: RESOLUTION_MAP[q].tag })
                };
            }
            return { id: q, label: q };
        });
        document.dispatchEvent(new CustomEvent('qualityInfoResponse', {
            detail: {
                requestId,
                currentQuality: formattedCurrentQuality,
                availableQualities: formattedAvailableQualities
            }
        }));
    }
    catch (error) {
        console.error('YouTube Quality Shortcut: Error getting quality info', error);
        document.dispatchEvent(new CustomEvent('qualityInfoResponse', {
            detail: { requestId, currentQuality: { id: '', label: '' }, availableQualities: [] }
        }));
    }
}
function changeQuality(increase) {
    const player = document.getElementById('movie_player');
    if (!player?.getAvailableQualityLevels) {
        console.error('YouTube Quality Shortcut: Player not found or API not available');
        return;
    }
    try {
        const qualities = [...player.getAvailableQualityLevels()];
        const autoIndex = qualities.indexOf('auto');
        if (autoIndex !== -1) {
            qualities.splice(autoIndex, 1);
        }
        if (qualities.length === 0) {
            console.warn('YouTube Quality Shortcut: No quality levels available');
            return;
        }
        const currentQuality = player.getPlaybackQuality();
        let currentQualityIndex = qualities.indexOf(currentQuality);
        if (currentQualityIndex === -1) {
            currentQualityIndex = 0;
        }
        let newQualityIndex = currentQualityIndex;
        if (increase && currentQualityIndex > 0) {
            newQualityIndex = currentQualityIndex - 1;
        }
        else if (!increase && currentQualityIndex < qualities.length - 1) {
            newQualityIndex = currentQualityIndex + 1;
        }
        const newQuality = qualities[newQualityIndex];
        if (newQuality !== currentQuality) {
            player.setPlaybackQualityRange(newQuality);
        }
        showQualityChangeIndicator(newQuality);
    }
    catch (error) {
        console.error('YouTube Quality Shortcut: Error changing quality', error);
    }
}
function showQualityChangeIndicator(quality) {
    try {
        const bezelTxtWrapper = document.querySelector('.ytp-bezel-text-wrapper');
        const bezelTextElement = document.querySelector('.ytp-bezel-text');
        const wrapperParent = bezelTxtWrapper?.parentNode;
        const bezelTxtIcon = document.querySelector('.ytp-bezel-icon');
        if (!bezelTextElement || !wrapperParent || !bezelTxtIcon)
            return;
        bezelTxtIcon.style.display = 'none';
        wrapperParent.style.display = 'block';
        wrapperParent.classList.remove('ytp-bezel-text-hide');
        const resolution = RESOLUTION_MAP[quality];
        let qualityHtml = resolution?.label || quality;
        if (resolution?.tag) {
            qualityHtml += ` <span style="background-color: red; color: white; padding: 2px 4px; border-radius: 4px; font-size: small;">${resolution.tag}</span>`;
        }
        bezelTextElement.innerHTML = policy.createHTML(qualityHtml);
        if (qualityChangeTimeoutId) {
            clearTimeout(qualityChangeTimeoutId);
            qualityChangeTimeoutId = null;
        }
        qualityChangeTimeoutId = window.setTimeout(() => {
            wrapperParent.style.display = 'none';
            bezelTxtIcon.style.display = 'block';
            qualityChangeTimeoutId = null;
        }, QUALITY_DISPLAY_DURATION);
    }
    catch (error) {
        console.error('YouTube Quality Shortcut: Error showing indicator', error);
    }
}
function setQualityExtreme(highest) {
    const player = document.getElementById('movie_player');
    if (!player?.getAvailableQualityLevels) {
        console.error('YouTube Quality Shortcut: Player not found or API not available');
        return;
    }
    try {
        const qualities = [...player.getAvailableQualityLevels()];
        const autoIndex = qualities.indexOf('auto');
        if (autoIndex !== -1) {
            qualities.splice(autoIndex, 1);
        }
        if (qualities.length === 0) {
            console.warn('YouTube Quality Shortcut: No quality levels available');
            return;
        }
        const currentQuality = player.getPlaybackQuality();
        const newQuality = highest ? qualities[0] : qualities[qualities.length - 1];
        if (newQuality !== currentQuality) {
            player.setPlaybackQualityRange(newQuality);
        }
        showQualityChangeIndicator(newQuality);
    }
    catch (error) {
        console.error('YouTube Quality Shortcut: Error setting extreme quality', error);
    }
}
function setSpecificQuality(qualityId) {
    const player = document.getElementById('movie_player');
    if (!player?.getAvailableQualityLevels) {
        console.error('YouTube Quality Shortcut: Player not found or API not available');
        return;
    }
    try {
        const availableQualities = player.getAvailableQualityLevels();
        if (!availableQualities.includes(qualityId)) {
            console.warn(`YouTube Quality Shortcut: Requested quality ${qualityId} not available`);
            return;
        }
        const currentQuality = player.getPlaybackQuality();
        if (qualityId !== currentQuality) {
            player.setPlaybackQualityRange(qualityId);
        }
        showQualityChangeIndicator(qualityId);
    }
    catch (error) {
        console.error('YouTube Quality Shortcut: Error setting specific quality', error);
    }
}
