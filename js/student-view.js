let currentExamId = null;
let rollNumber = null;
let assignedQuestions = []; // Store assigned questions
let currentQuestionId = null; // Track which question is being viewed for answer submission

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
    currentQuestionId = questionId;
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

    // Fetch submitted answer (if any)
    let answerData = null;
    try {
      const answerDoc = await db.collection("exams")
        .doc(currentExamId)
        .collection("questions")
        .doc(currentQuestionId)
        .collection("answers")
        .doc(rollNumber)
        .get();
      if (answerDoc.exists) {
        answerData = answerDoc.data();
      }
    } catch (e) {
      // ignore error, just don't show answer
    }

    // Show question view, hide selection
    document.getElementById("question-selection").style.display = "none";
    document.getElementById("question-view").style.display = "block";

    // Fill answer form with previous answer if exists
    document.getElementById("answer-text").value = answerData && answerData.text ? answerData.text : "";
    document.getElementById("answer-file").value = "";

    // Show submitted answer (if any)
    const statusDiv = document.getElementById("answer-submit-status");
    if (answerData) {
      let html = `<div class="submitted-answer" style="margin-top:10px;">
        <strong>Your Submitted Answer:</strong><br>`;
      if (answerData.text) {
        html += `<div style="white-space:pre-wrap;border:1px solid #ccc;padding:8px;margin:4px 0;">${answerData.text}</div>`;
      }
      if (answerData.csvFileName) {
        html += `<div>CSV File: <a href="#" onclick="downloadSubmittedCSV('${questionId}')">${answerData.csvFileName}</a></div>`;
        html += `<div id="csv-table-container" style="margin-top:10px;"></div>`;
      }
      html += `<div style="font-size:0.9em;color:#888;">Last updated: ${answerData.submittedAt && answerData.submittedAt.toDate ? answerData.submittedAt.toDate().toLocaleString() : ''}</div>`;
      html += `<div style="color:#2d7a2d;">You can update your answer below.</div>`;
      html += `</div>`;
      statusDiv.innerHTML = html;
      statusDiv.className = "";

      // Render CSV as table if present
      if (answerData.csv) {
        renderCSVTable(answerData.csv);
      }
    } else {
      statusDiv.innerHTML = "";
      statusDiv.className = "";
    }
  } catch (error) {
    showError("Failed to load question. Please try again.");
  }
}

// Render CSV string as DataTable
function renderCSVTable(csvString) {
  // Remove previous table if any
  const container = document.getElementById("csv-table-container");
  if (!container) return;
  container.innerHTML = "";

  // Parse CSV (simple split, assumes no quoted commas)
  const rows = csvString.trim().split('\n').map(row => row.split(','));
  if (rows.length === 0) return;

  // Build HTML table
  let tableHtml = `<table id="student-csv-table" class="display" style="width:100%"><thead><tr>`;
  rows[0].forEach(cell => {
    tableHtml += `<th>${cell.trim()}</th>`;
  });
  tableHtml += `</tr></thead><tbody>`;
  for (let i = 1; i < rows.length; i++) {
    tableHtml += `<tr>`;
    rows[i].forEach(cell => {
      tableHtml += `<td>${cell.trim()}</td>`;
    });
    tableHtml += `</tr>`;
  }
  tableHtml += `</tbody></table>`;
  container.innerHTML = tableHtml;

  // Initialize DataTable
  if (window.jQuery && window.jQuery.fn && window.jQuery.fn.DataTable) {
    $('#student-csv-table').DataTable();
  }
}

// Download submitted CSV (if any)
window.downloadSubmittedCSV = async function(questionId) {
  try {
    const answerDoc = await db.collection("exams")
      .doc(currentExamId)
      .collection("questions")
      .doc(questionId)
      .collection("answers")
      .doc(rollNumber)
      .get();
    if (answerDoc.exists && answerDoc.data().csv && answerDoc.data().csvFileName) {
      const blob = new Blob([answerDoc.data().csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = answerDoc.data().csvFileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    }
  } catch (e) {
    showError("Could not download CSV file.");
  }
}

// Add XLSX support for answer upload
// Add this at the top if not already present
// <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
// in your HTML before this script

async function submitAnswer() {
  if (!currentQuestionId) {
    showError("No question selected.");
    return;
  }
  const answerText = document.getElementById("answer-text").value.trim();
  const answerFileInput = document.getElementById("answer-file");
  const statusDiv = document.getElementById("answer-submit-status");

  if (!answerText && (!answerFileInput.files || answerFileInput.files.length === 0)) {
    statusDiv.textContent = "Please enter an answer or upload a file.";
    statusDiv.className = "alert error";
    return;
  }

  statusDiv.textContent = "";
  statusDiv.className = "";

  try {
    let answerData = {};
    if (answerText) {
      answerData.text = answerText;
    }

    if (answerFileInput.files && answerFileInput.files.length > 0) {
      const file = answerFileInput.files[0];
      let fileContent = "";
      let fileName = file.name;
      let isExcel = /\.(xlsx|xls)$/i.test(fileName);

      if (isExcel) {
        // Read Excel file and convert to CSV using SheetJS
        fileContent = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = e => {
            try {
              const data = new Uint8Array(e.target.result);
              const workbook = XLSX.read(data, { type: 'array' });
              const firstSheet = workbook.SheetNames[0];
              const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheet]);
              resolve(csv);
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = reject;
          reader.readAsArrayBuffer(file);
        });
        // Store as CSV
        answerData.csv = fileContent;
        answerData.csvFileName = fileName.replace(/\.(xlsx|xls)$/i, ".csv");
      } else {
        // Read as CSV text
        fileContent = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsText(file);
        });
        answerData.csv = fileContent;
        answerData.csvFileName = fileName;
      }
    }

    answerData.submittedAt = firebase.firestore.FieldValue.serverTimestamp();
    answerData.rollNumber = rollNumber;

    // Save answer under the question's "answers" subcollection, doc id = rollNumber
    await db.collection("exams")
      .doc(currentExamId)
      .collection("questions")
      .doc(currentQuestionId)
      .collection("answers")
      .doc(rollNumber)
      .set(answerData, { merge: true });

    statusDiv.textContent = "Answer submitted successfully!";
    statusDiv.className = "alert success";
    document.getElementById("answer-text").value = "";
    document.getElementById("answer-file").value = "";
  } catch (error) {
    statusDiv.textContent = "Failed to submit answer. Please try again.";
    statusDiv.className = "alert error";
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
