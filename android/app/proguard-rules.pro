# PDFBox-Android reflects over its own classes and bundled resources.
-keep class com.tom_roush.pdfbox.** { *; }
-keep class com.tom_roush.fontbox.** { *; }
-dontwarn com.tom_roush.**
-dontwarn org.apache.**
-dontwarn javax.**

# ML Kit text recognition
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**

# Native modules are found by name from JS
-keep class com.pdftools.** { *; }

# React Native defaults
-keep class com.facebook.react.** { *; }
-keepclassmembers class * { @com.facebook.react.bridge.ReactMethod <methods>; }
