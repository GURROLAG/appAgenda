import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useTema } from '../context/TemaContext';

interface ConfirmModalProps {
  visible: boolean;
  titulo: string;
  mensaje: string;
  tipo?: 'danger' | 'warning' | 'info';
  textoCancelar?: string;
  textoConfirmar?: string;
  onCancelar: () => void;
  onConfirmar: () => void;
}

const tipoConfig = {
  danger:  { color: '#ef4444', bg: '#fef2f2', icono: 'trash-outline' },
  warning: { color: '#f59e0b', bg: '#fffbeb', icono: 'warning-outline' },
  info:    { color: '#3b82f6', bg: '#eff6ff', icono: 'information-circle-outline' },
};

export function ConfirmModal({
  visible, titulo, mensaje, tipo = 'info',
  textoCancelar = 'Cancelar', textoConfirmar = 'Confirmar',
  onCancelar, onConfirmar,
}: ConfirmModalProps) {
  const { colors } = useTema();
  const config = tipoConfig[tipo];

  if (!visible) return null;

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#00000077', justifyContent: 'center', alignItems: 'center', zIndex: 9998, padding: 32 }}>
      <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 28, width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 20 }}>
        {/* Ícono */}
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: config.bg, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: config.color }}>
            <Ionicons name={config.icono as any} size={32} color={config.color} />
          </View>
        </View>

        <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text, textAlign: 'center', marginBottom: 10 }}>
          {titulo}
        </Text>
        <Text style={{ fontSize: 15, color: colors.subtext, textAlign: 'center', marginBottom: 28, lineHeight: 22 }}>
          {mensaje}
        </Text>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable
            onPress={onCancelar}
            style={({ pressed }) => ({ flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center', backgroundColor: pressed ? colors.border : colors.input, borderWidth: 1, borderColor: colors.border })}
          >
            <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 16 }}>{textoCancelar}</Text>
          </Pressable>
          <Pressable
            onPress={onConfirmar}
            style={({ pressed }) => ({ flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center', backgroundColor: pressed ? config.color + 'dd' : config.color })}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>{textoConfirmar}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}