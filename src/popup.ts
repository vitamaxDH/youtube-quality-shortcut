// Load PicoCSS dynamically to avoid CSP violations
const picoPreload = document.getElementById('picocss-preload') as HTMLLinkElement;
if (picoPreload) {
    picoPreload.addEventListener('load', function handlePicoLoad() {
        picoPreload.removeEventListener('load', handlePicoLoad);
        picoPreload.rel = 'stylesheet';
    });
}

// Quality control constants and state
const QUALITY_ORDER: readonly string[] = [
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

// Types
interface QualityInfo {
  id: string;
  label: string;
  tag?: string;
}

interface QualityResponse {
  success: boolean;
  currentQuality?: QualityInfo;
  availableQualities?: QualityInfo[];
  newQuality?: QualityInfo;
  error?: string;
}

interface ChromeMessage {
  command: string;
  quality?: string;
}

type MessageType = 'info' | 'success' | 'error' | 'warning';

// Global state
let activeTabId: number | null = null;
let availableQualities: QualityInfo[] = [];
let currentQuality: QualityInfo | null = null;
let qualitySliderManuallyChanged = false;
let qualityPollIntervalId: number | null = null;
const POLL_INTERVAL = 1000; // Check for quality changes every 1 second

// DOM Elements
const qualitySlider = document.getElementById('qualitySlider') as HTMLInputElement;
const currentQualityDisplay = document.getElementById('currentQuality') as HTMLElement;
const lowestQualityRadio = document.getElementById('lowestQuality') as HTMLInputElement;
const highestQualityRadio = document.getElementById('highestQuality') as HTMLInputElement;
const statusMessage = document.getElementById('statusMessage') as HTMLElement;

// Initialize popup
document.addEventListener('DOMContentLoaded', initializePopup);

/**
 * Initialize the popup interface
 */
async function initializePopup(): Promise<void> {
  try {
    // Get the current active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      showMessage('No active tab found', 'error');
      return;
    }

    const activeTab = tabs[0];
    activeTabId = activeTab.id!;

    // Check if the current page is a YouTube video
    if (!activeTab.url || !(activeTab.url.includes('youtube.com/watch') || activeTab.url.includes('www.youtube.com/watch'))) {
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
function startQualityPolling(): void {
  if (qualityPollIntervalId) return; // Already polling
  
  qualityPollIntervalId = window.setInterval(() => {
    if (activeTabId) {
      refreshQualityInfo();
    }
  }, POLL_INTERVAL);
}

/**
 * Stop polling for quality changes
 */
function stopQualityPolling(): void {
  if (qualityPollIntervalId) {
    clearInterval(qualityPollIntervalId);
    qualityPollIntervalId = null;
  }
}

/**
 * Refresh quality information without changing the UI status message
 */
function refreshQualityInfo(): void {
  if (!activeTabId) return;
  
  chrome.tabs.sendMessage(
    activeTabId,
    { command: 'get_quality_info' },
    (response: QualityResponse) => {
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
function updateQualityDisplay(response: QualityResponse): void {
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
    
  currentQuality = response.currentQuality || null;
  
  // Reset manual change flag since this is an external change
  qualitySliderManuallyChanged = false;
  
  // Update UI elements
  setSliderToCurrentQuality();
  updateRadioButtons();
}

/**
 * Initialize control event listeners
 */
function initializeControls(): void {
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
  
  // Coffee button event
  setupCoffeeButton();
}

/**
 * Setup coffee button event listener
 */
function setupCoffeeButton(): void {
  const coffeeBtn = document.getElementById('coffeeBtn');
  if (coffeeBtn) {
    coffeeBtn.addEventListener('click', () => {
      // Open Buy Me a Coffee page in new tab
      window.open('https://buymeacoffee.com/vitamaxdh', '_blank');
    });
  }
}

/**
 * Handle slider input (while dragging)
 */
function handleSliderInput(): void {
  if (!availableQualities.length) return;
  
  qualitySliderManuallyChanged = true;
  updateQualityDisplayFromSlider();
}

/**
 * Handle slider change (after releasing)
 */
function handleSliderChange(): void {
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
function getSelectedQualityIndex(): number {
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
function updateQualityDisplayFromSlider(): void {
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
function getQualityInfo(): void {
  if (!activeTabId) return;
  
  chrome.tabs.sendMessage(
    activeTabId,
    { command: 'get_quality_info' },
    (response: QualityResponse) => {
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
function handleQualityInfoResponse(response: QualityResponse): void {
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
    
  currentQuality = response.currentQuality || null;
  
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
function setSliderToCurrentQuality(): void {
  if (!availableQualities.length || !currentQuality) return;
  
  // Find index of current quality in available qualities
  const currentIndex = availableQualities.findIndex(q => q.id === currentQuality!.id);
  
  if (currentIndex >= 0 && !qualitySliderManuallyChanged) {
    // Map index to slider percentage (0 = lowest quality, 100 = highest quality)
    // This is reversed from the previous implementation
    const sliderPercentage = 100 - ((currentIndex / (availableQualities.length - 1)) * 100);
    qualitySlider.value = sliderPercentage.toString();
    
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
function updateRadioButtons(): void {
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
function enableControls(): void {
  qualitySlider.disabled = false;
  lowestQualityRadio.disabled = false;
  highestQualityRadio.disabled = false;
}

/**
 * Disable quality controls
 */
function disableControls(): void {
  qualitySlider.disabled = true;
  lowestQualityRadio.disabled = true;
  highestQualityRadio.disabled = true;
  currentQualityDisplay.textContent = 'Not available';
}

/**
 * Send command to content script
 */
function sendCommand(command: string, params: Record<string, any> = {}): void {
  if (!activeTabId) return;
  
  const message: ChromeMessage = { command, ...params };
  
  showMessage('Changing quality...', 'info');
  
  chrome.tabs.sendMessage(
    activeTabId,
    message,
    (response: QualityResponse) => {
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
function showMessage(message: string, type: MessageType = 'info'): void {
  statusMessage.textContent = message;
  statusMessage.className = 'status-message';
  statusMessage.classList.add(`status-${type}`);
}