import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Linking from 'expo-linking';
import {
  addDoc, collection, deleteDoc, doc,
  onSnapshot, orderBy, query, serverTimestamp,
  updateDoc, where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConfirmModal } from '../../src/components/ConfirmModal';
import { Toast, useToast } from '../../src/components/Toast';
import { useTema } from '../../src/context/TemaContext';
import { db } from '../../src/firebase/firestore';
import { useUsuario } from '../../src/hooks/useUsuario';
import { ArchivoSubido, borrarArchivo, formatearTamano, iconoArchivo, subirArchivo } from '../../src/utils/cloudinary';
import { r } from '../../src/utils/responsive';

// ─── Tipos ───────────────────────────────────────────────────────────────────

type Categoria = 'nota' | 'documento' | 'contrato' | 'evidencia' | 'otro';
type TipoNota = 'privado' | 'general' | 'compartido';
type TabActivo = 'privado' | 'general' | 'compartido';

interface Nota {
  id: string;
  titulo: string;
  contenido: string;
  archivos?: ArchivoSubido[];  // archivos subidos a Cloudinary
  categoria: Categoria;
  fechaManual: string;
  creadoPor: string;
  nombreAutor: string;
  tipo: TipoNota;
  compartidoCon: string[];
  creadoEn: any;
}

interface UsuarioBasico {
  uid: string;
  nombre: string;
}

// ─── Categorías ───────────────────────────────────────────────────────────────

const CATEGORIAS: { value: Categoria; label: string; icono: string; color: string }[] = [
  { value: 'nota',      label: 'Nota',      icono: 'document-text-outline',      color: '#3b82f6' },
  { value: 'documento', label: 'Documento', icono: 'folder-outline',              color: '#8b5cf6' },
  { value: 'contrato',  label: 'Contrato',  icono: 'ribbon-outline',             color: '#f59e0b' },
  { value: 'evidencia', label: 'Evidencia', icono: 'camera-outline',             color: '#ef4444' },
  { value: 'otro',      label: 'Otro',      icono: 'ellipsis-horizontal-outline', color: '#6b7280' },
];

const getCat = (v: Categoria) => CATEGORIAS.find((c) => c.value === v) ?? CATEGORIAS[0];

// ─── Servicios de archivo ────────────────────────────────────────────────────

// ─── Tarjeta de nota ─────────────────────────────────────────────────────────

