# ThreadFlow

[English](README.md) | [简体中文](README.zh-CN.md)

[Visit website](https://www.muzhistudy.com/threadflow/index.html)

> The current release is an **iOS app** for iPhone.

## Download

| Source | China App Store | United States App Store |
| --- | --- | --- |
| GitHub | [Download 时流](https://apps.apple.com/cn/app/id6805435326?pt=128994962&ct=github&mt=8) | [Download ThreadFlow](https://apps.apple.com/us/app/threadflow-parallel-timer/id6805435326?pt=128994962&ct=github&mt=8) |

## Screenshots

| Today | Live Activities | Statistics | History |
| --- | --- | --- | --- |
| ![Today](<提审截图/en/1.png>) | ![Live Activities](<提审截图/en/2.png>) | ![Statistics](<提审截图/en/3.png>) | ![History](<提审截图/en/4.png>) |

ThreadFlow is a lightweight work timer for the way real work happens. Run multiple task timers at once without double-counting overlapping time. Track what you worked on and how much time you actually spent—without forced Pomodoro sessions or heavyweight project management.

## Core features

- Live Activities and Dynamic Island for active timers on supported devices
- Daily start reminders and long-running timer reminders
- Quickly create, start, pause, resume, complete, and edit tasks
- Run multiple task timers at once while ensuring allocated time never exceeds real elapsed time
- See both timer duration and actual allocated work time
- Today’s tasks, history, and time statistics
- Organize tasks with built-in icons or custom icons from your photo library
- Copy yesterday’s tasks to avoid repetitive entry
- Task content stays on your device; anonymous usage analytics require no account

## Feedback

Submit bugs, feature requests, or other feedback through [GitHub Issues](https://github.com/maowenbei/time-flow/issues), or browse the [existing issues](https://github.com/maowenbei/time-flow/issues).

## Development and installation

[Development and builds](docs/ios-发布指南.md) (Chinese): Expo Go testing, native debug builds, and production builds for TestFlight.

## Privacy

Tasks, categories, and timing data are stored locally with AsyncStorage. If you choose a photo-library image for a category, it is compressed and saved on the device. The app does not upload this data.

Firebase-enabled iOS builds collect anonymous usage events, task counts, and timer duration buckets. Task text, category names, and images are never uploaded. No account ID or advertising ID is collected; Firebase's default anonymous app instance ID supports usage and retention measurement. Builds without Firebase configuration do not send events.

## License

This project is licensed under the [MIT License](LICENSE).
