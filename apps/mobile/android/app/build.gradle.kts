plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val onePixelKeystorePath = System.getenv("ONEPIXEL_KEYSTORE_PATH")
val onePixelKeystorePassword = System.getenv("ONEPIXEL_KEYSTORE_PASSWORD")
val onePixelKeyAlias = System.getenv("ONEPIXEL_KEY_ALIAS") ?: "onepixel-release"
val onePixelKeyPassword = System.getenv("ONEPIXEL_KEY_PASSWORD") ?: onePixelKeystorePassword

android {
    namespace = "com.onepixel.onepixel"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.onepixel.onepixel"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        multiDexEnabled = true
        manifestPlaceholders["onePixelCleartext"] = System.getenv("ONEPIXEL_CLEARTEXT") ?: "false"
    }

    signingConfigs {
        if (onePixelKeystorePath != null && onePixelKeystorePassword != null && onePixelKeyPassword != null) {
            create("onePixelRelease") {
                storeFile = file(onePixelKeystorePath)
                storePassword = onePixelKeystorePassword
                keyAlias = onePixelKeyAlias
                keyPassword = onePixelKeyPassword
                enableV1Signing = true
                enableV2Signing = true
                enableV3Signing = true
                enableV4Signing = true
            }
        }
    }

    buildTypes {
        getByName("debug") {
            manifestPlaceholders["onePixelCleartext"] = "true"
        }
        release {
            signingConfig = signingConfigs.findByName("onePixelRelease")
        }
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
}

flutter {
    source = "../.."
}
