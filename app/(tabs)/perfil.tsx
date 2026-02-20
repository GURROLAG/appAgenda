import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';
import { cerrarSesion } from '../../src/firebase/authService';
import { auth } from '../../src/firebase/firebaseConfig';

export default function PerfilScreen() {
  const user = auth.currentUser;

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          await cerrarSesion();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f0f0f0', padding: 24 }}>
      {/* Avatar */}
      <View style={{ alignItems: 'center', marginTop: 40, marginBottom: 32 }}>
        <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: '#1e90ff', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="person" size={50} color="#fff" />
        </View>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginTop: 16, color: '#333' }}>
          {user?.email ?? 'Usuario'}
        </Text>
      </View>

      {/* Botón logout */}
      <Pressable
        onPress={handleLogout}
        style={{ backgroundColor: '#ff4d4f', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 'auto' }}
      >
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}