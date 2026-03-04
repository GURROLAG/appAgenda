import * as Notifications from 'expo-notifications';
import { Slot, useRouter, useSegments } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TemaProvider } from '../src/context/TemaContext';
import { auth } from '../src/firebase/firebaseConfig';
import { db } from '../src/firebase/firestore';
import { solicitarPermisosNotificaciones } from '../src/utils/notificaciones';

export default function RootLayout() {
  const [usuario, setUsuario] = useState<any>(undefined);
  const router = useRouter();
  const segments = useSegments();
  const notifListener = useRef<any>();
  const responseListener = useRef<any>();

  // Solicitar permisos al arrancar
  useEffect(() => {
    solicitarPermisosNotificaciones();

    // Listener para cuando llega una notificación con la app abierta
    notifListener.current = Notifications.addNotificationReceivedListener((_notification) => {
      // La notificación se muestra automáticamente por el handler global
    });

    // Listener para cuando el usuario toca la notificación
    responseListener.current = Notifications.addNotificationResponseReceivedListener((_response) => {
      // Aquí podrías navegar al evento si quisieras
    });

    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUsuario(null);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'usuarios', user.uid));
        if (snap.exists() && snap.data().activo === false) {
          await signOut(auth);
          Alert.alert('Acceso denegado', 'Tu cuenta ha sido desactivada. Contacta al administrador.');
          setUsuario(null);
        } else {
          setUsuario(user);
        }
      } catch {
        setUsuario(user);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (usuario === undefined) return;
    const enTabs = segments[0] === '(tabs)';
    if (usuario && !enTabs) router.replace('/(tabs)');
    else if (!usuario && enTabs) router.replace('/login');
    else if (!usuario && segments[0] !== 'login') router.replace('/login');
  }, [usuario, segments]);

  if (usuario === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a2e' }}>
        <ActivityIndicator size="large" color="#1e90ff" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <TemaProvider>
        <Slot />
      </TemaProvider>
    </SafeAreaProvider>
  );
}