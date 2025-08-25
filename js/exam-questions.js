let currentExamId = null;
let cachedQuestions = []; // Store questions for table view
let tableSort = { field: 'title', dir: 'asc' }; // Default sort

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

    // Clear old containers
    const questionsContainer = document.getElementById('questions-container');
    if (questionsContainer) questionsContainer.innerHTML = '';
    const byStudentContainer = document.getElementById('questions-by-student-container');
    if (byStudentContainer) byStudentContainer.innerHTML = '';

    if (questionsSnapshot.empty) {
      if (byStudentContainer) {
        byStudentContainer.innerHTML = '<p class="no-questions">No questions yet. Add your first question!</p>';
      }
      return;
    }

    // Group questions by assignedTo
    const grouped = {};
    cachedQuestions = []; // Reset cache
    questionsSnapshot.forEach(doc => {
      const question = doc.data();
      const assigned = question.assignedTo || 'Unassigned';
      if (!grouped[assigned]) grouped[assigned] = [];
      grouped[assigned].push({ id: doc.id, ...question });
      cachedQuestions.push({ id: doc.id, ...question });
    });

    // Render groups (card view)
    if (byStudentContainer) {
      byStudentContainer.style.display = '';
      byStudentContainer.innerHTML = '';
      Object.keys(grouped).forEach(student => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'student-group card';
        groupDiv.innerHTML = `
          <h3>${student === 'Unassigned' ? 'Unassigned' : 'Student: ' + student} 
            <span class="question-count">(${grouped[student].length} question${grouped[student].length !== 1 ? 's' : ''})</span>
          </h3>
          <div class="student-questions-list"></div>
        `;
        const listDiv = groupDiv.querySelector('.student-questions-list');
        grouped[student].forEach(q => {
          const questionElement = document.createElement('div');
          questionElement.className = 'card question-card';
          questionElement.innerHTML = `
            <h4>${q.title}</h4>
            <p class="description">${q.description.substring(0, 100)}${q.description.length > 100 ? '...' : ''}</p>
            <div class="question-meta">
              <span class="status ${q.assignedTo ? 'assigned' : 'available'}">
                ${q.assignedTo ? `Assigned to: ${q.assignedTo}` : 'Available'}
              </span>
              <button class="btn-small" onclick="deleteQuestion('${q.id}')">Delete</button>
              ${q.assignedTo ? `<button class="btn-small" onclick="unassignQuestion('${q.id}')">Unassign</button>` : ''}
            </div>
          `;
          listDiv.appendChild(questionElement);
        });
        byStudentContainer.appendChild(groupDiv);
      });
    }

    // Hide table view by default
    const tableContainer = document.getElementById('questions-table-container');
    if (tableContainer) {
      tableContainer.style.display = 'none';
      tableContainer.innerHTML = '';
    }

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

// Unassign question
async function unassignQuestion(questionId) {
  try {
    await db.collection('exams').doc(currentExamId).collection('questions').doc(questionId).update({
      assignedTo: null
    });
    showSuccess('Question unassigned successfully!');
    loadExamQuestions();
  } catch (error) {
    console.error("Error unassigning question:", error);
    showError("Failed to unassign question. Please try again.");
  }
}

// Toggle to card view
function showCardView() {
  document.getElementById('questions-by-student-container').style.display = '';
  document.getElementById('questions-table-container').style.display = 'none';
  document.getElementById('card-view-btn').disabled = true;
  document.getElementById('table-view-btn').disabled = false;
}

// Toggle to table view
function sortQuestions(questions, field, dir) {
  return questions.slice().sort((a, b) => {
    let v1 = a[field] || '';
    let v2 = b[field] || '';
    // For assignedTo, treat null/undefined as empty string
    if (field === 'assignedTo') {
      v1 = v1 || '';
      v2 = v2 || '';
    }
    if (v1 < v2) return dir === 'asc' ? -1 : 1;
    if (v1 > v2) return dir === 'asc' ? 1 : -1;
    return 0;
  });
}

function renderQuestionsTable() {
  const tableContainer = document.getElementById('questions-table-container');
  if (cachedQuestions.length === 0) {
    tableContainer.innerHTML = '<p class="no-questions">No questions yet. Add your first question!</p>';
    return;
  }
  const { field, dir } = tableSort;
  const sorted = sortQuestions(cachedQuestions, field, dir);

  // Sort icons
  const up = '&uarr;';
  const down = '&darr;';
  const titleSortIcon = field === 'title' ? (dir === 'asc' ? up : down) : '';
  const assignedSortIcon = field === 'assignedTo' ? (dir === 'asc' ? up : down) : '';

  let html = `<table class="questions-table">
    <thead>
      <tr>
        <th><button class="sort-btn" onclick="sortTableBy('title')">Title ${titleSortIcon}</button></th>
        <th>Description</th>
        <th>Topics</th>
        <th>Subtopics</th>
        <th>Plan</th>
        <th><button class="sort-btn" onclick="sortTableBy('assignedTo')">Assigned To ${assignedSortIcon}</button></th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>`;
  sorted.forEach(q => {
    html += `<tr>
      <td>${q.title}</td>
      <td>${q.description.substring(0, 60)}${q.description.length > 60 ? '...' : ''}</td>
      <td>${Array.isArray(q.topics) ? q.topics.join(', ') : ''}</td>
      <td>${Array.isArray(q.subtopics) ? q.subtopics.join(', ') : ''}</td>
      <td>${q.plan ? q.plan.substring(0, 40) + (q.plan.length > 40 ? '...' : '') : ''}</td>
      <td>${q.assignedTo || 'Unassigned'}</td>
      <td>
        <button class="btn-small" onclick="deleteQuestion('${q.id}')">Delete</button>
        ${q.assignedTo ? `<button class="btn-small" onclick="unassignQuestion('${q.id}')">Unassign</button>` : ''}
      </td>
    </tr>`;
  });
  html += `</tbody></table>`;
  tableContainer.innerHTML = html;
}

function sortTableBy(field) {
  if (tableSort.field === field) {
    tableSort.dir = tableSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    tableSort.field = field;
    tableSort.dir = 'asc';
  }
  renderQuestionsTable();
}

function showTableView() {
  const tableContainer = document.getElementById('questions-table-container');
  const cardContainer = document.getElementById('questions-by-student-container');
  cardContainer.style.display = 'none';
  tableContainer.style.display = '';
  document.getElementById('card-view-btn').disabled = false;
  document.getElementById('table-view-btn').disabled = true;
  renderQuestionsTable();
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
document.addEventListener('DOMContentLoaded', () => {
  loadExamQuestions();
  // Set initial view state
  if (document.getElementById('card-view-btn')) document.getElementById('card-view-btn').disabled = true;
  if (document.getElementById('table-view-btn')) document.getElementById('table-view-btn').disabled = false;
});