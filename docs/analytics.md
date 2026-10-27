# 基础使用统计 / Firebase Analytics

统一入口是 `src/services/analytics.ts` 的 `track('timer_started', params?)`。
业务只调用这一层。没有自建队列、账号系统或独立 installation_id；使用 Firebase 默认匿名 app instance ID。
任务、分类和图片仍保存在本机。自定义事件不上传任务 ID、名称、备注、分类名称、图片路径、姓名、联系方式或精确位置。
Firebase 自身仍会收集基础设备、会话和应用信息；“匿名”不表示完全不收集设备数据。

## 配置与构建

1. 在现有 Firebase 项目启用 Google Analytics，注册 iOS App，bundle ID 必须为 `app.timeflow.ios`。
2. 下载 **GoogleService-Info.plist**（不是服务账号私钥），将文件放到仓库根目录，或保存在本地其他路径。根目录默认文件名已加入 `.gitignore`。
3. PowerShell 本地设置并检查：

   ```powershell
   $env:GOOGLE_SERVICES_PLIST = 'D:\path\GoogleService-Info.plist'
   npx expo config --type public
   ```

   `extra.analytics.firebaseEnabled` 应为 `true`。配置不会将 plist 内容写进 JS；显式指定不存在、无效或 bundle ID 不匹配的文件会阻止构建。

4. EAS 云端构建：在 EAS 项目的 **development** 环境创建名为 `GOOGLE_SERVICES_PLIST`、类型为 **File** 的环境变量，上传同一 plist。EAS 将变量展开为构建机器上的文件路径。建议使用 Sensitive 可见性；本地配置检查和 Metro 仍应设置自己的有效文件路径。准备 production 环境时同样配置该变量。
5. 在本地环境变量已设置、云端文件变量也已配置后构建和启动：

   ```powershell
   eas build --platform ios --profile development
   npx expo start --dev-client --port 8085
   ```

   安装新 Development Build。旧客户端缺少新原生模块，不能靠刷新 JS 补上。
   `eas.json` 明确指定 development / preview / production 环境，避免依赖 EAS 自动推断。

不设置变量时，Expo 配置关闭 Firebase 插件，React Native autolinking 排除 Firebase 原生模块；开发环境只输出 console，正式环境不输出也不发送。
Expo Go 和 Web 始终不加载 Firebase。安装了 dev-client 后，Expo Go 预览可用 `npx expo start --go --port 8085`，需要与 SDK 57 兼容的 Expo Go。
本次仅接入 iOS；Android 不链接 Firebase。

