import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Dimensions, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Toast, useToast } from '../src/components/Toast';
import { iniciarSesion, registrarUsuario, restablecerPassword } from '../src/firebase/authService';

// ─── Responsividad ────────────────────────────────────────────────────────────

const { width: W, height: H } = Dimensions.get('window');
const isTablet = W >= 768;
const isSmall  = H < 700;

const s = {
  pad:        isTablet ? 60  : 28,
  logoSize:   isTablet ? 110 : isSmall ? 64  : 80,
  iconSize:   isTablet ? 56  : isSmall ? 30  : 40,
  titleSize:  isTablet ? 36  : isSmall ? 22  : 28,
  subtitleSz: isTablet ? 18  : 15,
  labelSz:    isTablet ? 16  : 14,
  inputSz:    isTablet ? 18  : 16,
  btnSz:      isTablet ? 18  : 17,
  inputPadV:  isTablet ? 20  : isSmall ? 13  : 16,
  btnPadV:    isTablet ? 22  : isSmall ? 14  : 18,
  logoMb:     isTablet ? 56  : isSmall ? 24  : 40,
  cardW:      isTablet ? 520 : '100%' as const,
};

// ─── Pantalla ─────────────────────────────────────────────────────────────────

// ─── Campo de texto reutilizable (FUERA del componente principal) ─────────────
// Definirlo dentro causaría que se remontara en cada keystroke cerrando el teclado

interface CampoProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  icono: string;
  tipo?: 'text' | 'email' | 'password';
  mostrarPass?: boolean;
  extra?: React.ReactNode;
}

function Campo({ label, value, onChange, icono, tipo = 'text', mostrarPass, extra }: CampoProps) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: '#aaa', marginBottom: 8, fontSize: s.labelSz }}>{label}</Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#1a1a3e', borderRadius: 14,
        borderWidth: 1, borderColor: '#2a2a5e', paddingHorizontal: 16,
      }}>
        <Ionicons name={icono as any} size={isTablet ? 22 : 20} color="#1e90ff" />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={tipo === 'email' ? 'correo@ejemplo.com' : tipo === 'password' ? 'Mínimo 6 caracteres' : 'Tu nombre'}
          placeholderTextColor="#555"
          secureTextEntry={tipo === 'password' && !mostrarPass}
          keyboardType={tipo === 'email' ? 'email-address' : 'default'}
          autoCapitalize={tipo === 'text' ? 'words' : 'none'}
          autoCorrect={false}
          style={{ flex: 1, color: '#fff', fontSize: s.inputSz, paddingVertical: s.inputPadV, paddingLeft: 12 }}
        />
        {extra}
      </View>
    </View>
  );
}

