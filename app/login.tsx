import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable,
  ScrollView, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Toast, useToast } from '../src/components/Toast';
import { iniciarSesion, registrarUsuario } from '../src/firebase/authService';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [modoRegistro, setModoRegistro] = useState(false);
  const [cargando, setCargando] = useState(false);
  const { toast, ocultar, exito, error, advertencia } = useToast();

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      advertencia('Por favor ingresa tu correo y contraseña');
      return;
    }
    if (modoRegistro && !nombre.trim()) {
      advertencia('Por favor ingresa tu nombre de usuario');
      return;
    }
    if (password.length < 6) {
      advertencia('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setCargando(true);
    try {
      if (modoRegistro) {
        await registrarUsuario(email.trim(), password, nombre.trim());
        exito(`¡Bienvenido ${nombre.trim()}! Cuenta creada`);
        setTimeout(() => router.replace('/(tabs)'), 1200);
      } else {
        await iniciarSesion(email.trim(), password);
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      let mensaje = 'Ocurrió un error. Intenta de nuevo.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        mensaje = 'Correo o contraseña incorrectos';
      } else if (err.code === 'auth/email-already-in-use') {
        mensaje = 'Este correo ya está registrado';
      } else if (err.code === 'auth/invalid-email') {
        mensaje = 'El formato del correo no es válido';
      } else if (err.code === 'auth/network-request-failed') {
        mensaje = 'Sin conexión a internet';
      } else if (err.code === 'auth/too-many-requests') {
        mensaje = 'Demasiados intentos. Espera un momento';
      }
      error(mensaje);
    } finally {
      setCargando(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#0a0a2e' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Toast mensaje={toast.mensaje} tipo={toast.tipo} visible={toast.visible} onHide={ocultar} />

      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 28 }} keyboardShouldPersistTaps="handled">
        {/* LOGO */}
        <View style={{ alignItems: 'center', marginBottom: 40 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#1e90ff', justifyContent: 'center', alignItems: 'center', marginBottom: 16, shadowColor: '#1e90ff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 20, elevation: 10 }}>
            <Ionicons name="calendar" size={40} color="#fff" />
          </View>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#fff', letterSpacing: 1 }}>AppAgenda</Text>
          <Text style={{ color: '#888', marginTop: 6, fontSize: 15 }}>
            {modoRegistro ? 'Crea tu cuenta' : 'Inicia sesión para continuar'}
          </Text>
        </View>

        <View style={{ gap: 16 }}>
          {/* Nombre - solo en registro */}
          {modoRegistro && (
            <View>
              <Text style={{ color: '#aaa', marginBottom: 8, fontSize: 14 }}>Nombre de usuario</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a3e', borderRadius: 14, borderWidth: 1, borderColor: '#2a2a5e', paddingHorizontal: 16 }}>
                <Ionicons name="person-outline" size={20} color="#1e90ff" />
                <TextInput value={nombre} onChangeText={setNombre} placeholder="Tu nombre" placeholderTextColor="#555" autoCapitalize="words"
                  style={{ flex: 1, color: '#fff', fontSize: 16, paddingVertical: 16, paddingLeft: 12 }} />
              </View>
            </View>
          )}

          {/* Email */}
          <View>
            <Text style={{ color: '#aaa', marginBottom: 8, fontSize: 14 }}>Correo electrónico</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a3e', borderRadius: 14, borderWidth: 1, borderColor: '#2a2a5e', paddingHorizontal: 16 }}>
              <Ionicons name="mail-outline" size={20} color="#1e90ff" />
              <TextInput value={email} onChangeText={setEmail} placeholder="correo@ejemplo.com" placeholderTextColor="#555" keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                style={{ flex: 1, color: '#fff', fontSize: 16, paddingVertical: 16, paddingLeft: 12 }} />
            </View>
          </View>

          {/* Contraseña */}
          <View>
            <Text style={{ color: '#aaa', marginBottom: 8, fontSize: 14 }}>Contraseña</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a3e', borderRadius: 14, borderWidth: 1, borderColor: '#2a2a5e', paddingHorizontal: 16 }}>
              <Ionicons name="lock-closed-outline" size={20} color="#1e90ff" />
              <TextInput value={password} onChangeText={setPassword} placeholder="Mínimo 6 caracteres" placeholderTextColor="#555" secureTextEntry={!mostrarPassword}
                style={{ flex: 1, color: '#fff', fontSize: 16, paddingVertical: 16, paddingLeft: 12 }} />
              <TouchableOpacity onPress={() => setMostrarPassword(!mostrarPassword)}>
                <Ionicons name={mostrarPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#555" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Botón */}
          <Pressable onPress={handleSubmit} disabled={cargando}
            style={({ pressed }) => ({ backgroundColor: cargando ? '#1560aa' : pressed ? '#1670cc' : '#1e90ff', paddingVertical: 18, borderRadius: 16, alignItems: 'center', marginTop: 8, shadowColor: '#1e90ff', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 })}>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: 'bold', letterSpacing: 0.5 }}>
              {cargando ? 'Cargando...' : modoRegistro ? 'Crear cuenta' : 'Iniciar sesión'}
            </Text>
          </Pressable>

          {/* Cambiar modo */}
          <Pressable onPress={() => { setModoRegistro(!modoRegistro); setNombre(''); }} style={{ alignItems: 'center', marginTop: 8, padding: 12 }}>
            <Text style={{ color: '#888', fontSize: 15 }}>
              {modoRegistro ? '¿Ya tienes cuenta? ' : '¿No tienes cuenta? '}
              <Text style={{ color: '#1e90ff', fontWeight: 'bold' }}>
                {modoRegistro ? 'Inicia sesión' : 'Regístrate'}
              </Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}