# Panes, logs and buttons lead Conduit's wishlist

The features with the strongest evidence that Conduit still lacks are **split panes, automatic session logging to file, a SecureCRT-style button bar, a compose window that sends commands to a chosen subset of sessions, session and workspace restore, full export, account-free sync, and triggers with login scripts** (F1 to F8 below). Each one ships in several competing apps and is backed by top-voted GitHub requests or repeated first-hand user comments. People choose SSH clients for four reasons: everything in one window (MobaXterm's bundle is the reference point), one-click repeatable actions, credentials handled for them, and native speed. They leave because of subscriptions and paywalled basics, mandatory accounts and telemetry, sluggish Electron apps, data loss with no way to export, and because the best power tools are Windows-only. Conduit already covers most of what MobaXterm switchers say they miss: an SFTP panel that follows `cd`, a monitoring bar, broadcast input, highlighting and saved logins. Its no-account, no-subscription, no-telemetry stance also answers the loudest complaints. Its gaps are mainly in automation, logging, layout and connection resilience, plus X11 and Mosh for full MobaXterm parity. The list below has **63 candidates with IDs (F1 to F63) in four tiers**, so you can reply "implement F3, F7". Most of the evidence comes from Hacker News comments, GitHub reaction counts, vendor documentation and Trustpilot. Reddit was almost entirely blocked, so read the frequencies as signals, not survey results.

## Users pick clients for one window, one price and no account

The research covered eleven SSH clients and nine terminal emulators, and in all of them loyalty comes down to a few concrete things. The first is **having everything in one window**. MobaXterm reviewers describe a do-everything tool that replaces several separate apps by putting SSH, SFTP, an editor and RDP together ([AlternativeTo](https://alternativeto.net/software/mobaxterm/about/)). People who moved to the Mac name it, along with Notepad++, as the Windows program they miss most ([HN](https://news.ycombinator.com/item?id=42023507), [HN](https://news.ycombinator.com/item?id=47917625)). What they keep coming back to is ordinary: MobaXterm's handling of saved logins ([HN](https://news.ycombinator.com/item?id=40058170)) and its small monitoring bar under the terminal ([HN](https://news.ycombinator.com/item?id=38884284)), and Conduit already has both. The second is **one-click repeatable actions**: SecureCRT's button bar and Command Manager, MobaXterm's macros and Xshell's Quick Commands. In the one reachable r/networking thread, network engineers said these save time, and colleagues bought licences after seeing them ([r/networking mirror](https://reddit.sentinel-team.org/posts/1pe0jij/snapshots/2025-12-05T09%3A31%3A24.629654Z)). The third is **credentials handled for you**. Royal TSX lets connections inherit credentials from folders and refer to them by name ([Royal TSX](https://www.royalapps.com/ts/mac/features)), and one KiTTY user admits saved passwords are bad practice but too convenient to give up ([HN](https://news.ycombinator.com/item?id=40045090)). The fourth is **native speed and stability**. In the Ghostty 1.0 thread, antirez said it printed half a million lines almost instantly, and a beta tester said he came for the speed and stayed for the stability ([HN](https://news.ycombinator.com/item?id=42517447)). A 2026 native Mac SSH client led its launch post with its size compared with Tabby: **76 MB against 580 MB** ([HN](https://news.ycombinator.com/item?id=50054405)).

**Money and trust drive people away more than missing features do.** Pricing is the most common complaint, raised in about ten sources. Termius users call the subscription excessive ([HN](https://news.ycombinator.com/item?id=42527584)), and they object to serial console access behind a paid plan ([HN](https://news.ycombinator.com/item?id=40554610)) and to paying **about $10 a month just to sync hosts** ([HN](https://news.ycombinator.com/item?id=47235895)). SecureCRT is respected but called very expensive again and again ([HN](https://news.ycombinator.com/item?id=45362237), [HN](https://news.ycombinator.com/item?id=47466197)). Free tiers have hard caps: MobaXterm Home stops at **12 sessions, 2 tunnels and 4 macros** ([MobaXterm editions](https://mobaxterm.mobatek.net/download.html)), and Royal TSX Lite at 10 connections ([Royal TSX](https://www.royalapps.com/ts/mac/features)). One-time prices get the opposite reaction: SecureCRT owners say the quality justifies the cost ([HN](https://news.ycombinator.com/item?id=47209916)), and another user is content with a $30 one-time iOS client ([HN](https://news.ycombinator.com/item?id=47066974)). **Accounts and telemetry** are the second trigger. In a sample of about 25 Warp-related HN comments since 2023, **about 16 name mandatory login, telemetry, or not knowing what leaves the machine** as the reason they uninstalled Warp or never started using it ([HN](https://news.ycombinator.com/item?id=44954512), [HN](https://news.ycombinator.com/item?id=36433082)). Warp dropped the login requirement in November 2024 ([Warp blog](https://www.warp.dev/blog/lifting-login-requirement)), and the top negative AlternativeTo comment on Termius just complains that it needs an account ([AlternativeTo](https://alternativeto.net/software/serverauditor/about/)). Default-on AI makes this worse. A 2025 HN thread accused Warp of sending terminal sessions to an LLM without consent ([HN mirror](https://hn.nuxt.dev/item/44953470)), and iTerm2 moved its AI into a separately installed plugin so terminal data can't leave the machine by accident ([iTerm2 AI plugin](https://iterm2.com/ai-plugin.html)).

Three more complaints shape the field. **Electron clients feel slow.** Tabby's own README admits it is not lightweight ([Tabby](https://github.com/Eugeny/tabby)), and users describe it freezing for minutes while it prints large output ([HN](https://news.ycombinator.com/item?id=45274170), [HN](https://news.ycombinator.com/item?id=38591706)). The Termius desktop app is Electron, about 379 MB on Apple Silicon ([Desktop Insights](https://desktopinsights.com/apps/termius)), and one reviewer called the Mac version an iOS port with poor keyboard navigation ([AlternativeTo](https://alternativeto.net/software/serverauditor/about/)). **Data loss stirs the strongest feelings.** **7 of 17 Termius Trustpilot reviews (2.4/5)** describe hosts or keys disappearing after updates, logouts or a password reset, or complain that nothing can be exported ([Trustpilot](https://www.trustpilot.com/review/termius.com)). **The best power tools are missing or weaker on macOS.** MobaXterm, Xshell, Bitvise and KiTTY are Windows-only. SecureCRT on Mac loses VBScript, RDP and the graphical keymap editor ([SecureCRT](https://www.vandyke.com/products/securecrt/features.html)). WindTerm users have asked for a native Apple Silicon build since 2022 ([WindTerm #1281](https://github.com/kingToolbox/WindTerm/issues/1281)). Maintenance worries hang over Tabby, whose 2026 release hung on start (36 +1, [#11200](https://github.com/Eugeny/tabby/issues/11200)), and WindTerm, whose developer said work would slow to a fifth of its former pace ([#1596](https://github.com/kingToolbox/WindTerm/issues/1596)).

For Conduit, this means the trust posture is already a selling point and should be stated plainly up front. Any AI must stay optional and separate. Performance should be treated as a feature: Conduit draws its terminal with xterm.js, which is web technology, so it inherits the "web terminals are slow" perception and should be tested against the large output floods that sink Electron terminals (inference). The niche is also crowded. A 2025-2026 wave of indie native Mac SSH clients on HN competes on small size, no subscription, encrypted sync and AI ([Tern](https://news.ycombinator.com/item?id=50054405), [termkick](https://news.ycombinator.com/item?id=49913778), [ServerBuddy](https://news.ycombinator.com/item?id=44867184), [Hatoba](https://news.ycombinator.com/item?id=50076388)). Conduit's lasting edge is therefore depth for working sysadmins, not any single feature.

| Complaint that drives switching | Typical targets | Where Conduit stands |
|---|---|---|
| Subscriptions and paywalled basics (sync, serial, logs) | Termius, SecureCRT, MobaXterm caps | Strong: no subscription. Keep F2 and F7 free if they ship |
| Mandatory account, telemetry, default-on AI | Warp, Termius, iTerm2 | Strong: no account or telemetry. Keep any AI (F40) off and separate |
| Electron sluggishness on big output | Tabby, Termius | Exposed: xterm.js is web tech, so benchmark large output |
| Data loss and no export | Termius | Gap: no export yet (F6) |
| Best tools are Windows-only | MobaXterm, Xshell, Bitvise, KiTTY | Opportunity: most MobaXterm favourites are present. X11 (F14), macros (F17) and Mosh (F12) are missing |
| Stability regressions | Tabby, WindTerm, Royal TSX | A quality bar, not a feature |

## Sixty-three candidates, sorted into four evidence tiers

The tiers rank evidence first and fit with Conduit second. **Tier 1** features ship in four or more competing apps, are backed by quantified demand or repeated first-hand user comments, and fit a Mac SSH/SFTP client for sysadmins. **Tier 2** features have solid evidence from several apps or one strong signal (for example 50+ GitHub votes), or close a clear MobaXterm-parity gap. **Tier 3** features have moderate evidence, serve a narrower audience (network engineers, teams), or cost a lot for the demand shown. **Tier 4** collects weak or divisive evidence, team or enterprise features, things out of scope for a single-user Mac app, and small polish. Each entry says what the feature is, why users want it, and who has it, with source links. Items whose parts already exist in Conduit (checked against its code on 2026-10-19) say what is there and what is missing. The effort column is my rough guess (S = small, M = medium, L = large) from general engineering experience. It does not come from the research, and it depends on Conduit's SSH library and architecture.

| ID | Feature | Tier | Effort (guess) |
|---|---|---|---|
| F1 | Split panes inside a tab | 1 | M |
| F2 | Automatic session logging to file | 1 | S |
| F3 | Button bar of one-click commands | 1 | M |
| F4 | Compose window and send to selected sessions | 1 | M |
| F5 | Session and workspace restore | 1 | M |
| F6 | Full export and backup | 1 | S |
| F7 | Account-free sync across Macs | 1 | L |
| F8 | Triggers and login scripts | 1 | M |
| F9 | Prompt marks (OSC 133): jump between commands, copy last output | 2 | S |
| F10 | Notifications: command finished, bell, remote notify sequences | 2 | S |
| F11 | Auto-reconnect that keeps scrollback | 2 | S-M |
| F12 | Mosh sessions | 2 | L |
| F13 | tmux integration (auto-attach, then control mode) | 2 | S-L |
| F14 | X11 forwarding to XQuartz | 2 | M |
| F15 | SSH agent forwarding and per-host agent choice | 2 | S |
| F16 | Per-host terminal look (production warning colours) | 2 | S |
| F17 | Macro recorder | 2 | M |
| F18 | Secure Enclave keys with Touch ID | 2 | M |
| F19 | Type a saved password at sudo/enable prompts | 2 | S |
| F20 | Duplicate session without logging in again | 2 | M |
| F21 | Drag a tab out into its own window | 2 | M |
| F22 | Quick Select keyboard hints | 3 | M |
| F23 | Download or open files straight from terminal output | 3 | S |
| F24 | Clickable `file:line` paths (URLs and OSC 8 links already work) | 3 | S |
| F25 | Password-manager integration (1Password, Bitwarden, KeePass) | 3 | M |
| F26 | SFTP upgrades: resume, compare/mirror, fast bulk actions | 3 | M |
| F27 | More importers (SecureCRT, PuTTY, Termius, Royal, mRemoteNG, CSV) | 3 | M |
| F28 | Inventory discovery (EC2, Kubernetes, Tailscale, scripts) | 3 | M |
| F29 | Scripting and automation API | 3 | L |
| F30 | `ssh://` link handler (quick connect already exists) | 3 | S |
| F31 | Zmodem and trzsz in-band file transfer | 3 | M |
| F32 | Serial console upgrades | 3 | M |
| F33 | Hotkey drop-down window | 3 | M |
| F34 | Session recording and playback | 3 | S |
| F35 | RDP/VNC through an SSH tunnel in one click, then embedded | 3 | S / L |
| F36 | FIDO2 / YubiKey security keys | 3 | L |
| F37 | Known-hosts manager | 3 | S |
| F38 | Key generation and one-click public-key deploy | 3 | S |
| F39 | Snippet upgrades: parameters, runbooks, shareable library | 3 | S-M |
| F40 | Opt-in AI assistant | 4 | L |
| F41 | Team sharing with credentials referenced by name | 4 | L |
| F42 | Inline images (Sixel, iTerm2, Kitty protocols) | 4 | S-M |
| F43 | Command palette | 4 | S-M |
| F44 | Inline autocomplete | 4 | M |
| F45 | Server-ops panels (Docker, systemd, cron, ports) | 4 | L |
| F46 | App lock and active-sessions panel | 4 | S |
| F47 | Bulk edit, templates and folder-level defaults | 4 | M |
| F48 | Pre/post-connect local tasks (e.g. bring up VPN) | 4 | S |
| F49 | Per-session HTTP/SOCKS proxy | 4 | S-M |
| F50 | Extra file protocols (FTP/FTPS, S3, WebDAV) | 4 | L |
| F51 | Mount SFTP as a Finder volume | 4 | L |
| F52 | TOTP auto-fill for 2FA prompts | 4 | S |
| F53 | SSH certificates | 4 | M |
| F54 | Post-quantum and negotiated-algorithm visibility | 4 | S-M |
| F55 | Built-in TFTP and syslog server | 4 | M |
| F56 | iPhone/iPad companion | 4 | L |
| F57 | Live session sharing | 4 | L |
| F58 | Separate left/right Option key behaviour | 4 (polish) | S |
| F59 | Modifier to bypass app mouse capture | 4 (polish) | S |
| F60 | Clipboard and paste history | 4 (polish) | S |
| F61 | No close confirmation at an idle prompt | 4 (polish) | S |
| F62 | Per-line timestamps | 4 (polish) | S |
| F63 | Automatic light/dark theme | 4 (polish) | S |

## Tier 1: eight features with the strongest evidence

### F1. Split panes inside a tab

**What it is.** Split one tab into side-by-side or stacked terminals, each running its own session on the same or different hosts. Panes resize by dragging, focus moves by keyboard, and inactive panes are dimmed. Broadcast could then target "all panes in this tab".

**Why users want it.** It is the **most-upvoted request in Tabby's history (81 +1)** ([Tabby #49](https://github.com/Eugeny/tabby/issues/49)), and every major terminal now ships it. Ghostty 1.3 (March 2026) added drag-and-drop rearranging of splits ([Ghostty 1.3](https://ghostty.org/docs/install/release-notes/1-3-0)), and Termius's January 2025 Workspaces added a split view of up to 16 connections ([Termius blog](https://termius.com/blog/workspaces)). For a sysadmin, it means tailing a log on one server while restarting a service on another, without flipping tabs.

**Who has it.** iTerm2 ([features](https://iterm2.com/features.html)), Ghostty, WezTerm ([features](https://wezterm.org/features.html)), Windows Terminal ([MS Learn](https://learn.microsoft.com/el-gr/windows/terminal/tips-and-tricks)), Tabby (nested splits, [README](https://github.com/Eugeny/tabby)), WindTerm ([README](https://github.com/kingToolbox/WindTerm)), SecureCRT tiling ([features](https://www.vandyke.com/products/securecrt/features.html)) and Termius.

### F2. Automatic session logging to file

**What it is.** Every session's output, including commands as they are echoed, is written to a plain-text file automatically from the moment of connection. It can be set per session, per folder or globally, with a filename template such as `{host}_{date}_{time}.log`, optional timestamps on each line, a choice of clean text or raw output, daily rotation, and an "open log folder" button.

**Why users want it.** This is the SecureCRT feature people say they can't give up. One user says logging everything from all sessions gives them the output as well as the command history, and they would find it hard to live without ([HN](https://news.ycombinator.com/item?id=44202700)). Another points out that logs keep commands in context with their output, which shell history does not ([HN](https://news.ycombinator.com/item?id=40007156)). A G2 reviewer of Termius wanted logs saved to a folder automatically, the way PuTTY does it ([G2, via search summary](https://www.g2.com/products/termius)). Termius puts logs behind its paid plan, and by default keeps only the most recent log per host ([Termius pricing](https://termius.com/pricing), [Termius docs](https://docs.termius.com/organize-and-connect-to-hosts/session-logs)). Network-engineer guides tie logging to change records and config backups ([codingnetworks.blog](https://codingnetworks.blog/securecrt-for-network-engineers/)), and a Mac network-engineer roundup names per-session logging as the reason SecureCRT stays the favourite ([PacketPilot, 2015](https://www.packetpilot.com/apps-for-a-network-engineer-part-1-mac/)).

**Who has it.** SecureCRT (start on connect, connect/disconnect strings, filename tokens, rotation) ([features](https://www.vandyke.com/products/securecrt/features.html)), PuTTY, WindTerm ([README](https://github.com/kingToolbox/WindTerm)), Termius (paid) and Tabby (plugin only, [README](https://github.com/Eugeny/tabby)). **Caution:** a log captures everything printed, secrets included, as Termius's docs warn. Write logs to a folder the user chooses, and make it obvious when logging is on.

### F3. Button bar of one-click commands

**What it is.** A visible strip of buttons under the terminal. Each button sends text (with or without Enter), runs a snippet, or sends a multi-line sequence. Different bars can be switched in per folder or device type ("Linux", "Cisco IOS", "Juniper"), and each button can target the current, selected or all sessions (with F4). It builds directly on Conduit's existing snippets.

**Why users want it.** One HN user calls clickable buttons that paste configured text "IMMENSELY useful" and pairs them with a bash loop as a poor man's Ansible ([HN](https://news.ycombinator.com/item?id=40503366)). In the r/networking thread on SecureCRT, highlighting and command buttons were credited with saving time, and colleagues bought licences after seeing them ([r/networking mirror](https://reddit.sentinel-team.org/posts/1pe0jij/snapshots/2025-12-05T09%3A31%3A24.629654Z)). Network-engineer guides stress separate button bars per device type ([codingnetworks.blog](https://codingnetworks.blog/securecrt-for-network-engineers/)). A consultancy blog rates Termius snippets as a weaker substitute ([jpptechnology](https://jpptechnology.com/blog/best-ssh-clients-network-engineers/); treat with caution, see limitations).

**Who has it.** SecureCRT button bar ([features](https://www.vandyke.com/products/securecrt/features.html)), Xshell Quick Commands ([Xshell](https://www.netsarang.com/en/xshell/)), WindTerm Quick Bar ([README](https://github.com/kingToolbox/WindTerm)) and KiTTY predefined-command shortcuts ([KiTTY](https://github.com/cyd01/KiTTY)).

### F4. Compose window and send to selected sessions

**What it is.** A panel for drafting a multi-line command, with its own history, which then sends to the current session, to all sessions, to a hand-picked subset (checkboxes, a folder or a tag), or only to visible panes. It also has a "send each keystroke immediately" mode for vi or menus. This fills the gap in Conduit's all-or-nothing broadcast.

**Why users want it.** SecureCRT's Command window sends to active, all, selected or visible sessions ([features](https://www.vandyke.com/products/securecrt/features.html)), and Xshell's Compose pane exists for the same job ([Xshell](https://www.netsarang.com/en/xshell/)). MultiExec, running the same command on many servers, is one of MobaXterm's signature features ([MobaXterm](https://mobaxterm.mobatek.net/features.html)). A long-time ZOC user calls sending to many sessions a real productivity gain but a risky one ([Dave Markowitz](https://davemarkowitz.substack.com/p/the-zoc-terminal-emulator)). Picking a subset is the safety valve: patch five web servers without touching the database tabs that are also open.

**Who has it.** SecureCRT, Xshell, WindTerm (command sender, Sync Input) ([README](https://github.com/kingToolbox/WindTerm)), electerm (mirror input to one or all terminals) ([README](https://github.com/electerm/electerm)), Termius (broadcast on paid plans) ([blog](https://termius.com/blog/broadcast-input)) and MobaXterm MultiExec.

### F5. Session and workspace restore

**What it is.** After a relaunch, crash or reboot, Conduit reopens the same tabs and splits and reconnects them. Named workspaces (SecureCRT calls them Snapshots) open a saved group of sessions in its layout with one click, for example "web cluster" or "core switches". Restoring old scrollback would be an optional, encrypted extra.

**Why users want it.** Four apps advertise it. SecureCRT has Snapshots and remembers last sessions ([features](https://www.vandyke.com/products/securecrt/features.html)). WindTerm restores sessions and layouts on restart ([README](https://github.com/kingToolbox/WindTerm)). Termius lists workspace restore on its homepage ([Termius](https://termius.com/)), though its Workspaces post said saving and reopening were still in development ([Termius blog](https://termius.com/blog/workspaces)). Tabby users ask for tabs to be restored on start ([HN](https://news.ycombinator.com/item?id=39968692)). Windows Terminal 1.21 restores buffer contents, stored on disk as text, with Microsoft warning about what that implies ([MS DevBlogs](https://devblogs.microsoft.com/commandline/windows-terminal-preview-1-21-release/)). iTerm2 3.7 (September 2026) added a session archive that saves and restores scrollback ([AlternativeTo](https://alternativeto.net/news/2026/9/iterm2-3-7-released-with-ios-companion-app-claude-code-integration-tab-groups-and-more/)).

**Who has it.** SecureCRT, WindTerm, Termius, Tabby, Windows Terminal and iTerm2. **Caution:** SSH scrollback often contains secrets, so restoring it should be opt-in and encrypted.

### F6. Full export and backup

**What it is.** Export all sessions, folders, icons, snippets, tunnel definitions and saved-login names to two formats: a standard `~/.ssh/config` file, and a Conduit backup file (JSON, optionally passphrase-encrypted, with secrets included only if you choose). Conduit can import that backup file again.

**Why users want it.** This is the most emotional complaint against Termius. **7 of its 17 Trustpilot reviews** describe lost hosts or lock-in. One reviewer complains they could import but never export hosts or keys. Another says resetting the encryption password wiped every saved host and key, after which they moved to SolarPuTTY ([Trustpilot](https://www.trustpilot.com/review/termius.com)). Someone published an unofficial Termius CLI just to export hosts to ssh_config ([PyPI](https://pypi.org/project/termius/)). One admin picked PuTTY over SecureCRT partly because it was easier to set up on new machines ([HN](https://news.ycombinator.com/item?id=44921093)). SecureCRT ships import and export ([features](https://www.vandyke.com/products/securecrt/features.html)).

**Who has it.** SecureCRT, and indirectly every client that reads and writes ssh_config. It costs little, signals trust, and is the foundation for F7.

### F7. Account-free sync across Macs

**What it is.** Sessions, folders, snippets and settings stay in sync between your Macs without a Conduit account. Sync runs through iCloud (a private CloudKit database, with iCloud Keychain for secrets), through an encrypted file in a folder you pick (iCloud Drive, Dropbox, a network share, a git repo), or both. Syncing secrets is optional, and private keys stay local by default.

**Why users want it.** Sync is Termius's main selling point and its most resented paywall. Users complain about paying about $10 a month just to sync ([HN](https://news.ycombinator.com/item?id=47235895)) and about having to buy premium to turn sync on ([Trustpilot](https://www.trustpilot.com/review/termius.com)). One would-be switcher wants SSH profiles synced to the cloud or peer-to-peer ([HN](https://news.ycombinator.com/item?id=42527584)). WindTerm users ask for config sync across work machines ([WindTerm #889](https://github.com/kingToolbox/WindTerm/issues/889)), and electerm users asked for WebDAV ([#3307](https://github.com/electerm/electerm/issues/3307)). Cloud sync also worries people. Commenters challenged one iCloud-syncing app's claim that data never leaves the device ([HN](https://news.ycombinator.com/item?id=43331779)), and another questioned putting SSH keys into a closed, for-profit subscription app ([HN](https://news.ycombinator.com/item?id=46408904)). Hence the user-controlled design.

**Who has it.** Termius (vendor cloud, paid) ([pricing](https://termius.com/pricing)), Royal TSX (documents on Dropbox or a network share) ([Royal](https://www.royalapps.com/ts/mac/features)), electerm (gist, WebDAV, custom server) ([README](https://github.com/electerm/electerm)), Tabby (gist plugin, with a key-name mapping so keys never sync) ([README](https://github.com/Eugeny/tabby)), XPipe (your own git remote) ([XPipe](https://xpipe.io/)), NaviTerm (iCloud) ([App Store](https://apps.apple.com/au/app/id6747072398)) and Panic Prompt 3 (Panic Sync) ([App Store](https://apps.apple.com/no/app/id1594420480)).

### F8. Triggers and login scripts

**What it is.** Rules that watch session output and act when a pattern appears. A rule can send text (answer the `Password:` after Cisco `enable`, press Enter at a banner, run `terminal length 0` at a router prompt), raise a notification, run a snippet, or highlight (which Conduit already does). There is also a per-session "after login" sequence of wait-for/send steps, such as `sudo -i` and then `cd /var/www`.

**Why users want it.** At least five clients ship a version of this. iTerm2 triggers can highlight, auto-respond and notify ([iTerm2](https://iterm2.com/features.html)). Xshell has triggers ([Xshell](https://www.netsarang.com/en/xshell/)), and electerm has quick commands and triggers ([README](https://github.com/electerm/electerm)). Tabby and SecureCRT run login scripts ([Tabby](https://github.com/Eugeny/tabby), [SecureCRT](https://www.vandyke.com/products/securecrt/features.html)), and KiTTY has an automatic logon script, password and command ([KiTTY](https://github.com/cyd01/KiTTY)). A SecureCRT user counts per-session startup commands among the reasons to stay ([HN](https://news.ycombinator.com/item?id=37412325)), and electerm has an open request to auto-fill a password at a terminal prompt ([#4123](https://github.com/electerm/electerm/issues/4123)).

**Who has it.** iTerm2, Xshell, electerm, Tabby, SecureCRT and KiTTY. **Caution:** auto-responding over SSH can type a secret into the wrong prompt, so use anchored patterns, scope rules per session, and show when a rule fires. iTerm2 also uses triggers as a fallback where you can't install shell integration on a host ([iTerm2 docs](https://iterm2.com/documentation-shell-integration.html)).

## Tier 2: thirteen well-supported features, including MobaXterm parity

### F9. Prompt marks (OSC 133): jump between commands, copy last output

**What it is.** Conduit's injected prompt would also emit the standard OSC 133 escape codes. These mark where each prompt, command and output starts and ends. With them Conduit can jump to the previous or next command (for example Cmd-Shift-Up/Down), select or copy just the last command's output, mark failed commands in red with their exit code, and later offer Warp-style "blocks". F10, F61 and any AI context build on this.

**Why users want it.** iTerm2's shell integration puts a mark at each prompt, colours failed commands red, shows the return code on right-click, and can select the output of the last command ([iTerm2 docs](https://iterm2.com/documentation-shell-integration.html)). Ghostty has jump-to-prompt and improved its OSC 133 support in 1.3 ([Ghostty docs](https://ghostty.org/docs/features/shell-integration), [1.3 notes](https://ghostty.org/docs/install/release-notes/1-3-0)). Warp's Blocks, where each command and its output form one unit, are its most praised interface idea ([Warp docs](https://docs.warp.dev/terminal/blocks)), and a Ghostty user asked for the same ([HN](https://news.ycombinator.com/item?id=42517447)). WindTerm users have asked for OSC 133 too ([#3542](https://github.com/kingToolbox/WindTerm/issues/3542)).

**Who has it.** iTerm2, Ghostty and Warp. Conduit already injects a prompt with the exit code, so this should be cheap.

### F10. Notifications: command finished, bell, remote notify sequences

**What it is.** A macOS notification, plus a badge on the tab, when a long command (say over 30 seconds) finishes in a background tab, when the bell rings, when a trigger matches (F8), or when a remote program sends a notification escape code (OSC 9, 777 or 99). An example of the last is Claude Code or Codex on a remote server signalling that it is waiting for input.

**Why users want it.** Ghostty 1.3 made command-finished notifications a headline feature, configurable by focus state and minimum duration ([Ghostty 1.3](https://ghostty.org/docs/install/release-notes/1-3-0)). iTerm2 has Alert on Next Mark and Notification Center alerts ([iTerm2 docs](https://iterm2.com/documentation-shell-integration.html)), and Tabby detects progress and notifies on completion ([Tabby](https://github.com/Eugeny/tabby)). Running AI agents over SSH has made this urgent. Terminals disagree on which escape code to use ([agentpatterns.ai](https://agentpatterns.ai/tool-engineering/terminal-sequence-hook-notifications/)). A 2025 Claude Code bug report said its notifications didn't arrive over SSH ([claudeissues](https://claudeissues.com/issue/3399-bug-notification-event-doesnt-work-over-ssh-with-macos)), and Ghostty support was only resolved in April 2026 ([Claude Code #41484](https://github.com/anthropics/claude-code/issues/41484)). An iPhone SSH app launched in October 2026 with notifying you when an agent is blocked as its whole pitch ([HN](https://news.ycombinator.com/item?id=50009634)).

**Who has it.** iTerm2, Ghostty, Tabby, and SecureCRT (tab activity indicators, [features](https://www.vandyke.com/products/securecrt/features.html)).

### F11. Auto-reconnect that keeps scrollback

**What it is.** When a connection drops (Wi-Fi change, sleep, VPN flap), Conduit reconnects automatically with backoff instead of waiting for you to press R. The old scrollback stays above a "reconnected at 14:02" divider, and Conduit can optionally re-run something like `tmux attach -t main`.

**Why users want it.** Bitvise reconnects automatically ([Bitvise](https://www.bitvise.com/ssh-client)), and Core Shell on the Mac restores connections after network loss or waking from sleep ([App Store](https://apps.apple.com/mo/app/core-shell-ssh-client/id1354319581?l=en&mt=12)). Tabby auto-reconnects serial ports ([Tabby](https://github.com/Eugeny/tabby)). electerm users ask to keep connections alive ([#3955](https://github.com/electerm/electerm/issues/3955)) and to keep scrollback across reconnects ([#2137](https://github.com/electerm/electerm/issues/2137)). NaviTerm added automatic tmux attach ([App Store](https://apps.apple.com/au/app/id6747072398)). The heavy-duty version is Wave's "durable sessions", a small helper on the server that keeps the shell alive through sleep and restarts ([Wave docs](https://docs.waveterm.dev/durable-sessions)).

**Who has it.** Bitvise, Core Shell, Tabby (serial), NaviTerm and Wave.

### F12. Mosh sessions

**What it is.** A Mosh session type: a UDP-based shell that survives roaming between networks, laptop sleep and high latency, with local echo of typing. The server needs `mosh-server` installed. Conduit would presumably keep a normal SSH connection alongside for the SFTP panel and tunnels (inference).

**Why users want it.** Tabby's Mosh request has been open since 2019 with **50 +1** ([#593](https://github.com/Eugeny/tabby/issues/593)), and WindTerm has a similar request ([#1338](https://github.com/kingToolbox/WindTerm/issues/1338)). MobaXterm includes Mosh even in the free Home edition ([MobaXterm editions](https://mobaxterm.mobatek.net/download.html)), so switchers have it today. Termius offers Mosh free ([pricing](https://termius.com/pricing)), though it doesn't log Mosh sessions ([Termius docs](https://docs.termius.com/organize-and-connect-to-hosts/session-logs)). Apple-platform clients Prompt 3, Blink (whose Mosh sessions survive a device restart) and NaviTerm all ship it ([Prompt 3](https://apps.apple.com/no/app/id1594420480), [Blink](https://apps.apple.com/app/id1594898306), [NaviTerm](https://apps.apple.com/au/app/id6747072398)).

**Who has it.** MobaXterm, Termius, Prompt 3, Blink and NaviTerm.

### F13. tmux integration (auto-attach, then control mode)

**What it is.** There are two levels. The small one is a per-session "attach to or create tmux session X on connect" option, which pairs with F11. The large one is tmux control mode (`tmux -CC`), where tmux windows and panes appear as native Conduit tabs and splits and survive disconnects.

**Why users want it.** Tabby's request has **30 +1** ([#5030](https://github.com/Eugeny/tabby/issues/5030)). WindTerm advertises tmux integration ([README](https://github.com/kingToolbox/WindTerm)), a Ghostty user asked for tmux control mode ([HN](https://news.ycombinator.com/item?id=42517447)), and NaviTerm added auto-attach ([App Store](https://apps.apple.com/au/app/id6747072398)). The 2025-2026 habit of reaching a tmux session running an AI agent from a phone accounts for **about 30 of 55 sampled 2026 Termius comments** ([HN](https://news.ycombinator.com/item?id=47786083), [HN](https://news.ycombinator.com/item?id=47666606)), so long-lived tmux sessions are becoming the norm.

**Who has it.** WindTerm and NaviTerm. iTerm2's tmux control mode is the usual model, though the pages fetched for this research did not document it.

### F14. X11 forwarding to XQuartz

**What it is.** A per-session "Forward X11" checkbox. Conduit requests X11 forwarding, sets `DISPLAY`, starts XQuartz if needed (and points you to it if it isn't installed), so tools like `virt-manager` or `gparted` just open on your Mac. An option allows trusted forwarding (`-Y`).

**Why users want it.** The built-in X server is MobaXterm's flagship feature ([MobaXterm](https://mobaxterm.mobatek.net/features.html)). One admin still uses it to manage LVM disks through a remote GUI ([HN](https://news.ycombinator.com/item?id=47374665)). An AlternativeTo user faults the top Mac "MobaXterm alternative" precisely for missing X forwarding and RDP ([AlternativeTo](https://alternativeto.net/software/mobaxterm/)). SecureCRT, WindTerm and Tabby all forward X11. **Caveat:** XQuartz caps the experience. It has had no release since 2023 and no HiDPI support, so apps look line-doubled ([HN](https://news.ycombinator.com/item?id=42869851)) or poor on scaled Retina screens ([HN](https://news.ycombinator.com/item?id=47256901)). It is essentially a one-person project ([HN](https://news.ycombinator.com/item?id=40464943)), and Linux GUIs are moving to Wayland ([HN](https://news.ycombinator.com/item?id=44883970)). Worth doing for MobaXterm parity, not worth over-investing in.

**Who has it.** MobaXterm (bundled X server), SecureCRT ([features](https://www.vandyke.com/products/securecrt/features.html)), WindTerm and Tabby.

### F15. SSH agent forwarding and per-host agent choice

**What it is.** A per-session "Forward SSH agent" option, so that `git pull` on a server can use your Mac's key, with a warning to enable it only on trusted hosts. You can also pick which agent a session uses (the macOS default, 1Password, Secretive or Bitwarden, i.e. `IdentityAgent`) and which key it offers.

**Why users want it.** SecureCRT, WindTerm and Tabby forward agents ([SecureCRT](https://www.vandyke.com/products/securecrt/features.html), [WindTerm](https://github.com/kingToolbox/WindTerm), [Tabby](https://github.com/Eugeny/tabby)), and electerm has an open request ([#3664](https://github.com/electerm/electerm/issues/3664)). The 1Password agent asks for Touch ID on each use but has a known limit: servers reject logins after about six offered keys. Choosing the key per host avoids that ([1Password docs](https://www.1password.dev/ssh/agent)). Bitwarden added its own SSH agent in 2025 ([Bitwarden](https://bitwarden.com/help/ssh-agent/)).

**Who has it.** SecureCRT, WindTerm and Tabby. Conduit's existing ssh-agent support is the base.

### F16. Per-host terminal look (production warning colours)

**What it is.** A terminal theme, background tint, tab colour and optional watermark badge ("PROD db01"), set per session or per folder and inherited by everything in that folder. Conduit already has colour tags and a per-session terminal theme (the tinted *Ember* and *Forest* themes). Missing: themes inherited from a folder, a watermark badge, and automatic switching by host or user.

**Why users want it.** It stops you typing into the wrong server. iTerm2 switches profiles automatically by host or user and shows badges ([iTerm2](https://iterm2.com/features.html)). kitty's SSH helper sets a colour scheme per host ([kitty ssh](https://sw.kovidgoyal.net/kitty/kittens/ssh/)). SecureCRT and Xshell have per-session colour schemes ([SecureCRT](https://www.vandyke.com/products/securecrt/features.html), [Xshell](https://www.netsarang.com/en/xshell/)), and a SecureCRT user names them as a reason to stay ([HN](https://news.ycombinator.com/item?id=37412325)).

**Who has it.** iTerm2, kitty, SecureCRT, Xshell, and WindTerm (tab colours).

### F17. Macro recorder

**What it is.** Press Record, work in a session (commands, Enter, answers to prompts), press Stop, and save the result as a macro. You can replay it on other sessions, bind it to a button (F3) or a shortcut, or edit it later as a snippet.

**Why users want it.** Macros are a signature MobaXterm feature ([MobaXterm](https://mobaxterm.mobatek.net/features.html)). The r/networking thread's opening poster singled out how easy MobaXterm makes macros for repeated commands ([r/networking mirror](https://reddit.sentinel-team.org/posts/1pe0jij/snapshots/2025-12-05T09%3A31%3A24.629654Z)). SecureCRT has a script recorder ([features](https://www.vandyke.com/products/securecrt/features.html)), Xshell records scripts from terminal input and output ([Xshell](https://www.netsarang.com/en/xshell/)), and Royal TSX has key-sequence tasks that send keystrokes to one or many connections ([Royal](https://www.royalapps.com/ts/mac/features)). MobaXterm Home caps you at **4 macros** ([editions](https://mobaxterm.mobatek.net/download.html)), so unlimited macros is itself a talking point for switchers.

**Who has it.** MobaXterm, SecureCRT, Xshell and Royal TSX.

### F18. Secure Enclave keys with Touch ID

**What it is.** Generate an SSH key inside the Mac's Secure Enclave, where it can't be copied off the machine. Each use requires Touch ID (or Apple Watch), you can optionally be notified every time the key is used, and the public key is shown for copying or deploying (F38). These are ECDSA P-256 keys.

**Why users want it.** Someone looking for a Termius replacement wants exactly this: a non-subscription client that generates keys in the Secure Enclave the way Secretive does ([HN](https://news.ycombinator.com/item?id=47065927)). Others want enclave key generation plus one-click deployment of the public key ([HN](https://news.ycombinator.com/item?id=47065588)). One user praises Termius for integrating Secure Enclave and TPM keys across platforms ([HN](https://news.ycombinator.com/item?id=47800415)), and a June 2026 Show HN built a tool for just this ([HN](https://news.ycombinator.com/item?id=48731704)). Conduit's Keychain storage with Touch ID reveal protects secrets at rest, but a revealed password or a key file can still be copied. An enclave key cannot.

**Who has it.** Secretive ([Help Net Security](https://www.helpnetsecurity.com/2024/07/31/secretive-app-managing-ssh-keys-secure-enclave)), Panic Prompt 3 ([App Store](https://apps.apple.com/no/app/id1594420480)), Blink ([App Store](https://apps.apple.com/app/id1594898306)) and Termius.

### F19. Type a saved password at sudo/enable prompts

**What it is.** A shortcut or right-click item, "Type password for…", that types a saved login's password (from Keychain, after Touch ID) into the terminal for `sudo`, `su`, Cisco `enable` or a second hop. For Conduit it should stay a deliberate action you trigger each time, never filled in automatically when a prompt appears, in line with how *Browse as root* already works (it never reuses the login password on its own).

**Why users want it.** iTerm2's Password Manager keeps passwords in the Keychain and enters them only at password prompts, and version 3.5 added 1Password and LastPass as sources ([iTerm2](https://iterm2.com/features.html), [AlternativeTo](https://alternativeto.net/news/2024/5/iterm2-v3-5-0-launches-with-chatgpt-integration-and-support-for-lastpass-and-1password)). KiTTY sends passwords automatically ([KiTTY](https://github.com/cyd01/KiTTY)), and users call that a big convenience ([HN](https://news.ycombinator.com/item?id=40045090)). electerm has an open request for it ([#4123](https://github.com/electerm/electerm/issues/4123)). Conduit already has Keychain, Touch ID and saved logins, so this mostly reuses existing parts.

**Who has it.** iTerm2 and KiTTY.

### F20. Duplicate session without logging in again

**What it is.** "Duplicate tab" or "New tab here" opens another shell on the same host over the connection that is already authenticated (SSH multiplexing, like OpenSSH's ControlMaster), in the same directory. There is no second password or 2FA prompt, and it opens faster.

**Why users want it.** An HN user asks whether SecureCRT reuses the main connection for new tabs, because ControlMaster makes extra sessions instant ([HN](https://news.ycombinator.com/item?id=47332125)). kitty's SSH helper shares connections so you type the password only once, and opens new windows in the same directory ([kitty ssh](https://sw.kovidgoyal.net/kitty/kittens/ssh/)). WindTerm supports ControlMaster ([README](https://github.com/kingToolbox/WindTerm)), and KiTTY has quick duplicate session ([KiTTY](https://github.com/cyd01/KiTTY)). In Ghostty, new tabs inheriting the current directory was among the most requested features ([Ghostty 1.3](https://ghostty.org/docs/install/release-notes/1-3-0)). This matters most behind 2FA bastions: Conduit supports keyboard-interactive 2FA, and its *Duplicate Tab* opens a fresh connection today, so each new tab repeats the login and 2FA prompt.

**Who has it.** kitty, WindTerm and KiTTY.

### F21. Drag a tab out into its own window

**What it is.** Drag a tab out to make a new window, for example on a second monitor, and drag it back to merge.

**Why users want it.** Tabby's request has **54 +1 and has been open since 2018** ([Tabby #581](https://github.com/Eugeny/tabby/issues/581)), the second-strongest vote count in this research after split panes. The research did not document which competitors support it, though native macOS tabbed windows generally do. Conduit uses a single window today, so this is missing.

**Who has it.** Not documented here beyond the Tabby demand signal.

## Tier 3: eighteen features for narrower needs or bigger budgets

### F22. Quick Select keyboard hints

**What it is.** Press a shortcut and every URL, IP address, file path, git hash or number on screen (plus your own regex patterns) gets a one- or two-letter label. Type the label to copy that item, or the uppercase label to paste it. It is mouse-free copying of IPs from `ip a` or hostnames from logs.

**Why users want it.** WezTerm's Quick Select ([docs](https://wezterm.org/quickselect.html)) and kitty's hints, with url, path, ip, hash and file:line types and copy, paste and open actions ([kitty hints](https://sw.kovidgoyal.net/kitty/kittens/hints/)), are power-user favourites. iTerm2's Smart Selection is the mouse equivalent ([iTerm2](https://iterm2.com/features.html)). The evidence is product documentation, with no vote counts.

**Who has it.** WezTerm, kitty, and iTerm2 (mouse version).

### F23. Download or open files straight from terminal output

**What it is.** Right-click a filename in `ls` output, or any path, and choose "Download via SFTP", "Open in editor" (using Conduit's auto-upload), or "Show in SFTP panel". Conduit already knows the current directory and has an SFTP channel open.

**Why users want it.** iTerm2's shell integration lets you right-click a filename in `ls` output to download it over scp, and Option-drag a Finder file into the terminal to upload ([iTerm2 docs](https://iterm2.com/documentation-shell-integration.html)). kitty's SSH helper can also transfer files ([kitty ssh](https://sw.kovidgoyal.net/kitty/kittens/ssh/)). Conduit already has the upload half (Finder drop onto the terminal). This adds the download half.

**Who has it.** iTerm2 and kitty.

### F24. Clickable `file:line` paths in output

**What it is.** Cmd-click URLs, hyperlinks sent by programs (`ls --hyperlink`), and `file:line` paths in compiler or log output.

**Why users want it.** It is a baseline feature in WezTerm and kitty ([WezTerm](https://wezterm.org/features.html), [kitty hints](https://sw.kovidgoyal.net/kitty/kittens/hints/)). Conduit already opens plain URLs and OSC 8 hyperlinks with ⌘-click. Only clickable `file:line` paths (open in your editor, or via SFTP on a server) are missing.

**Who has it.** WezTerm, kitty and iTerm2.

### F25. Password-manager integration (1Password, Bitwarden, KeePass)

**What it is.** Use a 1Password, Bitwarden or KeePass entry as the source for a saved login. Conduit fetches it at connect time through the password manager's CLI or agent and never stores it.

**Why users want it.** Royal TSX integrates 1Password, LastPass and KeePass ([Royal](https://www.royalapps.com/ts/mac/features)). Devolutions RDM integrates KeePass, Bitwarden, 1Password and Keeper ([RDM](https://devolutions.net/remote-desktop-manager/)), and users value reaching Bitwarden entries from inside it ([HN](https://news.ycombinator.com/item?id=38113148)). iTerm2 3.5 added 1Password and LastPass ([AlternativeTo](https://alternativeto.net/news/2024/5/iterm2-v3-5-0-launches-with-chatgpt-integration-and-support-for-lastpass-and-1password)). Warp pulls secrets from 1Password at runtime ([Warp blog](https://warp.dev/blog/dynamically-sync-env-vars-into-your-terminal-session)), and XPipe fetches through password-manager CLIs ([XPipe](https://xpipe.io/)). Demand is strongest in companies where the password manager is the source of truth.

**Who has it.** Royal TSX, RDM, iTerm2, Warp and XPipe.

### F26. SFTP upgrades: resume, compare/mirror, fast bulk actions

**What it is.** A bundle: recursive folder upload and download, resuming interrupted transfers, folder compare and mirror, fast bulk delete and chmod across 1,000+ files, column sorting, and throughput tuning. Conduit already transfers whole folders and sorts by column. Resume, compare/mirror and fast bulk delete/chmod are missing.

**Why users want it.** Tabby's recursive-transfer request has **27 +1** ([#4946](https://github.com/Eugeny/tabby/issues/4946)) and its slow-download complaint 17 +1 ([#8972](https://github.com/Eugeny/tabby/issues/8972)). A Termius reviewer says its SFTP freezes when deleting more than 1,000 files and can't bulk-edit permissions ([Trustpilot](https://www.trustpilot.com/review/termius.com)). Users of the ServerBuddy Mac app asked for sorting and recursive transfers ([HN](https://news.ycombinator.com/item?id=44867184)). Bitvise offers integrity-verified resume and directory mirroring ([Bitvise](https://www.bitvise.com/ssh-client)).

**Who has it.** Bitvise (resume, mirroring), plus standard file-manager behaviour in most dual-pane clients.

### F27. More importers (SecureCRT, PuTTY, Termius, Royal, mRemoteNG, CSV)

**What it is.** Import sessions from SecureCRT, PuTTY/KiTTY (registry export), Termius, Royal TSX, mRemoteNG and CSV, alongside the existing MobaXterm and ssh_config importers.

**Why users want it.** A developer who left SecureCRT, MobaXterm and Termius built a SecureCRT session importer before anything else in their new tool ([HN](https://news.ycombinator.com/item?id=47180159)). Termius imports from ssh_config and MobaXterm to lower switching costs ([Termius docs](https://docs.termius.com/getting-started/import-existing-hosts/)), and one Termius user switched to SolarPuTTY for its import and export ([Trustpilot](https://www.trustpilot.com/review/termius.com)). Demand for CSV import could not be confirmed (Reddit was blocked).

**Who has it.** Termius (ssh_config, MobaXterm) and SolarPuTTY.

### F28. Inventory discovery (EC2, Kubernetes, Tailscale, scripts)

**What it is.** Folders that fill themselves. Examples: EC2 instances for a chosen account and region (read-only credentials in Keychain), kubectl contexts, then namespaces, then pods (opening as exec sessions), Tailscale devices, or the JSON output of any script (Royal-style "dynamic folders"), for example from Consul or a CMDB. Conduit already has EC2, SSM and kubectl/docker exec session types; this creates them automatically.

**Why users want it.** Termius imports EC2 and Lightsail into an auto-updating group (Team plan and above), plus DigitalOcean and Azure ([AWS](https://docs.termius.com/integrations/aws), [DigitalOcean](https://docs.termius.com/integrations/digitalocean), [Azure](https://docs.termius.com/integrations/microsoft-azure)). XPipe auto-detects Docker, Kubernetes pods, Proxmox and Tailscale ([XPipe](https://xpipe.io/)), and Royal TSX has dynamic folders ([Royal](https://www.royalapps.com/ts/mac/features)). A SecureCRT team scripted session and jump-host creation from Consul ([HN](https://news.ycombinator.com/item?id=37412325)). ServerBuddy users argued for pluggable connection types so people don't need a separate app per tool ([HN](https://news.ycombinator.com/item?id=44867184)). The Tailscale idea is inference; no client documentation for it was found.

**Who has it.** Termius (paid), XPipe and Royal TSX.

### F29. Scripting and automation API

**What it is.** A way for other tools to drive Conduit: AppleScript/Shortcuts actions (open a session, send text, read the last output), a `conduit` command-line tool, and possibly Python scripts with send, wait-for and capture steps for looping over hosts.

**Why users want it.** SecureCRT's Python scripting (send commands, read output, loop over devices) is a key reason network engineers stay ([SecureCRT](https://www.vandyke.com/products/securecrt/features.html), [jpptechnology](https://jpptechnology.com/blog/best-ssh-clients-network-engineers/)). Royal TSX supports AppleScript ([Royal](https://www.royalapps.com/ts/mac/features)) and RDM PowerShell ([RDM](https://devolutions.net/remote-desktop-manager/)). Ghostty 1.3 added AppleScript control as a preview ([Ghostty 1.3](https://ghostty.org/docs/install/release-notes/1-3-0)), and Bitvise and electerm ship command-line tools ([Bitvise](https://www.bitvise.com/ssh-client), [electerm](https://github.com/electerm/electerm)). This is a large job, so start with AppleScript/Shortcuts and a CLI.

**Who has it.** SecureCRT, Royal TSX, RDM, Ghostty, iTerm2, Bitvise and electerm.

### F30. `ssh://` link handler

**What it is.** Conduit already connects when you type `admin@10.0.0.5:2222` in the launcher (⌘L). Missing: Conduit registers as the handler for `ssh://` links, so links from 1Password, wikis or a CMDB open in Conduit.

**Why users want it.** A Termius reviewer complains that quick connect with `user@host` still prompts for the username ([Trustpilot](https://www.trustpilot.com/review/termius.com)). RDM connects from its address bar ([RDM](https://devolutions.net/remote-desktop-manager/)). electerm supports `ssh://user@host:22` deep links ([electerm](https://github.com/electerm/electerm)) and KiTTY registers an SSH handler ([KiTTY](https://github.com/cyd01/KiTTY)). 1Password's SSH Bookmarks open `ssh://` URLs in whichever terminal app you choose ([1Password](https://developer.1password.com/docs/ssh/bookmarks)), which would put Conduit straight into that workflow.

**Who has it.** RDM, electerm, KiTTY, and 1Password as a link source.

### F31. Zmodem and trzsz in-band file transfer

**What it is.** Conduit detects `rz`/`sz` (and trzsz) in the session and moves files through the terminal stream itself. That works through jump chains, after `sudo su`, and on serial consoles where SFTP can't reach.

**Why users want it.** SecureCRT, WindTerm, Tabby and electerm all ship it ([HN](https://news.ycombinator.com/item?id=49162459), [WindTerm](https://github.com/kingToolbox/WindTerm), [Tabby](https://github.com/Eugeny/tabby), [electerm](https://github.com/electerm/electerm)). Xshell's rz/sz is reportedly popular in Chinese-language communities, but this research could not confirm it.

**Who has it.** SecureCRT, WindTerm, Tabby and electerm.

### F32. Serial console upgrades

**What it is.** Auto-detect USB-serial adapters (`/dev/cu.usbserial*`, FTDI, PL2303, CH340) with a 9600-8-N-1 default. Add a send-BREAK button, hex view and hex input, newline conversion, local line editing, reconnect when the adapter is re-plugged, "send text file with a delay per line" for pasting configs, and XMODEM/YMODEM for firmware.

**Why users want it.** One user picked Tabby for serial options such as local line editing ([HN](https://news.ycombinator.com/item?id=45274323)), and Tabby also has hex input, hexdump and auto-reconnect ([Tabby](https://github.com/Eugeny/tabby)). SecureCRT is the recommendation for heavy serial use ([HN](https://news.ycombinator.com/item?id=44585306)), and Termius putting serial behind a paywall annoyed people ([HN](https://news.ycombinator.com/item?id=40554610)). Some items on this list are inferred from network-engineer needs rather than individually sourced.

**Who has it.** Tabby, SecureCRT, ZOC and WezTerm (serial).

### F33. Hotkey drop-down window

**What it is.** A global shortcut slides a Conduit window down from the top of the screen, over full-screen apps, with tabs inside it. Press the shortcut again to hide it.

**Why users want it.** A quick-toggle terminal is one stated reason people switched to Ghostty (anecdotal, [batsov.com](https://batsov.com/articles/2025/03/14/updating-my-toolbox-ghostty-and-fish/)). At Ghostty's launch, users complained its drop-down lacked tabs and didn't work over full-screen apps ([HN](https://news.ycombinator.com/item?id=42517447)), which is a design checklist in itself.

**Who has it.** iTerm2 Hotkey Window ([iTerm2](https://iterm2.com/features.html)), Ghostty Quick Terminal, Windows Terminal quake mode ([MS Learn](https://learn.microsoft.com/el-gr/windows/terminal/tips-and-tricks)), Tabby ([Tabby](https://github.com/Eugeny/tabby)) and electerm (global hotkey).

### F34. Session recording and playback

**What it is.** Record a session with its timing (asciinema `.cast` format) and replay it like a video, or share the file. It complements F2's text logs.

**Why users want it.** Bitvise records terminal sessions ([Bitvise](https://www.bitvise.com/ssh-client)), and Tabby does through a plugin ([Tabby](https://github.com/Eugeny/tabby)). Devolutions RDM records SSH for audit ([Devolutions docs](https://docs.devolutions.net/rdm/concepts/advanced-concepts/session-recording)), Teleport records SSH sessions by default ([Teleport](https://goteleport.com/docs/reference/architecture/session-recording/)), and Termius Team shares session logs ([Termius](https://docs.termius.com/team-collaboration/team-session-logs)). The audience leans toward compliance and enterprise use.

**Who has it.** Bitvise, Tabby, RDM, Teleport and Termius.

### F35. RDP/VNC through an SSH tunnel in one click, then embedded

**What it is.** In two steps. First, "Open RDP/VNC through this SSH host": Conduit creates the tunnel and launches Windows App or Screen Sharing against localhost. Second, and much larger, RDP/VNC shown inside Conduit tabs.

**Why users want it.** Bitvise's single-click RDP forwarding ([Bitvise](https://www.bitvise.com/ssh-client)) is praised as a real advantage over PuTTY ([HN](https://news.ycombinator.com/item?id=40050469)). Royal TSX, RDM, MobaXterm and Xshell show RDP in tabs ([Royal](https://www.royalapps.com/ts/mac/features), [RDM](https://devolutions.net/remote-desktop-manager/), [Xshell](https://www.netsarang.com/en/xshell/)). Tabby's request for better RDP has 25 +1 ([#5854](https://github.com/Eugeny/tabby/issues/5854)), and RDM's Apple Remote Desktop codec is said to beat plain VNC against Mac hosts ([HN](https://news.ycombinator.com/item?id=43442335)). The first step is small, since Conduit already has tunnels and external launch.

**Who has it.** Bitvise (tunnel), Royal TSX, RDM, MobaXterm, Xshell and electerm (embedded).

### F36. FIDO2 / YubiKey security keys

**What it is.** Support for `ed25519-sk` and `ecdsa-sk` keys on YubiKey and similar devices, where you touch the key to sign.

**Why users want it.** Termius supports FIDO2 keys such as YubiKey, SoloKey and Titan ([Termius](https://termius.com/documentation/fido2)). Yubico notes that Apple disabled FIDO in the OpenSSH bundled with macOS, so apps must implement it themselves; the note may be dated ([Yubico](https://developers.yubico.com/SSH/)). Users confirm that macOS ssh doesn't handle hardware keys without Homebrew ([HN](https://news.ycombinator.com/item?id=45597220)). It is costly to build (USB/CTAP2 work).

**Who has it.** Termius, plus SecureCRT for smart cards and X.509 certificates.

### F37. Known-hosts manager

**What it is.** A window listing trusted host keys with host, key type, fingerprint, first seen and last used. You can search, remove entries, re-trust a host after a planned rebuild, and see the history of key changes. `@cert-authority` lines could be supported too. Conduit already checks `known_hosts` and warns on change; the gap is managing the entries, which today presumably means editing the file by hand.

**Why users want it.** Termius has a Known Hosts section ([Termius](https://termius.com/)) and SecureCRT manages host keys ([SecureCRT](https://www.vandyke.com/products/securecrt/features.html)). Tabby's security bug, where it sent the password even after host-key verification failed, drew 30 +1 ([#9955](https://github.com/Eugeny/tabby/issues/9955)), which shows users care about host-key handling. The research found no competitor with a strong UI here, so it is an opening (inference).

**Who has it.** Termius and SecureCRT.

### F38. Key generation and one-click public-key deploy

**What it is.** Generate ed25519 keys in the app (or Secure Enclave keys, F18), copy the public key, and "Install public key on this server", the equivalent of `ssh-copy-id`.

**Why users want it.** A Termius reviewer complains it has no PuTTYgen-style key generator or agent ([Trustpilot](https://www.trustpilot.com/review/termius.com)). Users want key generation paired with one-click deployment of the public key ([HN](https://news.ycombinator.com/item?id=47065588)). Conduit has no key generator today.

**Who has it.** PuTTYgen (PuTTY), Termius (keychain) and Bitvise.

### F39. Snippet upgrades: parameters, runbooks, shareable library

**What it is.** `{{placeholders}}` filled in at run time (for example `systemctl restart {{service}}`), multi-step runbooks, and export/import of snippet libraries to share with a team.

**Why users want it.** In r/networking, SecureCRT's Command Manager with an exportable list shared across the team was a highly upvoted reason to stay ([r/networking mirror](https://reddit.sentinel-team.org/posts/1pe0jij/snapshots/2025-12-05T09%3A31%3A24.629654Z)). Warp offers parameterized Workflows and runbook-style Notebooks ([Warp Drive](https://docs.warp.dev/knowledge-and-collaboration/warp-drive), [Notebooks](https://docs.warp.dev/knowledge-and-collaboration/warp-drive/notebooks)). Termius shares snippets through team vaults ([pricing](https://termius.com/pricing)), and one new client lists playbook support as core ([HN](https://news.ycombinator.com/item?id=46936642)).

**Who has it.** SecureCRT, Warp and Termius.

## Tier 4: polarising, team-scale or small-polish items

### F40. Opt-in AI assistant

**What it is.** Turn plain-English requests into a suggested command that is inserted but never run on its own, explain a selected error or output, and possibly an agent mode where every command needs your approval.

**Why it ranks low.** AI is common, but it is the most divisive feature in this research. Termius offers AI autocomplete even on its free tier and has a beta agent that asks before every command ([Termius pricing](https://termius.com/pricing), [Termius blog](https://termius.com/blog/ai-agent)). iTerm2 3.6 gives each AI capability a Never/Ask/Always permission, denied by default, and supports local models ([iTerm2 AI Chat](https://iterm2.com/documentation-ai-chat.html)). electerm and Wave support bring-your-own-key and local models ([electerm](https://github.com/electerm/electerm), [Wave](https://docs.waveterm.dev/waveai-modes)). The backlash is loud, though. iTerm2 had to move AI into a separate plugin ([iTerm2](https://iterm2.com/ai-plugin.html), [HN mirror](https://hn.svelte.dev/item/40458135)), Warp was accused of sending sessions without consent ([HN mirror](https://hn.nuxt.dev/item/44953470)), and users ask how to switch off AI pop-ups ([electerm #3832](https://github.com/electerm/electerm/issues/3832)). If Conduit builds this, the safe pattern from the evidence is: off by default and ideally a separate add-on; Apple's on-device model first (about a 4K-token context, enough for "explain this error") ([Kodeco](https://www.kodeco.com/53631607-getting-started-with-apple-s-foundation-models)), then local Ollama, then your own API key stored in Keychain; show exactly what will be sent; never send credentials.

### F41. Team sharing with credentials referenced by name

**What it is.** A shared session file (on a network share, in iCloud Drive or in git) where connections refer to credentials by name. Each person keeps their own secrets locally in Keychain.

**Why it ranks low.** It suits teams, not a single admin. Royal TSX is the model: shared documents plus private credential documents ([Royal KB](https://www.royalapplications.com/go/kb-all-teamsharing)). XPipe syncs a team vault through git ([XPipe](https://xpipe.io/)), and Termius charges $20-30 per seat for team vaults ([pricing](https://termius.com/pricing)). It would reuse F6/F7's file format.

| ID | Feature | Who has it / evidence | Why it ranks low |
|---|---|---|---|
| F42 | Inline images (Sixel, iTerm2, Kitty protocols) | iTerm2, WezTerm ([features](https://wezterm.org/features.html)); xterm.js has an image add-on, with Sixel and iTerm2 images in beta and Kitty in alpha ([addon-image](https://github.com/xtermjs/xterm.js/tree/master/addons/addon-image)) | Developer-oriented; little sysadmin demand found |
| F43 | Command palette (fuzzy search over every action) | WindTerm ([README](https://github.com/kingToolbox/WindTerm)), Warp | Conduit's keyboard launcher already covers much of it |
| F44 | Inline autocomplete from history | Termius (free tier), WindTerm, iTerm2 ([iTerm2](https://iterm2.com/features.html)) | Users ask how to turn it off ([WindTerm #786](https://github.com/kingToolbox/WindTerm/issues/786)); must be opt-in |
| F45 | Server-ops panels (Docker containers and logs, systemd, cron, ports) | ServerBuddy users value them ([HN](https://news.ycombinator.com/item?id=44867184)) | One app's niche; Conduit's monitoring bar covers the basics |
| F46 | App lock and active-sessions panel (bulk disconnect, lock) | SecureCRT ([features](https://www.vandyke.com/products/securecrt/features.html)), WindTerm screen lock, MobaXterm master password | Low demand signal; macOS screen lock covers much of it |
| F47 | Bulk edit, connection templates, folder-level defaults | SecureCRT multi-session edit, Royal bulk edit and templates ([Royal](https://www.royalapps.com/ts/mac/features)) | Matters only at hundreds of sessions |
| F48 | Pre/post-connect local tasks (bring up VPN, ping) | Royal TSX command tasks ([Royal](https://www.royalapps.com/ts/mac/features)) | Single-vendor evidence |
| F49 | Per-session HTTP/SOCKS proxy | WindTerm, electerm ([README](https://github.com/electerm/electerm)), SecureCRT named firewalls | Jump hosts cover most cases |
| F50 | Extra file protocols (FTP/FTPS, S3, WebDAV) | Royal, MobaXterm, electerm | Low frequency; large scope |
| F51 | Mount SFTP as a Finder volume | Bitvise drive mapping ([Bitvise](https://www.bitvise.com/ssh-client)) | Single app; macOS file-system extensions are heavy work |
| F52 | TOTP auto-fill for 2FA prompts | Bitvise, electerm OTP | Low frequency; storing a TOTP seed next to the password weakens 2FA |
| F53 | SSH certificates (show principals and expiry, renew via `step` or opkssh) | Termius ([docs](https://docs.termius.com/keychain/ssh-keys-and-certificates)), electerm, Cloudflare OPKSSH ([blog](https://blog.cloudflare.com/open-sourcing-openpubkey-ssh-opkssh-integrating-single-sign-on-with-ssh/)) | Team/SSO environments only |
| F54 | Post-quantum key exchange and negotiated-algorithm display | OpenSSH 10 defaults to PQ key exchange and 10.1 warns without it ([OpenSSH](https://www.openssh.com/pq.html)) | Depends on Conduit's SSH library; cheap to display once supported |
| F55 | Built-in TFTP and syslog server for firmware/config pushes | Mac network engineers miss TFTPD32 ([PacketPilot, 2015](https://www.packetpilot.com/apps-for-a-network-engineer-part-1-mac/)) | Only 2015 evidence |
| F56 | iPhone/iPad companion | Termius's cross-device reach is its moat; iTerm2 3.7 added an iOS companion ([AlternativeTo](https://alternativeto.net/news/2026/9/iterm2-3-7-released-with-ios-companion-app-claude-code-integration-tab-groups-and-more/)) | A separate product |
| F57 | Live session sharing (one person drives, others watch) | Termius multiplayer, after simultaneous typing failed ([Termius blog](https://termius.com/blog/from-chaos-to-clarity-reimagining-real-time-collaboration-in-the-terminal)), Warp | Team feature; needs a relay |
| F58 | Separate left/right Option behaviour (one side Meta, other side types characters) | HN users lose non-ASCII and special characters when Option is Meta ([HN](https://news.ycombinator.com/item?id=31366069), [HN](https://news.ycombinator.com/item?id=47551851)) | Polish; relevant for Portuguese/German layouts. Conduit's Option-as-Meta setting applies to both keys today |
| F59 | Hold a modifier to select text natively inside tmux/vim/Claude Code | Complaints about TUIs hijacking right-click and selection ([HN](https://news.ycombinator.com/item?id=48948580)) | Polish |
| F60 | Clipboard and paste history | iTerm2 paste history ([iTerm2](https://iterm2.com/features.html)); copy-on-select critics lose clipboard contents ([HN](https://news.ycombinator.com/item?id=41823161)) | Polish; protects copy-on-select users |
| F61 | No close confirmation when the tab sits at an idle prompt | Ghostty ([docs](https://ghostty.org/docs/features/shell-integration)) | Polish; needs F9 |
| F62 | Per-line timestamps in the terminal | iTerm2 ([iTerm2](https://iterm2.com/features.html)), SecureCRT log timestamps | Polish; partly covered by F2 |
| F63 | Automatic light/dark theme switching | Cited by Ghostty switchers ([batsov.com](https://batsov.com/articles/2025/03/14/updating-my-toolbox-ghostty-and-fish/)) | Polish |

## The evidence has blind spots worth knowing

The biggest hole is **Reddit**, where most "which SSH client" debates happen. It was blocked by every tool tried. The only Reddit evidence is a mirrored snapshot of one r/networking thread, and it captured **12 of its 372 comments** ([mirror](https://reddit.sentinel-team.org/posts/1pe0jij/snapshots/2025-12-05T09%3A31%3A24.629654Z)). G2 and Capterra returned errors, so their content appears only as search-result summaries, which covers the G2 Termius points. The best numeric signal is **GitHub +1 counts**, but those come from users of open-source apps (Tabby, WindTerm, electerm). Hacker News, the main source of user voice, also skews toward developers. Network engineers and Windows admins, the closest peers of a MobaXterm switcher, are therefore under-represented, and demand for logging, serial, CSV import and mass deployment is probably understated rather than overstated. "Frequency" in this report means the number of independent sources in the sample, not the share of users. No source measured how many people actually rely on X11, logging or serial.

Several comparison blogs were written by **vendors of competing Mac SSH apps**: ctrlops.io, sshive.app, termai.sh, swiftserver.app, mxterm.net and gotempest.app. This report uses them only for context, never as sole evidence. The jpptechnology post comes from a consultancy and contains at least one apparent error (it says SecureCRT has no native Linux client), so its details are treated with caution. Some facts conflict. Termius serial access is quoted at both $10 and $15 a month, which may reflect different billing periods. Sources also disagree on whether free Termius requires a login or syncs to mobile. A competitor's claim that older Termius licences stopped validating could not be verified and is left out. The xterm.js implementation hints in the notes (image add-on aside) come from the researchers' general knowledge and need checking against current xterm.js documentation. Finally, F16, F20, F21, F24, F26, F30, F38 and F58 were checked against Conduit's code on 2026-10-19: parts of F16, F24, F26 and F30 already exist (each entry says which), and F20, F21, F38 and F58 are missing as described.

## Conclusion

The ranking hides a useful structure: **three foundations unlock most of the list**. A pane and layout model (F1) is what targeted sending to panes (F4), workspace restore (F5) and tear-off windows (F21) are built on. Prompt marks (F9) feed command-finished notifications (F10), copy-last-output, safe tab closing (F61), and any future AI context. One pattern-and-action engine, which Conduit's keyword highlighting already starts, can drive triggers (F8), password-at-prompt (F19), pattern notifications and recorded macros (F17). Building these three first makes much of the rest cheap. A sensible order has three steps. First, ship the small, evidence-heavy items that each answer a documented complaint: logging (F2), export (F6), prompt marks and notifications (F9, F10), agent forwarding (F15), password-at-prompt (F19) and quick connect (F30). Then deliver the core power-user release: split panes, the button bar and compose window, workspace restore and triggers (F1, F3, F4, F5, F8). Then add sync (F7), reusing F6's file format.

The positioning lesson is sharper than any single feature. What users resent most is having basics like sync, serial and logs withheld behind a subscription, and having an account or cloud forced on them. Conduit's advantage is giving these features away locally. Adding X11 forwarding (F14), macros (F17) and Mosh (F12) on top of what Conduit already ships would make "MobaXterm for the Mac" a claim it can defend item by item. Without them, it is one more native SSH client in a crowded 2026 field.
