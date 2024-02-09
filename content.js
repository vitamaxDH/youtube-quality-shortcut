let initialized = false;

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
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  console.log('request', request);
  await injectScript(chrome.runtime.getURL('./control.js'));
  let command = { command: request.command };
  let event = new CustomEvent('controlEvent', { detail: command });
  document.dispatchEvent(event);
});
