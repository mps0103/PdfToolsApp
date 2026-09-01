import React from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, type } from '../theme';

// Keep in step with versionName in android/app/build.gradle.
export const APP_VERSION = '1.0';
const PRIVACY_URL = 'https://mps0103.github.io/PdfToolsApp/privacy';
const CONTACT_EMAIL = 'info@dealtrix.com';

export default function AboutScreen() {
  const open = (url: string) => {
    Linking.openURL(url).catch(() =>
      Alert.alert('Could not open', 'No app on this phone can handle that link.'),
    );
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: space.lg }}>
      <View style={styles.card}>
        <Text style={styles.name}>PDF Tools</Text>
        <Text style={[type.hint, { marginTop: space.xs }]}>by MPS</Text>
        <Text style={[type.hint, { marginTop: space.sm }]}>Version {APP_VERSION}</Text>
      </View>

      <View style={styles.card}>
        <Text style={type.body}>
          Thirty two tools for working with PDF files: merge, split, compress, convert, sign,
          protect and more.
        </Text>
        <Text style={[type.body, { marginTop: space.md, color: colors.accent }]}>
          Everything runs on this phone.
        </Text>
        <Text style={[type.hint, { marginTop: space.xs }]}>
          Your files are never uploaded. There is no account and no sign in, and every tool works
          with the network switched off.
        </Text>
      </View>

      <Pressable onPress={() => open(PRIVACY_URL)} style={styles.link}>
        <Text style={type.body}>Privacy policy</Text>
        <Text style={type.hint}>Opens in your browser</Text>
      </Pressable>

      <Pressable
        onPress={() => open(`mailto:${CONTACT_EMAIL}?subject=PDF Tools ${APP_VERSION}`)}
        style={styles.link}
      >
        <Text style={type.body}>Contact</Text>
        <Text style={type.hint}>{CONTACT_EMAIL}</Text>
      </Pressable>

      <Text style={[type.hint, styles.footer]}>
        Ads in this app are supplied by Google AdMob. Nothing from your documents is shared with
        advertisers.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.lg,
    marginBottom: space.md,
  },
  name: { fontSize: 24, fontWeight: '700', color: colors.text, letterSpacing: -0.4 },
  link: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.lg,
    marginBottom: space.md,
  },
  footer: { marginTop: space.md, textAlign: 'center' },
});