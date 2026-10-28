# 时流开发与打包

[返回产品介绍](../README.zh-CN.md)

所有命令在 `time-flow` 工程目录执行。统一使用原始 CLI 命令：Expo 用 `npx expo`，打包和提交用 `eas`。

## 环境准备

- Node.js 22.13+（22 系列）、24.3+（24 系列）或 26+。
- Expo Go 支持 SDK 58。
- EAS 打包需要 Expo 账号；iOS 真机包需要 Apple Developer 账号。
- Windows 使用 EAS 云端构建，无需安装 Xcode。

首次使用或依赖变化后安装依赖：

```powershell
cd D:\maowb\mini-app\time-flow
npm install
```

首次使用 EAS，安装 CLI 并登录；已安装、已登录则跳过：

```powershell
npm install --global eas-cli
eas login
```

## 一、Expo Go 开发测试

```powershell
npx expo start --go --port 8085
```

电脑和设备连接同一网络，用 Expo Go 扫描终端二维码。适合页面和普通业务逻辑开发；实时活动、灵动岛、Firebase 需要包含对应原生模块的安装包。

## 二、需要原生功能且需要 debug：调试包

新设备先注册，已注册则跳过：

```powershell
eas device:create
```

构建后，在设备 Safari 中打开 EAS 构建页面的安装链接，安装调试包：

```powershell
eas build --platform ios --profile development
```

启动电脑的开发服务，用安装好的时流调试包打开项目：

```powershell
npx expo start --dev-client --port 8085
```

可刷新代码、查看日志，并通过开发菜单打开 JS 调试器。普通页面代码修改直接刷新；SDK、原生依赖或原生配置变化后重新打包。

## 三、正式构建送 TestFlight

先检查代码，通过后再构建：

```powershell
npx tsc --noEmit
node --test tests/*.test.cjs
npx expo config --type public
```

构建正式包：

```powershell
eas build --platform ios --profile production
```

确认最新完成的 iOS 构建是本次正式包，再提交：

```powershell
eas submit --platform ios --profile production --latest
```

等待 App Store Connect 处理完成，将构建分配给 TestFlight 测试组，在设备 TestFlight 中接受邀请并安装。正式包独立运行，不连接电脑、不提供开发菜单。提交 TestFlight 不会自动上架 App Store。

## 连接与配置

- 电脑和设备无法直连时，在 Expo 启动命令后追加 `--tunnel`；需要清缓存时追加 `--clear`。
- Firebase 为可选配置：本地 `.env.local` 的 `GOOGLE_SERVICES_PLIST` 指向有效 plist；EAS 的 `development`、`production` 环境分别配置同名 File 变量。plist 的 Bundle ID 必须是 `app.timeflow.ios`。未配置时不发送统计，Expo Go 也不加载 Firebase。
