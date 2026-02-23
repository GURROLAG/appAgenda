import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import {
  EmailAuthProvider, reauthenticateWithCredential,
  updateEmail, updatePassword,
} from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { useState } from 'react';
import {
  Image, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { ConfirmModal } from '../../src/components/ConfirmModal';
import { Toast, useToast } from '../../src/components/Toast';
import { useTema } from '../../src/context/TemaContext';
import { cerrarSesion } from '../../src/firebase/authService';
import { auth } from '../../src/firebase/firebaseConfig';
import { db } from '../../src/firebase/firestore';
import { useUsuario } from '../../src/hooks/useUsuario';

type ModalTipo = 'nombre' | 'email' | 'password' | null;

export default function PerfilScreen() {
  const { usuario } = useUsuario();
  const { colors, darkMode, toggleDarkMode } = useTema();
  const { toast, ocultar, exito, error, advertencia } = useToast();
  const [modalTipo, setModalTipo] = useState<ModalTipo>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [passwordActual, setPasswordActual] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [mostrarPass, setMostrarPass] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const abrirModal = (tipo: ModalTipo) => {
    setNuevoNombre(usuario?.nombre || '');
    setNuevoEmail(usuario?.email || '');
    setPasswordActual('');
    setNuevaPassword('');
    setConfirmarPassword('');
    setMostrarPass(false);
    setModalTipo(tipo);
  };

  const reautenticar = async (password: string) => {
    const user = auth.currentUser;
    if (!user || !user.email) throw new Error('No hay usuario autenticado');
    const credencial = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credencial);
  };

  // Seleccionar y guardar foto de perfil como base64 en Firestore
  const seleccionarFoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      advertencia('Se necesita permiso para acceder a la galería');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.4,
      base64: true,
    });

    if (result.canceled || !result.assets[0].base64) return;

    setSubiendoFoto(true);
    try {
      const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      await updateDoc(doc(db, 'usuarios', usuario!.uid), { fotoPerfil: base64 });
      exito('Foto de perfil actualizada');
    } catch {
      error('No se pudo actualizar la foto');
    } finally {
      setSubiendoFoto(false);
    }
  };

  const guardarNombre = async () => {
    if (!nuevoNombre.trim()) { advertencia('El nombre no puede estar vacío'); return; }
    setGuardando(true);
    try {
      await updateDoc(doc(db, 'usuarios', usuario!.uid), { nombre: nuevoNombre.trim() });
      exito('Nombre actualizado correctamente');
      setModalTipo(null);
    } catch { error('No se pudo actualizar el nombre'); }
    finally { setGuardando(false); }
  };

  const guardarEmail = async () => {
    if (!nuevoEmail.trim()) { advertencia('El correo no puede estar vacío'); return; }
    if (!passwordActual) { advertencia('Ingresa tu contraseña actual para confirmar'); return; }
    setGuardando(true);
    try {
      await reautenticar(passwordActual);
      await updateEmail(auth.currentUser!, nuevoEmail.trim());
      await updateDoc(doc(db, 'usuarios', usuario!.uid), { email: nuevoEmail.trim() });
      exito('Correo actualizado correctamente');
      setModalTipo(null);
    } catch (err: any) {
      if (err.code === 'auth/wrong-password') error('Contraseña actual incorrecta');
      else if (err.code === 'auth/email-already-in-use') error('Este correo ya está en uso');
      else error('No se pudo actualizar el correo');
    } finally { setGuardando(false); }
  };

  const guardarPassword = async () => {
    if (!passwordActual) { advertencia('Ingresa tu contraseña actual'); return; }
    if (nuevaPassword.length < 6) { advertencia('La nueva contraseña debe tener al menos 6 caracteres'); return; }
    if (nuevaPassword !== confirmarPassword) { error('Las contraseñas no coinciden'); return; }
    setGuardando(true);
    try {
      await reautenticar(passwordActual);
      await updatePassword(auth.currentUser!, nuevaPassword);
      exito('Contraseña actualizada correctamente');
      setModalTipo(null);
    } catch (err: any) {
      if (err.code === 'auth/wrong-password') error('Contraseña actual incorrecta');
      else error('No se pudo actualizar la contraseña');
    } finally { setGuardando(false); }
  };

  const opcion = (icono: string, titulo: string, subtitulo: string, onPress: () => void) => (
    <TouchableOpacity onPress={onPress} style={{ backgroundColor: colors.card, borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: darkMode ? 0.3 : 0.06, shadowRadius: 6, elevation: 3 }}>
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
        <Ionicons name={icono as any} size={22} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: 'bold', color: colors.text, fontSize: 16 }}>{titulo}</Text>
        <Text style={{ color: colors.subtext, fontSize: 13, marginTop: 2 }} numberOfLines={1}>{subtitulo}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Toast mensaje={toast.mensaje} tipo={toast.tipo} visible={toast.visible} onHide={ocultar} />

      <ScrollView contentContainerStyle={{ padding: 24 }}>
        {/* AVATAR CON FOTO */}
        <View style={{ alignItems: 'center', marginTop: 20, marginBottom: 32 }}>
          <TouchableOpacity onPress={seleccionarFoto} disabled={subiendoFoto} style={{ position: 'relative' }}>
            {usuario?.fotoPerfil ? (
              <Image
                source={{ uri: usuario.fotoPerfil }}
                style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: colors.primary }}
              />
            ) : (
              <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 }}>
                <Ionicons name="person" size={52} color="#fff" />
              </View>
            )}
            {/* Badge cámara */}
            <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: colors.primary, width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.background }}>
              {subiendoFoto
                ? <Ionicons name="sync" size={14} color="#fff" />
                : <Ionicons name="camera" size={14} color="#fff" />
              }
            </View>
          </TouchableOpacity>

          <Text style={{ fontSize: 22, fontWeight: 'bold', marginTop: 14, color: colors.text }}>{usuario?.nombre ?? 'Usuario'}</Text>
          <Text style={{ color: colors.subtext, marginTop: 4, fontSize: 14 }}>{usuario?.email}</Text>
          <View style={{ backgroundColor: usuario?.rol === 'admin' ? colors.primary : colors.border, paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20, marginTop: 10 }}>
            <Text style={{ color: usuario?.rol === 'admin' ? '#fff' : colors.subtext, fontSize: 13, fontWeight: 'bold' }}>
              {usuario?.rol === 'admin' ? '🛡️ Administrador' : '👤 Usuario'}
            </Text>
          </View>
          <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 8 }}>Toca la foto para cambiarla</Text>
        </View>

        {/* MI CUENTA */}
        <Text style={{ color: colors.subtext, fontWeight: 'bold', fontSize: 12, marginBottom: 10, marginLeft: 4, letterSpacing: 1 }}>MI CUENTA</Text>
        <View style={{ gap: 10, marginBottom: 24 }}>
          {opcion('person-outline', 'Nombre de usuario', usuario?.nombre || '', () => abrirModal('nombre'))}
          {opcion('mail-outline', 'Correo electrónico', usuario?.email || '', () => abrirModal('email'))}
          {opcion('lock-closed-outline', 'Contraseña', 'Cambiar contraseña', () => abrirModal('password'))}
        </View>

        {/* PREFERENCIAS */}
        <Text style={{ color: colors.subtext, fontWeight: 'bold', fontSize: 12, marginBottom: 10, marginLeft: 4, letterSpacing: 1 }}>PREFERENCIAS</Text>
        <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: darkMode ? 0.3 : 0.06, shadowRadius: 6, elevation: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#1a1a3e', justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name={darkMode ? 'moon' : 'sunny'} size={22} color="#fff" />
            </View>
            <View>
              <Text style={{ fontWeight: 'bold', color: colors.text, fontSize: 16 }}>Modo oscuro</Text>
              <Text style={{ color: colors.subtext, fontSize: 13 }}>{darkMode ? 'Activado' : 'Desactivado'}</Text>
            </View>
          </View>
          <Switch value={darkMode} onValueChange={toggleDarkMode} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
        </View>

        {/* CERRAR SESIÓN */}
        <Pressable onPress={() => setConfirmLogout(true)} style={({ pressed }) => ({ backgroundColor: pressed ? '#cc0000' : colors.danger, paddingVertical: 18, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10, elevation: 5 })}>
          <Ionicons name="log-out-outline" size={22} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Cerrar sesión</Text>
        </Pressable>
      </ScrollView>

      {/* Confirm logout */}
      <ConfirmModal visible={confirmLogout} titulo="Cerrar sesión" mensaje="¿Estás seguro que deseas salir de tu cuenta?" tipo="warning" textoConfirmar="Salir"
        onCancelar={() => setConfirmLogout(false)}
        onConfirmar={async () => { setConfirmLogout(false); await cerrarSesion(); router.replace('/login'); }} />

      {/* Modal Nombre */}
      <Modal visible={modalTipo === 'nombre'} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
            <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 24 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 }} />
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text, marginBottom: 20 }}>Cambiar nombre</Text>
              <TextInput value={nuevoNombre} onChangeText={setNuevoNombre} placeholder="Tu nombre" placeholderTextColor={colors.border}
                style={{ backgroundColor: colors.input, padding: 14, borderRadius: 12, color: colors.text, fontSize: 16, marginBottom: 24 }} />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable onPress={() => setModalTipo(null)} style={{ flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center', backgroundColor: colors.input }}>
                  <Text style={{ color: colors.text, fontWeight: 'bold' }}>Cancelar</Text>
                </Pressable>
                <Pressable onPress={guardarNombre} disabled={guardando} style={{ flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center', backgroundColor: colors.primary }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>{guardando ? 'Guardando...' : 'Guardar'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Email */}
      <Modal visible={modalTipo === 'email'} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
            <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 24 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 }} />
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text, marginBottom: 20 }}>Cambiar correo</Text>
              <Text style={{ color: colors.subtext, marginBottom: 8, fontSize: 14 }}>Nuevo correo</Text>
              <TextInput value={nuevoEmail} onChangeText={setNuevoEmail} keyboardType="email-address" autoCapitalize="none" placeholder="nuevo@correo.com" placeholderTextColor={colors.border}
                style={{ backgroundColor: colors.input, padding: 14, borderRadius: 12, color: colors.text, fontSize: 16, marginBottom: 16 }} />
              <Text style={{ color: colors.subtext, marginBottom: 8, fontSize: 14 }}>Contraseña actual</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.input, borderRadius: 12, paddingHorizontal: 14, marginBottom: 24 }}>
                <TextInput value={passwordActual} onChangeText={setPasswordActual} secureTextEntry={!mostrarPass} placeholder="Tu contraseña actual" placeholderTextColor={colors.border}
                  style={{ flex: 1, padding: 14, color: colors.text, fontSize: 16 }} />
                <TouchableOpacity onPress={() => setMostrarPass(!mostrarPass)}>
                  <Ionicons name={mostrarPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.subtext} />
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable onPress={() => setModalTipo(null)} style={{ flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center', backgroundColor: colors.input }}>
                  <Text style={{ color: colors.text, fontWeight: 'bold' }}>Cancelar</Text>
                </Pressable>
                <Pressable onPress={guardarEmail} disabled={guardando} style={{ flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center', backgroundColor: colors.primary }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>{guardando ? 'Guardando...' : 'Guardar'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Contraseña */}
      <Modal visible={modalTipo === 'password'} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
            <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 24 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 }} />
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text, marginBottom: 20 }}>Cambiar contraseña</Text>
              {[
                { label: 'Contraseña actual', value: passwordActual, onChange: setPasswordActual, placeholder: 'Tu contraseña actual', showToggle: true },
                { label: 'Nueva contraseña', value: nuevaPassword, onChange: setNuevaPassword, placeholder: 'Mínimo 6 caracteres', showToggle: false },
                { label: 'Confirmar contraseña', value: confirmarPassword, onChange: setConfirmarPassword, placeholder: 'Repite la nueva contraseña', showToggle: false },
              ].map((campo, i) => (
                <View key={i} style={{ marginBottom: i === 2 ? 24 : 16 }}>
                  <Text style={{ color: colors.subtext, marginBottom: 8, fontSize: 14 }}>{campo.label}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.input, borderRadius: 12, paddingHorizontal: 14 }}>
                    <TextInput value={campo.value} onChangeText={campo.onChange} secureTextEntry={!mostrarPass} placeholder={campo.placeholder} placeholderTextColor={colors.border}
                      style={{ flex: 1, padding: 14, color: colors.text, fontSize: 16 }} />
                    {campo.showToggle && (
                      <TouchableOpacity onPress={() => setMostrarPass(!mostrarPass)}>
                        <Ionicons name={mostrarPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.subtext} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable onPress={() => setModalTipo(null)} style={{ flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center', backgroundColor: colors.input }}>
                  <Text style={{ color: colors.text, fontWeight: 'bold' }}>Cancelar</Text>
                </Pressable>
                <Pressable onPress={guardarPassword} disabled={guardando} style={{ flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center', backgroundColor: colors.primary }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>{guardando ? 'Guardando...' : 'Guardar'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}