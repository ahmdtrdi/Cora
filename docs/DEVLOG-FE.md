# FE Dev Log

## 2026-04-25 - Frontend stack setup verification and stabilization

### The Change
- Verified [package.json](/d:/projects/Cora/apps/web/package.json) includes the agreed non-optional frontend stack for Solana:
  - `next`, `react`, `react-dom`
  - `framer-motion`
  - `@solana/web3.js`
  - `@solana/wallet-adapter-base`
  - `@solana/wallet-adapter-react`
  - `@solana/wallet-adapter-react-ui`
  - `@solana/wallet-adapter-phantom`
  - `@coral-xyz/anchor`
  - `@tanstack/react-query`
- Confirmed the install avoids `@solana/wallet-adapter-wallets` to prevent the prior Windows install failure path.

### The Reasoning
- We aligned the web stack to Solana-first requirements (Phantom + Devnet flow) instead of EVM tooling.
- We used explicit wallet adapter packages (especially Phantom) for tighter dependency control and improved install reliability on Windows.

### The Tech Debt
- Wallet support is currently Phantom-focused; if multi-wallet support is needed later, we should add adapters incrementally and verify Windows compatibility package by package.
- We still need implementation wiring for `ConnectionProvider` + `WalletProvider` and environment-based RPC config for Devnet.

## 2026-04-26 - MatchSocket Hook & Shared Types

### The Change
- Created `packages/shared-types/src/websocket.ts` to define the "Contract" between Frontend and Backend based on the card/health game mechanics. Includes `GameState`, `PlayerState`, `Card`, and socket event types.
- Updated `apps/web/tsconfig.json` paths to map `@shared/*` to the local `shared-types` package folder.
- Built `useMatchSocket.ts` hook using the native `WebSocket` API.
- Created `scripts/mock-ws-server.js` to simulate the backend.

### The Reasoning
- Contract-First Development: Defining the payload interfaces before the backend is built forces alignment and unblocks the frontend.
- Native WebSocket: Opted for the browser's built-in `WebSocket` instead of Socket.io to keep the Next.js bundle light and ensure perfect compatibility with the backend's Bun/Hono stack.
- State vs Callbacks: The hook maintains the `GameState` internally and exposes it to the UI instead of using event callbacks, preventing stale closures in React.

### The Tech Debt
- The `tsconfig.json` path mapping is a temporary workaround. If the monorepo expands, we should set up proper NPM Workspaces / Turborepo.
- The `mock-ws-server.js` should be deleted once the real Hono backend is deployed to Devnet.

## 2026-04-26 - Wallet Integration (Devnet)

### The Change
- Created `apps/web/src/components/Providers.tsx` as a Client Component to host the Solana Wallet Adapter contexts (`ConnectionProvider`, `WalletProvider`, `WalletModalProvider`).
- Configured the network to `WalletAdapterNetwork.Devnet` and added `PhantomWalletAdapter`.
- Imported `@solana/wallet-adapter-react-ui/styles.css` inside `Providers.tsx`.
- Wrapped the root `layout.tsx` children with the new `<Providers>` component.
- Replaced the default Next.js boilerplate in `page.tsx` with a clean, monochrome landing page that renders `<WalletMultiButton />`.

### The Reasoning
- React Context (required by Wallet Adapter) can only be used in Client Components (`"use client"`). We abstracted this into a `<Providers>` wrapper so `layout.tsx` can remain a Server Component if needed.
- We set the landing page to act as the actual authentication gateway, as "connecting a wallet" *is* the login mechanism for the wager-fi architecture.

### The Tech Debt
- The RPC endpoint is currently using the public `clusterApiUrl('devnet')` directly in the component. We should move this to an environment variable (`NEXT_PUBLIC_SOLANA_RPC_URL`) later for better stability and potential custom RPC usage.

## 2026-04-27 - Landing Page Graybox Implementation

### The Change
- Set up graybox color tokens (`--color-surface`, `--color-accent`, etc.) and animation keyframes in `globals.css`.
- Built 9 new responsive landing page components in `apps/web/src/components/landing/`: `CursorGlow`, `Navbar`, `Hero`, `TokenMarquee`, `HowItWorks`, `Features`, `VideoSlot`, `CtaBanner`, and `Footer`.
- Replaced the simple wallet-connect card in `page.tsx` with a fully composed, scroll-driven landing page experience.
- Implemented premium Web3 animation patterns (all via Framer Motion & pure CSS): cursor-following radial glow, scroll-driven zoom/fade-out in the hero, SVG path drawing, bento grid staggers, and an invisible-to-glass navbar.

