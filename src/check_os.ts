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

document.addEventListener('DOMContentLoaded', (): void => {
  // navigator.userAgentData is the modern replacement for navigator.platform
  // Using a regex test for fallback to handle older browsers
  const extendedNavigator = navigator as ExtendedNavigator;
  const isMacOS = /Mac/i.test(extendedNavigator.userAgentData?.platform || navigator.platform || '');
  
  const windowsShortcutsElement = document.getElementById('windowsShortcuts');
  const macShortcutsElement = document.getElementById('macShortcuts');
  
  // Only proceed if elements exist
  if (!windowsShortcutsElement || !macShortcutsElement) {
    console.error('YouTube Quality Shortcut: Shortcut elements not found');
    return;
  }
  
  // Show appropriate shortcuts based on detected OS
  if (isMacOS) {
    macShortcutsElement.style.display = 'block';
  } else {
    windowsShortcutsElement.style.display = 'block';
  }
});