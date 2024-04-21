document.addEventListener('controlEvent', function ({detail}) {
    const { command } = detail;
    switch (command) {
        case "decrease_quality":
            changeQuality(false);
            break;
        case "increase_quality":
            changeQuality(true);
            break;
    }
});

let prevTimeoutId;
const resolutionMap = {
    tiny: {
        label: '144p'
    },
    small: {
        label: '240p'
    },
    medium: {
        label: '360p'
    },
    large: {
        label: '480p'
    },
    hd720: {
        label: '720p'
    },
    hd1080: {
        label: '1080p',
        tag: 'HD'
    },
    hd1440: {
        label: '1440p',
        tag: 'HD+'
    },
    hd2160: {
        label: '2160p',
        tag: '4K'
    },
    hd2880: {
        label: '2880p',
        tag: '5K'
    },
    highres: {
        label: '4320p',
        tag: '8K'
    }
}
function changeQuality(increase) {
    const player = document.getElementById('movie_player');
    let qualities = player.getAvailableQualityLevels();

    // Remove 'auto' from the list of qualities
    const autoIndex = qualities.indexOf('auto');
    if (autoIndex !== -1) {
        qualities.splice(autoIndex, 1);
    }

    let currentQualityIndex = qualities.indexOf(player.getPlaybackQuality());
    
    if (increase && currentQualityIndex > 0) {
        currentQualityIndex--
    } else if (!increase && currentQualityIndex < qualities.length - 1) {
        currentQualityIndex++
    }
    
    const quality = qualities[currentQualityIndex];
    const bezelTxtWrapper = document.querySelector('.ytp-bezel-text-wrapper');
    const bezelTextElement = document.querySelector('.ytp-bezel-text');
    const wrapperParent = bezelTxtWrapper.parentNode;
    
    const bezelTxtIcon = document.querySelector('.ytp-bezel-icon');
    bezelTxtIcon.style.display = 'none';

    if (wrapperParent?.style.display === 'none') {
        wrapperParent.style.display = 'block';
    }
    
    if (wrapperParent?.classList.contains('ytp-bezel-text-hide')) {
        wrapperParent.classList.remove('ytp-bezel-text-hide');
    }
    if (bezelTextElement) {
        const resolution = resolutionMap[quality];
        let qualityHtml = resolution?.label || quality;
        if (resolution?.tag) {
            qualityHtml += ` <span style="background-color: red; color: white; padding: 2px 4px; border-radius: 4px; font-size: small;">${resolution.tag}</span>`;
        }
        bezelTextElement.innerHTML = qualityHtml;
    }

    if (prevTimeoutId) {
        clearTimeout(prevTimeoutId);
    }

    prevTimeoutId = setTimeout(() => {
        wrapperParent.style.display = 'none';
        bezelTxtIcon.style.display = 'block';
    }, 700);
    
    player.setPlaybackQualityRange(quality);
}
