/**
 * YouTube Quality Shortcut - Content Script
 * 
 * This script runs in the context of YouTube pages and performs two main functions:
 * 1. Injects the quality control script and handles keyboard commands
 * 2. Adds our custom shortcuts to YouTube's keyboard shortcut guide
 */

// Tracking flags
let controlScriptInitialized = false;
let shortcutGuideModified = false;
let dialogObserverActive = false;

import type {
  ChromeMessage,
  ChromeResponse,
  ControlEventDetail,
  QualityResponse,
  QualityResponseEventDetail,
  YoutubeQualityMessage
} from './types';
import { Logger } from './logger';

const logger = new Logger('ContentScript');

const OBS_SOURCE = 'YOUTUBE_QUALITY_EXTENSION_INTERNAL';

// OS detection for showing correct keyboard shortcuts
// navigator.platform is deprecated but we provide a fallback
const extendedNavigator = navigator as ExtendedNavigator;
const isMacOS = /Mac/i.test(extendedNavigator.userAgentData?.platform || navigator.platform || '');
const KEYBOARD_SHORTCUTS = Object.freeze({
  qualityDown: isMacOS ? '⌘ + ⇧ + 1' : 'Ctrl + Shift + 1',
  qualityUp: isMacOS ? '⌘ + ⇧ + 2' : 'Ctrl + Shift + 2',
  lowest: isMacOS ? '⌘ + ⇧ + 9' : 'Ctrl + Shift + 9',
  highest: isMacOS ? '⌘ + ⇧ + 0' : 'Ctrl + Shift + 0'
});

// Constants for selectors and timeouts
const SELECTORS = Object.freeze({
  popupContainer: 'ytd-popup-container',
  dialogElement: 'TP-YT-PAPER-DIALOG',
  dialogScrollable: 'tp-yt-paper-dialog-scrollable',
  sectionRenderer: 'ytd-hotkey-dialog-section-renderer',
  subTitle: 'div[id="sub-title"]',
  options: 'div[id="options"]',
  shortcutOption: 'ytd-hotkey-dialog-section-option-renderer',
  label: 'div[id="label"]',
  hotkey: 'div[id="hotkey"]'
});

const RETRY_DELAY = 1000;
const EXTENSION_NAME_CONTENT = 'YouTube Quality Shortcut';
const CUSTOM_SECTION_CLASS = 'yt-quality-shortcut-section';

/**
 * Dynamically injects the control script into the page
 * @param scriptPath - Path to the script to inject
 * @returns Promise that resolves when script is loaded
 */
interface NavigatorUserAgentData {
  platform: string;
}

interface ExtendedNavigator extends Navigator {
  userAgentData?: NavigatorUserAgentData;
}

/**
 * Dynamically injects the control script into the page
 * @param scriptPath - Path to the script to inject
 * @returns Promise that resolves when script is loaded
 */
