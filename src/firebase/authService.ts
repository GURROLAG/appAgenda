import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  UserCredential,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth } from './firebaseConfig';
import { db } from './firestore';

// Registrar nuevo usuario - siempre con rol "usuario"
export const registrarUsuario = async (
  email: string,
  password: string,
  nombre: string = ''
): Promise<UserCredential> => {
  const credencial = await createUserWithEmailAndPassword(auth, email, password);

  await setDoc(doc(db, 'usuarios', credencial.user.uid), {
    email,
    nombre: nombre || email.split('@')[0],
    rol: 'usuario',
    activo: true,
    creadoEn: serverTimestamp(),
  });

  return credencial;
};

export const iniciarSesion = async (
  email: string,
  password: string
): Promise<UserCredential> => {
  return await signInWithEmailAndPassword(auth, email, password);
};

export const cerrarSesion = async (): Promise<void> => {
  return await signOut(auth);
};