import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { onAuthStateChanged } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { Calendar as BigCalendar, Event } from 'react-native-big-calendar';
import { auth } from '../../src/firebase/firebaseConfig';
import { db } from '../../src/firebase/firestore';


// ✅ Convierte fecha local a string sin problemas de zona horaria
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
  const [uid, setUid] = useState<string | null>(null);
  const [eventos, setEventos] = useState<any[]>([]);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string | null>(null);
  const [mesVisible, setMesVisible] = useState<Date>(new Date());
  const [nombreMesActual, setNombreMesActual] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [eventoSeleccionado, setEventoSeleccionado] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [hora, setHora] = useState<Date | null>(null);
  const [colorSeleccionado, setColorSeleccionado] = useState<string>('');
  const [mostrarHora, setMostrarHora] = useState(false);
  const [mostrarFecha, setMostrarFecha] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [formVisible, setFormVisible] = useState(false);

  const coloresDisponibles = ['#1e90ff', '#ff6347', '#32cd32', '#ffa500', '#800080'];

  const colors = {
    background: darkMode ? '#121212' : '#f0f0f0',
    card: darkMode ? '#1e1e1e' : '#fff',
    text: darkMode ? '#fff' : '#000',
    border: darkMode ? '#555' : '#ccc',
    primary: '#1e90ff',
    overlay: '#00000055',
    danger: '#ff4d4f',
  };

  const nombreMes = (fecha: Date) =>
    fecha.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();

  useEffect(() => setNombreMesActual(nombreMes(mesVisible)), [mesVisible]);

  useEffect(() => {
    const cargarTema = async () => {
      const tema = await AsyncStorage.getItem('darkMode');
      if (tema) setDarkMode(tema === 'true');
    };
    cargarTema();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('darkMode', darkMode ? 'true' : 'false');
  }, [darkMode]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) setUid(user.uid);
    });
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

    // ✅ Parseo seguro de la hora
    if (evento.time && typeof evento.time === 'string') {
      try {
        const time24 = convertTo24Hour(evento.time);
        const [hours, minutes] = time24.split(':').map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
          const fechaHora = new Date();
          fechaHora.setHours(hours, minutes, 0, 0);
          setHora(fechaHora);
        } else {
          setHora(new Date());
        }
      } catch {
        setHora(new Date());
      }
    } else {
      setHora(null);
    }

  } else {
    setEventoSeleccionado(null);
    setTitle('');
    setDescripcion('');
    setHora(null);
    setColorSeleccionado('');
  }
  setFormVisible(true);
  Animated.timing(slideAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
};

  const cerrarFormulario = () => {
    Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
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

  const slideInterpolate = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] });

  const cambiarMes = (incremento: number) => {
    const nuevoMes = new Date(mesVisible);
    nuevoMes.setMonth(nuevoMes.getMonth() + incremento);
    setMesVisible(nuevoMes);
  };

  const crearEvento = async () => {
    if (!title?.trim()) {
      Alert.alert('Campo obligatorio', 'Falta el nombre del evento');
      return;
    }
    if (!fechaSeleccionada) {
      Alert.alert('Campo obligatorio', 'Falta la fecha del evento');
      return;
    }
    if (!hora) {
      Alert.alert('Campo obligatorio', 'Falta la hora del evento');
      return;
    }

    const horaString = hora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    const color = colorSeleccionado || coloresDisponibles[0];

    if (eventoSeleccionado) {
      await updateDoc(doc(db, 'agenda', eventoSeleccionado.id), {
        title,
        description: descripcion || '',
        date: fechaSeleccionada,
        time: horaString,
        color,
      });
    } else {
      await addDoc(collection(db, 'agenda'), {
        title,
        description: descripcion || '',
        date: fechaSeleccionada,
        time: horaString,
        color,
        createdBy: uid,
        createdAt: serverTimestamp(),
      });
    }

    cerrarFormulario();
  };

  const eliminarEvento = async (id: string) => {
    Alert.alert('Eliminar evento', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deleteDoc(doc(db, 'agenda', id)) },
    ]);
  };

  const eventosDelDia = fechaSeleccionada
    ? eventos.filter((e) => e.date === fechaSeleccionada)
    : [];

  const eventosCalendar: Event[] = eventos
    .map((e) => {
      if (!e.date || typeof e.date !== 'string') return null;
      const start = parseLocalDate(e.date);
      if (isNaN(start.getTime())) return null;

      if (e.time && typeof e.time === 'string') {
        const time24 = convertTo24Hour(e.time);
        const parts = time24.split(':').map(Number);
        if (parts.length >= 2 && !parts.some(isNaN)) {
          start.setHours(parts[0], parts[1], 0, 0);
        }
      }

      const end = new Date(start);
      end.setHours(start.getHours() + 1);
      if (isNaN(end.getTime())) return null;

      return {
        id: e.id,
        title: e.title ?? 'Evento',
        start,
        end,
        color: e.color || coloresDisponibles[0],
      };
    })
    .filter(Boolean) as Event[];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* HEADER */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingBottom: 16,
          paddingTop: 36,
        }}
      >
        <Text style={{ fontSize: 22, color: colors.text, fontWeight: 'bold' }}>Agenda</Text>
        <Pressable onPress={() => setDarkMode(!darkMode)}>
          <Text style={{ fontSize: 22 }}>{darkMode ? '☀️' : '🌙'}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* NOMBRE DEL MES CON FLECHAS */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Pressable onPress={() => cambiarMes(-1)}>
            <Text style={{ fontSize: 24, color: colors.text }}>←</Text>
          </Pressable>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text }}>{nombreMesActual}</Text>
          <Pressable onPress={() => cambiarMes(1)}>
            <Text style={{ fontSize: 24, color: colors.text }}>→</Text>
          </Pressable>
        </View>

        {/* CALENDARIO */}
        <BigCalendar
          events={eventosCalendar}
          height={400}
          mode="month"
          swipeEnabled={false}
          locale="es"
          date={mesVisible}
          // ✅ BUG FIX: Usar fecha local en vez de toISOString() para evitar desfase de zona horaria
          onPressCell={(date) => setFechaSeleccionada(toLocalDateString(date))}
          headerContainerStyle={{ backgroundColor: colors.background }}
          headerTextStyle={{ color: colors.text }}
          dayHeaderTextStyle={{ color: colors.text }}
          hourStyle={{ color: colors.text }}
          eventCellStyle={(event) => ({
            backgroundColor: event.color,
            color: '#fff',
            borderRadius: 8,
            padding: 2,
          })}
          monthCellStyle={({ date }) => {
            const fechaISO = toLocalDateString(date);
            const isSelected = fechaSeleccionada === fechaISO;
            const baseColor = isSelected ? colors.primary : darkMode ? '#2a2a2a' : '#e0e0e0';
            return { backgroundColor: baseColor, borderRadius: isSelected ? 25 : 8, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' };
          }}
          monthCellTextStyle={({ date }) => {
            const fechaISO = toLocalDateString(date);
            const isSelected = fechaSeleccionada === fechaISO;
            return { color: isSelected ? '#fff' : darkMode ? '#fff' : '#000', fontWeight: isSelected ? 'bold' : 'normal', textAlign: 'center' };
          }}
        />

        {/* BOTÓN NUEVO EVENTO */}
        <Pressable
          onPress={() => abrirFormulario()}
          style={{
            marginTop: 16,
            backgroundColor: colors.primary,
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 5,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>＋ Nuevo evento</Text>
        </Pressable>

        {/* LISTA DE EVENTOS DEL DÍA */}
        <View style={{ marginTop: 16 }}>
          {fechaSeleccionada && (
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 12 }}>
              {eventosDelDia.length > 0
                ? `Eventos del ${parseLocalDate(fechaSeleccionada).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`
                : `No hay eventos para el ${parseLocalDate(fechaSeleccionada).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`}
            </Text>
          )}

          {eventosDelDia.map((item) => (
            <View
              key={item.id}
              style={{
                backgroundColor: item.color || colors.primary,
                padding: 16,
                marginBottom: 12,
                borderRadius: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 5,
                elevation: 5,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>{item.title}</Text>
                <Text style={{ color: '#fff', marginTop: 4 }}>{item.time}</Text>
                {item.description ? (
                  <Text style={{ color: '#fff', marginTop: 2, fontSize: 14 }}>{item.description}</Text>
                ) : null}
              </View>

              <View style={{ flexDirection: 'row', marginLeft: 10 }}>
                <TouchableOpacity
                  onPress={() => abrirFormulario(item)}
                  style={{ padding: 6, borderRadius: 8, marginRight: 6, backgroundColor: colors.primary }}
                >
                  <Ionicons name="pencil-outline" size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => eliminarEvento(item.id)}
                  style={{ padding: 6, borderRadius: 8, backgroundColor: colors.danger }}
                >
                  <Ionicons name="trash-outline" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* FORMULARIO MODAL */}
      {formVisible && (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, top: 0, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}
          >
            <Animated.View
              style={{
                transform: [{ translateY: slideInterpolate }],
                backgroundColor: colors.card,
                borderTopLeftRadius: 25,
                borderTopRightRadius: 25,
                padding: 24,
                maxHeight: '90%',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -5 },
                shadowOpacity: 0.25,
                shadowRadius: 10,
                elevation: 10,
              }}
            >
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.text, marginBottom: 20 }}>
                  {eventoSeleccionado ? 'Editar Evento' : 'Nuevo Evento'}
                </Text>

                <TextInput
                  placeholder="Título *"
                  placeholderTextColor={colors.border}
                  value={title}
                  onChangeText={setTitle}
                  style={{ backgroundColor: darkMode ? '#2a2a2a' : '#f4f4f4', padding: 16, borderRadius: 14, color: colors.text, fontSize: 16, marginBottom: 16 }}
                />

                <TextInput
                  placeholder="Descripción (opcional)"
                  placeholderTextColor={colors.border}
                  value={descripcion}
                  onChangeText={setDescripcion}
                  multiline
                  style={{ backgroundColor: darkMode ? '#2a2a2a' : '#f4f4f4', padding: 16, borderRadius: 14, color: colors.text, fontSize: 16, marginBottom: 16, minHeight: 80 }}
                />

                {/* Selector de color */}
                <View style={{ flexDirection: 'row', marginBottom: 16 }}>
                  {coloresDisponibles.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setColorSeleccionado(c)}
                      style={{ backgroundColor: c, width: 32, height: 32, borderRadius: 16, marginRight: 8, justifyContent: 'center', alignItems: 'center', borderWidth: colorSeleccionado === c ? 2 : 0, borderColor: '#000' }}
                    >
                      {colorSeleccionado === c && <Ionicons name="checkmark" size={20} color="#fff" />}
                    </Pressable>
                  ))}
                </View>

                {/* PICKER DE FECHA */}
                <Pressable
                  onPress={() => setMostrarFecha(true)}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: darkMode ? '#2a2a2a' : '#f4f4f4', padding: 14, borderRadius: 14, marginBottom: 16 }}
                >
                  <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                  <Text style={{ marginLeft: 12, color: colors.text, fontSize: 16 }}>
                    {fechaSeleccionada ?? toLocalDateString(new Date())}
                  </Text>
                </Pressable>

                {mostrarFecha && (
                  <DateTimePicker
                    value={fechaSeleccionada ? parseLocalDate(fechaSeleccionada) : new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                    minimumDate={new Date()}
                    maximumDate={new Date(new Date().getFullYear() + 1, 11, 31)}
                    onChange={(event, selectedDate) => {
                      setMostrarFecha(false);
                      // ✅ BUG FIX: Usar fecha local para evitar desfase
                      if (selectedDate) setFechaSeleccionada(toLocalDateString(selectedDate));
                    }}
                  />
                )}

                {/* PICKER DE HORA */}
                <Pressable
                  onPress={() => setMostrarHora(true)}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: darkMode ? '#2a2a2a' : '#f4f4f4', padding: 14, borderRadius: 14, marginBottom: 24 }}
                >
                  <Ionicons name="time-outline" size={20} color={colors.primary} />
                  <Text style={{ marginLeft: 12, color: colors.text, fontSize: 16 }}>
                    {hora ? hora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 'Seleccionar hora'}
                  </Text>
                </Pressable>

                {mostrarHora && (
                  <DateTimePicker
                    value={hora ?? new Date()}
                    mode="time"
                    is24Hour={false}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedTime) => {
                      if (event.type === 'dismissed') { setMostrarHora(false); return; }
                      if (selectedTime) setHora(selectedTime);
                      setMostrarHora(false);
                    }}
                  />
                )}

                <Pressable
                  onPress={crearEvento}
                  style={{ backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginBottom: 12 }}
                >
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Guardar</Text>
                </Pressable>

                <Pressable onPress={cerrarFormulario}>
                  <Text style={{ color: 'red', textAlign: 'center', fontSize: 16 }}>Cancelar</Text>
                </Pressable>
              </ScrollView>
            </Animated.View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      )}
    </View>
  );
}