### The Reasoning
- **Graybox First:** By locking in layout, responsive behavior, and complex scroll animations first using neutral tokens, the designer is unblocked to iterate on colors/assets without fighting CSS structure later.
- **Dependency Discipline:** We achieved 10 distinct high-end interaction patterns without adding any new libraries (e.g. Three.js, GSAP). Framer Motion and Tailwind v4 are sufficient.
- **Routing Strategy:** The landing page now acts as the marketing surface (`/`), with CTA buttons routing the user to a dedicated `/play` route for the actual game loop (to be built next).

### The Tech Debt
- The "Enter Arena" CTA currently links to `/play`, which doesn't exist yet and will throw a 404 until we scaffold the game route.
- Graybox colors are hardcoded hexes in `globals.css`. Once the design system lands, these need to be swapped with the final palette.
- The `VideoSlot` is an empty placeholder that needs to be swapped with an actual HTML5 `<video>` tag once gameplay footage is recorded.

## 2026-04-27 - Arena HUD Landing Page Redesign

### The Change
- Reworked the landing page from generic graybox sections into a Cora-specific arena HUD concept.
- Updated `Hero`, `Navbar`, `TokenMarquee`, `HowItWorks`, `Features`, `VideoSlot`, `CtaBanner`, and `Footer` to emphasize live skill-wager match mechanics.
- Added global dark arena tokens, grid/scanline/pulse/orbit animations, wallet button styling, and a page-level cursor glow.
- Converted the empty video placeholder into an animated gameplay replay surface that shows timer, pot, question, answers, score rail, and match log.
- Fixed broken mojibake characters in landing/footer metadata paths and cleaned the socket hook lint issue in `useMatchSocket.ts`.

### The Reasoning
- The first graybox had modern Web3 effects, but they were not tied strongly enough to Cora's product identity.
- The redesign makes the first viewport immediately read as `CORA`, then carries the user through the actual product loop: connect wallet, lock stake, battle, settle.
- The visual direction avoids default purple Web3 language and uses a sharper arena palette with acid green, cyan, orange-red, and gold accents.
- Keeping the existing component boundaries preserved the graybox work while making each section more intentional and easier to iterate on.

### The Tech Debt
- `/play` is still not scaffolded, so landing CTAs continue to point at a future route.
- The gameplay replay is still a simulated UI rather than real captured gameplay or live match state.
- The visual system is still hardcoded in `globals.css`; it should be converted into final design tokens once the brand direction is approved.
- Production build was not completed in this session because the user chose to run it locally after lint passed.

## 2026-04-27 - Light Monochrome Cognitive Landing Revision

### The Change
- Fixed the hydration mismatch caused by `WalletMultiButton` rendering different server/client markup by rendering a stable placeholder until the hero mounts on the client.
- Added explicit relative positioning to Framer Motion scroll targets in `Hero`, `HowItWorks`, and `VideoSlot` to address scroll offset warnings.
- Switched the landing visual system from dark neon arena styling to a light monochrome warm-neutral base.
- Simplified the hero copy and match panel to feel cleaner, less money-coded, and more like a cognitive game surface.
- Reworked landing copy across ticker, flow, features, replay, CTA, and footer toward modern animal challengers, aptitude prompts, focus, pattern recognition, and score.

### The Reasoning
- Solana wallet adapter UI depends on browser wallet state, so it should not be server-rendered directly inside hydrated hero markup.
- The user clarified that the intended direction is modern, animal-themed, aptitude-test gaming with warm vibrant colors later, so monochrome structure is a better temporary base than neon wager-fi styling.
- Reducing `pot`, `escrow`, and token language keeps the page from reading like a financial product while the character/game identity is still forming.

### The Tech Debt
- The wallet button placeholder is intentionally minimal; a proper local wrapper component may be useful if wallet buttons appear in more places.
- Animal characters are still represented as text placeholders only. Final mascot art or generated assets should replace them later.
- The palette is intentionally monochrome and temporary until the warm vibrant brand pass is ready.
- Production build was left for the user to run locally, per request.

## 2026-04-27 - Hero Simplification to Name/Slogan + Cursor Interaction

### The Change
- Rebuilt `apps/web/src/components/landing/Hero.tsx` as a minimal hero with only the brand name (`CORA`) and a short slogan.
- Removed hero-specific cards, wallet CTA, status strips, and dense UI blocks from the hero itself.
- Kept interactivity by using cursor-tracked radial background layers driven by Framer Motion springs.

### The Reasoning
- The user requested a cleaner first section that communicates only name/slogan while preserving interactive cursor behavior.
- A minimal hero reduces visual noise and makes later mascot/color direction easier to apply without fighting existing UI complexity.

### The Tech Debt
- Hero no longer contains a top-of-page wallet action; if conversion drops, we may want to reintroduce a subtle CTA outside the hero.
- Cursor interaction is intentionally understated; intensity and blend mode may need tuning once final vibrant warm colors are introduced.

## 2026-04-27 - Hero Cursor Interaction Upgrade

