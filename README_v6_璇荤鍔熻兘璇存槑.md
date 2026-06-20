# v6 读秒功能说明

本版在 v5 的基础上加入读秒功能，不生成 APK，只更新源码与 GitHub 打包文件。

## 新增功能

1. 记录页顶部新增“当前”读秒。
2. 连续计时卡片显示当前状态的实时秒表，例如 00:12:36。
3. 同时显示“今日连续计时”读秒，从点击“开始今天”开始计算。
4. 时间轴里正在进行的一段会显示秒级持续时间。
5. 后台统计仍按分钟归档，避免分数因为几秒钟产生不必要波动；读秒主要用于前台观察。

## 数据保留说明

- stable 包名仍是：com.yanjia.studentreflect
- parallel 包名仍沿用 v5 的：com.yanjia.studentreflect.v5

这样做是为了让已经安装 v5 parallel 版的手机可以直接覆盖更新到 v6，尽量不丢数据。

## 更新方式

把本文件夹里的内容上传覆盖到原 GitHub 仓库，然后运行 Actions 中的：

Build Android APK v6 Second Timer

如果你之前安装的是 parallel 版，继续安装 v6 parallel 版；如果之前安装的是 stable 版，继续安装 v6 stable 版。不要卸载旧版。
