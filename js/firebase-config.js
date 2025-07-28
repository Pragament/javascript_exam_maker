// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAyNi0puCHYP-u5NPT2GhcWHzDz612KiE4",
  authDomain: "exammakerproject.firebaseapp.com",
  projectId: "exammakerproject",
  storageBucket: "exammakerproject.firebasestorage.app",
  messagingSenderId: "943974219624",
  appId: "1:943974219624:web:573f8d8b93adee8dd2a0dd",
  measurementId: "G-QM2C7JHGST"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();