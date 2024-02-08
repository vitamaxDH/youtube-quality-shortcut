let initialized = false;

async function injectScript(filePath) {
  if (initialized) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.setAttribute('type', 'text/javascript');
    script.setAttribute('src', filePath);
    script.onload = () => {
      initialized = true;
      resolve();
    };
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  await injectScript(chrome.runtime.getURL('./quality_control.js'));
  let command = { command: request.command };
  let event = new CustomEvent('qualityControlEvent', { detail: command });
  document.dispatchEvent(event);
});