已固定 RN Firebase app / analytics 为同一版本 26.4.0，使用其 SPM 默认集成及 dynamic frameworks。
Analytics 插件设置 `withoutAdIdSupport: true`；`firebase.json` 关闭 IDFV、广告存储、广告用户数据、广告个性化、广告网络注册和自动页面上报，保留 Analytics 存储及自动首次打开、会话、互动事件。
配置依据：[React Native Firebase Expo 文档](https://rnfirebase.io/)。

## 已接入事件

### 1.2 操作明细补充

当前共 29 种自定义事件。下列 19 种补充原有基础事件；只在主动操作入口触发，不在计时刷新、状态 updater 或页面重绘中发送。

| 事件 | 触发 / 参数 |
| --- | --- |
| `time_editor_opened` | 打开历史时间编辑；`day_age_bucket` |
| `task_time_updated` | 合法且实际改变时间后保存；`change_direction`、绝对变化幅度 `change_bucket`、`day_age_bucket` |
| `task_updated` | 今日/历史实际修改名称或分类后保存；`entry_source`、`name_changed`、`category_changed` |
| `task_deleted` | 今日/历史删除；`entry_source`、`task_status` |
| `task_duplicate_blocked` | 创建/今日编辑/历史编辑因重复被拦截；`entry_source` |
| `break_started` | 开始有效休息；`active_task_count` |
| `break_ended` | 手动结束休息；休息时长 `timer_duration_bucket` |
| `reminder_setting_changed` | 设置实际变化；`setting` 取 start_enabled/long_enabled/frequency/time，附对应 `enabled`、`frequency` 或 `time_of_day` |
| `notification_permission_result` | 开启提醒时权限检查/请求的返回值；`granted`、`can_ask_again`，包括拒绝，不表示每次都展示了系统弹窗 |
| `category_created` / `category_updated` | 分类创建/实际编辑保存；`icon_source` 取 photo/built_in/default |
| `category_deleted` | 确认删除分类；`category_kind`、`has_tasks` |
| `language_changed` | 选择不同语言模式；`language_mode`（auto 表示跟随系统） |
| `stats_period_changed` | 周/月切换；`period` |
| `stats_period_navigated` | 翻期或点击当前视图按钮回到本期；`period`、`direction`（previous/next/reset）、`is_current_period` |
| `stats_day_selected` | 主动选择不同日期；`period`、`day_age_bucket`、`has_data` |
| `stats_overview_selected` | 从单日明细返回周期总览；`period` |
| `stats_category_expanded` | 展开分类任务明细（折叠不报）；`period`、`scope`（period/selected_day）、`category_kind`、当前范围内该分类原始 `task_count` |
| `history_day_expanded` | 展开历史日期（折叠不报）；`day_age_bucket`、`task_count` |

所有布尔值在发送层转换为 0/1。枚举和数量经白名单过滤；不上传任务/分类名称、ID、图片 URI、具体日期、精确提醒时间或精确修改时长。
`category_kind` 表示系统内置或用户新增分类，不含具体内置分类名称；编辑内置分类名称不会将其归为用户新增分类。
`day_age_bucket` 按本地日历计算：today（当天）、last_7_days（1–6 天前）、last_30_days（7–29 天前）、older（至少 30 天前）、future（未来）。
`time_of_day` 为 night（0–5 点）、morning（6–11 点）、afternoon（12–17 点）、evening（18–23 点）。
时长变化 `change_bucket` 沿用下方时长分桶规则。取消编辑、未修改保存、无效时间、拒绝通知权限后的开关变化均不记录成功保存事件。

在开发包刷新 JS 即可测试这些补充事件，无需重新构建原生包。自动检查：`npm run typecheck` 和 `npm test`。
手动依次测试：历史长按修改时间（取消/无修改/有效修改）、设置提醒和语言/分类、统计切换周月/翻期/选择日期/展开分类/返回总览、开始结束休息、任务编辑/重复拦截/删除。确认事件和 `SDK accepted`；后台收数仍需 Firebase 实时报告验收。

每个自定义事件带 `app_version`（Expo 应用版本）和 `locale`（当前应用语言）。不自动附加整个 task 或任意对象。

| 事件 | 位置 / 触发口径 | 额外参数 |
| --- | --- | --- |
| `app_open` | 根布局生命周期组件；冷启动、background→active 各一次；不计系统弹窗的 inactive→active | `entry_source`: `cold_start` / `foreground` |
| `task_created` | Today 手动创建；复制最近任务日时每个新任务一次 | `task_count`: 创建后今日总数；`entry_source`: `manual` / `copy_latest` |
| `timer_started` | TaskCard 开始、继续、完成后重启 | 操作后今日 `active_task_count`；`entry_source`: `start` / `resume` / `restart` |
| `timer_paused` | TaskCard 手动暂停 | 操作后今日 `active_task_count`；`timer_duration_bucket` |
| `timer_completed` | TaskCard 用户点击完成；不是倒计时到期 | 同上 |
| `history_viewed` | History 每次获得导航焦点 | 无 |
| `stats_viewed` | Stats 每次获得导航焦点 | 无 |
| `settings_viewed` | Settings 每次获得导航焦点 | 无 |

复制是一次批量创建，每个事件的 `task_count` 都是整批完成后的今日总数。
时长取操作时间结算后的累计 `elapsedDuration`，不是多任务平分的 `allocatedDuration`，不上传精确时长：

| 枚举 | 分钟范围 |
| --- | --- |
| `under_1m` | [0, 1) |
| `1_5m` | [1, 5) |
| `5_15m` | [5, 15) |
| `15_30m` | [15, 30) |
| `30_60m` | [30, 60) |
| `60m_plus` | [60, ∞) |

恢复本地数据、跨日自动暂停、休息开始/结束、调整历史时间不产生单任务计时事件。加载中、休息锁定、无效操作和过期任务无法启动时不报成功事件。
不在 React 状态更新函数或每秒刷新回调中发送事件。
后续 Pro / Todo 只需扩展 `AnalyticsEvents` 和运行时白名单，再在对应操作入口调用 `track()`。

## 验证与后台分析

开发控制台会输出 `[analytics] track` 及安全参数，随后标明 `console-only`、`SDK accepted` 或 `send failed`。
`SDK accepted` 只表示 SDK 调用完成，**不代表后台已收到**。初始化失败会缓存为 console 模式；单次发送失败被捕获，不阻塞业务。

iOS DebugView 需要原生启动参数，`__DEV__` 和 Metro console 不会自动启用它：

1. 在 Mac 上使用相同 plist 环境生成 iOS 工程（`npx expo prebuild --platform ios`），打开 Xcode workspace；在 Scheme → Run → Arguments Passed On Launch 添加 `-FIRDebugEnabled`，运行 Development Build。
2. 若使用模拟器安装包，可通过 `xcrun simctl launch --terminate-running-process booted app.timeflow.ios -FIRDebugEnabled` 启动；需要单独构建 iOS simulator 包，真机 IPA 不能用于模拟器。
3. Firebase 控制台 → Analytics → DebugView，选择设备，逐一检查事件及参数。
4. 使用 `-FIRDebugDisabled` 再次启动以关闭调试。测试流量隔离使用 Analytics developer traffic filter，不将 DebugView 流量当正式留存数据。

Windows 上安装 EAS 真机 Development Build 可验证操作及 console，并在 Firebase Realtime / 后续 Events 报表检查收数；开启 iOS DebugView 的官方流程需要 Mac/Xcode。仅安装 EAS 包不会自动启用 DebugView。
参考：[Firebase DebugView](https://firebase.google.com/docs/analytics/debugview)。

在 Analytics 的自定义定义中注册需要报表分析的参数：`entry_source`、`timer_duration_bucket` 为事件维度，`task_count`、`active_task_count` 为事件指标，必要时注册 `locale`。
用 GA4 探索建立 `first_open → task_created → timer_started → timer_completed` 用户漏斗，并查看 History / Stats 的事件用户数。
首次开始使用用户基于 SDK 自动 `first_open`，不是每次 `app_open`；D1 / D7 在留存/同类群报表中查看。
已有用户升级后首次接入 Analytics 的 cohort 不等于原始安装日期；匿名 ID 重置或重装也可能产生新用户。
常规报表有处理延迟，不以即时缺少事件判定失败。

## 修改是否需要重新构建

| 修改 | 重新 EAS build |
| --- | --- |
| 添加/升级 Firebase、dev-client 或其他原生依赖 | 需要 |
| plist、Firebase 原生插件、framework 设置、`firebase.json` 隐私设置、启用/禁用原生 Firebase | 需要 |
| 纯 JS/TS 事件调用、白名单、参数、console 日志 | 已有兼容原生客户端可直接加载，无需重建 |

JS 调整的正式分发仍需已有兼容 OTA 通道或随新版本发布；本次不配置 OTA。Metro 使用与构建一致的 Firebase 启用状态。
应用版本号已统一更新为 1.2.0，production 构建由 EAS 自动递增构建号。

## 测试清单

自动检查：`npm run typecheck`、`npm run test:analytics`。

手动检查（Expo Go 看 console，配置后的 Development Build 再看后台）：

- 冷启动一次 `app_open`，后台返回一次；权限弹窗和系统控制中心短暂 inactive 不多报。
- 新建两任务，分别开始；active 数为 1、2。暂停一个为 1，继续为 2，完成一个为 1；重启来源为 `restart`。
- 复制前一任务日 N 个任务，产生 N 个创建事件，`task_count` 均为 N；已有今日任务时不复制。
- History / Stats / Settings 各进入一次；等待计时刷新、修改语言不重复；离开再回来各加一次。
- 休息、跨日恢复、编辑历史时长不产生计时事件；多任务分摊、持久化、提醒和 Live Activity 正常。
- 输入含姓名/邮箱的任务文本和分类名称，确认 console / DebugView 无这些字段或内容。
- 无 plist 的构建正常；旧 Development Build 缺 Firebase 模块时降级，离线/SDK 异常不影响计时。

真实 Firebase 收数和 iOS 原生编译需要有效 plist、EAS / Mac 环境，本次代码检查无法替代这些验收。

## 本次改动文件

- 统一上报与生命周期：`src/services/analytics.ts`、`src/components/AnalyticsLifecycle.tsx`、`app/_layout.tsx`。
- 操作入口：`app/(tabs)/today.tsx`、`src/components/TaskCard.tsx`。
- 页面访问：`app/(tabs)/history.tsx`、`app/(tabs)/stats.tsx`、`app/settings.tsx`。
- 原生配置与依赖：`app.config.js`、`react-native.config.js`、`firebase.json`、`eas.json`、`package.json`、`package-lock.json`、`.gitignore`。
- 文档与验证：`README.md`、`README.zh-CN.md`、`docs/analytics.md`、`tests/analytics.test.cjs`。

`src/state/TimerContext.tsx`、计时分摊、持久化和 Live Activity 实现未改动。
