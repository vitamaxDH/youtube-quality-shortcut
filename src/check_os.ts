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

  const modKeyElements = document.querySelectorAll('.mod-key');
  const modKey = isMacOS ? '⌘' : 'Ctrl';

  modKeyElements.forEach(el => {
    el.textContent = modKey;
    el.style.display = 'inline-block';
  });

  // Windows hint logic if needed (currently hidden by CSS default)
  const windowsHint = document.getElementById('windowsHint');
  if (windowsHint && !isMacOS) {
    windowsHint.style.display = 'block';
  }
});