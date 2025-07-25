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