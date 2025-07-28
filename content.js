// content.js

// Inject the script that can access the page's JS context
const s = document.createElement('script');
s.src = chrome.runtime.getURL('injector.js');
s.onload = function() { this.remove(); };
(document.head || document.documentElement).appendChild(s);

// Listen for the event from the page to START recording
window.addEventListener('start-recording-event', () => {
    chrome.runtime.sendMessage({ action: 'startRecording' });
});

// Listen for messages FROM the background script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.action) {
        // When the background confirms recording has started
        case 'recordingStarted':
            window.dispatchEvent(new CustomEvent('recording-started-event'));
            break;
        // When the background confirms recording has stopped
        case 'recordingStoppedCallback':
            window.dispatchEvent(new CustomEvent('recording-stopped-event'));
            break;
    }
    sendResponse({ success: true });
    return true;
});

// Continue to monitor title for SRT subtitles
let lastTitle = document.title;
setInterval(() => {
  const currentTitle = document.title;
  if (currentTitle !== lastTitle) {
    lastTitle = currentTitle;
    chrome.runtime.sendMessage({
      type: "storeTitle",
      title: currentTitle
    });
  }
}, 500);
