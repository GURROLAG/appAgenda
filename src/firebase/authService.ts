import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    UserCredential,
} from 'firebase/auth';
import { auth } from './firebaseConfig';

// Registrar nuevo usuario
export const registrarUsuario = async (
  email: string,
  password: string
): Promise<UserCredential> => {
  return await createUserWithEmailAndPassword(auth, email, password);
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