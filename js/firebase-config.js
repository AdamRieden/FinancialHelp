// --------------------------------------------------------------------------
// FIREBASE CONFIG
// Fill in the values below with your own Firebase project's config.
// You'll find this in the Firebase Console:
//   Project Settings (gear icon) > General tab > "Your apps" > Web app (</>) 
//   > SDK setup and configuration > Config
// --------------------------------------------------------------------------
{/* <script type="module">
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyDwU2Ar56pUFxWuJqTC8BGTg3QkG20uHAo",
    authDomain: "couplefinance-de0cd.firebaseapp.com",
    projectId: "couplefinance-de0cd",
    storageBucket: "couplefinance-de0cd.firebasestorage.app",
    messagingSenderId: "429817324843",
    appId: "1:429817324843:web:71eb24d3bf48df3587916e"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
</script> */}


const firebaseConfig = {
    apiKey: "AIzaSyDwU2Ar56pUFxWuJqTC8BGTg3QkG20uHAo",
    authDomain: "couplefinance-de0cd.firebaseapp.com",
    projectId: "couplefinance-de0cd",
    storageBucket: "couplefinance-de0cd.firebasestorage.app",
    messagingSenderId: "429817324843",
    appId: "1:429817324843:web:71eb24d3bf48df3587916e"
  };

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// Enables offline caching + automatic sync once back online.
// (Won't work across multiple open tabs of the same browser at once - that's a
// known Firestore limitation, not a bug.)
db.enablePersistence().catch(err => {
  console.warn('Firestore offline persistence not enabled:', err.code);
});
