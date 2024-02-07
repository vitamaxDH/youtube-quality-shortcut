document.addEventListener('qualityControlEvent', function (event) {
    console.log('Received in injected script:', event.detail);
    const { command } = event.detail;
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
    console.log('currentQualityIndex', currentQualityIndex);

    if (increase && currentQualityIndex > 0) {
        // Increase quality: select the next higher quality available
        player.setPlaybackQualityRange(qualities[currentQualityIndex - 1]);
    } else if (!increase && currentQualityIndex < qualities.length - 1) {
        // Decrease quality: select the next lower quality available
        player.setPlaybackQualityRange(qualities[currentQualityIndex + 1]);
    }
}
