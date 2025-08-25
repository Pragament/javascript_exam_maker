// Teacher login with Google
function teacherLogin() {
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider)
    .then((result) => {
      window.location.href = 'teacher.html';
    })
    .catch((error) => {
      console.error("Login error:", error);
      document.getElementById('auth-error').textContent = error.message;
    });
}

// Check auth state
auth.onAuthStateChanged((user) => {
  if (user) {
    // User is signed in
    if (window.location.pathname.includes('teacher')) {
      document.getElementById('teacher-email').textContent = user.email;
      // Call dashboard loader if on teacher dashboard
      if (document.getElementById('exams-container')) {
        showTeacherDashboard();
      }
    }
  } else {
    // No user is signed in
    if (window.location.pathname.includes('teacher') || 
        window.location.pathname.includes('exam-questions')) {
      window.location.href = 'index.html';
    }
  }
});

// Logout function
function logout() {
  auth.signOut()
    .then(() => {
      window.location.href = 'index.html';
    })
    .catch((error) => {
      console.error("Logout error:", error);
    });
}

// Load exams for teacher: both created and invited
async function loadTeacherExams(userEmail) {
  const exams = [];

  // Exams created by this teacher
  const createdSnapshot = await db.collection('exams').where('createdBy', '==', userEmail).get();
  createdSnapshot.forEach(doc => {
    exams.push({ id: doc.id, ...doc.data(), role: 'owner' });
  });

  // Exams where this teacher is invited (in teachers subcollection)
  const invitedSnapshot = await db.collection('exams').get();
  for (const doc of invitedSnapshot.docs) {
    const teacherDoc = await db.collection('exams').doc(doc.id).collection('teachers').doc(userEmail).get();
    if (teacherDoc.exists) {
      exams.push({ id: doc.id, ...doc.data(), role: teacherDoc.data().role || 'invited' });
    }
  }

  return exams;
}

// Store teacher role for current exam in sessionStorage
async function getCurrentExamRole(userEmail, examId) {
  // Owner if createdBy
  const examDoc = await db.collection('exams').doc(examId).get();
  if (examDoc.exists && examDoc.data().createdBy === userEmail) return 'admin';
  // Check teachers subcollection
  const teacherDoc = await db.collection('exams').doc(examId).collection('teachers').doc(userEmail).get();
  if (teacherDoc.exists) return teacherDoc.data().role || 'viewer';
  return null;
}

// Example usage in your teacher dashboard page load logic:
// (Replace your current exam loading logic with this)
async function showTeacherDashboard() {
  const user = firebase.auth().currentUser;
  if (!user) return;
  const userEmail = user.email;
  const exams = await loadTeacherExams(userEmail);

  // Render exams in your dashboard
  const examsContainer = document.getElementById('exams-container');
  examsContainer.innerHTML = '';
  if (exams.length === 0) {
    examsContainer.innerHTML = '<p>No exams found.</p>';
    return;
  }
  exams.forEach(exam => {
    const div = document.createElement('div');
    div.className = 'card exam-card';
    div.innerHTML = `
      <h3>${exam.name}</h3>
      <p>Role: ${exam.role}</p>
      <a href="exam-questions.html?examId=${exam.id}" class="btn-primary" onclick="setExamRole('${exam.id}', '${exam.role}')">Manage Questions</a>
    `;
    examsContainer.appendChild(div);
  });
}

// Save role in sessionStorage for the selected exam
function setExamRole(examId, role) {
  sessionStorage.setItem('currentExamRole', role);
  sessionStorage.setItem('currentExamId', examId);
}