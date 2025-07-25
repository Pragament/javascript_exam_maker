let currentExamId = null;

// Load exam details and questions
async function loadExamQuestions() {
  currentExamId = new URLSearchParams(window.location.search).get('examId');
  if (!currentExamId) {
    window.location.href = 'teacher.html';
    return;
  }

  try {
    // Load exam details
    const examDoc = await db.collection('exams').doc(currentExamId).get();
    if (!examDoc.exists) {
      window.location.href = 'teacher.html';
      return;
    }

    const exam = examDoc.data();
    document.getElementById('exam-title').textContent = `${exam.name} - Questions`;

    // Load questions
    const questionsSnapshot = await db.collection('exams').doc(currentExamId)
      .collection('questions')
      .orderBy('createdAt')
      .get();

    const questionsContainer = document.getElementById('questions-container');
    questionsContainer.innerHTML = '';

    if (questionsSnapshot.empty) {
      questionsContainer.innerHTML = '<p class="no-questions">No questions yet. Add your first question!</p>';
      return;
    }

    questionsSnapshot.forEach(doc => {
      const question = doc.data();
      const questionElement = document.createElement('div');
      questionElement.className = 'card question-card';
      questionElement.innerHTML = `
        <h3>${question.title}</h3>
        <p class="description">${question.description.substring(0, 100)}${question.description.length > 100 ? '...' : ''}</p>
        <div class="question-meta">
          <span class="status ${question.assignedTo ? 'assigned' : 'available'}">
            ${question.assignedTo ? `Assigned to: ${question.assignedTo}` : 'Available'}
          </span>
          <button class="btn-small" onclick="deleteQuestion('${doc.id}')">Delete</button>
        </div>
      `;
      questionsContainer.appendChild(questionElement);
    });

  } catch (error) {
    console.error("Error loading exam questions:", error);
    showError("Failed to load questions. Please try again.");
  }
}

// Add new question
async function addQuestion() {
  const title = document.getElementById('question-title').value.trim();
  const description = document.getElementById('question-description').value.trim();
  const topics = document.getElementById('question-topics').value.trim().split(',').map(t => t.trim());
  const subtopics = document.getElementById('question-subtopics').value.trim().split(',').map(t => t.trim());
  const plan = document.getElementById('question-plan').value.trim();

  if (!title || !description) {
    showError('Title and Description are required');
    return;
  }

  try {
    await db.collection('exams').doc(currentExamId).collection('questions').add({
      title,
      description,
      topics,
      subtopics,
      plan,
      assignedTo: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Clear form
    document.getElementById('question-title').value = '';
    document.getElementById('question-description').value = '';
    document.getElementById('question-topics').value = '';
    document.getElementById('question-subtopics').value = '';
    document.getElementById('question-plan').value = '';

    showSuccess('Question added successfully!');
    loadExamQuestions();
  } catch (error) {
    console.error("Error adding question:", error);
    showError("Failed to add question. Please try again.");
  }
}

// Import questions from CSV
async function importQuestions() {
  const fileInput = document.getElementById('csv-file');
  if (!fileInput.files.length) {
    showError('Please select a CSV file');
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = async function(e) {
    const contents = e.target.result;
    const lines = contents.split('\n').filter(line => line.trim());
    
    // Skip header row if exists
    const startRow = lines[0].toLowerCase().includes('title') ? 1 : 0;
    let importedCount = 0;

    for (let i = startRow; i < lines.length; i++) {
      const [title, description, topics, subtopics, plan] = lines[i].split(',').map(field => field.trim());
      
      if (!title || !description) continue;

      try {
        await db.collection('exams').doc(currentExamId).collection('questions').add({
          title,
          description,
          topics: topics ? topics.split(';').map(t => t.trim()) : [],
          subtopics: subtopics ? subtopics.split(';').map(t => t.trim()) : [],
          plan: plan || '',
          assignedTo: null,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        importedCount++;
      } catch (error) {
        console.error(`Error importing question ${i}:`, error);
      }
    }

    showSuccess(`Successfully imported ${importedCount} questions!`);
    fileInput.value = '';
    loadExamQuestions();
  };

  reader.readAsText(file);
}

// Delete question
async function deleteQuestion(questionId) {
  if (!confirm('Are you sure you want to delete this question?')) return;

  try {
    await db.collection('exams').doc(currentExamId).collection('questions').doc(questionId).delete();
    showSuccess('Question deleted successfully!');
    loadExamQuestions();
  } catch (error) {
    console.error("Error deleting question:", error);
    showError("Failed to delete question. Please try again.");
  }
}

// Helper functions
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'alert error';
  errorDiv.textContent = message;
  document.querySelector('main').prepend(errorDiv);
  setTimeout(() => errorDiv.remove(), 5000);
}

function showSuccess(message) {
  const successDiv = document.createElement('div');
  successDiv.className = 'alert success';
  successDiv.textContent = message;
  document.querySelector('main').prepend(successDiv);
  setTimeout(() => successDiv.remove(), 5000);
}

// Load questions when page loads
document.addEventListener('DOMContentLoaded', loadExamQuestions);