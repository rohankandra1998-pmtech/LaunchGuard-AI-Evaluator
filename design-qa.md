# Design QA

## Focused Interaction Polish - July 18, 2026

- Desktop empty-state evidence: `C:\Users\Rohan\.codex\visualizations\2026\07\18\019f7725-e337-7220-97c9-5df81d81113c\variable-drawer-polish-desktop-empty.png`
- Desktop invalid-state evidence: `C:\Users\Rohan\.codex\visualizations\2026\07\18\019f7725-e337-7220-97c9-5df81d81113c\variable-drawer-polish-desktop-invalid.png`
- Mobile empty-state evidence: `C:\Users\Rohan\.codex\visualizations\2026\07\18\019f7725-e337-7220-97c9-5df81d81113c\variable-drawer-polish-mobile-empty.png`
- Focused comparison evidence: `C:\Users\Rohan\.codex\visualizations\2026\07\18\019f7725-e337-7220-97c9-5df81d81113c\variable-drawer-polish-comparison.png`
- Reported Off-label defect: `C:\Users\Rohan\AppData\Local\Temp\codex-clipboard-93b79d0e-46f4-4a7f-bc3e-5679f348748e.png`
- Reported On-label defect: `C:\Users\Rohan\AppData\Local\Temp\codex-clipboard-23cf080c-1b5a-45b1-9c7e-6371eeaf5674.png`
- Corrected desktop On evidence: `C:\Users\Rohan\.codex\visualizations\2026\07\18\019f7725-e337-7220-97c9-5df81d81113c\variable-switch-label-fixed-on-desktop.png`
- Corrected mobile Off/On evidence: `variable-switch-label-fixed-off-mobile.png` and `variable-switch-label-fixed-on-mobile.png` in the same visualization directory.
- Focused before/after comparison: `C:\Users\Rohan\.codex\visualizations\2026\07\18\019f7725-e337-7220-97c9-5df81d81113c\variable-switch-label-fix-comparison.png`
- Tested viewports: 1440 x 900 desktop; 1024 x 768 narrow laptop; 768 x 900 tablet; 390 x 844 mobile.

### Focused findings

- Backdrop computed to `rgba(15, 23, 42, 0.1)` with `backdrop-filter: none`; the Prompt Builder remains recognizable.
- Required switch remained compact at 84 px with explicit, unclipped `On`/`Off` text while preserving `role="switch"`, `aria-checked`, and native button semantics.
- Follow-up iteration fixed the thumb's missing left anchor, which had let the On-state thumb overlap the label. Post-fix geometry measured zero thumb/label overlap for both states at 1280 px and 390 px.
- Empty `{{variable_name}}` fallback used lavender `rgb(238, 233, 255)` and purple `rgb(89, 43, 212)` without a success indicator.
- Valid and 50-character keys retained the lavender/purple preview treatment.
- Invalid non-empty and duplicate valid-looking keys retained red `rgb(220, 38, 38)` treatment and save-time validation.
- Dialog widths were 544 px at desktop/tablet sizes and 390 px on mobile; document width never exceeded the viewport and the sticky footer remained reachable.
- Empty submit, valid, invalid-pattern, duplicate, 50-character, and Required switch states were exercised.
- Browser console reported no warnings or errors.
- No actionable P0, P1, or P2 findings remain in this focused scope.

- Source visual truth: `C:\Users\Rohan\Downloads\ChatGPT Image Jul 17, 2026, 02_53_53 PM (2).png`
- Desktop implementation: `C:\Users\Rohan\.codex\visualizations\2026\07\18\019f7725-e337-7220-97c9-5df81d81113c\variable-drawer-desktop.png`
- Mobile implementation: `C:\Users\Rohan\.codex\visualizations\2026\07\18\019f7725-e337-7220-97c9-5df81d81113c\variable-drawer-mobile.png`
- Combined comparison evidence: `C:\Users\Rohan\.codex\visualizations\2026\07\18\019f7725-e337-7220-97c9-5df81d81113c\variable-drawer-comparison.png`
- Viewports: 1584 x 990 desktop; 390 x 844 mobile.
- State: Add Variable with a valid populated text variable on desktop; populated Edit Variable and removal confirmation on mobile.

**Findings**

- No actionable P0, P1, or P2 visual or interaction differences remain for the variable drawer.
- Fonts and typography: the drawer preserves LaunchGuard's existing application font, weight scale, readable line heights, compact helper text, and clear title/field hierarchy. Text remains legible without clipping at both checked viewports.
- Spacing and layout rhythm: the 544 px desktop drawer stays attached to the right edge with a full-height shell, 28 px desktop gutters, independent body scrolling, and persistent header/footer. At 390 px it fills the viewport with stacked controls and no horizontal overflow.
- Colors and visual tokens: the implementation uses the existing guard semantic palette for the white surface, lavender preview, purple primary actions, green validity, amber warnings, and red destructive/error states. The light 10% backdrop leaves the Prompt Builder visible without blur.
- Image quality and asset fidelity: the source contains no required raster assets inside the drawer. All interface icons use the existing Lucide icon library; no placeholder artwork or handcrafted SVG was introduced.
- Copy and content: Add/Edit descriptions, helper copy, character counters, Live Preview, Clear, Save Variable, and removal-warning language match the requested product behavior.
- Accessibility and behavior: native dialog focus trapping and Escape close remain active; Variable Name receives initial focus; `aria-labelledby`, `aria-describedby`, field associations, switch semantics, and body-scroll cleanup were verified in the browser.

