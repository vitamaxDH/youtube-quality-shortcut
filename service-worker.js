chrome.commands.onCommand.addListener(function (command) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs.length > 0 && tabs[0].url.includes('youtube.com/watch')) {
      chrome.tabs.sendMessage(tabs[0].id, { command: command, tabId: tabs[0].id });
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
      if (changeInfo.url.includes('youtube.com/watch')) {
          chrome.action.setIcon({
              path: './images/icon_active_32.png',
              tabId: tabId
            });
          } else {
            chrome.action.setIcon({
              path: './images/icon_32.png',
              tabId: tabId
          });
      }
  }
});
