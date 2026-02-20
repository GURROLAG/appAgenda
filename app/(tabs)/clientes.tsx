import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

export default function ClientesScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }}>
      <Ionicons name="people-outline" size={64} color="#1e90ff" />
      <Text style={{ fontSize: 22, fontWeight: 'bold', marginTop: 16, color: '#333' }}>Clientes</Text>
      <Text style={{ color: '#888', marginTop: 8 }}>Próximamente...</Text>
    </View>
  );
}