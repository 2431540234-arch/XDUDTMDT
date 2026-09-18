// Lớp Application gốc, khởi tạo Hilt cho toàn bộ app
package com.aurelia

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class AureliaApplication : Application()
