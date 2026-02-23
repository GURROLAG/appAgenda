import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTema } from '../../src/context/TemaContext';
import { useUsuario } from '../../src/hooks/useUsuario';

export default function TabsLayout() {
  const { colors, darkMode } = useTema();
  const { esAdmin } = useUsuario();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: darkMode ? '#1a1a1a' : '#1a1a3e',
          borderTopColor: darkMode ? '#333' : '#2a2a5e',
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 68,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#555',
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600', marginTop: 2 },
        headerStyle: { backgroundColor: darkMode ? '#1a1a1a' : '#0a0a2e' },
        headerTintColor: '#fff',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Agenda',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="clientes"
        options={{
          title: 'Clientes',
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="documentos"
        options={{
          title: 'Documentos',
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          tabBarIcon: ({ color, size }) => <Ionicons name="shield-checkmark-outline" size={size} color={color} />,
          tabBarItemStyle: esAdmin ? {} : { display: 'none' },
        }}
      />
    </Tabs>
  );
}