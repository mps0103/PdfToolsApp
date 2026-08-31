import React, { useEffect } from 'react';
import { Linking, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  NavigationContainer,
  DarkTheme,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import mobileAds from 'react-native-google-mobile-ads';

import HomeScreen from './src/screens/HomeScreen';
import ToolScreen from './src/screens/ToolScreen';
import PagesScreen from './src/screens/PagesScreen';
import AnnotateScreen from './src/screens/AnnotateScreen';
import FilesScreen from './src/screens/FilesScreen';
import DiagnosticsScreen from './src/screens/DiagnosticsScreen';
import ReaderScreen from './src/screens/ReaderScreen';
import AboutScreen from './src/screens/AboutScreen';
import AdBanner from './src/components/AdBanner';
import { importIncoming, launchUri } from './src/lib/files';
import { findTool } from './src/tools/registry';
import { colors } from './src/theme';

const Stack = createNativeStackNavigator();

/**
 * The navigator has to be reachable from outside React's tree so a file
 * arriving from another app can push the reader without threading a prop
 * through every screen.
 */
const navigationRef = createNavigationContainerRef();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.line,
    primary: colors.accent,
  },
};

export default function App() {
  useEffect(() => {
    mobileAds().initialize();
  }, []);

  // A PDF opened from a file manager or share sheet arrives as a URI on the
  // launch intent, or through a listener if the app was already running.
  useEffect(() => {
    let alive = true;

    const openIncoming = async (uri: string | null) => {
      if (!uri) return;
      const file = await importIncoming(uri);
      if (!alive || !file) return;

      // On a cold start the navigator may not have mounted yet, so retry
      // until it has rather than firing into nothing.
      const push = () => {
        if (!alive) return;
        if (navigationRef.isReady()) {
          // Cast because the route list lives in the navigator rather than
          // in a shared param type.
          (navigationRef.navigate as any)('Reader', { file, title: file.name });
        } else {
          setTimeout(push, 100);
        }
      };
      push();
    };

    launchUri().then(openIncoming);

    const sub = Linking.addEventListener('url', ({ url }) => openIncoming(url));
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  // The splash is drawn natively by Android from the moment the icon is
  // tapped, so there is no JS splash here. A second one on top only added a
  // flicker at the handover.
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
        <NavigationContainer ref={navigationRef} theme={navTheme}>
          <Stack.Navigator
            id={undefined}
            screenOptions={{
              headerShadowVisible: false,
              headerTitleStyle: { fontSize: 17 },
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
            <Stack.Screen
              name="Tool"
              component={ToolScreen}
              options={({ route }: any) => ({
                title: findTool(route.params.id)?.title ?? 'Tool',
              })}
            />
            <Stack.Screen
              name="Pages"
              component={PagesScreen}
              options={({ route }: any) => ({ title: route.params.title ?? 'Pages' })}
            />
            <Stack.Screen
              name="Annotate"
              component={AnnotateScreen}
              options={({ route }: any) => ({ title: route.params.title ?? 'Annotate' })}
            />
            <Stack.Screen
              name="Files"
              component={FilesScreen}
              options={{ title: 'Your files' }}
            />
            <Stack.Screen
              name="Reader"
              component={ReaderScreen}
              options={({ route }: any) => ({ title: route.params.title ?? 'Reading' })}
            />
            <Stack.Screen
              name="Diagnostics"
              component={DiagnosticsScreen}
              options={{ title: 'Self test' }}
            />
            <Stack.Screen
              name="About"
              component={AboutScreen}
              options={{ title: 'About' }}
            />
          </Stack.Navigator>
        </NavigationContainer>

        {/* Banner sits outside the navigator so it never overlaps a
            page grid or canvas, and never remounts between screens. */}
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.adSlot }}>
          <AdBanner />
        </SafeAreaView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}