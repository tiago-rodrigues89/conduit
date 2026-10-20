# Changelog

Versions follow [semantic versioning](https://semver.org): new features raise the middle number, fixes the last one.

## 1.9.0
- Merge tabs: drag a tab onto the middle of another tab (it shows “split”), or onto a side of the visible terminal — both end up side by side. Nothing restarts: connections, screens and folders stay as they were
- Unsplit: right-click the tab → “Unsplit: Every Pane Back to Its Own Tab” (⌥⌘U) — all panes become tabs again and keep running. “Close Other Panes” (⌥⌘W) stays available
- ⇱ after a pane's name moves just that pane back to its own tab; × still closes it
- Dragging a tab no longer switches to it, and hovering a tab while dragging switches to that tab
- Dropping a session from the sidebar onto a tab opens it next to that tab's terminal

## 1.8.0
- Drag a session from the sidebar onto a terminal to open it as a split: the half you drop on (left, right, top, bottom) is where it opens, with a preview while dragging
- Drag a tab onto another tab's terminal to move it in as a split pane (SSH keeps its connection, no new login; same folder)
- Builds are signed with the local "Conduit Local Signing" certificate, so the keychain question stays answered across updates

## 1.7.0
- Undo splits: “Back to One Pane” in the tab's right-click menu, the terminal's right-click menu and Window → Close Other Panes (⌥⌘W) keeps the pane you are in and closes the others
- A × after each pane's name closes just that pane (3 panes → 2)

## 1.6.0
- Custom themes (Settings → Appearance → Customize…): your own copy of any preset with a picture or gradient behind the text, every color editable (text, cursor, selection, app accent, all 16 terminal colors). The presets stay as they are
- Pictures: fill, fit, center or tile, visibility and blur; HEIC pictures (e.g. the macOS wallpapers) are converted automatically

## 1.5.1
- Compose bar: the target picker stays open while you tick several terminals (Done, Esc or a click outside closes it); the button shows the picked terminal's name or how many are picked

## 1.5.0
- Split panes: ⌘D right, ⇧⌘D down, ⌥⌘arrows to move, ⇧⌘↩ to maximize, drag the dividers. An SSH split opens a new shell on the same connection (no second login) in the same folder
- Button bar under the terminal (SecureCRT-style): one-click commands, several bars (e.g. Linux, Cisco), per-session bar, ⌥-click sends to all panes
- Compose bar (⇧⌘E, hidden by default): write a command and send it to this terminal, all panes of the tab, all terminals or picked ones
- Session logging to files: off by default, per session or by hand (⌥⌘L), clean text or raw, optional timestamps, own folder and file name pattern
- Triggers (notify, mark the tab, type an answer) and per-session login scripts (wait for text → type answer)
- Workspaces: named sets of sessions in tabs and splits, opened from Home or automatically at start
- Export/import backup (passwords only inside a passphrase-encrypted file), export SSH sessions as OpenSSH config
- Sync between Macs without an account: one encrypted file in iCloud Drive, Dropbox or any folder
- Duplicate Tab moved to ⌥⌘D; ⌘W closes the focused pane of a split tab, ⇧⌘W the whole tab

## 1.4.0
- Home screen redesigned as a keyboard-first launcher (search sessions, `user@host`, actions), pinned and recent sessions
- Server monitoring: responsive status bar, hover card with CPU/network graphs, memory, swap, disk
- Fixes: byte values below 1 KB were not rounded; status bar buttons could be pushed out of narrow windows
- Build signs with a local "Conduit Local Signing" certificate when present (keychain prompt stays away across updates)

## 1.3.0
- Server monitoring in the status bar (OS, CPU, RAM, disk, network, uptime)
- Command history panel (this session + server history)
- Sidebar follows the tabs (Files for SSH, Sessions for Home), manual choice remembered per tab

## 1.2.0
- Saved logins (credentials) shared by many sessions
- Show-password buttons, saved passwords revealed after Touch ID
- New prompt styles without the box (Conduit, Frame, Minimal)
- "Browse as root (sudo)" in the Files panel, "Go there / Follow" bar

## 1.1.0
- MobaXterm-style session tree with "User sessions" root, folder icons and colors, Move To
- New-session wizard with templates: SSH, SFTP, Local shell, Telnet, Serial, RDP, VNC, AWS EC2, AWS SSM, Command
- Conduit prompt for local shells and SSH servers

## 1.0.0
- First version: SSH terminal, SFTP panel and dual-pane browser, sessions in folders, highlighting, tunnels, importers
