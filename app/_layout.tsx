import { Slot, useRouter, useSegments } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { auth } from '../src/firebase/firebaseConfig';

export default function RootLayout() {
  const [usuario, setUsuario] = useState<any>(undefined);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUsuario(user);
    });
    return unsub;
  }, []);

  useEffect(() => {
    // undefined = todavía cargando, null = no autenticado, objeto = autenticado
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

  // Mostrar loading solo mientras no sabemos el estado
  if (usuario === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a2e' }}>
        <ActivityIndicator size="large" color="#1e90ff" />
      </View>
    );
  }

  return <Slot />;
}