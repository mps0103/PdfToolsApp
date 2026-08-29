import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import {
  AdsConsent,
  AdsConsentStatus,
  BannerAd,
  BannerAdSize,
  TestIds,
} from 'react-native-google-mobile-ads';
import { colors, AD_SLOT_HEIGHT } from '../theme';

// Swap in the real unit id at release. TestIds keeps debug builds
// from serving live ads and getting the account flagged.
const UNIT_ID = __DEV__
  ? TestIds.ADAPTIVE_BANNER
  : Platform.select({
      android: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY',
      default: '',
    })!;

export default function AdBanner() {
  const [failed, setFailed] = useState(false);
  const [personalised, setPersonalised] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    // Google's consent SDK. Outside the EEA and UK this resolves
    // immediately with no form shown.
    (async () => {
      try {
        const info = await AdsConsent.requestInfoUpdate();
        if (info.isConsentFormAvailable && info.status === AdsConsentStatus.REQUIRED) {
          await AdsConsent.showForm();
        }
        const choices = await AdsConsent.getUserChoices();
        if (alive) setPersonalised(Boolean(choices.selectPersonalisedAds));
      } catch {
        // Consent failures must not remove the ad slot — serve
        // non-personalised ads instead.
      } finally {
        if (alive) setReady(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <View
      style={{
        height: AD_SLOT_HEIGHT,
        backgroundColor: colors.adSlot,
        borderTopWidth: 1,
        borderTopColor: colors.line,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {ready && !failed && (
        <BannerAd
          unitId={UNIT_ID}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: !personalised }}
          onAdFailedToLoad={() => setFailed(true)}
        />
      )}
    </View>
  );
}
