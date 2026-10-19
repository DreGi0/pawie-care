import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Icon, type IconName } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { icons } from '@/components/icons.generated';
import { Input } from '@/components/Input';
import { StepBar } from '@/components/StepBar';
import { Tag } from '@/components/Tag';
import { Text } from '@/components/Text';
import { colors, space } from '@/theme/tokens';

// Catalog of the components, to review them on a device. Only exists in development.
// It breaks "one primary button per screen" on purpose, to show every state.
export default function ComponentCatalog() {
  const [showPassword, setShowPassword] = useState(false);
  const [species, setSpecies] = useState<'dog' | 'cat'>('dog');

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {router.canGoBack() && (
          <IconButton
            icon="chevron-left"
            accessibilityLabel="Volver"
            onPress={() => router.back()}
          />
        )}
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
              <IconButton
                variant="plain"
                icon={showPassword ? 'eye-off' : 'eye'}
                accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
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

        <Section title="Banner">
          <Banner
            tone="info"
            message="Todavía no pagas. Cuando Ana acepte, tendrás 2 horas para pagar."
          />
          <Banner tone="success" message="Pago recibido. Tu visita está confirmada." />
          <Banner tone="warning" message="Paga antes de las 17:30 o la solicitud se cancela." />
          <Banner
            tone="error"
            message="El correo o la contraseña no coinciden. Revísalos e intenta de nuevo."
          />
        </Section>

        <Section title="Chip">
          <View style={styles.row}>
            <View style={styles.flex}>
              <Chip label="Perro" selected={species === 'dog'} onPress={() => setSpecies('dog')} />
            </View>
            <View style={styles.flex}>
              <Chip label="Gato" selected={species === 'cat'} onPress={() => setSpecies('cat')} />
            </View>
          </View>
        </Section>

        <Section title="Avatar">
          <View style={styles.row}>
            <Avatar name="Luna" size={40} />
            <Avatar name="Ana Martínez" />
            <Avatar name="Mishi" size={56} />
          </View>
        </Section>

        <Section title="IconButton">
          <View style={styles.row}>
            <IconButton icon="chevron-left" accessibilityLabel="Volver" onPress={() => {}} />
            <IconButton icon="x" accessibilityLabel="Cerrar" onPress={() => {}} />
            <IconButton
              icon="plus"
              variant="plain"
              color="grapeDeep"
              accessibilityLabel="Agregar mascota"
              onPress={() => {}}
            />
          </View>
        </Section>

        <Section title="Icon">
          <View style={styles.icons}>
            {(Object.keys(icons) as IconName[]).map((name) => (
              <View key={name} style={styles.icon}>
                <Icon name={name} />
                <Text variant="caption" color="inkMuted">
                  {name}
                </Text>
              </View>
            ))}
          </View>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  flex: { flex: 1 },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: space[4] },
  icon: { width: 96, alignItems: 'center', gap: space[1] },
});