**Browser QA**

- Verified Add, Save, Edit, Escape close, Cancel/Keep removal, and confirmed removal paths in New Prompt Version.
- Verified automatic display-label generation, manual-label preservation, valid/invalid/duplicate key feedback, live counts, green valid status, and invalid preview treatment.
- Verified type switching, Select option parsing, option-backed defaults, Clear, description count, Live Preview updates, and mouse toggle behavior for the Required switch. The switch is a native button with `role="switch"`; Space and Enter semantics are supplied by normal button behavior.
- Verified body overflow is `hidden` while open and restored after Escape and confirmed removal. Drawer body scroll height exceeds its client height while header/footer remain fixed.
- Verified 390 x 844 full-width behavior: dialog width 390 px, document scroll width no greater than the viewport, independently scrollable body, and fully visible stacked footer actions.
- Browser console: no warnings or errors reported by the in-app browser for the tested flow.

**Comparison History**

- First browser pass found a P1 development-only lifecycle issue: Strict Mode cleanup closed the dialog immediately after opening and prevented stable focus/scroll verification.
- Removed the cleanup-time `dialog.close()` call while retaining overflow restoration; native close paths and DOM unmount now own dialog teardown.
- Post-fix evidence shows the drawer remains open at 544 x 990, focuses Variable Name, locks background scroll, and closes cleanly through Escape, Save, and confirmed removal.
- Final combined visual comparison shows the requested right-edge composition, surface treatment, field hierarchy, switch, Live Preview, and persistent footer without actionable P0/P1/P2 drift.

**Implementation Checklist**

- [x] Right-side desktop variable drawer
- [x] Full-screen mobile sheet
- [x] Live Preview and validation states
- [x] Accessible Required switch
- [x] Persistent header and footer
- [x] In-drawer removal confirmation
- [x] Cleanup-safe body-scroll locking
- [x] Keyboard focus and Escape behavior

**Follow-up Polish**

- P3: the current LaunchGuard app shell differs from the conceptual navigation shown in the visual reference; this was intentionally left unchanged because the requested scope is the variable editor.

final result: passed

## Evaluation Criteria Persistent Ordering - July 19, 2026

- Reference: `C:\Users\Rohan\AppData\Local\Temp\codex-clipboard-1c5c9620-0c4d-4535-abd9-0fc10159833a.png`
- Desktop normal state: `C:\Users\Rohan\.codex\visualizations\2026\07\20\019f7cda-6849-7293-904a-28ea3961a834\criteria-desktop-normal.png`
- Desktop reorder state: `C:\Users\Rohan\.codex\visualizations\2026\07\20\019f7cda-6849-7293-904a-28ea3961a834\criteria-desktop-reorder.png`
- Desktop retryable save error: `C:\Users\Rohan\.codex\visualizations\2026\07\20\019f7cda-6849-7293-904a-28ea3961a834\criteria-desktop-save-error.png`
- Mobile reorder viewport: `C:\Users\Rohan\.codex\visualizations\2026\07\20\019f7cda-6849-7293-904a-28ea3961a834\criteria-mobile-reorder-viewport.png`
- Viewports: 1870 x 997 desktop and 390 x 844 mobile.

**Findings**

- The reference and implementation were inspected together at original detail. The implementation preserves the established compact rubric rows, lavender surfaces, semantic Good/Average/Bad columns, existing icon system, and action hierarchy; reorder mode adds only the controls and affordances needed for the new task.
- Reorder mode clears the search and category filters, renders the complete rubric, hides row edit/overflow actions, disables create/suggestion actions, and presents explicit Cancel and Save order controls.
- Desktop has no horizontal document overflow. At 390 px, the content region is 358 px wide, actions stack, criterion definitions stack, and drag handles remain isolated touch targets without forcing page overflow.
- No actionable P0, P1, or P2 visual differences remain in the persistent-ordering scope.

**Interaction and Accessibility QA**

- Keyboard sorting was exercised with Space, Arrow Down, and Space; the criterion moved from position 1 to position 2 and the live region announced the resulting position.
- Escape during an active keyboard drag restored the pre-drag draft and announced cancellation.
- Pointer and touch sensors are scoped to the far-left handle. Touch activation uses a delay/tolerance constraint and `touch-action: none` only on the handle, preserving scrolling elsewhere.
- Save is disabled until the draft changes. During save, Cancel, Save, and handles are disabled; a failed RPC keeps the draft in reorder mode, restores the controls, and exposes a retryable inline alert.
- The missing-migration recovery state was verified first. The migration was then applied to Supabase project `nwabcbdcbjubfmoyszdz`; schema, constraints, index, grants, deterministic backfill, and migration history were verified. A caller-level RPC test executed successfully under the app's `anon` role and the saved rows remained ordered `0, 1, 2`.

