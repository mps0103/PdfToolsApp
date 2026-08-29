import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

// PDF red. Slightly deeper than pure red so white text stays readable.
export const SPLASH_RED = '#D0271D';

type Props = { onDone: () => void };

export default function Splash({ onDone }: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(12)).current;
  const mark = useRef(new Animated.Value(0.85)).current;
  const out = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(mark, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.back(1.6)),
          useNativeDriver: true,
        }),
        Animated.timing(fade, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(rise, {
          toValue: 0,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(920),
      Animated.timing(out, {
        toValue: 0,
        duration: 260,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onDone();
    });
    // Total: about 1.5 seconds, most of it the hold.
  }, [fade, rise, mark, out, onDone]);

  return (
    <Animated.View style={[styles.root, { opacity: out }]}>
      <Animated.View style={[styles.mark, { transform: [{ scale: mark }] }]}>
        <View style={styles.corner} />
        <Text style={styles.markText}>PDF</Text>
      </Animated.View>

      <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>
        <Text style={styles.title}>PDF Tools</Text>
        <Text style={styles.by}>by MPS</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: SPLASH_RED,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  mark: {
    width: 66,
    height: 82,
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
    marginBottom: 26,
    overflow: 'hidden',
  },
  // Folded top-right corner, drawn as a rotated square in the background red.
  corner: {
    position: 'absolute',
    top: -14,
    right: -14,
    width: 28,
    height: 28,
    backgroundColor: SPLASH_RED,
    borderLeftWidth: 2.5,
    borderColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
  },
  markText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  by: {
    color: '#FFFFFF',
    opacity: 0.8,
    fontSize: 14,
    letterSpacing: 1.4,
    textAlign: 'center',
    marginTop: 6,
  },
});
