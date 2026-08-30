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
      android: 'ca-app-pub-2904788540387890/4809177342',
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
      let status = AdsConsentStatus.UNKNOWN;

      try {
        const info = await AdsConsent.requestInfoUpdate();
        status = info.status;
        if (info.isConsentFormAvailable && info.status === AdsConsentStatus.REQUIRED) {
          await AdsConsent.showForm();
          status = (await AdsConsent.getConsentInfo()).status;
        }
      } catch {
        // Consent failures must not remove the ad slot.
      }

      try {
        // Only meaningful where a TC string exists. Outside the EEA and UK
        // there is none, and this throws on the null rather than returning
        // empty, so it gets its own guard.
        const choices = await AdsConsent.getUserChoices();
        if (alive) setPersonalised(Boolean(choices.selectPersonalisedAds));
      } catch {
        // No consent framework in play: personalised ads are permitted
        // unless consent was required and not granted.
        if (alive) setPersonalised(status === AdsConsentStatus.NOT_REQUIRED);
      }

      if (alive) setReady(true);
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
