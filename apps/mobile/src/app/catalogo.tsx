import type { ServiceCode } from '@pawie/api-client';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Banner } from '@/components/Banner';
import { BottomBar } from '@/components/BottomBar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CaregiverPhoto } from '@/components/CaregiverPhoto';
import { Checkbox } from '@/components/Checkbox';
import { Chip } from '@/components/Chip';
import { Icon, type IconName } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { icons } from '@/components/icons.generated';
import { Input } from '@/components/Input';
import { LevelTag } from '@/components/LevelTag';
import { Nimbus } from '@/components/Nimbus';
import { Row } from '@/components/Row';
import { Select } from '@/components/Select';
import { ServiceBlock } from '@/components/ServiceBlock';
import { Sheet } from '@/components/Sheet';
import { Status } from '@/components/Status';
import { StepBar } from '@/components/StepBar';
import { StarMedal, Tag } from '@/components/Tag';
import { Text } from '@/components/Text';
import { colors, gutter, space } from '@/theme/tokens';

// Catalog of the components, to review them on a device. Only exists in development.
// It breaks "one primary button per screen" on purpose, to show every state.
export default function ComponentCatalog() {
  const [showPassword, setShowPassword] = useState(false);
  const [species, setSpecies] = useState<'dog' | 'cat'>('dog');
  const [approximate, setApproximate] = useState(true);
  const [district, setDistrict] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [service, setService] = useState<ServiceCode>('HOME_VISIT');

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
          <Text variant="display">Valeria Martínez</Text>
          <Text variant="title">Hola, Daniela</Text>
          <Text variant="heading">Verificado por Pawie</Text>
          <Text variant="subheading">Gabriela Flores</Text>
          <Text variant="price">$18</Text>
          <Text variant="priceSmall">$13.20</Text>
          <Text variant="label">Reservar visita</Text>
          <Text variant="placa">Súper Cuidador</Text>
          <Text>Ana cuidará a Luna el sábado de 9:00 a 13:00.</Text>
          <Text variant="bodyStrong">Disponible para Luna</Text>
          <Text variant="caption" color="inkMuted">
            Ordenados por calificación
          </Text>
          <Text variant="footnote" color="inkMuted">
            por visita
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

        <Section title="Row y Card">
          <View>
            <Row onPress={() => {}} accessibilityLabel="Ana Martínez, ver perfil">
              <CaregiverPhoto name="Ana Martínez" />
              <View style={styles.flex}>
                <Text variant="subheading">Ana Martínez</Text>
                <Text variant="caption" color="inkMuted">
                  Se puede tocar
                </Text>
              </View>
              <Text variant="price">$12</Text>
            </Row>
            <Row divider>
              <Avatar name="Luna" />
              <Text variant="subheading" style={styles.flex}>
                Luna
              </Text>
            </Row>
          </View>
          <Card>
            <Text variant="heading">Un grupo de campos</Text>
            <Text color="inkMuted">O un desglose, como el precio de Reservar.</Text>
          </Card>
        </Section>

        <Section title="Tag (placas)">
          <View style={styles.tags}>
            <Tag kind="badge" label="Identidad verificada" icon="check" />
            <Tag kind="certification" label="Primeros auxilios" />
            <Tag kind="star" label="Cuidado especial" />
            <Tag kind="level" level="PRO" />
            <Tag kind="level" level="SUPER" />
            <Tag kind="service" service="WALK" />
            <Tag kind="service" service="HOME_VISIT" />
            <Tag kind="service" service="OVERNIGHT_STAY" size="sm" />
            <StarMedal />
          </View>
          <View style={styles.row}>
            <View style={styles.flex}>
              <LevelTag level="TRUSTED" caption="Tu nivel" />
            </View>
            <View style={styles.flex}>
              <LevelTag level="SUPER" />
            </View>
          </View>
        </Section>

        <Section title="Status">
          <Status tone="info" label="Ana responde antes de las 17:30" />
          <Status tone="warning" label="Falta pagar antes de las 17:30" />
          <Status tone="success" label="Visita confirmada" />
          <Status tone="error" label="La cancelaste" />
        </Section>

        <Section title="ServiceBlock">
          <View style={styles.row}>
            <ServiceBlock
              service="WALK"
              detail="Solo perros"
              selected={service === 'WALK'}
              onPress={() => setService('WALK')}
            />
            <ServiceBlock
              service="HOME_VISIT"
              detail="En tu casa"
              selected={service === 'HOME_VISIT'}
              onPress={() => setService('HOME_VISIT')}
            />
            <ServiceBlock
              service="OVERNIGHT_STAY"
              detail="Toda la noche"
              selected={service === 'OVERNIGHT_STAY'}
              onPress={() => setService('OVERNIGHT_STAY')}
            />
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
          <View style={styles.tags}>
            <Text>Para</Text>
            <Chip
              label="Luna"
              photo={<Avatar name="Luna" size={36} />}
              accessibilityLabel="Mascotas: Luna. Cambiar"
              onPress={() => {}}
            />
            <Text>en</Text>
            <Chip
              label="San Salvador"
              icon={<Icon name="map-pin" size={18} color="primary" />}
              onPress={() => {}}
            />
          </View>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Chip label="Perro" selected={species === 'dog'} onPress={() => setSpecies('dog')} />
            </View>
            <View style={styles.flex}>
              <Chip label="Gato" selected={species === 'cat'} onPress={() => setSpecies('cat')} />
            </View>
          </View>
        </Section>

        <Section title="Checkbox">
          <Checkbox
            label="No sé la fecha exacta, es aproximada"
            checked={approximate}
            onChange={setApproximate}
          />
        </Section>

        <Section title="Select y Sheet">
          <Select
            label="Distrito"
            placeholder="Elige tu distrito"
            value={district}
            options={[
              { value: 'san-salvador', label: 'San Salvador' },
              { value: 'santa-tecla', label: 'Santa Tecla' },
              { value: 'antiguo-cuscatlan', label: 'Antiguo Cuscatlán' },
            ]}
            onChange={setDistrict}
          />
          <Button variant="secondary" label="Abrir un Sheet" onPress={() => setSheetOpen(true)} />
          <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Cambiar búsqueda">
            <Text>El contenido se desplaza si no cabe.</Text>
          </Sheet>
        </Section>

        <Section title="Nimbus">
          <View style={styles.row}>
            <Nimbus pose="hola" background="tint" size={96} />
            <Nimbus pose="durmiendo" background="tint" size={96} />
          </View>
        </Section>

        <Section title="BottomBar">
          <BottomBar amount="$12" caption="Precio por visita">
            <Button label="Reservar visita" onPress={() => {}} />
          </BottomBar>
        </Section>

        <Section title="Avatar y CaregiverPhoto">
          <View style={styles.row}>
            <Avatar name="Luna" size={36} />
            <Avatar name="Mishi" />
            <CaregiverPhoto name="Ana Martínez" />
            <CaregiverPhoto name="Valeria Martínez" width={120} />
          </View>
        </Section>

        <Section title="IconButton">
          <View style={styles.row}>
            <IconButton icon="chevron-left" accessibilityLabel="Volver" onPress={() => {}} />
            <IconButton icon="x" accessibilityLabel="Cerrar" onPress={() => {}} />
            <IconButton
              icon="plus"
              variant="plain"
              color="primary"
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
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: gutter, gap: space[8] },
  section: { gap: space[4] },
  tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  flex: { flex: 1 },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: space[4] },
  icon: { width: 96, alignItems: 'center', gap: space[1] },
});
