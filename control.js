/**
 * YouTube Quality Shortcut - Control Module
 * 
 * This script handles quality control operations for YouTube videos
 * through keyboard shortcuts, allowing users to quickly switch
 * between available video resolutions.
 */

// Listen for commands from content script
document.addEventListener('controlEvent', ({detail}) => {
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

// Create a policy for trusted HTML (security best practice)
const policy = window.trustedTypes?.createPolicy('youtube-quality-policy', {
  createHTML: (input) => input
}) || { createHTML: (input) => input };

// Track timeout for UI feedback
let qualityChangeTimeoutId;

// Map YouTube quality IDs to human-readable labels and tags
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

// Display duration for quality change indicator (ms)
const QUALITY_DISPLAY_DURATION = 700;

/**
 * Change video quality up or down and show visual feedback
 * @param {boolean} increase - True to increase quality, false to decrease
 */
function changeQuality(increase) {
  const player = document.getElementById('movie_player');
  if (!player?.getAvailableQualityLevels) {
    console.error('YouTube Quality Shortcut: Player not found or API not available');
    return;
  }
  
  try {
    // Get available qualities and remove 'auto' option
    const qualities = [...player.getAvailableQualityLevels()];
    const autoIndex = qualities.indexOf('auto');
    if (autoIndex !== -1) {
      qualities.splice(autoIndex, 1);
    }
    
    if (qualities.length === 0) {
      console.warn('YouTube Quality Shortcut: No quality levels available');
      return;
    }

    // Determine new quality level
    const currentQuality = player.getPlaybackQuality();
    let currentQualityIndex = qualities.indexOf(currentQuality);
    
    // Default to highest quality if current quality not found
    if (currentQualityIndex === -1) {
      currentQualityIndex = 0;
    }
    
    if (increase && currentQualityIndex > 0) {
      currentQualityIndex--;
    } else if (!increase && currentQualityIndex < qualities.length - 1) {
      currentQualityIndex++;
    }
    
    const newQuality = qualities[currentQualityIndex];
    
    // Only update if quality is actually changing
    if (newQuality !== currentQuality) {
      // Update YouTube player with new quality setting
      player.setPlaybackQualityRange(newQuality);
      
      // Show quality change visual feedback
      showQualityChangeIndicator(newQuality);
    }
  } catch (error) {
    console.error('YouTube Quality Shortcut: Error changing quality', error);
  }
}

/**
 * Display on-screen indicator showing the newly selected quality
 * @param {string} quality - The YouTube quality ID
 */
function showQualityChangeIndicator(quality) {
  try {
    const bezelTxtWrapper = document.querySelector('.ytp-bezel-text-wrapper');
    const bezelTextElement = document.querySelector('.ytp-bezel-text');
    const wrapperParent = bezelTxtWrapper?.parentNode;
    const bezelTxtIcon = document.querySelector('.ytp-bezel-icon');
    
    if (!bezelTextElement || !wrapperParent || !bezelTxtIcon) return;
    
    // Hide icon and show text wrapper
    bezelTxtIcon.style.display = 'none';
    wrapperParent.style.display = 'block';
    
    wrapperParent.classList.remove('ytp-bezel-text-hide');
    
    // Display the quality text with optional badge
    const resolution = RESOLUTION_MAP[quality];
    let qualityHtml = resolution?.label || quality;
    
    if (resolution?.tag) {
      qualityHtml += ` <span style="background-color: red; color: white; padding: 2px 4px; border-radius: 4px; font-size: small;">${resolution.tag}</span>`;
    }
    
    // Use trusted HTML policy when available
    bezelTextElement.innerHTML = policy.createHTML(qualityHtml);
    
    // Clear any existing timeout
    if (qualityChangeTimeoutId) {
      clearTimeout(qualityChangeTimeoutId);
      qualityChangeTimeoutId = null;
    }

    // Hide the indicator after a short delay
    qualityChangeTimeoutId = setTimeout(() => {
      wrapperParent.style.display = 'none';
      bezelTxtIcon.style.display = 'block';
      qualityChangeTimeoutId = null;
    }, QUALITY_DISPLAY_DURATION);
  } catch (error) {
    console.error('YouTube Quality Shortcut: Error showing indicator', error);
  }
}
