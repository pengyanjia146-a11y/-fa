# v7.1 构建修复说明

这版修复 GitHub Actions 构建后找不到 APK 的问题，并补齐标准 Android 工程必需文件：

- app/src/main/java/com/yanjia/studentreflect/MainActivity.java
- app/src/main/res/values/styles.xml
- .github/workflows/android-apk.yml

请把本文件夹内的内容上传到 GitHub 仓库根目录，不要上传外层文件夹。

正确结构：

.github/workflows/android-apk.yml
app/build.gradle
app/src/main/AndroidManifest.xml
app/src/main/java/com/yanjia/studentreflect/MainActivity.java
app/src/main/res/values/styles.xml
app/src/main/assets/app.html
app/src/main/assets/app.js
build.gradle
settings.gradle

运行 Actions：Build Android APK v7.1 Build Fix。

成功后下载：

- student-reflect-v7-1-stable-update-apk
- student-reflect-v7-1-parallel-no-conflict-apk

如果之前遇到签名冲突，优先安装 parallel 版。
