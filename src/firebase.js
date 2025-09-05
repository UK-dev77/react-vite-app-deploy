import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBI0PehNe8l_BQNedZiLtbKAM3-6l2dszI",
  authDomain: "my-app-63e1e.firebaseapp.com",
  databaseURL: "https://my-app-63e1e-default-rtdb.firebaseio.com/",
  projectId: "my-app-63e1e",
  storageBucket: "my-app-63e1e.firebasestorage.app",
  messagingSenderId: "299528860228",
  appId: "1:299528860228:web:9e57f419c9eead28c58211"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database and get a reference to the service
export const auth = getAuth(app);
export const db = getDatabase(app);