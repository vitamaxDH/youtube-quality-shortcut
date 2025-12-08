// Popup initialization
console.log('Popup script loaded');

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

import {
  ChromeMessage,
  QualityInfo,
  QualityResponse
} from './types';

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
const qualityMarkers = document.getElementById('quality-markers') as HTMLElement;
const sliderTooltip = document.getElementById('slider-tooltip') as HTMLElement;

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
  // Update slider min/max/step to match available qualities count
  qualitySlider.max = (availableQualities.length - 1).toString();
  qualitySlider.step = '1';

  setSliderToCurrentQuality();
  setSliderToCurrentQuality();
  updateRadioButtons();
  updateQualityMarkers();
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

  // Slider hover events for tooltip
  qualitySlider.addEventListener('mousemove', handleSliderHover);
  qualitySlider.addEventListener('mouseleave', () => {
    sliderTooltip.classList.remove('visible');
  });
}

/**
 * Handle slider hover to show tooltip
 */
function handleSliderHover(e: MouseEvent): void {
  if (!availableQualities.length) return;

  const rect = qualitySlider.getBoundingClientRect();
  const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
  const percent = x / rect.width;

  // Calculate the "step" closer to the mouse
  // Slider values are 0 to max
  const max = parseInt(qualitySlider.max);
  // The 'value' corresponding to this percentage
  // Note: range inputs in browsers might have slight padding for the thumb, 
  // but linear approximation is usually close enough for this UI
  const rawValue = percent * max;
  const roundedValue = Math.round(rawValue);

  // Map back to quality index
  // Logic from getSelectedQualityIndex but inverted
  // index = (availableQualities.length - 1) - sliderValue
  const qualityIndex = (availableQualities.length - 1) - roundedValue;
  const quality = availableQualities[qualityIndex];

  if (quality) {
    // Update tooltip
    let text = quality.label;
    // Add tag if small enough or useful? Maybe just label is cleaner for tooltip
    if (quality.tag && quality.tag !== 'HD') { // Skip generic HD tag in tooltip to save space if needed
      text += ` ${quality.tag}`;
    }
    sliderTooltip.textContent = text;

    // Position tooltip
    // We want it centered on the step position, not just the mouse cursor
    // The step position percent is roundedValue / max
    const stepPercent = (roundedValue / max) * 100;

    // Adjust visual position (thumb width is 16px, so there's an 8px offset area)
    // Standard input range: the value center moves from ~8px to width-8px
    // Simple percentage usually feels slightly off at edges without correction
    // Correction: (percent - 0.5) * thumbWidth * -1 ? 
    // Let's try raw percent first, it's usually fine for small tooltips
    sliderTooltip.style.left = `${stepPercent}%`;

    sliderTooltip.classList.add('visible');
  }
}

/**
 * Setup coffee button event listener
 */
function setupCoffeeButton(): void {
  // Footer button handler
  const coffeeBtn = document.getElementById('coffeeBtn');
  if (coffeeBtn) {
    coffeeBtn.addEventListener('click', (e) => {
      // For native implementation with <a> tag, we might not need this if target="_blank" works
      // but in some extension contexts explicit creation is safer.
      // However, for standard popup, target="_blank" usually works.
      // We will leave the default behavior but ensure it doesn't fail.
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
  const sliderValue = parseInt(qualitySlider.value, 10);

  // Map slider value (0 = lowest, max = highest) to array index (0 = highest, last = lowest)
  // slider 0 -> index length-1
  // slider max -> index 0
  const index = (availableQualities.length - 1) - sliderValue;

  // Ensure index is within bounds
  return Math.max(0, Math.min(index, availableQualities.length - 1));
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
 * Update the datalist markers for the slider
 */
function updateQualityMarkers(): void {
  // Clear existing markers
  qualityMarkers.innerHTML = '';

  if (!availableQualities.length) return;

  // Create markers for each quality level
  // Create markers for each quality level
  for (let i = 0; i < availableQualities.length; i++) {
    const marker = document.createElement('div');
    marker.className = 'marker';
    // Highlight the current quality marker
    const currentIndex = (availableQualities.length - 1) - parseInt(qualitySlider.value);
    if (i === currentIndex) {
      marker.classList.add('active');
    }
    qualityMarkers.appendChild(marker);
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
  // Stop polling once we have successfully received data, as requested
  stopQualityPolling();

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
    // Map array index to slider value
    // Index 0 (highest) -> Slider Max
    // Index Last (lowest) -> Slider 0
    const sliderValue = (availableQualities.length - 1) - currentIndex;
    qualitySlider.value = sliderValue.toString();

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
  // Update tooltip instead of text content to preserve the dot
  if (statusMessage) {
    statusMessage.title = message;
    // Toggle 'connected' class for success state
    statusMessage.classList.toggle('connected', type === 'success');
  }
}