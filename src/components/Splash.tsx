import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Image, StyleSheet } from 'react-native';

// The red from the artwork, used behind the image so the bands above and
// below it on taller screens blend into the design.
export const SPLASH_RED = '#E01B18';

const { width, height } = Dimensions.get('window');

type Props = { onDone: () => void };

export default function Splash({ onDone }: Props) {
  const out = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      // Held, not faded in: the image is already on screen when the app
      // starts, so fading it in would look like a stutter.
      Animated.delay(1000),
      Animated.timing(out, {
        toValue: 0,
        duration: 320,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onDone();
    });
  }, [out, onDone]);

  return (
    <Animated.View style={[styles.root, { opacity: out }]}>
      {/* Sized explicitly. The parent this renders into has no measured
          bounds, so percentage or absoluteFill sizing collapses and the
          image falls back to its own pixel dimensions — which is why it
          appeared hugely magnified. */}
      <Image
        source={require('../assets/splash.png')}
        style={{ width, height }}
        resizeMode="cover"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    width,
    height,
    backgroundColor: SPLASH_RED,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
});