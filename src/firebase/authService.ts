import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  UserCredential,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth } from './firebaseConfig';
import { db } from './firestore';

// Registrar nuevo usuario
export const registrarUsuario = async (
  email: string,
  password: string,
  nombre: string
): Promise<UserCredential> => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, 'usuarios', cred.user.uid), {
    nombre,
    email,
    rol: 'usuario',
    activo: true,
    creadoEn: serverTimestamp(),
  });
  return cred;
};

// Iniciar sesión
export const iniciarSesion = async (
  email: string,
  password: string
): Promise<UserCredential> => {
  return await signInWithEmailAndPassword(auth, email, password);
};

// Cerrar sesión
export const cerrarSesion = async (): Promise<void> => {
  return await signOut(auth);
};

// Restablecer contraseña
export const restablecerPassword = async (email: string): Promise<void> => {
  return await sendPasswordResetEmail(auth, email);
};