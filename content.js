let initialized = false;
let customShortcutGuideAdded = false;

// Function to inject scripts dynamically
async function injectScript(filePath) {
  if (initialized) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.setAttribute('src', filePath);
    script.onload = () => {
      initialized = true;
      resolve();
    };
    script.onerror = () => {
      reject(new Error('Script loading failed.'));
    };
    document.body.appendChild(script);
  });
}

// Listener for messages from the background or popup script
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  await injectScript(chrome.runtime.getURL('./control.js'));
  let command = { command: request.command };
  let event = new CustomEvent('controlEvent', { detail: command });
  document.dispatchEvent(event);
});

// Function to set up the observer on ytd-popup-container
function setupContainerObserver() {
  const container = document.querySelector('ytd-popup-container');
  if (!container) {
    setTimeout(setupContainerObserver, 1000);
    return;
  }

  const observer = new MutationObserver((mutationsList, observer) => {
    for (let mutation of mutationsList) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeName === 'TP-YT-PAPER-DIALOG' && !node.observed) {
            node.observed = true;
            observeTpYtPaperDialog(node);
            observer.disconnect();
          }
        });
      }
    }
  });

  observer.observe(container, {
    childList: true,
    subtree: true
  });
}

async function observeTpYtPaperDialog(element) {
  const tpYtObserverCallback = (mutationsList, observer) => {
    for (let mutation of mutationsList) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
        let displayStyle = window.getComputedStyle(element).display;
        if (!customShortcutGuideAdded && displayStyle !== 'none') {
          customShortcutGuideAdded = true;
          addCustomShortcutGuidance();
          observer.disconnect();
        }
      }
    }
  };

  const tpYtObserver = new MutationObserver(tpYtObserverCallback);
  tpYtObserver.observe(element, {
    attributes: true,
    attributeFilter: ['style']
  });
}

async function addCustomShortcutGuidance() {
  const dialog = document.querySelector('tp-yt-paper-dialog-scrollable');
  const renderers = dialog.querySelectorAll('ytd-hotkey-dialog-section-renderer');
  let subTitleDiv = null;
  let options = null;
  let hotKeyOption = null;
  const render = Array.from(renderers).find(section => {
    subTitleDiv = section.querySelector('div[id="sub-title"]');
    if (subTitleDiv && subTitleDiv.textContent.toLowerCase() === 'general') {
      options = section.querySelector('div[id="options"]');
      hotKeyOption = options.querySelector('ytd-hotkey-dialog-section-option-renderer');
      return true;
    }
    return false;
  });

  if (render && subTitleDiv && options && hotKeyOption) {
    const newSubTitleDiv = subTitleDiv.cloneNode(false);
    const newOptions = options.cloneNode(false);

    const isMac = navigator.userAgent.indexOf('Mac OS X') != -1;
    const downHotKeyCommand = isMac ? '⌘ + ⇧ + 1' : 'Ctrl + Shift + 1';
    const upHotKeyCommand = isMac ? '⌘ + ⇧ + 2' : 'Ctrl + Shift + 2';

    const qualityUpHotKeyOption = await createHotkeyOptions(hotKeyOption, { label: 'Quality Up', hotkey: upHotKeyCommand });
    const qualityDownHotKeyOption = await createHotkeyOptions(hotKeyOption, { label: 'Quality Down', hotkey: downHotKeyCommand });

    // Append the cloned hotKeyOption to the cloned options
    newOptions.appendChild(qualityDownHotKeyOption);
    newOptions.appendChild(qualityUpHotKeyOption);

    // Append the cloned subTitleDiv and options to the original render
    newSubTitleDiv.textContent = 'Youtube Quality Shortcut';

    render.appendChild(newSubTitleDiv);
    render.appendChild(newOptions);
  }
}

async function createHotkeyOptions(originalHotkeyOption, hotkeyCommand) {
  const hotkeyOption = originalHotkeyOption.cloneNode(true);
  const label = hotkeyOption.querySelector('div[id="label"]');
  const hotkey = hotkeyOption.querySelector('div[id="hotkey"]');
  if (label) label.textContent = hotkeyCommand.label;
  if (hotkey) hotkey.textContent = hotkeyCommand.hotkey;
  return hotkeyOption;
}

setupContainerObserver();
