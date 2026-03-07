import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { r } from '../utils/responsive';

type ToastTipo = 'success' | 'error' | 'warning' | 'info';

interface ToastConfig {
  mensaje: string;
  tipo: ToastTipo;
  visible: boolean;
}

interface ToastProps {
  mensaje: string;
  tipo: ToastTipo;
  visible: boolean;
  onHide: () => void;
}

const configs = {
  success: { color: '#22c55e', bg: '#f0fdf4', border: '#86efac', icono: 'checkmark-circle' },
  error:   { color: '#ef4444', bg: '#fef2f2', border: '#fca5a5', icono: 'close-circle' },
  warning: { color: '#f59e0b', bg: '#fffbeb', border: '#fcd34d', icono: 'warning' },
  info:    { color: '#3b82f6', bg: '#eff6ff', border: '#93c5fd', icono: 'information-circle' },
};

export function Toast({ mensaje, tipo, visible, onHide }: ToastProps) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const config = configs[tipo];

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: -100, duration: 300, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start(() => onHide());
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 60,
        left: 16,
        right: 16,
        zIndex: 9999,
        transform: [{ translateY }],
        opacity,
      }}
    >
      <View style={{
        backgroundColor: config.bg,
        borderRadius: r.radius,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: r.gap,
        borderWidth: 1,
        borderColor: config.border,
        shadowColor: config.color,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 8,
      }}>
        <Ionicons name={config.icono as any} size={28} color={config.color} />
        <Text style={{ flex: 1, color: config.color, fontSize: r.body, fontWeight: '600', lineHeight: 20 }}>
          {mensaje}
        </Text>
      </View>
    </Animated.View>
  );
}

// Hook para usar el toast fácilmente
export function useToast() {
  const [toast, setToast] = useState<ToastConfig>({ mensaje: '', tipo: 'info', visible: false });

  const mostrar = (mensaje: string, tipo: ToastTipo = 'info') => {
    setToast({ mensaje, tipo, visible: true });
  };

  const ocultar = () => setToast((t) => ({ ...t, visible: false }));

  const exito = (mensaje: string) => mostrar(mensaje, 'success');
  const error = (mensaje: string) => mostrar(mensaje, 'error');
  const advertencia = (mensaje: string) => mostrar(mensaje, 'warning');
  const info = (mensaje: string) => mostrar(mensaje, 'info');

  return { toast, ocultar, exito, error, advertencia, info };
}