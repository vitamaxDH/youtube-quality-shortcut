// Quality control constants and state
const QUALITY_ORDER = [
  'highres', // 8K
  'hd2880',  // 5K
  'hd2160',  // 4K
  'hd1440',  // 1440p
  'hd1080',  // 1080p
  'hd720',   // 720p
  'large',   // 480p
  'medium',  // 360p
  'small',   // 240p
  'tiny'     // 144p
];

// Global state
let activeTabId = null;
let availableQualities = [];
let currentQuality = null;
let qualitySliderManuallyChanged = false;
let qualityPollIntervalId = null;
const POLL_INTERVAL = 1000; // Check for quality changes every 1 second

// DOM Elements
const qualitySlider = document.getElementById('qualitySlider');
const currentQualityDisplay = document.getElementById('currentQuality');
const lowestQualityRadio = document.getElementById('lowestQuality');
const highestQualityRadio = document.getElementById('highestQuality');
const statusMessage = document.getElementById('statusMessage');

// Initialize popup
document.addEventListener('DOMContentLoaded', initializePopup);

/**
 * Initialize the popup interface
 */
async function initializePopup() {
  try {
    // Get the current active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      showMessage('No active tab found', 'error');
      return;
    }

    const activeTab = tabs[0];
    activeTabId = activeTab.id;

    // Check if the current page is a YouTube video
    if (!activeTab.url || !activeTab.url.includes('youtube.com/watch')) {
      showMessage('Not a YouTube video page', 'warning');
      disableControls();
      return;
    }

    // Initialize control event listeners
    initializeControls();
    
    // Get quality information from the YouTube player
    getQualityInfo();
    
    // Set up polling to keep quality information up to date
    startQualityPolling();
    
    // Stop polling when popup closes
    window.addEventListener('unload', stopQualityPolling);
  } catch (error) {
    console.error('Error initializing popup:', error);
    showMessage('Failed to initialize controls', 'error');
  }
}

/**
 * Start polling for quality changes
 */
function startQualityPolling() {
  if (qualityPollIntervalId) return; // Already polling
  
  qualityPollIntervalId = setInterval(() => {
    if (activeTabId) {
      refreshQualityInfo();
    }
  }, POLL_INTERVAL);
}

/**
 * Stop polling for quality changes
 */
function stopQualityPolling() {
  if (qualityPollIntervalId) {
    clearInterval(qualityPollIntervalId);
    qualityPollIntervalId = null;
  }
}

/**
 * Refresh quality information without changing the UI status message
 */
function refreshQualityInfo() {
  chrome.tabs.sendMessage(
    activeTabId,
    { command: 'get_quality_info' },
    (response) => {
      const error = chrome.runtime.lastError;
      if (error || !response || !response.success) {
        return; // Silently ignore errors during polling
      }
      
      updateQualityDisplay(response);
    }
  );
}

/**
 * Update the quality display without changing the status message
 */
function updateQualityDisplay(response) {
  if (!response.availableQualities || response.availableQualities.length === 0) {
    return;
  }
  
  // Check if quality has changed
  const newQualityId = response.currentQuality ? response.currentQuality.id : null;
  const oldQualityId = currentQuality ? currentQuality.id : null;
  
  if (newQualityId === oldQualityId) {
    return; // No change in quality
  }
  
  // Store available qualities in order (highest to lowest)
  availableQualities = response.availableQualities
    .filter(q => q.id !== 'auto') // Remove auto quality
    .sort((a, b) => {
      return QUALITY_ORDER.indexOf(a.id) - QUALITY_ORDER.indexOf(b.id);
    });
    
  currentQuality = response.currentQuality;
  
  // Reset manual change flag since this is an external change
  qualitySliderManuallyChanged = false;
  
  // Update UI elements
  setSliderToCurrentQuality();
  updateRadioButtons();
}

/**
 * Initialize control event listeners
 */
function initializeControls() {
  // Slider input event (while dragging)
  qualitySlider.addEventListener('input', handleSliderInput);
  
  // Slider change event (after releasing)
  qualitySlider.addEventListener('change', handleSliderChange);
  
  // Radio button events
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
}

/**
 * Handle slider input (while dragging)
 */
function handleSliderInput() {
  if (!availableQualities.length) return;
  
  qualitySliderManuallyChanged = true;
  updateQualityDisplayFromSlider();
}

/**
 * Handle slider change (after releasing)
 */
function handleSliderChange() {
  if (!availableQualities.length) return;
  
  const selectedIndex = getSelectedQualityIndex();
  const qualityId = availableQualities[selectedIndex]?.id;
  
  if (qualityId) {
    sendCommand('set_specific_quality', { quality: qualityId });
  }
}

