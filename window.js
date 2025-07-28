// window.js

const stopBtn = document.getElementById("stop");
const statusText = document.getElementById("status");

let streamActive = false;

// Main recording function
(async () => {
    let stream;
    try {
        stream = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: 30 },
            audio: true
        });
        streamActive = true;

        // --- Tell the background script that sharing is active ---
        chrome.runtime.sendMessage({ action: "recordingActuallyStarted" });

        // Handle user clicking the browser's "Stop sharing" button
        stream.getVideoTracks()[0].onended = () => {
             if (streamActive) {
                streamActive = false;
                window.close(); // This triggers onRemoved in background.js
             }
        };
    } catch (err) {
        // User cancelled the prompt or an error occurred
        statusText.textContent = "Sharing cancelled or error occurred.";
        setTimeout(() => window.close(), 2000); // Close window, onRemoved will trigger callback
        return;
    }

    // --- The original recording logic you provided ---
    const recordedChunks = [];
    const subtitleLog = [];
    let lastStoredTitle = "";
    let startTime = Date.now();
    
    // Initialize subtitle tracking
    const { latestTitle } = await chrome.storage.local.get(["latestTitle"]);
    if (latestTitle) {
        subtitleLog.push({ time: 0, title: latestTitle });
        lastStoredTitle = latestTitle;
    }

    // Track title changes
    const titleInterval = setInterval(async () => {
        const now = Date.now() - startTime;
        const { latestTitle } = await chrome.storage.local.get(["latestTitle"]);
        if (latestTitle && latestTitle !== lastStoredTitle) {
            subtitleLog.push({ time: now, title: latestTitle });
            lastStoredTitle = latestTitle;
        }
    }, 500);

    const mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });

    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
        streamActive = false;
        clearInterval(titleInterval);
        statusText.textContent = "Processing video...";
        
        // Save timelapse and SRT file
        handleTimelapseAndSrt(recordedChunks, subtitleLog, startTime);
    };

    mediaRecorder.start();
    stopBtn.disabled = false;
    statusText.textContent = "Recording...";

    // Stop button now just closes the window. The background script handles the rest.
    stopBtn.onclick = () => {
        window.close();
    };

})();


function handleTimelapseAndSrt(chunks, log, recordingStartTime) {
    const totalDuration = Date.now() - recordingStartTime;
    const baseName = `recording-${Date.now()}`;

    const originalBlob = new Blob(chunks, { type: "video/webm" });
    const video = document.createElement("video");
    video.src = URL.createObjectURL(originalBlob);
    video.muted = true;
    video.playbackRate = 30 / 30; // Normal speed for now, adjust as needed

    const canvasStream = video.captureStream();
    const timelapseChunks = [];
    const timelapseRecorder = new MediaRecorder(canvasStream, { mimeType: "video/webm" });

    timelapseRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) timelapseChunks.push(e.data);
    };

    timelapseRecorder.onstop = () => {
        const timelapseBlob = new Blob(timelapseChunks, { type: "video/webm" });
        chrome.downloads.download({
            url: URL.createObjectURL(timelapseBlob),
            filename: `${baseName}-timelapse.webm`,
            saveAs: true
        });

        const srtContent = generateSRT(log, totalDuration);
        const srtBlob = new Blob([srtContent], { type: "text/plain" });
        chrome.downloads.download({
            url: URL.createObjectURL(srtBlob),
            filename: `${baseName}.srt`,
            saveAs: true
        });
    };

    video.onloadedmetadata = async () => {
        try {
            await video.play();
            timelapseRecorder.start();
            video.onended = () => timelapseRecorder.stop();
        } catch (err) {
            console.error("Playback error:", err);
        }
    };
}

function generateSRT(log, totalDuration) {
    const formatTime = (ms) => {
        const d = new Date(ms);
        return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')},${String(d.getUTCMilliseconds()).padStart(3, '0')}`;
    };

    if (log.length === 0) return "";
    let srt = "";
    for (let i = 0; i < log.length; i++) {
        const start = log[i].time;
        const end = (i < log.length - 1) ? log[i + 1].time : totalDuration;
        srt += `${i + 1}\n${formatTime(start)} --> ${formatTime(end)}\n${log[i].title}\n\n`;
    }
    return srt.trim();
}
