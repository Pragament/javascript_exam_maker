let currentExamId = null;
let rollNumber = null;
let assignedQuestions = []; // Store assigned questions

// Load student view
async function loadStudentView() {
  const urlParams = new URLSearchParams(window.location.search);
  currentExamId = urlParams.get("examId");
  rollNumber = localStorage.getItem("rollNumber");

  if (!currentExamId) {
    window.location.href = "index.html";
    return;
  }

  await showAssignedQuestions();
  await showAvailableQuestions();
}

// Show assigned questions (multiple)
async function showAssignedQuestions() {
  try {
    const assignedSnapshot = await db
      .collection("exams")
      .doc(currentExamId)
      .collection("questions")
      .where('assignedTo', '==', rollNumber)
      .get();

    assignedQuestions = [];
    const assignedContainer = document.getElementById("assigned-questions-container");
    if (assignedContainer) assignedContainer.innerHTML = "";

    if (assignedSnapshot.empty) {
      if (assignedContainer) {
        assignedContainer.innerHTML = '<p class="no-questions">No questions assigned to you yet.</p>';
      }
      return;
    }

    assignedSnapshot.forEach((doc) => {
      const question = doc.data();
      assignedQuestions.push({ id: doc.id, ...question });
      if (assignedContainer) {
        const questionElement = document.createElement("div");
        questionElement.className = "card question-card";
        questionElement.innerHTML = `
          <h3>${question.title}</h3>
          <p class="description">${question.description.substring(0, 100)}${question.description.length > 100 ? "..." : ""}</p>
          <button class="btn-secondary" onclick="showQuestionDetails('${doc.id}')">View Details</button>
          <button class="btn-danger" onclick="unassignSelf('${doc.id}')">Unassign</button>
        `;
        assignedContainer.appendChild(questionElement);
      }
    });
  } catch (error) {
    console.error("Error loading assigned questions:", error);
    showError("Failed to load assigned questions. Please try again.");
  }
}

// Show available questions (allow multi-select)
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

    // Multi-select checkboxes
    questionsSnapshot.forEach((doc) => {
      const question = doc.data();
      const questionElement = document.createElement("div");
      questionElement.className = "card question-card";
      questionElement.innerHTML = `
        <input type="checkbox" class="assign-checkbox" value="${doc.id}" style="margin-right:8px;">
        <h3>${question.title}</h3>
        <p class="description">${question.description.substring(0, 100)}${question.description.length > 100 ? "..." : ""}</p>
      `;
      questionsContainer.appendChild(questionElement);
    });

    // Add assign button
    const assignBtn = document.createElement("button");
    assignBtn.className = "btn-primary";
    assignBtn.textContent = "Assign Selected Questions";
    assignBtn.onclick = assignSelectedQuestions;
    questionsContainer.appendChild(assignBtn);

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

// Assign selected available questions to student
async function assignSelectedQuestions() {
  const checkboxes = document.querySelectorAll('.assign-checkbox:checked');
  if (checkboxes.length === 0) {
    showError("Please select at least one question to assign.");
    return;
  }
  try {
    const batch = db.batch();
    checkboxes.forEach(cb => {
      const qid = cb.value;
      const ref = db.collection("exams").doc(currentExamId).collection("questions").doc(qid);
      batch.update(ref, { assignedTo: rollNumber });
    });
    await batch.commit();
    showSuccess("Questions assigned successfully!");
    await showAssignedQuestions();
    await showAvailableQuestions();
  } catch (error) {
    showError("Failed to assign questions. Please try again.");
  }
}

// Unassign self from a question
async function unassignSelf(questionId) {
  try {
    await db.collection("exams").doc(currentExamId).collection("questions").doc(questionId).update({
      assignedTo: null
    });
    window.sessionStorage.setItem('unassignedStatus', '1');
    await showAssignedQuestions();
    await showAvailableQuestions();
  } catch (error) {
    showError("Failed to unassign yourself. Please try again.");
  }
}

// Show details for a specific assigned question
async function showQuestionDetails(questionId) {
  try {
    const questionDoc = await db
      .collection("exams")
      .doc(currentExamId)
      .collection("questions")
      .doc(questionId)
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

    // Show question view, hide selection
    document.getElementById("question-selection").style.display = "none";
    document.getElementById("question-view").style.display = "block";
  } catch (error) {
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

function showSuccess(message) {
  const successDiv = document.createElement("div");
  successDiv.className = "alert success";
  successDiv.textContent = message;
  document.querySelector("main").prepend(successDiv);
  setTimeout(() => successDiv.remove(), 5000);
}

// Load view when page loads
document.addEventListener("DOMContentLoaded", loadStudentView);
