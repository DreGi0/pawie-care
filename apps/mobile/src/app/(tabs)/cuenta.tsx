import { useUsersMe } from '@pawie/api-client';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { signOut } from '@/lib/session';
import { colors, space } from '@/theme/tokens';

// No mockup yet: only what's needed to see who is signed in and to sign out.
export default function AccountScreen() {
  const me = useUsersMe();

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="title">Cuenta</Text>
        {me.data && (
          <Card style={styles.profile}>
            <Avatar name={`${me.data.firstName} ${me.data.lastName}`} size={56} />
            <View style={styles.profileText}>
              <Text variant="heading">
                {me.data.firstName} {me.data.lastName}
              </Text>
              <Text variant="caption" color="inkMuted">
                {me.data.email}
              </Text>
            </View>
          </Card>
        )}
        <Button variant="secondary" label="Cerrar sesión" onPress={signOut} />
        {__DEV__ && (
          <Button
            variant="ghost"
            label="Catálogo de componentes"
            onPress={() => router.push('/catalogo')}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { gap: space[4], padding: space[4], paddingTop: space[6] },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  profileText: { flex: 1 },
});
