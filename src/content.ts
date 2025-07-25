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

// Types for quality info
interface QualityInfo {
  id: string;
  label: string;
  tag?: string;
}

interface QualityResponse {
  success: boolean;
  currentQuality?: QualityInfo;
  availableQualities?: QualityInfo[];
}

interface NavigatorUserAgentData {
  platform: string;
}

interface ExtendedNavigator extends Navigator {
  userAgentData?: NavigatorUserAgentData;
}

interface ChromeMessage {
  command: string;
  quality?: string;
  tabId?: number;
}

interface ChromeResponse {
  success: boolean;
  currentQuality?: QualityInfo;
  availableQualities?: QualityInfo[];
  newQuality?: QualityInfo;
  error?: string;
}

// OS detection for showing correct keyboard shortcuts
// navigator.platform is deprecated but we provide a fallback
const extendedNavigator = navigator as ExtendedNavigator;
const isMacOS = /Mac/i.test(extendedNavigator.userAgentData?.platform || navigator.platform || '');
const KEYBOARD_SHORTCUTS = Object.freeze({
  qualityDown: isMacOS ? '⌘ + ⇧ + 1' : 'Ctrl + Shift + 1',
  qualityUp: isMacOS ? '⌘ + ⇧ + 2' : 'Ctrl + Shift + 2'
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
        resolve();
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
  console.log(`${EXTENSION_NAME_CONTENT}: Received message:`, request);
  
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
        console.error(`${EXTENSION_NAME_CONTENT}:`, error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  // Handle specific quality setting or other command
  injectControlScript(chrome.runtime.getURL('./dist/control.js'))
    .then(() => {
      // Forward the command to the injected script
      let eventDetail: { command: string; quality?: string } = { command: request.command };
      
      // Add quality parameter for specific quality setting
      if (request.command === 'set_specific_quality' && request.quality) {
        eventDetail.quality = request.quality;
      }
      
      // Map popup commands to control script commands if needed
      if (request.command === 'lowest_quality') {
        eventDetail.command = 'lowest_quality';
      } else if (request.command === 'highest_quality') {
        eventDetail.command = 'highest_quality';
      }
      
      const event = new CustomEvent('controlEvent', { detail: eventDetail });
      document.dispatchEvent(event);
      
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
      console.error(`${EXTENSION_NAME_CONTENT}:`, error);
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
      injectControlScript(chrome.runtime.getURL('./dist/control.js'))
        .then(() => {
          // Create a one-time event to get quality info from the page
          const requestId = Date.now().toString();
          
          // Create a listener for the response
          const qualityInfoListener = (event: CustomEvent): void => {
            if (event.detail && event.detail.requestId === requestId) {
              document.removeEventListener('qualityInfoResponse', qualityInfoListener as EventListener);
              resolve({
                success: true,
                currentQuality: event.detail.currentQuality,
                availableQualities: event.detail.availableQualities
              });
            }
          };
          
          // Add the listener
          document.addEventListener('qualityInfoResponse', qualityInfoListener as EventListener);
          
          // Dispatch request to the injected script
          const event = new CustomEvent('getQualityInfo', { 
            detail: { requestId }
          });
          document.dispatchEvent(event);
          
          // Set a timeout in case the page doesn't respond
          setTimeout(() => {
            document.removeEventListener('qualityInfoResponse', qualityInfoListener as EventListener);
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
    
    const existingSubtitleDiv = generalSection.querySelector(SELECTORS.subTitle);
    const existingOptionsDiv = generalSection.querySelector(SELECTORS.options);
    const existingShortcutOption = existingOptionsDiv?.querySelector(SELECTORS.shortcutOption);
    
    if (!existingSubtitleDiv || !existingOptionsDiv || !existingShortcutOption) return;
    
    // Create our custom section elements
    const fragment = document.createDocumentFragment();
    
    // Create section title
    const customSectionTitle = existingSubtitleDiv.cloneNode(false) as HTMLElement;
    customSectionTitle.textContent = EXTENSION_NAME_CONTENT;
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
    
    // Add options to our custom section
    customOptionsDiv.append(qualityDownOption, qualityUpOption);
    fragment.appendChild(customOptionsDiv);
    
    // Add everything to the dialog in a single DOM update for better performance
    generalSection.appendChild(fragment);
    
  } catch (error) {
    console.error(`${EXTENSION_NAME_CONTENT}: Failed to modify keyboard shortcut guide`, error);
    // Reset the flag so we can try again if the dialog reopens
    shortcutGuideModified = false;
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

// Initialize observers when the content script loads
console.log(`${EXTENSION_NAME_CONTENT}: Content script loaded on`, window.location.href);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', observeYouTubeShortcutDialog);
} else {
  observeYouTubeShortcutDialog();
}