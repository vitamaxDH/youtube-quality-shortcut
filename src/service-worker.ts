/**
 * YouTube Quality Shortcut - Service Worker
 * Handles keyboard commands and tab state changes
 */

// Freeze constants to prevent accidental modification
const ICONS = Object.freeze({
  active: './images/icon_active_32.png',
  inactive: './images/icon_32.png'
});

const YOUTUBE_WATCH_PATTERNS = ['youtube.com/watch', 'www.youtube.com/watch'];
const EXTENSION_NAME_SW = 'YouTube Quality Shortcut';
import { ChromeMessage } from './types';

/**
 * Handles keyboard shortcut commands
 */
chrome.commands.onCommand.addListener((command: string): void => {
  try {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]): void => {
      if (!tabs || !tabs.length) {
        console.debug(`${EXTENSION_NAME_SW}: No active tabs found`);
        return;
      }

      const activeTab = tabs[0];
      if (isYouTubeWatchPage(activeTab.url)) {
        const message: ChromeMessage = { command, ...(activeTab.id && { tabId: activeTab.id }) };
        chrome.tabs.sendMessage(
          activeTab.id!,
          message,
          // Optional callback to detect messaging errors
          (): void => {
            const error = chrome.runtime.lastError;
            if (error) {
              console.debug(`${EXTENSION_NAME_SW}: ${error.message}`);
            }
          }
        );
      }
    });
  } catch (error) {
    console.error(`${EXTENSION_NAME_SW}: Command handler error`, error);
  }
});

/**
 * Updates extension icon based on active URL
 */
chrome.tabs.onUpdated.addListener((tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab): void => {
  try {
    // Check tab.url instead of changeInfo.url to ensure we catch all updates
    if (!tab.url) return;

    const iconPath = isYouTubeWatchPage(tab.url) ?
      ICONS.active :
      ICONS.inactive;

    chrome.action.setIcon({
      path: iconPath,
      tabId
    }).catch((error: Error): void => {
      console.debug(`${EXTENSION_NAME_SW}: Icon update error`, error);
    });
  } catch (error) {
    console.error(`${EXTENSION_NAME_SW}: Tab update handler error`, error);
  }
});

/**
 * Checks if a URL is a YouTube video page
 * @param url - URL to check
 * @returns True if URL is a YouTube video page
 */
function isYouTubeWatchPage(url?: string): boolean {
  // Fast check for invalid URLs
  if (!url || typeof url !== 'string') return false;

  return YOUTUBE_WATCH_PATTERNS.some(pattern => url.includes(pattern));
}