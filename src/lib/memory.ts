import { useEffect, useState } from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';

/**
 * True while the app is not the thing on screen.
 *
 * Android asks an app to give memory back the moment its UI is hidden, and
 * what this app is holding at that point is decoded page images — easily tens
 * of megabytes across a grid of thumbnails. A screen that reads this can stop
 * rendering its Images while it is true; they come back from the cache files
 * they were read from in the first place, so nothing is lost but the decode.
 *
 * Two sources feed it. AppState covers the ordinary case of leaving the app.
 * The "memoryTrim" event comes from MainApplication.onTrimMemory, which also
 * fires when the system is under pressure for reasons that have nothing to do
 * with this app.
 */
export function useInBackground(): boolean {
  const [hidden, setHidden] = useState(() => AppState.currentState !== 'active');

  useEffect(() => {
    const onState = (next: string) => setHidden(next !== 'active');
    const stateSub = AppState.addEventListener('change', onState);
    const trimSub = DeviceEventEmitter.addListener('memoryTrim', () => {
      // Only act on a trim that arrives while we are already away. A trim
      // delivered to a visible app would blank the screen the user is on.
      if (AppState.currentState !== 'active') setHidden(true);
    });

    return () => {
      stateSub.remove();
      trimSub.remove();
    };
  }, []);

  return hidden;
}
