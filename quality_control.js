document.addEventListener('qualityControlEvent', function ({detail}) {
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

function changeQuality(increase) {
    const player = document.getElementById('movie_player');
    let qualities = player.getAvailableQualityLevels();

    // Remove 'auto' from the list of qualities
    const autoIndex = qualities.indexOf('auto');
    if (autoIndex !== -1) {
        qualities.splice(autoIndex, 1);
    }

    let currentQualityIndex = qualities.indexOf(player.getPlaybackQuality());
    console.log('qualities', qualities);
    
    if (increase && currentQualityIndex > 0) {
        const quality = qualities[currentQualityIndex - 1];
        console.log('Quality applied', quality);
        player.setPlaybackQualityRange(quality);
    } else if (!increase && currentQualityIndex < qualities.length - 1) {
        const quality = qualities[currentQualityIndex + 1];
        console.log('Quality applied', quality);
        player.setPlaybackQualityRange(quality);
    }
}
