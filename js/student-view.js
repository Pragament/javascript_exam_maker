let currentExamId = null;
let currentQuestionId = null;
let rollNumber = null;

// Load student view
async function loadStudentView() {
  const urlParams = new URLSearchParams(window.location.search);
  currentExamId = urlParams.get("examId");
  currentQuestionId = urlParams.get("questionId");
  rollNumber = localStorage.getItem("rollNumber");

  if (!currentExamId) {
    window.location.href = "index.html";
    return;
  }

  if (currentQuestionId) {
    // Show assigned question
    await showQuestion();
    return;
  }

  // Show available questions
  await showAvailableQuestions();
}

// Show available questions
async function showAvailableQuestions() {
  try {
    const questionsSnapshot = await db
      .collection("exams")
      .doc(currentExamId)
      .collection("questions")
      .where('assignedTo', '==', null)
      .where('published', '==', true)
      .get();

    const questionsContainer = document.getElementById("questions-container");
    questionsContainer.innerHTML = "";

    if (questionsSnapshot.empty) {
      questionsContainer.innerHTML =
        '<p class="no-questions">No available questions at this time.</p>';
      return;
    }

    questionsSnapshot.forEach((doc) => {
      const question = doc.data();
      const questionElement = document.createElement("div");
      questionElement.className = "card question-card";
      questionElement.innerHTML = `
        <h3>${question.title}</h3>
        <p class="description">${question.description.substring(
          0,
          100
        )}${question.description.length > 100 ? "..." : ""}</p>
        <button class="btn-primary" onclick="selectQuestion('${
          doc.id
        }')">Select This Question</button>
      `;
      questionsContainer.appendChild(questionElement);
    });
    // Show status message if redirected here after unassign
    if (window.sessionStorage.getItem('unassignedStatus')) {
      showSuccess('You have been unassigned from your previous question.');
      window.sessionStorage.removeItem('unassignedStatus');
    }
  } catch (error) {
    console.error("Error loading questions:", error);
    showError("Failed to load questions. Please try again.");
  }
}

// Student selects a question
async function selectQuestion(questionId) {
  if (!rollNumber) {
    showError("Roll number not found. Please enter the exam again.");
    return;
  }

  try {
    const questionRef = db
      .collection("exams")
      .doc(currentExamId)
      .collection("questions")
      .doc(questionId);

    // Use transaction to ensure atomic update
    await db.runTransaction(async (transaction) => {
      const questionDoc = await transaction.get(questionRef);
      if (
        !questionDoc.exists ||
        (questionDoc.data().assignedTo &&
          questionDoc.data().assignedTo !== rollNumber)
      ) {
        throw "Question no longer available";
      }
      transaction.update(questionRef, { assignedTo: rollNumber });
    });

    // Show the selected question
    currentQuestionId = questionId;
    await showQuestion();

    // ✅ Tell the extension to start recording (direct extension message)
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: "START_SCREEN_RECORDING" });
    } else {
      console.warn("Chrome runtime not available — running in standalone mode.");
    }
  } catch (error) {
    console.error("Error selecting question:", error);
    showError(
      "This question is no longer available. Please select another one."
    );
    await showAvailableQuestions();
  }
}

// Show assigned question
async function showQuestion() {
  try {
    const questionDoc = await db
      .collection("exams")
      .doc(currentExamId)
      .collection("questions")
      .doc(currentQuestionId)
      .get();

    if (!questionDoc.exists) {
      showError("Question not found");
      return;
    }

    const question = questionDoc.data();
    const questionDetails = document.getElementById("question-details");
    questionDetails.innerHTML = `
      <h3>${question.title}</h3>
      <div class="question-section">
        <h4>Description</h4>
        <p>${question.description}</p>
      </div>
      ${
        question.topics && question.topics.length
          ? `
      <div class="question-section">
        <h4>Topics</h4>
        <ul>${question.topics
          .map((topic) => `<li>${topic}</li>`)
          .join("")}</ul>
      </div>
      `
          : ""
      }
      ${
        question.subtopics && question.subtopics.length
          ? `
      <div class="question-section">
        <h4>Subtopics</h4>
        <ul>${question.subtopics
          .map((subtopic) => `<li>${subtopic}</li>`)
          .join("")}</ul>
      </div>
      `
          : ""
      }
      ${
        question.plan
          ? `
      <div class="question-section">
        <h4>Plan/Guidelines</h4>
        <p>${question.plan}</p>
      </div>
      `
          : ""
      }
    `;

    // Hide selection and show question
    document.getElementById("question-selection").style.display = "none";
    document.getElementById("question-view").style.display = "block";
  } catch (error) {
    console.error("Error loading question:", error);
    showError("Failed to load question. Please try again.");
  }
}

// Helper function
function showError(message) {
  const errorDiv = document.createElement("div");
  errorDiv.className = "alert error";
  errorDiv.textContent = message;
  document.querySelector("main").prepend(errorDiv);
  setTimeout(() => errorDiv.remove(), 5000);
}

// Optionally, if you want to allow students to unassign themselves, you could add a function like this:
// (Not required unless you want students to unassign themselves.)
// async function unassignSelf() {
//   try {
//     await db.collection("exams").doc(currentExamId).collection("questions").doc(currentQuestionId).update({
//       assignedTo: null
//     });
//     window.sessionStorage.setItem('unassignedStatus', '1');
//     window.location.href = window.location.pathname + '?examId=' + encodeURIComponent(currentExamId);
//   } catch (error) {
//     showError("Failed to unassign yourself. Please try again.");
//   }
// }

function showSuccess(message) {
  const successDiv = document.createElement("div");
  successDiv.className = "alert success";
  successDiv.textContent = message;
  document.querySelector("main").prepend(successDiv);
  setTimeout(() => successDiv.remove(), 5000);
}

// Load view when page loads
document.addEventListener("DOMContentLoaded", loadStudentView);
