import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { useState } from 'react';
import {
  ActivityIndicator, Image, Modal, Pressable,
  ScrollView, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConfirmModal } from '../../src/components/ConfirmModal';
import { Toast, useToast } from '../../src/components/Toast';
import { useTema } from '../../src/context/TemaContext';
import { cerrarSesion } from '../../src/firebase/authService';
import { auth } from '../../src/firebase/firebaseConfig';
import { db } from '../../src/firebase/firestore';
import { useUsuario } from '../../src/hooks/useUsuario';
import { isTablet, r } from '../../src/utils/responsive';

// ─── FilaItem fuera del componente (evita re-montaje) ─────────────────────────
function FilaItem({ icono, iconoColor, titulo, subtitulo, derecha, onPress, colors }: {
  icono: string; iconoColor: string; titulo: string; subtitulo?: string;
  derecha?: React.ReactNode; onPress?: () => void; colors: any;
}) {
  const inner = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 6 }}>
      <View style={{ width: isTablet ? 46 : 38, height: isTablet ? 46 : 38,
        borderRadius: isTablet ? 23 : 19, backgroundColor: iconoColor + '18',
        justifyContent: 'center', alignItems: 'center' }}>
        <Ionicons name={icono as any} size={isTablet ? 21 : 18} color={iconoColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: r.body, fontWeight: '600' }}>{titulo}</Text>
        {subtitulo ? <Text style={{ color: colors.subtext, fontSize: r.small, marginTop: 1 }}>{subtitulo}</Text> : null}
      </View>
      {derecha}
    </View>
  );
  return onPress
    ? <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{inner}</TouchableOpacity>
    : inner;
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────
export default function PerfilScreen() {
  const { colors, darkMode, toggleDarkMode } = useTema();
  const { usuario } = useUsuario();
  const { toast, ocultar, exito, error: toastError } = useToast();

  const [subiendoFoto, setSubiendoFoto] = useState(false);

  // Modal cambiar contraseña
  const [modalPass, setModalPass]           = useState(false);
  const [passActual, setPassActual]         = useState('');
  const [passNueva, setPassNueva]           = useState('');
  const [passConfirm, setPassConfirm]       = useState('');
  const [mostrarActual, setMostrarActual]   = useState(false);
  const [mostrarNueva, setMostrarNueva]     = useState(false);
  const [mostrarConfirm, setMostrarConfirm] = useState(false);
  const [cambiandoPass, setCambiandoPass]   = useState(false);
  const [errPass, setErrPass]               = useState('');

  // Modal editar nombre
  const [modalNombre, setModalNombre]         = useState(false);
  const [nuevoNombre, setNuevoNombre]         = useState('');
  const [guardandoNombre, setGuardandoNombre] = useState(false);
  const [errNombre, setErrNombre]             = useState('');

  // ConfirmModal cerrar sesión
  const [confirmLogout, setConfirmLogout] = useState(false);

  const avatarSize = isTablet ? 130 : 100;
  const rolLabel   = usuario?.rol === 'admin' ? 'Administrador' : 'Usuario';
  const rolColor   = usuario?.rol === 'admin' ? '#f59e0b' : colors.primary;
  const Separador  = () => <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 10 }} />;

  // ─── Foto ────────────────────────────────────────────────────────────────
  const cambiarFoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      toastError('Necesitamos permiso para acceder a tu galería');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64 || !usuario?.uid) return;
    setSubiendoFoto(true);
    try {
      await updateDoc(doc(db, 'usuarios', usuario.uid), {
        fotoPerfil: `data:image/jpeg;base64,${result.assets[0].base64}`,
      });
      exito('Foto de perfil actualizada');
    } catch {
      toastError('No se pudo actualizar la foto');
    } finally {
      setSubiendoFoto(false);
    }
  };

  // ─── Nombre ──────────────────────────────────────────────────────────────
  const abrirModalNombre = () => {
    setNuevoNombre(usuario?.nombre ?? '');
    setErrNombre('');
    setModalNombre(true);
  };

  const handleGuardarNombre = async () => {
    setErrNombre('');
    const trimmed = nuevoNombre.trim();
    if (!trimmed)          { setErrNombre('El nombre no puede estar vacío'); return; }
    if (trimmed.length < 2){ setErrNombre('Mínimo 2 caracteres'); return; }
    if (trimmed === usuario?.nombre) { setModalNombre(false); return; }
    if (!usuario?.uid) return;
    setGuardandoNombre(true);
    try {
      await updateDoc(doc(db, 'usuarios', usuario.uid), { nombre: trimmed });
      setModalNombre(false);
      exito('Nombre actualizado correctamente');
    } catch {
      setErrNombre('No se pudo guardar. Intenta de nuevo.');
    } finally {
      setGuardandoNombre(false);
    }
  };

  // ─── Contraseña ──────────────────────────────────────────────────────────
  const handleCambiarPass = async () => {
    setErrPass('');
    if (!passActual || !passNueva || !passConfirm) { setErrPass('Completa todos los campos'); return; }
    if (passNueva.length < 6)    { setErrPass('Mínimo 6 caracteres'); return; }
    if (passNueva !== passConfirm){ setErrPass('Las contraseñas nuevas no coinciden'); return; }
    const user = auth.currentUser;
    if (!user?.email) return;
    setCambiandoPass(true);
    try {
      const cred = EmailAuthProvider.credential(user.email, passActual);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, passNueva);
      setModalPass(false);
      setPassActual(''); setPassNueva(''); setPassConfirm('');
      exito('Contraseña actualizada correctamente');
    } catch (err: any) {
      if (['auth/wrong-password','auth/invalid-credential'].includes(err.code))
        setErrPass('La contraseña actual es incorrecta');
      else if (err.code === 'auth/too-many-requests')
        setErrPass('Demasiados intentos. Espera un momento');
      else
        setErrPass('Ocurrió un error. Intenta de nuevo');
    } finally {
      setCambiandoPass(false);
    }
  };

  const cerrarModalPass = () => {
    setModalPass(false);
    setPassActual(''); setPassNueva(''); setPassConfirm(''); setErrPass('');
  };

  // ─── Logout ──────────────────────────────────────────────────────────────
  const doLogout = async () => {
    setConfirmLogout(false);
    await cerrarSesion();
    router.replace('/login');
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <Toast mensaje={toast.mensaje} tipo={toast.tipo} visible={toast.visible} onHide={ocultar} />

      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: r.padH, paddingBottom: 40,
        alignItems: 'center', maxWidth: r.maxW, alignSelf: 'center', width: '100%' }}
        showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ width: '100%', paddingTop: 20, marginBottom: 28 }}>
          <Text style={{ fontSize: r.h1, fontWeight: 'bold', color: colors.text }}>Mi Perfil</Text>
          <Text style={{ color: colors.subtext, fontSize: r.body, marginTop: 4 }}>Gestiona tu cuenta</Text>
        </View>

        {/* Avatar */}
        <TouchableOpacity onPress={cambiarFoto} disabled={subiendoFoto} style={{ marginBottom: 10 }}>
          <View style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2,
            borderWidth: 3, borderColor: colors.primary, overflow: 'hidden',
            shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 }}>
            {subiendoFoto ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.input }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : usuario?.fotoPerfil ? (
              <Image source={{ uri: usuario.fotoPerfil }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary + '18' }}>
                <Ionicons name="person" size={avatarSize * 0.5} color={colors.primary} />
              </View>
            )}
          </View>
          <View style={{ position: 'absolute', bottom: 0, right: 0,
            width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary,
            justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.background }}>
            <Ionicons name="camera" size={16} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={{ color: colors.subtext, fontSize: r.small, marginBottom: 28 }}>Toca para cambiar foto</Text>

        {/* Card: Información */}
        <View style={{ width: '100%', backgroundColor: colors.card, borderRadius: r.cardRadius,
          padding: r.cardPad, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
          shadowOpacity: darkMode ? 0.2 : 0.06, shadowRadius: 8, elevation: 3 }}>
          <Text style={{ color: colors.subtext, fontSize: r.small, fontWeight: '700',
            textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>Información</Text>
          <FilaItem icono="person-outline" iconoColor={colors.primary} colors={colors}
            titulo={usuario?.nombre ?? '—'} subtitulo="Nombre · Toca para editar"
            onPress={abrirModalNombre}
            derecha={<Ionicons name="create-outline" size={18} color={colors.primary} />} />
          <Separador />
          <FilaItem icono="mail-outline" iconoColor="#3b82f6" colors={colors}
            titulo={usuario?.email ?? '—'} subtitulo="Correo electrónico" />
          <Separador />
          <FilaItem colors={colors}
            icono={usuario?.rol === 'admin' ? 'shield-checkmark-outline' : 'person-circle-outline'}
            iconoColor={rolColor} titulo={rolLabel} subtitulo="Rol en el sistema"
            derecha={
              <View style={{ backgroundColor: rolColor + '20', paddingHorizontal: 10, paddingVertical: 3,
                borderRadius: 20, borderWidth: 1, borderColor: rolColor + '40' }}>
                <Text style={{ color: rolColor, fontSize: r.small, fontWeight: '700' }}>
                  {usuario?.rol?.toUpperCase() ?? 'USER'}
                </Text>
              </View>
            } />
        </View>

        {/* Card: Seguridad */}
        <View style={{ width: '100%', backgroundColor: colors.card, borderRadius: r.cardRadius,
          padding: r.cardPad, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
          shadowOpacity: darkMode ? 0.2 : 0.06, shadowRadius: 8, elevation: 3 }}>
          <Text style={{ color: colors.subtext, fontSize: r.small, fontWeight: '700',
            textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>Seguridad</Text>
          <FilaItem icono="lock-closed-outline" iconoColor="#8b5cf6" colors={colors}
            titulo="Cambiar contraseña" subtitulo="Actualiza tu contraseña de acceso"
            onPress={() => setModalPass(true)}
            derecha={<Ionicons name="chevron-forward" size={18} color={colors.subtext} />} />
        </View>

        {/* Card: Apariencia */}
        <View style={{ width: '100%', backgroundColor: colors.card, borderRadius: r.cardRadius,
          padding: r.cardPad, marginBottom: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
          shadowOpacity: darkMode ? 0.2 : 0.06, shadowRadius: 8, elevation: 3 }}>
          <Text style={{ color: colors.subtext, fontSize: r.small, fontWeight: '700',
            textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>Apariencia</Text>
          <FilaItem colors={colors}
            icono={darkMode ? 'sunny-outline' : 'moon-outline'}
            iconoColor={darkMode ? '#f59e0b' : '#6366f1'}
            titulo={darkMode ? 'Modo claro' : 'Modo oscuro'}
            subtitulo={darkMode ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            onPress={toggleDarkMode}
            derecha={
              <View style={{ width: 46, height: 26, borderRadius: 13,
                backgroundColor: darkMode ? colors.primary : colors.border,
                justifyContent: 'center', paddingHorizontal: 3 }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff',
                  alignSelf: darkMode ? 'flex-end' : 'flex-start',
                  shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 }} />
              </View>
            } />
        </View>

        {/* Cerrar sesión */}
        <Pressable onPress={() => setConfirmLogout(true)}
          style={({ pressed }) => ({ width: '100%', flexDirection: 'row', alignItems: 'center',
            justifyContent: 'center', gap: 10,
            backgroundColor: pressed ? '#dc2626' : '#ef4444',
            paddingVertical: r.btnPadV, borderRadius: r.btnRadius,
            shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 })}>
          <Ionicons name="log-out-outline" size={20} color="#fff" />
          <Text style={{ color: '#fff', fontSize: r.btnFontSz, fontWeight: 'bold' }}>Cerrar sesión</Text>
        </Pressable>

      </ScrollView>

      {/* ── ConfirmModal: Cerrar sesión ── */}
      <ConfirmModal
        visible={confirmLogout}
        tipo="danger"
        titulo="Cerrar sesión"
        mensaje={`¿Estás seguro que deseas salir, ${usuario?.nombre?.split(' ')[0] ?? 'usuario'}? Tendrás que iniciar sesión de nuevo.`}
        textoConfirmar="Salir"
        textoCancelar="Cancelar"
        onCancelar={() => setConfirmLogout(false)}
        onConfirmar={doLogout}
      />

      {/* ── Modal: Editar nombre ── */}
      <Modal visible={modalNombre} transparent animationType="slide" onRequestClose={() => setModalNombre(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={() => setModalNombre(false)} />
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
            padding: 28, paddingBottom: 40 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border,
              alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ fontSize: r.h2, fontWeight: 'bold', color: colors.text, marginBottom: 6 }}>
              Editar nombre
            </Text>
            <Text style={{ color: colors.subtext, fontSize: r.body, marginBottom: 24 }}>
              Este nombre aparece en eventos y documentos compartidos.
            </Text>
            {errNombre ? (
              <View style={{ backgroundColor: '#fee2e2', borderRadius: 12, padding: 12, marginBottom: 16,
                flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="alert-circle-outline" size={18} color="#ef4444" />
                <Text style={{ color: '#ef4444', fontSize: r.body, flex: 1 }}>{errNombre}</Text>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.input,
              borderRadius: r.radius, borderWidth: 1, borderColor: colors.border,
              paddingHorizontal: 14, marginBottom: 24 }}>
              <Ionicons name="person-outline" size={18} color={colors.subtext} style={{ marginRight: 10 }} />
              <TextInput value={nuevoNombre} onChangeText={setNuevoNombre}
                placeholder="Tu nombre completo" placeholderTextColor={colors.subtext}
                autoCapitalize="words" autoCorrect={false} autoFocus
                style={{ flex: 1, color: colors.text, fontSize: r.body, paddingVertical: 16 }} />
              {nuevoNombre.length > 0 && (
                <TouchableOpacity onPress={() => setNuevoNombre('')}>
                  <Ionicons name="close-circle" size={18} color={colors.subtext} />
                </TouchableOpacity>
              )}
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable onPress={() => setModalNombre(false)}
                style={{ flex: 1, paddingVertical: 16, borderRadius: r.radius,
                  alignItems: 'center', backgroundColor: colors.input }}>
                <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: r.body }}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={handleGuardarNombre} disabled={guardandoNombre}
                style={{ flex: 1, paddingVertical: 16, borderRadius: r.radius, alignItems: 'center',
                  backgroundColor: guardandoNombre ? colors.primary + '88' : colors.primary }}>
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: r.body }}>
                  {guardandoNombre ? 'Guardando...' : 'Guardar'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal: Cambiar contraseña ── */}
      <Modal visible={modalPass} transparent animationType="slide" onRequestClose={cerrarModalPass}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={cerrarModalPass} />
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
            padding: 28, paddingBottom: 40 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border,
              alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ fontSize: r.h2, fontWeight: 'bold', color: colors.text, marginBottom: 6 }}>
              Cambiar contraseña
            </Text>
            <Text style={{ color: colors.subtext, fontSize: r.body, marginBottom: 24 }}>
              Ingresa tu contraseña actual y la nueva.
            </Text>
            {errPass ? (
              <View style={{ backgroundColor: '#fee2e2', borderRadius: 12, padding: 12, marginBottom: 16,
                flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="alert-circle-outline" size={18} color="#ef4444" />
                <Text style={{ color: '#ef4444', fontSize: r.body, flex: 1 }}>{errPass}</Text>
              </View>
            ) : null}
            {([
              { label: 'Contraseña actual',          value: passActual,  onChange: setPassActual,  mostrar: mostrarActual,  toggle: () => setMostrarActual(!mostrarActual) },
              { label: 'Nueva contraseña',            value: passNueva,   onChange: setPassNueva,   mostrar: mostrarNueva,   toggle: () => setMostrarNueva(!mostrarNueva) },
              { label: 'Confirmar nueva contraseña',  value: passConfirm, onChange: setPassConfirm, mostrar: mostrarConfirm, toggle: () => setMostrarConfirm(!mostrarConfirm) },
            ] as const).map((campo, i) => (
              <View key={i} style={{ marginBottom: 14 }}>
                <Text style={{ color: colors.subtext, fontSize: r.small, marginBottom: 6 }}>{campo.label}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.input,
                  borderRadius: r.radius, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14 }}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.subtext} style={{ marginRight: 10 }} />
                  <TextInput value={campo.value} onChangeText={campo.onChange}
                    secureTextEntry={!campo.mostrar} autoCapitalize="none" autoCorrect={false}
                    style={{ flex: 1, color: colors.text, fontSize: r.body, paddingVertical: 14 }} />
                  <TouchableOpacity onPress={campo.toggle} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name={campo.mostrar ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.subtext} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <Pressable onPress={cerrarModalPass}
                style={{ flex: 1, paddingVertical: 16, borderRadius: r.radius,
                  alignItems: 'center', backgroundColor: colors.input }}>
                <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: r.body }}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={handleCambiarPass} disabled={cambiandoPass}
                style={{ flex: 1, paddingVertical: 16, borderRadius: r.radius, alignItems: 'center',
                  backgroundColor: cambiandoPass ? '#6d28d9' : '#8b5cf6' }}>
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: r.body }}>
                  {cambiandoPass ? 'Guardando...' : 'Guardar'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}