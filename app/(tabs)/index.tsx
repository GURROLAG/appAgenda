import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { onAuthStateChanged } from 'firebase/auth';
import {
  addDoc, collection, deleteDoc, doc, onSnapshot,
  orderBy, query, serverTimestamp, updateDoc, where,
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  Animated, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, Switch, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { Calendar as BigCalendar, Event } from 'react-native-big-calendar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConfirmModal } from '../../src/components/ConfirmModal';
import { Toast, useToast } from '../../src/components/Toast';
import { useTema } from '../../src/context/TemaContext';
import { auth } from '../../src/firebase/firebaseConfig';
import { db } from '../../src/firebase/firestore';
import { useUsuario } from '../../src/hooks/useUsuario';
import {
  OPCIONES_RECORDATORIO, TipoRecordatorio,
  cancelarNotificacion, programarNotificacion,
} from '../../src/utils/notificaciones';
import { isTablet, r } from '../../src/utils/responsive';

// ─── Tipos ───────────────────────────────────────────────────────────────────

type TipoEvento = 'privado' | 'compartido' | 'general';
type TabAgenda = 'privado' | 'compartido' | 'general';

interface UsuarioBasico { uid: string; nombre: string; }

// ─── Helpers de fecha ────────────────────────────────────────────────────────

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseLocalDate(dateString: string) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function convertTo24Hour(time: string) {
  const [hms, modifier] = time.split(' ');
  let [hours, minutes] = hms.split(':').map(Number);
  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
}

function construirFechaHora(fecha: string, hora: Date): Date {
  const base = parseLocalDate(fecha);
  base.setHours(hora.getHours(), hora.getMinutes(), 0, 0);
  return base;
}

// ─── Selector de recordatorio ─────────────────────────────────────────────────

function SelectorRecordatorio({ valor, onChange, colors }: {
  valor: TipoRecordatorio; onChange: (v: TipoRecordatorio) => void; colors: any;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
        {OPCIONES_RECORDATORIO.map((op) => {
          const activo = valor === op.value;
          return (
            <TouchableOpacity key={op.value} onPress={() => onChange(op.value)}
              style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: r.radiusLg, borderWidth: 1.5, borderColor: activo ? colors.primary : colors.border, backgroundColor: activo ? colors.primary : colors.input }}>
              <Text style={{ color: activo ? '#fff' : colors.subtext, fontSize: r.label, fontWeight: activo ? 'bold' : 'normal' }}>{op.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function HomeScreen() {
  const { colors, darkMode } = useTema();
  const { usuario } = useUsuario();
  const { toast, ocultar, exito, error, advertencia, info } = useToast();

  const [uid, setUid] = useState<string | null>(null);
  const [tabAgenda, setTabAgenda] = useState<TabAgenda>('privado');

  // Eventos por tipo
  const [eventosPrivados, setEventosPrivados] = useState<any[]>([]);
  const [eventosCompartidosMios, setEventosCompartidosMios] = useState<any[]>([]);
  const [eventosCompartidosConmigo, setEventosCompartidosConmigo] = useState<any[]>([]);
  const [eventosGenerales, setEventosGenerales] = useState<any[]>([]);

  // Usuarios
  const [todosUsuarios, setTodosUsuarios] = useState<UsuarioBasico[]>([]);
  const [compartidoCon, setCompartidoCon] = useState<string[]>([]);

  const [fechaSeleccionada, setFechaSeleccionada] = useState<string | null>(null);
  const [mesVisible, setMesVisible] = useState<Date>(new Date());
  const [nombreMesActual, setNombreMesActual] = useState('');

  // Form
  const [eventoSeleccionado, setEventoSeleccionado] = useState<any>(null);
  const [eventoAEliminar, setEventoAEliminar] = useState<string | null>(null);
  const [eventoDetalle, setEventoDetalle] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [hora, setHora] = useState<Date | null>(null);
  const [colorSeleccionado, setColorSeleccionado] = useState('');
  const [mostrarHora, setMostrarHora] = useState(false);
  const [mostrarFecha, setMostrarFecha] = useState(false);

  // Notificaciones
  const [notifActiva, setNotifActiva] = useState(false);
  const [esAlarma, setEsAlarma] = useState(false);
  const [tipoRecordatorio, setTipoRecordatorio] = useState<TipoRecordatorio>('15min');

  const slideAnim = useRef(new Animated.Value(0)).current;
  const [formVisible, setFormVisible] = useState(false);
  const coloresDisponibles = ['#1e90ff', '#ff6347', '#32cd32', '#ffa500', '#800080'];

  const saludo = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const nombreMes = (fecha: Date) =>
    fecha.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();

  useEffect(() => setNombreMesActual(nombreMes(mesVisible)), [mesVisible]);

  // Auth
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => { if (user) setUid(user.uid); });
  }, []);

  // Mis eventos privados
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'agenda'), where('creadoPor', '==', uid), where('tipo', '==', 'privado'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => setEventosPrivados(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [uid]);

  // Mis eventos compartidos (los que yo creé)
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'agenda'), where('creadoPor', '==', uid), where('tipo', '==', 'compartido'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => setEventosCompartidosMios(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [uid]);

  // Eventos compartidos conmigo por otros
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'agenda'), where('compartidoCon', 'array-contains', uid), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => setEventosCompartidosConmigo(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [uid]);

  // Eventos generales
  useEffect(() => {
    const q = query(collection(db, 'agenda'), where('tipo', '==', 'general'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => setEventosGenerales(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, []);

  // Todos los usuarios para selector
  useEffect(() => {
    return onSnapshot(collection(db, 'usuarios'), (snap) => {
      setTodosUsuarios(snap.docs.map((d) => ({ uid: d.id, nombre: d.data().nombre })).filter((u) => u.uid !== uid));
    });
  }, [uid]);

  // ─── Lista activa según tab ───────────────────────────────────────────────

  const eventosCompartidos = [
    ...eventosCompartidosMios,
    ...eventosCompartidosConmigo.filter((e) => e.creadoPor !== uid),
  ];

  const eventosActivos =
    tabAgenda === 'privado' ? eventosPrivados
    : tabAgenda === 'compartido' ? eventosCompartidos
    : eventosGenerales;

  // ─── Formulario ───────────────────────────────────────────────────────────

  const abrirFormulario = (evento: any = null) => {
    if (evento) {
      setEventoSeleccionado(evento);
      setTitle(evento.title);
      setDescripcion(evento.description || '');
      setFechaSeleccionada(evento.date);
      setColorSeleccionado(evento.color || coloresDisponibles[0]);
      setNotifActiva(!!evento.notifActiva);
      setEsAlarma(!!evento.esAlarma);
      setTipoRecordatorio(evento.tipoRecordatorio || '15min');
      setCompartidoCon(evento.compartidoCon || []);
      if (evento.time) {
        try {
          const time24 = convertTo24Hour(evento.time);
          const [h, m] = time24.split(':').map(Number);
          if (!isNaN(h) && !isNaN(m)) { const d = new Date(); d.setHours(h, m, 0, 0); setHora(d); }
          else setHora(new Date());
        } catch { setHora(new Date()); }
      } else setHora(null);
    } else {
      setEventoSeleccionado(null);
      setTitle(''); setDescripcion(''); setHora(null);
      setColorSeleccionado(''); setNotifActiva(false);
      setEsAlarma(false); setTipoRecordatorio('15min');
      setCompartidoCon([]);
    }
    setFormVisible(true);
    Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }).start();
  };

  const cerrarFormulario = () => {
    Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
      setFormVisible(false);
      setTitle(''); setDescripcion(''); setHora(null);
      setEventoSeleccionado(null); setMostrarHora(false); setMostrarFecha(false);
      setColorSeleccionado(''); setNotifActiva(false); setEsAlarma(false);
      setCompartidoCon([]);
    });
  };

  const slideInterpolate = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [700, 0] });
  const cambiarMes = (inc: number) => { const n = new Date(mesVisible); n.setMonth(n.getMonth() + inc); setMesVisible(n); };

  const guardarEvento = async () => {
    if (!title?.trim()) { advertencia('Falta el nombre del evento'); return; }
    if (!fechaSeleccionada) { advertencia('Selecciona la fecha del evento'); return; }
    if (!hora) { advertencia('Selecciona la hora del evento'); return; }
    if (tabAgenda === 'compartido' && compartidoCon.length === 0) {
      advertencia('Selecciona al menos un usuario para compartir'); return;
    }

    const horaString = hora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    const color = colorSeleccionado || coloresDisponibles[0];
    const fechaHoraEvento = construirFechaHora(fechaSeleccionada, hora);

    let notifId: string | null = null;
    if (notifActiva && tabAgenda === 'privado') {
      if (eventoSeleccionado?.notifId) await cancelarNotificacion(eventoSeleccionado.notifId);
      notifId = await programarNotificacion({
        eventoId: eventoSeleccionado?.id || 'nuevo',
        titulo: title.trim(), descripcion: descripcion || undefined,
        fechaHoraEvento, tipoRecordatorio, esAlarma,
      });
      if (notifId) {
        const opcion = OPCIONES_RECORDATORIO.find((o) => o.value === tipoRecordatorio);
        info(esAlarma ? `⏰ Alarma: ${opcion?.label}` : `🔔 Recordatorio: ${opcion?.label}`);
      } else {
        advertencia('No se pudo programar (¿ya pasó la hora?)');
      }
    } else if (eventoSeleccionado?.notifId) {
      await cancelarNotificacion(eventoSeleccionado.notifId);
    }

    try {
      const datos = {
        title: title.trim(),
        description: descripcion || '',
        date: fechaSeleccionada,
        time: horaString,
        color,
        tipo: tabAgenda as TipoEvento,
        compartidoCon: tabAgenda === 'compartido' ? compartidoCon : [],
        creadoPor: uid,
        nombreAutor: usuario?.nombre ?? '',
        notifActiva: notifActiva && tabAgenda === 'privado',
        esAlarma: notifActiva && tabAgenda === 'privado' ? esAlarma : false,
        tipoRecordatorio: notifActiva && tabAgenda === 'privado' ? tipoRecordatorio : null,
        notifId: notifId || null,
      };

      if (eventoSeleccionado) {
        await updateDoc(doc(db, 'agenda', eventoSeleccionado.id), datos);
        exito('Evento actualizado');
      } else {
        await addDoc(collection(db, 'agenda'), { ...datos, createdAt: serverTimestamp() });
        exito('Evento creado');
      }
      cerrarFormulario();
    } catch {
      error('No se pudo guardar el evento');
    }
  };

  const eliminarEvento = async () => {
    if (!eventoAEliminar) return;
    const evento = eventosActivos.find((e) => e.id === eventoAEliminar);
    try {
      if (evento?.notifId) await cancelarNotificacion(evento.notifId);
      await deleteDoc(doc(db, 'agenda', eventoAEliminar));
      exito('Evento eliminado');
    } catch {
      error('No se pudo eliminar el evento');
    } finally {
      setEventoAEliminar(null);
    }
  };

  // ─── Calendario ───────────────────────────────────────────────────────────

  const eventosDelDia = fechaSeleccionada
    ? eventosActivos.filter((e) => e.date === fechaSeleccionada)
    : [];

  const eventosCalendar: Event[] = eventosActivos.map((e) => {
    if (!e.date) return null;
    const start = parseLocalDate(e.date);
    if (isNaN(start.getTime())) return null;
    if (e.time) {
      const time24 = convertTo24Hour(e.time);
      const parts = time24.split(':').map(Number);
      if (parts.length >= 2 && !parts.some(isNaN)) start.setHours(parts[0], parts[1], 0, 0);
    }
    const end = new Date(start);
    end.setHours(start.getHours() + 1);
    return { id: e.id, title: e.title ?? 'Evento', start, end, color: e.color || coloresDisponibles[0] };
  }).filter(Boolean) as Event[];

  const toggleUsuario = (uid: string) =>
    setCompartidoCon((prev) => prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <Toast mensaje={toast.mensaje} tipo={toast.tipo} visible={toast.visible} onHide={ocultar} />

      {/* BIENVENIDA */}
      <View style={{ paddingHorizontal: r.padH, paddingTop: 12, paddingBottom: 4 }}>
        <Text style={{ fontSize: r.body, color: colors.subtext }}>{saludo()},</Text>
        <Text style={{ fontSize: r.h1, fontWeight: 'bold', color: colors.text }}>{usuario?.nombre ?? 'Usuario'} 👋</Text>
      </View>

      {/* TABS */}
      <View style={{ flexDirection: 'row', marginHorizontal: 16, marginTop: 8, marginBottom: 4, backgroundColor: colors.input, borderRadius: r.radius, padding: 4 }}>
        {(['privado', 'compartido', 'general'] as TabAgenda[]).map((tab) => {
          const activo = tabAgenda === tab;
          const icono = tab === 'privado' ? 'lock-closed' : tab === 'compartido' ? 'person-add' : 'people';
          const label = tab === 'privado' ? 'Privado' : tab === 'compartido' ? 'Compartido' : 'General';
          const count = tab === 'privado' ? eventosPrivados.length : tab === 'compartido' ? eventosCompartidos.length : eventosGenerales.length;
          return (
            <Pressable
              key={tab}
              onPress={() => { setTabAgenda(tab); setFechaSeleccionada(null); }}
              style={{ flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5, backgroundColor: activo ? colors.card : 'transparent', elevation: activo ? 2 : 0 }}
            >
              <Ionicons name={icono as any} size={13} color={activo ? colors.primary : colors.subtext} />
              <Text style={{ fontWeight: activo ? 'bold' : 'normal', color: activo ? colors.primary : colors.subtext, fontSize: r.label }}>{label}</Text>
              <View style={{ backgroundColor: activo ? colors.primary : colors.border, borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1 }}>
                <Text style={{ color: activo ? '#fff' : colors.subtext, fontSize: 10, fontWeight: 'bold' }}>{count}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Subtítulo del tab */}
      <Text style={{ color: colors.subtext, fontSize: r.small, textAlign: 'center', marginBottom: 4 }}>
        {tabAgenda === 'privado' ? '🔒 Solo visible para ti · Las alarmas solo funcionan aquí'
          : tabAgenda === 'compartido' ? '👥 Eventos entre usuarios específicos'
          : '🌐 Visible para todos los usuarios'}
      </Text>

      <ScrollView contentContainerStyle={{ padding: r.padH, alignItems: isTablet ? 'center' : undefined }}>
        {/* MES */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Pressable onPress={() => cambiarMes(-1)} style={{ padding: 8 }}>
            <Text style={{ fontSize: 24, color: colors.text }}>←</Text>
          </Pressable>
          <Text style={{ fontSize: r.h2, fontWeight: 'bold', color: colors.text }}>{nombreMesActual}</Text>
          <Pressable onPress={() => cambiarMes(1)} style={{ padding: 8 }}>
            <Text style={{ fontSize: 24, color: colors.text }}>→</Text>
          </Pressable>
        </View>

        {/* CALENDARIO */}
        <View style={{ width: '100%', maxWidth: r.maxW }}>
        <BigCalendar
          events={eventosCalendar} height={420} mode="month" swipeEnabled={false} locale="es" date={mesVisible}
          onPressCell={(date) => setFechaSeleccionada(toLocalDateString(date))}
          headerContainerStyle={{ backgroundColor: colors.background }}
          headerTextStyle={{ color: colors.text }}
          dayHeaderTextStyle={{ color: colors.text }}
          hourStyle={{ color: colors.text }}
          eventCellStyle={(event) => ({ backgroundColor: event.color, color: '#fff', borderRadius: 8, padding: 2 })}
          monthCellStyle={({ date }) => {
            const iso = toLocalDateString(date);
            const sel = fechaSeleccionada === iso;
            return { backgroundColor: sel ? colors.primary : darkMode ? '#2a2a2a' : '#e0e0e0', borderRadius: sel ? 25 : 8, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' };
          }}
          monthCellTextStyle={({ date }) => {
            const iso = toLocalDateString(date);
            const sel = fechaSeleccionada === iso;
            return { color: sel ? '#fff' : colors.text, fontWeight: sel ? 'bold' : 'normal', textAlign: 'center' };
          }}
        />

        {/* BOTÓN NUEVO EVENTO */}
        <Pressable onPress={() => abrirFormulario()} style={{ marginTop: 16, backgroundColor: colors.primary, paddingVertical: 14, borderRadius: r.radiusSm, alignItems: 'center', elevation: 5 }}>
          <Text style={{ color: '#fff', fontSize: r.inputFontSz, fontWeight: 'bold' }}>＋ Nuevo evento {tabAgenda === 'privado' ? '🔒' : tabAgenda === 'compartido' ? '👥' : '🌐'}</Text>
        </Pressable>

        {/* LISTA EVENTOS DEL DÍA */}
        <View style={{ marginTop: 16 }}>
          {fechaSeleccionada && (
            <Text style={{ fontSize: r.body, fontWeight: 'bold', color: colors.text, marginBottom: 12 }}>
              {eventosDelDia.length > 0
                ? `📅 ${parseLocalDate(fechaSeleccionada).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`
                : `Sin eventos — ${parseLocalDate(fechaSeleccionada).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`}
            </Text>
          )}
          {eventosDelDia.map((item) => {
            const esPropio = item.creadoPor === uid;
            const nombresComp = (item.compartidoCon || [])
              .map((id: string) => todosUsuarios.find((u) => u.uid === id)?.nombre)
              .filter(Boolean) as string[];
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.85}
                onPress={() => setEventoDetalle(item)}
                style={{ backgroundColor: item.color || colors.primary, padding: 16, marginBottom: 12, borderRadius: r.radius, elevation: 4 }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: r.inputFontSz }}>{item.title}</Text>
                    <Text style={{ color: '#fff', marginTop: 4, opacity: 0.9 }}>🕐 {item.time}</Text>
                    {item.description ? <Text style={{ color: '#fff', marginTop: 2, fontSize: r.body, opacity: 0.9 }} numberOfLines={2}>{item.description}</Text> : null}

                    {/* Badges */}
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      {item.tipo === 'compartido' && (
                        <View style={{ backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: r.radiusSm }}>
                          <Text style={{ color: '#fff', fontSize: r.small, fontWeight: 'bold' }}>👥 Compartido</Text>
                        </View>
                      )}
                      {item.tipo === 'general' && (
                        <View style={{ backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: r.radiusSm }}>
                          <Text style={{ color: '#fff', fontSize: r.small, fontWeight: 'bold' }}>🌐 General</Text>
                        </View>
                      )}
                      {item.notifActiva && (
                        <View style={{ backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: r.radiusSm, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name={item.esAlarma ? 'alarm' : 'notifications'} size={11} color="#fff" />
                          <Text style={{ color: '#fff', fontSize: r.small, fontWeight: 'bold' }}>
                            {item.esAlarma ? 'Alarma' : 'Recordatorio'} · {OPCIONES_RECORDATORIO.find((o) => o.value === item.tipoRecordatorio)?.label ?? ''}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Compartido con — nombres */}
                    {item.tipo === 'compartido' && esPropio && nombresComp.length > 0 && (
                      <Text style={{ color: '#fff', fontSize: r.small, marginTop: 6, opacity: 0.9 }}>
                        👥 Con: {nombresComp.join(', ')}
                      </Text>
                    )}
                    {item.tipo === 'compartido' && !esPropio && (
                      <Text style={{ color: '#fff', fontSize: r.small, marginTop: 6, opacity: 0.9 }}>
                        📤 Por: {item.nombreAutor ?? 'Otro usuario'}
                      </Text>
                    )}
                  </View>

                  {/* Botones solo si es propio */}
                  {esPropio && (
                    <View style={{ flexDirection: 'row', marginLeft: 10, gap: 8 }}>
                      <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); abrirFormulario(item); }} style={{ padding: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)' }}>
                        <Ionicons name="pencil-outline" size={20} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); setEventoAEliminar(item.id); }} style={{ padding: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)' }}>
                        <Ionicons name="trash-outline" size={20} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                {/* Hint de ver detalle */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 8, gap: 4 }}>
                  <Text style={{ color: '#fff', fontSize: 10, opacity: 0.7 }}>Toca para ver detalle</Text>
                  <Ionicons name="chevron-forward" size={12} color="#fff" style={{ opacity: 0.7 }} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        </View>{/* cierre maxWidth wrapper */}
      </ScrollView>

      {/* MODAL DETALLE EVENTO */}
      <Modal visible={!!eventoDetalle} transparent animationType="slide" onRequestClose={() => setEventoDetalle(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setEventoDetalle(null)} />
          {eventoDetalle && (() => {
            const esPropio = eventoDetalle.creadoPor === uid;
            const nombresComp = (eventoDetalle.compartidoCon || [])
              .map((id: string) => todosUsuarios.find((u) => u.uid === id)?.nombre)
              .filter(Boolean) as string[];
            const colorEvento = eventoDetalle.color || colors.primary;
            const tipoLabel = eventoDetalle.tipo === 'privado' ? '🔒 Privado' : eventoDetalle.tipo === 'compartido' ? '👥 Compartido' : '🌐 General';
            const fechaFormato = eventoDetalle.date
              ? parseLocalDate(eventoDetalle.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
              : '';
            return (
              <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden', maxHeight: '90%' }}>
                <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

                  {/* ── HERO ── */}
                  <View style={{ backgroundColor: colorEvento, paddingHorizontal: r.padH, paddingTop: 16, paddingBottom: 28 }}>
                    {/* Handle */}
                    <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)', alignSelf: 'center', marginBottom: 20 }} />

                    {/* Fila: badge tipo + notif */}
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
                      <View style={{ backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: r.radiusLg }}>
                        <Text style={{ color: '#fff', fontSize: r.small, fontWeight: '700', letterSpacing: 0.3 }}>{tipoLabel}</Text>
                      </View>
                      {eventoDetalle.notifActiva && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: r.radiusLg }}>
                          <Ionicons name={eventoDetalle.esAlarma ? 'alarm' : 'notifications'} size={12} color="#fff" />
                          <Text style={{ color: '#fff', fontSize: r.small, fontWeight: '700' }}>
                            {eventoDetalle.esAlarma ? 'Alarma' : 'Recordatorio'} · {OPCIONES_RECORDATORIO.find((o) => o.value === eventoDetalle.tipoRecordatorio)?.label ?? ''}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Título */}
                    <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800', letterSpacing: -0.5, marginBottom: 16 }}>{eventoDetalle.title}</Text>

                    {/* Fecha y hora en chips */}
                    <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.18)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: r.radiusLg }}>
                        <Ionicons name="calendar-outline" size={14} color="#fff" />
                        <Text style={{ color: '#fff', fontSize: r.label, fontWeight: '600' }}>{fechaFormato}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.18)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: r.radiusLg }}>
                        <Ionicons name="time-outline" size={14} color="#fff" />
                        <Text style={{ color: '#fff', fontSize: r.label, fontWeight: '600' }}>{eventoDetalle.time}</Text>
                      </View>
                    </View>
                  </View>

                  {/* ── CUERPO ── */}
                  <View style={{ paddingHorizontal: r.padH, paddingTop: 24, paddingBottom: 36 }}>

                    {/* Descripción */}
                    {eventoDetalle.description ? (
                      <View style={{ backgroundColor: colors.input, borderRadius: r.radius, padding: 16, marginBottom: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <View style={{ width: 32, height: 32, borderRadius: r.radius, backgroundColor: colorEvento + '22', justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name="document-text-outline" size={16} color={colorEvento} />
                          </View>
                          <Text style={{ color: colors.subtext, fontSize: r.small, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>Descripción</Text>
                        </View>
                        <Text style={{ color: colors.text, fontSize: r.body, lineHeight: 24 }}>{eventoDetalle.description}</Text>
                      </View>
                    ) : null}

                    {/* Creado por */}
                    {eventoDetalle.tipo !== 'privado' && (
                      <View style={{ backgroundColor: colors.input, borderRadius: r.radius, padding: 16, marginBottom: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <View style={{ width: 32, height: 32, borderRadius: r.radius, backgroundColor: colorEvento + '22', justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name="person-circle-outline" size={16} color={colorEvento} />
                          </View>
                          <Text style={{ color: colors.subtext, fontSize: r.small, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>Creado por</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colorEvento, justifyContent: 'center', alignItems: 'center' }}>
                            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: r.inputFontSz }}>
                              {(eventoDetalle.nombreAutor ?? 'U')[0].toUpperCase()}
                            </Text>
                          </View>
                          <Text style={{ color: colors.text, fontSize: r.body, fontWeight: '600' }}>{eventoDetalle.nombreAutor ?? 'Usuario'}</Text>
                        </View>
                      </View>
                    )}

                    {/* Compartido con */}
                    {eventoDetalle.tipo === 'compartido' && esPropio && (
                      <View style={{ backgroundColor: colors.input, borderRadius: r.radius, padding: 16, marginBottom: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <View style={{ width: 32, height: 32, borderRadius: r.radius, backgroundColor: colorEvento + '22', justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name="people-outline" size={16} color={colorEvento} />
                          </View>
                          <Text style={{ color: colors.subtext, fontSize: r.small, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                            Compartido con ({nombresComp.length})
                          </Text>
                        </View>
                        {nombresComp.length === 0 ? (
                          <Text style={{ color: colors.subtext, fontSize: r.body }}>Sin usuarios seleccionados</Text>
                        ) : (
                          <View style={{ gap: 8 }}>
                            {nombresComp.map((nombre, idx) => (
                              <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colorEvento, justifyContent: 'center', alignItems: 'center' }}>
                                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: r.body }}>{nombre[0].toUpperCase()}</Text>
                                </View>
                                <Text style={{ color: colors.text, fontSize: r.body, fontWeight: '500' }}>{nombre}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    )}

                    {/* Si el evento fue compartido contigo */}
                    {eventoDetalle.tipo === 'compartido' && !esPropio && (
                      <View style={{ backgroundColor: colors.input, borderRadius: r.radius, padding: 16, marginBottom: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <View style={{ width: 32, height: 32, borderRadius: r.radius, backgroundColor: colorEvento + '22', justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name="share-social-outline" size={16} color={colorEvento} />
                          </View>
                          <Text style={{ color: colors.subtext, fontSize: r.small, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>Te lo compartió</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colorEvento, justifyContent: 'center', alignItems: 'center' }}>
                            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: r.inputFontSz }}>
                              {(eventoDetalle.nombreAutor ?? 'U')[0].toUpperCase()}
                            </Text>
                          </View>
                          <Text style={{ color: colors.text, fontSize: r.body, fontWeight: '600' }}>{eventoDetalle.nombreAutor ?? 'Usuario'}</Text>
                        </View>
                      </View>
                    )}

                    {/* Botones — solo si es propio */}
                    {esPropio ? (
                      <View style={{ flexDirection: 'row', gap: r.gap, marginTop: 8 }}>
                        <Pressable
                          onPress={() => { setEventoDetalle(null); setTimeout(() => abrirFormulario(eventoDetalle), 300); }}
                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: r.inputPadV, borderRadius: 18, backgroundColor: colorEvento + '18', borderWidth: 1.5, borderColor: colorEvento + '44' }}
                        >
                          <Ionicons name="pencil-outline" size={18} color={colorEvento} />
                          <Text style={{ color: colorEvento, fontWeight: 'bold', fontSize: r.body }}>Editar</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => { setEventoDetalle(null); setTimeout(() => setEventoAEliminar(eventoDetalle.id), 300); }}
                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 18, backgroundColor: '#fff0f0', borderWidth: 1.5, borderColor: '#fecaca' }}
                        >
                          <Ionicons name="trash-outline" size={18} color="#ef4444" />
                          <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: r.body }}>Eliminar</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => setEventoDetalle(null)}
                        style={{ paddingVertical: r.inputPadV, borderRadius: 18, alignItems: 'center', backgroundColor: colors.input, marginTop: 8 }}
                      >
                        <Text style={{ color: colors.subtext, fontWeight: 'bold', fontSize: r.body }}>Cerrar</Text>
                      </Pressable>
                    )}
                  </View>
                </ScrollView>
              </View>
            );
          })()}
        </View>
      </Modal>

      {/* CONFIRM ELIMINAR */}
      <ConfirmModal
        visible={!!eventoAEliminar}
        titulo="Eliminar evento"
        mensaje="¿Estás seguro? Si tenía alarma programada también se cancelará."
        tipo="danger" textoConfirmar="Eliminar"
        onCancelar={() => setEventoAEliminar(null)}
        onConfirmar={eliminarEvento}
      />

      {/* FORMULARIO */}
      {formVisible && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' }}
          pointerEvents="box-none"
        >
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay }} onPress={cerrarFormulario} />

          <Animated.View style={{ transform: [{ translateY: slideInterpolate }], backgroundColor: colors.card, borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingHorizontal: r.padH, paddingTop: 16, paddingBottom: 40, maxHeight: '94%', elevation: 20 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 }} />

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bounces={false} contentContainerStyle={{ paddingBottom: 20 }}>

              {/* Encabezado */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: r.h1, fontWeight: 'bold', color: colors.text }}>
                  {eventoSeleccionado ? '✏️ Editar Evento' : '✨ Nuevo Evento'}
                </Text>
                <View style={{ backgroundColor: tabAgenda === 'privado' ? '#e8f4ff' : tabAgenda === 'compartido' ? '#fff3e0' : '#f0fff0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: r.radiusSm }}>
                  <Text style={{ color: tabAgenda === 'privado' ? colors.primary : tabAgenda === 'compartido' ? '#f59e0b' : '#32cd32', fontSize: r.small, fontWeight: 'bold' }}>
                    {tabAgenda === 'privado' ? '🔒 Privado' : tabAgenda === 'compartido' ? '👥 Compartido' : '🌐 General'}
                  </Text>
                </View>
              </View>

              {/* Título */}
              <TextInput placeholder="Título del evento *" placeholderTextColor={colors.border} value={title} onChangeText={setTitle}
                style={{ backgroundColor: colors.input, padding: 16, borderRadius: r.radius, color: colors.text, fontSize: r.inputFontSz, marginBottom: 16 }} />

              {/* Descripción */}
              <TextInput placeholder="Descripción (opcional)" placeholderTextColor={colors.border} value={descripcion} onChangeText={setDescripcion} multiline
                style={{ backgroundColor: colors.input, padding: 16, borderRadius: r.radius, color: colors.text, fontSize: r.inputFontSz, marginBottom: 16, minHeight: 72 }} />

              {/* Colores */}
              <Text style={{ color: colors.subtext, fontSize: r.label, marginBottom: 10 }}>Color</Text>
              <View style={{ flexDirection: 'row', marginBottom: 16, gap: 8 }}>
                {coloresDisponibles.map((c) => (
                  <Pressable key={c} onPress={() => setColorSeleccionado(c)}
                    style={{ backgroundColor: c, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: colorSeleccionado === c ? 3 : 0, borderColor: '#fff', elevation: 3 }}>
                    {colorSeleccionado === c && <Ionicons name="checkmark" size={20} color="#fff" />}
                  </Pressable>
                ))}
              </View>

              {/* Fecha */}
              <Pressable onPress={() => setMostrarFecha(true)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.input, padding: 14, borderRadius: r.radius, marginBottom: 12 }}>
                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                <Text style={{ marginLeft: 12, color: fechaSeleccionada ? colors.text : colors.subtext, fontSize: r.inputFontSz }}>
                  {fechaSeleccionada ? parseLocalDate(fechaSeleccionada).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Seleccionar fecha'}
                </Text>
              </Pressable>
              {mostrarFecha && (
                <DateTimePicker value={fechaSeleccionada ? parseLocalDate(fechaSeleccionada) : new Date()} mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                  onChange={(e, d) => { setMostrarFecha(false); if (d) setFechaSeleccionada(toLocalDateString(d)); }} />
              )}

              {/* Hora */}
              <Pressable onPress={() => setMostrarHora(true)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.input, padding: 14, borderRadius: r.radius, marginBottom: 20 }}>
                <Ionicons name="time-outline" size={20} color={colors.primary} />
                <Text style={{ marginLeft: 12, color: hora ? colors.text : colors.subtext, fontSize: r.inputFontSz }}>
                  {hora ? hora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 'Seleccionar hora'}
                </Text>
              </Pressable>
              {mostrarHora && (
                <DateTimePicker value={hora ?? new Date()} mode="time" is24Hour={false}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e, t) => { if (e.type === 'dismissed') { setMostrarHora(false); return; } if (t) setHora(t); setMostrarHora(false); }} />
              )}

              {/* NOTIFICACIONES — solo en tab privado */}
              {tabAgenda === 'privado' && (
                <View style={{ backgroundColor: colors.input, borderRadius: r.radius, padding: 16, marginBottom: 20 }}>
                  <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: r.body, marginBottom: 14 }}>🔔 Notificación / Alarma</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: notifActiva ? 16 : 0 }}>
                    <View>
                      <Text style={{ color: colors.text, fontSize: r.body, fontWeight: '600' }}>Activar recordatorio</Text>
                      <Text style={{ color: colors.subtext, fontSize: r.small, marginTop: 2 }}>Recibir notificación antes del evento</Text>
                    </View>
                    <Switch value={notifActiva} onValueChange={setNotifActiva} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
                  </View>
                  {notifActiva && (
                    <>
                      <Text style={{ color: colors.subtext, fontSize: r.label, marginBottom: 10 }}>¿Cuándo notificar?</Text>
                      <SelectorRecordatorio valor={tipoRecordatorio} onChange={setTipoRecordatorio} colors={colors} />
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="alarm" size={18} color={esAlarma ? '#ffa500' : colors.subtext} />
                            <Text style={{ color: colors.text, fontSize: r.body, fontWeight: '600' }}>Modo alarma</Text>
                          </View>
                          <Text style={{ color: colors.subtext, fontSize: r.small, marginTop: 2 }}>Máxima prioridad, suena en silencio</Text>
                        </View>
                        <Switch value={esAlarma} onValueChange={setEsAlarma} trackColor={{ false: colors.border, true: '#ffa500' }} thumbColor="#fff" />
                      </View>
                    </>
                  )}
                </View>
              )}

              {/* Aviso en compartido/general que no hay alarmas */}
              {tabAgenda !== 'privado' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.input, borderRadius: r.radiusSm, padding: 12, marginBottom: 20 }}>
                  <Ionicons name="information-circle-outline" size={18} color={colors.subtext} />
                  <Text style={{ color: colors.subtext, fontSize: r.label, flex: 1 }}>
                    Las alarmas y recordatorios solo están disponibles en eventos privados.
                  </Text>
                </View>
              )}

              {/* SELECTOR USUARIOS — solo en tab compartido */}
              {tabAgenda === 'compartido' && (
                <View style={{ backgroundColor: colors.input, borderRadius: r.radius, padding: 16, marginBottom: 20 }}>
                  <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: r.body, marginBottom: 4 }}>👥 Compartir con</Text>
                  <Text style={{ color: colors.subtext, fontSize: r.small, marginBottom: 14 }}>Selecciona quién puede ver este evento.</Text>
                  {todosUsuarios.length === 0 ? (
                    <Text style={{ color: colors.subtext, fontSize: r.label, textAlign: 'center' }}>No hay otros usuarios</Text>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {todosUsuarios.map((u) => {
                        const sel = compartidoCon.includes(u.uid);
                        return (
                          <TouchableOpacity key={u.uid} onPress={() => toggleUsuario(u.uid)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: r.gap, padding: 12, borderRadius: r.radiusSm, borderWidth: 1.5, borderColor: sel ? colors.primary : colors.border, backgroundColor: sel ? colors.primary + '12' : colors.card }}>
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
                      <Text style={{ color: colors.subtext, fontSize: r.small }}>✅ Compartiendo con {compartidoCon.length} {compartidoCon.length === 1 ? 'persona' : 'personas'}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Botones */}
              <Pressable onPress={guardarEvento} style={{ backgroundColor: colors.primary, paddingVertical: 16, borderRadius: r.radius, alignItems: 'center', marginBottom: 12, elevation: 4 }}>
                <Text style={{ color: '#fff', fontSize: r.inputFontSz, fontWeight: 'bold' }}>{eventoSeleccionado ? 'Actualizar evento' : 'Crear evento'}</Text>
              </Pressable>
              <Pressable onPress={cerrarFormulario} style={{ paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ color: colors.subtext, fontSize: r.inputFontSz }}>Cancelar</Text>
              </Pressable>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}