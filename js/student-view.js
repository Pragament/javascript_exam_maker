let currentExamId = null;
let currentQuestionId = null;
let rollNumber = null;

// Load student view
async function loadStudentView() {
  const urlParams = new URLSearchParams(window.location.search);
  currentExamId = urlParams.get('examId');
  currentQuestionId = urlParams.get('questionId');
  rollNumber = localStorage.getItem('rollNumber');

  if (!currentExamId) {
    window.location.href = 'index.html';
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
    const questionsSnapshot = await db.collection('exams').doc(currentExamId)
      .collection('questions')
      .where('assignedTo', '==', null)
      .get();

    const questionsContainer = document.getElementById('questions-container');
    questionsContainer.innerHTML = '';

    if (questionsSnapshot.empty) {
      questionsContainer.innerHTML = '<p class="no-questions">No available questions at this time.</p>';
      return;
    }

    questionsSnapshot.forEach(doc => {
      const question = doc.data();
      const questionElement = document.createElement('div');
      questionElement.className = 'card question-card';
      questionElement.innerHTML = `
        <h3>${question.title}</h3>
        <p class="description">${question.description.substring(0, 100)}${question.description.length > 100 ? '...' : ''}</p>
        <button class="btn-primary" onclick="selectQuestion('${doc.id}')">Select This Question</button>
      `;
      questionsContainer.appendChild(questionElement);
    });

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
    const questionRef = db.collection('exams').doc(currentExamId).collection('questions').doc(questionId);
    
    // Use transaction to ensure atomic update
    await db.runTransaction(async (transaction) => {
      const questionDoc = await transaction.get(questionRef);
      if (!questionDoc.exists || questionDoc.data().assignedTo !== null) {
        throw "Question no longer available";
      }
      transaction.update(questionRef, { assignedTo: rollNumber });
    });

    // Show the selected question
    currentQuestionId = questionId;
    await showQuestion();

  } catch (error) {
    console.error("Error selecting question:", error);
    showError("This question is no longer available. Please select another one.");
    await showAvailableQuestions();
  }
}

// Show assigned question
async function showQuestion() {
  try {
    const questionDoc = await db.collection('exams').doc(currentExamId)
      .collection('questions').doc(currentQuestionId).get();

    if (!questionDoc.exists) {
      showError("Question not found");
      return;
    }

    const question = questionDoc.data();
    const questionDetails = document.getElementById('question-details');
    questionDetails.innerHTML = `
      <h3>${question.title}</h3>
      <div class="question-section">
        <h4>Description</h4>
        <p>${question.description}</p>
      </div>
      ${question.topics && question.topics.length ? `
      <div class="question-section">
        <h4>Topics</h4>
        <ul>${question.topics.map(topic => `<li>${topic}</li>`).join('')}</ul>
      </div>
      ` : ''}
      ${question.subtopics && question.subtopics.length ? `
      <div class="question-section">
        <h4>Subtopics</h4>
        <ul>${question.subtopics.map(subtopic => `<li>${subtopic}</li>`).join('')}</ul>
      </div>
      ` : ''}
      ${question.plan ? `
      <div class="question-section">
        <h4>Plan/Guidelines</h4>
        <p>${question.plan}</p>
      </div>
      ` : ''}
    `;

    // Hide selection and show question
    document.getElementById('question-selection').style.display = 'none';
    document.getElementById('question-view').style.display = 'block';

  } catch (error) {
    console.error("Error loading question:", error);
    showError("Failed to load question. Please try again.");
  }
}

// Helper function
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'alert error';
  errorDiv.textContent = message;
  document.querySelector('main').prepend(errorDiv);
  setTimeout(() => errorDiv.remove(), 5000);
}

// Load view when page loads
document.addEventListener('DOMContentLoaded', loadStudentView);