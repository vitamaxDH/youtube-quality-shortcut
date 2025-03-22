/**
 * YouTube Quality Shortcut - Service Worker
 * Handles keyboard commands and tab state changes
 */

// Freeze constants to prevent accidental modification
const ICONS = Object.freeze({
  active: './images/icon_active_32.png',
  inactive: './images/icon_32.png'
});

const YOUTUBE_WATCH_URL = 'youtube.com/watch';
const EXTENSION_NAME = 'YouTube Quality Shortcut';

/**
 * Handles keyboard shortcut commands
 */
chrome.commands.onCommand.addListener((command) => {
  try {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs.length) {
        console.debug(`${EXTENSION_NAME}: No active tabs found`);
        return;
      }
      
      const activeTab = tabs[0];
      if (isYouTubeWatchPage(activeTab.url)) {
        chrome.tabs.sendMessage(
          activeTab.id, 
          { command, tabId: activeTab.id },
          // Optional callback to detect messaging errors
          response => {
            const error = chrome.runtime.lastError;
            if (error) {
              console.debug(`${EXTENSION_NAME}: ${error.message}`);
            }
          }
        );
      }
    });
  } catch (error) {
    console.error(`${EXTENSION_NAME}: Command handler error`, error);
  }
});

/**
 * Updates extension icon based on active URL
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  try {
    // Only process URL changes
    if (!changeInfo.url) return;
    
    const iconPath = isYouTubeWatchPage(changeInfo.url) ? 
      ICONS.active : 
      ICONS.inactive;
      
    chrome.action.setIcon({
      path: iconPath,
      tabId
    }).catch(error => {
      console.debug(`${EXTENSION_NAME}: Icon update error`, error);
    });
  } catch (error) {
    console.error(`${EXTENSION_NAME}: Tab update handler error`, error);
  }
});

/**
 * Checks if a URL is a YouTube video page
 * @param {string} url - URL to check
 * @returns {boolean} True if URL is a YouTube video page
 */
function isYouTubeWatchPage(url) {
  // Fast check for invalid URLs
  if (!url || typeof url !== 'string') return false;
  
  return url.includes(YOUTUBE_WATCH_URL);
}
