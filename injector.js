// injector.js

console.log("Injector script loaded. Watching for all question buttons.");

// --- Selectors based on the provided HTML ---
const questionSelectionSelector = "#question-selection";
const questionViewSelector = "#question-view";
const buttonSelector = "button[onclick^='selectQuestion']"; // This selector finds ALL such buttons
const waitingMessageId = "extension-waiting-message";

// --- Logic to hide/show the question ---

function showWaitingMessage() {
    const questionSelection = document.querySelector(questionSelectionSelector);
    if (questionSelection) {
        questionSelection.style.display = 'none';
    }

    const oldMessage = document.getElementById(waitingMessageId);
    if (oldMessage) oldMessage.remove();

    const waitingDiv = document.createElement('div');
    waitingDiv.id = waitingMessageId;
    waitingDiv.innerHTML = `
        <div class="card" style="text-align: center; padding: 40px; border: 2px dashed #ccc;">
            <h2>Waiting for Screen Sharing</h2>
            <p>Please select a screen, window, or tab in the prompt to begin recording and view the question.</p>
            <p>If you cancel, you will be returned to the question list.</p>
        </div>
    `;
    questionSelection.parentNode.insertBefore(waitingDiv, questionSelection);
}

function showQuestionAndRemoveWaiting() {
    const questionView = document.querySelector(questionViewSelector);
    if (questionView) {
        questionView.style.display = 'block'; 
    }
    const waitingMessage = document.getElementById(waitingMessageId);
    if (waitingMessage) {
        waitingMessage.remove();
    }
}

function returnToQuestionSelection() {
    const questionSelection = document.querySelector(questionSelectionSelector);
    if (questionSelection) {
        questionSelection.style.display = 'block';
    }
    const questionView = document.querySelector(questionViewSelector);
    if (questionView) {
        questionView.style.display = 'none';
    }
    const waitingMessage = document.getElementById(waitingMessageId);
    if (waitingMessage) {
        waitingMessage.remove();
    }
}

// --- NEW: Function to find and attach listeners to ALL buttons ---
function attachListenersToAllButtons() {
    // Use querySelectorAll to get a list of every matching button
    const buttons = document.querySelectorAll(buttonSelector);

    // Loop through each button found
    buttons.forEach(button => {
        // Check if we've already added a listener to this specific button
        if (!button.hasAttribute('data-recording-listener-added')) {
            console.log("Found a new 'Select This Question' button. Adding listener.");
            button.setAttribute('data-recording-listener-added', 'true');
            
            button.addEventListener('click', () => {
                showWaitingMessage();
                window.dispatchEvent(new CustomEvent('start-recording-event'));
            });
        }
    });
}


// --- Observer to watch for when buttons are added to the page ---
const observer = new MutationObserver((mutationsList) => {
    // Whenever the page changes, run our function to find and attach listeners.
    // This is more efficient than querying inside the loop.
    attachListenersToAllButtons();
});

// Start observing the entire page for changes
observer.observe(document.body, { childList: true, subtree: true });

// Also run it once at the start, in case the buttons are already there
attachListenersToAllButtons();


// --- Event Listeners for communication with the extension ---

window.addEventListener('recording-started-event', showQuestionAndRemoveWaiting);

window.addEventListener('recording-stopped-event', () => {
    alert("Recording has been stopped. You will now be returned to the questions list.");
    returnToQuestionSelection();
    if (typeof showAvailableQuestions === 'function') {
        showAvailableQuestions();
    }
});
