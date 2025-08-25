// Load teacher's exams
async function loadTeacherDashboard(user) {
  console.log("Loading teacher dashboard...");
  console.log(auth);
  console.log("Current user:", user ? user.email : "No user logged in");
  if (!user) return;

  // Set teacher email in the DOM
  const emailSpan = document.getElementById('teacher-email');
  if (emailSpan) {
    emailSpan.textContent = user.email;
  }

  try {
    const examsSnapshot = await db.collection('exams')
      .where('teacherId', '==', user.uid)
      .orderBy('createdAt', 'desc')
      .get();
      console.log("Exams loaded:", examsSnapshot.docs.length);
    
    const examsContainer = document.getElementById('exams-container');
    examsContainer.innerHTML = '';
    
    if (examsSnapshot.empty) {
      examsContainer.innerHTML = '<p class="no-exams">You have no exams yet. Create your first exam!</p>';
      return;
    }
    
    examsSnapshot.forEach(doc => {
      const exam = doc.data();
      const examElement = document.createElement('div');
      examElement.className = 'card exam-card';
      examElement.innerHTML = `
        <h3>${exam.name}</h3>
        <p><strong>Class:</strong> ${exam.class}</p>
        <p><strong>Exam Code:</strong> ${exam.code}</p>
        <div class="exam-actions">
          <button class="btn-secondary" onclick="viewExamQuestions('${doc.id}')">Manage Questions</button>
        </div>
      `;
      examsContainer.appendChild(examElement);
    });
  } catch (error) {
    console.error("Error loading exams:", error);
    showError("Failed to load exams. Please try again.");
  }
}

// Create new exam
async function createNewExam() {
  const user = auth.currentUser;
  if (!user) return;
  
  const examName = document.getElementById('exam-name').value.trim();
  const examClass = document.getElementById('exam-class').value.trim();
  
  if (!examName || !examClass) {
    showError('Please fill all fields');
    return;
  }
  
  // Generate 6-digit unique code
  const examCode = Math.floor(100000 + Math.random() * 900000).toString();
  
  try {
    // Create exam and get reference
    const examRef = await db.collection('exams').add({
      name: examName,
      class: examClass,
      code: examCode,
      teacherId: user.uid,
      createdBy: user.email, // ensure createdBy is set for admin logic
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Add creator as admin in teachers subcollection
    await db.collection('exams').doc(examRef.id)
      .collection('teachers')
      .doc(user.email)
      .set({ role: 'admin' }, { merge: true });

    // Clear form
    document.getElementById('exam-name').value = '';
    document.getElementById('exam-class').value = '';
    
    showSuccess('Exam created successfully!');
    loadTeacherDashboard();
  } catch (error) {
    console.error("Error creating exam:", error);
    showError("Failed to create exam. Please try again.");
  }
}

// Redirect to exam questions page
function viewExamQuestions(examId) {
  window.location.href = `exam-questions.html?examId=${examId}`;
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

// Load dashboard when page loads, but wait for auth state
document.addEventListener('DOMContentLoaded', () => {
  auth.onAuthStateChanged(async user => {
    await loadTeacherDashboard(user);
  });
});
