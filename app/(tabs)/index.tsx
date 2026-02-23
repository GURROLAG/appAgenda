import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { onAuthStateChanged } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { Calendar as BigCalendar, Event } from 'react-native-big-calendar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConfirmModal } from '../../src/components/ConfirmModal';
import { Toast, useToast } from '../../src/components/Toast';
import { useTema } from '../../src/context/TemaContext';
import { auth } from '../../src/firebase/firebaseConfig';
import { db } from '../../src/firebase/firestore';
import { useUsuario } from '../../src/hooks/useUsuario';

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

export default function HomeScreen() {
  const { colors, darkMode } = useTema();
  const { usuario } = useUsuario();
  const { toast, ocultar, exito, error, advertencia } = useToast();

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
  const [colorSeleccionado, setColorSeleccionado] = useState<string>('');
  const [mostrarHora, setMostrarHora] = useState(false);
  const [mostrarFecha, setMostrarFecha] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [formVisible, setFormVisible] = useState(false);

  const coloresDisponibles = ['#1e90ff', '#ff6347', '#32cd32', '#ffa500', '#800080'];

  const saludo = () => {
    const hora = new Date().getHours();
    if (hora < 12) return 'Buenos días';
    if (hora < 19) return 'Buenas tardes';
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
      if (evento.time && typeof evento.time === 'string') {
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
    }
    setFormVisible(true);
    Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }).start();
  };

  const cerrarFormulario = () => {
    Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
      setFormVisible(false);
      setTitle('');
      setDescripcion('');
      setHora(null);
      setEventoSeleccionado(null);
      setMostrarHora(false);
      setMostrarFecha(false);
      setColorSeleccionado('');
    });
  };

  const slideInterpolate = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [700, 0] });

  const cambiarMes = (inc: number) => {
    const nuevoMes = new Date(mesVisible);
    nuevoMes.setMonth(nuevoMes.getMonth() + inc);
    setMesVisible(nuevoMes);
  };

  const crearEvento = async () => {
    if (!title?.trim()) { advertencia('Falta el nombre del evento'); return; }
    if (!fechaSeleccionada) { advertencia('Selecciona la fecha del evento'); return; }
    if (!hora) { advertencia('Selecciona la hora del evento'); return; }

    const horaString = hora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    const color = colorSeleccionado || coloresDisponibles[0];

    try {
      if (eventoSeleccionado) {
        await updateDoc(doc(db, 'agenda', eventoSeleccionado.id), { title, description: descripcion || '', date: fechaSeleccionada, time: horaString, color });
        exito('Evento actualizado correctamente');
      } else {
        await addDoc(collection(db, 'agenda'), { title, description: descripcion || '', date: fechaSeleccionada, time: horaString, color, createdBy: uid, createdAt: serverTimestamp() });
        exito('Evento creado correctamente');
      }
      cerrarFormulario();
    } catch {
      error('No se pudo guardar el evento');
    }
  };

  const confirmarEliminar = (id: string) => setEventoAEliminar(id);

  const eliminarEvento = async () => {
    if (!eventoAEliminar) return;
    try {
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
    if (!e.date || typeof e.date !== 'string') return null;
    const start = parseLocalDate(e.date);
    if (isNaN(start.getTime())) return null;
    if (e.time && typeof e.time === 'string') {
      const time24 = convertTo24Hour(e.time);
      const parts = time24.split(':').map(Number);
      if (parts.length >= 2 && !parts.some(isNaN)) start.setHours(parts[0], parts[1], 0, 0);
    }
    const end = new Date(start);
    end.setHours(start.getHours() + 1);
    if (isNaN(end.getTime())) return null;
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
            const fechaISO = toLocalDateString(date);
            const isSelected = fechaSeleccionada === fechaISO;
            return { backgroundColor: isSelected ? colors.primary : darkMode ? '#2a2a2a' : '#e0e0e0', borderRadius: isSelected ? 25 : 8, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' };
          }}
          monthCellTextStyle={({ date }) => {
            const fechaISO = toLocalDateString(date);
            const isSelected = fechaSeleccionada === fechaISO;
            return { color: isSelected ? '#fff' : colors.text, fontWeight: isSelected ? 'bold' : 'normal', textAlign: 'center' };
          }}
        />

        {/* BOTÓN NUEVO EVENTO */}
        <Pressable onPress={() => abrirFormulario()} style={{ marginTop: 16, backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', elevation: 5 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>＋ Nuevo evento</Text>
        </Pressable>

        {/* LISTA EVENTOS */}
        <View style={{ marginTop: 16 }}>
          {fechaSeleccionada && (
            <Text style={{ fontSize: 17, fontWeight: 'bold', color: colors.text, marginBottom: 12 }}>
              {eventosDelDia.length > 0
                ? `📅 ${parseLocalDate(fechaSeleccionada).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`
                : `Sin eventos — ${parseLocalDate(fechaSeleccionada).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`}
            </Text>
          )}
          {eventosDelDia.map((item) => (
            <View key={item.id} style={{ backgroundColor: item.color || colors.primary, padding: 16, marginBottom: 12, borderRadius: 16, elevation: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>{item.title}</Text>
                <Text style={{ color: '#fff', marginTop: 4, opacity: 0.9 }}>🕐 {item.time}</Text>
                {item.description ? <Text style={{ color: '#fff', marginTop: 2, fontSize: 14, opacity: 0.9 }}>{item.description}</Text> : null}
              </View>
              <View style={{ flexDirection: 'row', marginLeft: 10, gap: 8 }}>
                <TouchableOpacity onPress={() => abrirFormulario(item)} style={{ padding: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)' }}>
                  <Ionicons name="pencil-outline" size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmarEliminar(item.id)} style={{ padding: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)' }}>
                  <Ionicons name="trash-outline" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Confirm eliminar */}
      <ConfirmModal
        visible={!!eventoAEliminar}
        titulo="Eliminar evento"
        mensaje="¿Estás seguro que deseas eliminar este evento? Esta acción no se puede deshacer."
        tipo="danger"
        textoConfirmar="Eliminar"
        onCancelar={() => setEventoAEliminar(null)}
        onConfirmar={eliminarEvento}
      />

      {/* FORMULARIO */}
      {formVisible && (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, top: 0, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
            <Animated.View style={{ transform: [{ translateY: slideInterpolate }], backgroundColor: colors.card, borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 24, maxHeight: '90%', elevation: 20 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 }} />
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.text, marginBottom: 20 }}>
                  {eventoSeleccionado ? '✏️ Editar Evento' : '✨ Nuevo Evento'}
                </Text>

                <TextInput placeholder="Título del evento *" placeholderTextColor={colors.border} value={title} onChangeText={setTitle}
                  style={{ backgroundColor: colors.input, padding: 16, borderRadius: 14, color: colors.text, fontSize: 16, marginBottom: 16 }} />

                <TextInput placeholder="Descripción (opcional)" placeholderTextColor={colors.border} value={descripcion} onChangeText={setDescripcion} multiline
                  style={{ backgroundColor: colors.input, padding: 16, borderRadius: 14, color: colors.text, fontSize: 16, marginBottom: 16, minHeight: 80 }} />

                {/* Colores */}
                <Text style={{ color: colors.subtext, fontSize: 13, marginBottom: 10 }}>Color del evento</Text>
                <View style={{ flexDirection: 'row', marginBottom: 16, gap: 8 }}>
                  {coloresDisponibles.map((c) => (
                    <Pressable key={c} onPress={() => setColorSeleccionado(c)}
                      style={{ backgroundColor: c, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: colorSeleccionado === c ? 3 : 0, borderColor: '#fff', shadowColor: c, shadowOpacity: 0.5, shadowRadius: 4, elevation: 3 }}>
                      {colorSeleccionado === c && <Ionicons name="checkmark" size={20} color="#fff" />}
                    </Pressable>
                  ))}
                </View>

                {/* Fecha */}
                <Pressable onPress={() => setMostrarFecha(true)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.input, padding: 14, borderRadius: 14, marginBottom: 12 }}>
                  <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                  <Text style={{ marginLeft: 12, color: fechaSeleccionada ? colors.text : colors.subtext, fontSize: 16 }}>
                    {fechaSeleccionada ? parseLocalDate(fechaSeleccionada).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Seleccionar fecha'}
                  </Text>
                </Pressable>
                {mostrarFecha && (
                  <DateTimePicker value={fechaSeleccionada ? parseLocalDate(fechaSeleccionada) : new Date()} mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                    onChange={(event, selectedDate) => { setMostrarFecha(false); if (selectedDate) setFechaSeleccionada(toLocalDateString(selectedDate)); }} />
                )}

                {/* Hora */}
                <Pressable onPress={() => setMostrarHora(true)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.input, padding: 14, borderRadius: 14, marginBottom: 24 }}>
                  <Ionicons name="time-outline" size={20} color={colors.primary} />
                  <Text style={{ marginLeft: 12, color: hora ? colors.text : colors.subtext, fontSize: 16 }}>
                    {hora ? hora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 'Seleccionar hora'}
                  </Text>
                </Pressable>
                {mostrarHora && (
                  <DateTimePicker value={hora ?? new Date()} mode="time" is24Hour={false} display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedTime) => { if (event.type === 'dismissed') { setMostrarHora(false); return; } if (selectedTime) setHora(selectedTime); setMostrarHora(false); }} />
                )}

                <Pressable onPress={crearEvento} style={{ backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginBottom: 12, elevation: 4 }}>
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
        </TouchableWithoutFeedback>
      )}
    </SafeAreaView>
  );
}