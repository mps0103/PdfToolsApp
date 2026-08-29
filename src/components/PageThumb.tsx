import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { PdfRender } from '../native/PdfRender';
import { colors, radius, type } from '../theme';

type Props = { src: string; pageIndex: number; width?: number };

export default function PageThumb({ src, pageIndex, width = 220 }: Props) {
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    PdfRender.thumbnail(src, pageIndex, width)
      .then(u => alive && setUri(u))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [src, pageIndex, width]);

  if (failed) {
    return (
      <View style={[styles.box, styles.center]}>
        <Text style={type.hint}>Preview unavailable</Text>
      </View>
    );
  }

  if (!uri) {
    return (
      <View style={[styles.box, styles.center]}>
        <ActivityIndicator color={colors.textDim} />
      </View>
    );
  }

  return <Image source={{ uri }} style={styles.box} resizeMode="contain" />;
}

const styles = StyleSheet.create({
  box: {
    width: '100%',
    aspectRatio: 0.707, // A4
    borderRadius: radius.sm,
    backgroundColor: '#FFFFFF',
  },
  center: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
});
