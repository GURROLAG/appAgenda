import { Ionicons } from '@expo/vector-icons';
import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import * as DocumentPicker from 'expo-document-picker';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ConfirmModal } from '../../src/components/ConfirmModal';
import { Toast, useToast } from '../../src/components/Toast';
import { useTema } from '../../src/context/TemaContext';
import { db } from '../../src/firebase/firestore';
import { ArchivoSubido, borrarArchivo, formatearTamano, iconoArchivo, subirArchivo } from '../../src/utils/cloudinary';
import { r } from '../../src/utils/responsive';

type Expediente = {
  id: string;
  nombreCliente: string;
  casoCliente: string;
  estado?: 'abierto' | 'cerrado';
};

type ArchivoExpediente = {
  id: string;
  titulo: string;
  tipoArchivo: 'imagen' | 'pdf' | 'word' | 'otro';
  url: string;
  public_id: string;
  nombreArchivo?: string;
  mimeType?: string;
  sizeBytes?: number;
};

export default function ExpedientesScreen() {
  const { colors }  = useTema();
  const router      = useRouter();
  const { id }      = useLocalSearchParams<{ id: string }>();
  const { toast, ocultar, exito, error: toastError } = useToast();

  const [loading, setLoading]               = useState(true);
  const [expedienteActual, setExpedienteActual] = useState<Expediente | null>(null);
  const [archivos, setArchivos]             = useState<ArchivoExpediente[]>([]);
  const [nuevoDocumento, setMostrarNuevo]   = useState(false);
  const [tituloArchivo, setTituloArchivo]   = useState('');
  const [archivoSubido, setArchivoSubido]   = useState<ArchivoSubido | null>(null);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);
  const [guardando, setGuardando]           = useState(false);
  const [eliminando, setEliminando]         = useState(false);
  const [previewImagen, setPreviewImagen]   = useState<string | null>(null);
  const [search, setSearch]                 = useState('');

  // ConfirmModal eliminar
  const [archivoAEliminar, setArchivoAEliminar] = useState<ArchivoExpediente | null>(null);

  // ─── Listeners Firestore ──────────────────────────────────────────────────
  useEffect(() => {
    if (!id) { setLoading(false); return; }
    return onSnapshot(doc(db, 'expedientes', String(id)), (snap) => {
      setExpedienteActual(snap.exists() ? { id: snap.id, ...(snap.data() as Omit<Expediente, 'id'>) } : null);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    return onSnapshot(
      query(collection(db, 'expedientes', String(id), 'archivos'), orderBy('fechaSubida', 'desc')),
      (snap) => setArchivos(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })))
    );
  }, [id]);

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const getTipoArchivo = (mime = ''): ArchivoExpediente['tipoArchivo'] => {
    const t = mime.toLowerCase();
    if (t.startsWith('image/')) return 'imagen';
    if (t.includes('pdf'))    return 'pdf';
    if (t.includes('word') || t.includes('officedocument.wordprocessingml')) return 'word';
    return 'otro';
  };

  // ─── Archivo ─────────────────────────────────────────────────────────────
  const seleccionarArchivo = async () => {
    const resultado = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
    if (resultado.canceled || !resultado.assets) return;
    const asset = resultado.assets[0];
    setSubiendoArchivo(true);
    try {
      const subido = await subirArchivo(asset.uri, asset.name, asset.mimeType ?? 'application/octet-stream');
      if (subido) setArchivoSubido(subido);
      else toastError('No se pudo subir el archivo');
    } finally {
      setSubiendoArchivo(false);
    }
  };

  const cerrarModal = () => {
    setMostrarNuevo(false);
    setTituloArchivo('');
    setArchivoSubido(null);
    setSubiendoArchivo(false);
    setGuardando(false);
  };

  const guardarArchivo = async () => {
    if (!id || !tituloArchivo.trim() || !archivoSubido || guardando) return;
    setGuardando(true);
    try {
      await addDoc(collection(db, 'expedientes', String(id), 'archivos'), {
        titulo:       tituloArchivo.trim(),
        tipoArchivo:  getTipoArchivo(archivoSubido.tipo),
        url:          archivoSubido.url,
        public_id:    archivoSubido.publicId,
        nombreArchivo: archivoSubido.nombre,
        mimeType:     archivoSubido.tipo,
        sizeBytes:    archivoSubido.tamano,
        fechaSubida:  serverTimestamp(),
      });
      exito('Archivo guardado correctamente');
      cerrarModal();
    } catch {
      toastError('No se pudo guardar el archivo');
    } finally {
      setGuardando(false);
    }
  };

  const abrirArchivo = async (archivo: ArchivoExpediente) => {
    if (archivo.tipoArchivo === 'imagen') { setPreviewImagen(archivo.url); return; }
    await Linking.openURL(archivo.url);
  };

  const confirmarEliminar = (archivo: ArchivoExpediente) => setArchivoAEliminar(archivo);

  const eliminarArchivo = async () => {
    if (!archivoAEliminar || eliminando || !id) return;
    setEliminando(true);
    try {
      await borrarArchivo(archivoAEliminar.public_id);
      await deleteDoc(doc(db, 'expedientes', String(id), 'archivos', archivoAEliminar.id));
      exito('Archivo eliminado');
    } catch {
      toastError('No se pudo eliminar el archivo');
    } finally {
      setEliminando(false);
      setArchivoAEliminar(null);
    }
  };

  const archivosFiltrados = useMemo(() => {
    const texto = search.trim().toLowerCase();
    if (!texto) return archivos;
    return archivos.filter((e) =>
      (e.titulo ?? '').toLowerCase().includes(texto) ||
      (e.nombreArchivo ?? '').toLowerCase().includes(texto)
    );
  }, [archivos, search]);

  const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    contenido: { flex: 1, width: '100%' },
    btnNuevo: {
      backgroundColor: colors.primary, position: 'absolute',
      bottom: r.padV + 4, right: r.padH,
      paddingVertical: r.btnPadV, paddingHorizontal: r.inputPadH,
      borderRadius: r.btnRadius, alignItems: 'center', justifyContent: 'center',
    },
    cards: {
      flexDirection: 'row', backgroundColor: colors.card,
      borderRadius: r.cardRadius, padding: r.cardPad,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
      margin: r.gap / 2,
    },
    detailsCards: { flex: 1, marginHorizontal: r.gap / 1.5 },
    nombreArchivo: { fontSize: r.inputFontSz, fontWeight: 'bold', marginBottom: 2, color: colors.primary },
    subArchivo:    { fontSize: r.label, color: colors.text, opacity: 0.7 },
    sizeText:      { fontSize: r.small, color: colors.text, opacity: 0.6 },
    btnEliminar:   { padding: 6, borderRadius: 6, backgroundColor: '#fff0f0', marginTop: 6 },
  });

  // ─── Estados vacíos ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.text }}>Cargando expediente...</Text>
      </View>
    );
  }

  if (!expedienteActual) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.text }}>No se encontró el expediente.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Toast mensaje={toast.mensaje} tipo={toast.tipo} visible={toast.visible} onHide={ocultar} />

      {/* HEADER */}
      <View style={{ paddingHorizontal: r.padH, paddingBottom: r.padV, paddingTop: r.padV + 20 }}>
        <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={{ fontSize: r.body, color: colors.primary, fontWeight: '600' }}>Volver</Text>
        </Pressable>
        <Text style={{ fontSize: r.h2, color: colors.text, fontWeight: 'bold' }} numberOfLines={1}>
          Expediente de {expedienteActual.nombreCliente}
        </Text>
        <Text style={{ fontSize: r.body, color: colors.subtext, marginTop: 2 }}>
          Caso: {expedienteActual.casoCliente}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: r.padH, paddingBottom: 100 }}>
        <View style={styles.container}>
          {/* Buscador */}
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
            borderRadius: r.radiusSm, borderWidth: 1, borderColor: colors.border,
            paddingHorizontal: r.inputPadH, marginBottom: r.gap }}>
            <Feather name="search" size={20} color={colors.subtext} />
            <TextInput placeholder="Buscar archivo..." placeholderTextColor={colors.subtext}
              value={search} onChangeText={setSearch}
              style={{ flex: 1, color: colors.text, paddingVertical: r.inputPadV,
                paddingHorizontal: r.inputPadH }} />
          </View>

          {/* Lista de archivos */}
          <View style={styles.contenido}>
            {archivosFiltrados.length === 0 ? (
              <Text style={{ color: colors.subtext, textAlign: 'center', marginTop: 20 }}>
                {search.trim() ? 'Sin resultados para tu búsqueda' : 'No hay archivos en este expediente'}
              </Text>
            ) : (
              archivosFiltrados.map((item) => {
                const { icono, color } = iconoArchivo(item.mimeType || item.tipoArchivo);
                return (
                  <Pressable key={item.id} onPress={() => abrirArchivo(item)} style={styles.cards}>
                    <View style={{ width: 50, height: 50, backgroundColor: color + '33',
                      borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={icono as any} size={18} color={color} />
                    </View>
                    <View style={styles.detailsCards}>
                      <Text style={styles.nombreArchivo} numberOfLines={1}>{item.titulo}</Text>
                      <Text style={styles.subArchivo} numberOfLines={1}>
                        {item.nombreArchivo || item.tipoArchivo.toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
                      <Text style={styles.sizeText}>{item.sizeBytes ? formatearTamano(item.sizeBytes) : ''}</Text>
                      <Pressable onPress={(e) => { e.stopPropagation(); confirmarEliminar(item); }}
                        style={styles.btnEliminar} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <Ionicons name="trash-outline" size={15} color="#ef4444" />
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* FAB */}
      <Pressable style={({ pressed }) => ({ ...styles.btnNuevo, opacity: pressed ? 0.8 : 1 })}
        onPress={() => setMostrarNuevo(true)}>
        <AntDesign name="plus" size={26} color="white" />
      </Pressable>

      {/* ConfirmModal: Eliminar archivo */}
      <ConfirmModal
        visible={!!archivoAEliminar}
        tipo="danger"
        titulo="Eliminar archivo"
        mensaje={`¿Eliminar "${archivoAEliminar?.titulo}"? Esta acción no se puede deshacer.`}
        textoConfirmar={eliminando ? 'Eliminando...' : 'Eliminar'}
        textoCancelar="Cancelar"
        onCancelar={() => setArchivoAEliminar(null)}
        onConfirmar={eliminarArchivo}
      />

      {/* MODAL: Nuevo documento */}
      <Modal visible={nuevoDocumento} transparent animationType="slide" onRequestClose={cerrarModal}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000088' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: r.radiusLg,
            borderTopRightRadius: r.radiusLg, padding: r.padH, paddingBottom: 40 }}>

            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border,
              alignSelf: 'center', marginBottom: 16 }} />
            <Text style={{ color: colors.text, fontSize: r.h2, fontWeight: '700', marginBottom: r.gap }}>
              Nuevo documento
            </Text>

            <TextInput value={tituloArchivo} onChangeText={setTituloArchivo}
              placeholder="Nombre del documento" placeholderTextColor={colors.subtext}
              style={{ backgroundColor: colors.background, color: colors.text,
                borderRadius: r.inputRadius, paddingVertical: r.inputPadV,
                paddingHorizontal: r.inputPadH, marginBottom: r.gap }} />

            <Pressable onPress={seleccionarArchivo} disabled={subiendoArchivo}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: r.gap,
                backgroundColor: colors.primary + '18', borderWidth: 1.5, borderColor: colors.primary,
                borderStyle: 'dashed', borderRadius: r.radiusLg, paddingVertical: r.inputPadV, marginBottom: r.gap }}>
              <Ionicons name="cloud-upload-outline" size={22} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: '700' }}>
                {subiendoArchivo ? 'Subiendo archivo...' : 'Seleccionar archivo'}
              </Text>
            </Pressable>

            <Text style={{ color: colors.subtext, fontSize: 11, textAlign: 'center', marginBottom: 14 }}>
              PDF, Word, Excel, imágenes, txt y más
            </Text>

            {archivoSubido ? (() => {
              const { icono, color } = iconoArchivo(archivoSubido.tipo);
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: color + '14',
                  borderRadius: r.radiusSm, padding: r.gap, gap: r.gap / 1.4,
                  borderWidth: 1, borderColor: color + '33', marginBottom: r.gap }}>
                  <View style={{ width: r.iconMd + 14, height: r.iconMd + 14, borderRadius: (r.iconMd + 14) / 2,
                    backgroundColor: color + '22', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name={icono as any} size={r.iconSm} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: r.label, fontWeight: '600' }} numberOfLines={1}>
                      {archivoSubido.nombre}
                    </Text>
                    <Text style={{ color: colors.subtext, fontSize: r.small }}>
                      {formatearTamano(archivoSubido.tamano)}
                    </Text>
                  </View>
                  <Pressable onPress={() => setArchivoSubido(null)} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={r.iconMd} color="#ef4444" />
                  </Pressable>
                </View>
              );
            })() : (
              <Text style={{ color: colors.subtext, fontSize: r.small, marginBottom: 12, textAlign: 'center' }}>
                Sin archivo seleccionado
              </Text>
            )}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={cerrarModal}
                style={{ flex: 1, backgroundColor: colors.input, paddingVertical: r.btnPadV,
                  borderRadius: r.btnRadius, alignItems: 'center' }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={guardarArchivo}
                disabled={guardando || !tituloArchivo.trim() || !archivoSubido}
                style={{ flex: 1, backgroundColor: colors.primary, paddingVertical: r.btnPadV,
                  borderRadius: r.btnRadius, alignItems: 'center',
                  opacity: (guardando || !tituloArchivo.trim() || !archivoSubido) ? 0.5 : 1 }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>{guardando ? 'Guardando...' : 'Guardar'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: Preview imagen */}
      <Modal visible={!!previewImagen} transparent animationType="fade" onRequestClose={() => setPreviewImagen(null)}>
        <Pressable onPress={() => setPreviewImagen(null)}
          style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
          {previewImagen ? (
            <Image source={{ uri: previewImagen }} style={{ width: '92%', height: '70%', borderRadius: 10 }} resizeMode="contain" />
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}