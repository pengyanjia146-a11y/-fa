# 学生状态评分 APK：GitHub Actions 标准打包版

这个工程不要手工拼 APK，直接用 GitHub Actions + Android Gradle Plugin 标准构建。
这样生成的 APK 会走正常签名流程，OPPO/小米/华为这类系统更容易识别签名信息。

## 使用方法

1. 在 GitHub 新建一个空仓库。
2. 上传本文件夹里的全部内容，注意 `.github/workflows/android-apk.yml` 必须一起上传。
3. 进入仓库页面：Actions → Build Android APK → Run workflow。
4. 构建完成后，进入本次 workflow 的 Artifacts。
5. 下载 `student-reflect-debug-apk`，解压后得到 `app-debug.apk`。
6. 先卸载旧版手工 APK，再安装这个 GitHub 打包版。

## 重要说明

- 这个版本会生成 `debug APK`，它是标准 Gradle 调试签名，不是无签名 APK。
- 如果以后每次 GitHub 重新构建导致覆盖安装失败，先卸载旧版再装新版。原因是 debug 签名可能变化。
- 真正长期使用，建议后续做稳定 release 签名，把同一个 keystore 放到 GitHub Secrets 里。

## 权限

自动读取手机使用时间，需要手动打开：

手机设置 → 特殊应用权限 → 使用情况访问权限 → 学生状态评分 → 允许

不同 OPPO 系统菜单名字可能略有不同。

## 功能

- 一天连续计时：开始今天 → 切换状态 → 结束今天
- 支持自定义状态
- 学习违规时间记录
- 手机使用记录读取/导入
- App 类型只选择一次
- 自动根据时间重叠判断违规原因
- 每日、本周、近7天、近30天、近90天、全部评分
- 分项评分：学习投入、深度学习、专注纪律、娱乐控制、任务质量、身体生活
