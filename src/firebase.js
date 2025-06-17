// src/firebase.js

import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth"; // <-- ADD THIS

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCmSBIOwov_OStpGNADx7ANQlwOKOUvoCk",
  authDomain: "tracker-46a22.firebaseapp.com",
  databaseURL: "https://tracker-46a22-default-rtdb.firebaseio.com",
  projectId: "tracker-46a22",
  storageBucket: "tracker-46a22.appspot.com",
  messagingSenderId: "432231739708",
  appId: "1:432231739708:web:4d9d9ad29238d91616ee39",
  measurementId: "G-RRJY02V114",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firebase services
export const database = getDatabase(app);
export const auth = getAuth(app); // <-- ADD THIS