async function injectControlScript(scriptPath: string): Promise<void> {
  if (controlScriptInitialized) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    try {
      const script = document.createElement('script');
      script.src = scriptPath;

      // Use modern event listeners with options
      script.addEventListener('load', () => {
        controlScriptInitialized = true;
        // Small delay to ensure the script has fully executed and registered listeners
        setTimeout(resolve, 100);
      }, { once: true });

      script.addEventListener('error', () => {
        reject(new Error(`Failed to load ${EXTENSION_NAME_CONTENT} control script`));
      }, { once: true });

      document.body.appendChild(script);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Listens for keyboard commands from the service worker or popup
 */
chrome.runtime.onMessage.addListener((
  request: ChromeMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: ChromeResponse) => void
): boolean => {
  logger.log(`Received message: ${request.command}`, request);

  // Handle quality info request from popup
  if (request.command === 'get_quality_info') {
    getYouTubeQualityInfo()
      .then(qualityInfo => {
        sendResponse({
          success: true,
          currentQuality: qualityInfo.currentQuality,
          availableQualities: qualityInfo.availableQualities
        });
      })
      .catch(error => {
        logger.error('Failed to get quality info', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  // Handle specific quality setting or other command
  injectControlScript(chrome.runtime.getURL('control.js'))
    .then(() => {
      // Forward the command via postMessage
      const message: YoutubeQualityMessage = {
        source: OBS_SOURCE,
        type: request.command === 'set_specific_quality' ? 'SET_SPECIFIC_QUALITY' :
          request.command === 'lowest_quality' || request.command === 'highest_quality' ? 'SET_EXTREME_QUALITY' :
            'CHANGE_QUALITY',
        payload: {}
      };

      if (request.command === 'set_specific_quality' && request.quality) {
        message.payload = { quality: request.quality };
      } else if (request.command === 'lowest_quality') {
        message.payload = { highest: false };
      } else if (request.command === 'highest_quality') {
        message.payload = { highest: true };
      } else if (request.command === 'increase_quality') {
        message.payload = { increase: true };
      } else if (request.command === 'decrease_quality') {
        message.payload = { increase: false };
      }

      window.postMessage(message, '*');

      // If it's a quality change command, get the new quality after a short delay
      const qualityChangeCommands = ['increase_quality', 'decrease_quality', 'highest_quality', 'lowest_quality', 'set_specific_quality'];

      if (qualityChangeCommands.includes(request.command)) {
        setTimeout(() => {
          getYouTubeQualityInfo()
            .then(qualityInfo => {
              sendResponse({
                success: true,
                newQuality: qualityInfo.currentQuality
              });
            })
            .catch(() => {
              sendResponse({ success: true });
            });
        }, 100);
      } else {
        sendResponse({ success: true });
      }
    })
    .catch(error => {
      logger.error('Control script injection failed', error);
      sendResponse({ success: false, error: error.message });
    });

  // Return true to indicate we'll handle the response asynchronously
  return true;
});

/**
 * Gets the current YouTube video quality information
 * @returns Information about current quality and available qualities
 */
function getYouTubeQualityInfo(): Promise<QualityResponse> {
  return new Promise((resolve, reject) => {
    try {
      // First make sure we've injected the control script
      injectControlScript(chrome.runtime.getURL('control.js'))
        .then(() => {
          // Create a one-time event to get quality info from the page
          const requestId = Date.now().toString();

          // Create a listener for the response via window.message
          const messageListener = (event: MessageEvent): void => {
            if (event.source !== window || event.data?.source !== OBS_SOURCE) return;

            const message = event.data as YoutubeQualityMessage;

            if (message.type === 'QUALITY_INFO_RESPONSE' && message.requestId === requestId) {
              window.removeEventListener('message', messageListener);

              if (message.payload && message.payload.success) {
                resolve({
                  success: true,
                  currentQuality: message.payload.currentQuality,
                  availableQualities: message.payload.availableQualities
                });
              } else {
                resolve({
                  success: false,
                  error: message.payload?.error || 'Unknown error'
                });
              }
            }
          };

          // Add the listener
          window.addEventListener('message', messageListener);

          // Dispatch request via postMessage
          const message: YoutubeQualityMessage = {
            source: OBS_SOURCE,
            type: 'GET_QUALITY_INFO',
            requestId
          };
          window.postMessage(message, '*');

          // Set a timeout in case the page doesn't respond
          setTimeout(() => {
            window.removeEventListener('message', messageListener);
            reject(new Error('Timed out waiting for quality info'));
          }, 1000);
        })
        .catch(error => {
          reject(error);
        });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Sets up mutation observer to detect when YouTube's shortcut dialog opens
 */
function observeYouTubeShortcutDialog(): void {
  if (dialogObserverActive) return;

  const container = document.querySelector(SELECTORS.popupContainer);

  if (!container) {
    // Try again if container isn't ready yet
    setTimeout(observeYouTubeShortcutDialog, RETRY_DELAY);
    return;
  }

  dialogObserverActive = true;

  // Create an observer instance with optimal configuration
  const containerObserver = new MutationObserver((mutations: MutationRecord[]) => {
    for (const { type, addedNodes } of mutations) {
      if (type !== 'childList') continue;

      for (const node of Array.from(addedNodes)) {
        if (node.nodeName === SELECTORS.dialogElement && !(node as any).observed) {
          (node as any).observed = true;
          watchForDialogVisibility(node as HTMLElement);
          containerObserver.disconnect();
          dialogObserverActive = false;
          break;
        }
      }
    }
  });

  // Optimize observer with childList only and no subtree for better performance
  containerObserver.observe(container, {
    childList: true,
    subtree: true
  });
}

/**
 * Watches for the dialog to become visible
 * @param dialogElement - The YouTube shortcut dialog element
 */
function watchForDialogVisibility(dialogElement: HTMLElement): void {
  const styleObserver = new MutationObserver((mutations: MutationRecord[]) => {
    // Use for...of instead of for...in for better performance with arrays
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
        const isVisible = window.getComputedStyle(dialogElement).display !== 'none';

        if (isVisible && !shortcutGuideModified) {
          shortcutGuideModified = true;
          // Wait for DOM to be fully rendered
          requestAnimationFrame(() => {
            addQualityShortcutsToGuide();
            styleObserver.disconnect();
          });
          break;
        }
      }
    }
  });

  styleObserver.observe(dialogElement, {
    attributes: true,
    attributeFilter: ['style']
  });
}

/**
 * Adds our custom shortcuts to YouTube's keyboard shortcut guide
 */
function addQualityShortcutsToGuide(): void {
  try {
    const dialog = document.querySelector(SELECTORS.dialogScrollable);
    if (!dialog) return;

    const sectionRenderers = Array.from(dialog.querySelectorAll(SELECTORS.sectionRenderer) as NodeListOf<Element>);
    if (!sectionRenderers.length) return;

    // Find the "General" section to append our shortcuts
    const generalSection = sectionRenderers.find(section => {
      const titleDiv = section.querySelector(SELECTORS.subTitle);
      return titleDiv?.textContent?.toLowerCase() === 'general';
    });

    if (!generalSection) return;

    // Check if we already added our section to avoid duplicates
    // We check for our specific class to be robust against text changes or duplicates
    if (generalSection.querySelector(`.${CUSTOM_SECTION_CLASS}`)) return;

    // Legacy check: also check for text content in case the class wasn't applied in a previous version
    // or if the DOM state is messy
    const existingCustomTitle = Array.from(generalSection.querySelectorAll(SELECTORS.subTitle))
      .find(el => el.textContent === EXTENSION_NAME_CONTENT);
    if (existingCustomTitle) return;

    const existingSubtitleDiv = generalSection.querySelector(SELECTORS.subTitle);
    const existingOptionsDiv = generalSection.querySelector(SELECTORS.options);
    const existingShortcutOption = existingOptionsDiv?.querySelector(SELECTORS.shortcutOption);

    if (!existingSubtitleDiv || !existingOptionsDiv || !existingShortcutOption) return;

    // Create our custom section elements
    const fragment = document.createDocumentFragment();

    // Create section title
    const customSectionTitle = existingSubtitleDiv.cloneNode(false) as HTMLElement;
    customSectionTitle.textContent = EXTENSION_NAME_CONTENT;
    customSectionTitle.classList.add(CUSTOM_SECTION_CLASS);
    fragment.appendChild(customSectionTitle);

    // Create options container
    const customOptionsDiv = existingOptionsDiv.cloneNode(false) as HTMLElement;

    // Create our shortcut entries
    const qualityUpOption = createShortcutEntry(
      existingShortcutOption as HTMLElement,
      'Quality Up',
      KEYBOARD_SHORTCUTS.qualityUp
    );

    const qualityDownOption = createShortcutEntry(
      existingShortcutOption as HTMLElement,
      'Quality Down',
      KEYBOARD_SHORTCUTS.qualityDown
    );

    const lowestQualityOption = createShortcutEntry(
      existingShortcutOption as HTMLElement,
      'Lowest Quality',
      KEYBOARD_SHORTCUTS.lowest
    );

    const highestQualityOption = createShortcutEntry(
      existingShortcutOption as HTMLElement,
      'Highest Quality',
      KEYBOARD_SHORTCUTS.highest
    );

    // Add options to our custom section
    customOptionsDiv.append(qualityDownOption, qualityUpOption, lowestQualityOption, highestQualityOption);
    fragment.appendChild(customOptionsDiv);

    // Add everything to the dialog in a single DOM update for better performance
    generalSection.appendChild(fragment);

  } catch (error) {
    logger.error('Failed to modify keyboard shortcut guide', error);
    // Do NOT reset the flag. If we failed once, we likely can't succeed cleanly without risking duplicates.
    // Better to have no shortcuts than duplicate/broken ones.
  }
}

/**
 * Creates a keyboard shortcut entry for the YouTube shortcuts dialog
 * @param template - The template element to clone
 * @param labelText - The shortcut description
 * @param hotkeyText - The keyboard shortcut
 * @returns The created shortcut entry
 */
function createShortcutEntry(template: HTMLElement, labelText: string, hotkeyText: string): HTMLElement {
  const shortcutEntry = template.cloneNode(true) as HTMLElement;

  const labelElement = shortcutEntry.querySelector(SELECTORS.label) as HTMLElement;
  const hotkeyElement = shortcutEntry.querySelector(SELECTORS.hotkey) as HTMLElement;

  if (labelElement) labelElement.textContent = labelText;
  if (hotkeyElement) hotkeyElement.textContent = hotkeyText;

  return shortcutEntry;
}

// Keyboard event listener for JS-based shortcuts
document.addEventListener('keydown', (event) => {
  // Ignore if user is typing in an input field
  const target = event.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
    return;
  }

  // Check for modifier keys
  const isCmdOrCtrl = isMacOS ? event.metaKey : event.ctrlKey;
  if (!isCmdOrCtrl || !event.shiftKey) {
    return;
  }

  let command: string | null = null;
  let payload: any = {};

  switch (event.code) {
    case 'Digit1':
      command = 'decrease_quality'; // Shift+Cmd+1
      payload = { increase: false };
      break;
    case 'Digit2':
      command = 'increase_quality'; // Shift+Cmd+2
      payload = { increase: true };
      break;
    case 'Digit9':
      command = 'lowest_quality'; // Shift+Cmd+9
      payload = { highest: false };
      break;
    case 'Digit0':
      command = 'highest_quality'; // Shift+Cmd+0
      payload = { highest: true };
      break;
  }

  if (command) {
    logger.log(`JS Shortcut detected: ${command}`);

    // Prevent default browser behavior
    event.preventDefault();
    event.stopPropagation();

    // Re-use the logic from onMessage handler to send postMessage to control.js
    // We can manually dispatch the message
    injectControlScript(chrome.runtime.getURL('control.js'))
      .then(() => {
        const message: YoutubeQualityMessage = {
          source: OBS_SOURCE,
          type: command === 'lowest_quality' || command === 'highest_quality' ? 'SET_EXTREME_QUALITY' : 'CHANGE_QUALITY',
          payload: payload
        };

        window.postMessage(message, '*');
      })
      .catch(error => {
        logger.error('Failed to handle JS shortcut', error);
      });
  }
});

// Initialize observers when the content script loads
logger.log(`Content script loaded on ${window.location.href}`);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', observeYouTubeShortcutDialog);
} else {
  observeYouTubeShortcutDialog();
}