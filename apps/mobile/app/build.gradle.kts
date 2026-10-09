plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.hilt.android)
    alias(libs.plugins.ksp)
}

// URL gốc của API. Debug mặc định trỏ API chạy trên máy tính: máy ảo Android thấy máy chủ qua 10.0.2.2.
// Máy thật cùng mạng Wi-Fi: chạy  ./gradlew assembleDebug -Paurelia.apiBaseUrl=http://<IP-máy-tính>:4000/api/
// Release: đặt -Paurelia.releaseApiBaseUrl=https://... khi build (mặc định là địa chỉ giữ chỗ, chưa có máy chủ thật).
val debugApiBaseUrl = providers.gradleProperty("aurelia.apiBaseUrl").orElse("http://10.0.2.2:4000/api/")
val releaseApiBaseUrl = providers.gradleProperty("aurelia.releaseApiBaseUrl").orElse("https://api.aurelia.example/api/")

android {
    namespace = "com.aurelia"

    compileSdk = 37

    defaultConfig {
        applicationId = "com.aurelia"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        debug {
            buildConfigField("String", "API_BASE_URL", "\"${debugApiBaseUrl.get()}\"")
        }
        release {
            optimization {
                enable = false
            }
            buildConfigField("String", "API_BASE_URL", "\"${releaseApiBaseUrl.get()}\"")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    testImplementation(libs.junit)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.junit)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
    debugImplementation(libs.androidx.compose.ui.tooling)

    // Điều hướng, ViewModel, bất đồng bộ, lưu cấu hình
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.androidx.datastore.preferences)

    // CameraX
    implementation(libs.androidx.camera.core)
    implementation(libs.androidx.camera.camera2)
    implementation(libs.androidx.camera.lifecycle)
    implementation(libs.androidx.camera.view)

    // Hilt
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.hilt.navigation.compose)

    // Mạng: Retrofit + OkHttp
    implementation(libs.retrofit.core)
    implementation(libs.retrofit.gson)
    implementation(libs.okhttp.logging.interceptor)

    // Coil
    implementation(libs.coil.compose)
}
