# Client UI Design QA

## Comparison Target

- Source visual truth:
  - `/var/folders/7k/gqs_h9gs5b37ppc67z36wmrr0000gn/T/codex-clipboard-98860b51-2284-4b7c-95f6-ae82285e774e.png`
  - `/var/folders/7k/gqs_h9gs5b37ppc67z36wmrr0000gn/T/codex-clipboard-61b2fded-4ac4-4998-9e6d-0d66f8beb743.png`
- Implementation screenshots:
  - `.codex/ui-qa/client-growth.png`
  - `.codex/ui-qa/client-chat.png`
  - `.codex/ui-qa/client-pomodoro.png`
- Side-by-side comparisons:
  - `.codex/ui-qa/growth-comparison.png`
  - `.codex/ui-qa/chat-comparison.png`
- Viewports: growth 440 x 580, chat 400 x 560, pomodoro 380 x 500.
- State: authenticated local development data, populated growth and chat states, idle pomodoro state.

## Full-view Comparison Evidence

- Window hierarchy: titles are centered between the macOS traffic lights and the close action across panel windows.
- Layout rhythm: panel headers use one 72 px system; content cards, controls, and footers use a consistent 16-20 px rhythm.
- Typography: system UI font, compact 11-16 px panel hierarchy, and stronger 20-25 px in-page headings remain consistent across window sizes.
- Colors: warm off-white background, white surfaces, coral primary actions, neutral borders, and semantic error/success treatments are consistent.
- Image quality: existing pet previews and brand assets remain source-backed and are not replaced with generated UI shapes.
- Copy: existing Petory terminology and feature copy are preserved; safety and shortcut copy are visually demoted without removal.

## Focused Region Evidence

- Title bars: centered title/subtitle alignment fixes the source issue where headings appeared attached to the traffic-light controls.
- Chat footer: input, send action, history preference, shortcut, and safety notice now form separate and readable layers.
- Growth content: identity/EXP, statistics, badges, and recent activity are separated into consistent cards instead of one undifferentiated page.
- Settings and pet manager: live Electron inspection confirmed the same title bar, card, navigation, and control sizing system.

## Findings

- No actionable P0, P1, or P2 findings remain in the reviewed states.
- P3: very long remote API error messages can still occupy two to three lines in the chat panel; wrapping remains readable and does not block input.

## Interaction Audit Addendum

- Consolidated the duplicate `更换宠物` and `宠物管理` context-menu destinations into one `宠物管理` entry.
- The focus entry now changes from `开始专注` to `查看专注` while a timer is active.
- Pomodoro now supports focus and break duration choices in the window, persists the chosen defaults, hides after start/resume, keeps timing after close, and confirms before ending an incomplete round.
- Disabling chat-history saving no longer deletes existing history. Deletion remains an explicit action under privacy settings.
- API service address editing no longer reconnects on every keystroke; it requires an explicit save action.
- Removed the unrelated `打开设置` action from the growth record page.
- Replaced the temporary sample pet with six generated poses grounded in the original `petory_logo` orange-white cat identity. Existing sample pets are refreshed on launch.

## Patches Made

- Added one shared panel title bar and applied it to all standalone client panels.
- Unified button, input, preference group, card, scrollbar, and content spacing tokens.
- Reworked chat empty/populated states, safety copy, errors, input footer, and history controls.
- Reworked growth, pomodoro, guide, settings, and pet manager content hierarchy.
- Centered auth/onboarding window titles and preserved macOS drag regions.

## Validation

- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run qa`: passed.
- `git diff --check`: passed.
- Live Electron review: chat, growth, pomodoro, settings, and pet manager inspected.
- Generated sample pose transparency and identity sheet inspected at `.codex/ui-qa/sample-poses-final.png`.
- Existing sample-pet migration verified by matching all six installed pose hashes against the bundled pose resources.
- Latest pomodoro interaction capture remains blocked: after the desktop unlocked, the local development profile opened the create-pet flow with no active pet. The test stopped rather than changing local pet data. Code-level state transitions, typecheck, production build, and release QA passed.

final result: blocked
