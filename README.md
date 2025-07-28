
---

```markdown
# 🚀 Smart Screen Recorder — Chrome Extension

**Smart Screen Recorder** is a lightweight and effective Chrome extension that enables screen recording, **automatically triggered by web application events**. It is currently integrated with platforms like **javascript_exam_maker**, where it records exam interactions with minimal user input.

---

## ✨ Key Features

### ✅ Web App-Integrated Recording

* 🖱️ **Auto Start on Button Click:**
  * Begins screen recording when the user clicks the "**Select This Question**" button.
* ⏹️ **Auto Callback on Stop:**
  * After stopping the recording from the extension popup, the web app is automatically redirected to the **“Available Questions”** page with a message prompting the user to select the next question.
* 📥 Downloads:
  * A `.webm` screen recording file is downloaded automatically once recording ends.

---

## 📁 Folder Structure

```

Smart-Screen-Recorder/
├── manifest.json            # Chrome extension manifest file
├── background.js            # Background service worker for handling permissions and messaging
├── content.js               # Injected into all pages to handle DOM interaction
├── injector.js              # Site-specific code for javascript\_exam\_maker
├── popup.html / popup.js    # Popup UI to start/stop recording
├── window\.html / window\.js  # Separate recording control window
└── download.png             # Extension icon

````

---

## 🔧 Integration with javascript_exam_maker

This extension is built to work seamlessly with [javascript_exam_maker](https://github.com/your-repo-link).

### 🟢 When user clicks “Select This Question”:

```javascript
document.getElementById('start-question-button').addEventListener('click', () => {
  window.dispatchEvent(new CustomEvent('start-recording-event'));
});
````

### 🛑 When user stops recording from the popup:

The extension fires a callback event:

```javascript
window.addEventListener('recording-stopped-event', () => {
  // Automatically redirect and show prompt
  alert('Recording complete. Redirecting...');
  showAvailableQuestions(); // Custom function defined in your app
});
```

> ✅ `showAvailableQuestions()` is expected to redirect the user and update the interface.

---

## 🧪 Installation & Usage

### 🔄 How to Install (Developer Mode)

1. **Clone or Download** the repository to your local system.
2. Open Chrome and go to: `chrome://extensions/`
3. Toggle **Developer Mode** on (top-right).
4. Click **“Load unpacked”** and select the extension folder.

---

## 🖥️ How to Use (On Integrated Platform)

1. Visit the supported website (e.g., `javascript_exam_maker`)
2. Click the **“Select This Question”** button
3. Grant screen sharing access when prompted
4. Recording begins automatically
5. When done, click the **Stop Recording** button in the extension popup
6. You’ll be redirected to the **Available Questions** page and prompted to select the next question
7. The recorded video will be downloaded automatically

---

## 🔐 Permissions Required

```json
"permissions": [
  "downloads",
  "scripting",
  "activeTab",
  "tabs",
  "storage"
]
```

These permissions are necessary to:

* Capture screen content
* Communicate between web page and extension
* Download the screen recording
* Store user settings if needed

---

## 📄 License

This project is licensed under the **MIT License** — free to use, modify, and distribute.

---

> ℹ️ This extension is currently optimized for **javascript\_exam\_maker**. To make it work with your own site, add the appropriate `dispatchEvent` and `addEventListener` handlers shown above.

```
```