/**
 * Get the currently selected quality index based on slider position
 */
function getSelectedQualityIndex() {
  const sliderPercentage = parseFloat(qualitySlider.value);
  
  // Map percentage to available qualities (0 = lowest quality, 100 = highest quality)
  // This is reversed from the previous implementation
  const normalizedPercentage = 100 - sliderPercentage;
  let index = Math.round((normalizedPercentage / 100) * (availableQualities.length - 1));
  
  // Ensure index is within bounds
  index = Math.max(0, Math.min(index, availableQualities.length - 1));
  
  return index;
}

/**
 * Update the quality display based on the current slider position
 */
function updateQualityDisplayFromSlider() {
  if (!availableQualities.length) return;
  
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

/**
 * Get quality information from the YouTube player
 */
function getQualityInfo() {
  chrome.tabs.sendMessage(
    activeTabId,
    { command: 'get_quality_info' },
    (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        console.error('Error getting quality info:', error.message);
        showMessage('Could not retrieve quality information', 'error');
        return;
      }
      
      if (response && response.success) {
        handleQualityInfoResponse(response);
      } else {
        showMessage('Failed to get quality information', 'error');
        disableControls();
      }
    }
  );
}

/**
 * Handle the quality info response from content script
 */
function handleQualityInfoResponse(response) {
  if (!response.availableQualities || response.availableQualities.length === 0) {
    showMessage('No quality levels available', 'warning');
    disableControls();
    return;
  }
  
  // Store available qualities in order (highest to lowest)
  availableQualities = response.availableQualities
    .filter(q => q.id !== 'auto') // Remove auto quality
    .sort((a, b) => {
      return QUALITY_ORDER.indexOf(a.id) - QUALITY_ORDER.indexOf(b.id);
    });
    
  currentQuality = response.currentQuality;
  
  // Enable controls
  enableControls();
  
  // Set slider based on current quality
  setSliderToCurrentQuality();
  
  // Update radio buttons based on current quality
  updateRadioButtons();
  
  // Show ready message
  showMessage('Ready', 'success');
}

/**
 * Set the slider position to match the current quality
 */
function setSliderToCurrentQuality() {
  if (!availableQualities.length || !currentQuality) return;
  
  // Find index of current quality in available qualities
  const currentIndex = availableQualities.findIndex(q => q.id === currentQuality.id);
  
  if (currentIndex >= 0 && !qualitySliderManuallyChanged) {
    // Map index to slider percentage (0 = lowest quality, 100 = highest quality)
    // This is reversed from the previous implementation
    const sliderPercentage = 100 - ((currentIndex / (availableQualities.length - 1)) * 100);
    qualitySlider.value = sliderPercentage;
    
    // Update display
    let qualityText = currentQuality.label;
    if (currentQuality.tag) {
      qualityText += ` <span class="quality-tag">${currentQuality.tag}</span>`;
    }
    currentQualityDisplay.innerHTML = qualityText;
  }
}

/**
 * Update radio button selection based on current quality
 */
function updateRadioButtons() {
  if (!availableQualities.length || !currentQuality) return;
  
  // Check if current quality is highest or lowest
  const isHighest = currentQuality.id === availableQualities[0].id;
  const isLowest = currentQuality.id === availableQualities[availableQualities.length - 1].id;
  
  highestQualityRadio.checked = isHighest;
  lowestQualityRadio.checked = isLowest;
}

/**
 * Enable quality controls
 */
function enableControls() {
  qualitySlider.disabled = false;
  lowestQualityRadio.disabled = false;
  highestQualityRadio.disabled = false;
}

/**
 * Disable quality controls
 */
function disableControls() {
  qualitySlider.disabled = true;
  lowestQualityRadio.disabled = true;
  highestQualityRadio.disabled = true;
  currentQualityDisplay.textContent = 'Not available';
}

/**
 * Send command to content script
 */
function sendCommand(command, params = {}) {
  const message = { command, ...params };
  
  showMessage('Changing quality...', 'info');
  
  chrome.tabs.sendMessage(
    activeTabId,
    message,
    (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        console.error('Error sending command:', error.message);
        showMessage('Error changing quality', 'error');
        return;
      }
      
      if (response && response.success) {
        if (response.newQuality) {
          // Update display with the new quality
          currentQuality = response.newQuality;
          setSliderToCurrentQuality();
          updateRadioButtons();
        }
        
        showMessage('Quality changed successfully', 'success');
        
        // Popup will remain open - removed auto-close functionality
      } else {
        showMessage('Failed to change quality', 'error');
      }
    }
  );
}

/**
 * Show a status message
 */
function showMessage(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.className = 'status-message';
  statusMessage.classList.add(`status-${type}`);
} 