// Tab switching
function openTab(tabName) {
  const tabs = document.getElementsByClassName('tab-content');
  for (let i = 0; i < tabs.length; i++) {
    tabs[i].classList.remove('active');
  }
  
  const tabButtons = document.getElementsByClassName('tab-btn');
  for (let i = 0; i < tabButtons.length; i++) {
    tabButtons[i].classList.remove('active');
  }
  
  document.getElementById(`${tabName}-tab`).classList.add('active');
  event.currentTarget.classList.add('active');
}

// Student enters exam
async function studentEnterExam() {
  const examCode = document.getElementById('exam-code').value.trim();
  const rollNumber = document.getElementById('roll-number').value.trim();
  const errorElement = document.getElementById('student-error');
  
  if (!examCode || !rollNumber) {
    errorElement.textContent = 'Please enter both exam code and roll number';
    return;
  }
  
  if (examCode.length !== 6 || !/^\d+$/.test(examCode)) {
    errorElement.textContent = 'Exam code must be 6 digits';
    return;
  }
  localStorage.setItem('rollNumber', rollNumber);
  
  try {
    // Find exam by code
    const examsSnapshot = await db.collection('exams')
      .where('code', '==', examCode)
      .limit(1)
      .get();
    
    if (examsSnapshot.empty) {
      errorElement.textContent = 'Exam not found';
      return;
    }
    
    const examId = examsSnapshot.docs[0].id;
    
    // Check if student already has a question assigned
    const assignedQuestion = await db.collection('exams').doc(examId)
      .collection('questions')
      .where('assignedTo', '==', rollNumber)
      .limit(1)
      .get();
    
    if (!assignedQuestion.empty) {
      // Redirect to question view with assigned question
      window.location.href = `student.html?examId=${examId}&questionId=${assignedQuestion.docs[0].id}`;
    } else {
      // Redirect to available questions
      window.location.href = `student.html?examId=${examId}`;
    }
  } catch (error) {
    console.error("Error entering exam:", error);
    errorElement.textContent = 'Error entering exam. Please try again.';
  }
}
