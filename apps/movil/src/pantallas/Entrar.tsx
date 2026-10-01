/** Entrar: mail, codigo, adentro.
 *
 *  Dos pasos en una sola pantalla. El segundo reemplaza al primero en vez de
 *  abrir otra, para que volver atras y corregir el mail sea un toque y no una
 *  navegacion. */

import { useRef, useState } from 'react';
import {
  ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { api, ErrorApi } from '../api';
import type { Guardada } from '../sesion';

export function Entrar({ onEntro }: { onEntro: (s: Guardada) => void }) {
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [paso, setPaso] = useState<'mail' | 'codigo'>('mail');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const campoCodigo = useRef<TextInput>(null);

  async function pedir() {
    Keyboard.dismiss();
    setError(null);
    setCargando(true);
    try {
      await api.pedirCodigo(email);
      setPaso('codigo');
      // El teclado numerico aparece solo: un paso menos parado en la calle.
      setTimeout(() => campoCodigo.current?.focus(), 100);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo. Probá de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  async function verificar() {
    Keyboard.dismiss();
    setError(null);
    setCargando(true);
    try {
      const r = await api.verificar(
        email, codigo,
        `${Platform.OS} ${Platform.Version}`,
      );
      onEntro({ token: r.token, usuarioId: r.usuarioId, email: email.trim().toLowerCase() });
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo. Probá de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  const puedePedir = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const puedeEntrar = codigo.trim().length === 6;

  return (
    <KeyboardAvoidingView
      style={e.todo}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={e.centro}>
        <Text style={e.titulo}>Gastos del viaje</Text>

        {paso === 'mail' ? (
          <>
            <Text style={e.ayuda}>
              Poné tu mail y te mandamos un código para entrar. Sin contraseñas.
            </Text>
            <TextInput
              style={e.campo}
              value={email}
              onChangeText={setEmail}
              placeholder="tu@mail.com"
              placeholderTextColor="#9aa0a6"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              inputMode="email"
              onSubmitEditing={() => puedePedir && pedir()}
              returnKeyType="send"
              editable={!cargando}
            />
            <Boton texto="Mandame el código" onPress={pedir} activo={puedePedir} cargando={cargando} />
          </>
        ) : (
          <>
            <Text style={e.ayuda}>
              Te mandamos un código a{'\n'}
              <Text style={e.fuerte}>{email.trim().toLowerCase()}</Text>
            </Text>
            <TextInput
              ref={campoCodigo}
              style={[e.campo, e.campoCodigo]}
              value={codigo}
              onChangeText={(t) => setCodigo(t.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              placeholderTextColor="#9aa0a6"
              keyboardType="number-pad"
              inputMode="numeric"
              // Android lo autocompleta desde el SMS o el mail si puede.
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
              onSubmitEditing={() => puedeEntrar && verificar()}
              editable={!cargando}
            />
            <Boton texto="Entrar" onPress={verificar} activo={puedeEntrar} cargando={cargando} />
            <Pressable
              onPress={() => { setPaso('mail'); setCodigo(''); setError(null); }}
              disabled={cargando}
            >
              <Text style={e.volver}>Usar otro mail</Text>
            </Pressable>
          </>
        )}

        {error ? <Text style={e.error}>{error}</Text> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

function Boton({
  texto, onPress, activo, cargando,
}: { texto: string; onPress: () => void; activo: boolean; cargando: boolean }) {
  const habilitado = activo && !cargando;
  return (
    <Pressable
      style={({ pressed }) => [
        e.boton,
        !habilitado && e.botonApagado,
        pressed && habilitado && e.botonApretado,
      ]}
      onPress={onPress}
      disabled={!habilitado}
    >
      {cargando
        ? <ActivityIndicator color="#fff" />
        : <Text style={e.botonTexto}>{texto}</Text>}
    </Pressable>
  );
}

const e = StyleSheet.create({
  todo: { flex: 1, backgroundColor: '#fff' },
  centro: { flex: 1, justifyContent: 'center', padding: 24, gap: 14 },
  titulo: { fontSize: 30, fontWeight: '700', color: '#15181c', marginBottom: 4 },
  ayuda: { fontSize: 16, lineHeight: 23, color: '#5f6368' },
  fuerte: { color: '#15181c', fontWeight: '600' },
  campo: {
    borderWidth: 1, borderColor: '#dadce0', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 17, color: '#15181c',
  },
  campoCodigo: { fontSize: 30, letterSpacing: 8, textAlign: 'center', fontVariant: ['tabular-nums'] },
  boton: {
    backgroundColor: '#1a73e8', borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center', minHeight: 54,
  },
  botonApagado: { backgroundColor: '#c5c9ce' },
  botonApretado: { backgroundColor: '#1557b0' },
  botonTexto: { color: '#fff', fontSize: 17, fontWeight: '600' },
  volver: { color: '#1a73e8', fontSize: 15, textAlign: 'center', paddingVertical: 10 },
  error: { color: '#c5221f', fontSize: 15, lineHeight: 21 },
});
