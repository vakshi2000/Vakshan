// firebase-config.js
// 1. Go to https://console.firebase.google.com/
// 2. Create a new project
// 3. Add a Web App to your project
// 4. Copy the 'firebaseConfig' object and paste it below replacing the empty object
// 5. Enable 'Cloud Firestore' in your Firebase Console

const firebaseConfig = {
    // PASTE YOUR CONFIG HERE
    // apiKey: "AIzaSy...",
    // authDomain: "...",
    // projectId: "...",
    // storageBucket: "...",
    // messagingSenderId: "...",
    // appId: "..."
};

// Initialize Firebase only if config is present
let db = null;
if (firebaseConfig.apiKey) {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        console.log("Firebase initialized");
    } catch (e) {
        console.error("Firebase initialization failed:", e);
    }
} else {
    console.log("Running in Local Mode (No Firebase Config found)");
}
