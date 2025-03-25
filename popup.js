/**
 * YouTube Quality Shortcut - Popup Controller
 * Handles quality control button interactions in the extension popup
 */

document.addEventListener('DOMContentLoaded', () => {
  // Button elements
  const decreaseQualityBtn = document.getElementById('decreaseQuality');
  const increaseQualityBtn = document.getElementById('increaseQuality');
  const lowestQualityBtn = document.getElementById('lowestQuality');
  const highestQualityBtn = document.getElementById('highestQuality');
  
  // Add click handlers to all buttons
  decreaseQualityBtn.addEventListener('click', () => sendCommand('decrease_quality'));
  increaseQualityBtn.addEventListener('click', () => sendCommand('increase_quality'));
  lowestQualityBtn.addEventListener('click', () => sendCommand('lowest_quality'));
  highestQualityBtn.addEventListener('click', () => sendCommand('highest_quality'));
  
  // Visual feedback for button clicks
  const buttons = document.querySelectorAll('.button-grid button');
  buttons.forEach(button => {
    button.addEventListener('click', function() {
      // Apply active class for visual feedback
      this.classList.add('active');
      
      // Remove active class after animation completes
      setTimeout(() => {
        this.classList.remove('active');
      }, 200);
    });
  });
  
  // Query for active YouTube tabs to enable/disable buttons
  updateButtonState();
});

/**
 * Sends a command to the active YouTube tab
 * @param {string} command - The command to send
 */
function sendCommand(command) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs.length) return;
    
    const activeTab = tabs[0];
    if (isYouTubeVideoTab(activeTab.url)) {
      chrome.tabs.sendMessage(activeTab.id, { command: command });
      window.close(); // Close popup after sending command for better UX
    }
  });
}

/**
 * Checks if a URL is a YouTube video page
 * @param {string} url - URL to check
 * @returns {boolean} True if URL is a YouTube video page
 */
function isYouTubeVideoTab(url) {
  return url && url.includes('youtube.com/watch');
}

/**
 * Updates button state based on whether an active YouTube tab is present
 */
function updateButtonState() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const buttons = document.querySelectorAll('.button-grid button');
    
    if (!tabs || !tabs.length || !isYouTubeVideoTab(tabs[0].url)) {
      // Disable buttons if not on a YouTube video page
      buttons.forEach(button => {
        button.disabled = true;
        button.title = 'Only works on YouTube video pages';
      });
      
      // Add notice above buttons
      const controlButtons = document.querySelector('.control-buttons');
      const notice = document.createElement('div');
      notice.className = 'notice';
      notice.textContent = 'Navigate to a YouTube video to use these controls';
      controlButtons.insertBefore(notice, controlButtons.firstChild);
    }
  });
} 