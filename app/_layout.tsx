import { Slot, useRouter, useSegments } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { TemaProvider } from '../src/context/TemaContext';
import { auth } from '../src/firebase/firebaseConfig';
import { db } from '../src/firebase/firestore';

export default function RootLayout() {
  const [usuario, setUsuario] = useState<any>(undefined);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUsuario(null);
        return;
      }

      // Verificar si el usuario está activo en Firestore
      try {
        const snap = await getDoc(doc(db, 'usuarios', user.uid));
        if (snap.exists() && snap.data().activo === false) {
          await signOut(auth);
          Alert.alert(
            'Acceso denegado',
            'Tu cuenta ha sido desactivada. Contacta al administrador.'
          );
          setUsuario(null);
        } else {
          setUsuario(user);
        }
      } catch {
        // Si hay error leyendo Firestore, igual dejar pasar
        setUsuario(user);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (usuario === undefined) return;

    const enTabs = segments[0] === '(tabs)';

    if (usuario && !enTabs) {
      router.replace('/(tabs)');
    } else if (!usuario && enTabs) {
      router.replace('/login');
    } else if (!usuario && segments[0] !== 'login') {
      router.replace('/login');
    }
  }, [usuario, segments]);

  if (usuario === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a2e' }}>
        <ActivityIndicator size="large" color="#1e90ff" />
      </View>
    );
  }

  return (
    <TemaProvider>
      <Slot />
    </TemaProvider>
  );
}