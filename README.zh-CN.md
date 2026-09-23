# 时流 / ThreadFlow

[English](README.md) | [简体中文](README.zh-CN.md)

[访问官网](https://www.muzhistudy.com/threadflow/index.html)

> 当前发布版本为 **iOS App**，支持 iPhone；Android 与 Web 命令仅用于项目开发与预览。

## 下载

| 来源 | 中国区 App Store | 美国区 App Store |
| --- | --- | --- |
| GitHub | [下载时流](https://apps.apple.com/cn/app/id6805435326?pt=128994962&ct=github&mt=8) | [下载 ThreadFlow](https://apps.apple.com/us/app/threadflow-parallel-timer/id6805435326?pt=128994962&ct=github&mt=8) |

## 提审截图

| 今日任务 | 实时活动 | 统计 | 历史记录 |
| --- | --- | --- | --- |
| ![今日任务](<提审截图/zh-cn/1.png>) | ![实时活动](<提审截图/zh-cn/2.png>) | ![统计](<提审截图/zh-cn/3.png>) | ![历史记录](<提审截图/zh-cn/4.png>) |

时流（ThreadFlow）是一款为真实工作方式设计的轻量工作计时应用。写下今天要做的事，开始时轻点一下；一天结束时，回看真正投入的时间。

它不使用番茄钟，也不要求复杂的任务拆分或项目管理。多个任务可同时计时，而同一段真实经过时间只会被公平分配一次。

## v1.1 功能

- **实时活动与灵动岛：** 任务计时运行时，可在锁屏、实时活动和支持设备的灵动岛查看状态。
- **轻量提醒：** 设置每日开始工作提醒；计时持续过久时，也会提醒你检查任务状态或适当休息。
- 优化历史记录的时间与任务状态修改、统计页分类任务查看、多语言与界面细节，并修复计时和状态同步问题。

## 核心功能

- 快速创建、开始、暂停、继续、完成和编辑任务
- 支持多个任务并行计时，并保证分配时长总和等于真实经过时长
- 显示运行时长与实际投入时长
- 今日任务、历史记录和时间统计
- 任务分类：使用内置图标或从相册选择自定义图标
- 复制昨日任务，减少重复录入
- 数据仅保存在设备本地；不需要登录，也不上传数据

## 反馈

欢迎通过 [GitHub Issues](https://github.com/maowenbei/time-flow/issues) 提交 Bug、功能建议或使用反馈；也可先查看 [已有 Issues](https://github.com/maowenbei/time-flow/issues)。

## 技术栈

React Native、Expo、Expo Router 和 TypeScript。

## 开始使用

环境要求：Node.js 20 LTS 或更高版本。若要在原生模拟器或真机中运行，还需要 Android Studio 或 Xcode。

```powershell
npm install
npm start
```

常用命令：

```powershell
npm run android
npm run ios
npm run web
npm run typecheck
```

### 用 Expo Go 在 iPhone 预览

在项目 SDK 与 iPhone 上安装的 Expo Go 版本兼容时，可于项目根目录执行 `npm start`，再用 Expo Go 扫描终端显示的二维码预览。手机和电脑应连接同一网络；若无法连接，可执行 `npx expo start --tunnel` 后重新扫码。

本项目使用 Expo SDK 57；当前 App Store 版 iOS Expo Go 仅支持 SDK 54，因此 iPhone 请使用 Development Build 或 TestFlight 进行真机预览。可从 https://sign.expo.dev/ 下载兼容版本的 Expo Go。

## 计时规则

时流（ThreadFlow）在任务状态变化时以时间戳结算上一段时间，而不是将 `setInterval` 作为计时数据来源。因此应用切到后台、锁屏或重新打开后，计时仍可根据上次状态恢复。

例如：A 在 10:00 开始，B 在 10:20 开始；B 在 10:50 完成，A 在 11:00 完成。A 获得 45 分钟，B 获得 15 分钟，总计仍为真实经过的 60 分钟。无法整除的毫秒会按稳定顺序分配，以避免时间损失。

## 隐私

任务、分类和计时数据使用设备本地的 AsyncStorage 保存。若为分类选择相册图片，图片会在本机压缩后保存；应用不会上传这些数据。

## 开源协议

本项目采用 [MIT License](LICENSE)。
