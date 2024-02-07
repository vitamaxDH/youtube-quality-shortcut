chrome.commands.onCommand.addListener(function (command) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    console.log('hello');
    if (tabs.length > 0 && tabs[0].url.includes('youtube.com/watch')) {
      chrome.tabs.sendMessage(tabs[0].id, { command: command, tabId: tabs[0].id });
    }
  });
});