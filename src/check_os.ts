/**
 * Detects OS type and displays appropriate keyboard shortcuts
 * Uses modern API when available, with fallback for older browsers
 */

interface NavigatorUserAgentData {
  platform: string;
}

interface ExtendedNavigator extends Navigator {
  userAgentData?: NavigatorUserAgentData;
}

interface KeyBinding {
  display: string;
}

document.addEventListener('DOMContentLoaded', async (): Promise<void> => {
  // 1. Fetch data in parallel
  const [commands, storage] = await Promise.all([
    chrome.commands.getAll(),
    chrome.storage.sync.get(['bindings'])
  ]);

  const bindings = storage.bindings || {};

  // 2. Resolve final shortcuts
  // Priority: Custom Binding -> Native Command -> Fallback Text
  const decrease = resolveShortcut(bindings.decreaseQuality, commands, 'decrease_quality', 'Ctrl+Shift+1');
  const increase = resolveShortcut(bindings.increaseQuality, commands, 'increase_quality', 'Ctrl+Shift+2');
  const lowest = resolveShortcut(bindings.lowestQuality, commands, 'lowest_quality', 'Ctrl+Shift+9');
  const highest = resolveShortcut(bindings.highestQuality, commands, 'highest_quality', 'Ctrl+Shift+0');

  // 3. Render
  renderKeys('keys-quality-down', decrease);
  renderKeys('keys-quality-up', increase);
  renderKeys('keys-quality-min', lowest);
  renderKeys('keys-quality-max', highest);

  // Windows hint logic
  const extendedNavigator = navigator as ExtendedNavigator;
  const isMacOS = /Mac/i.test(extendedNavigator.userAgentData?.platform || navigator.platform || '');
  const windowsHint = document.getElementById('windowsHint');

  // Only show hint if we are using defaults and on Windows
  // If user customized keys, they surely know what they set
  const hasCustomBindings = Object.values(bindings).some(b => b !== null);
  if (windowsHint && !isMacOS && !hasCustomBindings) {
    windowsHint.style.display = 'block';
  }
});

function resolveShortcut(customBinding: KeyBinding | null, commands: chrome.commands.Command[], commandName: string, fallback: string): string {
  if (customBinding) {
    return customBinding.display;
  }
  const cmd = commands.find(c => c.name === commandName);
  return cmd?.shortcut || fallback;
}

function renderKeys(containerId: string, shortcut: string) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = ''; // Clear hardcoded content
  appendShortcut(container, shortcut);
}

function appendShortcut(container: HTMLElement, shortcut: string) {
  // Split by '+' or ' ' to make nice <kbd> tags
  // e.g., "Ctrl+Shift+1" -> ["Ctrl", "Shift", "1"]
  // e.g. "Q" -> ["Q"]
  // Handle "Command" specially if needed, but usually it comes as "Command" or "MacCtrl"
  const parts = shortcut.split('+').map(s => s.trim());

  parts.forEach(part => {
    const kbd = document.createElement('kbd');
    // Replace 'Command' with symbol if we want, or keep text
    // Let's use symbol for Mac aesthetic if string is 'Command' or 'MacCtrl'
    if (part === 'Command' || part === 'MacCtrl') {
      kbd.textContent = '⌘';
      kbd.classList.add('mod-key');
    } else if (part === 'Shift') {
      kbd.textContent = '⇧';
    } else {
      kbd.textContent = part;
    }
    container.appendChild(kbd);
  });
}