import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue } from 'firebase/database';

const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
  };

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// If we're in development, let's try connecting to the database explicitly
if (process.env.NODE_ENV === 'development') {
  try {
    const dbRef = ref(database, '.info/connected');
    onValue(dbRef, (snapshot) => {
      console.log('Database connection state:', snapshot.val());
    });
  } catch (error) {
    console.error('Database connection test failed:', error);
  }
}

export { database };
export default app;