import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { StepBar } from '@/components/StepBar';
import { Tag } from '@/components/Tag';
import { Text } from '@/components/Text';
import { colors, space } from '@/theme/tokens';

// Temporary catalog of the base components, to review them on a device. Bienvenida replaces it.
// It breaks "one primary button per screen" on purpose, to show every state.
export default function ComponentCatalog() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="display">Componentes</Text>

        <Section title="Texto">
          <Text variant="title">title · Cuidadores cerca de ti</Text>
          <Text variant="heading">heading · Próxima visita</Text>
          <Text>body · Ana cuidará a Luna el sábado de 9:00 a 13:00.</Text>
          <Text variant="bodyStrong">bodyStrong · $12 por visita</Text>
          <Text variant="label">label · Reservar visita</Text>
          <Text variant="caption" color="inkMuted">
            caption · Hace 5 min · 1.2 km
          </Text>
        </Section>

        <Section title="Button">
          <Button label="Crear mi cuenta" onPress={() => {}} />
          <Button label="Enviar solicitud" disabled />
          <Button label="Pagando" loading />
          <Button label="Ya tengo cuenta" variant="secondary" onPress={() => {}} />
          <Button label="¿Olvidaste tu contraseña?" variant="ghost" onPress={() => {}} />
          <Button label="Cancelar solicitud" variant="danger" onPress={() => {}} />
        </Section>

        <Section title="Input">
          <Input
            label="Correo"
            placeholder="tu@correo.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input
            label="Contraseña"
            placeholder="Crea una contraseña"
            helper="Mínimo 8 caracteres."
            secureTextEntry={!showPassword}
            accessory={
              <Button
                label={showPassword ? 'Ocultar' : 'Ver'}
                variant="ghost"
                onPress={() => setShowPassword(!showPassword)}
              />
            }
          />
          <Input
            label="Teléfono"
            optional
            prefix="+503"
            placeholder="7000 0000"
            keyboardType="phone-pad"
          />
          <Input label="Nombre" defaultValue="Lu" error="Escribe al menos 3 letras." />
          <Input
            label="Instrucciones para Ana"
            optional
            multiline
            placeholder="Ej.: Luna come a las 9:00 y le dan miedo los cohetes."
          />
        </Section>

        <Section title="Card">
          <Card>
            <Text variant="heading">Próxima visita</Text>
            <Text color="inkMuted">Lun 19 oct, 9:00 · Visita a domicilio</Text>
          </Card>
          <Card onPress={() => {}} accessibilityLabel="Ana Martínez, ver perfil">
            <Text variant="bodyStrong">Ana Martínez (se puede tocar)</Text>
            <Text variant="caption" color="inkMuted">
              4.9 (38) · 126 servicios · por visita
            </Text>
          </Card>
        </Section>

        <Section title="Tag">
          <View style={styles.tags}>
            <Tag tone="certified" label="⭐ Certificada" />
            <Tag tone="info" label="Estudiante de veterinaria" />
            <Tag tone="warning" label="Falta pagar · antes de las 17:30" />
            <Tag tone="success" label="Visita confirmada" />
            <Tag tone="special" label="Cuidado especial" />
            <Tag tone="error" label="Cancelada" />
          </View>
        </Section>

        <Section title="StepBar">
          <StepBar current={1} total={2} />
          <StepBar current={2} steps={['Solicitar', 'Ana responde', 'Pagar']} />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="heading">{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { padding: space[4], gap: space[8] },
  section: { gap: space[4] },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
