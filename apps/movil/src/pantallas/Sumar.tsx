/** Sumar a alguien al viaje, por su mail.
 *
 *  No hay invitacion que aceptar: queda adentro en el momento. La primera vez
 *  que entre con ese mail se va a encontrar el viaje esperandola. Una pantalla
 *  menos, y un estado menos que mantener. */

import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { api, ErrorApi } from '../api';

export function Sumar({
  token, viaje, onCerrar, onSumado,
}: {
  token: string;
  viaje: string;
  onCerrar: () => void;
  onSumado: () => void;
}) {
  const [email, setEmail] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const puede = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) && !guardando;

  async function sumar() {
    setError(null);
    setGuardando(true);
    try {
      await api.invitar(token, viaje, email.trim());
      onSumado();
      onCerrar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo sumar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onCerrar}>
      <KeyboardAvoidingView
        style={e.todo}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={e.barra}>
          <Pressable onPress={onCerrar} hitSlop={10} disabled={guardando}>
            <Text style={e.cancelar}>Cancelar</Text>
          </Pressable>
          <Text style={e.tituloBarra}>Sumar a alguien</Text>
          <View style={{ width: 64 }} />
        </View>

        <View style={e.cuerpo}>
          <Text style={e.ayuda}>
            Poné su dirección de mail. Queda adentro del viaje en el momento, y
            cuando entre con ese mail va a encontrarlo esperándola.
          </Text>

          <TextInput
            style={e.campo}
            value={email}
            onChangeText={setEmail}
            placeholder="su@mail.com"
            placeholderTextColor="#9aa0a6"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            inputMode="email"
            autoFocus
            editable={!guardando}
            onSubmitEditing={() => puede && sumar()}
            returnKeyType="done"
          />

          {error ? <Text style={e.error}>{error}</Text> : null}
        </View>

        <Pressable
          style={({ pressed }) => [e.boton, !puede && e.botonApagado, pressed && puede && e.botonApretado]}
          onPress={sumar}
          disabled={!puede}
        >
          {guardando
            ? <ActivityIndicator color="#fff" />
            : <Text style={e.botonTexto}>Sumar al viaje</Text>}
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const e = StyleSheet.create({
  todo: { flex: 1, backgroundColor: '#fff' },
  barra: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 52, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#eceff1',
  },
  tituloBarra: { fontSize: 17, fontWeight: '600', color: '#15181c' },
  cancelar: { color: '#1a73e8', fontSize: 16, width: 64 },
  cuerpo: { flex: 1, padding: 20, gap: 16 },
  ayuda: { fontSize: 16, lineHeight: 23, color: '#5f6368' },
  campo: {
    borderWidth: 1, borderColor: '#dadce0', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 17, color: '#15181c',
  },
  error: { color: '#c5221f', fontSize: 15, lineHeight: 21 },
  boton: {
    margin: 20, backgroundColor: '#1a73e8', borderRadius: 14,
    paddingVertical: 17, alignItems: 'center', justifyContent: 'center', minHeight: 56,
  },
  botonApagado: { backgroundColor: '#c5c9ce' },
  botonApretado: { backgroundColor: '#1557b0' },
  botonTexto: { color: '#fff', fontSize: 17, fontWeight: '600' },
});
