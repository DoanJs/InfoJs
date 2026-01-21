// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDoqj-f4uF3UezlL6Y5OAYnnxcxAuU8ldg",
  authDomain: "infojs-c6205.firebaseapp.com",
  projectId: "infojs-c6205",
  storageBucket: "infojs-c6205.firebasestorage.app",
  messagingSenderId: "312619976083",
  appId: "1:312619976083:web:7afc5037e26bb00d9f9466",
  measurementId: "G-4ZHCRDH7Q8"
};
// setLogLevel("debug");
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const functions = getFunctions(app, 'asia-southeast1');
// const analytics = getAnalytics(app);
export { auth, db, functions };