final result: passed

## Evaluation Criteria Rubric Builder - July 19, 2026

- Source visual truth: `C:\Users\Rohan\Downloads\ChatGPT Image Jul 19, 2026, 05_07_09 PM.png`
- Desktop implementation: `C:\Users\Rohan\.codex\visualizations\2026\07\20\019f7cda-6849-7293-904a-28ea3961a834\evaluation-criteria-desktop.png`
- Desktop edit-drawer implementation: `C:\Users\Rohan\.codex\visualizations\2026\07\20\019f7cda-6849-7293-904a-28ea3961a834\evaluation-criteria-edit-desktop.png`
- Mobile implementation: `C:\Users\Rohan\.codex\visualizations\2026\07\20\019f7cda-6849-7293-904a-28ea3961a834\evaluation-criteria-mobile.png`
- Mobile drawer implementation: `C:\Users\Rohan\.codex\visualizations\2026\07\20\019f7cda-6849-7293-904a-28ea3961a834\evaluation-criteria-mobile-drawer.png`
- Combined full-view comparison: `C:\Users\Rohan\.codex\visualizations\2026\07\20\019f7cda-6849-7293-904a-28ea3961a834\evaluation-criteria-comparison.png`
- Viewports: 1680 x 944 desktop and 390 x 844 mobile.
- State: saved criteria with the Clarity criterion selected in the Edit criterion drawer.

**Findings**

- No actionable P0, P1, or P2 findings remain.
- Fonts and typography: the implementation retains LaunchGuard's existing font stack and weight scale while matching the reference's compact title, labels, badge, rubric-row, and drawer hierarchy. No visible copy is clipped at the tested viewports.
- Spacing and layout rhythm: the desktop view uses a compact header, subdued information bar, dense full-width rubric rows, and a 576 px right drawer. Mobile stacks all rubric sections and uses a 390 px full-width sheet without horizontal page overflow.
- Colors and visual tokens: all surfaces, borders, shadows, primary actions, and semantic Good/Average/Bad treatments use existing `guard-*` tokens. The dimmed drawer backdrop keeps the underlying selected row legible.
- Image quality and asset fidelity: the reference contains no raster content that belongs in the product UI. Standard interface symbols use the existing Lucide library; no placeholder art or handcrafted SVG was introduced.
- Copy and content: the page, callout, controls, empty states, drawers, rubric labels, and actions use the requested product copy while omitting unsupported statistics and reordering.
- Accessibility and behavior: native dialogs expose labelled titles and descriptions, trap focus, focus the first create/edit field, restore focus to their trigger, close with Escape, lock body scrolling, and refuse close while an AI request or save is pending.

**Browser QA**

- Verified the page loads with saved criteria as the primary content.
- Verified Add opens empty fields; a temporary criterion was created through the real server action and appeared in the list.
- Verified Edit prefills every value; the temporary criterion was updated and the changed name appeared in the list.
- Verified Cancel and Escape close without saving and restore trigger focus.
- Verified search and category filters independently reduce the rendered criteria.
- Verified delete is only in the overflow menu, requires confirmation, and removed the temporary QA criterion, restoring the original data.
- Verified the AI drawer requests suggestions immediately. The live endpoint returned an empty set during QA; the resulting retryable empty state was corrected and individual acceptance remains wired through `saveCriterion`.
- Verified 390 x 844 layout width equals the viewport, card content stacks vertically, and the full-width drawer retains sticky actions.
- Browser console reported no warnings or errors.

**Comparison History**

- Initial interaction pass found a P2 focus mismatch: native dialog opening placed focus on Close instead of the first criterion field. The drawer shell now explicitly focuses its marked initial field after opening; the post-fix browser check reports `activeName: name`.
- Initial AI edge-case pass found a P2 copy issue when the endpoint returned zero suggestions: it incorrectly displayed “All suggestions added.” The state now distinguishes accepted suggestions from an empty API result and offers Retry.
- Post-fix side-by-side comparison confirms the requested lavender surface, row density, semantic definition columns, selected-row treatment, right drawer proportions, and action hierarchy. Differences from the reference are intentional: fake statistics, persistent ordering, and unsupported navigation elements are omitted.

**Implementation Checklist**

- [x] Compact saved-criteria workspace
- [x] Search and existing-category filtering
- [x] Responsive Good/Average/Bad rows
- [x] Reusable accessible right-side drawer shell
- [x] Create and edit criterion flows
- [x] AI loading, error, retry, empty, and accept states
- [x] Overflow delete with confirmation
- [x] Empty and filtered-results states
- [x] Desktop and mobile verification

**Follow-up Polish**

- P3: if the AI service frequently returns zero criteria in production, add server-side minimum-length validation to the structured response schema so that condition is surfaced as a generation error.

final result: passed
