# Emerging and Differentiating Features in SSH Clients and Terminals (2024-2026)

Scope note: Conduit, a macOS SSH client, already has Keychain-encrypted credentials with Touch ID reveal, ssh-agent support, jump hosts, port forwarding, AWS SSM sessions, command sessions (e.g. docker exec), server monitoring, snippets, command history, and no account or cloud. These notes focus on features Conduit lacks. Research date: Oct 2026. Vendor marketing and competitor-written pages are flagged where they are the only source.

---

## 1. AI in terminals and SSH clients: which features are used and liked, and what are the concerns?

### Takeaway
AI in terminals has become common, as natural-language-to-command, "explain this output/error", and agent modes that run commands after you confirm. The strongest pattern is how the industry has reacted to backlash. iTerm2, Warp and Termius all got pushback on privacy (terminal output going to a cloud LLM), on having AI on by default, and on requiring a login. The products that came out best make AI opt-in and off by default, let you bring your own key or run local models, and use fine-grained Never/Ask/Always permissions. iTerm2 even moved its AI networking into a separately installed plugin. I found no usage numbers that rank which AI features people use most.

### Cited Findings

**iTerm2 (most relevant macOS precedent)**
- iTerm2 3.5.0 (May 2024) added OpenAI ChatGPT integration to write commands from natural language and interpret output. It required the user's own OpenAI API key. The same release added LastPass and 1Password integration. — [AlternativeTo news, May 2024](https://alternativeto.net/news/2024/5/iterm2-v3-5-0-launches-with-chatgpt-integration-and-support-for-lastpass-and-1password)
- Backlash: a May 2024 post said the release was well received overall, but people were angry about the AI feature. At least two GitHub/GitLab issues filled with comments demanding its removal, even though it was opt-in and inactive without an API key. — [Nostr post](https://nostr.at/nevent1qqspx5havqp70swxfwsrf0cn4q6cazkn97rz8yesdvzadmr63au94xgzyq5ehp67qphc76qdjw4n3xt4cksa6n5wl773lfvxutsehh9387nexxhuhju)
- HN thread "iTerm2 removes AI feature from core, creates separate plugin" (104 points). Arguments against:
  - the mere presence of code able to send commands to a third party is the problem;
  - restrictive employers would have banned iTerm2 if AI stayed in core;
  - some users wanted a binary with no AI capability at all, not just a buried flag.
  Defenders said it was off by default and that LLMs are genuinely good at untangling arcane shell scripting. — [HN mirror, item 40458135](https://hn.svelte.dev/item/40458135)
- Another HN commenter's view: the feature was "unconfigured" rather than clearly disabled, and it should have had an explicit, visible off toggle. — [HN comments](https://news.ycombinator.com/threads?id=eriri)
- iTerm2's AI Plugin is a separate app dropped into /Applications (iTermAI 1.1). It exists so that terminal data cannot be sent over the network by accident. — [iTerm2 AI Plugin page](https://iterm2.com/ai-plugin.html)
- iTerm2 3.6 added "AI Chat":
  - **Linking:** a chat sees nothing until you link a session to it.
  - **Permissions:** 8 categories (Check Terminal State, Run Commands, View Contents, Control Terminal, View Manpages, Write to Clipboard, Write to File System, Act in Web Browser), each set to Never, Ask or Always. Default is deny, and the model is not even offered the functions for denied categories.
  - **Explain Output:** "Explain Output with AI" annotates terminal output inline.
  - **Providers:** OpenAI-compatible presets for Ollama, OpenRouter, z.ai, Qwen and MiniMax, plus local or LAN models over plain HTTP.
  - **Safety:** command-safety checks run on a cheap "economy" model or on Apple Intelligence.
  - **Retention:** an OpenAI Zero Data Retention option.
  — [iTerm2 AI Chat docs](https://iterm2.com/documentation-ai-chat.html); [Dev.to walkthrough with Azure OpenAI](https://dev.to/vlad_iliescu/using-iterm2s-new-ai-chat-features-with-azure-openai-87f)
- iTerm2 3.7 (Sep 10, 2026):
  - an "orchestration" AI chat that can view all sessions and act on the user's behalf, but must ask before typing into a session or opening one;
  - Claude Code session status on tabs (subtitle, color, dot), reported through a control sequence, the `it2` CLI or triggers;
  - a Workflows feature for diffs and code review;
  - tab groups;
  - a session archive that saves and restores scrollback;
  - a screenshot tool with redaction;
  - the iOS companion app "iTerm2 Buddy", paired by QR code over an encrypted relay.
  — [AlternativeTo news, Sep 2026](https://alternativeto.net/news/2026/9/iterm2-3-7-released-with-ios-companion-app-claude-code-integration-tab-groups-and-more/)

**Warp**
- In Nov 2024 Warp dropped its mandatory login after requests from "hundreds of developers". The login had been justified by team features and by preventing AI abuse and managing AI cost per user. Warp warned that some features might later be gated behind login. — [Warp blog: Lifting the login requirement](https://www.warp.dev/blog/lifting-login-requirement); [OMG! Ubuntu](https://www.omgubuntu.co.uk/2024/11/warp-ai-terminal-login-change); [It's FOSS](https://itsfoss.com/news/warp-terminal-no-login/)
- HN post "Warp sends a terminal session to LLM without user consent", about Aug 2025 (dated from the page's relative timestamp):
  - **What happened:** Warp's "Prompt Suggestions" and "Next Command" features proactively sent errors, inputs and outputs to LLMs. The poster called it a breach of trust and uninstalled Warp.
  - **Commenter reactions:** rotate any secrets you typed into Warp; companies ban such tools; such features should be off by default or warn clearly. Others noted the features can be disabled, and some accepted the tradeoff for productivity.
  - **Alternatives suggested:** Ghostty, Wave, and offline terminals.
  — [HN mirror, item 44953470](https://hn.nuxt.dev/item/44953470)
- Warp 2025 stats:
  - "tens of trillions" of LLM tokens processed;
  - 96%+ acceptance of agent-suggested diffs;
  - 20+ models supported;
  - Warp 2.0 repositioned as an "Agentic Development Environment".
  These are coding metrics; no SSH usage data was given. — [Warp 2025 in review](https://warp.dev/blog/2025-in-review)
- Warp's pricing overhaul (late 2025):
  - **New plans:** a single $20/mo "Build" plan with 1,500 AI credits, roll-over/reload credits, and BYOK for OpenAI, Anthropic and Google keys. A Max tier at $200/mo appeared later.
  - **Complaints:** credits run out fast under heavy agent use; repeated pricing changes; the account requirement.
  — [Tessl](https://tessl.io/blog/warp-joins-the-pricing-pivot-sweeping-ai-developer-tools); [HackerNoon](https://sia.hackernoon.com/warp-scraps-tiered-plans-as-ai-coding-tools-face-pricing-reckoning); [Implicator](https://www.implicator.ai/warp-turns-the-terminal-into-an-agent-platform-at-200-a-month/); [Stackpick review (secondary)](https://stackpick.net/tools/warp/)

**Wave Terminal (open source)**
- Wave AI supports BYOK presets (OpenAI, OpenRouter, Groq, Google, Azure, custom) and local models via Ollama, LM Studio and vLLM on OpenAI-compatible localhost endpoints. — [Wave AI modes docs (v0.13)](https://docs.waveterm.dev/waveai-modes); [Wave blog: BYOLLM](https://blog.waveterm.dev/introducing-byollm)
  - **Key storage:** API keys go in Wave's secret store, which uses the OS keychain.
  - **Hiding cloud:** `waveai:showcloudmodes=false` hides Wave's own cloud modes.
  - **Telemetry:** Wave AI "normally requires telemetry". Setting a local/BYOK default mode avoids the telemetry prompt (added in v0.13.1).
  - **Tools:** a `tools` capability lets the model read and write files and use shell integration.

**Termius (closest direct competitor)**
- **AI command generation:** part of Autocomplete (beta in 2023). You describe a task and get a command on the input line.
  - Termius sends context with the request: protocol, OS/distro, shell and host tags.
  - Conversion happens in the cloud, and Termius "aggregates" command descriptions to improve the feature.
  — [Termius blog, Jun 2023](https://termius.com/blog/boost-your-terminal-experience-with-ai); [Termius autocomplete docs](https://docs.termius.com/terminal/autocomplete-and-shell-integration)
- **Pricing:** AI-powered autocomplete is included in the free Starter tier. — [Termius pricing](https://termius.com/pricing)
- **AI Agent (closed beta, Nov 12, 2024):** a chat agent that runs commands across multiple hosts.
  - It can see hosts, groups, tags, active connections and their output.
  - Termius says it never has access to passwords or keys and never runs a command without confirmation.
  — [Termius blog: AI Agent](https://termius.com/blog/ai-agent)
- **iOS opt-out:** an option hides the AI widget above the iOS keyboard, so some users want it out of the way. — [Termius FAQ](https://docs.termius.com/help-center/faq/how-can-i-hide-the-ai-widget)
- **Third-party guide (competitor-written, Aug 2026):** describes AI snippet generation and an experimental "Gloria" DevOps agent, and says AI command generation needs a Termius account. Treat as unverified. — [termai.sh](https://termai.sh/blog/termius-ai-assistant)
- **Home-lab reviewer (May 2026):** liked that AI autocomplete works without configuring an API key. — [Virtualization Howto](https://www.virtualizationhowto.com/2026/05/i-tried-termius-for-my-home-lab-and-replaced-my-ssh-client/)

**Electerm / Tabby (open source, cross-platform)**
- Electerm's AI assistant:
  - suggests commands, writes scripts, explains selected terminal output, and creates bookmarks and themes;
  - has an agent mode that runs terminal operations;
  - supports OpenAI Chat Completions, OpenAI Responses and Anthropic Messages API formats;
  - adds an MCP widget for external tools.
  — [electerm GitHub](https://github.com/electerm/electerm)
- Tabby has no built-in AI. A community `mcp-server` plugin exposes Tabby to MCP clients (Cursor, Windsurf), and one directory counts 34 MCP tools covering sessions, tabs, SSH profiles and SFTP. — [Tabby GitHub](https://github.com/Eugeny/tabby); [Glama MCP listing](https://glama.ai/mcp/servers/@thuanpham582002/tabby-mcp-server/blob/1407bd38184b7cdc47a296e68e6eb0b879cec6b5/README.md)

**No-AI positioning**
- Ghostty is marketed by others as "a terminal, full stop": no AI, no account, MIT licensed, about 59.7k GitHub stars. These are competitor and vendor comparison pages. — [crystl.dev](https://crystl.dev/compare/warp-vs-ghostty/); [soloterm](https://soloterm.com/alternatives/ghostty)

**New Apple-platform AI SSH apps (2025-2026)**
- NaviTerm AI (iOS/macOS, v5.5.2 Oct 2026):
  - **Cloud models:** OpenAI, Claude, Gemini, Grok via OAuth or API key.
  - **Local models:** Ollama and MLX on Apple Silicon.
  - **Terminal AI:** explains output, generates commands from natural language, fixes syntax; agent with MCP tools.
  - **Privacy label:** "Data Not Collected".
  - **SSH features:** iCloud sync, Mosh (v5.0) and auto tmux attach (v4.5).
  - **Pricing:** free for 5 hosts, $9.99/yr or $49.99 lifetime.
  — [App Store](https://apps.apple.com/au/app/id6747072398)
- ChatSSH says its planner runs on an on-device model. It claims passwords, keys and terminal history never enter the AI request, and that output stays in the terminal rather than in the chat. — [AppsHunter listing](https://appshunter.io/ios/ssh-terminal-and-sftp-chatssh/id6793575266)
- pH7Console: a macOS terminal built around a local model, with no telemetry or cloud calls claimed. — [x-cmd listing](https://x-cmd.com/install/ph7console)
- Caveat: wiring a local model into an app doesn't guarantee data stays local, because the app itself can still route data out. — [memx.app](https://memx.app/blog/run-llms-locally-ollama-offline-privacy/)

**On-device AI available to a native macOS app**
- Apple's Foundation Models framework (macOS 26 / iOS 26) gives third-party apps the on-device Apple Intelligence LLM from Swift (LanguageModelSession / respond(to:)).
  - It is unavailable on ineligible devices, with Apple Intelligence off, or while the model downloads.
  - The on-device context budget is about 4K tokens, shared by prompt and response.
  — [Cult of Mac](https://www.cultofmac.com/news/apple-foundation-models-framework); [Blake Crosley](https://blakecrosley.com/blog/foundation-models-on-device-llm); [Kodeco](https://www.kodeco.com/53631607-getting-started-with-apple-s-foundation-models)
- iTerm2 already uses Apple Intelligence as one option for its command-safety checks. — [iTerm2 AI Chat docs](https://iterm2.com/documentation-ai-chat.html)

**AI coding agents running inside terminals and over SSH (2025-2026)**
- Terminals don't agree on agent "done/waiting" notifications:
  - OSC 9: iTerm2, WezTerm, Windows Terminal (and Ghostty once its notifications option is on);
  - OSC 777: Ghostty, Warp;
  - OSC 99: Kitty.
  — [agentpatterns.ai](https://agentpatterns.ai/tool-engineering/terminal-sequence-hook-notifications/)
- Claude Code's auto-notifications originally targeted iTerm2 only, by checking TERM_PROGRAM; Ghostty support was resolved Apr 2026. A Jul 2025 bug said OSC 9 notifications didn't arrive over SSH. Users work around it with hook scripts that print OSC sequences. Some clients swallow these sequences: AbsoluteTelnet dropped OSC 777. — [Claude Code issue 41484](https://github.com/anthropics/claude-code/issues/41484); [claudeissues 3399](https://claudeissues.com/issue/3399-bug-notification-event-doesnt-work-over-ssh-with-macos); [Celestial forum](https://www.celestialsoftware.net/community/configurationissues/absolutetelnet-claude-code-a-notification-sound-unique-to-claude-32-bit-at-only-it-relies-on-vb-scripting/); [Simon Alford setup](https://simonalford.substack.com/p/my-setup-for-claude-code-codex-notifications)

### Inferences
- **Features with traction:** across many products, the AI features that keep appearing are:
  - natural language to command, inserted into the input line and never auto-run;
  - "explain selected output/error";
  - an agent mode where every command needs confirmation.
  Agents that act across several hosts (Termius Agent, iTerm2 orchestration) are newer and still beta.
- **What to avoid:** the clearest backlash triggers are cloud-by-default, proactive sending of output (Warp), AI shipped in core where corporate IT sees it (iTerm2), mandatory login, and per-credit pricing. Conduit's "no account, no cloud" position is a real differentiator that AI must not undermine.
- **Lowest-risk design for Conduit:**
  - AI off by default, with a clear master switch (ideally a separate plugin, extension or build, like iTerm2);
  - providers in order: Apple Foundation Models on-device first, then local Ollama/LM Studio, then BYOK cloud keys stored in Keychain;
  - per-session Never/Ask/Always permissions like iTerm2;
  - never send credentials, and optionally redact secrets from output before sending;
  - always show the prompt/context that will be sent.
  The 4K token on-device limit suits "explain this error" and "write this command" but not long-scrollback analysis.
- **Agent-friendly terminal:** a cheap, non-AI differentiator is to pass through OSC 9/777/99 notifications (including from remote sessions and tmux) to macOS notifications, and to show per-tab agent status, because many users now run Claude Code or Codex on remote boxes over SSH.
- **MCP:** exposing Conduit's sessions to MCP is becoming a feature in its own right (Electerm, Tabby plugin, NaviTerm), but it widens the attack surface. It should be opt-in and scoped.

### Gaps
- No quantitative data found on which AI features are most used in SSH clients (e.g., Termius did not publish usage numbers; Warp's stats are coding-agent focused).
- No Reddit threads surfaced directly in search; backlash evidence comes from HN and aggregators.
- Termius' current AI data-retention policy for Agent/session output was not found in official docs.
- Could not confirm the exact iTerm2 version where AI moved to the plugin (believed 3.5.x, mid-2024) from a primary changelog.
- HostConsole's claim that its AI sees only the session alias appeared in a search summary with no URL I could verify, so it is excluded.

---

## 2. Collaboration and team features: shared vaults, live session sharing, shared snippets, audit logs, SSO

### Takeaway
Team features are where SSH-client vendors make money (Termius Team/Business, Warp Drive, Royal Server, Devolutions RDM, Teleport). The 2024-2026 additions are live "multiplayer" terminals, which work by turn-taking rather than simultaneous typing, plus shared session logs used as audit trails, shared parameterized workflows and runbooks, and SAML SSO. For a no-account app, the relevant precedents are file- or git-based sharing (Royal TSX shared documents, XPipe git vaults, Tabby/Electerm gist sync). These deliver team sharing without a vendor cloud.

### Cited Findings

**Termius**
- **Plans and pricing:**
  - Starter (free): local vault, SSH/SFTP, AI autocomplete, port forwarding, Mosh.
  - Pro ($10/mo annual): personal cloud vault, sync, session logs, snippet automation.
  - Team ($20/seat/mo): one team vault, real-time collaboration, shared session logs.
  - Business ($30/seat/mo): multiple team vaults, granular vault access, SAML SSO add-on.
  - Enterprise: SSO included, SOC 2 Type II report, custom retention.
  - Listed integrations: AWS, DigitalOcean, Azure, "API bridge", Ansible, Vanta.
  — [Termius pricing](https://termius.com/pricing)
- **SAML SSO:** users still set a separate encryption password that is never shared with the IdP, which keeps E2EE intact. — [Termius SAML SSO docs](https://docs.termius.com/administration/saml-sso); [Learn about vaults](https://docs.termius.com/getting-started/learn-about-vaults)
- **"Multiplayer" terminal (Oct 29, 2025):**
  - One person drives and others watch live. A cursor shows who is driving, and control can be handed over.
  - No server-side install is needed. It is WebRTC peer-to-peer and encrypted; Termius servers only do signaling.
  - Termius first built a Google-Docs-style session where everyone typed at once, and abandoned it: commands collided, output tangled and ownership was unclear.
  — [Termius blog](https://termius.com/blog/from-chaos-to-clarity-reimagining-real-time-collaboration-in-the-terminal); [Termius collaborate docs](https://termius.com/documentation/collaborate)
- **Session logs:**
  - By default only the most recent log per host is kept; bookmark a log to keep it.
  - Logs work for SSH, Telnet, serial and local terminal, but not Mosh.
  - Anything printed is captured, sensitive data included.
  - Logs are viewable on desktop only, while mobile records and syncs them.
  - Team logs sync through vaults. Shared log bookmarks were added Dec 2025 as long-term records teammates can review.
  — [Termius session logs docs](https://docs.termius.com/organize-and-connect-to-hosts/session-logs); [Team session logs](https://docs.termius.com/team-collaboration/team-session-logs); [Termius blog, Dec 10 2025](https://www.termius.com/blog/remember-what-was-done-with-bookmarks-for-session-logs)
- **Workspaces (Jan 2025):** drag tabs together into a group, with Focus Mode and Split View for up to 16 connections. Saving and reopening workspaces was described as still in development. — [Termius blog: Workspaces](https://termius.com/blog/workspaces)
- **Broadcast input (Pro/Team/Business):** typing into multiple hosts at once. It predates 2024. — [Termius blog](https://termius.com/blog/broadcast-input)
- I found no standalone admin audit trail at Termius beyond session logs. — [Termius pricing](https://termius.com/pricing)

**Warp**
- **Warp Drive:** Workflows (parameterized commands), Notebooks (runbooks mixing markdown with executable blocks), Prompts and Environment Variables, synced in real time to a team workspace.
  - Environment variables can be dynamic, pulling secrets from 1Password at runtime so Warp never stores them.
  - Once an item moves to the team workspace it can't move back to personal.
  — [Warp Drive docs](https://docs.warp.dev/knowledge-and-collaboration/warp-drive); [Notebooks](https://docs.warp.dev/knowledge-and-collaboration/warp-drive/notebooks); [Dynamic env vars blog](https://warp.dev/blog/dynamically-sync-env-vars-into-your-terminal-session)
- **Session Sharing:**
  - shares a web link to a live session with view or edit access; viewers need no Warp account;
  - links are restricted to invited emails by default;
  - the newer "Agent Session Sharing" lets collaborators watch and steer agent runs from the app, a browser or mobile.
  — [Warp session sharing docs](https://docs.warp.dev/features/session-sharing); [Agent session sharing](https://docs.warp.dev/agent-platform/local-agents/session-sharing); [Warp December drop](https://warp.dev/blog/december-drop)

**Teleport (infrastructure access platform)**
- Records SSH sessions by default, capturing PTY output. Output-only recording can miss obfuscated or scripted commands, so BPF "Enhanced Session Recording" exists. Replay with `tsh play` or the web UI. Session sharing and moderation of active sessions are also offered. — [Teleport session recording architecture](https://goteleport.com/docs/reference/architecture/session-recording/); [BPF recording](https://goteleport.com/docs/enroll-resources/server-access/guides/bpf-session-recording.md); [Teleport session control blog](https://goteleport.com/blog/session-control)

**Royal TSX / Royal Server (macOS)**
- **Team sharing without a cloud account:**
  - a "Shared" document type (merge file) lives in a common location such as a network share;
  - connections reference credentials by name, and each user keeps the actual credential in a private, password-protected document;
  - Royal Server can host documents centrally.
  These sources are older (about 2020-2021), and nothing version-6-specific was found. — [Royal team sharing KB](https://www.royalapplications.com/go/kb-all-teamsharing); [Royal community thread](https://community.royalapps.com/t/royal-server-shared-document-and-individual-credentials/1101/2); [Royal TSX features](https://royalapps.com/ts/mac/features-all)

**Devolutions Remote Desktop Manager**
- Session recording supports SSH Shell, capturing .webm video at 1 frame per second plus a .dat player file.
  - It can be optional or required at vault, folder or entry level, and works in embedded mode only.
  - Staff say it needs the Team edition, which conflicts with the general docs.
  - On macOS, local window recording isn't available; a screenshot feature arrived in v2026.1.11.3.
  — [Devolutions session recording docs](https://docs.devolutions.net/rdm/concepts/advanced-concepts/session-recording); [Devolutions forum](https://forum.devolutions.net/topics/51851/screenshot-functionality-inside-rdm-for-macos)

**Git, file and gist sharing (no vendor account)**
- XPipe syncs its connection vault through the user's own git remote (HTTPS/SSH/keys/smartcards) using the existing git client. It offers team collaboration with merge-conflict tools, and pulls secrets from password-manager CLIs instead of storing them. — [XPipe](https://xpipe.io/)
- Electerm syncs bookmarks to GitHub or Gitee secret gists, WebDAV, a custom server, or its own cloud. — [electerm GitHub](https://github.com/electerm/electerm)
- Tabby has an integrated encrypted container for secrets. Its community `sync-config` plugin syncs config to Gist or Gitee, and the `ssh-keymap` plugin maps synced profiles to local key files by name, so keys never sync. — [Tabby GitHub](https://github.com/Eugeny/tabby)

### Inferences
- **Live sharing:** "multiplayer" terminal sessions appeared in 2024-2025 (Warp, Termius). The design lesson from Termius' failed simultaneous-typing attempt: if Conduit ever does live sharing, use a driver/observer model with explicit hand-off. Peer-to-peer WebRTC or relay over an E2E-encrypted channel avoids becoming a cloud service. This is a heavy feature and probably low priority for a single-user, no-account app.
- **Team sharing:** the Royal TSX pattern fits Conduit's no-cloud stance best. Use a shareable host/snippet document (JSON or YAML in iCloud Drive, a network share or a git repo) where credentials are referenced by name and resolved locally from Keychain. XPipe's git-backed vault and Tabby's key-name mapping are modern versions of the same idea.
- **Shared snippets:** parameterized snippets (Warp Workflows) and runbooks/notebooks (Warp Notebooks) go beyond plain snippets. Adding `{{param}}` placeholders and multi-step runbooks to Conduit's existing snippets is a natural incremental upgrade.
- **Audit:** session logs double as audit records in Termius, Teleport and RDM. Local, opt-in session recording (text plus timing, asciinema-style) would serve compliance-minded solo users and small teams without any cloud.

### Gaps
- Pricing for Royal Server, Devolutions RDM and Teleport was not researched in depth.
- No official Termius doc on which plan includes Multiplayer (the pricing page lists real-time collaboration under Team).
- No data on how many users actually use multiplayer or session sharing.

---

## 3. Security: SSH certificates, FIDO2/security keys, password-manager SSH agents, Secure Enclave keys, host key management, session recording, Touch ID

### Takeaway
The security frontier has moved toward:
- hardware-bound keys: Secure Enclave keys (Secretive, Prompt 3, Blink) and FIDO2 sk-keys (Termius);
- password-manager SSH agents with Touch ID approval for each use (1Password, and Bitwarden since 2025);
- short-lived identity-based credentials: OPKSSH/OIDC (Cloudflare, Mar 2025), Teleport certificates, Tailscale SSH check mode;
- post-quantum key exchange, which OpenSSH 10.0 made the default in 2025, with 10.1 warning when it isn't used.

Conduit has Keychain storage and Touch ID reveal. Its most visible gaps are Secure Enclave key generation, FIDO2 sk-keys, SSH certificate display and handling, PQ key exchange support and warnings, and a first-class host-key trust UI.

### Cited Findings

**Post-quantum SSH (2025)**
- OpenSSH 9.0+ supports sntrup761x25519-sha512 and 9.9+ supports mlkem768x25519-sha256, which became the default in OpenSSH 10.0. OpenSSH 10.1 warns when a connection doesn't use post-quantum key exchange, citing "store now, decrypt later". The warning can be silenced per host via WarnWeakCrypto. — [OpenSSH PQ page](https://www.openssh.com/pq.html)
- The 10.1 warning caused user confusion on forums (DietPi, NethServer). Go x/crypto/ssh supports mlkem768x25519 only from Go 1.24, and it had to be enabled manually. — [DietPi forum](https://dietpi.com/forum/t/ssh-warning-post-quantum-key-exchange/24960); [NethServer forum](https://community.nethserver.org/t/ssh-connection-is-not-using-a-post-quantum-key-exchange-algorithm/26990); [GitLab issue 568265](https://gitlab.com/gitlab-org/gitlab/-/issues/568265)

**Secure Enclave / Touch ID keys (Apple-native differentiator)**
- Secretive (open source, macOS): keys live in the Secure Enclave and can't be exported, use can require Touch ID or Apple Watch, and you get a notification on every key use. — [Help Net Security, Jul 2024](https://www.helpnetsecurity.com/2024/07/31/secretive-app-managing-ssh-keys-secure-enclave); [Secretive README](https://cdn.jsdelivr.net/gh/maxgoedjen/secretive@main/README.md)
- Secretive 3.0 shipped around Sep 16, 2025 per a patch catalog, with builds attested via GitHub Artifact Attestation; 3.0.4 came Nov 2025. That attestation covers build provenance, not key attestation. — [Adaptiva patch library](https://adaptiva.com/patch-library/1000005457_patch_for_secretive); [lifecs blog, Dec 2025](https://lifecs.likai.org/2025/12/secretive-key-attestation-possible.html)
- Panic Prompt 3 (Mac/iPhone/iPad/Vision Pro) offers Secure Enclave keys with Face ID/Touch ID, and Panic Sync carries servers, passwords, keys and clips across devices. — [App Store: Prompt 3](https://apps.apple.com/no/app/id1594420480)
- Blink Shell (iOS) supports Secure Enclave keys and certificates, plus SSH config, ControlMaster and SOCKS5. — [App Store: Blink Shell](https://apps.apple.com/app/id1594898306)

**FIDO2 / hardware security keys**
- Termius supports FIDO2 keys (YubiKey, Solo, OnlyKey, Google Titan) and needs OpenSSH 8.4+ on the server; its blog says 8.3+, a conflict. Termius recommends non-discoverable keys, which it syncs across devices. — [Termius FIDO2 docs](https://termius.com/documentation/fido2); [Termius blog: Using FIDO2 with SSH](https://termius.com/blog/using-fido2-with-ssh)
- Yubico: FIDO keys use `ecdsa-sk` and `ed25519-sk` key types with matching certificate types. Apple disabled FIDO support in the macOS-bundled OpenSSH, so a native app must implement sk-key support itself (Yubico's note may be dated). — [Yubico SSH developer page](https://developers.yubico.com/SSH/)

**Password-manager SSH agents**
- 1Password SSH agent (Mac/Windows/Linux):
  - every client request must be approved, with Touch ID or Apple Watch, until 1Password locks; approval memory is configurable;
  - Ed25519 and RSA keys;
  - `agent.toml` chooses which vaults' keys are offered;
  - known six-key OpenSSH limit, mitigated by SSH config entries or "SSH Bookmarks" (beta), which map keys to hosts and open `ssh://` URLs in a terminal app the user picks.
  — [1Password SSH agent docs](https://www.1password.dev/ssh/agent); [SSH Bookmarks](https://developer.1password.com/docs/ssh/bookmarks)
  - Users report bookmarks breaking when ssh_config Include/IdentityAgent ordering is wrong (Dec 2025, Sep 2026), and a May 2025 request asks for shareable bookmark lists. — [1Password community 23721](https://www.1password.community/developers-69/ssh-bookmarks-broken-on-macos-23721); [community 25553](https://www.1password.community/developers-69/do-1password-ssh-bookmarks-work-without-generating-the-1password-config-file-25553); [community 21870](https://www.1password.community/1password-at-home-31/ssh-bookmarks-use-cases-21870)
- Bitwarden SSH agent (desktop 2025.1.2+):
  - stores keys for SSH auth and Git signing;
  - generates only Ed25519 keys;
  - opt-in;
  - not included in Mac App Store builds; you need the .dmg.
  — [Bitwarden SSH agent help](https://bitwarden.com/help/ssh-agent/); [Bitwarden PDF](https://bitwarden.com/pdf/help-ssh-agent.pdf); [cormier.co blog](https://cormier.co/post/bitwarden-ssh-agent/)
- iTerm2 3.5 added 1Password and LastPass integration for its password manager. — [AlternativeTo](https://alternativeto.net/news/2024/5/iterm2-v3-5-0-launches-with-chatgpt-integration-and-support-for-lastpass-and-1password)
- Warp Drive can pull secrets from 1Password at runtime into environment variables. — [Warp blog](https://warp.dev/blog/dynamically-sync-env-vars-into-your-terminal-session)
- XPipe fetches secrets via password-manager CLIs rather than storing them. — [XPipe](https://xpipe.io/)
- Reader comment on a May 2026 Termius review: Termius doesn't support keys held in ssh-agent (one user, unverified). — [Virtualization Howto comments](https://www.virtualizationhowto.com/2026/05/i-tried-termius-for-my-home-lab-and-replaced-my-ssh-client/)

**SSH certificates and SSO-to-SSH**
- Cloudflare open-sourced OPKSSH on Mar 25, 2025 (Apache 2.0, OpenPubkey/Linux Foundation). It does SSH login via an OIDC IdP with ephemeral keys (24h default). Admins authorize by email instead of collecting public keys. — [Cloudflare blog](https://blog.cloudflare.com/open-sourcing-openpubkey-ssh-opkssh-integrating-single-sign-on-with-ssh/); [Help Net Security](https://helpnetsecurity.com/2025/03/28/opkssh-sso-ssh)
- Termius' keychain supports SSH certificates, and Electerm lists certificates, OTP and NetBird among its auth methods. — [Termius keys and certificates](https://docs.termius.com/keychain/ssh-keys-and-certificates); [electerm GitHub](https://github.com/electerm/electerm)
- Tailscale SSH:
  - "check" mode forces IdP re-authentication for sensitive hosts, typically valid 12h;
  - session recordings stream to `tsrecorder` nodes in the user's tailnet (Docker, disk or S3), which Tailscale itself can't read;
  - both apply only to Tailscale SSH.
  — [Tailscale SSH docs](https://tailscale.com/kb/1193/tailscale-ssh); [Tailscale security best practices](https://tailscale.com/kb/1196/security)

**Session recording / audit**
- Teleport records by default and adds BPF enhanced recording; Devolutions RDM records .webm; Termius has session logs with bookmarks; Termix offers session recording. — [Teleport](https://goteleport.com/docs/reference/architecture/session-recording/); [Devolutions](https://docs.devolutions.net/rdm/concepts/advanced-concepts/session-recording); [Termius](https://docs.termius.com/organize-and-connect-to-hosts/session-logs); [Termix docs](https://docs.termix.site/features/terminal/session-recording)

### Inferences
- **Top Mac-native security win:** generate Secure Enclave ECDSA P-256 keys in-app, gated by Touch ID for each use, so they can't be exported or stolen. Panic Prompt 3 and Blink already do this, and Secretive's popularity shows demand. A "notify on each key use" option mirrors Secretive.
- **Interop with password-manager agents:** let users choose the 1Password, Bitwarden or Secretive agent socket per host (IdentityAgent). The six-key limit problem suggests offering per-host key selection. Bitwarden's Mac App Store limitation shows how sandboxing gets in the way of agent features, which matters if Conduit ships on the App Store.
- **PQ readiness:** as OpenSSH 10.x servers spread, a client whose SSH library lacks mlkem768x25519 / sntrup761x25519 falls behind. Showing negotiated algorithms, and a PQ badge or warning in the connection info, would be cheap, visible differentiation.
- **FIDO2 sk-keys:** worth supporting because macOS's bundled OpenSSH dropped FIDO, but costly (USB HID/CTAP2 work). Certificate support (showing principals and expiry, auto-renewing via an external command such as `step ssh` or opkssh) appeals to teams using SSO-to-SSH.
- **Host keys:** none of the sources documented a strong host-key management UI in a competitor, which is an opening. Ideas: manage known_hosts, warn on key changes with a diff and history, offer SSHFP/DNS checks, and import trusted CAs (`@cert-authority`). This is inference, not sourced.

### Gaps
- No primary source found on Termius' or Prompt's host key verification UI.
- No primary changelog found for Secretive 3.0 itself (dates come from a patch catalog).
- Did not verify which Swift/ObjC SSH libraries (libssh2, SwiftNIO SSH, libssh) support PQ kex or sk-keys; Conduit should check its own stack.
- Exact 1Password approval-duration options were not listed on the fetched page.

---

## 4. DevOps and cloud: Kubernetes/Docker sessions, cloud instance discovery, Tailscale/WireGuard, Mosh/Eternal Terminal, auto-reconnect and persistent sessions, session logging

### Takeaway
Modern clients are turning into "connection hubs" that discover targets automatically: cloud instances (Termius AWS/DigitalOcean/Azure groups), containers and Kubernetes pods (XPipe), hypervisors, and Tailscale/NetBird/Teleport networks. They also keep sessions alive across network drops and sleep: Mosh and Eternal Terminal in Prompt 3, Blink, Termius and NaviTerm; Wave's built-in "durable sessions" (2025-2026); auto tmux attach in NaviTerm. Conduit already has SSM and docker exec. The obvious missing pieces are cloud inventory sync, Kubernetes pod sessions, Tailscale device discovery, Mosh/ET, and resilient reattach.

### Cited Findings

**Cloud inventory sync**
- **Termius AWS:** imports EC2 and Lightsail servers using read-only IAM access keys, into a host group that updates automatically as the account changes. Team/Business/Enterprise only.
- **Termius DigitalOcean:** imports Droplets via a read-only token. Pro and up per current docs; an older page says not on Starter.
- **Termius Azure:** imports VMs via tenant ID, client ID and secret.
- **Credentials:** cloud credentials are stored locally and not synced.
— [Termius AWS integration](https://docs.termius.com/integrations/aws); [DigitalOcean](https://docs.termius.com/integrations/digitalocean); [Azure](https://docs.termius.com/integrations/microsoft-azure)

**Containers / Kubernetes / hypervisors**
- XPipe detects connections automatically:
  - containers: Docker, Docker Compose, Podman, LXD, incus, with start/stop/logs;
  - Kubernetes: kubectl clusters, pods and containers, with shell and file access;
  - hypervisors: Proxmox, Hyper-V, KVM/libvirt, VMware;
  - also WSL and Cygwin, and AWS/Tailscale/NetBird/Teleport/Hetzner integrations.
  It launches into the user's preferred terminal, with tmux/zellij support. — [XPipe](https://xpipe.io/); [forum mention: auto-discovers containers, exec and browse](https://links.hackliberty.org/post/867536)
- Termix (self-hosted, web-based Termius alternative) adds SSH, RDP/VNC (via Guacamole, Mar 2026), file manager, tunnels, Docker container controls and server monitoring. One commenter advises against exposing it to the internet. — [Scottibyte forum](https://discussion.scottibyte.com/t/termix-terminal-access-manager-termius-alternative/694); [selfhostedworld](https://selfhostedworld.com/alternative/termius)
- Teleport covers Kubernetes access and moderated sessions alongside SSH. — [Teleport session control blog](https://goteleport.com/blog/session-control); [forum mention](https://links.hackliberty.org/post/867536)
- No source found showing Royal TSX with a Kubernetes connection type (search returned only Ansible docs).

**Overlay networks**
- Tailscale SSH: identity-based SSH with check mode and session recording (see section 3). — [Tailscale SSH](https://tailscale.com/kb/1193/tailscale-ssh)
- Electerm supports NetBird auth; XPipe shows Tailscale and NetBird integrations. — [electerm GitHub](https://github.com/electerm/electerm); [XPipe](https://xpipe.io/)
- A Warp GitHub issue reports Warp failing to connect to SSH servers over Tailscale (#7641), showing that overlay-network edge cases matter. — [Warp issue 7641 mirror](https://upd.dev/warpdotdev/warp/issues/7641)

**Mosh / Eternal Terminal / persistence**
- Panic Prompt 3: SSH, Mosh, Eternal Terminal and Telnet. Mosh targets high-latency, low-bandwidth links; ET keeps full scrollback over flaky links. — [App Store: Prompt 3](https://apps.apple.com/no/app/id1594420480)
- Blink Shell: Mosh sessions survive a device restart. — [App Store: Blink](https://apps.apple.com/app/id1594898306)
- Termius: Mosh in the free tier, but Mosh sessions are not captured in session logs. — [Termius pricing](https://termius.com/pricing); [Termius session logs](https://docs.termius.com/organize-and-connect-to-hosts/session-logs)
- NaviTerm AI: Mosh (v5.0, also works with tmux) and automatic tmux attach (v4.5). — [App Store](https://apps.apple.com/au/app/id6747072398)
- Wave "durable sessions" (v0.14):
  - **How it works:** a lightweight Go job manager runs on the remote over the existing SSH connection, using Unix sockets and no open ports. It keeps the shell alive, buffers output while disconnected, and reattaches.
  - **What survives:** network drops, laptop sleep, and Wave restarts or crashes. cwd, environment, history, running programs and scrollback are preserved.
  - **Defaults:** off by default, configurable globally, per connection or per block.
  - **Status UI:** a shield icon shows attached, detached or awaiting.
  — [Wave durable sessions docs](https://docs.waveterm.dev/durable-sessions)
- Core Shell (macOS): automatically restores connections after network loss or wake from sleep; reads native ssh_config. — [App Store: Core Shell](https://apps.apple.com/mo/app/core-shell-ssh-client/id1354319581?l=en&mt=12)
- Warp's SSH approach:
  - installs a "remote server extension" at `~/.warp/remote-server` for a file tree and native diffs, after asking consent;
  - the older tmux-based "Warpify" is being deprecated;
  - issues report timeouts and NixOS failures.
  — [Warp Warpify SSH docs](https://docs.warp.dev/features/warpify/ssh); [Warp issue 8202](https://upd.dev/warpdotdev/warp/issues/8202); [issue 6536](https://upd.dev/warpdotdev/warp/issues/6536)
- iTerm2 3.7 added a session archive that saves and restores scrollback. — [AlternativeTo](https://alternativeto.net/news/2026/9/iterm2-3-7-released-with-ios-companion-app-claude-code-integration-tab-groups-and-more/)

**Session logging to file**
- Termius: automatic per-host session logs (Pro), with bookmarks. — [Termius docs](https://docs.termius.com/organize-and-connect-to-hosts/session-logs)
- Tabby: only through the `save-output` plugin. — [Tabby GitHub](https://github.com/Eugeny/tabby)

**Other multi-protocol extras**
- Electerm: SFTP, FTP, Telnet, serial, RDP, VNC, Spice, Zmodem/Trzsz, double-click to edit remote files, `ssh://` deep links, broadcast input to all terminals. — [electerm GitHub](https://github.com/electerm/electerm)
- Tabby: serial with hexdump, Zmodem, X11 forwarding, and a self-hostable web version. — [Tabby GitHub](https://github.com/Eugeny/tabby)

### Inferences
- **Cloud discovery:** Conduit already ships AWS SSM. Extending it to an auto-synced EC2 inventory (read-only creds kept locally in Keychain, like Termius, but with no cloud account) is low-hanging fruit and a paid-tier feature in Termius, so offering it free or local stands out.
- **Kubernetes:** pod exec as a session type, with a context/namespace/pod picker driven by local kubeconfig, would match XPipe and slot naturally beside the existing docker-exec command sessions.
- **Tailscale:** discovering devices through the local Tailscale CLI/API (`tailscale status --json`) is a cheap way to discover hosts. This is inference; no client-integration doc was found.
- **Resilience:** demand shows up across Apple-platform competitors (Prompt, Blink, NaviTerm, Core Shell, Wave). Options in order of effort:
  - auto-reconnect plus "auto-attach tmux session X" per host (low effort);
  - Mosh (medium; requires mosh-server on the host);
  - Wave-style durable helper (high; needs a remote binary, which some users dislike, as with Warp's consent flow).
- **Logging:** opt-in per-host session logging to a local file, ideally with timestamps or asciinema `.cast` format, fills a gap that Termius charges for.

### Gaps
- No usage or demand data (e.g., survey numbers) for Mosh/ET versus tmux auto-attach.
- No primary source on GCP instance discovery in any SSH client.
- No primary doc on Tailscale API-based host discovery inside third-party clients.
- Did not verify Royal TSX or Devolutions Kubernetes support.

---

## 5. Sync across devices, mobile companions, import/export formats

### Takeaway
Cross-device sync is table stakes for paid SSH clients. It runs on a vendor cloud (Termius E2EE vault, Panic Sync, Warp) or on Apple's iCloud (NaviTerm, and likely Core Shell). Mobile companions are spreading: Termius, Prompt, Blink, NaviTerm, and iTerm2's own iOS "Buddy" app (Sep 2026). The most common pain points are mandatory accounts, subscription lock-in, and weak export (Termius users complain they can't export hosts). Conduit can turn "no account" into a strength with optional iCloud or E2EE file/git sync plus strong ssh_config import/export.

### Cited Findings

**Sync models**
- Termius: personal cloud vault and sync across mobile and desktop are listed under Pro. — [Termius pricing](https://termius.com/pricing). This conflicts with a May 2026 reviewer who saw hosts on mobile after logging in on the free Starter tier. — [Virtualization Howto](https://www.virtualizationhowto.com/2026/05/i-tried-termius-for-my-home-lab-and-replaced-my-ssh-client/)
- Panic Sync (Prompt 3): servers, passwords, private keys and clips across all devices. — [App Store: Prompt 3](https://apps.apple.com/no/app/id1594420480)
- NaviTerm AI: real-time iCloud sync of hosts, AI settings and snippets. It says keys stay on the device and in iCloud Keychain with E2E encryption. — [App Store: NaviTerm AI](https://apps.apple.com/au/app/id6747072398)
- Core Shell: syncs profiles between Macs and iOS devices; the backend isn't specified. — [App Store: Core Shell](https://apps.apple.com/mo/app/core-shell-ssh-client/id1354319581?l=en&mt=12)
- Bring-your-own-storage sync: XPipe (git), Electerm (gist, WebDAV, custom server), Tabby (gist plugin). — [XPipe](https://xpipe.io/); [electerm](https://github.com/electerm/electerm); [Tabby](https://github.com/Eugeny/tabby)

**Mobile companions**
- iTerm2 3.7 "iTerm2 Buddy" iOS app (Sep 2026): pairs with the Mac by QR code over an encrypted relay that works across networks. — [AlternativeTo](https://alternativeto.net/news/2026/9/iterm2-3-7-released-with-ios-companion-app-claude-code-integration-tab-groups-and-more/)
- Warp agent session sharing lets users watch and steer agents from mobile or a browser. — [Warp docs](https://docs.warp.dev/agent-platform/local-agents/session-sharing)
- Termius mobile records and syncs session logs but can't view them. — [Termius session logs](https://docs.termius.com/organize-and-connect-to-hosts/session-logs)

**Import/export**
- Termius imports from the `~/.ssh` folder (ssh_config, known_hosts, keys):
  - ProxyCommand is ignored, and JumpHost becomes a host chain;
  - IdentityFile import works only in builds downloaded from the website, not app-store builds (a sandbox effect);
  - there is also MobaXterm import.
  — [Termius import docs](https://docs.termius.com/getting-started/import-existing-hosts/); [Import from ssh config](https://termius.com/documentation/import-from-ssh-config); [Import from MobaXterm](https://termius.com/documentation/import-from-mobaxterm)
- Export complaints:
  - a Trustpilot reviewer couldn't export hosts and lost hosts and keys after a password reset, then switched to SolarPuTTY for import/export;
  - a reader on a May 2026 review said Termius lacks data export;
  - an unofficial Termius CLI on PyPI can export hosts to ssh_config.
  — [Trustpilot](https://fr-be.trustpilot.com/review/termius.com); [Virtualization Howto comments](https://www.virtualizationhowto.com/2026/05/i-tried-termius-for-my-home-lab-and-replaced-my-ssh-client/); [termius CLI on PyPI](https://pypi.org/project/termius/)
- Core Shell reads native ssh_config "for easy migration". — [App Store: Core Shell](https://apps.apple.com/mo/app/core-shell-ssh-client/id1354319581?l=en&mt=12)
- 1Password SSH Bookmarks can write a generated SSH config file. — [1Password SSH Bookmarks](https://developer.1password.com/docs/ssh/bookmarks)
- Electerm supports `ssh://user@host:port` deep links. — [electerm GitHub](https://github.com/electerm/electerm)

**Account and subscription backlash**
- Warp removed its mandatory login after developer complaints (Nov 2024). — [Warp blog](https://www.warp.dev/blog/lifting-login-requirement)
- Termius: an aggregator calls mandatory sign-in a common complaint (weak source). An App Store reviewer objects to paying a recurring fee to keep using existing features. A Trustpilot user says settings vanished around subscription expiry (an anecdote). — [marlvel.ai](https://marlvel.ai/apps/termius-modern-ssh-client); [App Store: Termius](https://apps.apple.com/app/id1176074088); [Trustpilot CA](https://ca.trustpilot.com/review/termius.com)

### Inferences
- **Sync:** iCloud (CloudKit private database, or Keychain sync for secrets) gives cross-device sync without a Conduit account, which neatly answers the "account required" complaints aimed at Termius and Warp. An alternative or complement is an E2E-encrypted export file that users can put in any synced folder or git repo (XPipe/Royal-style).
- **Import/export:** round-trip ssh_config import and export, including ProxyJump, IdentityFile, IdentityAgent, CertificateFile and Include, plus importers from Termius, Royal TSX, SecureCRT and MobaXterm, directly target a documented Termius pain point and reduce switching cost.
- **Mobile:** a full iOS client is a big project. A lighter "companion" (view server monitoring, receive agent or long-job notifications, approve a key use) follows iTerm2's 2026 direction. This is speculative for Conduit's scope.
- **Distribution:** Termius and Bitwarden both show that the Mac App Store sandbox limits reading `~/.ssh` and running agent sockets. Shipping outside the App Store, or using security-scoped bookmarks, matters for ssh_config import and agent interop.

### Gaps
- No user-survey data on how many SSH-client users need multi-device sync.
- Core Shell's sync backend was not confirmed.
- No standard interchange format for SSH host lists across clients was found (ssh_config is the de facto one).
- Reddit threads on SSH-client sync and lock-in were not surfaced by search.
