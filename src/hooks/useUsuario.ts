import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { auth } from '../firebase/firebaseConfig';
import { db } from '../firebase/firestore';

export type Rol = 'admin' | 'usuario';

export interface UsuarioApp {
  uid: string;
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  fotoPerfil?: string; // base64 guardado en Firestore
}

export function useUsuario() {
  const [usuario, setUsuario] = useState<UsuarioApp | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let unsubDoc: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubDoc) { unsubDoc(); unsubDoc = null; }

      if (!user) {
        setUsuario(null);
        setCargando(false);
        return;
      }

      unsubDoc = onSnapshot(doc(db, 'usuarios', user.uid), (snap) => {
        if (snap.exists()) {
          setUsuario({ uid: user.uid, ...snap.data() } as UsuarioApp);
        } else {
          setUsuario(null);
        }
        setCargando(false);
      });
    });

    return () => {
      if (unsubDoc) unsubDoc();
      unsubAuth();
    };
  }, []);

  const esAdmin = usuario?.rol === 'admin';

  return { usuario, cargando, esAdmin };
}