import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Toast, useToast } from '../../src/components/Toast';
import { useTema } from '../../src/context/TemaContext';
import { auth } from '../../src/firebase/firebaseConfig';
import { db } from '../../src/firebase/firestore';
import { r } from '../../src/utils/responsive';

type FiltroEstado = 'todos' | 'abierto' | 'cerrado';
type Prioridad = 'Alta' | 'Media' | 'Baja';
type Expediente = {
  id: string;
  nombreCliente: string;
  casoCliente: string;
  estado?: 'abierto' | 'cerrado';
  usuario?: string;
  numeroExpediente?: string;
  prioridad?: Prioridad | string;
};

export default function ClientesScreen() {
  const [search, setSearch]           = useState('');
  const router                        = useRouter();
  const { colors, darkMode }          = useTema();
  const { toast, ocultar, exito, error: toastError } = useToast();
  const [modalNuevo, setModalNuevo]   = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [guardando, setGuardando]     = useState(false);
  const insets                        = useSafeAreaInsets();
  const [expedientes, setExpedientes] = useState<any[]>([]);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');
  const [errForm, setErrForm]         = useState('');

  const total    = expedientes.length;
  const abiertos = expedientes.filter(e => (e.estado ?? 'abierto') === 'abierto').length;
  const cerrados = expedientes.filter(e => (e.estado ?? 'abierto') === 'cerrado').length;

  const [form, setForm] = useState({
    id: '', nombreCliente: '', casoCliente: '',
    numeroExpediente: '', prioridad: '', estado: 'abierto' as 'abierto' | 'cerrado',
  });

  const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    Header_botones: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', borderRadius: 8, marginBottom: 16 },
    cards: {
      position: 'relative', flexDirection: 'row', backgroundColor: colors.card,
      borderRadius: r.cardRadius, paddingVertical: r.cardPad, paddingHorizontal: r.cardPad,
      marginVertical: r.gap, alignItems: 'center', minHeight: 100,
    },
    detailsCards: { flex: 1, marginRight: 8 },
    nombreCliente: { fontSize: r.inputFontSz, fontWeight: '700', marginBottom: 4, color: colors.primary, flexWrap: 'wrap' },
    casoCliente:   { fontSize: r.label, color: colors.text, marginTop: 2 },
    folioText:     { fontSize: 11, color: '#9ca3af', fontWeight: '600' },
    btnAbrirExpediente: {
      paddingVertical: r.btnPadV, paddingHorizontal: 10,
      borderWidth: 1, borderColor: colors.primary, borderRadius: r.btnRadius,
      backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', minWidth: 92,
    },
    btnEditarExpediente: {
      paddingVertical: r.btnPadV, paddingHorizontal: 10,
      borderWidth: 1, borderColor: colors.primary, borderRadius: r.btnRadius,
      backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center',
    },
    btnText:  { fontWeight: '700', color: '#fff', fontSize: r.btnFontSz },
    btnNuevo: {
      backgroundColor: colors.primary, position: 'absolute',
      bottom: r.padV, right: r.padH,
      paddingVertical: r.btnPadV, paddingHorizontal: r.inputPadH,
      borderRadius: r.btnRadius, alignItems: 'center', justifyContent: 'center',
    },
    btnFiltro:           { flex: 1, marginHorizontal: 4, paddingVertical: r.tabPadV, borderWidth: 1, borderColor: colors.border, borderRadius: r.radiusSm, backgroundColor: colors.card, alignItems: 'center' },
    btnFiltroActivo:     { backgroundColor: colors.primary, borderColor: colors.primary },
    btnFiltroText:       { fontWeight: '700', color: colors.text },
    btnFiltroTextActivo: { color: '#fff' },
    badge:     { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
    badgeText: { color: '#fff', fontSize: r.small, fontWeight: '700' },
  });

  useEffect(() => {
    const q = query(
      collection(db, 'expedientes'),
      where('usuario', '==', auth.currentUser?.uid),
      orderBy('fechaRegistro', 'desc')
    );
    return onSnapshot(q, (snap) => {
      setExpedientes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const abrirEditar = (exp: any) => {
    setForm({ id: exp.id, nombreCliente: exp.nombreCliente ?? '', casoCliente: exp.casoCliente ?? '',
      numeroExpediente: exp.numeroExpediente ?? '', prioridad: exp.prioridad ?? '', estado: exp.estado ?? 'abierto' });
    setErrForm('');
    setModalEditar(true);
    setModalNuevo(true);
  };

  const abrirNuevo = () => {
    setForm({ id: '', nombreCliente: '', casoCliente: '', numeroExpediente: '', prioridad: '', estado: 'abierto' });
    setErrForm('');
    setModalEditar(false);
    setModalNuevo(true);
  };

  const guardar = async () => {
    if (guardando) return;
    setErrForm('');
    if (!form.nombreCliente.trim() || !form.casoCliente.trim() || !form.prioridad.trim()) {
      setErrForm('Completa todos los campos obligatorios');
      return;
    }
    try {
      setGuardando(true);
      if (modalEditar) {
        await updateDoc(doc(db, 'expedientes', form.id), {
          nombreCliente: form.nombreCliente.trim(), casoCliente: form.casoCliente.trim(),
          numeroExpediente: form.numeroExpediente.trim(), prioridad: form.prioridad.trim(), estado: form.estado,
        });
        exito('Expediente actualizado');
      } else {
        await addDoc(collection(db, 'expedientes'), {
          nombreCliente: form.nombreCliente.trim(), casoCliente: form.casoCliente.trim(),
          numeroExpediente: form.numeroExpediente.trim(), prioridad: form.prioridad.trim(),
          estado: 'abierto', fechaRegistro: serverTimestamp(), usuario: auth.currentUser?.uid,
        });
        exito('Expediente creado');
      }
      setModalNuevo(false);
      setModalEditar(false);
      setForm({ id: '', nombreCliente: '', casoCliente: '', numeroExpediente: '', prioridad: '', estado: 'abierto' });
    } catch {
      toastError(modalEditar ? 'No se pudo actualizar el expediente' : 'No se pudo crear el expediente');
    } finally {
      setGuardando(false);
    }
  };

  const Semaforo = (valor?: string) => {
    const p = (valor ?? '').trim().toLowerCase();
    if (p === 'alta')  return '#dc2626';
    if (p === 'media') return '#eab308';
    if (p === 'baja')  return '#16a34a';
    return '#6b7280';
  };

  const PrioridadUI = (nivel: string) => {
    const c = nivel.trim().toLowerCase();
    if (c === 'alta')  return '#dc2626';
    if (c === 'media') return '#eab308';
    if (c === 'baja')  return '#16a34a';
    return colors.border;
  };

  const expedientesFiltrados = useMemo(() => {
    const texto = search.trim().toLowerCase();
    return expedientes
      .filter((e) => filtroEstado === 'todos' ? true : (e.estado ?? 'abierto') === filtroEstado)
      .filter((e) => !texto || (e.nombreCliente ?? '').toLowerCase().includes(texto) || (e.casoCliente ?? '').toLowerCase().includes(texto));
  }, [expedientes, filtroEstado, search]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Toast mensaje={toast.mensaje} tipo={toast.tipo} visible={toast.visible} onHide={ocultar} />

      {/* HEADER */}
      <View style={{ paddingHorizontal: r.padH, paddingTop: insets.top + r.padV, paddingBottom: r.padV }}>
        <Text style={{ fontSize: r.h1, color: colors.text, fontWeight: 'bold' }}>Expedientes</Text>
        <Text style={{ color: colors.subtext, fontSize: r.body, marginTop: 4 }}>Gestiona los casos de tus clientes</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: r.padH, paddingBottom: 100 }}>
        <View style={styles.container}>
          {/* Buscador */}
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
            borderRadius: r.radiusSm, borderWidth: 1, borderColor: colors.border,
            paddingHorizontal: r.inputPadH, marginBottom: r.gap }}>
            <Feather name="search" size={20} color={colors.subtext} />
            <TextInput placeholder="Buscar expediente..." placeholderTextColor={colors.subtext}
              value={search} onChangeText={setSearch}
              style={{ flex: 1, color: colors.text, paddingVertical: r.inputPadV,
                paddingHorizontal: r.inputPadH }} />
          </View>

          {/* Filtros */}
          <View style={styles.Header_botones}>
            {([['todos', `Todos (${total})`], ['abierto', `Abiertos (${abiertos})`], ['cerrado', `Cerrados (${cerrados})`]] as const).map(([val, label]) => (
              <Pressable key={val} style={[styles.btnFiltro, filtroEstado === val && styles.btnFiltroActivo]} onPress={() => setFiltroEstado(val)}>
                <Text style={[styles.btnFiltroText, filtroEstado === val && styles.btnFiltroTextActivo]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Lista */}
          {expedientesFiltrados.length === 0 ? (
            <View style={{ paddingVertical: 30, alignItems: 'center' }}>
              <Text style={{ color: colors.subtext, fontSize: r.body }}>
                {search ? 'No hay resultados para tu búsqueda' : 'Aún no hay expedientes'}
              </Text>
            </View>
          ) : (
            expedientesFiltrados.map((expediente: Expediente) => (
              <View key={expediente.id} style={[styles.cards, { borderLeftWidth: 5, borderLeftColor: Semaforo(expediente.prioridad) }]}>
                <View style={styles.detailsCards}>
                  {!!expediente.numeroExpediente && (
                    <Text style={styles.folioText}>Folio: {expediente.numeroExpediente}</Text>
                  )}
                  <Text style={styles.nombreCliente} numberOfLines={1}>{expediente.nombreCliente}</Text>
                  <Text style={styles.casoCliente}>{expediente.casoCliente}</Text>
                  <View style={[styles.badge, { backgroundColor: (expediente.estado ?? 'abierto') === 'abierto' ? '#16a34a' : '#6b7280' }]}>
                    <Text style={styles.badgeText}>{(expediente.estado ?? 'abierto').toUpperCase()}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'column', gap: 6 }}>
                  <Pressable style={styles.btnAbrirExpediente}
                    onPress={() => router.push({ pathname: '/(tabs)/expedientes', params: { id: expediente.id } })}>
                    <Text style={styles.btnText}>Ver expediente</Text>
                  </Pressable>
                  <Pressable style={styles.btnEditarExpediente} onPress={() => abrirEditar(expediente)}>
                    <Feather name="edit-2" size={14} color={colors.text} />
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <Pressable style={({ pressed }) => ({ ...styles.btnNuevo, opacity: pressed ? 0.8 : 1 })} onPress={abrirNuevo}>
        <AntDesign name="plus" size={26} color="white" />
      </Pressable>

      {/* MODAL NUEVO / EDITAR */}
      <Modal visible={modalNuevo} transparent animationType="slide" onRequestClose={() => setModalNuevo(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: r.radiusLg, borderTopRightRadius: r.radiusLg, padding: r.padH, paddingBottom: 40 }}>

            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 }} />
            <Text style={{ fontSize: r.h2, fontWeight: 'bold', color: colors.text, marginBottom: r.gap }}>
              {modalEditar ? 'Editar Expediente' : 'Nuevo Expediente'}
            </Text>

            {/* Error inline */}
            {errForm ? (
              <View style={{ backgroundColor: '#fee2e2', borderRadius: 10, padding: 10, marginBottom: 12,
                flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Feather name="alert-circle" size={15} color="#ef4444" />
                <Text style={{ color: '#ef4444', fontSize: r.body, flex: 1 }}>{errForm}</Text>
              </View>
            ) : null}

            {[
              { placeholder: 'Nombre del Cliente *', field: 'nombreCliente' as const },
              { placeholder: 'Caso *', field: 'casoCliente' as const },
              { placeholder: 'Número de expediente (ej. 1234/2026)', field: 'numeroExpediente' as const },
            ].map(({ placeholder, field }) => (
              <TextInput key={field} placeholder={placeholder} placeholderTextColor={colors.subtext}
                value={form[field]} onChangeText={(v) => setForm(prev => ({ ...prev, [field]: v }))}
                style={{ backgroundColor: darkMode ? '#2a2a2a' : '#f4f4f4', paddingVertical: r.inputPadV,
                  paddingHorizontal: r.inputPadH, borderRadius: r.inputRadius, color: colors.text,
                  fontSize: r.inputFontSz, marginBottom: r.gap / 1.2 }} />
            ))}

            <Text style={{ color: colors.text, fontWeight: '700', marginBottom: r.gap / 2 }}>Prioridad *</Text>
            <View style={{ flexDirection: 'row', gap: r.gap / 2, marginBottom: r.gap / 1.2 }}>
              {(['Alta', 'Media', 'Baja'] as const).map((item) => {
                const activo = form.prioridad === item;
                const color  = PrioridadUI(item);
                return (
                  <Pressable key={item} onPress={() => setForm(prev => ({ ...prev, prioridad: item }))}
                    style={{ flex: 1, paddingVertical: r.btnPadV, borderRadius: r.btnRadius,
                      borderWidth: 1, borderColor: activo ? color : colors.border,
                      backgroundColor: activo ? color : colors.card, alignItems: 'center' }}>
                    <Text style={{ color: activo ? '#fff' : colors.text, fontWeight: '700' }}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>

            {modalEditar && (
              <View style={{ marginBottom: r.gap }}>
                <Text style={{ color: colors.text, fontWeight: '700', marginBottom: r.gap / 2 }}>Estado</Text>
                <View style={{ flexDirection: 'row', gap: r.gap / 2 }}>
                  {(['abierto', 'cerrado'] as const).map((item) => {
                    const activo = form.estado === item;
                    const color  = item === 'abierto' ? '#16a34a' : '#6b7280';
                    return (
                      <Pressable key={item} onPress={() => setForm(prev => ({ ...prev, estado: item }))}
                        style={{ flex: 1, paddingVertical: r.btnPadV, borderRadius: r.btnRadius,
                          borderWidth: 1, borderColor: activo ? color : colors.border,
                          backgroundColor: activo ? color : colors.card, alignItems: 'center' }}>
                        <Text style={{ color: activo ? '#fff' : colors.text, fontWeight: '700', textTransform: 'capitalize' }}>{item}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={{ gap: r.gap / 1.5 }}>
              <Pressable disabled={guardando} onPress={guardar}
                style={({ pressed }) => ({ backgroundColor: guardando ? '#9ca3af' : pressed ? '#1e90ff' : '#3488ff',
                  opacity: guardando ? 0.7 : pressed ? 0.85 : 1,
                  paddingVertical: r.btnPadV, borderRadius: r.btnRadius })}>
                <Text style={{ color: '#fff', fontWeight: 'bold', textAlign: 'center', fontSize: r.btnFontSz }}>
                  {guardando ? 'Guardando...' : modalEditar ? 'Guardar cambios' : 'Crear'}
                </Text>
              </Pressable>
              <Pressable onPress={() => { setModalNuevo(false); setModalEditar(false); }}>
                <Text style={{ color: colors.subtext, textAlign: 'center', fontSize: r.body }}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}