function TarjetaNota({
  nota, esPropia, todosUsuarios, colors, darkMode, onVerDetalle, onEditar, onEliminar,
}: {
  nota: Nota; esPropia: boolean; todosUsuarios: UsuarioBasico[];
  colors: any; darkMode: boolean; onVerDetalle: () => void; onEditar: () => void; onEliminar: () => void;
}) {
  const cat = getCat(nota.categoria);
  const [expandirCompartidos, setExpandirCompartidos] = useState(false);

  // Nombres de usuarios con quienes está compartido
  const nombresCompartidos = (nota.compartidoCon || [])
    .map((uid) => todosUsuarios.find((u) => u.uid === uid)?.nombre ?? 'Usuario')
    .filter(Boolean);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onVerDetalle}
      style={{
        backgroundColor: colors.card, borderRadius: r.radius, padding: 16, marginBottom: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: darkMode ? 0.25 : 0.07, shadowRadius: 6, elevation: 3,
        borderLeftWidth: 4, borderLeftColor: cat.color,
      }}>
      {/* Cabecera */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: cat.color + '22', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
          <Ionicons name={cat.icono as any} size={18} color={cat.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: 'bold', fontSize: r.inputFontSz, color: colors.text }}>{nota.titulo}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <View style={{ backgroundColor: cat.color + '22', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
              <Text style={{ color: cat.color, fontSize: r.small, fontWeight: 'bold' }}>{cat.label}</Text>
            </View>
            <Text style={{ color: colors.subtext, fontSize: r.small }}>📅 {nota.fechaManual}</Text>
            {nota.tipo !== 'privado' && (
              <Text style={{ color: colors.subtext, fontSize: r.small }}>👤 {nota.nombreAutor}</Text>
            )}
            {/* Badge tipo */}
            {nota.tipo === 'compartido' && (
              <View style={{ backgroundColor: '#fff3e0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                <Text style={{ color: '#f59e0b', fontSize: r.small, fontWeight: 'bold' }}>👥 Compartido</Text>
              </View>
            )}
          </View>
        </View>
        {esPropia && (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity onPress={onEditar} style={{ padding: 6, borderRadius: 8, backgroundColor: colors.input }}>
              <Ionicons name="pencil-outline" size={16} color={colors.subtext} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onEliminar} style={{ padding: 6, borderRadius: 8, backgroundColor: '#fff0f0' }}>
              <Ionicons name="trash-outline" size={16} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Contenido */}
      {nota.contenido ? (
        <Text style={{ color: colors.subtext, fontSize: r.body, lineHeight: 20, marginBottom: 6 }}>
          {nota.contenido}
        </Text>
      ) : null}

      {/* Links */}
      {nota.archivos && nota.archivos.length > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: colors.input, padding: 8, borderRadius: 10 }}>
          <Ionicons name="attach-outline" size={15} color={colors.subtext} />
          <Text style={{ color: colors.subtext, fontSize: r.small }}>
            {nota.archivos.length} {nota.archivos.length === 1 ? 'archivo adjunto' : 'archivos adjuntos'} — toca para ver
          </Text>
        </View>
      ) : null}

      {/* Sección compartido con */}
      {nota.tipo === 'compartido' && esPropia && nombresCompartidos.length > 0 && (
        <TouchableOpacity
          onPress={() => setExpandirCompartidos(!expandirCompartidos)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}
        >
          <Ionicons name="people-outline" size={15} color={colors.subtext} />
          <Text style={{ color: colors.subtext, fontSize: r.small, flex: 1 }}>
            Compartido con {nombresCompartidos.length} {nombresCompartidos.length === 1 ? 'persona' : 'personas'}
          </Text>
          <Ionicons name={expandirCompartidos ? 'chevron-up' : 'chevron-down'} size={14} color={colors.subtext} />
        </TouchableOpacity>
      )}
      {nota.tipo === 'compartido' && esPropia && expandirCompartidos && (
        <View style={{ marginTop: 8, gap: 6 }}>
          {nombresCompartidos.map((nombre, idx) => (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.input, padding: 8, borderRadius: 10 }}>
              <View style={{ width: 28, height: 28, borderRadius: r.radius, backgroundColor: colors.primary + '22', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="person" size={14} color={colors.primary} />
              </View>
              <Text style={{ color: colors.text, fontSize: r.label }}>{nombre}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Si no es propia pero es compartida contigo */}
      {nota.tipo === 'compartido' && !esPropia && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Ionicons name="person-add-outline" size={14} color={colors.subtext} />
          <Text style={{ color: colors.subtext, fontSize: r.small }}>Compartido contigo por {nota.nombreAutor}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function DocumentosScreen() {
  const { colors, darkMode } = useTema();
  const { usuario } = useUsuario();
  const { toast, ocultar, exito, error, advertencia } = useToast();

  const [tabActivo, setTabActivo] = useState<TabActivo>('privado');
  const [notasPrivadas, setNotasPrivadas] = useState<Nota[]>([]);
  const [notasGenerales, setNotasGenerales] = useState<Nota[]>([]);
  // Notas compartidas: las que creé yo + las que otros compartieron conmigo
  const [notasMisCompartidas, setNotasMisCompartidas] = useState<Nota[]>([]);
  const [notasCompartConmigo, setNotasCompartConmigo] = useState<Nota[]>([]);
  const [todosUsuarios, setTodosUsuarios] = useState<UsuarioBasico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  // Form
  const [modalVisible, setModalVisible] = useState(false);
  const [editando, setEditando] = useState<Nota | null>(null);
  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [archivos, setArchivos] = useState<ArchivoSubido[]>([]);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);
  const [categoria, setCategoria] = useState<Categoria>('nota');
  const [fechaManual, setFechaManual] = useState('');
  const [compartidoCon, setCompartidoCon] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [notaAEliminar, setNotaAEliminar] = useState<Nota | null>(null);
  const [notaDetalle, setNotaDetalle] = useState<Nota | null>(null);

  // ─── Queries Firestore ───────────────────────────────────────────────────────

  // Mis notas privadas
  useEffect(() => {
    if (!usuario?.uid) return;
    const q = query(
      collection(db, 'notas'),
      where('creadoPor', '==', usuario.uid),
      where('tipo', '==', 'privado'),
      orderBy('creadoEn', 'desc')
    );
    return onSnapshot(q, (snap) => {
      setNotasPrivadas(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Nota)));
      setCargando(false);
    });
  }, [usuario?.uid]);

  // Notas generales de todos
  useEffect(() => {
    const q = query(
      collection(db, 'notas'),
      where('tipo', '==', 'general'),
      orderBy('creadoEn', 'desc')
    );
    return onSnapshot(q, (snap) => {
      setNotasGenerales(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Nota)));
    });
  }, []);

  // Notas compartidas que YO creé
  useEffect(() => {
    if (!usuario?.uid) return;
    const q = query(
      collection(db, 'notas'),
      where('creadoPor', '==', usuario.uid),
      where('tipo', '==', 'compartido'),
      orderBy('creadoEn', 'desc')
    );
    return onSnapshot(q, (snap) => {
      setNotasMisCompartidas(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Nota)));
    });
  }, [usuario?.uid]);

  // Notas compartidas CONMIGO por otros
  useEffect(() => {
    if (!usuario?.uid) return;
    const q = query(
      collection(db, 'notas'),
      where('compartidoCon', 'array-contains', usuario.uid),
      orderBy('creadoEn', 'desc')
    );
    return onSnapshot(q, (snap) => {
      setNotasCompartConmigo(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Nota)));
    });
  }, [usuario?.uid]);

  // Todos los usuarios para el selector
  useEffect(() => {
    return onSnapshot(collection(db, 'usuarios'), (snap) => {
      setTodosUsuarios(
        snap.docs
          .map((d) => ({ uid: d.id, nombre: d.data().nombre }))
          .filter((u) => u.uid !== usuario?.uid)
      );
    });
  }, [usuario?.uid]);

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const fechaHoy = () => {
    const hoy = new Date();
    return `${hoy.getDate().toString().padStart(2, '0')}/${(hoy.getMonth() + 1).toString().padStart(2, '0')}/${hoy.getFullYear()}`;
  };

  const seleccionarArchivo = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setSubiendoArchivo(true);
      const subido = await subirArchivo(asset.uri, asset.name, asset.mimeType ?? 'application/octet-stream');
      if (subido) {
        setArchivos((prev) => [...prev, subido]);
        exito(`✅ ${asset.name} subido correctamente`);
      } else {
        error('No se pudo subir el archivo, intenta de nuevo');
      }
    } catch (e) {
      error('Error al seleccionar el archivo');
    } finally {
      setSubiendoArchivo(false);
    }
  };

  const eliminarArchivoLocal = async (idx: number) => {
    const archivo = archivos[idx];
    // Borrar de Cloudinary
    await borrarArchivo(archivo.publicId);
    setArchivos((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleUsuario = (uid: string) => {
    setCompartidoCon((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  // ─── Abrir modal ─────────────────────────────────────────────────────────────

  const abrirModal = (nota: Nota | null = null) => {
    if (nota) {
      setEditando(nota);
      setTitulo(nota.titulo);
      setContenido(nota.contenido || '');
      setArchivos(nota.archivos || []);
      setCategoria(nota.categoria);
      setFechaManual(nota.fechaManual);
      setCompartidoCon(nota.compartidoCon || []);
    } else {
      setEditando(null);
      setTitulo('');
      setContenido('');
      setArchivos([]);
      setCategoria('nota');
      setFechaManual(fechaHoy());
      setCompartidoCon([]);
    }
    setModalVisible(true);
  };

  // ─── Guardar ─────────────────────────────────────────────────────────────────

  const guardar = async () => {
    if (!titulo.trim()) { advertencia('El título no puede estar vacío'); return; }
    if (!fechaManual.trim()) { advertencia('Ingresa una fecha'); return; }
    if (tabActivo === 'compartido' && compartidoCon.length === 0) {
      advertencia('Selecciona al menos un usuario para compartir'); return;
    }

    setGuardando(true);
    try {
      const datos = {
        titulo: titulo.trim(),
        contenido: contenido.trim(),
        archivos,
        categoria,
        fechaManual: fechaManual.trim(),
        tipo: tabActivo as TipoNota,
        compartidoCon: tabActivo === 'compartido' ? compartidoCon : [],
        creadoPor: usuario!.uid,
        nombreAutor: usuario!.nombre,
      };

      if (editando) {
        await updateDoc(doc(db, 'notas', editando.id), datos);
        exito('Nota actualizada correctamente');
      } else {
        await addDoc(collection(db, 'notas'), { ...datos, creadoEn: serverTimestamp() });
        exito('Nota creada correctamente');
      }
      setModalVisible(false);
    } catch {
      error('No se pudo guardar la nota');
    } finally {
      setGuardando(false);
    }
  };

  // ─── Eliminar ────────────────────────────────────────────────────────────────

  const eliminar = async () => {
    if (!notaAEliminar) return;
    try {
      // Borrar archivos de Cloudinary primero
      const archivosNota = notaAEliminar.archivos || [];
      await Promise.all(archivosNota.map((a) => borrarArchivo(a.publicId)));
      // Luego borrar de Firestore
      await deleteDoc(doc(db, 'notas', notaAEliminar.id));
      exito('Nota y archivos eliminados');
    } catch {
      error('No se pudo eliminar la nota');
    } finally {
      setNotaAEliminar(null);
    }
  };

  // ─── Lista a mostrar ─────────────────────────────────────────────────────────

  // Notas compartidas = las mías + las compartidas conmigo (sin duplicados)
  const notasCompartidas = [
    ...notasMisCompartidas,
    ...notasCompartConmigo.filter((n) => n.creadoPor !== usuario?.uid),
  ];

  const notas =
    tabActivo === 'privado' ? notasPrivadas
    : tabActivo === 'general' ? notasGenerales
    : notasCompartidas;

  const notasFiltradas = notas.filter((n) =>
    n.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
    n.contenido?.toLowerCase().includes(busqueda.toLowerCase())
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <Toast mensaje={toast.mensaje} tipo={toast.tipo} visible={toast.visible} onHide={ocultar} />

      {/* HEADER */}
      <View style={{ paddingHorizontal: r.padH, paddingTop: 12, paddingBottom: 8 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text }}>📁 Documentos</Text>
        <Text style={{ color: colors.subtext, fontSize: r.body, marginTop: 2 }}>
          {tabActivo === 'privado' ? '🔒 Solo visible para ti'
            : tabActivo === 'compartido' ? '👥 Compartido entre usuarios específicos'
            : '🌐 Visible para todos'}
        </Text>
      </View>

      {/* TABS */}
      <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: colors.input, borderRadius: r.radius, padding: 4 }}>
        {(['privado', 'compartido', 'general'] as TabActivo[]).map((tab) => {
          const activo = tabActivo === tab;
          const icono = tab === 'privado' ? 'lock-closed' : tab === 'compartido' ? 'person-add' : 'people';
          const count = tab === 'privado' ? notasPrivadas.length : tab === 'compartido' ? notasCompartidas.length : notasGenerales.length;
          const label = tab === 'privado' ? 'Privado' : tab === 'compartido' ? 'Compartido' : 'General';
          return (
            <Pressable
              key={tab}
              onPress={() => { setTabActivo(tab); setBusqueda(''); }}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5, backgroundColor: activo ? colors.card : 'transparent', elevation: activo ? 2 : 0 }}
            >
              <Ionicons name={icono as any} size={14} color={activo ? colors.primary : colors.subtext} />
              <Text style={{ fontWeight: activo ? 'bold' : 'normal', color: activo ? colors.primary : colors.subtext, fontSize: r.label }}>{label}</Text>
              <View style={{ backgroundColor: activo ? colors.primary : colors.border, borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1 }}>
                <Text style={{ color: activo ? '#fff' : colors.subtext, fontSize: 10, fontWeight: 'bold' }}>{count}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* BUSCADOR */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, backgroundColor: colors.input, borderRadius: r.radiusSm, paddingHorizontal: 14 }}>
        <Ionicons name="search-outline" size={18} color={colors.subtext} />
        <TextInput
          value={busqueda} onChangeText={setBusqueda}
          placeholder="Buscar notas..." placeholderTextColor={colors.subtext}
          style={{ flex: 1, paddingVertical: 12, paddingLeft: 10, color: colors.text, fontSize: r.body }}
        />
        {busqueda ? <TouchableOpacity onPress={() => setBusqueda('')}><Ionicons name="close-circle" size={18} color={colors.subtext} /></TouchableOpacity> : null}
      </View>

      {/* LISTA */}
      {cargando ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: r.padH, paddingBottom: 100 }}>
          {notasFiltradas.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Ionicons name={tabActivo === 'privado' ? 'lock-closed-outline' : tabActivo === 'compartido' ? 'person-add-outline' : 'people-outline'} size={64} color={colors.border} />
              <Text style={{ color: colors.subtext, fontSize: r.inputFontSz, marginTop: 16, fontWeight: 'bold' }}>
                {busqueda ? 'Sin resultados'
                  : tabActivo === 'privado' ? 'No tienes notas privadas'
                  : tabActivo === 'compartido' ? 'Sin notas compartidas'
                  : 'No hay notas generales'}
              </Text>
              <Text style={{ color: colors.subtext, fontSize: r.body, marginTop: 6, textAlign: 'center' }}>
                {busqueda ? 'Intenta con otro término' : 'Toca el botón + para crear una'}
              </Text>
            </View>
          ) : (
            notasFiltradas.map((nota) => (
              <TarjetaNota
                key={nota.id}
                nota={nota}
                esPropia={nota.creadoPor === usuario?.uid}
                todosUsuarios={todosUsuarios}
                colors={colors}
                darkMode={darkMode}
                onVerDetalle={() => setNotaDetalle(nota)}
                onEditar={() => abrirModal(nota)}
                onEliminar={() => setNotaAEliminar(nota)}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* FAB */}
      <Pressable
        onPress={() => abrirModal()}
        style={{ position: 'absolute', bottom: 24, right: 20, backgroundColor: colors.primary, width: 58, height: 58, borderRadius: 29, justifyContent: 'center', alignItems: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 }}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </Pressable>

      {/* CONFIRM ELIMINAR */}
      <ConfirmModal
        visible={!!notaAEliminar}
        titulo="Eliminar nota"
        mensaje={`¿Eliminar "${notaAEliminar?.titulo}"? Esta acción no se puede deshacer.`}
        tipo="danger"
        textoConfirmar="Eliminar"
        onCancelar={() => setNotaAEliminar(null)}
        onConfirmar={eliminar}
      />

      {/* MODAL DETALLE */}
      <Modal visible={!!notaDetalle} transparent animationType="slide" onRequestClose={() => setNotaDetalle(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000088' }}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setNotaDetalle(null)} />
          {notaDetalle && (() => {
            const cat = getCat(notaDetalle.categoria);
            const nombresComp = (notaDetalle.compartidoCon || [])
              .map((uid) => todosUsuarios.find((u) => u.uid === uid)?.nombre ?? 'Usuario');
            return (
              <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingHorizontal: r.padH, paddingTop: 16, paddingBottom: 40, maxHeight: '90%' }}>
                {/* Handle */}
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 }} />

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                  {/* Categoría + badges */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: cat.color + '22', paddingHorizontal: 12, paddingVertical: 6, borderRadius: r.radiusLg }}>
                      <Ionicons name={cat.icono as any} size={16} color={cat.color} />
                      <Text style={{ color: cat.color, fontWeight: 'bold', fontSize: r.label }}>{cat.label}</Text>
                    </View>
                    <View style={{ backgroundColor: colors.input, paddingHorizontal: 10, paddingVertical: 6, borderRadius: r.radiusLg }}>
                      <Text style={{ color: colors.subtext, fontSize: r.small }}>📅 {notaDetalle.fechaManual}</Text>
                    </View>
                    {notaDetalle.tipo === 'compartido' && (
                      <View style={{ backgroundColor: '#fff3e0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: r.radiusLg }}>
                        <Text style={{ color: '#f59e0b', fontSize: r.small, fontWeight: 'bold' }}>👥 Compartido</Text>
                      </View>
                    )}
                    {notaDetalle.tipo === 'general' && (
                      <View style={{ backgroundColor: '#f0fff0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: r.radiusLg }}>
                        <Text style={{ color: '#32cd32', fontSize: r.small, fontWeight: 'bold' }}>🌐 General</Text>
                      </View>
                    )}
                    {notaDetalle.tipo === 'privado' && (
                      <View style={{ backgroundColor: '#e8f4ff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: r.radiusLg }}>
                        <Text style={{ color: colors.primary, fontSize: r.small, fontWeight: 'bold' }}>🔒 Privado</Text>
                      </View>
                    )}
                  </View>

                  {/* Título */}
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text, marginBottom: 6 }}>
                    {notaDetalle.titulo}
                  </Text>

                  {/* Autor */}
                  {notaDetalle.tipo !== 'privado' && (
                    <Text style={{ color: colors.subtext, fontSize: r.label, marginBottom: 16 }}>
                      👤 {notaDetalle.nombreAutor}
                    </Text>
                  )}

                  {/* Divisor */}
                  <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 16 }} />

                  {/* Contenido */}
                  {notaDetalle.contenido ? (
                    <Text style={{ color: colors.text, fontSize: r.inputFontSz, lineHeight: 26, marginBottom: 20 }}>
                      {notaDetalle.contenido}
                    </Text>
                  ) : (
                    <Text style={{ color: colors.subtext, fontSize: r.body, fontStyle: 'italic', marginBottom: 20 }}>
                      Sin contenido escrito
                    </Text>
                  )}

                  {/* Archivos */}
                  {notaDetalle.archivos && notaDetalle.archivos.length > 0 && (
                    <View style={{ marginBottom: 20 }}>
                      <Text style={{ color: colors.subtext, fontSize: r.label, fontWeight: 'bold', marginBottom: 10 }}>
                        📎 Archivos adjuntos ({notaDetalle.archivos.length})
                      </Text>
                      <View style={{ gap: 8 }}>
                        {notaDetalle.archivos.map((archivo, idx) => {
                          const { icono, color } = iconoArchivo(archivo.tipo);
                          return (
                            <TouchableOpacity
                              key={idx}
                              onPress={() => Linking.openURL(archivo.url)}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: r.gap, backgroundColor: color + '14', padding: 14, borderRadius: r.radiusSm, borderWidth: 1, borderColor: color + '33' }}
                            >
                              <View style={{ width: 40, height: 40, borderRadius: r.radiusLg, backgroundColor: color + '22', justifyContent: 'center', alignItems: 'center' }}>
                                <Ionicons name={icono as any} size={20} color={color} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: colors.text, fontSize: r.body, fontWeight: '600' }} numberOfLines={1}>{archivo.nombre}</Text>
                                <Text style={{ color: colors.subtext, fontSize: r.small }}>{formatearTamano(archivo.tamano)}</Text>
                              </View>
                              <Ionicons name="open-outline" size={20} color={color} />
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* Compartido con */}
                  {notaDetalle.tipo === 'compartido' && nombresComp.length > 0 && (
                    <View style={{ backgroundColor: colors.input, borderRadius: r.radius, padding: 14, marginBottom: 20 }}>
                      <Text style={{ color: colors.subtext, fontSize: r.label, fontWeight: 'bold', marginBottom: 10 }}>
                        👥 Compartido con ({nombresComp.length})
                      </Text>
                      <View style={{ gap: 8 }}>
                        {nombresComp.map((nombre, idx) => (
                          <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <View style={{ width: 32, height: 32, borderRadius: r.radius, backgroundColor: colors.primary + '22', justifyContent: 'center', alignItems: 'center' }}>
                              <Ionicons name="person" size={16} color={colors.primary} />
                            </View>
                            <Text style={{ color: colors.text, fontSize: r.body }}>{nombre}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Botones acción */}
                  {notaDetalle.creadoPor === usuario?.uid && (
                    <View style={{ flexDirection: 'row', gap: r.gap }}>
                      <Pressable
                        onPress={() => { setNotaDetalle(null); setTimeout(() => abrirModal(notaDetalle), 300); }}
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: r.radius, backgroundColor: colors.input }}
                      >
                        <Ionicons name="pencil-outline" size={18} color={colors.text} />
                        <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: r.body }}>Editar</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => { setNotaDetalle(null); setTimeout(() => setNotaAEliminar(notaDetalle), 300); }}
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: r.radius, backgroundColor: '#fff0f0' }}
                      >
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                        <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: r.body }}>Eliminar</Text>
                      </Pressable>
                    </View>
                  )}
                </ScrollView>
              </View>
            );
          })()}
        </View>
      </Modal>

      {/* MODAL CREAR / EDITAR */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000088' }}>
            <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingHorizontal: r.padH, paddingTop: 16, paddingBottom: 40, maxHeight: '94%' }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 }} />

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 16 }}>

                {/* Encabezado modal */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <Text style={{ fontSize: r.h2, fontWeight: 'bold', color: colors.text }}>
                    {editando ? '✏️ Editar nota' : '✨ Nueva nota'}
                  </Text>
                  <View style={{
                    backgroundColor: tabActivo === 'privado' ? '#e8f4ff' : tabActivo === 'compartido' ? '#fff3e0' : '#f0fff0',
                    paddingHorizontal: 10, paddingVertical: 4, borderRadius: r.radiusSm,
                  }}>
                    <Text style={{ color: tabActivo === 'privado' ? colors.primary : tabActivo === 'compartido' ? '#f59e0b' : '#32cd32', fontSize: r.small, fontWeight: 'bold' }}>
                      {tabActivo === 'privado' ? '🔒 Privado' : tabActivo === 'compartido' ? '👥 Compartido' : '🌐 General'}
                    </Text>
                  </View>
                </View>

                {/* Título */}
                <Text style={{ color: colors.subtext, fontSize: r.label, marginBottom: 8 }}>Título *</Text>
                <TextInput
                  value={titulo} onChangeText={setTitulo}
                  placeholder="Título de la nota" placeholderTextColor={colors.border}
                  style={{ backgroundColor: colors.input, padding: 14, borderRadius: r.radiusSm, color: colors.text, fontSize: r.inputFontSz, marginBottom: 16 }}
                />

                {/* Categoría */}
                <Text style={{ color: colors.subtext, fontSize: r.label, marginBottom: 10 }}>Categoría</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 2 }}>
                    {CATEGORIAS.map((cat) => {
                      const activa = categoria === cat.value;
                      return (
                        <TouchableOpacity
                          key={cat.value}
                          onPress={() => setCategoria(cat.value)}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: r.radiusLg, borderWidth: 1.5, borderColor: activa ? cat.color : colors.border, backgroundColor: activa ? cat.color + '22' : colors.input }}
                        >
                          <Ionicons name={cat.icono as any} size={15} color={activa ? cat.color : colors.subtext} />
                          <Text style={{ color: activa ? cat.color : colors.subtext, fontSize: r.label, fontWeight: activa ? 'bold' : 'normal' }}>{cat.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>

                {/* Fecha */}
                <Text style={{ color: colors.subtext, fontSize: r.label, marginBottom: 8 }}>Fecha</Text>
                <TextInput
                  value={fechaManual} onChangeText={setFechaManual}
                  placeholder="DD/MM/AAAA" placeholderTextColor={colors.border}
                  style={{ backgroundColor: colors.input, padding: 14, borderRadius: r.radiusSm, color: colors.text, fontSize: r.inputFontSz, marginBottom: 16 }}
                />

                {/* Contenido */}
                <Text style={{ color: colors.subtext, fontSize: r.label, marginBottom: 8 }}>Contenido</Text>
                <TextInput
                  value={contenido} onChangeText={setContenido}
                  placeholder="Escribe tu nota aquí..." placeholderTextColor={colors.border}
                  multiline numberOfLines={5}
                  style={{ backgroundColor: colors.input, padding: 14, borderRadius: r.radiusSm, color: colors.text, fontSize: r.body, minHeight: 110, marginBottom: 16, textAlignVertical: 'top' }}
                />

                {/* Archivos Cloudinary */}
                <Text style={{ color: colors.subtext, fontSize: r.label, marginBottom: 8 }}>📎 Archivos adjuntos (opcional)</Text>

                <TouchableOpacity
                  onPress={seleccionarArchivo}
                  disabled={subiendoArchivo}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.primary + '18', borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed', borderRadius: r.radius, paddingVertical: 16, marginBottom: 8 }}
                >
                  {subiendoArchivo ? (
                    <>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: r.body }}>Subiendo...</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={22} color={colors.primary} />
                      <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: r.body }}>Seleccionar archivo</Text>
                    </>
                  )}
                </TouchableOpacity>
                <Text style={{ color: colors.subtext, fontSize: r.small, textAlign: 'center', marginBottom: 14 }}>
                  PDF, Word, Excel, imágenes, txt y más
                </Text>

                {archivos.length > 0 ? (
                  <View style={{ gap: 8, marginBottom: 20 }}>
                    {archivos.map((archivo, idx) => {
                      const { icono, color } = iconoArchivo(archivo.tipo);
                      return (
                        <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: color + '14', borderRadius: r.radiusSm, padding: 12, gap: 10, borderWidth: 1, borderColor: color + '33' }}>
                          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: color + '22', justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name={icono as any} size={18} color={color} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.text, fontSize: r.label, fontWeight: '600' }} numberOfLines={1}>{archivo.nombre}</Text>
                            <Text style={{ color: colors.subtext, fontSize: r.small }}>{formatearTamano(archivo.tamano)}</Text>
                          </View>
                          <TouchableOpacity onPress={() => eliminarArchivoLocal(idx)} style={{ padding: 4 }}>
                            <Ionicons name="close-circle" size={20} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={{ color: colors.subtext, fontSize: r.small, marginBottom: 20, textAlign: 'center' }}>
                    Sin archivos adjuntos
                  </Text>
                )}

                {/* ── SELECTOR USUARIOS (solo tab compartido) ── */}
                {tabActivo === 'compartido' && (
                  <View style={{ marginBottom: 20, backgroundColor: colors.input, borderRadius: r.radius, padding: 16 }}>
                    <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: r.body, marginBottom: 4 }}>
                      👥 Compartir con
                    </Text>
                    <Text style={{ color: colors.subtext, fontSize: r.small, marginBottom: 14 }}>
                      Selecciona quién puede ver esta nota. Puedes modificarlo después.
                    </Text>

                    {todosUsuarios.length === 0 ? (
                      <Text style={{ color: colors.subtext, fontSize: r.label, textAlign: 'center' }}>No hay otros usuarios registrados</Text>
                    ) : (
                      <View style={{ gap: 8 }}>
                        {todosUsuarios.map((u) => {
                          const sel = compartidoCon.includes(u.uid);
                          return (
                            <TouchableOpacity
                              key={u.uid}
                              onPress={() => toggleUsuario(u.uid)}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: r.gap, padding: 12, borderRadius: r.radiusSm, borderWidth: 1.5, borderColor: sel ? colors.primary : colors.border, backgroundColor: sel ? colors.primary + '12' : colors.card }}
                            >
                              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: sel ? colors.primary : colors.border + '80', justifyContent: 'center', alignItems: 'center' }}>
                                <Ionicons name="person" size={20} color={sel ? '#fff' : colors.subtext} />
                              </View>
                              <Text style={{ flex: 1, color: colors.text, fontSize: r.body, fontWeight: sel ? 'bold' : 'normal' }}>{u.nombre}</Text>
                              <View style={{ width: 24, height: 24, borderRadius: r.radiusSm, borderWidth: 2, borderColor: sel ? colors.primary : colors.border, backgroundColor: sel ? colors.primary : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
                                {sel && <Ionicons name="checkmark" size={14} color="#fff" />}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    {compartidoCon.length > 0 && (
                      <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                        <Text style={{ color: colors.subtext, fontSize: r.small }}>
                          ✅ Compartiendo con {compartidoCon.length} {compartidoCon.length === 1 ? 'persona' : 'personas'}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Botones guardar */}
                <View style={{ flexDirection: 'row', gap: r.gap }}>
                  <Pressable onPress={() => setModalVisible(false)} style={{ flex: 1, paddingVertical: r.inputPadV, borderRadius: r.radius, alignItems: 'center', backgroundColor: colors.input }}>
                    <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: r.inputFontSz }}>Cancelar</Text>
                  </Pressable>
                  <Pressable onPress={guardar} disabled={guardando} style={{ flex: 1, paddingVertical: r.inputPadV, borderRadius: r.radius, alignItems: 'center', backgroundColor: colors.primary }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: r.inputFontSz }}>{guardando ? 'Guardando...' : 'Guardar'}</Text>
                  </Pressable>
                </View>

              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}