# Terminal Emulator Features That Delight Users (iTerm2, Warp, WezTerm, Ghostty, Kitty, Alacritty, Hyper, macOS Terminal, Windows Terminal)

Scope: what users praise or request in modern terminal emulators, 2023-2026, mapped to Conduit, a macOS SSH client built on xterm.js.

Conduit ALREADY HAS (marked [PRESENT] below): themes, keyword highlighting, copy-on-select, right-click paste, search in scrollback, zoom, tabs, broadcast input to all tabs, snippets, command history panel, custom prompt with git branch and exit code, local shell tabs, OSC 7 cwd tracking.

Research date: 2026-10-19. Each claim has an inline source. Engineering hints about xterm.js APIs that I did not verify in this session are labeled "(unverified API hint)".

---

## Q1. What do people praise in iTerm2, Warp, WezTerm/Kitty and Ghostty?

### Takeaway
iTerm2 is praised for having the most features. The ones that matter for an SSH client are shell-integration marks, alert on command finish, triggers, smart selection, password manager, automatic profile switching per host, scp download/upload from output, hotkey window, split panes and instant replay. Its weak point is speed. Warp is praised for "blocks" (each command plus its output as one unit) and AI help. WezTerm and Kitty are praised for multiplexing, built-in SSH, keyboard hint selection (Quick Select / hints), image protocols and ligatures. Ghostty is praised for raw speed, a native macOS feel (native tabs and splits), battery-friendly rendering, the Quake-style Quick Terminal and plain-text config.

### Cited Findings

