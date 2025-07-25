// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCB9FQSWrdNXStLCqQIux0MoakBFqHo__s",
  authDomain: "javascript-exam-maker.firebaseapp.com",
  projectId: "javascript-exam-maker",
  storageBucket: "javascript-exam-maker.firebasestorage.app",
  messagingSenderId: "970468520665",
  appId: "1:970468520665:web:258c91953d76f2a53104c8"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();