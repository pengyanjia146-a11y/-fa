# v7 更新说明：应用类型打勾选择 + 学习类应用 + JSON 保存/复制

这版不生成 APK，只更新源码和 GitHub Actions 打包文件。

## 主要更新

### 1. 应用类型改成“打勾式选择”

位置：

权限/分类 → App 归类：只选一次

以前是下拉框选择类型，现在改成卡片按钮：

- 点“学习类应用”
- 点“微信必要沟通”
- 点“短视频/娱乐刷屏”
- 点“游戏/游戏软件”
- 点“浏览器/网页跑偏”

点中后会显示 ✓，保存规则后，同一个 App 以后自动归类。

### 2. 新增默认应用类型：学习类应用

默认加入：

学习类应用
严重度：0
是否允许：允许

适合归类：

- 词典
- 网课
- Anki
- 笔记软件
- PDF 阅读器
- 学习资料 App
- 题库 App

学习期间使用这些 App，不应直接算作违规。

### 3. 应用类型和 App 规则可以单独保存成 JSON

位置：

权限/分类 → 违规/App 类型 → 应用类型 JSON

新增按钮：

- 导出类型JSON
- 保存类型JSON文件
- 复制类型JSON
- 导入类型JSON

这个 JSON 只保存：

- appTypes：应用类型列表
- appRules：App 到应用类型的对应规则

它不会保存你的每日时间记录，所以适合单独迁移分类规则。

### 4. 保存 JSON 文件加入复制按钮

位置：

反思 → 导出/导入数据

新增：

- 复制文本框内容
- 全选文本框

如果保存文件窗口不好用，可以先导出到文本框，再点复制。

## GitHub 打包

上传整个源码后，进入 GitHub：

Actions → Build Android APK v7 AppType JSON → Run workflow

生成两个包：

- student-reflect-v7-stable-update-apk
- student-reflect-v7-parallel-no-conflict-apk

如果你之前用的是并存版，就继续装 parallel 包，不要卸载旧版。