#### iTerm2 (macOS, the incumbent)
- The official feature list includes: split panes (inactive panes dimmed), hotkey window (a global keystroke brings iTerm2 forward, optionally as a dedicated always-available window), search with regex, autocomplete of previously seen words (Cmd-;), copy mode (keyboard selection), paste history (can be saved to disk), and Instant Replay ("rewinds the terminal to recover text that was erased") — [iTerm2 Features](https://iterm2.com/features.html)
- **Triggers**: actions that run when output matches a regex, such as highlighting words, auto-responding to prompts or sending notifications. Conduit's [PRESENT] keyword highlighting covers only the highlight action — [iTerm2 Features](https://iterm2.com/features.html)
- **Smart Selection**: recognizes URLs, emails and filenames under the cursor and selects the right span — [iTerm2 Features](https://iterm2.com/features.html)
- **Automatic Profile Switching** by SSH host, root user or current directory — [iTerm2 Features](https://iterm2.com/features.html)
- **Password Manager**: stores passwords encrypted in the macOS Keychain and enters them only at password prompts. iTerm2 3.5.0 (May 20, 2024) added LastPass and 1Password support — [iTerm2 Features](https://iterm2.com/features.html); [AlternativeTo news](https://alternativeto.net/news/2024/5/iterm2-v3-5-0-launches-with-chatgpt-integration-and-support-for-lastpass-and-1password)
- **Advanced Paste**: edit, base64-encode or otherwise transform text before pasting — [iTerm2 Features](https://iterm2.com/features.html)
- **Annotations** (notes attached to terminal text), **Badges** (username, hostname or custom data such as the git branch shown in the top right), **Timestamps** (last-modified time per line), **Tagged Profiles** (a searchable profile database for many hosts), **Global Search** across all tabs, and **Notification Center** alerts for activity, bells and job completion — [iTerm2 Features](https://iterm2.com/features.html)
- **Captured Output**: matches build warnings and errors with your regexes, lists them in the toolbelt, and can run a coprocess such as opening the file in an editor at the error line — [iTerm2 Features](https://iterm2.com/features.html)
- **Inline Images** through iTerm2's own escape sequence (IIP), including animated GIFs — [iTerm2 Features](https://iterm2.com/features.html)
- **Shell Integration**:
  - A blue-triangle mark at each prompt, with Cmd-Shift-Up/Down to jump between prompts.
  - Failed commands get a red mark, and right-clicking it shows the return code.
  - "Alert on next mark" (Cmd-Opt-A) raises an alert when a long command finishes.
  - Command history kept per user@host, with up to 200 commands per user/host persisted across restarts.
  - Recent directories sorted by "frecency", which can be starred.
  - "Select output of last command".
  - **Right-click a filename in `ls` output, then "Download with scp from hostname"**.
  - **Option-drag a Finder file into the terminal to upload it via scp** to the directory shown on that line.
  - Profiles switch automatically per host or user.
  - Since 3.5, it can load automatically on SSH.
  - If you can't install a login script on a host, you can use triggers instead (Report User & Host, Report Directory, Prompt Detected). The docs say: "Installing a login script on every host you connect to is not always an option."
  - It does not work with tmux or screen by default.
  - Source: [iTerm2 Shell Integration docs](https://iterm2.com/documentation-shell-integration.html)
- iTerm2 3.5.0 (May 20, 2024) added an OpenAI ChatGPT integration (Cmd-Y prompt window) to write commands and explain output. Users bring their own API key. It also added "Codecierge", a step-by-step project guide — [AlternativeTo news](https://alternativeto.net/news/2024/5/iterm2-v3-5-0-launches-with-chatgpt-integration-and-support-for-lastpass-and-1password); [Korben](https://korben.info/en/iterm2-ai-macos-terminal.html)
- tmux integration (`tmux -CC` control mode) is not described on the features page I fetched. On HN, a Ghostty user asked for "tmux control mode" on Linux, which is evidence that people want it — [HN Ghostty 1.0 thread](https://news.ycombinator.com/item?id=42517447)

#### Warp
- **Blocks**: "A Block groups commands and outputs into one atomic unit." Per-block actions: copy the command, copy the output, jump to the start of the output, re-input a previous command, share the command and output with formatting preserved, and bookmark. Related pages exist for Block find, Block filtering, Sticky Command Header, SSH with Warp features, Command Palette and YAML workflows — [Warp docs: Blocks](https://docs.warp.dev/terminal/blocks)
- A third-party review roundup says the most repeated praise is for the block-based UI, AI help with complex or forgotten commands, workflows, customization, and smoother navigation and history — [aicoolies Warp review](https://aicoolies.com/reviews/warp-review) (aggregator, weak source)
- A dev.to author says they kept coming back to Warp after repeatedly trying to switch away — [dev.to "underappreciation and rebirth of Warp"](https://dev.to/stevengonsalvez/the-underappreciation-and-rebirth-of-warp-9e8)
- On HN, a commenter (blondin) wants Ghostty to match Warp's block-based UI — [HN Ghostty 1.0 thread](https://news.ycombinator.com/item?id=42517447)
- **Open source (April 2026)**: Warp open-sourced its terminal client (GitHub warpdotdev/warp, blog post dated April 28, 2026). Most sources say the client is AGPL and the UI framework is MIT, but sources disagree on the exact date, the license details, and whether the Oz orchestration platform is included. The terminal is free. AI features use credits on paid tiers, with a $20/mo plan that allows your own API keys (as of May 2026) — [itsfoss](https://itsfoss.com/news/warp-goes-open-source.md); [devtoolpicks](https://devtoolpicks.com/blog/warp-open-source-indie-hackers-2026); [Wikipedia](https://en.wikipedia.org/wiki/Warp_(terminal)); [Kilo blog](https://blog.kilo.ai/p/warp-finally-went-open-source)

#### WezTerm
- **Multiplexing**: panes, tabs and windows can run on local or remote hosts. Remote multiplexers connect over SSH or TLS/TCP, local ones over Unix sockets. Also: ligatures, color emoji, font fallback, true color, dynamic color schemes, searchable scrollback, clickable hyperlinks, splits, tabs, a **built-in SSH client that opens connections in native tabs**, **serial port connections**, images (iTerm2 protocol with a built-in imgcat, Kitty graphics, experimental Sixel), and config that reloads when changed — [WezTerm features](https://wezterm.org/features.html)
- **Quick Select** (CTRL-SHIFT-SPACE): highlights matches for built-in patterns (URL and path fragments, git hashes, IP addresses, numbers) plus user regexes in `quick_select_patterns`. Each match gets a 1-2 character label. Typing the lowercase label copies the match. Typing the uppercase label copies and pastes it. Esc cancels — [WezTerm Quick Select](https://wezterm.org/quickselect.html)
- On HN, a commenter criticized WezTerm's tabs as emulated rather than native, and its Lua config got mixed reactions — [HN Ghostty 1.0 thread](https://news.ycombinator.com/item?id=42517447)

#### Kitty
- **Hints kitten**: keyboard-labeled selection of on-screen text.
  - Types: url (the default), hyperlink (OSC 8), path, linenum (path:line from error messages, opens in your editor at that line), line, word, hash, ip, and custom regex.
  - Actions: paste into the terminal, copy to the clipboard or primary selection, open with the default program, or launch in a new tab or window.
  - `--multiple` selects several matches.
  - Default bindings: ctrl+shift+e opens a URL; ctrl+shift+p then f inserts a path; then n opens file:line in the editor; then y opens a hyperlink.
  - Source: [kitty hints](https://sw.kovidgoyal.net/kitty/kittens/hints/)
- **SSH kitten**, highly relevant to an SSH client:
  - Turns on shell integration on the remote host automatically.
  - Copies your dotfiles and env vars and the kitty terminfo to the remote host.
  - `share_connections` reuses an SSH ControlMaster across windows, so you enter the password only once and setup is faster.
  - Can transfer files.
  - Sets a **per-host color scheme**.
  - `new_window_with_cwd` opens a new window on the same host in the same directory.
  - Caveat: keystrokes typed before the prompt appears may be lost.
  - Source: [kitty ssh kitten](https://sw.kovidgoyal.net/kitty/kittens/ssh/)

#### Ghostty
- **1.0 release**: December 2024, MIT license, after two years of private beta. Goal: "the best drop-in replacement for your current terminal emulator" on macOS and Linux — [Ziggit](https://ziggit.dev/t/terminal-emulator-ghostty-1-0-released/7533); [duncan.dev link](https://duncan.dev/link/ghostty-1.0)
- **Speed**: antirez said it printed half a million lines "in the blink of an eye" and called it a "game changer" for debugging — [HN Ghostty 1.0 thread](https://news.ycombinator.com/item?id=42517447)
- **Stability**: a beta tester "came for the performance but stayed for the stability" — [HN](https://news.ycombinator.com/item?id=42517447)
- **Native macOS feel**: native tabs beat the emulated tabs of WezTerm and Kitty, and you only need one config line to get started — [HN](https://news.ycombinator.com/item?id=42517447)
- **Battery**: one user had dropped Alacritty because it used the dedicated GPU. Mitchell Hashimoto described Ghostty's approach: vsync, the integrated GPU by default, background threads on efficiency cores, and slower rendering when the window is hidden — [HN](https://news.ycombinator.com/item?id=42517447)
- **Quick Terminal**: a Quake-style drop-down terminal (macOS-only at 1.0) that several commenters use — [HN](https://news.ycombinator.com/item?id=42517447). A switcher said the ability "to quickly toggle the terminal with a key command" sold them; others cite plain-text config that is easy to sync across machines and automatic light/dark theme switching — search-result summary of [yomotherboard Q&A](https://yomotherboard.com/question/what-are-the-benefits-of-using-ghostty-or-iterm2-compared-to-the-built-in-macos-terminal/), [batsov.com](https://batsov.com/articles/2025/03/14/updating-my-toolbox-ghostty-and-fish/) and [brandur.org](https://brandur.org/atoms/h7rdlr2) (exact attribution of each quote to each URL was not verified)
- **Shell integration**:
  - `jump_to_prompt` moves between prompts.
  - The cursor becomes a bar at the prompt.
  - **No close confirmation when the cursor is at a prompt**.
  - New terminals inherit the previous terminal's cwd.
  - Optional `sudo` wrapper that keeps Ghostty's terminfo.
  - **`ssh-env` / `ssh-terminfo`** wrap `ssh` so remote apps "work correctly". These are off by default.
  - Source: [Ghostty shell integration docs](https://ghostty.org/docs/features/shell-integration)
- **Ghostty 1.3 (March 9, 2026)**:
  - Scrollback search (Cmd+F, described as "highly requested").
  - Native overlay scrollbars ("highly requested").
  - **Click to move the cursor within a shell prompt**.
  - **Command-finished notifications** (bell or desktop notification, configurable by focus state, action and minimum duration).
  - Key tables / chained keybinds.
  - **Rich clipboard copy** (plain text plus HTML, with a `vt` option that keeps formatting).
  - AppleScript control (preview).
  - Drag-and-drop of splits.
  - A more complete OSC 133 implementation that improves prompt-jump accuracy.
  - Working-directory inheritance controls for tabs and splits ("among the most requested").
  - Source: [Ghostty 1.3.0 release notes](https://ghostty.org/docs/install/release-notes/1-3-0); [GIGAZINE](https://gigazine.net/gsc_news/en/20260404-ghostty-ui)

#### Windows Terminal
- **Quake mode**: a window named `_quake`, or the quakeMode action / `wt -w _quake`, snaps to the top half of the monitor, can only be resized from the bottom, and hides from the taskbar and Alt+Tab when minimized. v1.10 added a notification-area icon for it — [Microsoft Learn tips](https://learn.microsoft.com/el-gr/windows/terminal/tips-and-tricks); [v1.10 release](https://github.com/microsoft/terminal/releases/tag/v1.10.2383.0)
- **Panes**: split horizontally or vertically, duplicate the current profile, move focus, and resize with key bindings — [Microsoft Learn tips](https://learn.microsoft.com/el-gr/windows/terminal/tips-and-tricks)
- **Buffer and session restore (Preview 1.21, May 2024)**: the "Open windows from a previous session" option remembers screen contents and restores them on startup. Snapshots are stored as VT-encoded text in the app's local state directory, and Microsoft warns that portable installs need extra caution. 1.21 also added an experimental scratchpad pane and multiple font fallback — [Microsoft DevBlogs 1.21](https://devblogs.microsoft.com/commandline/windows-terminal-preview-1-21-release/); [Windows Report](https://windowsreport.com/windows-terminal-preview-1-21-restore-sessions-show-emojis/); [heise](https://heise.de/en/news/Windows-Terminal-Preview-1-21-bringt-einen-experimentellen-Notizblock-9716091.html)

### Inferences
- For an SSH client, the most transferable "delight" features come from iTerm2 shell integration (marks, alerts, scp download/upload from output, per-host profiles) and the Kitty ssh kitten (remote shell integration, ControlMaster reuse, per-host colors, new tab at the same host and directory). They solve SSH-specific pain that general-purpose terminals solve only partly.
- Warp's blocks and iTerm2's marks are the same idea at two levels of UI ambition: both depend on prompt boundaries (OSC 133-style marks). Conduit already has a custom prompt with exit code and OSC 7. Emitting OSC 133 A/B/C/D from that prompt would unlock prompt jumping, select or copy the last command's output, failed-command markers, notifications and a block-like UI (inference, building on [iTerm2 shell integration](https://iterm2.com/documentation-shell-integration.html) and [Ghostty 1.3 OSC 133 work](https://ghostty.org/docs/install/release-notes/1-3-0)).
- Keyboard hint selection (kitty hints, WezTerm Quick Select) is a small, well-defined feature that power users value highly. It can be built in xterm.js by scanning the visible buffer with regexes and drawing label decorations (unverified API hint: `terminal.buffer.active`, `registerDecoration`).

### Gaps
- I did not fetch iTerm2's tmux integration, Python API, status bar or Instant Replay docs. Their exact behavior comes from the features page or general knowledge only.
- Pages on Warp's input editor, command palette, workflows, AI/Agent Mode and Warpify-over-SSH were linked but not fetched. Feature details beyond Blocks are unverified here.
- Kitty's broadcast kitten, remote control and graphics protocol docs were not fetched.
- Hyper and macOS Terminal: I found no 2023-2026 sources on praised features in this session.

---

## Q2. Which features made people switch in 2023-2026, and what complaints recur?

### Takeaway
Switches are driven by speed and native feel (iTerm2 to Ghostty), simplicity and plain-text config, and the Quick Terminal toggle. Users move away from tools over account and login requirements (Warp), telemetry, AI features they did not opt into (Warp and iTerm2 3.5), and battery or GPU use (Alacritty). The lesson for Conduit: a local, no-login, no-telemetry-by-default app with any AI strictly opt-in is a selling point in itself.

### Cited Findings

#### Login and telemetry (Warp)
- When Warp first appeared on HN in 2021, the criticism was about trust and security: "Traditional computer terminals don't require logins; if users entered passwords into Warp, would the company sell their data" — [Sequoia spotlight](https://sequoiacap.com/article/warp-spotlight) (promotional source quoting the criticism)
- **Mandatory login was dropped around November 2024.** Users can skip login and still get core features, though Warp said some features might later be limited for logged-out users — [itsfoss](https://itsfoss.com/news/warp-terminal-no-login/); HN "no more login required" post (73 points, Nov 2024) per [plushcap HN tracker](https://www.plushcap.com/companies/warp/hacker-news/2023)
- Warp made telemetry optional and added a "network logging" workflow that shows what data is sent. It says terminal input and output are never sent unless you use a cloud feature such as Block Sharing — [Warp blog: telemetry now optional](https://www.warp.dev/blog/telemetry-now-optional-in-warp). The HN post was in December 2022 (56 points) per [plushcap](https://www.plushcap.com/companies/warp/hacker-news/2023). One report said telemetry was still on by default at the time of the no-login change — [itsfoss](https://itsfoss.com/news/warp-terminal-no-login/)
- An HN commenter claimed Warp makes 5 HTTP requests at startup (version check, LLM model list, 3 telemetry events). This is an unverified user claim — [hn.svelte.dev item 47945823](https://hn.svelte.dev/item/47945823)
- Recurring Warp complaints: forced sign-in and onboarding surveys, plus rough edges in autocomplete, subshell support, TTY compatibility, hotkeys, missing sync and team pricing — [aicoolies review](https://aicoolies.com/reviews/warp-review). An HN post about a pricing change (Oct 2025, 39 points) per [plushcap](https://www.plushcap.com/companies/warp/hacker-news/2023)
- A Twitter backlash summed up by a dev.to author called Warp closed source, full of sign-in friction, and "just another wrapped LLM with a terminal stuck on the front" — [dev.to](https://dev.to/stevengonsalvez/the-underappreciation-and-rebirth-of-warp-9e8)
- A Habr commenter argued that Warp lists features Terminal.app already has and mainly pushes its paid AI — [Habr comments](https://habr.com/en/articles/907898/comments)

#### AI backlash (iTerm2)
- After iTerm2 3.5.0 (May 2024) shipped ChatGPT integration, a Nostr commenter said at least two issues were opened "with comment upon comment demanding removal of the feature". They noted the feature was inactive without an OpenAI key — [njump/Nostr](https://njump.me/nevent1qqstwud2pwr4hfup3n3a5jkuwdcryel98sj7vke70crkc3fuueck2ugzyqm7wgfd30qu75l7jypgyw89ugzytlrdktxdn9w64sxreq9cxmu8zyh26pk). Another post just said "Ew." — [nostr.at](https://nostr.at/nevent1qqspx5havqp70swxfwsrf0cn4q6cazkn97rz8yesdvzadmr63au94xgzyq5ehp67qphc76qdjw4n3xt4cksa6n5wl773lfvxutsehh9387nexxhuhju)
- iTerm2 now ships AI as an **optional separately installed plugin**, "to ensure that there's no way to accidentally send information from the terminal over the network" — [iTerm2 AI Plugin page](https://iterm2.com/ai-plugin.html). Enterprise admins discussed how to disable iTerm2's AI features — [Jamf Community](https://community.jamf.com/general-discussions-2/disabling-ai-features-in-iterm2-56358)

#### Reasons for switching to Ghostty, and its shortcomings
- Users switching to Ghostty cite: frustration with iTerm2's "ever growing list of features" they never cared about, "it is FAST", plain-text config that is easy to sync, automatic light/dark theming, and the quick-toggle key — search-result summary across [batsov.com](https://batsov.com/articles/2025/03/14/updating-my-toolbox-ghostty-and-fish/), [yomotherboard](https://yomotherboard.com/question/what-are-the-benefits-of-using-ghostty-or-iterm2-compared-to-the-built-in-macos-terminal/), [hollo.social #Ghostty](https://hollo.social/tags/Ghostty) and [Medium "Ghostty is great but overhyped"](https://medium.com/@pthapa1/ghostty-is-a-great-but-overhyped-terminal-emulator-90a977ccfda9) (exact per-URL attribution unverified)
- The same summary lists Ghostty shortcomings against iTerm2: no hotkey windows, profile switching, triggers, paste history or Python scripting API, no "profiles", and mouse reporting can't be turned off. One user reported tmux pane freezes and higher power draw. These come from a search summary, so treat them as anecdotal — sources as above, plus [soloterm alternatives page](https://soloterm.com/alternatives/ghostty)
- On HN at the 1.0 launch, the top complaints were:
  - **No scrollback search** (asked for by antirez and others; it shipped in 1.3, March 2026).
  - The Quick Terminal had no tabs, didn't work over fullscreen apps, and had no height setting.
  - It needs accessibility permissions.
  - No Windows build.
  - The homepage doesn't explain what Ghostty is.
  - A cursor splits ligatures in half.
  - Source: [HN Ghostty 1.0 thread](https://news.ycombinator.com/item?id=42517447); [Ghostty 1.3 notes](https://ghostty.org/docs/install/release-notes/1-3-0)

#### Comparisons from the HN thread
- iTerm2 has the most features but is slower. Alacritty deliberately leaves out tabs. One user left Alacritty over dedicated-GPU battery drain — [HN](https://news.ycombinator.com/item?id=42517447)
- Commenters prefer native apps over Electron ones (relevant to Hyper, and to any Electron/xterm.js app) — [HN](https://news.ycombinator.com/item?id=42517447)
- Mitchell Hashimoto disputed a third-party benchmark, citing flaws in input-latency measurement and in macOS memory reporting. Another user saw no noticeable difference against Alacritty, Kitty or xterm. Performance claims are contested — [HN](https://news.ycombinator.com/item?id=42517447)

### Inferences
- Trust is a feature. No login, no telemetry by default, a visible network log, and AI that is off and separate unless you opt in are the patterns that ended the Warp and iTerm2 controversies. An SSH client handles credentials and remote output, so it should copy iTerm2's "separate plugin, no accidental network" stance and Warp's "show exactly what is sent" logging if it adds AI (based on [iTerm2 AI plugin](https://iterm2.com/ai-plugin.html) and the [Warp telemetry blog](https://www.warp.dev/blog/telemetry-now-optional-in-warp)).
- Conduit is built on xterm.js, so it inherits the "web tech is slower than a native GPU terminal" perception. Keeping memory and latency low (the WebGL renderer, scrollback limits), and having native-feeling macOS chrome (native tabs and splits, menus, the Quick Terminal) answers the main reasons people chose Ghostty (inference from the [HN thread](https://news.ycombinator.com/item?id=42517447)).
- Feature bloat is itself a complaint (iTerm2). New power features are better kept discoverable through a command palette or settings and off the default UI.

### Gaps
- I found no reliable quantitative data (surveys, market share) on switching between these terminals in 2023-2026.
- I could not confirm the exact iTerm2 GitLab issue numbers or vote counts for the AI-removal demands, or which version moved AI into the plugin.
- I found no specific 2023-2026 complaints about Hyper's performance or memory in this session (Electron-related criticism is implied only by the HN "native vs Electron" comment).
- I did not verify the exact date Warp telemetry became optional. The blog post is undated in my results, and the HN post date (Dec 2022) predates the 2024 itsfoss report that it was still on by default, so the default state over time is unclear.

---

## Q3. Which terminal UX features are now expected, and what is Conduit missing?

### Takeaway
Table stakes in 2026:
- split panes
- searchable scrollback [PRESENT]
- clickable URLs and OSC 8 hyperlinks
- prompt marks with jump-to-prompt and command status
- notification when a long-running command finishes (iTerm2, and Ghostty 1.3 natively)
- keyboard hint selection (Kitty, WezTerm)
- inline images (iTerm2 IIP, Kitty, Sixel)
- a hotkey or Quake drop-down window (iTerm2, Ghostty, Windows Terminal)
- session and buffer restore (Windows Terminal 1.21)

The SSH-specific delights are scp download/upload from output, per-host profiles and colors, automatic remote shell integration and terminfo, and connection reuse. xterm.js ships an image addon (Sixel and IIP in beta, Kitty in alpha), so image support is feasible today.

### Cited Findings
- Searchable scrollback was missing from Ghostty 1.0 and was the top complaint at launch. It shipped in 1.3 as "highly requested". Conduit [PRESENT] — [HN](https://news.ycombinator.com/item?id=42517447); [Ghostty 1.3](https://ghostty.org/docs/install/release-notes/1-3-0)
- Command-finish notifications: iTerm2's "Alert on next mark" and Notification Center job-completion alerts, and Ghostty 1.3's configurable notifications (by focus state and minimum duration) — [iTerm2 shell integration](https://iterm2.com/documentation-shell-integration.html); [iTerm2 Features](https://iterm2.com/features.html); [Ghostty 1.3](https://ghostty.org/docs/install/release-notes/1-3-0)
- Prompt marks and jump-to-prompt: iTerm2 (Cmd-Shift-Up/Down, red marks on failure) and Ghostty (`jump_to_prompt`, improved OSC 133 in 1.3) — [iTerm2 shell integration](https://iterm2.com/documentation-shell-integration.html); [Ghostty shell integration](https://ghostty.org/docs/features/shell-integration)
- Split panes are standard in iTerm2, WezTerm, Windows Terminal and Ghostty (native splits, drag-and-drop of splits in 1.3). Alacritty is the outlier: it deliberately omits tabs — [iTerm2 Features](https://iterm2.com/features.html); [WezTerm features](https://wezterm.org/features.html); [MS Learn](https://learn.microsoft.com/el-gr/windows/terminal/tips-and-tricks); [Ghostty 1.3](https://ghostty.org/docs/install/release-notes/1-3-0); [HN](https://news.ycombinator.com/item?id=42517447)
- Quick select and hints: Kitty hints and WezTerm Quick Select, with defaults for URLs, paths, git hashes, IPs and numbers, plus file:line opened in the editor — [kitty hints](https://sw.kovidgoyal.net/kitty/kittens/hints/); [WezTerm Quick Select](https://wezterm.org/quickselect.html). iTerm2's mouse equivalent is Smart Selection — [iTerm2 Features](https://iterm2.com/features.html)
- Clickable hyperlinks: WezTerm, and Kitty's `hyperlink` hint type for OSC 8 output such as `ls --hyperlink=auto` — [WezTerm features](https://wezterm.org/features.html); [kitty hints](https://sw.kovidgoyal.net/kitty/kittens/hints/)
- Images: iTerm2 (IIP, animated GIF) and WezTerm (IIP, Kitty, experimental Sixel) — [iTerm2 Features](https://iterm2.com/features.html); [WezTerm features](https://wezterm.org/features.html)
- **xterm.js `@xterm/addon-image`**: supports SIXEL (on by default, 256-color palette by default, up to 4096), iTerm IIP (PNG, JPEG, GIF, QOI, WEBP, AVIF; no animation; limited hi-DPI support, so images blur), and Kitty graphics ("still WIP", "alpha stage").
  - Sixel and IIP are "considered beta quality".
  - Options: `pixelLimit` (16M pixels per image), `storageLimit` (MB, FIFO eviction), `showPlaceholder`, and per-protocol size limits.
  - Limits: text drawn over an image erases it, there is no transparency compositing, and reflow on resize can split images.
  - Source: [xterm.js addon-image README](https://github.com/xtermjs/xterm.js/tree/master/addons/addon-image)
  - VS Code's terminal uses this addon behind `terminal.integrated.enableImages` (since v1.80) — [opentui issue #92](https://github.com/anomalyco/opentui/issues/92) (secondary source)
- Hotkey / Quake window: iTerm2 Hotkey Window, Ghostty Quick Terminal, and Windows Terminal quake mode — [iTerm2 Features](https://iterm2.com/features.html); [HN](https://news.ycombinator.com/item?id=42517447); [MS Learn](https://learn.microsoft.com/el-gr/windows/terminal/tips-and-tricks)
- Session and buffer restore: Windows Terminal 1.21 restores buffer contents, stored as VT text on disk with a security caution. iTerm2 persists command history to disk (200 per user/host) — [MS DevBlogs](https://devblogs.microsoft.com/commandline/windows-terminal-preview-1-21-release/); [iTerm2 shell integration](https://iterm2.com/documentation-shell-integration.html)
- Broadcast input: iTerm2 has it (not covered by my fetched pages). For Windows Terminal I found no documentation in this session. Conduit [PRESENT] at tab level — see Gaps
- Smaller quality-of-life features that users explicitly call out:
  - No close confirmation when at a prompt — [Ghostty shell integration](https://ghostty.org/docs/features/shell-integration)
  - New tab or split inherits cwd, which was "among the most requested" in Ghostty — [Ghostty 1.3](https://ghostty.org/docs/install/release-notes/1-3-0)
  - Click to move the cursor in the prompt — [Ghostty 1.3](https://ghostty.org/docs/install/release-notes/1-3-0)
  - Rich HTML copy — [Ghostty 1.3](https://ghostty.org/docs/install/release-notes/1-3-0)
  - Paste history and Advanced Paste — [iTerm2 Features](https://iterm2.com/features.html)
  - Instant Replay — [iTerm2 Features](https://iterm2.com/features.html)
  - Timestamps per line — [iTerm2 Features](https://iterm2.com/features.html)
  - Dimmed inactive panes — [iTerm2 Features](https://iterm2.com/features.html)
  - Auto light/dark theme — [batsov.com et al.](https://batsov.com/articles/2025/03/14/updating-my-toolbox-ghostty-and-fish/)
  - Config auto-reload — [WezTerm](https://wezterm.org/features.html)
  - Serial port connections for embedded work — [WezTerm](https://wezterm.org/features.html)

### Inferences

#### Prioritized wishlist for Conduit (missing features only; "Have it" = who ships it)

| # | Feature | Have it | Why users like it (evidence) | Feasibility hint for xterm.js/macOS |
|---|---|---|---|---|
| 1 | **Split panes** (h/v, dim inactive, drag to rearrange) | iTerm2, WezTerm, Ghostty, WinTerm, Kitty | Universal expectation. Alacritty is criticized for leaving out even tabs ([HN](https://news.ycombinator.com/item?id=42517447)) | One xterm.js `Terminal` per pane in a layout tree; each pane has its own SSH channel. Existing broadcast can extend to "broadcast to panes in tab" |
| 2 | **OSC 133 prompt marks**: jump to previous/next prompt, red marker on failed command, select/copy last output | iTerm2, Ghostty, Warp (blocks) | iTerm2 marks and Ghostty prompt jumping; Warp blocks are the most-praised Warp UX ([iTerm2](https://iterm2.com/documentation-shell-integration.html), [Warp](https://docs.warp.dev/terminal/blocks)) | Conduit already injects a custom prompt with exit code, so emit OSC 133 A/B/C/D there. Parse with `parser.registerOscHandler(133)` and draw gutter marks with `registerMarker`/`registerDecoration` (unverified API hint) |
| 3 | **Notify when a long command finishes** (macOS notification if unfocused, min-duration threshold) | iTerm2, Ghostty 1.3 | Ghostty made it a headline 1.3 feature ([notes](https://ghostty.org/docs/install/release-notes/1-3-0)) | Uses the OSC 133 C to D timing from #2. Also honor OSC 9 / OSC 777 notify sequences and BEL (unverified API hint) |
| 4 | **Quick Select / hints** (keyboard labels over URLs, paths, hashes, IPs; copy, paste or open) | Kitty, WezTerm; iTerm2 Smart Selection (mouse) | Power-user favorite ([kitty](https://sw.kovidgoyal.net/kitty/kittens/hints/), [WezTerm](https://wezterm.org/quickselect.html)) | Regex over the visible buffer lines, then overlay labels as decorations or an HTML layer |
| 5 | **Clickable URLs, OSC 8 hyperlinks, file:line paths** | WezTerm, Kitty, iTerm2 | Expected baseline | `@xterm/addon-web-links` plus the built-in OSC 8 `linkHandler`. For remote paths, offer "download via SFTP" or "open in editor" (unverified API hint) |
| 6 | **scp/SFTP download from output, drag-and-drop upload to cwd** | iTerm2 shell integration; Kitty transfer | Unique to SSH workflows ([iTerm2](https://iterm2.com/documentation-shell-integration.html)) | Conduit owns the SSH session and knows the remote cwd from OSC 7, so it can open an SFTP channel on the same connection with no extra login. A strong differentiator |
| 7 | **Per-host profiles and colors** (auto-switch by host/user, e.g. red background for prod) | iTerm2 APS, Kitty ssh `color_scheme` | Prevents mistakes on production hosts ([iTerm2](https://iterm2.com/features.html), [kitty ssh](https://sw.kovidgoyal.net/kitty/kittens/ssh/)) | Conduit knows the host at connect time, which is easier than in a local terminal. Badges (host/branch watermark) are a cheap add-on |
| 8 | **Hotkey / Quick Terminal** (global shortcut, slide-down window) | iTerm2, Ghostty, WinTerm | A stated reason people switch ([HN](https://news.ycombinator.com/item?id=42517447)). Ghostty users asked for tabs inside it and for it to work over fullscreen apps | Global hotkey plus a panel window in Electron/Tauri/native shell. Support tabs inside it from day one |
| 9 | **Session and buffer restore** (reopen tabs/splits, reconnect, restore scrollback) | WinTerm 1.21, iTerm2 (partial) | Expected after app or OS restarts ([MS DevBlogs](https://devblogs.microsoft.com/commandline/windows-terminal-preview-1-21-release/)) | `@xterm/addon-serialize` can snapshot buffers (unverified API hint). Encrypt at rest or make it opt-in: SSH scrollback may contain secrets, the same caution Microsoft gives |
| 10 | **Inline images** (Sixel, IIP, Kitty) | iTerm2, WezTerm, Kitty, Ghostty, VS Code | Needed for imgcat, plotting, TUI image previews | `@xterm/addon-image`: Sixel and IIP are beta, Kitty is alpha. Set `storageLimit` and `pixelLimit`. Hi-DPI images blur ([README](https://github.com/xtermjs/xterm.js/tree/master/addons/addon-image)) |
| 11 | **Triggers beyond highlighting** (regex triggers auto-respond, notify, capture errors) | iTerm2 | iTerm2's signature power feature ([features](https://iterm2.com/features.html)) | Extend the existing keyword-highlight engine with more actions. Auto-respond must be guarded, since it is risky over SSH |
| 12 | **Password / secret manager integration** (Keychain, 1Password; type only at password prompts) | iTerm2 | Very relevant to SSH sudo prompts ([features](https://iterm2.com/features.html)) | Store secrets in the macOS Keychain. Detect password prompts with a regex or the echo-off state |
| 13 | **Automatic remote shell integration and terminfo** | Kitty ssh kitten, Ghostty ssh-terminfo, iTerm2 3.5 auto-load | Makes remote apps "work correctly", with no per-host setup ([kitty](https://sw.kovidgoyal.net/kitty/kittens/ssh/), [Ghostty](https://ghostty.org/docs/features/shell-integration)) | Conduit already injects a prompt, so make it robust and offer a trigger-based fallback when nothing can be installed (iTerm2 pattern) |
| 14 | **Connection reuse and "new tab at same host+cwd"** | Kitty `share_connections`, `new_window_with_cwd` | Enter the password once and get faster tabs | Multiplex new channels over the existing SSH connection, and `cd` to the OSC 7 cwd |
| 15 | **Command palette** | Warp, WinTerm, Ghostty (keybinding actions) | Keeps power features discoverable without bloat (the iTerm2 complaint) | Fuzzy list over all actions, snippets [PRESENT] and hosts |
| 16 | **Opt-in AI** (explain error, suggest command), separate, BYO key, nothing sent by default | iTerm2 plugin, Warp | Some users like it, and the loud backlash is against default-on or bundled AI ([iTerm2 AI plugin](https://iterm2.com/ai-plugin.html), [Nostr](https://njump.me/nevent1qqstwud2pwr4hfup3n3a5jkuwdcryel98sj7vke70crkc3fuueck2ugzyqm7wgfd30qu75l7jypgyw89ugzytlrdktxdn9w64sxreq9cxmu8zyh26pk)) | Off by default. Send only a selected block or the last command and its output. Show the payload before sending |
| 17 | Small polish | iTerm2, Ghostty | See findings above | Cheap individually |

Row 17 covers:
- no close confirmation when at an idle prompt
- click to move the cursor in the prompt
- Instant Replay
- paste history
- Advanced Paste (base64 etc.)
- per-line timestamps
- dimmed inactive panes
- automatic light/dark theme
- rich HTML copy
- serial-port sessions

#### Positioning notes
- Conduit's [PRESENT] features already cover parts of several "power" features: keyword highlighting is a slice of triggers, snippets cover Warp workflows and iTerm2 snippets, the command history panel matches iTerm2 command history, and broadcast input matches iTerm2 broadcast. The biggest wins are infrastructure features that unlock several others at once: OSC 133 marks (#2, #3, blocks, AI context), split panes (#1), and the SFTP side-channel (#6, #5).
- "Native feel plus speed plus no login/telemetry" is a reason people switch. Conduit should state that it needs no account and collects no telemetry, and keep AI as an add-on.

### Gaps
- Broadcast input in Windows Terminal, and Kitty's broadcast kitten: not verified in this session.
- I found no GitHub issue vote counts in this session (e.g., the most-upvoted Ghostty, WezTerm or Windows Terminal feature requests). Ghostty's notes call scrollback search, scrollbars and cwd inheritance "highly/most requested" but give no counts.
- Whether Ghostty's Quick Terminal gained tabs or Linux support after 1.0 was not verified.
- The xterm.js API hints (`registerOscHandler`, `registerMarker`/`registerDecoration`, `addon-serialize`, `addon-web-links`, OSC 8 `linkHandler`) come from general knowledge of the xterm.js API, not from sources fetched this session. Verify them against the current xterm.js docs.
- macOS Terminal.app and Hyper: there was no 2023-2026 evidence on praised or missing features, so they could not be included in the comparison.
