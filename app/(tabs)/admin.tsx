import { Ionicons } from '@expo/vector-icons';
import { sendPasswordResetEmail } from 'firebase/auth';
import { collection, deleteDoc, doc, onSnapshot, query, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { ConfirmModal } from '../../src/components/ConfirmModal';
import { Toast, useToast } from '../../src/components/Toast';
import { useTema } from '../../src/context/TemaContext';
import { auth } from '../../src/firebase/firebaseConfig';
import { db } from '../../src/firebase/firestore';
import { useUsuario } from '../../src/hooks/useUsuario';
import { r } from '../../src/utils/responsive';

interface UsuarioFirestore {
  uid: string;
  email: string;
  nombre: string;
  rol: 'admin' | 'usuario';
  activo: boolean;
  fotoPerfil?: string;
}

interface ConfirmConfig {
  visible: boolean;
  titulo: string;
  mensaje: string;
  tipo: 'danger' | 'warning' | 'info';
  textoConfirmar: string;
  onConfirmar: () => void;
}

export default function AdminScreen() {
  const { usuario, esAdmin } = useUsuario();
  const { colors, darkMode } = useTema();
  const { toast, ocultar, exito, error, advertencia } = useToast();

  const [usuarios, setUsuarios] = useState<UsuarioFirestore[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioFirestore | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmConfig>({
    visible: false, titulo: '', mensaje: '', tipo: 'info', textoConfirmar: '', onConfirmar: () => {},
  });

  const mostrarConfirm = (config: Omit<ConfirmConfig, 'visible'>) =>
    setConfirm({ ...config, visible: true });
  const cerrarConfirm = () => setConfirm((c) => ({ ...c, visible: false }));

  useEffect(() => {
    const q = query(collection(db, 'usuarios'));
    const unsub = onSnapshot(q, (snap) => {
      setUsuarios(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UsuarioFirestore)));
      setCargando(false);
    });
    return unsub;
  }, []);

  const cambiarRol = (u: UsuarioFirestore) => {
    if (u.uid === usuario?.uid) { advertencia('No puedes cambiar tu propio rol'); return; }
    const nuevoRol = u.rol === 'admin' ? 'usuario' : 'admin';
    mostrarConfirm({
      titulo: 'Cambiar rol',
      mensaje: `¿Deseas cambiar el rol de ${u.nombre} a "${nuevoRol}"?`,
      tipo: 'info',
      textoConfirmar: 'Confirmar',
      onConfirmar: async () => {
        cerrarConfirm();
        await updateDoc(doc(db, 'usuarios', u.uid), { rol: nuevoRol });
        exito(`Rol de ${u.nombre} actualizado a ${nuevoRol}`);
      },
    });
  };

  const cambiarEstado = (u: UsuarioFirestore) => {
    if (u.uid === usuario?.uid) { advertencia('No puedes desactivarte a ti mismo'); return; }
    const nuevoEstado = !u.activo;
    mostrarConfirm({
      titulo: nuevoEstado ? 'Activar usuario' : 'Desactivar usuario',
      mensaje: `¿Deseas ${nuevoEstado ? 'activar' : 'desactivar'} la cuenta de ${u.nombre}?`,
      tipo: nuevoEstado ? 'info' : 'warning',
      textoConfirmar: nuevoEstado ? 'Activar' : 'Desactivar',
      onConfirmar: async () => {
        cerrarConfirm();
        await updateDoc(doc(db, 'usuarios', u.uid), { activo: nuevoEstado });
        exito(`${u.nombre} fue ${nuevoEstado ? 'activado' : 'desactivado'}`);
      },
    });
  };

  const abrirEditar = (u: UsuarioFirestore) => {
    setUsuarioEditando(u);
    setNuevoNombre(u.nombre);
    setNuevoEmail(u.email);
    setModalVisible(true);
  };

  const guardarEdicion = async () => {
    if (!nuevoNombre.trim()) { advertencia('El nombre no puede estar vacío'); return; }
    if (!nuevoEmail.trim()) { advertencia('El correo no puede estar vacío'); return; }
    setGuardando(true);
    try {
      await updateDoc(doc(db, 'usuarios', usuarioEditando!.uid), {
        nombre: nuevoNombre.trim(),
        email: nuevoEmail.trim(),
      });
      exito('Usuario actualizado correctamente');
      setModalVisible(false);
    } catch {
      error('No se pudo actualizar el usuario');
    } finally {
      setGuardando(false);
    }
  };

  const restablecerPassword = (u: UsuarioFirestore) => {
    mostrarConfirm({
      titulo: 'Restablecer contraseña',
      mensaje: `Se enviará un correo de restablecimiento a ${u.email}. ¿Continuar?`,
      tipo: 'warning',
      textoConfirmar: 'Enviar correo',
      onConfirmar: async () => {
        cerrarConfirm();
        try {
          await sendPasswordResetEmail(auth, u.email);
          exito(`Correo enviado a ${u.email}`);
        } catch {
          error('No se pudo enviar el correo de restablecimiento');
        }
      },
    });
  };

  const eliminarUsuario = (u: UsuarioFirestore) => {
    if (u.uid === usuario?.uid) { advertencia('No puedes eliminarte a ti mismo'); return; }
    mostrarConfirm({
      titulo: 'Eliminar usuario',
      mensaje: `¿Estás seguro de eliminar a ${u.nombre}? Esta acción no se puede deshacer.`,
      tipo: 'danger',
      textoConfirmar: 'Eliminar',
      onConfirmar: async () => {
        cerrarConfirm();
        try {
          await deleteDoc(doc(db, 'usuarios', u.uid));
          exito(`${u.nombre} fue eliminado correctamente`);
        } catch {
          error('No se pudo eliminar el usuario');
        }
      },
    });
  };

  if (!esAdmin) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Ionicons name="lock-closed" size={64} color={colors.danger} />
        <Text style={{ fontSize: r.h2, fontWeight: 'bold', marginTop: 16, color: colors.text }}>Acceso denegado</Text>
        <Text style={{ color: colors.subtext, marginTop: 8 }}>Solo administradores</Text>
      </View>
    );
  }

  if (cargando) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Toast mensaje={toast.mensaje} tipo={toast.tipo} visible={toast.visible} onHide={ocultar} />

      {/* HEADER */}
      <View style={{ backgroundColor: darkMode ? '#1a1a1a' : '#0a0a2e', paddingTop: 50, paddingBottom: 20, paddingHorizontal: r.padH }}>
        <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold' }}>⚙️ Panel Admin</Text>
        <Text style={{ color: '#888', marginTop: 4 }}>{usuarios.length} usuarios registrados</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {usuarios.map((u) => (
          <View key={u.uid} style={{ backgroundColor: colors.card, borderRadius: r.radius, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: darkMode ? 0.3 : 0.08, shadowRadius: 6, elevation: 3, opacity: u.activo ? 1 : 0.55 }}>
            {/* Info */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              {u.fotoPerfil ? (
                <View style={{ marginRight: 12, position: 'relative' }}>
                  <Image source={{ uri: u.fotoPerfil }} style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: u.rol === 'admin' ? colors.primary : colors.border }} />
                  {u.rol === 'admin' && (
                    <View style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: colors.primary, borderRadius: 10, width: 18, height: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: colors.card }}>
                      <Ionicons name="shield-checkmark" size={10} color="#fff" />
                    </View>
                  )}
                </View>
              ) : (
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: u.rol === 'admin' ? colors.primary : colors.border, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <Ionicons name={u.rol === 'admin' ? 'shield-checkmark' : 'person'} size={24} color={u.rol === 'admin' ? '#fff' : colors.subtext} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: r.inputFontSz, color: colors.text }}>{u.nombre}</Text>
                  {u.uid === usuario?.uid && (
                    <View style={{ backgroundColor: '#e8f4ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                      <Text style={{ color: colors.primary, fontSize: r.small, fontWeight: 'bold' }}>Tú</Text>
                    </View>
                  )}
                  {!u.activo && (
                    <View style={{ backgroundColor: '#ffe0e0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                      <Text style={{ color: colors.danger, fontSize: r.small, fontWeight: 'bold' }}>Inactivo</Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: colors.subtext, fontSize: r.label, marginTop: 2 }}>{u.email}</Text>
              </View>
              <View style={{ backgroundColor: u.rol === 'admin' ? colors.primary : colors.input, paddingHorizontal: 10, paddingVertical: 4, borderRadius: r.radiusLg, borderWidth: 1, borderColor: u.rol === 'admin' ? colors.primary : colors.border }}>
                <Text style={{ color: u.rol === 'admin' ? '#fff' : colors.subtext, fontSize: r.small, fontWeight: 'bold' }}>
                  {u.rol === 'admin' ? 'Admin' : 'Usuario'}
                </Text>
              </View>
            </View>

            {/* Acciones */}
            {u.uid !== usuario?.uid && (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={() => cambiarRol(u)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: u.rol === 'admin' ? '#fff3e0' : '#e8f4ff', paddingVertical: 10, borderRadius: 10, gap: 6, borderWidth: 1, borderColor: u.rol === 'admin' ? '#ffa500' : colors.primary }}>
                    <Ionicons name={u.rol === 'admin' ? 'arrow-down-circle-outline' : 'shield-checkmark-outline'} size={16} color={u.rol === 'admin' ? '#ffa500' : colors.primary} />
                    <Text style={{ color: u.rol === 'admin' ? '#ffa500' : colors.primary, fontWeight: 'bold', fontSize: r.small }}>
                      {u.rol === 'admin' ? 'Quitar admin' : 'Hacer admin'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => cambiarEstado(u)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: u.activo ? '#fff0f0' : '#f0fff0', paddingVertical: 10, borderRadius: 10, gap: 6, borderWidth: 1, borderColor: u.activo ? colors.danger : '#32cd32' }}>
                    <Ionicons name={u.activo ? 'ban-outline' : 'checkmark-circle-outline'} size={16} color={u.activo ? colors.danger : '#32cd32'} />
                    <Text style={{ color: u.activo ? colors.danger : '#32cd32', fontWeight: 'bold', fontSize: r.small }}>
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={() => abrirEditar(u)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.input, paddingVertical: 10, borderRadius: 10, gap: 6, borderWidth: 1, borderColor: colors.border }}>
                    <Ionicons name="pencil-outline" size={16} color={colors.text} />
                    <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: r.small }}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => restablecerPassword(u)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff3e0', paddingVertical: 10, borderRadius: 10, gap: 6, borderWidth: 1, borderColor: '#ffa500' }}>
                    <Ionicons name="key-outline" size={16} color="#ffa500" />
                    <Text style={{ color: '#ffa500', fontWeight: 'bold', fontSize: r.small }}>Restablecer</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => eliminarUsuario(u)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff0f0', paddingVertical: 10, borderRadius: 10, gap: 6, borderWidth: 1, borderColor: colors.danger }}>
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  <Text style={{ color: colors.danger, fontWeight: 'bold', fontSize: r.small }}>Eliminar usuario</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Confirm Modal */}
      <ConfirmModal
        visible={confirm.visible}
        titulo={confirm.titulo}
        mensaje={confirm.mensaje}
        tipo={confirm.tipo}
        textoConfirmar={confirm.textoConfirmar}
        onCancelar={cerrarConfirm}
        onConfirmar={confirm.onConfirmar}
      />

      {/* Modal Editar */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
            <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 24 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 }} />
              <Text style={{ fontSize: r.h2, fontWeight: 'bold', color: colors.text, marginBottom: 20 }}>✏️ Editar usuario</Text>
              <Text style={{ color: colors.subtext, marginBottom: 8, fontSize: r.body }}>Nombre</Text>
              <TextInput value={nuevoNombre} onChangeText={setNuevoNombre} placeholder="Nombre" placeholderTextColor={colors.border}
                style={{ backgroundColor: colors.input, padding: 14, borderRadius: r.radiusSm, color: colors.text, fontSize: r.inputFontSz, marginBottom: 16 }} />
              <Text style={{ color: colors.subtext, marginBottom: 8, fontSize: r.body }}>Correo electrónico</Text>
              <TextInput value={nuevoEmail} onChangeText={setNuevoEmail} keyboardType="email-address" autoCapitalize="none"
                placeholder="Correo" placeholderTextColor={colors.border}
                style={{ backgroundColor: colors.input, padding: 14, borderRadius: r.radiusSm, color: colors.text, fontSize: r.inputFontSz, marginBottom: 24 }} />
              <View style={{ flexDirection: 'row', gap: r.gap }}>
                <Pressable onPress={() => setModalVisible(false)} style={{ flex: 1, paddingVertical: r.inputPadV, borderRadius: r.radius, alignItems: 'center', backgroundColor: colors.input }}>
                  <Text style={{ color: colors.text, fontWeight: 'bold' }}>Cancelar</Text>
                </Pressable>
                <Pressable onPress={guardarEdicion} disabled={guardando} style={{ flex: 1, paddingVertical: r.inputPadV, borderRadius: r.radius, alignItems: 'center', backgroundColor: colors.primary }}>
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