// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDu3uG-FuvkMZCnJ-os98Tf6TKHdiz_O8M",
    authDomain: "jurislibre-5e2d8.firebaseapp.com",
    projectId: "jurislibre-5e2d8",
    storageBucket: "jurislibre-5e2d8.firebasestorage.app",
    messagingSenderId: "622464721150",
    appId: "1:622464721150:web:88b4d1ec11aaf2737bc5af"
  };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
