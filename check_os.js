/**
 * Detects OS type and displays appropriate keyboard shortcuts
 * Uses modern API when available, with fallback for older browsers
 */
document.addEventListener('DOMContentLoaded', () => {
  // navigator.userAgentData is the modern replacement for navigator.platform
  // Using a regex test for fallback to handle older browsers
  const isMacOS = /Mac/i.test(navigator.userAgentData?.platform || navigator.platform || '');
  
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
