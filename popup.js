// popup.js

document.getElementById("start").addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "startRecording" });
});

document.getElementById("stopShare").addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "stopRecording" }, (res) => {
        if (chrome.runtime.lastError) {
            alert("An error occurred. The recorder might already be closed.");
        } else if (res?.success) {
            alert("Recording stop signal sent.");
        } else {
            alert(res?.message || "No active recording to stop.");
        }
    });
});

document.getElementById("settings-icon").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
});
