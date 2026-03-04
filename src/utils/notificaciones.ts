import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configurar cómo se muestran las notificaciones cuando la app está abierta
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ─── PERMISOS ────────────────────────────────────────────────────────────────

export async function solicitarPermisosNotificaciones(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('alarmas', {
      name: 'Alarmas de eventos',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1e90ff',
      sound: 'default',
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    await Notifications.setNotificationChannelAsync('recordatorios', {
      name: 'Recordatorios de eventos',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

// ─── TIPOS ───────────────────────────────────────────────────────────────────

export type TipoRecordatorio = 'enHorario' | '5min' | '15min' | '30min' | '1hora' | '1dia';

export const OPCIONES_RECORDATORIO: { label: string; value: TipoRecordatorio; minutos: number }[] = [
  { label: 'En el momento',    value: 'enHorario', minutos: 0 },
  { label: '5 min antes',      value: '5min',      minutos: 5 },
  { label: '15 min antes',     value: '15min',     minutos: 15 },
  { label: '30 min antes',     value: '30min',     minutos: 30 },
  { label: '1 hora antes',     value: '1hora',     minutos: 60 },
  { label: '1 día antes',      value: '1dia',      minutos: 1440 },
];

// ─── PROGRAMAR NOTIFICACIÓN ──────────────────────────────────────────────────

interface ProgramarProps {
  eventoId: string;
  titulo: string;
  descripcion?: string;
  fechaHoraEvento: Date;
  tipoRecordatorio: TipoRecordatorio;
  esAlarma: boolean;
}

export async function programarNotificacion({
  eventoId,
  titulo,
  descripcion,
  fechaHoraEvento,
  tipoRecordatorio,
  esAlarma,
}: ProgramarProps): Promise<string | null> {
  const opcion = OPCIONES_RECORDATORIO.find((o) => o.value === tipoRecordatorio);
  if (!opcion) return null;

  const fechaNotificacion = new Date(fechaHoraEvento.getTime() - opcion.minutos * 60 * 1000);
  const ahora = new Date();

  if (fechaNotificacion <= ahora) {
    return null; // Ya pasó la hora
  }

  const segundosHasta = Math.floor((fechaNotificacion.getTime() - ahora.getTime()) / 1000);

  const textoMomento =
    opcion.minutos === 0
      ? 'Tu evento está comenzando ahora'
      : `Comienza en ${opcion.label.replace(' antes', '')}`;

  try {
    const notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: esAlarma ? `⏰ ${titulo}` : `📅 ${titulo}`,
        body: descripcion ? `${textoMomento} — ${descripcion}` : textoMomento,
        sound: 'default',
        data: { eventoId, esAlarma },
        ...(Platform.OS === 'android' && {
          channelId: esAlarma ? 'alarmas' : 'recordatorios',
          priority: esAlarma ? 'max' : 'high',
          vibrate: esAlarma ? [0, 250, 250, 250] : [0, 100],
        }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: segundosHasta,
        repeats: false,
      },
    });

    return notifId;
  } catch (err) {
    console.error('Error programando notificación:', err);
    return null;
  }
}

// ─── CANCELAR ────────────────────────────────────────────────────────────────

export async function cancelarNotificacion(notifId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notifId);
  } catch {
    // Ya no existe, ignorar
  }
}

export async function cancelarTodasNotificaciones(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function obtenerNotificacionesProgramadas() {
  return await Notifications.getAllScheduledNotificationsAsync();
}