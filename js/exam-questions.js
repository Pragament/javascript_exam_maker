let currentExamId = null;
let cachedQuestions = []; // Store questions for table view
let tableSort = { field: 'title', dir: 'asc' }; // Default sort
let selectedQuestions = new Set();
let editingQuestionId = null;

// Helper to get current teacher's role for this exam
function getCurrentTeacherRole() {
  return sessionStorage.getItem('currentExamRole') || 'viewer';
}

// Load exam details and questions
async function loadExamQuestions() {
  currentExamId = new URLSearchParams(window.location.search).get('examId');
  if (!currentExamId) {
    window.location.href = 'teacher.html';
    return;
  }

  // Get role from sessionStorage or fetch if missing
  let currentRole = getCurrentTeacherRole();
  if (!currentRole) {
    // Fallback: fetch from Firestore if not set
    const user = firebase.auth().currentUser;
    if (user) {
      const examDoc = await db.collection('exams').doc(currentExamId).get();
      if (examDoc.exists && examDoc.data().createdBy === user.email) {
        currentRole = 'admin';
      } else {
        const teacherDoc = await db.collection('exams').doc(currentExamId).collection('teachers').doc(user.email).get();
        currentRole = teacherDoc.exists ? (teacherDoc.data().role || 'viewer') : 'viewer';
      }
      sessionStorage.setItem('currentExamRole', currentRole);
    }
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
    cachedQuestions = [];
    questionsSnapshot.forEach(doc => {
      const question = doc.data();
      // Only include published questions for students, but show all for teacher
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
            <input type="checkbox" onchange="toggleSelectQuestion('${q.id}', this.checked)" ${selectedQuestions.has(q.id) ? 'checked' : ''} style="margin-right:8px;" ${currentRole === 'viewer' ? 'disabled' : ''}>
            <h4>${q.title}</h4>
            <p class="description">${q.description.substring(0, 100)}${q.description.length > 100 ? '...' : ''}</p>
            <div class="question-meta">
              <span class="status ${q.assignedTo ? 'assigned' : 'available'}">
                ${q.assignedTo ? `Assigned to: ${q.assignedTo}` : 'Available'}
              </span>
              <button class="btn-small" onclick="editQuestion('${q.id}')" ${currentRole === 'viewer' ? 'disabled' : ''}>Edit</button>
              ${
                q.published === false
                  ? `<button class="btn-small" onclick="publishQuestion('${q.id}')" ${currentRole === 'viewer' ? 'disabled' : ''}>Publish</button>`
                  : `<button class="btn-small" onclick="unpublishQuestion('${q.id}')" ${currentRole === 'viewer' ? 'disabled' : ''}>Unpublish</button>`
              }
              <button class="btn-small" onclick="deleteQuestion('${q.id}')" ${currentRole === 'viewer' ? 'disabled' : ''}>Delete</button>
              ${q.assignedTo ? `<button class="btn-small" onclick="unassignQuestion('${q.id}')" ${currentRole === 'viewer' ? 'disabled' : ''}>Unassign</button>` : ''}
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
  const published = document.getElementById('question-published').checked;

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
      published,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Clear form
    document.getElementById('question-title').value = '';
    document.getElementById('question-description').value = '';
    document.getElementById('question-topics').value = '';
    document.getElementById('question-subtopics').value = '';
    document.getElementById('question-plan').value = '';
    document.getElementById('question-published').checked = true;

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

// Unpublish question
async function unpublishQuestion(questionId) {
  try {
    await db.collection('exams').doc(currentExamId).collection('questions').doc(questionId).update({
      published: false
    });
    showSuccess('Question unpublished.');
    loadExamQuestions();
  } catch (e) {
    showError('Failed to unpublish question.');
  }
}

// Add this function to handle publishing a question
async function publishQuestion(questionId) {
  try {
    await db.collection('exams').doc(currentExamId).collection('questions').doc(questionId).update({
      published: true
    });
    showSuccess('Question published.');
    loadExamQuestions();
  } catch (e) {
    showError('Failed to publish question.');
  }
}

function editQuestion(questionId) {
  db.collection('exams').doc(currentExamId).collection('questions').doc(questionId).get()
    .then(doc => {
      if (!doc.exists) {
        showError('Question not found.');
        return;
      }
      const q = doc.data();
      editingQuestionId = questionId;
      document.getElementById('edit-question-title').value = q.title || '';
      document.getElementById('edit-question-description').value = q.description || '';
      document.getElementById('edit-question-topics').value = (q.topics || []).join(', ');
      document.getElementById('edit-question-subtopics').value = (q.subtopics || []).join(', ');
      document.getElementById('edit-question-plan').value = q.plan || '';
      document.getElementById('edit-question-published').checked = q.published !== false;
      document.getElementById('edit-question-modal').style.display = 'block';
    })
    .catch(() => showError('Failed to load question for editing.'));
}

function closeEditModal() {
  document.getElementById('edit-question-modal').style.display = 'none';
  editingQuestionId = null;
}

async function saveEditedQuestion() {
  if (!editingQuestionId) return;
  const title = document.getElementById('edit-question-title').value.trim();
  const description = document.getElementById('edit-question-description').value.trim();
  const topics = document.getElementById('edit-question-topics').value.trim().split(',').map(t => t.trim()).filter(Boolean);
  const subtopics = document.getElementById('edit-question-subtopics').value.trim().split(',').map(t => t.trim()).filter(Boolean);
  const plan = document.getElementById('edit-question-plan').value.trim();
  const published = document.getElementById('edit-question-published').checked;

  if (!title || !description) {
    showError('Title and Description are required');
    return;
  }

  try {
    await db.collection('exams').doc(currentExamId).collection('questions').doc(editingQuestionId).update({
      title, description, topics, subtopics, plan, published
    });
    showSuccess('Question updated successfully!');
    closeEditModal();
    loadExamQuestions();
  } catch (e) {
    showError('Failed to update question.');
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
  const currentRole = getCurrentTeacherRole();

  // Sort icons
  const up = '&uarr;';
  const down = '&darr;';
  const titleSortIcon = field === 'title' ? (dir === 'asc' ? up : down) : '';
  const assignedSortIcon = field === 'assignedTo' ? (dir === 'asc' ? up : down) : '';

  let html = `<table class="questions-table">
    <thead>
      <tr>
        <th><input type="checkbox" onclick="toggleSelectAllTable(this)" ${currentRole === 'viewer' ? 'disabled' : ''}></th>
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
      <td><input type="checkbox" onchange="toggleSelectQuestion('${q.id}', this.checked)" ${selectedQuestions.has(q.id) ? 'checked' : ''} ${currentRole === 'viewer' ? 'disabled' : ''}></td>
      <td>${q.title}</td>
      <td>${q.description.substring(0, 60)}${q.description.length > 60 ? '...' : ''}</td>
      <td>${Array.isArray(q.topics) ? q.topics.join(', ') : ''}</td>
      <td>${Array.isArray(q.subtopics) ? q.subtopics.join(', ') : ''}</td>
      <td>${q.plan ? q.plan.substring(0, 40) + (q.plan.length > 40 ? '...' : '') : ''}</td>
      <td>${q.assignedTo || 'Unassigned'}</td>
      <td>
        <button class="btn-small" onclick="editQuestion('${q.id}')" ${currentRole === 'viewer' ? 'disabled' : ''}>Edit</button>
        ${
          q.published === false
            ? `<button class="btn-small" onclick="publishQuestion('${q.id}')" ${currentRole === 'viewer' ? 'disabled' : ''}>Publish</button>`
            : `<button class="btn-small" onclick="unpublishQuestion('${q.id}')" ${currentRole === 'viewer' ? 'disabled' : ''}>Unpublish</button>`
        }
        <button class="btn-small" onclick="deleteQuestion('${q.id}')" ${currentRole === 'viewer' ? 'disabled' : ''}>Delete</button>
        ${q.assignedTo ? `<button class="btn-small" onclick="unassignQuestion('${q.id}')" ${currentRole === 'viewer' ? 'disabled' : ''}>Unassign</button>` : ''}
      </td>
    </tr>`;
  });
  html += `</tbody></table>`;
  tableContainer.innerHTML = html;
}

// Select/deselect all in table
function toggleSelectAllTable(master) {
  const checkboxes = document.querySelectorAll('#questions-table-container tbody input[type="checkbox"]');
  checkboxes.forEach(cb => {
    cb.checked = master.checked;
    const qid = cb.closest('tr').querySelector('input[type="checkbox"]').value || cb.closest('tr').querySelector('input[type="checkbox"]').getAttribute('data-qid') || cb.closest('tr').querySelector('input[type="checkbox"]').getAttribute('id');
    toggleSelectQuestion(cb.closest('tr').children[1].textContent, master.checked);
  });
  // Actually, better to use the id from the input value:
  sorted.forEach(q => {
    if (master.checked) selectedQuestions.add(q.id);
    else selectedQuestions.delete(q.id);
  });
  renderQuestionsTable();
}

// Bulk unpublish selected questions
async function unpublishSelectedQuestions() {
  if (selectedQuestions.size === 0) {
    showError('No questions selected.');
    return;
  }
  if (!confirm('Unpublish selected questions? They will be hidden from students.')) return;
  try {
    const batch = db.batch();
    selectedQuestions.forEach(qid => {
      const ref = db.collection('exams').doc(currentExamId).collection('questions').doc(qid);
      batch.update(ref, { published: false });
    });
    await batch.commit();
    showSuccess('Selected questions unpublished.');
    selectedQuestions.clear();
    loadExamQuestions();
  } catch (e) {
    showError('Failed to unpublish selected questions.');
  }
}

// Handle select/deselect
function toggleSelectQuestion(qid, checked) {
  if (checked) selectedQuestions.add(qid);
  else selectedQuestions.delete(qid);
}

// Toggle to table view
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

// Invite another teacher to the exam with a role
async function inviteTeacher() {
  const currentRole = getCurrentTeacherRole();
  if (currentRole !== 'admin') {
    document.getElementById('invite-status').textContent = 'Only admin can invite teachers.';
    document.getElementById('invite-status').className = 'alert error';
    return;
  }

  const email = document.getElementById('invite-email').value.trim();
  const role = document.getElementById('invite-role').value;
  const statusDiv = document.getElementById('invite-status');
  statusDiv.textContent = '';

  if (!email) {
    statusDiv.textContent = 'Please enter a valid email.';
    statusDiv.className = 'alert error';
    return;
  }

  try {
    // Add or update teacher in the exam's teachers subcollection
    await db.collection('exams').doc(currentExamId)
      .collection('teachers')
      .doc(email)
      .set({ role }, { merge: true });

    statusDiv.textContent = `Invitation sent to ${email} as ${role}.`;
    statusDiv.className = 'alert success';
    document.getElementById('invite-email').value = '';
    document.getElementById('invite-role').value = 'viewer';
  } catch (error) {
    statusDiv.textContent = 'Failed to invite teacher. Please try again.';
    statusDiv.className = 'alert error';
  }
}

// Load questions when page loads
document.addEventListener('DOMContentLoaded', () => {
  loadExamQuestions();
  // Set initial view state
  if (document.getElementById('card-view-btn')) document.getElementById('card-view-btn').disabled = true;
  if (document.getElementById('table-view-btn')) document.getElementById('table-view-btn').disabled = false;
});