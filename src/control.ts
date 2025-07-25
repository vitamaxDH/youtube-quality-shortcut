/**
 * YouTube Quality Shortcut - Control Module
 * 
 * This script handles quality control operations for YouTube videos
 * through keyboard shortcuts, allowing users to quickly switch
 * between available video resolutions.
 */

// Types for YouTube player
interface YouTubePlayer extends HTMLElement {
  getAvailableQualityLevels(): string[];
  getPlaybackQuality(): string;
  setPlaybackQualityRange(quality: string): void;
}

interface QualityInfo {
  id: string;
  label: string;
  tag?: string;
}

interface ControlEventDetail {
  command: string;
  quality?: string;
}

interface QualityInfoEventDetail {
  requestId: string;
}

interface QualityResponseEventDetail {
  requestId: string;
  currentQuality: QualityInfo;
  availableQualities: QualityInfo[];
}

interface TrustedTypesPolicy {
  createHTML(input: string): string;
}

interface TrustedTypes {
  createPolicy(name: string, policy: { createHTML: (input: string) => string }): TrustedTypesPolicy;
}

// Listen for commands from content script
document.addEventListener('controlEvent', (event: Event): void => {
  const { detail } = event as CustomEvent<ControlEventDetail>;
  const { command } = detail;
  
  // Handle set_specific_quality command
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

// Listen for quality info requests
document.addEventListener('getQualityInfo', (event: Event): void => {
  const customEvent = event as CustomEvent<QualityInfoEventDetail>;
  const requestId = customEvent.detail.requestId;
  sendQualityInfo(requestId);
});

// Create a policy for trusted HTML (security best practice)
const policy: TrustedTypesPolicy = (globalThis as any).trustedTypes?.createPolicy('youtube-quality-policy', {
  createHTML: (input: string) => input
}) || { createHTML: (input: string) => input };

// Track timeout for UI feedback
let qualityChangeTimeoutId: number | null = null;

// Map YouTube quality IDs to human-readable labels and tags
const RESOLUTION_MAP: Record<string, { label: string; tag?: string }> = Object.freeze({
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
 * Sends the current quality and available quality levels back to the content script
 * @param requestId - ID of the request to match response
 */
function sendQualityInfo(requestId: string): void {
  const player = document.getElementById('movie_player') as YouTubePlayer | null;
  if (!player?.getAvailableQualityLevels) {
    // Send empty response if player not available
    document.dispatchEvent(new CustomEvent<QualityResponseEventDetail>('qualityInfoResponse', {
      detail: { requestId, currentQuality: { id: '', label: '' }, availableQualities: [] }
    }));
    return;
  }
  
  try {
    // Get current and available qualities
    const currentQuality = player.getPlaybackQuality();
    const availableQualities = player.getAvailableQualityLevels();
    
    // Format the current quality with its label
    let formattedCurrentQuality: QualityInfo = { id: currentQuality, label: currentQuality };
    if (RESOLUTION_MAP[currentQuality]) {
      formattedCurrentQuality = {
        id: currentQuality,
        label: RESOLUTION_MAP[currentQuality].label,
        ...(RESOLUTION_MAP[currentQuality].tag && { tag: RESOLUTION_MAP[currentQuality].tag })
      };
    }
    
    // Format the available qualities with their labels
    const formattedAvailableQualities: QualityInfo[] = availableQualities.map(q => {
      if (RESOLUTION_MAP[q]) {
        return {
          id: q,
          label: RESOLUTION_MAP[q].label,
          ...(RESOLUTION_MAP[q].tag && { tag: RESOLUTION_MAP[q].tag })
        };
      }
      return { id: q, label: q };
    });
    
    // Send the response
    document.dispatchEvent(new CustomEvent<QualityResponseEventDetail>('qualityInfoResponse', {
      detail: {
        requestId,
        currentQuality: formattedCurrentQuality,
        availableQualities: formattedAvailableQualities
      }
    }));
  } catch (error) {
    console.error('YouTube Quality Shortcut: Error getting quality info', error);
    document.dispatchEvent(new CustomEvent<QualityResponseEventDetail>('qualityInfoResponse', {
      detail: { requestId, currentQuality: { id: '', label: '' }, availableQualities: [] }
    }));
  }
}

/**
 * Change video quality up or down and show visual feedback
 * @param increase - True to increase quality, false to decrease
 */
function changeQuality(increase: boolean): void {
  const player = document.getElementById('movie_player') as YouTubePlayer | null;
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
    
    let newQualityIndex = currentQualityIndex;
    if (increase && currentQualityIndex > 0) {
      newQualityIndex = currentQualityIndex - 1;
    } else if (!increase && currentQualityIndex < qualities.length - 1) {
      newQualityIndex = currentQualityIndex + 1;
    }
    
    const newQuality = qualities[newQualityIndex];
    
    // Update YouTube player with new quality setting if quality is changing
    if (newQuality !== currentQuality) {
      player.setPlaybackQualityRange(newQuality);
    }
    
    // Always show quality change visual feedback, even if quality didn't change
    showQualityChangeIndicator(newQuality);
  } catch (error) {
    console.error('YouTube Quality Shortcut: Error changing quality', error);
  }
}

/**
 * Display on-screen indicator showing the newly selected quality
 * @param quality - The YouTube quality ID
 */
function showQualityChangeIndicator(quality: string): void {
  try {
    const bezelTxtWrapper = document.querySelector('.ytp-bezel-text-wrapper') as HTMLElement | null;
    const bezelTextElement = document.querySelector('.ytp-bezel-text') as HTMLElement | null;
    const wrapperParent = bezelTxtWrapper?.parentNode as HTMLElement | null;
    const bezelTxtIcon = document.querySelector('.ytp-bezel-icon') as HTMLElement | null;
    
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
    qualityChangeTimeoutId = window.setTimeout(() => {
      wrapperParent.style.display = 'none';
      bezelTxtIcon.style.display = 'block';
      qualityChangeTimeoutId = null;
    }, QUALITY_DISPLAY_DURATION);
  } catch (error) {
    console.error('YouTube Quality Shortcut: Error showing indicator', error);
  }
}

/**
 * Sets video quality to either lowest or highest available resolution
 * @param highest - True for highest quality, false for lowest
 */
function setQualityExtreme(highest: boolean): void {
  const player = document.getElementById('movie_player') as YouTubePlayer | null;
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

    // Get current quality to check if we need to change
    const currentQuality = player.getPlaybackQuality();
    
    // Select either the first (highest) or last (lowest) quality
    const newQuality = highest ? qualities[0] : qualities[qualities.length - 1];
    
    // Update YouTube player with new quality setting if quality is changing
    if (newQuality !== currentQuality) {
      player.setPlaybackQualityRange(newQuality);
    }
    
    // Always show quality change visual feedback, even if quality didn't change
    showQualityChangeIndicator(newQuality);
  } catch (error) {
    console.error('YouTube Quality Shortcut: Error setting extreme quality', error);
  }
}

/**
 * Set a specific quality level by its ID
 * @param qualityId - The YouTube quality ID to set
 */
function setSpecificQuality(qualityId: string): void {
  const player = document.getElementById('movie_player') as YouTubePlayer | null;
  if (!player?.getAvailableQualityLevels) {
    console.error('YouTube Quality Shortcut: Player not found or API not available');
    return;
  }
  
  try {
    // Check if requested quality is available
    const availableQualities = player.getAvailableQualityLevels();
    if (!availableQualities.includes(qualityId)) {
      console.warn(`YouTube Quality Shortcut: Requested quality ${qualityId} not available`);
      return;
    }
    
    // Get current quality to check if we need to change
    const currentQuality = player.getPlaybackQuality();
    
    // Update YouTube player with new quality setting if quality is changing
    if (qualityId !== currentQuality) {
      player.setPlaybackQualityRange(qualityId);
    }
    
    // Always show quality change visual feedback, even if quality didn't change
    showQualityChangeIndicator(qualityId);
  } catch (error) {
    console.error('YouTube Quality Shortcut: Error setting specific quality', error);
  }
}