### The Change
- Upgraded `apps/web/src/components/landing/Hero.tsx` cursor behavior from a simple glow into a layered interactive field.
- Added cursor-tracked conic light cone, crosshair lines, and a soft focus ring that follows the pointer.
- Added subtle motion-parallax on the hero title block (`rotateX`, `rotateY`, and positional shift) so `CORA` responds to cursor position while staying clean.

### The Reasoning
- The user requested something more interesting than hover glow while preserving a minimal hero with only name/slogan.
- A layered cursor field creates stronger "alive" feedback without reintroducing extra hero content or UI clutter.

### The Tech Debt
- Interaction complexity is now higher in one component; if this pattern is reused across sections, shared motion utilities may be worth extracting.
- Touch devices won't get the full pointer-driven effect, so we may later add a motion fallback that reacts to scroll or gyroscope.

## 2026-04-27 - Match Flow Correction from MASTER.md

### The Change
- Replaced the `HowItWorks` flow content in `apps/web/src/components/landing/HowItWorks.tsx` with the exact 4-phase architecture from `docs/MASTER.md`:
  - Matchmaking (Off-chain)
  - Escrow (On-chain, Transaction #1)
  - Battle (Off-chain, 3-round Heal/Attack card battle with GAT MCQ)
  - Settlement (On-chain, Transaction #2 with server signature verification and 97.5/2.5 split)
- Refactored the section layout to improve readability and ensure step 4 remains visible on shorter viewports.
- Updated supporting copy in `apps/web/src/components/landing/Features.tsx` and `apps/web/src/components/landing/VideoSlot.tsx` to align with the same match mechanics.

### The Reasoning
- The previous narrative drifted into a generalized "cognitive duel" and no longer reflected the actual MVP mechanism.
- `MASTER.md` is the source-of-truth spec, so the landing page needs to communicate the exact on-chain/off-chain boundaries and transaction model.
- Readability issues around the fourth step were caused by dense composition and clipping risk in the sticky layout.

### The Tech Debt
- The mechanic text is now accurate, but visual assets still use placeholder UI instead of final battle art.
- The match replay block remains a simulated preview and is not connected to real gameplay state yet.

## 2026-04-27 - Hero Interaction Simplified to Subtle Background Drift

### The Change
- Replaced the previous advanced hero cursor effects (crosshair, cone light, focus ring, title tilt) in `apps/web/src/components/landing/Hero.tsx`.
- Implemented a minimal cursor interaction where only the background layers drift slightly with pointer movement.
- Kept hero content unchanged as a clean brand-first block (`CORA` + short slogan).

### The Reasoning
- The previous interaction was visually busy for a minimal hero.
- A small parallax shift keeps the section alive while preserving readability and calm composition.

### The Tech Debt
- Parallax intensity is currently hand-tuned; it may need viewport-specific adjustment after final QA on very large monitors.

## 2026-04-27 - Landing Page Visual Upgrade (6-Priority Pass)

### The Change
- **Priority 1 — Color system:** Replaced the fully monochrome token set with a real two-accent palette. Introduced warm amber (`--amber: #d97706`) as the primary accent (CTAs, active states, highlights) and deep teal (`--teal: #0f766e`) as the secondary (on-chain phases, correct answers, HP bars). Added `--amber-glow`, `--teal-glow`, and `-dim` variants for shadows and background tints. Updated `globals.css` with new keyframes (`hpDrain`, `timerPulse`, `orbBreath`, `cardReveal`, `accentSlide`) and utility classes.
- **Priority 2 — Hero cursor orb (Option B):** Rebuilt `Hero.tsx` with two spring-tracked motion layers: a sharp amber radial orb (`mix-blend-multiply`) and a larger soft halo, both following cursor position via `useMotionValue`/`useSpring`/`useTransform` mapped to `vw`/`vh` CSS units. Added a staggered entrance sequence (kicker → title → subtitle → CTA buttons) and a breathing scroll hint at the bottom. Introduced two CTA buttons: amber "Enter Arena" and ghost "How it works".
- **Priority 3 — HowItWorks cinematic single-pane:** Refactored from a 4-card vertical stack into a cross-dissolving single panel driven by `AnimatePresence mode="wait"`. Each of the 4 stages slides in/out as the user scrolls through the 300vh container. Step indicator dots (amber active, check for completed) replace the previous card list. Each panel is split left (content) / right (large stat display with colored background tint). Added animated pill tags with staggered entrance.
- **Priority 4 — VideoSlot animated mock UI:** Timer pulses in amber (`animate-timer-pulse`), HP bars drain with CSS keyframe animations (`animate-hp-drain`, `animate-hp-drain-2`), correct answer option highlighted in teal with glow shadow, match tape dots colored amber/teal/muted per event type, and a settlement footer row added to the sidebar.
- **Priority 5 — Navbar sliding pill indicator:** Replaced static hover color change with a Framer Motion `layoutId="nav-pill"` sliding background pill that moves between hovered links. CTA button switched to amber with amber glow shadow. Logo mark now uses amber text.
- **Priority 6 — Global appear-on-scroll:** Applied consistent `opacity: 0 → 1 + y: 24 → 0 + filter: blur(8px) → blur(0)` entrance via `whileInView` to: `HowItWorks` header, `Features` header, `CtaBanner` heading and CTA, `Footer`. `TokenMarquee` event dots now cycle amber / teal / muted with a subtle box-shadow glow. `CursorGlow` upgraded from a 6%-opacity dark gradient to a two-layer amber field (600px ambient orb + sharp 4px dot at cursor) that is actually perceptible.

### The Reasoning
- The prior graybox was visually correct in structure but completely illegible in terms of hierarchy — accent, active, hover, and text were all the same near-black. Real color was the root fix everything else depended on.
- Amber was chosen over generic blue/purple because it reads as warm, skill-based, and competitive without the crypto-bro connotations of neon green or electric blue. Teal pairs cleanly as a "trust/on-chain" signal.
- The `useTransform` → `vw`/`vh` pattern in the Hero orb avoids the pitfall of using percentage-based `left`/`top` with CSS `translate`, which caused the orb to be positioned relative to the parent rather than following cursor correctly.
- `AnimatePresence mode="wait"` in HowItWorks ensures the exit animation completes before the new stage enters, preventing two panels from being simultaneously visible.

### The Tech Debt
- The Hero orb maps cursor position to `vw`/`vh` units, which is accurate for full-viewport heroes but will drift if the hero section ever becomes non-full-height. A `getBoundingClientRect`-based pixel approach would be more robust long-term.
- `HowItWorks` step indicator buttons have an empty `onClick` handler; if we want manual navigation (click to jump to a step), the scroll position should be programmatically driven from `active`.
- HP bar drain animations are pure CSS with hardcoded `74%` / `61%` targets. Once real match data is available, these should be driven by actual game state.
- The `CursorGlow` small dot uses a fixed `h-4 w-4` size; on retina displays it may appear slightly large. A 2px dot with higher opacity might be cleaner.

## 2026-04-27 - Video Intro-to-Panel Zoom Transition

### The Change
- Rebuilt `apps/web/src/components/landing/VideoSlot.tsx` into a 2-phase scroll scene:
  - Phase A: Full-bleed thumbnail background + headline "Architecture, not hand-wavy claims."
  - Phase B: The same background visual zooms into the replay panel while the panel UI fades/scales in.
- Kept the replay UI and match tape content, but anchored them to the new cinematic transition timing.
- Updated `apps/web/src/components/landing/Features.tsx` heading to avoid duplicate phrase overlap with the new video intro.

### The Reasoning
- The user requested a clear visual continuity: intro statement first, then a zoom-in reveal into the video box rather than a hard section cut.
- Using the same background recipe for both the intro frame and panel underlay makes the transition read as one camera move.

### The Tech Debt
- The "thumbnail" background is still synthetic (gradient-based) and should be replaced with real gameplay thumbnail assets once available.
- Transition timing is tuned for current section heights; if surrounding sections change significantly, scroll breakpoints may need retuning.

## 2026-04-27 - Video Section Simplified to Demo Placeholder

### The Change
- Removed the full battle replay UI and match tape sidebar from `apps/web/src/components/landing/VideoSlot.tsx`.
- Replaced it with a single gray `aspect-video` placeholder box intended for demo video insertion.
- Updated intro copy from architecture wording to demo-video wording.
- Retuned intro fade timing so the intro line stays visible longer before fading out during scroll.

### The Reasoning
- User requested dropping battle replay visuals and keeping the section focused on a demo video slot.
- The previous intro headline disappeared too quickly, reducing readability and transition clarity.

### The Tech Debt
- Placeholder box is intentionally static and not wired to an actual video source yet.
- Final timing may still need minor tuning once real media is embedded.

## 2026-04-27 - Video Zoom Direction and Slot Size Correction

### The Change
- Adjusted `apps/web/src/components/landing/VideoSlot.tsx` zoom timing so the scene now reads as:
  - zoomed-in intro background
  - then zooming out into the demo slot
- Inverted animation scales (`introScale`, `boxScale`) to match that direction.
- Reduced demo slot width from `max-w-6xl` to `max-w-4xl` for better proportion.

### The Reasoning
- User feedback: transition felt backwards and the slot looked oversized.
- The corrected motion now matches the intended camera story and keeps the demo placeholder visually subordinate.

### The Tech Debt
- Scroll breakpoints are hand-tuned; they may still need small adjustments after device-level visual QA.

## 2026-04-27 - Core Systems Bento Flip Redesign

### The Change
- Rebuilt `apps/web/src/components/landing/Features.tsx` into a minimalist bento layout using asymmetric grid spans.
- Converted each system tile into a flip card:
  - Front side: minimal headline + short descriptor
  - Back side: detailed mechanism text
- Added hover flip interaction and click/tap toggle behavior so the detail side is still accessible on touch devices.

### The Reasoning
- User requested a more interesting composition (bento style) with minimalist-first presentation and information revealed on hover.
- The asymmetric grid improves visual rhythm compared to uniform cards while keeping the section concise.

### The Tech Debt
- Flip cards currently use per-card local interaction state in one component; if reused elsewhere, shared interaction utilities may reduce duplication.
- Card copy density may need refinement once final art/icon direction is locked.

## 2026-04-28 - Roster Heading Scroll Reveal + Card Entrance Polish

### The Change
- Updated `apps/web/src/components/landing/Features.tsx` so the heading text `Choose your cognitive champion.` has an explicit scroll-on-appear animation on the `h2` itself.
- Upgraded roster card entrance animation to a smoother reveal using deeper initial offset/blur plus slight scale-in and spring-based stagger timing.

### The Reasoning
- The user requested a clearer on-scroll reveal specifically for the heading line, not just the section wrapper.
- The previous card reveal worked but felt basic; spring-driven stagger and subtle scale-in make card arrival feel more intentional without changing layout or content.

### The Tech Debt
- Card entrance timing constants are currently hand-tuned (`stiffness`, `damping`, delay per index) and may still need minor per-device adjustment after visual QA.

## 2026-04-28 - How It Works Copy + Phase Layout Simplification

### The Change
- Updated the `HowItWorks` headline in `apps/web/src/components/landing/HowItWorks.tsx` from `Four phases. Two transactions.` to `4 phases, 2 on-chain transactions.`.
- Simplified each phase panel layout from a split two-column composition into a cleaner single-column content stack while keeping the same scroll-driven stage transition (`AnimatePresence mode="wait"`).
- Replaced dense animated point pills with a simpler bullet list style for per-phase details.

### The Reasoning
- The user requested less corny headline wording and a simpler phase presentation without losing the transition flow.
- A single-column phase layout improves readability and reduces visual noise while preserving the strong stage-to-stage animation behavior.

### The Tech Debt
- The stage indicator buttons still use a no-op `onClick`; if manual stage jumping is later needed, we should wire indicator clicks to scroll position.

## 2026-04-28 - How It Works Modern Panel Refinement

### The Change
- Refined `apps/web/src/components/landing/HowItWorks.tsx` phase card visuals into a more modern, unique panel style while preserving the existing scroll-driven `AnimatePresence` transition model.
- Replaced the generic minimal stack with a stronger premium hierarchy: accent-index tile, compact domain/status chips, subtle arena-grid texture, colored glow field, and structured metric/point blocks.
- Upgraded point reveals from plain list rendering to staggered motion cards for cleaner staged readability.

### The Reasoning
- The user clarified that "simplify" should mean cleaner and sharper, not plain/basic.
- The revised composition reduces clutter but keeps distinct visual character through controlled lighting, spacing, and information framing.
- Transition mechanics were intentionally left untouched so the good section-to-section motion behavior remains intact.

### The Tech Debt
- The stage indicator still uses `OK` as the completed marker for ASCII safety; we may switch back to a custom icon glyph once the final icon system is finalized.

## 2026-04-28 - Arena Preview Center-to-Left Scroll Transition

### The Change
- Updated `apps/web/src/components/landing/CtaBanner.tsx` so the headline `Think faster. Win sharper.` now appears centered first on scroll, then docks into the existing left-aligned position.
- Added scroll-driven reveal motion for the arena preview headline (opacity, blur clear, subtle rise, and horizontal slide) and delayed CTA reveal so the headline transition lands first.
- Kept existing banner styling, background effects, and CTA content intact.

### The Reasoning
- The user requested a specific narrative transition in the arena preview section: centered statement first, then left-positioned layout.
- A scroll-driven transform preserves the existing section composition while making the headline entrance feel more cinematic and intentional.

### The Tech Debt
- The center-to-left docking threshold is currently tuned with hardcoded progress values (`0.3`, `0.14-0.36`) and may need minor adjustment if section spacing changes.

## 2026-04-28 - Arena Preview Left-Only Scroll Reveal

### The Change
- Updated `apps/web/src/components/landing/CtaBanner.tsx` to remove the center-to-left docking behavior.
- Switched the arena preview headline to a direct left-aligned scroll-on-appear reveal.
- Renamed the CTA label from `Enter Prototype` to `Enter Arena`.

### The Reasoning
- The user requested a simpler behavior: reveal directly on the left without an intermediate centered state.
- The CTA wording needed to avoid `Enter Prototype`.

### The Tech Debt
- If we later want synchronized section-level scroll choreography again, we may reintroduce `useScroll`-driven transforms with cleaner shared motion utilities.

## 2026-04-28 - How It Works Frame + Meta Simplification Pass

### The Change
- Updated `apps/web/src/components/landing/HowItWorks.tsx` to remove the `Signal` label from phase meta and display only the value (`WebSocket`, `Tx #1`, `3 rounds`, `Tx #2`).
- Replaced the `01/02/03/04` index tile content in each phase card with an empty decorative placeholder block for future custom background elements.
- Applied a clipped-corner frame style to the phase panel (diagonal corner cuts + inner stroke) to move away from a formal rounded-rectangle card shape.

### The Reasoning
- The user requested cleaner value-only metadata, no numeric index text, and a more game-like frame treatment.
- A clipped-corner border preserves readability while giving the section a stronger game-fi character.

### The Tech Debt
- The clipped-corner shape is currently hardcoded via `clipPath` values (`15/16px` cuts); these may need slight tuning across very small viewports.

## 2026-04-28 - How It Works Number Marker Restore + Point Block Removal

### The Change
- Updated `apps/web/src/components/landing/HowItWorks.tsx` to restore the phase marker tile text as `#1` to `#4`.
- Removed the per-phase point list block (`Join queue`, `FIFO pairing`, etc.) from the phase panel body.

### The Reasoning
- The user preferred keeping the compact `#` phase marker and dropping the extra point chips/list for a cleaner panel.

### The Tech Debt
- The `stages` data still includes `points` arrays that are no longer rendered; we can remove them in a cleanup pass if they are not needed elsewhere.

## 2026-04-28 - Global Clipped Frame Style Rollout (Landing Rectangles)

### The Change
- Added reusable clipped-corner utilities in `apps/web/src/app/globals.css`: `.frame-cut` and `.frame-cut-sm` (with built-in inner stroke).
- Applied the same border/frame style to bordered rectangular/square surfaces across landing components:
  - `apps/web/src/components/landing/HowItWorks.tsx` (main phase panel, marker tile, stat box)
  - `apps/web/src/components/landing/Features.tsx` (character card shell, desktop side drawer)
  - `apps/web/src/components/landing/VideoSlot.tsx` (intro frame, demo panel shell, aspect-video slot box)
  - `apps/web/src/components/landing/Navbar.tsx` (logo square)
  - `apps/web/src/components/landing/Footer.tsx` (logo square)

### The Reasoning
- The user requested a consistent game-fi border language instead of default rounded/formal rectangles.
- Centralizing the frame style in global utilities keeps the look consistent and avoids repeated inline clip-path logic.

### The Tech Debt
- `.frame-cut` uses `clip-path` and a pseudo-element inner stroke, so very small cards may need a smaller cut size override if new compact components are added later.

## 2026-04-28 - Arena CTA Capsule Double-Border Restyle

### The Change
- Updated the arena CTA button in `apps/web/src/components/landing/CtaBanner.tsx` from a plain filled rounded bar into a capsule with layered styling.
- Kept the capsule shape, but added a subtle double-border treatment (outer border + inset inner border) and a light sweep overlay.
- Preserved CTA behavior, routing, and text (`Enter Arena`).

### The Reasoning
- The user requested a less basic rounded bar look while keeping the same capsule silhouette and a small double-border feel.
- Using pseudo-element borders keeps the style lightweight and local to the CTA without introducing new global tokens.

### The Tech Debt
- CTA overlay/border opacity values are currently hand-tuned; they may need slight adjustment after cross-device visual QA.

## 2026-04-28 - Navbar Capsule CTA Restyle + Fantasy Arrow Icon

### The Change
- Updated the navbar CTA in `apps/web/src/components/landing/Navbar.tsx` to match the new capsule double-border style used in the arena CTA (outer border + inset inner border + soft highlight sweep).
- Replaced the default directional chevron arrow with a more game/fantasy-style arrow glyph in the CTA icon.

### The Reasoning
- The user requested visual consistency between capsule CTAs and a more thematic icon language for the navbar action.
- Reusing the same layered capsule treatment keeps the UI cohesive while avoiding a plain rounded-bar look.

### The Tech Debt
- The fantasy arrow is currently an inline SVG path; if this icon style is reused across the app, it should be extracted to a shared icon component set.

## 2026-04-28 - Character Expand Drawer Stability Fix

### The Change
- Updated `apps/web/src/components/landing/Features.tsx` to fix broken/diagonal behavior when expanding character stats on tablet/desktop.
- Moved the clipped-corner frame class from the width-animated outer drawer container to a fixed-width inner panel layer.
- Kept the same visual frame style while preserving the existing expand/collapse interaction.

### The Reasoning
- Animating `width` on an element that also uses the clipped-corner `clip-path` frame can cause geometry artifacts and detached rendering.
- Separating animation container (outer) from framed panel (inner) stabilizes layout and prevents the blank/offset drawer effect.

### The Tech Debt
- The drawer still relies on hardcoded width (`300px`) and side offsets per index; if the roster layout changes significantly, these offsets may need retuning.

## 2026-04-28 - Navbar CTA Arrow Reverted to Standard

### The Change
- Updated `apps/web/src/components/landing/Navbar.tsx` to revert the CTA arrow icon from the fantasy-style glyph back to a standard right arrow.

### The Reasoning
- The user requested a normal arrow for the `Enter` CTA.

### The Tech Debt
- None introduced by this icon-only swap.

## 2026-04-28 - Hero CTA Removal

### The Change
- Removed the hero CTA button group (`Enter Arena` and `How it works`) from `apps/web/src/components/landing/Hero.tsx`.
- Kept all other hero content and interactions unchanged (name, slogan, cursor orb, scroll hint).

### The Reasoning
- The user requested removing CTA elements from the hero while preserving the rest of the section.

### The Tech Debt
- Hero now has no direct action path; conversion behavior should be observed after this UX change.

## 2026-04-28 - Landing Return-from-Navigation Stability Fix

### The Change
- Updated `apps/web/src/app/page.tsx` to reset homepage scroll position to top on mount and on BFCache restore (`pageshow` with `persisted`).
- Added a local `sceneKey` remount trigger for the landing `<main>` so scroll-driven Framer Motion sections reinitialize cleanly after returning to `/`.

### The Reasoning
- Returning to `/` from other routes could restore an in-between sticky-scroll state, making the landing look partially empty.
- Forcing a top reset + controlled remount prevents stale scroll-progress state from leaving sections in hidden transition frames.

### The Tech Debt
- This fix intentionally favors deterministic homepage reload behavior over native scroll restoration. If preserving previous scroll position on back is desired later, we should add route-specific restoration logic.

## 2026-04-28 - Landing Back-Navigation Hardening + Play Route Scaffold

### The Change
- Added a real `apps/web/src/app/play/page.tsx` route so CTA/navbar navigation no longer lands on a missing route.
- Hardened homepage recovery in `apps/web/src/app/page.tsx`:
  - set `window.history.scrollRestoration = "manual"` while on the landing page,
  - reset scroll + remount scene on mount, BFCache restore (`pageshow persisted`), and browser back/forward (`popstate`),
  - restore previous scroll restoration mode on cleanup.

### The Reasoning
- The route target previously did not exist, which could produce unstable return behavior when navigating back to `/`.
- Sticky scroll scenes (`HowItWorks`, `VideoSlot`) are sensitive to restored mid-scroll states; deterministic reset prevents partially blank in-between frames.

### The Tech Debt
- Current behavior prioritizes stability over preserving previous scroll position on `/`; if we later want native-style restoration, we should implement a controlled route-aware restoration strategy.

## 2026-04-28 - How It Works Point Label Cleanup

### The Change
- Updated `apps/web/src/components/landing/HowItWorks.tsx` to remove per-point index labels (`01`, `02`, `03`) inside each phase detail card.
- Kept the phase progression structure intact, including the top `#1-#4` flow indicators.

### The Reasoning
- The user wanted to keep stage progression numbering but remove numbered prefixes from the detail bullet items.
- This makes the detail cards read cleaner while preserving navigation context.

### The Tech Debt
- If we later reintroduce labels for accessibility/scannability, we should use semantic list styling or icon tokens rather than manual numeric text prefixes.

## 2026-04-28 - Pre-Push Landing Cleanup (Anchor + Dead Data)

### The Change
- Fixed landing navbar anchor mismatch in `apps/web/src/components/landing/Navbar.tsx` by changing `System` link target from `#features` to `#roster`.
- Removed now-unused `points` arrays from `apps/web/src/components/landing/HowItWorks.tsx` stage data to match current rendered UI.
- Validation run:
  - `npm run lint` passed.
  - `npm run build` still blocked by Windows file lock (`EPERM unlink` under `.next/build/chunks`).

### The Reasoning
- Broken in-page anchors are user-facing navigation defects and should be fixed before push.
- Keeping only rendered data in stage config reduces drift and confusion during future edits.

### The Tech Debt
- Production build verification is currently blocked by a locked `.next/build` artifact on this machine; close any process holding that folder and rerun build before final push.

## 2026-04-28 - Landing Log Consolidation Note

### The Change
- Added this consolidation note because landing-page entries became highly iterative and partially redundant across multiple passes.
- Kept all original dated entries intact (no history removed), and defined the effective scaffold baseline as the current code state in:
  - `apps/web/src/app/page.tsx`
  - `apps/web/src/components/landing/*`
  - `apps/web/src/app/play/page.tsx`

### The Reasoning
- The log captures real decision history, but repeated visual iteration can make handoff scanning harder.
- A single consolidation note improves readability for the next contributor without rewriting or collapsing date-based chronology.

### The Tech Debt
- If more rapid UI iteration happens, we should periodically add short consolidation checkpoints to prevent timeline noise.

## 2026-04-29 - Lobby / Matchmaking Queue Screen

### The Change
- Added Caprasimo and Gabarito Google Fonts via `next/font/google` in `apps/web/src/app/layout.tsx` and exposed them as `--font-caprasimo` / `--font-gabarito` CSS variables. These are the fonts specified in `docs/DESIGN.md`.
- Added three new CSS keyframes (`shimmer`, `vsRing`, `matIn`) and two utility classes (`.shimmer-bar`, `.lobby-bg`) to `apps/web/src/app/globals.css` for use by lobby components.
- Created `apps/web/src/app/lobby/page.tsx` — new `/lobby` route with server-side metadata.
- Created five new components under `apps/web/src/components/lobby/`:
  - `LobbyScreen.tsx` — orchestrator; owns phase state machine (`character-select → waiting → found`) and wallet gate (redirects to `/` if wallet is not connected).
  - `CharacterSelect.tsx` — Phase 1; 3-card pre-queue scientist picker (Alan Turing, Marie Curie, Isaac Newton) with animated stat bars, selection state, and a disabled-until-selected "Enter Queue" CTA.
  - `MatchmakingWaiting.tsx` — Phase 2; dual-pod layout with your player card, a ghost enemy pod with pulsing scan reticle, animated 3-segment progress bar with shimmer effect (~4.2s mock), and cycling flavor text. Transitions to Phase 3 on completion.
  - `OpponentFound.tsx` — Phase 3; enemy pod materialises with `matIn` scale+brightness animation, four VS burst rings fire on mount, countdown ticks 3→2→1→0 then routes to `/play?roomId=mock-room-001`.

### The Reasoning
- **Pre-queue character select** (like Clash Royale) was chosen over post-match-found select per team decision. This allows the matchmaking queue to be simpler — no per-player pick phase on the server side.
- **Scientist data lives in `LobbyScreen.tsx`** (exported as `SCIENTISTS` and `Scientist` type) so all three phase components import from a single source of truth, avoiding data drift.
- **`useRef` for stable callback** in `MatchmakingWaiting` instead of `useCallback(fn, [])` anti-pattern — avoids the `exhaustive-deps` lint warning while keeping the progress effect from re-mounting.
- **`AnimatePresence mode="wait"`** ensures exit animations complete before the next phase enters, preventing two panels from overlapping mid-transition.
- The **lobby background** (`lobby-bg`) uses `#1b2e26` (darker shade of DESIGN.md's `#274137`) to distinguish the dark game arena from the warm-light landing page, matching the "dark tactical pre-game lobby" intent.

### The Tech Debt
- The `MOCK_ROOM_ID = "mock-room-001"` in `OpponentFound.tsx` must be replaced with a real room ID returned by the Hono matchmaking API once the backend WebSocket gateway is live.
- The enemy scientist in Phase 3 is currently picked as the first scientist whose ID doesn't match the player's. Once the backend returns an opponent's selected scientist, this should be driven by server state.
- `USDC Arena · Devnet · $1.00 mock wager` labels are static text scattered across lobby components. When the Wager screen task lands, these should read from shared wager state (e.g. React context or URL params).
- Fonts use `display: "swap"` — on very slow connections there may be a FOUT. If this becomes an issue, switch to `display: "optional"` or preload the font files.
- `npm run lint` could not be verified via the command runner (Windows sandbox error). Manual code review was performed; run `npm run lint` before merging this branch.


## 2026-04-29 - Lobby Flow Polish (Light Theme + Match Agreement)

### The Change
- Updated lobby visuals from dark tactical styling to a light theme across setup, character select, waiting, and found screens.
- Locked the wager display to a fixed `$1.00` in the lobby setup screen (read-only; no user editing).
- Added gray fallback state for the center arena panel when no arena is selected.
- Fixed waiting-screen `Cancel` button placement so it no longer overlaps the heading line.
- Replaced auto-start behavior in the match-found step with an explicit `Agree To Match` button and a 15-second timeout fallback.

### The Reasoning
- The latest direction required visual consistency with the light landing aesthetic.
- Fixed wager input keeps the MVP flow deterministic while on-chain deposit wiring is still in progress.
- Explicit agreement before entering `/play` better represents the "confirm/sign intent" phase after matchmaking.

### The Tech Debt
- `Agree To Match` is currently a UI-only action and does not yet call wallet signing or on-chain deposit instructions.
- Timeout fallback currently routes users back to character selection; later behavior should be synchronized with backend matchmaking session state.
