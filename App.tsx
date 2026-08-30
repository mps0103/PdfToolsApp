import React, { useEffect, useState } from 'react';
import { StatusBar, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import mobileAds from 'react-native-google-mobile-ads';

import HomeScreen from './src/screens/HomeScreen';
import ToolScreen from './src/screens/ToolScreen';
import PagesScreen from './src/screens/PagesScreen';
import AnnotateScreen from './src/screens/AnnotateScreen';
import FilesScreen from './src/screens/FilesScreen';
import DiagnosticsScreen from './src/screens/DiagnosticsScreen';
import ReaderScreen from './src/screens/ReaderScreen';
import AdBanner from './src/components/AdBanner';
import Splash from './src/components/Splash';
import { findTool } from './src/tools/registry';
import { colors } from './src/theme';
import AboutScreen from './src/screens/AboutScreen';

const Stack = createNativeStackNavigator();

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
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    mobileAds().initialize();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
        <NavigationContainer theme={navTheme}>
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
            <Stack.Screen name="About"
              component={AboutScreen}
              options={{ title: 'About' }} />
          </Stack.Navigator>
        </NavigationContainer>

        {/* Banner sits outside the navigator so it never overlaps a
            page grid or canvas, and never remounts between screens. */}
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.adSlot }}>
          <AdBanner />
        </SafeAreaView>
      </SafeAreaView>

      {/* Sits above everything, including the safe areas, so the red fills
          the whole screen while it plays. */}
      {!splashDone && <Splash onDone={() => setSplashDone(true)} />}
    </SafeAreaProvider>
  );
}
