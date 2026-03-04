import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { onAuthStateChanged } from 'firebase/auth';
import {
  addDoc, collection, deleteDoc, doc, onSnapshot,
  orderBy, query, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  Animated, KeyboardAvoidingView, Platform,
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
  OPCIONES_RECORDATORIO,
  TipoRecordatorio,
  cancelarNotificacion,
  programarNotificacion,
} from '../../src/utils/notificaciones';

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

function SelectorRecordatorio({
  valor, onChange, colors,
}: {
  valor: TipoRecordatorio;
  onChange: (v: TipoRecordatorio) => void;
  colors: any;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
        {OPCIONES_RECORDATORIO.map((op) => {
          const activo = valor === op.value;
          return (
            <TouchableOpacity
              key={op.value}
              onPress={() => onChange(op.value)}
              style={{
                paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
                borderWidth: 1.5,
                borderColor: activo ? colors.primary : colors.border,
                backgroundColor: activo ? colors.primary : colors.input,
              }}
            >
              <Text style={{ color: activo ? '#fff' : colors.subtext, fontSize: 13, fontWeight: activo ? 'bold' : 'normal' }}>
                {op.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

export default function HomeScreen() {
  const { colors, darkMode } = useTema();
  const { usuario } = useUsuario();
  const { toast, ocultar, exito, error, advertencia, info } = useToast();

  const [uid, setUid] = useState<string | null>(null);
  const [eventos, setEventos] = useState<any[]>([]);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string | null>(null);
  const [mesVisible, setMesVisible] = useState<Date>(new Date());
  const [nombreMesActual, setNombreMesActual] = useState('');

  const [eventoSeleccionado, setEventoSeleccionado] = useState<any>(null);
  const [eventoAEliminar, setEventoAEliminar] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [hora, setHora] = useState<Date | null>(null);
  const [colorSeleccionado, setColorSeleccionado] = useState('');
  const [mostrarHora, setMostrarHora] = useState(false);
  const [mostrarFecha, setMostrarFecha] = useState(false);

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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => { if (user) setUid(user.uid); });
    return unsub;
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'agenda'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setEventos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

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
      if (evento.time) {
        try {
          const time24 = convertTo24Hour(evento.time);
          const [h, m] = time24.split(':').map(Number);
          if (!isNaN(h) && !isNaN(m)) {
            const d = new Date(); d.setHours(h, m, 0, 0); setHora(d);
          } else setHora(new Date());
        } catch { setHora(new Date()); }
      } else setHora(null);
    } else {
      setEventoSeleccionado(null);
      setTitle('');
      setDescripcion('');
      setHora(null);
      setColorSeleccionado('');
      setNotifActiva(false);
      setEsAlarma(false);
      setTipoRecordatorio('15min');
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
    });
  };

  const slideInterpolate = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [700, 0] });

  const cambiarMes = (inc: number) => {
    const n = new Date(mesVisible);
    n.setMonth(n.getMonth() + inc);
    setMesVisible(n);
  };

  const guardarEvento = async () => {
    if (!title?.trim()) { advertencia('Falta el nombre del evento'); return; }
    if (!fechaSeleccionada) { advertencia('Selecciona la fecha del evento'); return; }
    if (!hora) { advertencia('Selecciona la hora del evento'); return; }

    const horaString = hora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    const color = colorSeleccionado || coloresDisponibles[0];
    const fechaHoraEvento = construirFechaHora(fechaSeleccionada, hora);

    let notifId: string | null = null;

    if (notifActiva) {
      if (eventoSeleccionado?.notifId) await cancelarNotificacion(eventoSeleccionado.notifId);
      notifId = await programarNotificacion({
        eventoId: eventoSeleccionado?.id || 'nuevo',
        titulo: title.trim(),
        descripcion: descripcion || undefined,
        fechaHoraEvento,
        tipoRecordatorio,
        esAlarma,
      });
      if (notifId) {
        const opcion = OPCIONES_RECORDATORIO.find((o) => o.value === tipoRecordatorio);
        info(esAlarma ? `⏰ Alarma programada: ${opcion?.label}` : `🔔 Recordatorio: ${opcion?.label}`);
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
        notifActiva,
        esAlarma: notifActiva ? esAlarma : false,
        tipoRecordatorio: notifActiva ? tipoRecordatorio : null,
        notifId: notifId || null,
      };

      if (eventoSeleccionado) {
        await updateDoc(doc(db, 'agenda', eventoSeleccionado.id), datos);
        exito('Evento actualizado correctamente');
      } else {
        await addDoc(collection(db, 'agenda'), { ...datos, createdBy: uid, createdAt: serverTimestamp() });
        exito('Evento creado correctamente');
      }
      cerrarFormulario();
    } catch {
      error('No se pudo guardar el evento');
    }
  };

  const eliminarEvento = async () => {
    if (!eventoAEliminar) return;
    const evento = eventos.find((e) => e.id === eventoAEliminar);
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

  const eventosDelDia = fechaSeleccionada ? eventos.filter((e) => e.date === fechaSeleccionada) : [];

  const eventosCalendar: Event[] = eventos.map((e) => {
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <Toast mensaje={toast.mensaje} tipo={toast.tipo} visible={toast.visible} onHide={ocultar} />

      {/* BIENVENIDA */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
        <Text style={{ fontSize: 14, color: colors.subtext }}>{saludo()},</Text>
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.text }}>
          {usuario?.nombre ?? 'Usuario'} 👋
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* MES */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Pressable onPress={() => cambiarMes(-1)} style={{ padding: 8 }}>
            <Text style={{ fontSize: 24, color: colors.text }}>←</Text>
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{nombreMesActual}</Text>
          <Pressable onPress={() => cambiarMes(1)} style={{ padding: 8 }}>
            <Text style={{ fontSize: 24, color: colors.text }}>→</Text>
          </Pressable>
        </View>

        {/* CALENDARIO */}
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
        <Pressable onPress={() => abrirFormulario()} style={{ marginTop: 16, backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', elevation: 5 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>＋ Nuevo evento</Text>
        </Pressable>

        {/* LISTA EVENTOS DEL DÍA */}
        <View style={{ marginTop: 16 }}>
          {fechaSeleccionada && (
            <Text style={{ fontSize: 17, fontWeight: 'bold', color: colors.text, marginBottom: 12 }}>
              {eventosDelDia.length > 0
                ? `📅 ${parseLocalDate(fechaSeleccionada).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`
                : `Sin eventos — ${parseLocalDate(fechaSeleccionada).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`}
            </Text>
          )}
          {eventosDelDia.map((item) => (
            <View key={item.id} style={{ backgroundColor: item.color || colors.primary, padding: 16, marginBottom: 12, borderRadius: 16, elevation: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>{item.title}</Text>
                  <Text style={{ color: '#fff', marginTop: 4, opacity: 0.9 }}>🕐 {item.time}</Text>
                  {item.description ? <Text style={{ color: '#fff', marginTop: 2, fontSize: 14, opacity: 0.9 }}>{item.description}</Text> : null}
                  {item.notifActiva && (
                    <View style={{ flexDirection: 'row', marginTop: 8 }}>
                      <View style={{ backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name={item.esAlarma ? 'alarm' : 'notifications'} size={12} color="#fff" />
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>
                          {item.esAlarma ? 'Alarma' : 'Recordatorio'} · {OPCIONES_RECORDATORIO.find((o) => o.value === item.tipoRecordatorio)?.label ?? ''}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: 'row', marginLeft: 10, gap: 8 }}>
                  <TouchableOpacity onPress={() => abrirFormulario(item)} style={{ padding: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)' }}>
                    <Ionicons name="pencil-outline" size={20} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEventoAEliminar(item.id)} style={{ padding: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)' }}>
                    <Ionicons name="trash-outline" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* CONFIRM ELIMINAR */}
      <ConfirmModal
        visible={!!eventoAEliminar}
        titulo="Eliminar evento"
        mensaje="¿Estás seguro? Si tenía alarma programada también se cancelará."
        tipo="danger"
        textoConfirmar="Eliminar"
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
          {/* Fondo oscuro — toca para cerrar */}
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay }}
            onPress={cerrarFormulario}
          />

          {/* Panel deslizable */}
          <Animated.View
            style={{
              transform: [{ translateY: slideInterpolate }],
              backgroundColor: colors.card,
              borderTopLeftRadius: 25,
              borderTopRightRadius: 25,
              paddingHorizontal: 24,
              paddingTop: 16,
              paddingBottom: 40,
              maxHeight: '92%',
              elevation: 20,
            }}
          >
            {/* Handle */}
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 }} />

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.text, marginBottom: 20 }}>
                {eventoSeleccionado ? '✏️ Editar Evento' : '✨ Nuevo Evento'}
              </Text>

              {/* Título */}
              <TextInput
                placeholder="Título del evento *" placeholderTextColor={colors.border}
                value={title} onChangeText={setTitle}
                style={{ backgroundColor: colors.input, padding: 16, borderRadius: 14, color: colors.text, fontSize: 16, marginBottom: 16 }}
              />

              {/* Descripción */}
              <TextInput
                placeholder="Descripción (opcional)" placeholderTextColor={colors.border}
                value={descripcion} onChangeText={setDescripcion} multiline
                style={{ backgroundColor: colors.input, padding: 16, borderRadius: 14, color: colors.text, fontSize: 16, marginBottom: 16, minHeight: 72 }}
              />

              {/* Colores */}
              <Text style={{ color: colors.subtext, fontSize: 13, marginBottom: 10 }}>Color</Text>
              <View style={{ flexDirection: 'row', marginBottom: 16, gap: 8 }}>
                {coloresDisponibles.map((c) => (
                  <Pressable key={c} onPress={() => setColorSeleccionado(c)}
                    style={{ backgroundColor: c, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: colorSeleccionado === c ? 3 : 0, borderColor: '#fff', elevation: 3 }}>
                    {colorSeleccionado === c && <Ionicons name="checkmark" size={20} color="#fff" />}
                  </Pressable>
                ))}
              </View>

              {/* Fecha */}
              <Pressable onPress={() => setMostrarFecha(true)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.input, padding: 14, borderRadius: 14, marginBottom: 12 }}>
                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                <Text style={{ marginLeft: 12, color: fechaSeleccionada ? colors.text : colors.subtext, fontSize: 16 }}>
                  {fechaSeleccionada
                    ? parseLocalDate(fechaSeleccionada).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
                    : 'Seleccionar fecha'}
                </Text>
              </Pressable>
              {mostrarFecha && (
                <DateTimePicker
                  value={fechaSeleccionada ? parseLocalDate(fechaSeleccionada) : new Date()}
                  mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                  onChange={(e, d) => { setMostrarFecha(false); if (d) setFechaSeleccionada(toLocalDateString(d)); }}
                />
              )}

              {/* Hora */}
              <Pressable onPress={() => setMostrarHora(true)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.input, padding: 14, borderRadius: 14, marginBottom: 20 }}>
                <Ionicons name="time-outline" size={20} color={colors.primary} />
                <Text style={{ marginLeft: 12, color: hora ? colors.text : colors.subtext, fontSize: 16 }}>
                  {hora ? hora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 'Seleccionar hora'}
                </Text>
              </Pressable>
              {mostrarHora && (
                <DateTimePicker
                  value={hora ?? new Date()} mode="time" is24Hour={false}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e, t) => { if (e.type === 'dismissed') { setMostrarHora(false); return; } if (t) setHora(t); setMostrarHora(false); }}
                />
              )}

              {/* NOTIFICACIONES */}
              <View style={{ backgroundColor: colors.input, borderRadius: 16, padding: 16, marginBottom: 20 }}>
                <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 15, marginBottom: 14 }}>
                  🔔 Notificación / Alarma
                </Text>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: notifActiva ? 16 : 0 }}>
                  <View>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>Activar recordatorio</Text>
                    <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 2 }}>Recibir notificación antes del evento</Text>
                  </View>
                  <Switch
                    value={notifActiva} onValueChange={setNotifActiva}
                    trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff"
                  />
                </View>

                {notifActiva && (
                  <>
                    <Text style={{ color: colors.subtext, fontSize: 13, marginBottom: 10 }}>¿Cuándo notificar?</Text>
                    <SelectorRecordatorio valor={tipoRecordatorio} onChange={setTipoRecordatorio} colors={colors} />

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                      <View style={{ flex: 1, marginRight: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="alarm" size={18} color={esAlarma ? '#ffa500' : colors.subtext} />
                          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>Modo alarma</Text>
                        </View>
                        <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 2 }}>
                          Máxima prioridad, suena en silencio
                        </Text>
                      </View>
                      <Switch
                        value={esAlarma} onValueChange={setEsAlarma}
                        trackColor={{ false: colors.border, true: '#ffa500' }} thumbColor="#fff"
                      />
                    </View>
                  </>
                )}
              </View>

              {/* Botones */}
              <Pressable
                onPress={guardarEvento}
                style={{ backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginBottom: 12, elevation: 4 }}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
                  {eventoSeleccionado ? 'Actualizar evento' : 'Crear evento'}
                </Text>
              </Pressable>
              <Pressable onPress={cerrarFormulario} style={{ paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ color: colors.subtext, fontSize: 16 }}>Cancelar</Text>
              </Pressable>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}