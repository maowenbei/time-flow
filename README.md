# ThreadFlow

[English](README.md) | [简体中文](README.zh-CN.md)

[Visit website](https://www.muzhistudy.com/threadflow/index.html)

> The current release is an **iOS app** for iPhone. Android and web commands below are for development and preview only.

iPad adaptive layouts are implemented in source, pending device and TestFlight acceptance. See the [iPad compatibility checklist](docs/ipad-compatibility.md) for installation and manual validation steps (Chinese).

## Download

| Source | China App Store | United States App Store |
| --- | --- | --- |
| GitHub | [Download 时流](https://apps.apple.com/cn/app/id6805435326?pt=128994962&ct=github&mt=8) | [Download ThreadFlow](https://apps.apple.com/us/app/threadflow-parallel-timer/id6805435326?pt=128994962&ct=github&mt=8) |

## Screenshots

| Today | Live Activities | Statistics | History |
| --- | --- | --- | --- |
| ![Today](<提审截图/en/1.png>) | ![Live Activities](<提审截图/en/2.png>) | ![Statistics](<提审截图/en/3.png>) | ![History](<提审截图/en/4.png>) |

ThreadFlow is a lightweight work timer for the way real work happens. Run multiple task timers at once without double-counting overlapping time. Track what you worked on and how much time you actually spent—without forced Pomodoro sessions or heavyweight project management.

## What’s new in v1.1

- **Live Activities & Dynamic Island:** View active timer status from the Lock Screen, Live Activities, and, on supported devices, the Dynamic Island.
- **Lightweight reminders:** Set a daily reminder to start tracking. Long-running timers can also remind you to check their status or take a break.
- Improved editing of history times and task states, category drill-down in statistics, localization, and interface details; fixed timing and state-sync issues.

## Core features

- Quickly create, start, pause, resume, complete, and edit tasks
- Run multiple task timers at once while ensuring allocated time never exceeds real elapsed time
- See both timer duration and actual allocated work time
- Today’s tasks, history, and time statistics
- Organize tasks with built-in icons or custom icons from your photo library
- Copy yesterday’s tasks to avoid repetitive entry
- Task content stays on your device; anonymous usage analytics require no account

## Feedback

Submit bugs, feature requests, or other feedback through [GitHub Issues](https://github.com/maowenbei/time-flow/issues), or browse the [existing issues](https://github.com/maowenbei/time-flow/issues).

## Tech stack

React Native, Expo, Expo Router, and TypeScript.

Firebase Analytics setup, events, and Development Build verification: [Analytics guide](docs/analytics.md).

## Getting started

Requirements: Node.js 20 LTS or later. Android Studio or Xcode is also needed to run on a native simulator or device.

```powershell
npm install
npm start
```

Common commands:

```powershell
npm run android
npm run ios
npm run web
npm run typecheck
```

### Preview on iPhone with Expo Go

When the project SDK is compatible with the Expo Go version installed on your iPhone, run `npm start` in the project root and scan the QR code shown in the terminal. Your phone and computer must be on the same network. If that does not work, run `npx expo start --tunnel` and scan again.

This project uses Expo SDK 57, while the App Store release of iOS Expo Go currently supports only SDK 54. For on-device preview, use a Development Build or TestFlight. You can download a compatible Expo Go version from https://sign.expo.dev/.

## Timing rules

ThreadFlow settles the preceding interval using timestamps whenever a task changes state, rather than using `setInterval` as its timing data source. This means timers can recover from their previous state even when the app goes into the background, the phone is locked, or the app is reopened.

For example: A starts at 10:00, B starts at 10:20, B completes at 10:50, and A completes at 11:00. A receives 45 minutes and B receives 15 minutes, for a total of the actual 60 minutes elapsed. Milliseconds that cannot be divided evenly are allocated in a stable order so no time is lost.

## Privacy

Tasks, categories, and timing data are stored locally with AsyncStorage. If you choose a photo-library image for a category, it is compressed and saved on the device. The app does not upload this data.

Firebase-enabled iOS builds collect anonymous usage events, task counts, and timer duration buckets. Task text, category names, and images are never uploaded. No account ID or advertising ID is collected; Firebase's default anonymous app instance ID supports usage and retention measurement. Builds without Firebase configuration do not send events.

## License

This project is licensed under the [MIT License](LICENSE).