export default function LoginScreen() {
  const [email,          setEmail]          = useState('');
  const [password,       setPassword]       = useState('');
  const [nombre,         setNombre]         = useState('');
  const [mostrarPass,    setMostrarPass]    = useState(false);
  const [modoRegistro,   setModoRegistro]   = useState(false);
  const [cargando,       setCargando]       = useState(false);
  const [modalReset,     setModalReset]     = useState(false);
  const [emailReset,     setEmailReset]     = useState('');
  const [enviandoReset,  setEnviandoReset]  = useState(false);
  const [resetEnviado,   setResetEnviado]   = useState(false);
  const { toast, ocultar, exito, error, advertencia } = useToast();

  // ─── Lógica ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) { advertencia('Ingresa tu correo y contraseña'); return; }
    if (modoRegistro && !nombre.trim())    { advertencia('Ingresa tu nombre de usuario');   return; }
    if (password.length < 6)              { advertencia('La contraseña debe tener al menos 6 caracteres'); return; }
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
      let msg = 'Ocurrió un error. Intenta de nuevo.';
      if (['auth/user-not-found','auth/wrong-password','auth/invalid-credential'].includes(err.code)) msg = 'Correo o contraseña incorrectos';
      else if (err.code === 'auth/email-already-in-use')   msg = 'Este correo ya está registrado';
      else if (err.code === 'auth/invalid-email')          msg = 'El formato del correo no es válido';
      else if (err.code === 'auth/network-request-failed') msg = 'Sin conexión a internet';
      else if (err.code === 'auth/too-many-requests')      msg = 'Demasiados intentos. Espera un momento';
      error(msg);
    } finally { setCargando(false); }
  };

  const handleReset = async () => {
    if (!emailReset.trim()) { advertencia('Ingresa tu correo electrónico'); return; }
    setEnviandoReset(true);
    try {
      await restablecerPassword(emailReset.trim());
      setResetEnviado(true);
    } catch (err: any) {
      if (['auth/user-not-found','auth/invalid-credential'].includes(err.code)) error('No existe una cuenta con ese correo');
      else if (err.code === 'auth/invalid-email')          error('El formato del correo no es válido');
      else if (err.code === 'auth/network-request-failed') error('Sin conexión a internet');
      else error('No se pudo enviar el correo. Intenta de nuevo');
    } finally { setEnviandoReset(false); }
  };

  const cerrarReset = () => { setModalReset(false); setEmailReset(''); setResetEnviado(false); };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* StatusBar oscura para que no haya blanco arriba */}
      <StatusBar barStyle="light-content" backgroundColor="#0a0a2e" />

      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0a0a2e' }} pointerEvents="none" />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#0a0a2e' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Toast mensaje={toast.mensaje} tipo={toast.tipo} visible={toast.visible} onHide={ocultar} />

        <ScrollView
          style={{ flex: 1, backgroundColor: '#0a0a2e' }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: s.pad,
            paddingVertical: 40,
            backgroundColor: '#0a0a2e',        // ← clave: mismo color en el content
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
        >
          {/* Contenedor centrado con ancho máximo para tablets */}
          <View style={{ width: '100%', maxWidth: s.cardW }}>

            {/* LOGO */}
            <View style={{ alignItems: 'center', marginBottom: s.logoMb }}>
              <View style={{
                width: s.logoSize, height: s.logoSize, borderRadius: s.logoSize / 2,
                backgroundColor: '#1e90ff',
                justifyContent: 'center', alignItems: 'center', marginBottom: 16,
                shadowColor: '#1e90ff', shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.6, shadowRadius: 20, elevation: 10,
              }}>
                <Ionicons name="calendar" size={s.iconSize} color="#fff" />
              </View>
              <Text style={{ fontSize: s.titleSize, fontWeight: 'bold', color: '#fff', letterSpacing: 1 }}>
                AppAgenda
              </Text>
              <Text style={{ color: '#888', marginTop: 6, fontSize: s.subtitleSz }}>
                {modoRegistro ? 'Crea tu cuenta' : 'Inicia sesión para continuar'}
              </Text>
            </View>

            {/* CAMPOS */}
            {modoRegistro && (
              <Campo label="Nombre de usuario" value={nombre} onChange={setNombre} icono="person-outline" />
            )}

            <Campo label="Correo electrónico" value={email} onChange={setEmail} icono="mail-outline" tipo="email" />

            <Campo
              label="Contraseña" value={password} onChange={setPassword}
              icono="lock-closed-outline" tipo="password"
              mostrarPass={mostrarPass}
              extra={
                <TouchableOpacity onPress={() => setMostrarPass(!mostrarPass)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name={mostrarPass ? 'eye-off-outline' : 'eye-outline'} size={isTablet ? 22 : 20} color="#555" />
                </TouchableOpacity>
              }
            />

            {/* Olvidaste contraseña */}
            {!modoRegistro && (
              <TouchableOpacity
                onPress={() => { setEmailReset(email); setModalReset(true); }}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 6, marginTop: 4, marginBottom: 6,
                  paddingVertical: isTablet ? 14 : 11, borderRadius: 12,
                  backgroundColor: 'rgba(30,144,255,0.08)',
                  borderWidth: 1, borderColor: 'rgba(30,144,255,0.18)',
                }}
              >
                <Ionicons name="key-outline" size={isTablet ? 16 : 14} color="#1e90ff" />
                <Text style={{ color: '#1e90ff', fontSize: isTablet ? 15 : 13, fontWeight: '600' }}>
                  ¿Olvidaste tu contraseña?
                </Text>
              </TouchableOpacity>
            )}

            {/* Botón principal */}
            <Pressable
              onPress={handleSubmit} disabled={cargando}
              style={({ pressed }) => ({
                backgroundColor: cargando ? '#1560aa' : pressed ? '#1670cc' : '#1e90ff',
                paddingVertical: s.btnPadV, borderRadius: 16, alignItems: 'center',
                marginTop: 8,
                shadowColor: '#1e90ff', shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
              })}
            >
              <Text style={{ color: '#fff', fontSize: s.btnSz, fontWeight: 'bold', letterSpacing: 0.5 }}>
                {cargando ? 'Cargando...' : modoRegistro ? 'Crear cuenta' : 'Iniciar sesión'}
              </Text>
            </Pressable>

            {/* Cambiar modo */}
            <Pressable
              onPress={() => { setModoRegistro(!modoRegistro); setNombre(''); }}
              style={{ alignItems: 'center', marginTop: 16, padding: 10 }}
            >
              <Text style={{ color: '#888', fontSize: isTablet ? 16 : 15 }}>
                {modoRegistro ? '¿Ya tienes cuenta?  ' : '¿No tienes cuenta?  '}
                <Text style={{ color: '#1e90ff', fontWeight: 'bold' }}>
                  {modoRegistro ? 'Inicia sesión' : 'Regístrate'}
                </Text>
              </Text>
            </Pressable>

          </View>
        </ScrollView>

        {/* ── MODAL RESTABLECER ── */}
        <Modal visible={modalReset} transparent animationType="fade" onRequestClose={cerrarReset}>
          <View style={{
            flex: 1, justifyContent: 'center', alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.75)', padding: 24,
          }}>
            <View style={{
              backgroundColor: '#12123a', borderRadius: 24, padding: 28,
              width: '100%', maxWidth: isTablet ? 480 : 400,
              borderWidth: 1, borderColor: '#2a2a5e',
            }}>
              {!resetEnviado ? (
                <>
                  <View style={{
                    width: 64, height: 64, borderRadius: 32,
                    backgroundColor: '#1e90ff22', justifyContent: 'center',
                    alignItems: 'center', alignSelf: 'center', marginBottom: 20,
                  }}>
                    <Ionicons name="key-outline" size={30} color="#1e90ff" />
                  </View>
                  <Text style={{ color: '#fff', fontSize: isTablet ? 22 : 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>
                    Restablecer contraseña
                  </Text>
                  <Text style={{ color: '#888', fontSize: isTablet ? 15 : 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
                    Ingresa tu correo y te enviaremos un enlace para crear una nueva contraseña.
                  </Text>
                  <View style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: '#1a1a3e', borderRadius: 14,
                    borderWidth: 1, borderColor: '#2a2a5e', paddingHorizontal: 16, marginBottom: 20,
                  }}>
                    <Ionicons name="mail-outline" size={20} color="#1e90ff" />
                    <TextInput
                      value={emailReset} onChangeText={setEmailReset}
                      placeholder="correo@ejemplo.com" placeholderTextColor="#555"
                      keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                      style={{ flex: 1, color: '#fff', fontSize: s.inputSz, paddingVertical: s.inputPadV, paddingLeft: 12 }}
                    />
                  </View>
                  <Pressable
                    onPress={handleReset} disabled={enviandoReset}
                    style={{ backgroundColor: enviandoReset ? '#1560aa' : '#1e90ff', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginBottom: 12, elevation: 4 }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: isTablet ? 17 : 16 }}>
                      {enviandoReset ? 'Enviando...' : 'Enviar enlace'}
                    </Text>
                  </Pressable>
                  <Pressable onPress={cerrarReset} style={{ paddingVertical: 12, alignItems: 'center' }}>
                    <Text style={{ color: '#888', fontSize: 15 }}>Cancelar</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <View style={{
                    width: 72, height: 72, borderRadius: 36,
                    backgroundColor: '#22c55e22', justifyContent: 'center',
                    alignItems: 'center', alignSelf: 'center', marginBottom: 20,
                  }}>
                    <Ionicons name="checkmark-circle" size={44} color="#22c55e" />
                  </View>
                  <Text style={{ color: '#fff', fontSize: isTablet ? 22 : 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 }}>
                    ¡Correo enviado!
                  </Text>
                  <Text style={{ color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 6 }}>
                    Revisa tu bandeja de entrada en
                  </Text>
                  <Text style={{ color: '#1e90ff', fontSize: 15, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 }}>
                    {emailReset}
                  </Text>
                  <Text style={{ color: '#666', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 28 }}>
                    Si no aparece en unos minutos, revisa la carpeta de spam.
                  </Text>
                  <Pressable
                    onPress={cerrarReset}
                    style={{ backgroundColor: '#1e90ff', paddingVertical: 16, borderRadius: 14, alignItems: 'center', elevation: 4 }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Entendido</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </Modal>

      </KeyboardAvoidingView>
    </>
  );
}