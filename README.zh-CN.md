# 时流 / ThreadFlow

[English](README.md) | [简体中文](README.zh-CN.md)

[访问官网](https://www.muzhistudy.com/threadflow/index.html)

> 当前发布版本为 **iOS App**，支持 iPhone。

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

## 核心功能

- 实时活动与灵动岛：在支持的设备上查看正在运行的任务
- 轻量提醒：每日开始工作提醒和长时间计时提醒
- 快速创建、开始、暂停、继续、完成和编辑任务
- 支持多个任务并行计时，并保证分配时长总和等于真实经过时长
- 显示运行时长与实际投入时长
- 今日任务、历史记录和时间统计
- 任务分类：使用内置图标或从相册选择自定义图标
- 复制昨日任务，减少重复录入
- 任务内容保存在设备本地；匿名使用统计无需登录

## 反馈

欢迎通过 [GitHub Issues](https://github.com/maowenbei/time-flow/issues) 提交 Bug、功能建议或使用反馈；也可先查看 [已有 Issues](https://github.com/maowenbei/time-flow/issues)。

## 开发与安装

[开发与打包](docs/ios-发布指南.md)：Expo Go 开发测试、原生调试包、正式构建送 TestFlight。

## 隐私

任务、分类和计时数据使用设备本地的 AsyncStorage 保存。若为分类选择相册图片，图片会在本机压缩后保存；应用不会上传这些数据。

配置 Firebase 的 iOS 构建会收集匿名使用事件、任务数量和计时时长分桶，不上传任务文本、分类名称或图片，不设置账号标识或收集广告 ID。Firebase 使用默认匿名 app instance ID 统计使用与留存。未配置 Firebase 时不发送事件。

## 开源协议

本项目采用 [MIT License](LICENSE)。
