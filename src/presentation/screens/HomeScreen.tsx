import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isSupabaseConfigured } from '@/application/auth';
import type { DatabaseHealth } from '@/presentation/hooks/useDatabaseHealth';
import { colors } from '@/presentation/theme/colors';

type HomeScreenProps = {
  database: DatabaseHealth;
};

export function HomeScreen({ database }: HomeScreenProps) {
  const databaseReady = database.status === 'ready';

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>MÓDULO 0</Text>
        <Text style={styles.title}>La base está lista</Text>
        <Text style={styles.subtitle}>
          Navegación, almacenamiento local y conexión remota preparados para construir FriendBlast.
        </Text>

        <View style={styles.card}>
          <StatusRow label="Expo Router" ready detail="4 pestañas" />
          <StatusRow
            label="SQLite"
            ready={databaseReady}
            detail={databaseReady ? 'v' + (database.version ?? 'activa') : database.status}
          />
          <StatusRow
            label="Supabase"
            ready={isSupabaseConfigured}
            detail={isSupabaseConfigured ? 'configurado' : 'faltan credenciales'}
          />
        </View>

        <Text style={styles.note}>El siguiente módulo será autenticación y perfiles.</Text>
      </View>
    </SafeAreaView>
  );
}

type StatusRowProps = {
  detail: string;
  label: string;
  ready: boolean;
};

function StatusRow({ detail, label, ready }: StatusRowProps) {
  return (
    <View style={styles.statusRow}>
      <View style={[styles.statusDot, ready ? styles.readyDot : styles.pendingDot]} />
      <View style={styles.statusText}>
        <Text style={styles.statusLabel}>{label}</Text>
        <Text style={styles.statusDetail}>{detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    marginTop: 8,
    color: colors.text,
    fontSize: 34,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 12,
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  card: {
    marginTop: 30,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    backgroundColor: colors.surface,
    paddingHorizontal: 18,
  },
  statusRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  readyDot: {
    backgroundColor: colors.success,
  },
  pendingDot: {
    backgroundColor: colors.warning,
  },
  statusText: {
    flex: 1,
    marginLeft: 12,
  },
  statusLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  statusDetail: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 13,
  },
  note: {
    marginTop: 22,
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
  },
});
