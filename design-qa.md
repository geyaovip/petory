# Desktop Client Design QA

## Reference

- Selected direction: Native Settings
- Reference image: `/Users/gaiyao/.codex/generated_images/019eb54c-23b9-7d92-a8ee-2fa893fca3e1/ig_07efe946ad5f352a016a2b856286c88191afe12114905af172.png`
- Primary review viewport: 940 x 760 on macOS

## Review Summary

- Settings now uses a persistent sidebar, compact preference rows, native-sized controls, and a bottom-aligned sign-out action.
- Toggle geometry is fixed at 44 x 24 with a contained 20 x 20 thumb in both states.
- Range controls use the Petory coral treatment instead of browser-default blue.
- Chat, Pomodoro, Growth, Guide, and Pet Manager share the same window header, spacing, border, and action hierarchy.
- Pet Manager reserves the macOS traffic-light safe area and keeps list selection separate from creating a new pet.
- Onboarding pages inherit the same buttons, inputs, spacing, and lightweight surface treatment.

## Findings

- P0: none.
- P1: none.
- P2: none after correcting toggle containment, title-bar safe areas, oversized cards, and misplaced sign-out actions.
- P3: minor platform font-rendering differences from the generated reference are expected.

## Result

Passed.
