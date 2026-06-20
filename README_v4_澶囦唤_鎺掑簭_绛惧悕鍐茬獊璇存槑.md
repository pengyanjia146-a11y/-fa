# 学生状态记录 v4：备份文件、状态排序、签名冲突处理

## 你现在遇到的签名冲突是什么意思

如果手机提示“签名冲突 / 与已安装应用签名不一致”，不要硬装。

这说明：你手机里旧版 App 和这次 GitHub 打包出来的 App 虽然包名一样，但是签名不是同一个。Android 不允许直接覆盖安装。

能直接覆盖更新必须同时满足：

1. applicationId 一样。
2. 签名一样。
3. versionCode 更大。

只要签名不一样，就不能保留原 App 数据直接覆盖。

## 这版提供两个 APK

GitHub Actions 成功后会有两个 Artifacts：

1. `student-reflect-v4-stable-update-apk`
   - 包名：`com.yanjia.studentreflect`
   - 用途：以后稳定更新用。
   - 如果你旧版签名不同，安装它仍然可能签名冲突。

2. `student-reflect-v4-parallel-no-conflict-apk`
   - 包名：`com.yanjia.studentreflect.v4`
   - 用途：遇到签名冲突时安装这个。
   - 它能和旧版同时存在，不需要卸载旧版。
   - 图标名字是“学生状态记录V4”。

## 最推荐路线

### 情况 A：你旧版没有重要数据

直接卸载旧版，然后安装 `stable` 版。

以后只用 `stable` 版，并且不要改 `app/keystore/student-reflect-update.jks`，就可以覆盖更新。

### 情况 B：旧版有重要数据，但新版本签名冲突

先不要卸载旧版。

安装 `parallel` 版，也就是：

`student-reflect-v4-parallel-no-conflict-apk`

它不会和旧版冲突，可以同时安装。

如果旧版里没有“导出备份文件”功能，那么新 App 无法直接读取旧 App 内部数据。这是 Android 的隔离限制，不是按钮问题。

### 情况 C：以后不想再因为卸载丢数据

以后每天或每周点一次：

`反思 → 保存备份文件`

它会生成一个 JSON 文件，例如：

`student_reflect_backup_2026-06-19.json`

这个文件可以保存到：

- 手机下载目录
- 文档目录
- 微信文件传输助手
- 网盘

以后重装、换手机、改包名，都可以点：

`反思 → 从备份文件恢复`

## v4 功能改动

### 1. 状态可以添加、删除、排序

进入：

`权限/分类 → 自定义状态与排序`

可以：

- 添加状态
- 删除没有历史记录使用过的状态
- 上移
- 下移
- 置顶
- 置底

排序会影响“开始今天”和“切换状态”的下拉框顺序。

### 2. 违规不能主动选择

你不能在状态列表里选择“学习违规离开”。

违规只能这样产生：

正在学习状态
→ 切出 App
→ 回来
→ 系统被动记录离开时间
→ 用手机使用记录自动匹配原因

### 3. 权限显示模块

进入：

`权限/分类`

可以看到“使用情况访问权限”是否打开。

没有权限时，App 仍然能连续计时，但是不能自动读取你切出去后用了哪个 App。

### 4. App 类型只选一次

进入：

`权限/分类 → App 归类：只选一次`

例如：

- 抖音 = 短视频/娱乐刷屏
- 原神 = 游戏/游戏软件
- Chrome = 浏览器/网页跑偏
- 微信 = 微信必要沟通

之后系统自动用学习违规时间段和手机使用记录匹配，不再让你每次手动选择违规原因。

## GitHub 更新步骤

1. 解压 `StudentReflect_RecordStats_v4_Source.zip`。
2. 打开里面的 `StudentReflect_RecordStats_v4` 文件夹。
3. 上传里面的全部内容到原来的 GitHub 仓库。
4. 不是上传整个文件夹，而是上传里面这些内容：

```
.github
app
build.gradle
settings.gradle
README_v4_备份_排序_签名冲突说明.md
```

5. Commit changes。
6. 进入 Actions。
7. 运行 `Build Android APK v4 Backup Order`。
8. 成功后下载两个 Artifacts。

## 安装哪个 APK

如果你安装 stable 版提示签名冲突，就安装 parallel 版。

- 稳定更新版：`app-stable-debug.apk`
- 不冲突并存版：`app-parallel-debug.apk`

先用并存版确认功能正常。确认后，以后可以把重要数据导出成 JSON 文件，再考虑卸载旧版。
