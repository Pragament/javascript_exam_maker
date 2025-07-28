// background.js

let recorderState = {
    windowId: null,
    examTabId: null,
    isStopping: false // Flag to prevent race conditions
};

// Listen for messages from other parts of the extension
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.action) {
        case "startRecording":
            if (recorderState.windowId) {
                chrome.windows.update(recorderState.windowId, { focused: true });
                return true;
            }
            recorderState.examTabId = sender.tab?.id;
            recorderState.isStopping = false; // Reset flag
            chrome.windows.create({
                url: `window.html`,
                type: "popup", width: 500, height: 400
            }, (win) => {
                if (win) recorderState.windowId = win.id;
            });
            break;

        case "recordingActuallyStarted":
            if (recorderState.examTabId) {
                chrome.tabs.sendMessage(recorderState.examTabId, { action: "recordingStarted" });
            }
            break;

        case "stopRecording":
            if (recorderState.windowId && !recorderState.isStopping) {
                recorderState.isStopping = true; // Set flag
                chrome.windows.remove(recorderState.windowId);
            }
            break;
        
        case "storeTitle":
            if (sender.tab?.id) {
                chrome.storage.local.set({ latestTitle: msg.title });
            }
            break;
    }
    sendResponse({success: true});
    return true; 
});

// This is the primary way to handle cleanup and trigger the callback.
chrome.windows.onRemoved.addListener((windowId) => {
    if (recorderState.windowId && recorderState.windowId === windowId) {
        if (recorderState.examTabId) {
             try {
                // This is the callback to the exam page
                chrome.tabs.sendMessage(recorderState.examTabId, { action: "recordingStoppedCallback" });
             } catch (error) {
                console.log("Could not send callback to exam tab, it might be closed.", error);
             }
        }
        // Reset state
        recorderState.windowId = null;
        recorderState.examTabId = null;
        recorderState.isStopping = false;
    }
});
