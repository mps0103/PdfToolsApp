# PDFBox-Android and FontBox load their own classes and bundled resources by
# name, so R8 cannot see those uses. These two stay whole.
-keep class com.tom_roush.pdfbox.** { *; }
-keep class com.tom_roush.fontbox.** { *; }
-dontwarn com.tom_roush.**

# commons-* comes in under PDFBox and is reached the same reflective way.
-keep class org.apache.commons.** { *; }
-dontwarn org.apache.**
-dontwarn javax.**

# This app's own code. The native modules are looked up from JS by the string
# getName() returns, and their @ReactMethod members are called reflectively,
# so the package is kept rather than letting R8 rename through it.
-keep class com.pdftoolsapp.** { *; }

# Anything reached from C++ by name has to keep that name.
-keepclasseswithmembernames class * {
    native <methods>;
}

# React Native, Hermes, ML Kit and Mobile Ads all ship their own consumer
# rules inside their AARs, which R8 applies automatically. Blanket -keep rules
# for them were removed: they only stopped R8 shrinking those libraries.

# ---------------------------------------------------------------------------
# Why minification is currently off (enableProguardInReleaseBuilds in
# build.gradle).
#
# 1.7 shipped with R8 on and every launch died before reaching any of this
# app's code:
#
#   Unable to get provider androidx.startup.InitializationProvider:
#     Failed to create an instance of androidx.work.impl.WorkDatabase
#
# WorkManager comes in under Google Mobile Ads and keeps its queue in a Room
# database. Room loads the generated *_Impl classes by name, so R8 sees no
# reference to them and removed RawWorkInfoDao_Impl and PreferenceDao_Impl.
#
# The rules below fix that specific crash. They are kept here, unused, for
# whenever R8 is turned back on — which should happen only with a release
# build actually run on a device first, since this class of failure cannot be
# seen in a debug build or at compile time.
-keep class * extends androidx.room.RoomDatabase { <init>(); }
-keep class **_Impl { *; }
-keep class androidx.work.impl.** { *; }
-dontwarn androidx.work.**
