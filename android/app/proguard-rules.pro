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
