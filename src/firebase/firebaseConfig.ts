import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBZtOrpT8wBcRXdGvCPCwsmjdvq83dWraE",
  authDomain: "agenda-compartida-4e2b6.firebaseapp.com",
  projectId: "agenda-compartida-4e2b6",
  storageBucket: "agenda-compartida-4e2b6.appspot.com",
  messagingSenderId: "956483541468",
  appId: "1:956483541468:web:ec4a6b3eee0e6244d61719"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
