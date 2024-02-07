let initialized = false;
async function injectScript(fileURL) {
  new Promise((resolve, reject) => {
    if (initialized) {
      return;
    }
    const body = document.body;
    const script = document.createElement('script');
    script.setAttribute('type', 'text/javascript');
    script.setAttribute('src', fileURL);

    script.onload = resolve;
    script.onerror = reject;

    body.appendChild(script);
    initialized = true
  });
}

chrome.runtime.onMessage.addListener(
  async (request, sender, sendResponse) => {
    console.log('initialized', initialized);
    console.log('request', request);
    if (!initialized) {
      await injectScript(chrome.runtime.getURL('./quality_control.js'));
    }
    let command = { command: request.command };
    let event = new CustomEvent('qualityControlEvent', { detail: command });
    console.log('command', command);
    console.log('event', event);
    document.dispatchEvent(event);
  }
);

