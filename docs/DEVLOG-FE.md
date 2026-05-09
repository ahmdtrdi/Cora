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
- **Priority 1 â€” Color system:** Replaced the fully monochrome token set with a real two-accent palette. Introduced warm amber (`--amber: #d97706`) as the primary accent (CTAs, active states, highlights) and deep teal (`--teal: #0f766e`) as the secondary (on-chain phases, correct answers, HP bars). Added `--amber-glow`, `--teal-glow`, and `-dim` variants for shadows and background tints. Updated `globals.css` with new keyframes (`hpDrain`, `timerPulse`, `orbBreath`, `cardReveal`, `accentSlide`) and utility classes.
- **Priority 2 â€” Hero cursor orb (Option B):** Rebuilt `Hero.tsx` with two spring-tracked motion layers: a sharp amber radial orb (`mix-blend-multiply`) and a larger soft halo, both following cursor position via `useMotionValue`/`useSpring`/`useTransform` mapped to `vw`/`vh` CSS units. Added a staggered entrance sequence (kicker â†’ title â†’ subtitle â†’ CTA buttons) and a breathing scroll hint at the bottom. Introduced two CTA buttons: amber "Enter Arena" and ghost "How it works".
- **Priority 3 â€” HowItWorks cinematic single-pane:** Refactored from a 4-card vertical stack into a cross-dissolving single panel driven by `AnimatePresence mode="wait"`. Each of the 4 stages slides in/out as the user scrolls through the 300vh container. Step indicator dots (amber active, check for completed) replace the previous card list. Each panel is split left (content) / right (large stat display with colored background tint). Added animated pill tags with staggered entrance.
- **Priority 4 â€” VideoSlot animated mock UI:** Timer pulses in amber (`animate-timer-pulse`), HP bars drain with CSS keyframe animations (`animate-hp-drain`, `animate-hp-drain-2`), correct answer option highlighted in teal with glow shadow, match tape dots colored amber/teal/muted per event type, and a settlement footer row added to the sidebar.
- **Priority 5 â€” Navbar sliding pill indicator:** Replaced static hover color change with a Framer Motion `layoutId="nav-pill"` sliding background pill that moves between hovered links. CTA button switched to amber with amber glow shadow. Logo mark now uses amber text.
- **Priority 6 â€” Global appear-on-scroll:** Applied consistent `opacity: 0 â†’ 1 + y: 24 â†’ 0 + filter: blur(8px) â†’ blur(0)` entrance via `whileInView` to: `HowItWorks` header, `Features` header, `CtaBanner` heading and CTA, `Footer`. `TokenMarquee` event dots now cycle amber / teal / muted with a subtle box-shadow glow. `CursorGlow` upgraded from a 6%-opacity dark gradient to a two-layer amber field (600px ambient orb + sharp 4px dot at cursor) that is actually perceptible.

### The Reasoning
- The prior graybox was visually correct in structure but completely illegible in terms of hierarchy â€” accent, active, hover, and text were all the same near-black. Real color was the root fix everything else depended on.
- Amber was chosen over generic blue/purple because it reads as warm, skill-based, and competitive without the crypto-bro connotations of neon green or electric blue. Teal pairs cleanly as a "trust/on-chain" signal.
- The `useTransform` â†’ `vw`/`vh` pattern in the Hero orb avoids the pitfall of using percentage-based `left`/`top` with CSS `translate`, which caused the orb to be positioned relative to the parent rather than following cursor correctly.
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
- Created `apps/web/src/app/lobby/page.tsx` â€” new `/lobby` route with server-side metadata.
- Created five new components under `apps/web/src/components/lobby/`:
  - `LobbyScreen.tsx` â€” orchestrator; owns phase state machine (`character-select â†’ waiting â†’ found`) and wallet gate (redirects to `/` if wallet is not connected).
  - `CharacterSelect.tsx` â€” Phase 1; 3-card pre-queue scientist picker (Alan Turing, Marie Curie, Isaac Newton) with animated stat bars, selection state, and a disabled-until-selected "Enter Queue" CTA.
  - `MatchmakingWaiting.tsx` â€” Phase 2; dual-pod layout with your player card, a ghost enemy pod with pulsing scan reticle, animated 3-segment progress bar with shimmer effect (~4.2s mock), and cycling flavor text. Transitions to Phase 3 on completion.
  - `OpponentFound.tsx` â€” Phase 3; enemy pod materialises with `matIn` scale+brightness animation, four VS burst rings fire on mount, countdown ticks 3â†’2â†’1â†’0 then routes to `/play?roomId=mock-room-001`.

### The Reasoning
- **Pre-queue character select** (like Clash Royale) was chosen over post-match-found select per team decision. This allows the matchmaking queue to be simpler â€” no per-player pick phase on the server side.
- **Scientist data lives in `LobbyScreen.tsx`** (exported as `SCIENTISTS` and `Scientist` type) so all three phase components import from a single source of truth, avoiding data drift.
- **`useRef` for stable callback** in `MatchmakingWaiting` instead of `useCallback(fn, [])` anti-pattern â€” avoids the `exhaustive-deps` lint warning while keeping the progress effect from re-mounting.
- **`AnimatePresence mode="wait"`** ensures exit animations complete before the next phase enters, preventing two panels from overlapping mid-transition.
- The **lobby background** (`lobby-bg`) uses `#1b2e26` (darker shade of DESIGN.md's `#274137`) to distinguish the dark game arena from the warm-light landing page, matching the "dark tactical pre-game lobby" intent.

### The Tech Debt
- The `MOCK_ROOM_ID = "mock-room-001"` in `OpponentFound.tsx` must be replaced with a real room ID returned by the Hono matchmaking API once the backend WebSocket gateway is live.
- The enemy scientist in Phase 3 is currently picked as the first scientist whose ID doesn't match the player's. Once the backend returns an opponent's selected scientist, this should be driven by server state.
- `SOL Arena Â· Devnet Â· $1.00 mock wager` labels are static text scattered across lobby components. When the Wager screen task lands, these should read from shared wager state (e.g. React context or URL params).
- Fonts use `display: "swap"` â€” on very slow connections there may be a FOUT. If this becomes an issue, switch to `display: "optional"` or preload the font files.
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


## 2026-04-29 - Play Route Battle Screen MVP (Game-Fi Layout)

### The Change
- Replaced `apps/web/src/app/play/page.tsx` scaffold content with a real battle screen renderer (`BattleScreen`).
- Added `apps/web/src/components/play/BattleScreen.tsx` with a full-screen arena-style layout: battlefield, base blocks, circular player/opponent placeholders, center-fanned card hand, and overlay modals.
- Implemented deterministic question selection from `data/questions/questions.json` using shared `Question` validation from `packages/shared-types/src/question.ts` and room-seeded shuffle logic.
- Set battle round length to 5 questions (selected from the larger question pool) and enforced a 10-second per-question timer to match backend timing.
- Implemented question popup modal flow (4 options), answer resolution states (`correct`, `wrong`, `timeout`), hidden enemy-answer behavior, and lightweight opponent attack feedback animation.
- Added end-of-match summary overlay with per-outcome counts and actions (`Back To Lobby`, `Play Again`).

### The Reasoning
- The previous `/play` route was a placeholder and did not match intended gameplay interaction.
- The visual direction needed to feel more game-like while still using available placeholder assets before final character/base art arrives.
- Keeping deterministic room-seeded selection aligns frontend behavior with multiplayer expectations (both players seeing the same question set/order).

### The Tech Debt
- Battle UI is currently React/CSS-driven; scene-level animation and combat presentation may later migrate to Phaser for richer in-arena motion.
- HP is currently displayed on base elements but not yet wired to real websocket game-state updates from the backend engine.
- Enemy actions are currently mock feedback (no answer reveal by design), pending direct integration with real room event streams.
- Summary is match-level only and does not yet include reward/settlement integration.

## 2026-04-29 - Play Socket Wiring (useMatchSocket Integration)

### The Change
- Refactored `apps/web/src/hooks/useMatchSocket.ts` to support full match-room integration requirements:
  - added required `address` param and socket URL query binding (`/match/:roomId?address=...`),
  - added `openCard` sender API,
  - added listeners/state for `cardCountdown`, `cardExpired`, and `scoreUpdate`,
  - split settlement result typing to `MatchResultPayload` (`settlementResult`) and anti-cheat invalidation (`matchInvalidated`),
  - kept existing `gameStateUpdate`, `damageEvent`, `phaseChange`, and `playCardResult` flows.
- Refactored `apps/web/src/components/play/BattleScreen.tsx` to consume server-driven battle state:
  - hand/cards now render from `gameState.hand` instead of local question mock resolution,
  - card interactions now call `openCard` and `playCard` through the socket hook,
  - question timer display follows server countdown events,
  - deposit phase overlay now sends `confirmDeposit` action,
  - match completion overlay now uses server settlement/invalidation events.
- Maintained game-fi battlefield composition (full-screen arena, centered fanned card hand, base blocks, circular placeholders) while replacing local-only battle progression logic.
- Validation run: `npm run lint` passed after aligning with strict hook rules.

### The Reasoning
- Backend and game-logic already expose authoritative room events; frontend should not remain local-simulated once socket flow is available.
- Enforcing `address` in the websocket URL is necessary because room join/reconnect identity is address-scoped in the backend room manager.
- Splitting settlement vs invalidation payloads keeps FE state handling type-safe and reflects real backend event semantics.

### The Tech Debt
- `confirmDeposit` currently sends a mock signature; this must be replaced with real Phantom transaction signing payloads when wager/deposit wiring lands.
- Current no-wallet local testing uses dev-preview fallback addresses/query overrides for socket identity. This must be removed or gated behind explicit dev mode once Phantom wallet sign-in/signing is fully wired.
- Battle outcomes displayed in FE are currently event-derived and UI-focused; full scoreboard/result canonicalization should rely on final backend match payloads during settlement screen implementation.
- Current `/play` still uses React/CSS presentation; if we adopt Phaser for in-arena animation, this socket adapter should be moved behind a shared battle store (e.g., Zustand) for renderer-agnostic state flow.

## 2026-04-29 - Play Runtime Stabilization (Import Path + Empty-Hand Fallback)

### The Change
- Updated `apps/web/src/app/play/page.tsx` to import `BattleScreen` via alias path (`@/components/play/BattleScreen`) instead of deep relative path.
- Updated `apps/web/src/components/play/BattleScreen.tsx` to render placeholder card slots when `gameState.hand` is empty so the arena does not appear blank during non-playing phases.
- Added address selection fallback flow for local testing: wallet address -> `?address=` query -> deterministic `dev-preview-<roomId>` fallback.
- Adjusted implementation to satisfy strict React hook purity/ref lint rules.
- Validation run: `npm run lint` passed.

### The Reasoning
- The module resolution error was intermittent during hot reload and path reconciliation; alias imports are more stable in this workspace.
- In websocket-driven battle flow, empty hand before `playing` is expected. Placeholder slots preserve visual continuity and make state transitions clearer.
- Deterministic fallback address keeps no-wallet testing possible without violating render purity constraints.

### The Tech Debt
- Deterministic fallback address (`dev-preview-<roomId>`) means two local tabs on the same room will collide unless distinct `?address=` values are provided. This remains temporary until Phantom-authenticated addresses are the default path.

## 2026-04-29 - Wallet Auth + Deposit Signing UI Wiring

### The Change
- Added reusable Phantom deposit-sign helper at `apps/web/src/lib/solana/signDepositIntent.ts`:
  - builds a memo transaction (`CORA_DEPOSIT_INTENT`) on Solana Devnet,
  - signs/sends via wallet adapter,
  - confirms transaction and returns signature,
  - normalizes common wallet/RPC error cases.
- Updated `apps/web/src/components/lobby/OpponentFound.tsx`:
  - replaced 15s `Agree To Match` action with `Sign Deposit` flow,
  - added signing state machine (`idle -> signing -> submitting -> success/error`),
  - added inline wallet connect button (`WalletMultiButton`) and error feedback,
  - routes to `/play` only after successful signature.
- Updated `apps/web/src/components/play/BattleScreen.tsx`:
  - removed default no-wallet identity path unless explicit env fallback is enabled,
  - added wallet-required gate UI for `/play`,
  - replaced deposit modal mock confirm with Phantom signing action using the shared helper,
  - added env-based deposit mode switch (`NEXT_PUBLIC_DEPOSIT_MODE=mock|phantom`).
- Updated wallet entry touchpoints:
  - `apps/web/src/components/landing/Navbar.tsx` now shows wallet connect UI and routes to `/lobby` when connected,
  - `apps/web/src/components/lobby/LobbySetup.tsx` now exposes wallet connect button directly in setup phase.
- Validation run: `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- The 15-second post-match-found UI is the correct place to communicate and execute deposit signing before entering active battle.
- Extracting signing logic into a reusable helper avoids duplicated transaction code across lobby and play deposit surfaces.
- Wallet-first route behavior simplifies identity consistency with backend room joins (`address` as player identity).

### The Tech Debt
- Deposit signing currently uses memo-transaction intent as FE integration scaffolding; this must be swapped to real escrow instruction construction once `packages/solana-client` is implemented.
- Local no-wallet preview is now explicitly env-gated; full QA still needs dedicated wallet-connected test runs with two clients.
- Matchmaking room creation is still mock-driven in lobby flow (`mock-room-001`) and must be replaced with real `/match` queue wiring for full multiplayer deposit handshake validation.

## 2026-04-29 - Dedicated Connect Wallet Page (Pre-Lobby Gate)

### The Change
- Added a dedicated wallet-connect route:
  - `apps/web/src/app/connect/page.tsx`
  - `apps/web/src/components/connect/ConnectWalletScreen.tsx`
- Rewired landing CTAs to route through `/connect` before gameplay flow:
  - `apps/web/src/components/landing/Navbar.tsx` (`Enter` now goes to `/connect`)
  - `apps/web/src/components/landing/CtaBanner.tsx` (`Enter Arena` now goes to `/connect`)
- Removed direct wallet-connect control from the navbar so wallet login happens in a focused standalone page.
- Connect page supports optional `next` query (defaults to `/lobby`) and exposes `Continue` once connected.

### The Reasoning
- The user requested a dedicated wallet-login surface similar in intent to signing pages, rather than inline navbar auth.
- Routing through `/connect` creates a cleaner progression from landing CTA -> identity connection -> lobby/deposit flow.

### The Tech Debt
- Route guarding is still soft (UI flow-led); hard redirects from protected routes to `/connect` may still be added later for stricter access control.

## 2026-04-29 - Connect Page Simplification (Centered Sign-In Layout)

### The Change
- Simplified `apps/web/src/components/connect/ConnectWalletScreen.tsx` to a cleaner sign-in style:
  - reduced content density,
  - centered all key elements,
  - tightened copy to a straightforward wallet-login message,
  - preserved existing connect/continue behavior.
- Validation run: `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- The user requested a minimal sign-in page feel with centered alignment and clear padding hierarchy.

### The Tech Debt
- None additional beyond existing connect-flow route-guard follow-up.

## 2026-04-30 - Play Error States + Settlement Confirmation Pass

### The Change
- Improved websocket diagnostics in `apps/web/src/hooks/useMatchSocket.ts`:
  - added exposed `socketUrl`,
  - added `lastSocketError`,
  - added `lastSocketCloseInfo` (close code/reason/clean flag),
  - added `reconnect()` trigger for UI retry.
- Extended `apps/web/src/lib/solana/signDepositIntent.ts`:
  - added finer wallet error mapping (`wallet_declined`, `insufficient_balance`, `rpc_error`),
  - extracted generic memo-sign flow,
  - added `signSettlementReleaseIntent()` for settlement confirmation UI.
- Upgraded `apps/web/src/components/play/BattleScreen.tsx`:
  - added server-connection error banner with endpoint visibility and retry action,
  - improved deposit error messaging (wallet declined / insufficient balance / generic failure),
  - added round-aware HUD/result display (`roundsWon`),
  - expanded result modal with winner + match ID details,
  - added fund release confirmation state machine (`idle/signing/submitting/success/error`) with signature/error feedback.
- Validation run:
  - `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- Browser `WebSocket` error events are often opaque (`[object Event]`), so FE needs explicit close/error context to make runtime issues debuggable.
- Settlement/result UI previously stopped at winner text only; this pass aligns it with the required “winner display + fund release confirmation” branch scope.
- Multi-round backend changes introduced `roundsWon`, so surfacing rounds in the HUD/result keeps FE aligned with game state semantics.

### The Tech Debt
- Settlement confirmation currently signs memo intent, not the final escrow settlement instruction. This remains a temporary FE bridge until `packages/solana-client` provides full instruction builders.
- Result flow confirms release intent locally in UI; backend/on-chain release ack callbacks are still pending cross-role integration.

## 2026-04-30 - Web Env Template for Wallet/Socket Runtime Modes

### The Change
- Added `apps/web/.env.example` with documented runtime flags used by current FE flow:
  - `NEXT_PUBLIC_WS_URL`
  - `NEXT_PUBLIC_DEPOSIT_MODE`
  - `NEXT_PUBLIC_SETTLEMENT_MODE`
  - `NEXT_PUBLIC_ALLOW_DEV_ADDRESS_FALLBACK`

### The Reasoning
- The branch introduced multiple environment-driven behavior modes (mock vs phantom, fallback identity, websocket endpoint), so a checked-in template is needed for consistent local setup.

### The Tech Debt
- Values in `.env.example` are local-safe defaults. Team members still need per-environment overrides in `.env.local` for integration/staging.

## 2026-04-30 - Wallet Button Hydration Mismatch Fix

### The Change
- Added `apps/web/src/components/wallet/HydratedWalletButton.tsx` as a hydration-safe wrapper around wallet adapter button using `next/dynamic` with `ssr: false`.
- Replaced direct `WalletMultiButton` usage in:
  - `apps/web/src/components/connect/ConnectWalletScreen.tsx`
  - `apps/web/src/components/lobby/LobbySetup.tsx`
  - `apps/web/src/components/lobby/OpponentFound.tsx`
  - `apps/web/src/components/play/BattleScreen.tsx`
- Validation run:
  - `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- `WalletMultiButton` can render different server/client markup due to wallet runtime state, causing hydration mismatch in Next.js app routes.
- Client-only dynamic rendering removes SSR markup drift while preserving the same UX and styles.

### The Tech Debt
- If we later need deeper wallet button customization, we should build a dedicated design-system wrapper around wallet adapter primitives, still keeping client-only render strategy.

## 2026-04-30 - Unified Top-Corner Runtime Alerts (Play)

### The Change
- Refactored `apps/web/src/components/play/BattleScreen.tsx` runtime feedback into a consistent fixed top-right alert stack.
- Unified these states into one visual system:
  - websocket/server connection issue (with `Retry` action),
  - deposit signing errors (with `Dismiss`),
  - settlement confirmation errors (with `Dismiss`).
- Removed scattered inline error text inside modal bodies and moved those messages into the shared alert stack so visibility is consistent even when overlays are open.
- Validation run:
  - `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- User requested consistent banner placement and reported missing retry visibility.
- Fixed-position alert stack ensures critical runtime feedback remains visible across all play overlays.

### The Tech Debt
- Alert stack currently lives inside `BattleScreen`; if more routes need the same pattern, extract to shared UI component in `packages/ui` or `apps/web/src/components/ui`.

## 2026-04-30 - Alert Timer Bar + Manual Close Controls

### The Change
- Enhanced play runtime alerts to behave like timed toasts:
  - added auto-dismiss timers for transient warning alerts,
  - added a progress/drain bar under each alert card,
  - added top-right `X` close button on each alert.
- Kept socket/server alerts persistent by default (manual close + retry) while still using the same visual container.
- Added `@keyframes alertDrain` in `apps/web/src/app/globals.css`.
- Validation run:
  - `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- User requested explicit “time shown” behavior and familiar close control pattern for error banners.
- Unified timer/close behavior improves consistency and keeps overlays readable during failure states.

### The Tech Debt
- Alert timings are currently hardcoded in `BattleScreen`; move to shared constants/config if additional screens adopt the same toast behavior.

## 2026-04-30 - Lobby Deposit Error Toast Consistency

### The Change
- Updated `apps/web/src/components/lobby/OpponentFound.tsx` to replace inline error text below the sign button with the same top-corner toast style used in play:
  - top-right fixed alert card,
  - `X` manual close,
  - timed auto-dismiss with progress/drain bar.
- Removed the old inline error paragraph under the deposit button.
- Validation run:
  - `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- User requested consistent placement/behavior of runtime errors across signing and battle surfaces.
- Inline button-adjacent error text was easy to miss and visually inconsistent with the new alert system.

### The Tech Debt
- Alert style logic is duplicated between `OpponentFound` and `BattleScreen`; extract to shared component if we continue adding more alert surfaces.

## 2026-04-30 - Challenge Me Share Link v1 (UI + Deep-Link Prefill)

### The Change
- Added share-link utilities in `apps/web/src/lib/challenge/createChallengeLink.ts`:
  - `createChallengeLink()` to generate canonical challenge URLs to `/lobby` with `challenge`, `arena`, `token`, `wager`, and `ref` query params.
  - `createChallengeTweetIntent()` to open X share composer with the generated URL.
- Updated `apps/web/src/components/play/BattleScreen.tsx`:
  - added `Challenge Me` panel in match-complete modal with `Copy Link` and `Share On X` actions,
  - added short-lived inline share status feedback (copy success/failure and share-open confirmation),
  - exposed generated challenge link for manual copy fallback,
  - aligned deposit signing metadata with route context (`arena`/`token`/`wager`) instead of hardcoded values.
- Updated `apps/web/src/components/lobby/OpponentFound.tsx`:
  - forwarded `arena`, `token`, and `wager` query params when routing to `/play` so match result can build accurate challenge links.
- Updated `apps/web/src/components/lobby/LobbyScreen.tsx`:
  - read challenge query params on entry,
  - prefilled selected arena from challenge URL when valid,
  - added top-corner `Challenge Received` banner showing challenger and wager metadata.
- Validation run:
  - `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- `MASTER.md` positions Challenge Me distribution as a core loop, so FE needs a usable v1 share path even before full Solana Actions/Blink backend endpoints are available.
- Deep-link prefill reduces setup friction for invited players by applying the arena context immediately on lobby load.
- Keeping share controls in the settlement modal places the action at the strongest engagement moment (right after match outcome).

### The Tech Debt
- This is a URL-based v1 and not full Blink protocol integration yet; backend still needs dedicated Solana Actions/Blink endpoints and metadata surfaces.
- Share copy/status feedback is local to `BattleScreen`; if challenge sharing appears in more routes, we should extract a shared share-action component.

## 2026-04-30 - Blink-Style Challenge Card Layout (Lobby + Post-Match)

### The Change
- Added reusable Blink-style challenge card UI in `apps/web/src/components/challenge/ChallengeShareCard.tsx`:
  - left identity pane (challenger profile placeholder, short wallet, status tag, short description),
  - right action pane (QR image from generated challenge URL + token/wager/arena quick facts),
  - shared `Copy Link` and `Share On X` actions with status feedback and manual link fallback.
- Upgraded post-match share section in `apps/web/src/components/play/BattleScreen.tsx` to use the new card:
  - dynamic outcome copy (`Winner` vs `Rematch`),
  - outcome-aware share text for X intent.
- Added pre-match share surface in `apps/web/src/components/lobby/LobbySetup.tsx`:
  - `Pre Challenge Me` card directly in lobby,
  - uses current selected arena + fixed wager + wallet reference for link generation,
  - supports copy/share actions before entering queue.
- Extended `apps/web/src/lib/challenge/createChallengeLink.ts`:
  - `createChallengeTweetIntent()` now accepts optional dynamic text.
- Validation run:
  - `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- User requested a Blink-card-like share layout with QR + concise metadata, and confirmed challenge sharing should exist both pre-match (lobby) and post-match (result state).
- A reusable component keeps visual language consistent while allowing different copy contexts (`Open Challenge`, `Winner`, `Rematch`).

### The Tech Debt
- QR currently depends on an external generator URL; if we need offline reliability or stricter CSP, we should move to local QR rendering.
- Final avatar/character art is still placeholder and should be swapped once designer assets land.

## 2026-04-30 - Blink Share Trigger UX (Button -> Floating Card)

### The Change
- Refined challenge-share interaction in both pre-match and post-match flows to match requested behavior:
  - show a single `Blink Share` button first,
  - open the Blink-style challenge card as a floating modal overlay when clicked,
  - include explicit `Close` action on the floating panel.
- Updated `apps/web/src/components/lobby/LobbySetup.tsx`:
  - replaced always-visible pre-challenge card with a `Blink Share` trigger button,
  - disabled trigger until arena is selected,
  - renders `ChallengeShareCard` inside fixed overlay modal.
- Updated `apps/web/src/components/play/BattleScreen.tsx`:
  - replaced inline post-match card with `Blink Share` trigger,
  - renders floating challenge card modal above the result overlay,
  - modal visibility scoped to match-complete context.
- Validation run:
  - `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- User requested lower visual noise and cleaner hierarchy where share UI is on demand, not always expanded.
- Modal-based reveal keeps the battle/result layout focused while still enabling rich QR/share actions.

### The Tech Debt
- Share modal layout is duplicated across lobby and play trigger points; if we add more share surfaces, extract a dedicated `ChallengeShareModal` wrapper.

## 2026-04-30 - Challenge JPG Export + Share Fallbacks + QR Layout Tuning

### The Change
- Added challenge card JPG renderer in `apps/web/src/lib/challenge/renderChallengeCardJpg.ts`:
  - canvas-based static poster rendering from challenge card metadata,
  - JPG blob export helper and deterministic filename generation.
- Updated `apps/web/src/components/challenge/ChallengeShareCard.tsx`:
  - added `Save As JPG` action button,
  - reduced QR size from large block to a smaller centered layout for better visual balance,
  - adjusted panel proportions for cleaner composition.
- Updated `apps/web/src/components/lobby/LobbySetup.tsx` and `apps/web/src/components/play/BattleScreen.tsx`:
  - wired `Save As JPG` to local file download,
  - upgraded `Share On X` to:
    - try native file share first when browser supports `navigator.share({ files })`,
    - otherwise open X intent and auto-download JPG so user can attach manually.
- Validation run:
  - `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- User requested tweet-supportable media workflow and explicit image export, so FE now provides a practical path for both direct saving and sharing.
- X web intent does not support pre-attaching image files purely via URL params, so fallback UX was added to avoid blocking sharing.
- Smaller QR improves card hierarchy by keeping profile/copy and metadata readable at a glance.

### The Tech Debt
- Native file share with `navigator.share({ files })` is browser/platform-dependent; desktop web often falls back to intent + manual attach.
- Canvas render currently uses generic browser fonts; final typography should be refined once branded social templates are finalized.

## 2026-04-30 - JPG Export Font Fidelity Fix (Canvas Uses App Fonts)

### The Change
- Updated `apps/web/src/lib/challenge/renderChallengeCardJpg.ts` so canvas export uses the same app font families instead of hardcoded `Arial`.
- Added font-resolution/loading helpers:
  - read `--font-caprasimo` and `--font-gabarito` from root CSS variables (from `next/font` in layout),
  - wait for `document.fonts.ready`,
  - pre-load key font weights/sizes with `document.fonts.load(...)` before drawing text.
- Mapped canvas typography to these stacks for title, body, labels, and metadata text.
- Validation run:
  - `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- User reported mismatch where downloaded JPG did not reflect in-app typography.
- Canvas text rendering does not automatically guarantee runtime web-font availability unless loaded and referenced explicitly.

### The Tech Debt
- If rendering happens extremely early in slow networks, first-attempt export may still race with remote font fetch depending on browser behavior; if this appears in QA, we should add retry/backoff on export click.

## 2026-04-30 - Force Direct X Share (Disable Native Share Prompt Path)

### The Change
- Updated `Share On X` handlers in:
  - `apps/web/src/components/lobby/LobbySetup.tsx`
  - `apps/web/src/components/play/BattleScreen.tsx`
- Removed `navigator.share(...)` branch to avoid OS/browser app chooser prompts.
- `Share On X` now always:
  - opens X intent directly in a new tab,
  - downloads generated JPG asset so user can attach it in composer.
- Added popup-blocked feedback when browser prevents opening X.
- Validation run:
  - `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- User requested deterministic direct navigation to X instead of cross-app share sheet behavior.
- Keeping auto-download preserves media sharing workflow even though X web intent cannot auto-attach local files by URL alone.

### The Tech Debt
- X still requires manual image attach in web composer unless we implement authenticated media upload via X API/server integration.

## 2026-04-30 - Real Matchmaking Queue Wiring (API + Cancel + Timeout)

### The Change
- Added real matchmaking API client in `apps/web/src/lib/matchmaking/queueMatch.ts`:
  - calls `POST /match` with player `address`,
  - supports `AbortSignal` cancellation,
  - resolves API base from `NEXT_PUBLIC_API_URL` or derived `NEXT_PUBLIC_WS_URL` fallback.
- Documented optional `NEXT_PUBLIC_API_URL` in `apps/web/.env.example` for explicit HTTP backend routing when needed.
- Refactored lobby orchestration in `apps/web/src/components/lobby/LobbyScreen.tsx`:
  - replaced mock waiting->found transition with actual queue request lifecycle,
  - added queue states (`idle/searching/timeout/error`),
  - added cancellation via `AbortController`,
  - added 45s timeout handling,
  - added retry path (`Keep Searching`),
  - stores real `matchedRoomId` and passes it into found/deposit/play flow,
  - aborts pending queue request on unmount.
- Updated waiting UI in `apps/web/src/components/lobby/MatchmakingWaiting.tsx`:
  - removed fake auto-match timer,
  - now reflects real queue state,
  - shows retry CTA on timeout/error while keeping cancel action.
- Updated `apps/web/src/components/lobby/OpponentFound.tsx`:
  - accepts `roomId` prop,
  - uses real room ID for deposit signing and `/play` navigation,
  - removed hardcoded `mock-room-001` dependency in this flow.
- Validation run:
  - `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- Backend already provides true matchmaking queueing (`POST /match`) and room socket routing, so FE should consume it directly instead of relying on mock room IDs.
- Without cancellation + timeout UX, queueing appears stuck when no opponent is available.

### The Tech Debt
- Queue cancellation currently relies on aborting the HTTP request; backend has no explicit dequeue endpoint yet.
- Timeout duration is hardcoded in FE (45s); move to shared config/env if PM tuning is expected.

## 2026-04-30 - Matchmaking Micro-Progress Animation Pass

### The Change
- Refined queueing animation behavior in `apps/web/src/components/lobby/MatchmakingWaiting.tsx`:
  - kept matchmaking in a stable “Finding your opponent” state while searching,
  - replaced binary/step-fill segment logic with independent looping progress per segment (`Finding Opponent`, `Verifying Wallet`, `Preparing Arena`),
  - each segment now runs its own offset/duration cycle via `requestAnimationFrame` for subtle continuous UX motion.
- Kept flavor text rotation active while searching.
- Validation run:
  - `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- User requested non-jumping feedback where the screen remains in finding-opponent mode but still feels alive through small per-segment progress motion.
- Independent loops avoid the “hard complete then stop” look and better communicate ongoing queue work.

### The Tech Debt
- Loop durations/offsets are currently hardcoded in component; if motion tuning is expected across multiple screens, extract to shared animation config constants.

## 2026-04-30 - Staged Queue Animation Flow (Finding -> Verifying -> Preparing)

### The Change
- Refined matchmaking queue UX to follow staged loops exactly:
  - while waiting for an opponent: only `Finding Opponent` loops,
  - once matched: transition to `Verifying Wallet` loop,
  - then transition to `Preparing Arena` loop,
  - then continue to opponent-found/deposit screen.
- Updated `apps/web/src/components/lobby/MatchmakingWaiting.tsx`:
  - added `stage` prop (`finding | verifying | preparing`),
  - previous stages render as completed bars,
  - current stage renders looping progress only.
- Updated `apps/web/src/components/lobby/LobbyScreen.tsx`:
  - introduced matchmaking stage state management,
  - added timed post-match-found transition sequencing before moving to `found` phase,
  - added timer cleanup on cancel/unmount to prevent stale transitions.
- Validation run:
  - `npm.cmd run lint --workspace=web` passed.

### The Reasoning
- User requested that the three progress segments should not all loop arbitrarily; they should advance by matchmaking milestones with per-stage micro animation.

### The Tech Debt
- Stage transition timings are currently fixed constants in FE and not synchronized with backend milestone events yet.

## 2026-04-30 - Match Entry Polish (Timer/Rounds, Real Opponent Identity, No Double Deposit, Requeue Recovery)

### The Change
- Updated [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx):
  - supports `resumeQueue=1` deep-link recovery,
  - preloads `arena` + `scientist` from query,
  - auto-resumes queue from character-select when returning from failed `/play` entry.
- Updated [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx):
  - removed fake/static opponent scientist + mock wallet text,
  - pushes `/play` with `scientist` and pre-signed `depositSig` query params after successful signing.
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - added live match clock (`mm:ss`) from socket timer,
  - added round HUD (`Round X/3`) that starts at round 1 and advances from `roundsWon`,
  - removed question ID from question modal and post-match outcome list,
  - shows real opponent wallet address from live game state,
  - removed in-`/play` duplicate deposit modal,
  - auto-sends pre-signed deposit signature on `depositing` status,
  - added no-refresh recovery CTA (`Return And Requeue`) when room connection fails.
- Validation run:
  - `npm run lint` in `apps/web` passed.

### The Reasoning
- Team test feedback showed friction around duplicate deposit signing, missing match HUD context (time/round), mock-looking opponent info, and needing manual refresh after play-entry failure.
- Passing `depositSig` from lobby signing to `/play` keeps deposit signing in one place and removes redundant wallet prompts.
- Resume queue params (`resumeQueue`, `arena`, `scientist`) allow fast recovery paths without restarting browser state.

### The Tech Debt
- Opponent identity on the found screen is now neutral (non-mock) but still not full profile data; backend would need opponent metadata in matchmaking payload (or a pre-play room snapshot endpoint) for richer identity rendering before `/play`.
- Round HUD currently assumes best-of-3 (`2 rounds to win`) from current game logic constants; if this becomes configurable, FE should read it from shared config/event payload.

## 2026-05-01 - Integration Runtime Guards (Env Modes, /play Context Gate, Mode Banner)

### The Change
- Added runtime mode parser in [runtimeModes.ts](/d:/projects/Cora/apps/web/src/lib/config/runtimeModes.ts):
  - validates `NEXT_PUBLIC_DEPOSIT_MODE` and `NEXT_PUBLIC_SETTLEMENT_MODE` (`mock | phantom`),
  - validates `NEXT_PUBLIC_ALLOW_DEV_ADDRESS_FALLBACK` (`true | false`),
  - provides safe fallbacks with dev warnings for invalid values.
- Added shared integration notice UI in [IntegrationModeBanner.tsx](/d:/projects/Cora/apps/web/src/components/ui/IntegrationModeBanner.tsx).
- Updated [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx):
  - reads runtime modes via helper,
  - shows Integration Mode banner when deposit or settlement is still in mock mode.
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - switched env reads to typed runtime config helper,
  - added strict `/play` context guard (requires `roomId`, `arena`, `token`, valid `wager`),
  - blocks ambiguous play entry and routes user back safely,
  - shows Integration Mode banner in both guard and normal play surfaces.
- Kept [apps/web/.env.example](/d:/projects/Cora/apps/web/.env.example) keys documented with explanations and empty values for local override safety.
- Validation run:
  - `npm run lint` in `apps/web` passed.

### The Reasoning
- E2E integration testing with Web3 should fail fast when route/session context is incomplete, instead of entering partial battle state.
- Runtime mode parsing centralizes env behavior and prevents silent misconfiguration from typos.
- Explicit in-app “integration mode” state helps QA align expectations while BE escrow/settlement wiring is still partial.

### The Tech Debt
- Integration banner is currently non-dismissible and global; if it becomes noisy, move to a compact status chip with tooltip.
- `/play` context guard currently enforces query params only; once shared match state storage exists, migrate guard to store/session source of truth.

## 2026-05-01 - Matchmaking To Game Sync Fixes (Found-Phase Gating + Round Source Alignment)

### The Change
- Updated [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx):
  - replaced static `Matched Rival` with socket-backed opponent identity display (wallet + deterministic scientist profile selection),
  - added found-phase room socket usage via `useMatchSocket` so deposit confirmation is sent to backend from lobby found-phase,
  - changed play entry gating so FE routes to `/play` only when backend status is `playing` (both deposits confirmed),
  - added retryable connection warning card in found-phase when room socket drops.
- Updated [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx):
  - passes full scientist roster into found-phase for opponent scientist presentation.
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - switched round HUD source from FE-derived `roundsWon` math to backend-provided `gameState.currentRound` and `gameState.roundsToWin`.
- Validation run:
  - `npm run lint` in `apps/web` passed.

### The Reasoning
- Team testing exposed a sync gap where one player could enter battle UI before the second player finished deposit confirmation.
- Backend already owns authoritative room status transitions (`depositing -> playing`), so FE should wait for that transition before routing.
- Round display desync was caused by FE-side inference; using server-emitted round fields keeps both players aligned.

### The Tech Debt
- Opponent scientist shown in found-phase is still a deterministic FE fallback derived from opponent address. True opponent-selected scientist should come from backend matchmaking/room metadata when available.
- Found-phase uses room socket directly now; if lobby socket responsibilities expand, we should extract this into a dedicated pre-play session hook to avoid duplicate flow logic.

## 2026-05-01 - Match Sync Reliability Pass (Winner Mapping + Phase HUD + Deposit Flow UX)

### The Change
- Updated [useMatchSocket.ts](/d:/projects/Cora/apps/web/src/hooks/useMatchSocket.ts):
  - hardened `matchResult` parsing to support two backend payload shapes currently emitted:
    - settlement payload (`winner`, `matchId`, `settlementSignature`, `serverPublicKey`)
    - summary payload (`winnerAddress`, `reason`, `finalScores`, `finalHealth`)
  - added separate `matchSummaryResult` state so winner derivation no longer depends on a single payload shape,
  - added socket event capture for `depositUnlocked` and `opponentFailedDeposit` timestamps.
- Updated [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - winner/result text now resolves from settlement payload OR summary payload OR invalidation payload (in that order),
  - added a dedicated game phase badge near status (`Phase: Normal` / `Phase: Extra Point x2`),
  - added one-time top-corner toast when phase switches to `extra_point`.
- Updated [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx):
  - keeps deposit countdown running after local sign (so signed players still time out/requeue if room does not advance),
  - reacts to `opponentFailedDeposit` by auto-returning to queue flow,
  - improved sign button helper text to explain disabled/waiting reasons (wallet not connected, socket issue, waiting opponent).
- Validation run:
  - `npm run lint` in `apps/web` passed.

### The Reasoning
- Team test sessions exposed two consistency gaps:
  - winner banner could show wrong outcome because backend currently emits multiple `matchResult` payload shapes,
  - phase transitions (`normal` -> `extra_point`) were not explicit in HUD/feedback.
- Deposit-phase UX needed clearer state signaling to reduce confusion around Phantom prompt timing and waiting behavior.

### The Tech Debt
- Opponent scientist identity remains a frontend fallback until backend adds `scientistId` in room/game payloads.
- Sequential deposit role semantics are partially backend-driven (`depositUnlocked`), but FE still lacks an explicit authoritative role field from backend for strict role-gated button enablement.

## 2026-05-01 - FE Deposit UX Lock (Temporary, No-BE-Role Fallback)

### The Change
- Updated [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) with a frontend-only deposit lock UX:
  - deterministic temporary lock on one side while waiting for `depositUnlocked`,
  - fallback auto-unlock after 5 seconds to prevent deadlock when FE role inference differs from backend role assignment,
  - lock reason surfaced in helper text (`Waiting for server unlock...`),
  - sign button disabled while temporary lock is active.
- Validation run:
  - `npm run lint` in `apps/web` passed.

### The Reasoning
- Backend sequential deposit is not fully hard-gated yet for early `playerB` submissions.
- FE lock provides immediate UX guidance and reduces accidental out-of-order signing during team testing.
- Fallback unlock keeps matches from stalling due to missing authoritative role field in current socket payloads.

### The Tech Debt
- This is a UX-level guard only; true enforcement must remain backend-side.
- Temporary role inference should be removed once backend sends authoritative role metadata for each player.

## 2026-05-01 - Found-Phase Lock Visual + Timeout Tuning

### The Change
- Updated [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx):
  - lock-state sign button now uses an explicit gray background and muted text color (not text-only indicator),
  - extended found-phase signing timeout from 15s to 30s.
- Validation run:
  - `npm run lint` in `apps/web` passed.

### The Reasoning
- Team testing feedback requested clearer visual distinction for lock state to reduce confusion during sequential deposit wait.
- A 30s window is more forgiving for real-wallet interaction latency and teammate coordination during match entry.

### The Tech Debt
- Timeout value is still hardcoded in FE; once BE timing is finalized, move to shared config/contract to prevent drift.

## 2026-05-02 - Reusable Character Select Extraction (Flow-Agnostic Refactor)

### The Change
- Added a new shared character module:
  - [characterTypes.ts](/d:/projects/Cora/apps/web/src/components/character/characterTypes.ts)
  - [CharacterCard.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterCard.tsx)
  - [CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterSelect.tsx)
- Refactored lobby character screen to consume the shared selector:
  - [apps/web/src/components/lobby/CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/lobby/CharacterSelect.tsx)
- The shared selector is now controlled by props and supports:
  - `selectedCharacterId` + `onSelect(characterId)`
  - `locked` state
  - `disabled` state
  - selected visual badge
  - optional countdown slot / `deadlineMs`
  - optional opponent status slot / `opponentStatus`
- Validation run:
  - `npm run lint --workspace=web` passed.

### The Reasoning
- The team has not finalized whether character selection lives pre-queue or post-deposit. Extracting a reusable, controlled selector now keeps UI work reusable across both flow options.
- Decoupling selection UI from lobby orchestration prevents coupling to queue/deposit behavior and reduces rework when BE finalizes room phases.
- Building slot-based metadata surfaces (countdown/opponent status) gives us a single component that can cover both normal flow and future locked/timeout selection phases.

### The Tech Debt
- The current lobby still maps between `Scientist` (lobby-local type) and shared character option props; we should converge on a single shared character domain type once BE/shared-types contract is finalized.
- Countdown and opponent status are currently optional UI hooks only; they are not yet wired to authoritative backend events.
- Character selection remains visual/UI-level in this refactor; no gameplay stat integration is included yet.

## 2026-05-02 - Room Phase Shell + Shared Phase Labels (Flow-Agnostic Foundation)

### The Change
- Added reusable room phase type contract in [roomPhaseTypes.ts](/d:/projects/Cora/apps/web/src/components/room/roomPhaseTypes.ts):
  - `RoomPhase` union includes `setup`, `matchmaking`, `depositing`, `selecting_character`, `playing`, `finished`, `error`.
  - `ROOM_PHASE_LABELS` map centralizes default eyebrow/title/subtitle metadata per phase.
- Added reusable phase header in [RoomPhaseHeader.tsx](/d:/projects/Cora/apps/web/src/components/room/RoomPhaseHeader.tsx) with:
  - title/subtitle slots
  - status slot
  - optional right-side panel slot
- Added reusable phase wrapper in [RoomPhaseShell.tsx](/d:/projects/Cora/apps/web/src/components/room/RoomPhaseShell.tsx) with:
  - shared container/layout
  - header integration
  - footer slot
  - optional motion transition wrapper reusing existing lobby easing/timing profile
- Integrated shell into lobby character selection screen:
  - [apps/web/src/components/lobby/CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/lobby/CharacterSelect.tsx)
  - kept existing behavior, only changed composition.
- Added local preview-only mocked `selecting_character` phase in lobby:
  - [apps/web/src/components/lobby/LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx)
  - enabled by query param `?previewPhase=selecting_character`.
- Validation run:
  - `npm run lint --workspace=web` passed.

### The Reasoning
- Flow order is still under team decision, so we need a phase-driven UI foundation that can mount either sequence without rewriting screen scaffolding.
- Centralizing phase labels removes repeated copy decisions across screens and gives FE/BE a clearer shared language for room states.
- Query-param preview gives quick local validation for a future `selecting_character` state while avoiding premature runtime wiring in production flow.

### The Tech Debt
- The preview phase is intentionally FE-only and not connected to backend room state; it should be removed or moved to a dedicated `/dev` surface once BE emits authoritative `selecting_character` status.
- `RoomPhase` currently lives in FE-only types; once backend/shared-types settles, we should align this with cross-team contracts to prevent terminology drift.

## 2026-05-02 - Character Select Header Duplication Fix (Post-Refactor)

### The Change
- Updated shared selector in [CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterSelect.tsx):
  - added `showHeading?: boolean` prop (default `true`) to allow host screens to suppress internal heading rendering when wrapped by a phase shell.
- Updated lobby wrapper usage in [lobby/CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/lobby/CharacterSelect.tsx):
  - passed `showHeading={false}` so the room phase header is the only heading source.
- Validation run:
  - `npm run lint --workspace=web` passed.

### The Reasoning
- After introducing `RoomPhaseShell`, the lobby character screen rendered two headings (`RoomPhaseHeader` + shared `CharacterSelect` heading). The new heading toggle keeps shared component portability while avoiding duplicate hierarchy in shell-based layouts.

### The Tech Debt
- Header ownership is now host-driven in shell compositions and component-driven in standalone compositions. We should document this pattern in UI component conventions to avoid future mixed-header regressions.

## 2026-05-02 - Deposit Panel Refactor (Character-Agnostic UI + Status Types)

### The Change
- Added reusable deposit status contract:
  - [depositTypes.ts](/d:/projects/Cora/apps/web/src/components/deposit/depositTypes.ts)
  - introduced `DepositStatus` union (`idle`, `wallet_required`, `signing`, `submitted`, `confirmed`, `waiting_opponent`, `opponent_failed`, `expired`, `error`).
- Added reusable deposit UI primitives:
  - [DepositStatusCard.tsx](/d:/projects/Cora/apps/web/src/components/deposit/DepositStatusCard.tsx)
  - [DepositPanel.tsx](/d:/projects/Cora/apps/web/src/components/deposit/DepositPanel.tsx)
- Refactored lobby found-phase deposit UI in [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx):
  - replaced inline deposit block with `DepositPanel`.
  - mapped existing wallet/signing/socket states into shared `DepositStatus`.
  - wired retry and cancel action slots.
  - surfaced deposit signature via dedicated signature slot.
  - kept component fully unaware of character mechanics.
- Validation run:
  - `npm run lint --workspace=web` passed.

### The Reasoning
- Deposit UX is needed in multiple contexts and should not be tied to one lobby screen implementation.
- Moving status semantics into shared types reduces drift between “what state we are in” and “what UI we render.”
- Slot-based actions (`retry`, `cancel`, wallet slot, extra slot) let the host screen inject flow-specific controls while keeping the panel reusable.

### The Tech Debt
- `OpponentFound` currently maps local state to `DepositStatus`; once backend exposes stronger authoritative deposit state fields, this mapping should move to a shared adapter/helper.
- `/play` still contains settlement confirmation UI that follows a similar state pattern but is not yet migrated to shared deposit/transaction panel primitives.

## 2026-05-02 - Room Status Indicators + Character Select State Surfaces

### The Change
- Added reusable room status primitives:
  - [CountdownBar.tsx](/d:/projects/Cora/apps/web/src/components/room/CountdownBar.tsx)
  - [PlayerRoomStatus.tsx](/d:/projects/Cora/apps/web/src/components/room/PlayerRoomStatus.tsx)
  - [RoomStatusRail.tsx](/d:/projects/Cora/apps/web/src/components/room/RoomStatusRail.tsx)
- Added compact room badges and styling support for:
  - `Connected`, `Matched`, `Deposited`, `Selecting`, `Locked`, `Auto-assigned`, `Ready`
- Expanded shared character types in [characterTypes.ts](/d:/projects/Cora/apps/web/src/components/character/characterTypes.ts):
  - added `CharacterSelectionState` union
  - added `locked` to `OpponentCharacterStatus`
- Upgraded shared character components:
  - [CharacterCard.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterCard.tsx):
    - added `autoAssigned` badge path
    - added neutral default badge path
  - [CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterSelect.tsx):
    - added selection state copy (`idle/selected/locked/auto_assigned/expired`)
    - integrated reusable countdown bar
    - added auto-pick helper copy
    - added default selection status rail with player/opponent status rows
    - added neutral default + auto-assigned character support
- Updated selecting-character preview in [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx):
  - supports query-driven UI state previews:
    - `?previewPhase=selecting_character`
    - optional `previewSelectState=selected|locked|auto_assigned|expired`
    - optional `previewOpponentStatus=waiting|picked|locked|auto_assigned|hidden`
- Updated found/deposit screen in [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx):
  - integrated `RoomStatusRail` with player/opponent deposit readiness rows.
- Validation run:
  - `npm run lint --workspace=web` passed.

### The Reasoning
- We need deterministic, flow-agnostic UI surfaces that allow QA and demo rehearsal without waiting on live opponent timing.
- Shared status/badge primitives make room progress legible to judges and testers while reducing duplicated screen-specific UI logic.
- Character state visuals were expanded as pure FE state presentation without introducing BE contract assumptions.

### The Tech Debt
- Badge state mapping in `OpponentFound` still derives from local FE heuristics. Once BE emits authoritative character/deposit readiness fields, these mappings should be replaced by contract-driven adapters.
- The default status rail inside shared `CharacterSelect` is useful for preview and scaffolding, but final product screens may want host-specific rails for tighter density and copy control.

## 2026-05-02 - Runtime Room/Play Hardening (State Guards + Failure Recovery)

### The Change
- Updated socket runtime state handling in [useMatchSocket.ts](/d:/projects/Cora/apps/web/src/hooks/useMatchSocket.ts):
  - added explicit `reconnecting` connection state,
  - improved reconnect lifecycle state transitions and issue reset behavior.
- Hardened lobby runtime guards in [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx):
  - added phase-context recovery surface to prevent blank render when required room context is missing,
  - added wallet-disconnected warning while in `waiting`/`found` phases,
  - added session-based draft restore/persist (`arenaId` + `scientistId`) to reduce refresh damage during demo/testing.
- Hardened found/deposit runtime behavior in [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx):
  - requires active socket connection before allowing deposit signing,
  - added reconnecting-specific helper copy and retry surfaces.
- Hardened play runtime failure UX in [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - added reconnecting alert state,
  - added room-sync loading card after refresh/rejoin,
  - added explicit play-state gate (`room not in playing state yet`) with recovery actions,
  - improved opponent metadata fallback labels when payload is not yet available.
- Validation run:
  - `npm run lint --workspace=web` passed.

### The Reasoning
- We needed to avoid demo-breaking “silent” states (blank/ambiguous room surfaces) when refresh, socket instability, or partial route context occurs.
- Explicit reconnecting and play-state gating reduces confusion for judges/testers by turning hidden runtime transitions into clear UI states with recovery actions.
- Persisting lobby draft inputs keeps user intent (arena + character choice) across refresh so recovery is faster and less destructive.

### The Tech Debt
- Lobby draft persistence is FE-only session storage and not authoritative; long-term we should move to backend/session-backed room snapshots.
- Play-state gate currently relies on FE interpretation of `gameState.status`; if BE emits a dedicated room readiness field, we should switch to that source-of-truth.
- Opponent metadata fallback remains a temporary UI safeguard until backend guarantees richer opponent payload consistency at all pre-play/play phases.

## 2026-05-02 - Dev-Only Fallback Gating (Explicit Env Flags)

### The Change
- Extended runtime config in [runtimeModes.ts](/d:/projects/Cora/apps/web/src/lib/config/runtimeModes.ts):
  - added `allowDevCharacterFallback`,
  - added `allowDevRoomPreview`.
- Updated [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx):
  - deterministic opponent scientist fallback now runs only when `NEXT_PUBLIC_ALLOW_DEV_CHARACTER_FALLBACK=true`.
- Updated [LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx):
  - `?previewPhase=selecting_character` rendering now requires `NEXT_PUBLIC_ALLOW_DEV_ROOM_PREVIEW=true`.
- Updated env documentation in [apps/web/.env.example](/d:/projects/Cora/apps/web/.env.example):
  - documented `NEXT_PUBLIC_ALLOW_DEV_CHARACTER_FALLBACK`,
  - documented `NEXT_PUBLIC_ALLOW_DEV_ROOM_PREVIEW`.
- Validation run:
  - `npm run lint --workspace=web` passed.

### The Reasoning
- Demo and judge-facing runs should not silently depend on synthetic FE fallbacks.
- Dev tooling (preview states, deterministic placeholders) is still useful, but must be opt-in and explicit.
- Centralizing these toggles in runtime config keeps behavior predictable across environments.

### The Tech Debt
- Opponent character remains non-authoritative until backend includes opponent character payload in pre-play room state.
- Dev-preview query params still share the lobby route; if they expand, we should move them into a dedicated `/dev` surface.

## 2026-05-02 - Flow-Safe Room State Preview Surface (/dev/room-states)

### The Change
- Added a dedicated local preview route:
  - [apps/web/src/app/dev/room-states/page.tsx](/d:/projects/Cora/apps/web/src/app/dev/room-states/page.tsx)
- Built a mock-driven room-state lab using existing reusable components:
  - `RoomPhaseShell`
  - shared `CharacterSelect`
  - shared `DepositPanel`
  - `RoomStatusRail`
- Included quick presets for both flow contexts:
  - Old flow style (`pre_queue`)
  - New flow style (`post_deposit`)
  - timeout auto-assign
  - locked/ready
- Added manual controls to switch:
  - room phase
  - selection state
  - opponent status
  - deposit status
  - countdown presence/value
- Added selection-state normalization in preview controls:
  - switching to `idle` clears `selectedCharacterId` and `autoAssignedCharacterId`
  - switching to `auto_assigned` clears selected id and ensures a default auto-assigned id exists
- Route respects the explicit dev flag:
  - shows disabled gate unless `NEXT_PUBLIC_ALLOW_DEV_ROOM_PREVIEW=true`.
- Validation run:
  - `npm run lint --workspace=web` passed.

### The Reasoning
- FE needed a stable UI test surface that does not depend on live opponents, socket timing, or unresolved flow-order decisions.
- Reusing extracted components verifies that recent refactors are truly flow-agnostic and portable.
- Presets plus manual controls support both quick regression checks and deeper UI-state QA before BE contracts are finalized.
- Selection normalization keeps manual test combinations semantically correct (`idle` no longer shows a stale selected character).

### The Tech Debt
- This surface is mock-only and does not validate backend contracts/events; once shared room-state payloads stabilize, we should add a contract-mock adapter layer.
- The preview route includes inline mock data; if more dev previews are added, centralizing mock fixtures would reduce duplication.
- This normalization currently lives in the dev preview page only; if we add more state labs, we should extract shared preview state helpers.

## 2026-05-02 - Landing Polish Pass (DESIGN.md Alignment + Scientist Roster Refactor)

### The Change
- Reworked global design tokens in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css):
  - added explicit `DESIGN.md` palette primitives (`#274137`, `#9db496`, `#cbe3c1`, `#f8d694`, `#ba6931`, `#6f3a28`),
  - remapped semantic landing/UI tokens to the new palette,
  - preserved backward-compatible `--amber` / `--teal` aliases to avoid breaking non-landing screens,
  - switched default body/UI typography to `Gabarito` and kept `Caprasimo` for display classes.
- Added reusable landing domain modules:
  - [content.ts](/d:/projects/Cora/apps/web/src/components/landing/content.ts)
  - [visuals.ts](/d:/projects/Cora/apps/web/src/components/landing/visuals.ts)
- Refactored landing sections to consume shared content/style helpers and match design direction:
  - [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx)
  - [Navbar.tsx](/d:/projects/Cora/apps/web/src/components/landing/Navbar.tsx)
  - [TokenMarquee.tsx](/d:/projects/Cora/apps/web/src/components/landing/TokenMarquee.tsx)
  - [HowItWorks.tsx](/d:/projects/Cora/apps/web/src/components/landing/HowItWorks.tsx)
  - [Features.tsx](/d:/projects/Cora/apps/web/src/components/landing/Features.tsx)
  - [VideoSlot.tsx](/d:/projects/Cora/apps/web/src/components/landing/VideoSlot.tsx)
  - [CtaBanner.tsx](/d:/projects/Cora/apps/web/src/components/landing/CtaBanner.tsx)
  - [Footer.tsx](/d:/projects/Cora/apps/web/src/components/landing/Footer.tsx)
  - [CursorGlow.tsx](/d:/projects/Cora/apps/web/src/components/landing/CursorGlow.tsx)
- Replaced animal roster copy/structure with the agreed scientist lineup:
  - Einstein
  - Marie Curie
  - Alan Turing
  - included scientist-specific base concepts (Relativity Lab, Radium Reactor, Cipher Engine).
- Preserved angular `frame-cut` component language while softening borders/shadows to match warm-vintage direction.
- Validation run:
  - `npm run lint --workspace=web` passed.

### The Reasoning
- `DESIGN.md` requires vintage-warm palette + explicit font pairing (`Caprasimo` headline/logo and `Gabarito` body/UI), so token and typography alignment needed to happen at global level first.
- Extracting landing copy/state into `content.ts` and accent mappings into `visuals.ts` reduces duplication and keeps future branch work (flow-order changes, scientist detail tuning, localized copy) low-risk and centralized.
- Keeping angular frames while softening border tone/shadows supports the desired contrast: cute chibi scientist identity inside a still-structured competitive arena shell.

### The Tech Debt
- Scientist visuals are still text/initial placeholders in landing cards. Once designer assets are available, these should be replaced with actual chibi portraits/illustrations.
- Landing roster/base descriptions are FE-side content constants only; when backend/shared contracts include canonical scientist/base metadata, this content should be sourced from shared-types or API payloads.
- Some non-landing surfaces still inherit legacy visual assumptions through compatibility aliases. After broader UI migration, we should retire alias tokens and use only semantic DESIGN.md tokens.

## 2026-05-02 - Landing Encoding Hotfix (UTF-8 Parse Failure)

### The Change
- Normalized landing and related style files to UTF-8 (no BOM) to resolve Next.js parser failure (`invalid utf-8 sequence`) triggered from [Footer.tsx](/d:/projects/Cora/apps/web/src/components/landing/Footer.tsx).
- Re-encoded the updated landing stack and shared landing modules:
  - [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css)
  - [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx)
  - [Navbar.tsx](/d:/projects/Cora/apps/web/src/components/landing/Navbar.tsx)
  - [TokenMarquee.tsx](/d:/projects/Cora/apps/web/src/components/landing/TokenMarquee.tsx)
  - [HowItWorks.tsx](/d:/projects/Cora/apps/web/src/components/landing/HowItWorks.tsx)
  - [Features.tsx](/d:/projects/Cora/apps/web/src/components/landing/Features.tsx)
  - [VideoSlot.tsx](/d:/projects/Cora/apps/web/src/components/landing/VideoSlot.tsx)
  - [CtaBanner.tsx](/d:/projects/Cora/apps/web/src/components/landing/CtaBanner.tsx)
  - [Footer.tsx](/d:/projects/Cora/apps/web/src/components/landing/Footer.tsx)
  - [CursorGlow.tsx](/d:/projects/Cora/apps/web/src/components/landing/CursorGlow.tsx)
  - [content.ts](/d:/projects/Cora/apps/web/src/components/landing/content.ts)
  - [visuals.ts](/d:/projects/Cora/apps/web/src/components/landing/visuals.ts)
- Validation run:
  - `npm run lint --workspace=web` passed.

### The Reasoning
- The runtime error indicates source decoding failure before compilation. Re-encoding to UTF-8 restores parser compatibility and prevents cross-platform editor/CLI encoding drift.

### The Tech Debt
- The repo currently lacks an explicit encoding guardrail. Add `.editorconfig` and/or a pre-commit check to enforce UTF-8 on TS/TSX/CSS files.

## 2026-05-02 - Landing Multi-Vibe Color Pass (Divider-Deemphasis)

### The Change
- Kept landing composition divider-free in [page.tsx](/d:/projects/Cora/apps/web/src/app/page.tsx) (no section-divider coupling in the main flow).
- Reworked section atmospheres with distinct palette-driven backgrounds while preserving readability:
  - [Hero.tsx](/d:/projects/Cora/apps/web/src/components/landing/Hero.tsx): layered warm-cream/sage/clay radial + linear blend for intro identity.
  - [TokenMarquee.tsx](/d:/projects/Cora/apps/web/src/components/landing/TokenMarquee.tsx): white card-like ticker lane with subtle side-tinted radial wash and centered marquee track.
  - [HowItWorks.tsx](/d:/projects/Cora/apps/web/src/components/landing/HowItWorks.tsx): structured sage-leaning gradient scene plus soft ambient blobs.
  - [Features.tsx](/d:/projects/Cora/apps/web/src/components/landing/Features.tsx): warm clay/cream spotlight treatment to differentiate roster zone.
  - [VideoSlot.tsx](/d:/projects/Cora/apps/web/src/components/landing/VideoSlot.tsx): cooler green-to-cream cinematic field to separate replay section tone.
- Added centered marquee keyframes/utilities in [globals.css](/d:/projects/Cora/apps/web/src/app/globals.css):
  - `@keyframes marqueeCentered`
  - `.animate-marquee-centered`
- Validation run:
  - `npm run lint --workspace=web` passed.

### The Reasoning
- The previous landing read as visually flat because large sections shared nearly identical base surfaces.
- Assigning each section a unique but related color atmosphere creates stronger narrative rhythm without abandoning the approved warm-vintage system.
- Keeping transitions implicit via background contrast (instead of decorative dividers) better matches the requested “different vibes” direction.

### The Tech Debt
- Gradient recipes are still inline per section; if this style direction stabilizes, we should extract them into reusable semantic theme tokens (e.g., `--landing-hero-bg`, `--landing-flow-bg`) for easier iteration.
- Marquee centering assumes current ticker density; if content count/width changes heavily, motion duration and phase may need re-tuning.

## 2026-05-03 - Landing Palette Accent Expansion (3 Surgical Additions from DESIGN.md Palettes)

### The Change
- Added `## Additional Accent Tokens` section to `docs/DESIGN.md` documenting which colors were pulled from which palette and why.
- Added 3 new CSS primitive tokens to `apps/web/src/app/globals.css`:
  - `--tone-dark: #121919` (near-black from Palette 2)
  - `--tone-teal: #3c5c5f` (dark teal from Palette 1)
  - `--tone-ecru: #e0ddaa` (warm ecru from Palette 3)
- Swapped `--accent-secondary` from `var(--tone-sage)` → `var(--tone-teal)` and updated all derived secondary tokens (`-light`, `-dim`, `-glow`). The `--teal` backward-compat alias chain updates automatically.
- Added `--color-surface-highlight: var(--tone-ecru)` to the `@theme inline` block as a new named surface token.
- Fixed `--color-accent-2-fg` from `#274137` → `#fffaf0` (ecru/white is readable on dark teal; forest green was not).
- Updated `apps/web/src/components/landing/CtaBanner.tsx` dark section gradient from `#274137 → #6f3a28` to `#121919 → #274137` — gives the only dark section on the landing a true near-black anchor.
- Updated `apps/web/src/components/landing/Features.tsx` scientist card portrait area from `--color-surface-alt` to `--color-surface-highlight` (ecru) for a vintage-academic feel.

### The Reasoning
- `--accent-secondary` (sage `#9db496`) was too low-saturation and low-contrast to carry active accent weight on cream/parchment backgrounds. The on-chain phase markers (Escrow, Settlement) looked muted — exactly the opposite of "authoritative blockchain transaction". Dark teal `#3c5c5f` is still clearly within the DESIGN.md palette family but has real visual presence.
- The CtaBanner was the only dark section on the landing, but its gradient (`forest → bark`) used two warm-similar tones at similar brightness. Stepping to near-black creates a stronger contrast rhythm — the eye needs a genuine dark rest beat after the warm-cream scroll.
- Ecru `#e0ddaa` on the scientist card portrait areas adds the olive-warm quality that reads as "aged academic paper" — appropriate for historical scientist characters — without disturbing the rest of the card layout.
- All 3 additions stayed 100% within DESIGN.md palette source material, so no rogue hex values were introduced.

### The Tech Debt
- `--tone-sage` is still defined as a primitive token and still used as a background tint in Hero, HowItWorks, Features, and TokenMarquee (radial blobs, ambient washes). This is correct and intentional — sage as a background tint is fine. Only its role as an active accent was replaced.
- The `--teal` alias now resolves to dark teal instead of sage. Non-landing screens that reference `--teal` directly should be audited to confirm the darker value still reads correctly in their context.
- `--color-surface-highlight` is currently only applied in `Features.tsx`; if ecru surfaces are used elsewhere, we should document the token's intended usage scope to prevent misapplication on components where it would clash.

## 2026-05-03 - Landing Section Color Temperature Pass (Warm vs Green Coherence)

### The Change
- **Hero** (`Hero.tsx`): Pushed bg fully warm (`#fdf6e4 → #f8e9ca → #f2ddb0`), removed the sage green radial blob, kept clay orbs only. Added `text-[var(--tone-bark)]` to section so headings/copy inherit warm dark brown, not forest green.
- **HowItWorks** (`HowItWorks.tsx`): Flipped bg from mixed warm-green to fully green (`#deebd8 → #d0e5ca → #c4dfc0`). Replaced the bark blob with a forest blob. Forest green `--foreground` text now reads at home on a green section. Updated phase card surface to `#f0f6ee` (mint-white) and green-toned shadow so it lifts cleanly off the green background without looking stark.
- **Features** (`Features.tsx`): Pushed bg to more purely golden-warm (`#faebd4 → #f8e4c0 → #f5d9a0`), removed sage green radial. Added `text-[var(--tone-bark)]` to section. Updated border to clay-toned `rgba(186,105,49,0.2)`.
- **Footer** (`Footer.tsx`): Added `text-[var(--tone-bark)]` — Footer sits on warm parchment bg `--background`; bark text is coherent there.
- VideoSlot and Navbar were left unchanged — VideoSlot already leans green-cool; Navbar is transparent initially and transitions naturally.

### The Reasoning
- `--foreground` (`#274137`, forest green) is a cool-hued dark. On warm orange-cream backgrounds (`#f8e8c7`, `#f3dfbb`) it creates a temperature conflict — the eye reads it as a mismatch because green and orange sit on opposite sides of the color wheel.
- The fix is not to change the global `--foreground` (that would break other screens), but to assign each landing section a dominant temperature and override text only where needed:
  - **Green sections**: let forest green text be the natural foreground — it's coherent.
  - **Warm sections**: override to `--tone-bark` (`#6f3a28`) which is a warm dark brown — harmonious with cream/golden bgs and still high-contrast.
- This creates a clear scroll rhythm: warm → neutral (marquee) → green → warm → green-cool (videoslot) → dark (ctabanner) — each beat feels intentional.

### The Tech Debt
- `text-[var(--tone-bark)]` overrides are applied at the section level, which means any child that does not explicitly set a color will inherit bark. This is intentional but should be documented so future component additions inside warm sections don't need to manually re-apply `--foreground`.
- HowItWorks phase card surface is now a hardcoded `#f0f6ee` instead of a token. If the section bg ever changes, this may need manual retuning. Extracting a `--color-surface-green` token would be cleaner long-term.

## 2026-05-03 - Landing Dark Theme Pivot + Palette Accent Typography

### The Change
- **`globals.css`**: Flipped `--background` from warm parchment `#fbf4df` → near-black forest `#0f1a14`. `--foreground` from forest green `#274137` → warm white `#f4f0e6`. Updated all `@theme inline` surface/border/muted tokens for dark context (`--color-surface: #172318`, `--color-surface-alt: #1d2d23`, `--color-surface-highlight: #1a2a1c`, `--color-border: rgba(157,180,150,0.22)`, `--color-muted: #8fa897`). Also fixed `--color-gold` to use `--tone-cream` (gold reads on dark, clay doesn't). Fixed `.arena-grid` lines from dark forest rgba to light mint rgba (were invisible on dark bg). Dimmed `.frame-cut::after` inner border from 72% to 28% opacity.
- **`Hero.tsx`**: Dark forest bg gradient. Removed bark text override. Fixed orb `mixBlendMode` from `multiply` (darkens) → `screen` (glows on dark). Added `<span className="text-[var(--tone-cream)]">` around scientist names in subtitle.
- **`TokenMarquee.tsx`**: Dark bg `#111d17`. Edge fades changed from `from-white` → `from-[#111d17]`. Border opacity reduced.
- **`HowItWorks.tsx`**: Dark forest bg. Dark card surface via `var(--color-surface)`. Added `<span className="text-[var(--tone-mint)]">` around "2 on-chain transactions." in h2.
- **`Features.tsx`**: Dark bark-tinted bg. Removed bark text override. Added `<span className="text-[var(--tone-cream)]">` around "chibi scientist." in h2.
- **`VideoSlot.tsx`**: Dark bg. `thumbnailBackground` base changed to dark `rgba(15,26,20,0.9)`. Intro and panel overlay changed from white washes to dark washes.
- **`CtaBanner.tsx`**: Deepened to `#080c09 → #0f1a14`. Text updated to `#f4f0e6`. Already had cream accent on "Battle sharper." — preserved.
- **`Footer.tsx`**: Removed bark text override — foreground is now warm white globally.

### The Reasoning
- The root issue was color temperature clash (green text on orange bg). Multiple partial fixes (per-section text overrides) were tried first but each created new issues. The cleanest resolution is a dark base where the palette colors become accent glow elements against dark rather than conflicting dominants on light.
- On a dark bg, the DESIGN.md palette becomes vivid typography accents: `--tone-cream` (#f8d694, golden) for warm key nouns, `--tone-mint` (#cbe3c1, mint) for on-chain/blockchain moments. This is the exact pattern requested (white base text, palette colors for accent words).
- `mixBlendMode: multiply` on the Hero orb was correct for light backgrounds (it darkens into the cream). On dark backgrounds it makes the orb invisible (darkening into near-black). `screen` blend mode adds light, making the clay orb glow properly on dark.
- The lobby/play screens use their own explicit dark bg classes (`lobby-bg`, inline dark gradients) and were not affected by the `--background` change.

### The Tech Debt
- The global `--background` change affects all routes that rely on it without explicit bg overrides. The `/connect` page and any future simple pages should be checked to confirm they look correct on dark.
- Accent word spans (`<span>` with color class) are now inline in component JSX. If copy changes, these spans need manual updates. Extracting copy with accent markup into `content.ts` would keep copy and formatting together.
- `--tone-cream` is now used as both a CSS variable AND hardcoded as `"var(--tone-cream)"` in inline CtaBanner style. These should be consolidated if a theming utility layer is added later.



---

## 2026-05-03 — Landing Page Redesign: Collectible Game-Site Direction

### The Change

Full art-direction overhaul of the landing page. Shifted from dark Web3/dev dashboard aesthetic to a warm, collectible battle-game splash page inspired by Axie/Pixelmon-style landing pages.

**Files touched:**

- **`globals.css`**: Added warm-section CSS tokens (`--warm-bg`, `--warm-surface`, `--warm-border`, `--warm-text`, `--warm-muted`, `--warm-card-shadow`). Added `.game-card` (rounded, thick-bordered collectible card), `.btn-game` / `.btn-game-primary` / `.btn-game-secondary` (chunky game buttons with offset shadows), `.paper-grain` (subtle noise texture for warm sections). Added `floatCard`, `sparkle`, `slowSpin`, `driftX` keyframes and corresponding animation utility classes.
- **`content.ts`**: Added `emoji` and `baseEmoji` fields to `ScientistProfile` for placeholder visuals. Rewrote all `LANDING_STAGES` copy to be battle-narrative ("Enter the Queue", "Lock Your Wager", "Battle Begins", "Victor Takes All"). Changed domain labels from "Off-chain"/"On-chain" to "Arena"/"Blockchain". Updated ticker items.
- **`Hero.tsx`**: Complete rewrite. Cinematic centered game-poster hero with: slow-spinning oversized CORA emblem background, scattered science doodle emojis, sparkle dots, floating collectible mini-cards (one per scientist with avatar, archetype badge, HP bar), vignette layers, preserved cursor-following orb, game-oriented copy ("A collectible battle game of brilliant minds" / "Collect scientists. Break their bases. Outsmart the arena."), chunky `btn-game` CTAs ("Enter Arena" + "Meet the Minds"). Removed arena-grid from hero.
- **`Features.tsx`**: Moved to warm cream surface (`--warm-bg`) with `paper-grain` texture and dot pattern. Cards use `.game-card` instead of `.frame-cut`. Portrait area now has CSS chibi placeholder (emoji avatar in circular frame + coat body shape + base object icon + rarity badge + archetype badge + HP bar). Dark bark text on cream. Drawer mechanic preserved with warm-toned styling.
- **`HowItWorks.tsx`**: Moved to warm cream surface with paper-grain. Copy changed to "How battles unfold" / "Pick your mind. Predict the move. Shatter the base." Stage card uses `.game-card` style with rounded step indicators. Removed arena-grid from interior. Sticky scroll-progress preserved.
- **`VideoSlot.tsx`**: Stays dark (arena/demo moment). Copy updated: "Demo Video" → "Watch the duel flow", added play button icon, stronger placeholder text ("Arena gameplay coming soon"). Arena-grid kept here.
- **`CtaBanner.tsx`**: Stays dark. Copy updated: "Think warmer. Battle sharper." → "Enter the arena of impossible minds." Added subcopy. Added floating decorative mini-cards on right side. Uses `btn-game` button. Arena-grid kept.
- **`Footer.tsx`**: Fixed broken `©` encoding (mojibake `�` → `©`).
- **`Navbar.tsx`**: Nav labels updated: "Flow"→"Minds", "Roster"→"How It Works", "Replay"→"Arena". Order changed to match new section order.
- **`page.tsx`**: Section order changed: Features (roster) now comes before HowItWorks (battle flow).

### The Reasoning

- **Section rhythm**: The old page was almost entirely dark green with white text. The new rhythm is: cinematic dark hero → warm cream roster → warm cream battle explainer → dark arena demo → dark CTA. This creates visual breathing room and makes the warm palette from DESIGN.md actually visible.
- **Art direction**: Without final character illustrations, we used CSS-based placeholder visuals (emoji avatars, shaped silhouettes, rarity/archetype badges, HP bars, floating mini-cards, science doodles, sparkles). These create the right compositional structure so real art can be swapped in later.
- **Game-card vs frame-cut**: `.frame-cut` (clipped HUD corners) stays for dark/battle sections (VideoSlot, arena UI). Warm sections use `.game-card` (rounded, thick borders, cartoon offset shadow) which feels more collectible/game-like.
- **Copy shift**: Replaced developer-facing language ("Solana Devnet", "Match Architecture", "4 phases, 2 on-chain transactions") with player-facing language ("A collectible battle game", "How battles unfold", "Pick your mind"). Blockchain details remain but are secondary.
- **Preserved**: Fonts (Caprasimo + Gabarito), palette tokens, cursor orb, scroll-progress mechanic, drawer expand, entrance animations, TokenMarquee.

### The Tech Debt

- **Placeholder art**: All character visuals are emoji/CSS shapes. Need to swap with real illustrated chibi art when available. The `emoji` and `baseEmoji` fields in `ScientistProfile` can be replaced with image URLs.
- **FloatingCard positions**: Hard-coded absolute positions for hero floating cards. May need responsive tuning at unusual viewport sizes.
- **Warm/dark transitions**: The seam between warm sections (Features/HowItWorks) and dark sections (TokenMarquee above, VideoSlot below) could benefit from gradient transition strips if the hard color shift feels too abrupt.
- **paper-grain SVG**: Using inline SVG data URL for noise texture. If performance is a concern on low-end devices, this could be replaced with a static PNG or removed.

---

## 2026-05-03 — Navbar Polish: High-Blur Glassmorphism

### The Change
Updated the navbar to handle the new section-based color transitions (Dark Hero → Warm Roster) more smoothly.

- **`Navbar.tsx`**: Increased backdrop blur from standard `xl` to a heavy `28px` (custom inline style). Switched the scrolled background from a near-solid forest green to a semi-transparent dark tint (`rgba(10,18,14,0.55)`). Forced all nav text (logo and links) to white with a subtle drop shadow (`text-shadow`) to maintain legibility regardless of the background color behind the blur.

### The Reasoning
- Standard backdrop blur was insufficient to mask the high-contrast transition when moving from the dark Hero to the light-cream Features section.
- Permanent white text with a shadow prevents the need for complex "scroll-aware" text color switching logic. The semi-transparent dark tint behind the white text ensures it pops even when over the warm parchment backgrounds.

### The Tech Debt
- **Inline Styles**: Used inline styles for `backdropFilter` and `textShadow` for rapid iteration. These should eventually be moved to `globals.css` as utility classes (e.g., `.glass-heavy`) to keep the component clean.

## 2026-05-03 - Hero Token Hints, Copy Tightening & CTA Cleanup

### The Change
- Added `WagerToken` type and `WAGER_TOKENS` constant to `apps/web/src/components/landing/content.ts` — SOL (`#9945FF`) and BONK (`#F7931A`) as initial entries.
- Patched `apps/web/src/components/landing/Hero.tsx` to import `WAGER_TOKENS` and render a token pill strip in the hero. Each pill is a glassy rounded capsule styled with inline `borderColor`, `background`, and `boxShadow` derived from the token's brand color, with a subtle hover scale effect.
- Changed the hero token label from “Wager with” to “Arena tokens” so the token hint feels more game-native and less finance/gambling-coded.
- Removed the main `Enter Arena` and `Meet the Minds` CTA buttons from `apps/web/src/components/landing/Hero.tsx` to keep the hero closer to a cinematic game splash screen.
- Tightened the hero copy to reduce repetition and make it feel more premium:
  - Eyebrow: “A collectible battle game of brilliant minds”
  - Title: “CORA”
  - Tagline: “Collect scientists. Break bases. Outsmart rivals.”
  - Supporting line: “Pick your mind. Predict the move. Shatter the base.”
- Updated the Navbar CTA button in `apps/web/src/components/landing/Navbar.tsx` to use the `.btn-game-primary` class so the main app entry point still has the established chunky game-button styling, while keeping a smaller padding profile.

### The Reasoning
- The hero should act more like a game-fi splash screen / world reveal than a SaaS conversion block. Removing the large hero CTAs keeps focus on the title, fantasy, floating cards, and token elements.
- Token hints still answer “what tokens are available?” without turning the hero into a finance dashboard or overloading it with competing actions.
- “Arena tokens” fits the game-world language better than “Wager with,” while still making SOL and BONK visible near the first impression.
- The single Navbar CTA now acts as the main entry point to the application, reducing hero clutter while preserving a clear path to enter.
- Token data lives in `content.ts` alongside other landing data, keeping it as the single source of truth. Adding a new token later is a one-line array push.
- Inline style for token brand colors avoids extending the Tailwind config for two hex values; the pattern stays consistent with how existing accent glows are handled in other hero layers.

### The Tech Debt
- Token icons are emoji/Unicode glyphs (`◎` for SOL, `🐶` for BONK). Replace with proper SVG token logos once assets are available.
- Only SOL and BONK are wired; any new token the backend accepts should be reflected here simultaneously to avoid UI/backend drift.
- The Navbar CTA overrides padding locally using Tailwind classes (`!px-5 !py-2 !text-sm`) because `.btn-game` is intrinsically quite large. If we use this smaller button variant often, extract a `.btn-game-sm` utility.

## 2026-05-03 - Token Marquee Infinite Scroll Fix

### The Change
- Fixed infinite scrolling in `apps/web/src/components/landing/TokenMarquee.tsx`.
- Changed the animation class from `.animate-marquee-centered` back to `.animate-marquee` (which transforms `translateX(0)` to `translateX(-50%)`).
- Removed `justify-center` from the track's parent container to allow standard left-aligned overflow.

### The Reasoning
- The `animate-marquee-centered` approach (translating from `-25%` to `-75%`) was prone to visual jumping or right-side starvation when coupled with `justify-center` flex alignment, depending on the viewport width and total element width.
- Standard left-aligned `animate-marquee` (`0` to `-50%` over 4 copies of content) is the canonical way to achieve a seamless, jumping-free infinite scroll.

### The Tech Debt
- The marquee speed is hardcoded to 34s in `globals.css`. If we add significantly more tokens in the future, the track width will increase, which would cause the apparent scroll speed to increase. We may need to dynamically calculate duration based on item count later.

## 2026-05-03 - CtaBanner Floating Cards Include Turing

### The Change
- Updated `apps/web/src/components/landing/CtaBanner.tsx` to display all scientists from the `LANDING_SCIENTISTS` array instead of slicing to the first two.
- Mapped a third rotation value (`2deg`) for the newly added third floating card.

### The Reasoning
- The user requested the third scientist (Alan Turing) to be visible alongside Einstein and Marie Curie in the floating cards decoration block.

### The Tech Debt
- The rotation mapping `i === 0 ? "4deg" : i === 1 ? "-3deg" : "2deg"` is hardcoded for exactly 3 items. If more scientists are added in the future, a generic function or looping sequence for `--float-rot` will be needed.

## 2026-05-03 - Connect Wallet Screen Dark Cinematic Redesign

### The Change
- Refactored `apps/web/src/components/connect/ConnectWalletScreen.tsx` to match the landing page's dark cinematic arena aesthetic.
- Replaced the light background grid with a deep gradient (`from-[#121919] to-[#0a0f0c]`), a dark `.arena-grid`, depth vignette, and ambient radial glows (`--tone-clay`, `--tone-teal`, `--tone-sage`).
- Added animated background elements: a faint, oversized "C" emblem, floating emoji cards (🧪, 🧬, 🔬, ⚔️) using `.animate-float-card`, and floating sparkle orbs using `.animate-sparkle`.
- Redesigned the centered wallet connection panel into a dark game-card style using a thick `var(--tone-bark)` border, dark background (`#172318`), shadow drop, and an inner accent frame. Added a subtle `.animate-orb-breath` glow behind the panel.
- Updated the copy to fit the game lore ("Arena Access", "Enter the Arena", "Wallet synced: ...", "Enter Lobby").
- Changed the typography to use `--font-caprasimo` and `--font-gabarito`. Connected status uses `font-mono`.
- Styled the "Continue" link using the `.btn-game .btn-game-primary` chunky button style.

### The Reasoning
- The user wanted the wallet connection screen to feel like an "arena gate" screen that matches the rest of the dark landing page direction, rather than a generic SaaS auth page or a light-themed placeholder.
- Incorporating existing CSS tokens (`--tone-bark`, `--tone-clay`, `--tone-teal`, `.arena-grid`, `.animate-float-card`) ensured the new design is cohesive with the landing page without requiring new global utility classes.
- Maintaining the `"use client"` and existing `useWallet` hook dependencies ensured that the functional logic was untouched while the visual layer received a massive upgrade.

### The Tech Debt
- The decorative emoji elements and floating cards are still using hardcoded strings/emojis. They should be swapped out with actual collectible card assets when the final art direction is available.
- Ambient glow positions and floating card positions are hardcoded using absolute percentages, which might require adjustments on extremely wide or narrow viewports.

## 2026-05-03 - Lobby Screens Visual Redesign

### The Change
- Refactored the entire `LobbyScreen.tsx` flow (`LobbySetup`, `CharacterSelect`, `MatchmakingWaiting`, `OpponentFound`) to adopt a dark cinematic arena aesthetic.
- Replaced light grid backgrounds with deep gradients (`from-[#121919] to-[#0a0f0c]`), radial glow orbs, and floating emoji card decorations.
- Updated all inner layout panels to dark `game-card` and `frame-cut` styles using `var(--tone-bark)`, `var(--tone-clay)`, and `var(--color-surface)`.
- Restyled matchmaking UI (waiting and found) to visually emphasize a VS fighting game aesthetic, complete with shimmer bars and dropping shadows.
- Styled unselected arena tabs with `saturate-50 opacity-60` to retain their accent color while remaining distinctly inactive.

### The Reasoning
- The lobby flow needed to match the dark cinematic aesthetic of the landing page and the newly redesigned `ConnectWalletScreen`.
- A pure CSS/Tailwind visual pass ensures all complex matchmaking and wallet logic remains intact while dramatically improving the user experience and visual hierarchy.

### The Tech Debt
- The hardcoded float positions for emojis are repeated across `ConnectWalletScreen` and `LobbyScreen`. They should ideally be abstracted into a unified `FloatingArenaDecorations` component.

## 2026-05-03 - Lobby Screens Warm Vintage Redesign Pivot

### The Change
- Pivoted the `LobbyScreen` shell from a deep cinematic dark gradient to a warm parchment dominant theme (`var(--warm-bg)`) with a dark radial vignette around the outer edges.
- Refactored `LobbySetup` to merge the arena selection list and preview board into a single, cohesive game-card container.
- Switched the text colors in `RoomPhaseHeader` from cold/dark themes to warm/bark tones.
- Transitioned `MatchmakingWaiting` and `OpponentFound` cards to warm surfaces (`var(--warm-surface)`) with dark `var(--tone-bark)` and `var(--tone-clay)` borders.
- Re-styled the alert toasts, error fallback screens, and deposit context cards to match the vintage warm layout rather than dark HUD.

### The Reasoning
- The fully dark shell felt too empty and disconnected from the vintage collectible warmth seen on the landing page's HowItWorks section.
- Moving to a game-board composition makes the UI feel like an actual physical collectible table.

## 2026-05-04 - Pre-Match Lobby Surface Separation Pass

### The Change
- Updated `apps/web/src/components/lobby/LobbySetup.tsx` to remove translucent beige layering and enforce clear panel hierarchy:
  - Left arena selector is now a parchment gradient panel (`#fff8e8 -> #f3e6c9`) with stronger right-side separation.
  - Token cards now use dedicated inactive/active gradients (`#fffaf0 -> #efe3c8` and `#fff1cf -> #f8d694`).
  - Selected token state now includes stronger border, raised shadow, accent glow, and explicit checkmark.
  - Header wallet/wager chips were restyled to dark forest + bark framing for consistency.
  - Right arena board background is now stable and dark (`#10231b/#18392d/#0d1a14`) and no longer uses `selectedArena.previewBg` as full panel background.
  - Arena colors are now used only as accents (icon circles, glow, borders) rather than full-surface swaps.
- Updated `apps/web/src/components/lobby/LobbyScreen.tsx` to strengthen overall shell separation:
  - Page background moved to a darker vignetted warm-forest treatment, clearly distinct from the lobby modal.
  - Decorative background elements were reduced to low-opacity ambient orbs (no boxed decorative icon tiles).

### The Reasoning
- The main issue was not global muddiness, but insufficient surface contrast where page shell, modal, side panel, and token cards all sat on near-identical beige values.
- Locking the right board to a premium dark surface preserves visual stability and prevents BONK selection from washing out the board.
- Dedicated token-card states make selection obvious at a glance and align with the game-lobby interaction model rather than dashboard controls.

### The Tech Debt
- The left-panel token icon placeholders are still text glyphs; once official SOL/BONK assets are available, these should become consistent icon components.
- Some decorative blur/spotlight values are hardcoded and may benefit from extraction into shared theme tokens if similar lobby variants are added.
## 2026-05-04 - Deposit Signing Unlock Fix for Opponent (Player 2) in Lobby

### The Change
- Updated [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) to remove the frontend-only temporary signing lock that inferred signing order from lexicographically sorted wallet addresses.
- Removed `useMemo`-based `deterministicPrimaryAddress` role inference and related lock controls:
  - `requiresTemporaryUnlock`
  - `isUxSignLocked`
  - `uxLockExpired` state + timeout effect
- Simplified `canAttemptSign` so deposit signing is gated only by real runtime conditions:
  - wallet connected
  - websocket connected
  - not currently signing/waiting
  - not already signed
- Removed the `"Waiting for server unlock..."` helper-text branch that depended on the deleted UX lock state.

### The Reasoning
- The previous lock used a client-side wallet sort heuristic to decide who signs first, which is not authoritative and can diverge from backend room role assignment (`playerA` / `playerB`).
- In mismatch cases, the UI could disable Player 2 even after Player 1 had signed, creating a deadlock-feeling flow despite backend being ready to accept the deposit confirmation.
- Using only actual connection/signing state on the frontend avoids false-negative lockouts and aligns behavior with server-driven state transitions.

### The Tech Debt
- Frontend still does not receive an explicit authoritative "you are playerA/playerB and currently allowed to sign" flag from backend state payloads.
- If strict sequential deposit enforcement is required in the future, the lock should be server-authoritative (role/permission in payload) rather than inferred on client.

## 2026-05-04 - Enable Real Solana Transactions for Deposit

### The Change
- Refactored `apps/web/src/lib/solana/signDepositIntent.ts` to actually invoke the backend at `POST /api/actions/challenge`.
- Removed dummy `MEMO` string compilation for `deposit_wager`.
- Fed `tokenMint` and `wagerAmount` dynamically to the backend from the client logic.

### The Reasoning
- **Mock Deprecation:** Clicking "Sign Deposit" in the frontend merely fired an arbitrary MEMO transaction, so no `wager_deposit` or `initialize_match` was executed on the blockchain! To properly integrate the CORA smart contract into the workflow, real Solana instructions provided by the server needed to be requested, signed, and broadcasted via the local wallet.

### The Tech Debt
- **Network Fees & Latency:** Real interactions mean users have to face actual blockhash/RPC latencies, which inherently introduce new possible friction scenarios. `signDepositIntent` includes minor retry handling, but a comprehensive polling/retry UI state might be needed for poor connections.

## 2026-05-04 - Fix Buffer Type for Solana Memo TransactionInstruction

### The Change
- Updated [apps/web/src/lib/solana/signDepositIntent.ts](/d:/projects/Cora/apps/web/src/lib/solana/signDepositIntent.ts) in `signMemoIntent`.
- Replaced memo instruction payload from `new TextEncoder().encode(memoMessage)` to `Buffer.from(memoMessage, "utf8")`.

### The Reasoning
- `TransactionInstruction.data` in the current Solana SDK typing expects a `Buffer`-compatible payload in this build configuration.
- `TextEncoder().encode(...)` returns `Uint8Array`, which triggered a TypeScript incompatibility during `next build`.
- Using `Buffer.from` preserves exact byte content while satisfying the expected instruction data type.

### The Tech Debt
- Build is now blocked by a separate pre-render error on `/lobby` (`useSearchParams` missing Suspense boundary), unrelated to this type fix.

## 2026-05-04 - Reapply Suspense Boundaries for connect/lobby/play Pages

### The Change
- Updated [apps/web/src/app/connect/page.tsx](/d:/projects/Cora/apps/web/src/app/connect/page.tsx) to wrap `ConnectWalletScreen` in `Suspense`.
- Updated [apps/web/src/app/lobby/page.tsx](/d:/projects/Cora/apps/web/src/app/lobby/page.tsx) to wrap `LobbyScreen` in `Suspense`.
- Updated [apps/web/src/app/play/page.tsx](/d:/projects/Cora/apps/web/src/app/play/page.tsx) to wrap `BattleScreen` in `Suspense`.

### The Reasoning
- These screens use `useSearchParams()` and must be rendered under a Suspense boundary when prerender/export runs in Next App Router.
- Missing boundaries caused repeated `missing-suspense-with-csr-bailout` failures beginning at `/connect`.
- Applying wrappers at route page boundaries keeps each fix isolated and avoids changing component internals.

### The Tech Debt
- Local build verification is currently blocked by Windows filesystem lock/permission errors in `.next` (`EPERM` unlink on chunk files).
- We should standardize a local clean-build workflow that ensures Node/Next processes are stopped before deleting `.next`.

## 2026-05-04 - Character Draft Screen Redesign (Roster-Focused + Dev Toggle)

### The Change
- Reworked [CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterSelect.tsx) to remove dashboard-style meta blocks from default player view and make the roster grid the centerpiece.
- Added a compact helper row and a `Dev Mode` toggle that gates debug-only data panels (selection state, opponent status, room status rail, and countdown).
- Rebuilt [CharacterCard.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterCard.tsx) into a collectible roster-card layout:
  - square portrait block with placeholder expression cue
  - stronger selected/active visual treatment (border, glow, lift)
  - base + role/supporting lines
  - compact stat presentation (short rows + mini inline meters + specialty chip)
  - full-width selection state footer (`Selected`, `Auto-assigned`, `Locked In`, etc.)
- Updated [RoomPhaseHeader.tsx](/d:/projects/Cora/apps/web/src/components/room/RoomPhaseHeader.tsx) with a high-contrast framed header surface to improve readability of `Setup` / `Draft Your Scientist` / supporting copy on dark lobby backgrounds.
- Kept existing flow controls in place (Back button, arena/token/wallet chips, Enter Queue CTA) via existing shell slots.

### The Reasoning
- The old top metadata cards pulled attention away from the primary draft action and made the screen feel like a dashboard.
- Moving non-essential state to a toggle keeps the default experience premium and player-focused while preserving QA/debug visibility.
- Character cards now follow a game-roster hierarchy instead of a generic data-card pattern, with selection feedback strong enough to feel decisively chosen.
- Compact stats preserve quick scanability without bloating card height or dominating vertical space.
- A dedicated contrast-backed heading container fixes title legibility immediately and aligns with the vintage arena art direction.

### The Tech Debt
- Portrait expression states are still placeholder UI cues (initial + micro-face element). Replace with real square portraits and selected-expression variants once art assets are available.
- Specialty metadata is partially sourced from `@shared/characterStats`; characters missing a shared specialty currently fall back to `Generalist` in UI.
- Dev Mode state is local UI state only; if persistent QA toggles are needed, we should wire query-param or localStorage sync.

## 2026-05-04 - Draft Dev Mode Toggle Availability Adjustment

### The Change
- Updated [CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterSelect.tsx) so the `Dev Mode` toggle is always available in draft UI, even when countdown/opponent metadata is absent.
- Added a debug-panel fallback line (`No countdown/opponent sync metadata in this phase.`) for pre-queue contexts.

### The Reasoning
- QA still needs access to selection/room debug panels in the normal character-select phase, not only in timed room-preview states.

### The Tech Debt
- If we introduce role-based dev tooling, this toggle should be gated behind environment or permission controls.

## 2026-05-04 - Character Draft Screen Minor Layout Refinement Pass

### The Change
- Updated [apps/web/src/components/lobby/CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/lobby/CharacterSelect.tsx):
  - Repositioned `Back` into the same top-right chip row (`arena`, `wager`, `wallet`) to remove the detached floating feel.
  - Tightened chip/button vertical padding and CTA size.
  - Applied `className="h-[100svh] overflow-hidden py-3 md:py-4"` on `RoomPhaseShell` usage for this screen to keep the full draft composition inside one desktop viewport.
- Updated [apps/web/src/components/room/RoomPhaseHeader.tsx](/d:/projects/Cora/apps/web/src/components/room/RoomPhaseHeader.tsx):
  - Removed the boxed heading panel treatment (no bordered/background card).
  - Kept readability via typography and text-shadow only.
  - Reduced header spacing and font sizing slightly for tighter vertical rhythm.
- Updated [apps/web/src/components/character/CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterSelect.tsx):
  - Reduced spacing between helper row, debug block, and card grid.
  - Tightened card grid gap from `gap-4` to `gap-3`.
- Updated [apps/web/src/components/character/CharacterCard.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterCard.tsx):
  - Reduced card min height (`350px` -> `292px`).
  - Reduced portrait max size and compressed internal spacing/typography/chips/footer height.
  - Preserved the same visual language and selection-state cues.

### The Reasoning
- The previous pass solved hierarchy direction, but the screen still felt vertically heavy and pushed CTA visibility below the fold.
- Keeping Back inside the same right-column control cluster makes the header composition feel intentional and aligned.
- Removing the heading box follows the requested integrated composition while preserving contrast.

### The Tech Debt
- `h-[100svh] overflow-hidden` is intentionally scoped to this screen and viewport fit goal. If card count/metadata grows, we may need responsive fallback behavior for smaller desktop heights.
- CTA/chip density is tuned for this draft screen specifically; if design tokens for compact HUD controls are introduced, this should be normalized into shared size variants.

## 2026-05-04 - Character Card Micro-Polish (Pill Stats + Role Styling)

### The Change
- Updated [apps/web/src/components/character/CharacterCard.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterCard.tsx) to replace long bar-style stat rows with compact trait pills.
- Kept existing stat data and labels, now rendered as lightweight chips (e.g. `LOGIC 92`, `COMPUTATION 88`) in a wrapped pill group.
- Replaced raw role text (`Role: ...`) with a styled metadata chip (`Sequence Specialist`) and kept multiplier as a compact companion chip (`x1.5`).
- Preserved all existing card structure and interaction states (portrait, selected state, status footer).

### The Reasoning
- Bar meters still read as RPG/dashboard UI and carried unnecessary visual weight for this collectible roster card direction.
- Pill-based stat traits improve scan speed while reducing visual bloat and preserving data clarity.
- Role metadata now feels integrated into the card system rather than plain label-value text.

### The Tech Debt
- Stat labels are currently rendered in full uppercase text; if longer labels are introduced later, we may want tokenized short labels or controlled wrapping rules.

## 2026-05-04 - Character Draft Layout Balance Pass (Upper Section Breathing Room)

### The Change
- Updated [apps/web/src/components/lobby/CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/lobby/CharacterSelect.tsx):
  - Increased top-biased shell padding for this phase (`pt-5/6`, `pb-3/4`) while keeping viewport-locked layout.
  - Added a small wrapper margin above the roster section (`mt-2 md:mt-3`) so cards sit lower.
- Updated [apps/web/src/components/room/RoomPhaseHeader.tsx](/d:/projects/Cora/apps/web/src/components/room/RoomPhaseHeader.tsx):
  - Increased heading block breathing room via slightly larger bottom margin and larger title/subtitle vertical spacing.
- Updated [apps/web/src/components/character/CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterSelect.tsx):
  - Increased spacing under the `Roster / Selected` row (`mb-5`).
  - Increased spacing below the optional Dev Mode panel (`mb-5`) for balanced separation before the card grid.

### The Reasoning
- After card compaction, the composition looked top-tight and bottom-light. Increasing only upper-layout spacing restores visual balance without re-inflating cards.

### The Tech Debt
- Header spacing is shared through `RoomPhaseHeader`; if another phase later needs denser layout, we may introduce a compact header variant prop.

## 2026-05-04 - Character Card Action-Row Spacing Micro-Adjustment

### The Change
- Updated [apps/web/src/components/character/CharacterCard.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterCard.tsx) to add a small separation above the bottom action row (`Tap to Select` / `Selected`).
- Kept existing card structure and sizing by wrapping the action row with `mt-auto pt-2`, then rendering the original action chip inside.

### The Reasoning
- The action row felt visually cramped against the stat pills. This adds breathing room without reintroducing bulk or changing card content hierarchy.

### The Tech Debt
- Spacing is currently local to this component. If other selectable cards adopt similar bottom action treatments, we may want a shared spacing token/utility.

## 2026-05-04 - Draft Header Reading-Flow Refinement (Back Button Left)

### The Change
- Updated [apps/web/src/components/lobby/CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/lobby/CharacterSelect.tsx):
  - Moved `Back` out of the top-right chip cluster.
  - Added a lightweight left-aligned `Back` control above the heading flow.
  - Kept top-right area focused on contextual chips (arena / wager / wallet).
- Extended shared room header plumbing to support pre-heading navigation content:
  - [apps/web/src/components/room/RoomPhaseHeader.tsx](/d:/projects/Cora/apps/web/src/components/room/RoomPhaseHeader.tsx): added optional `preHeadingSlot` rendered above eyebrow/title/subtitle.
  - [apps/web/src/components/room/RoomPhaseShell.tsx](/d:/projects/Cora/apps/web/src/components/room/RoomPhaseShell.tsx): passed through optional `preHeadingSlot` prop.

### The Reasoning
- `Back` is navigation, so placing it at the start of the content sequence improves reading order and reduces visual competition with status chips.
- The right column now reads as purely contextual state, while navigation starts the left-column flow.

### The Tech Debt
- `preHeadingSlot` is now available for other phases; if reused heavily, we may want a dedicated nav-style variant token to standardize button appearance across screens.

## 2026-05-05 - Draft Header Micro-Spacing Tweak (Back vs SETUP)

### The Change
- Updated [apps/web/src/components/room/RoomPhaseHeader.tsx](/d:/projects/Cora/apps/web/src/components/room/RoomPhaseHeader.tsx) to increase spacing below the `preHeadingSlot` container (`mb-2` -> `mb-3`).
- This creates a slightly clearer separation between the left-side `Back` navigation control and the `SETUP` eyebrow.

### The Reasoning
- `Back` should read as navigation preceding page content, not as a label attached to the heading block.

### The Tech Debt
- Spacing value is shared for any future usage of `preHeadingSlot`; if other screens require denser nav/header spacing, we may introduce a per-screen spacing override.

## 2026-05-05 - MatchmakingWaiting Dark Arena Visual Redesign

### The Change
- Refactored [apps/web/src/components/lobby/MatchmakingWaiting.tsx](/d:/projects/Cora/apps/web/src/components/lobby/MatchmakingWaiting.tsx) visual styling to match dark arena direction:
  - Player and opponent cards moved from warm/light surfaces to dark forest-glass gradients.
  - Added subtle radial highlight overlays and deeper shadows for cinematic depth.
  - Upgraded center `VS` composition with a circular accent ring/orb treatment.
  - Improved title/subtitle readability in searching/error/timeout states using cream/gold foreground colors.
  - Updated segment labels and bar track backgrounds to dark-compatible contrast while preserving accent fill.
  - Updated flavor text color to mint for legibility on dark background.
- Kept CTA/actions (`Cancel`, `Keep Searching`) and layout structure intact.

### The Reasoning
- Prior light-surface cards visually clashed with the dark arena shell and weakened matchmaking tension.
- This pass aligns the waiting screen with the newer game-like mood: dark surfaces, cream text, clay/gold accents, and stronger versus framing.

### The Tech Debt
- Visual tokens are still mostly inline in this component. If we standardize a dark-panel system for all room phases, these styles should be extracted into shared classes/tokens.
- Failure-state title color currently shares one gold-readable treatment for both timeout and error; future UX may want distinct semantic tones if error taxonomy expands.

### Guardrails Kept
- Matchmaking progress logic, stage timing, and bar animation behavior were not changed.

## 2026-05-05 - MatchmakingWaiting Versus-Card Refinement (Square Placeholders + Clean VS)

### The Change
- Updated [apps/web/src/components/lobby/MatchmakingWaiting.tsx](/d:/projects/Cora/apps/web/src/components/lobby/MatchmakingWaiting.tsx) matchup row styling:
  - Added square portrait placeholder block to the **player** card (left side) and kept horizontal card structure.
  - Added matching square placeholder block to the **opponent** card while scanning (left side), with `Scanning` + `Unknown` content on the right.
  - Switched matchup cards to warm parchment surfaces with bark/clay framing for stronger contrast against dark arena shell.
  - Removed the circular `VS` container and replaced it with clean centered `VS` typography with subtle glow/shadow only.
  - Added lightweight `YOU` chip on player card metadata area.
- Kept top-right cancel, arena/wager label, title/subtitle, progress bars, and retry behavior in place.

### The Reasoning
- The matchup section now reads as an intentional versus composition instead of two plain text blocks.
- Square placeholders make the layout ready for future portrait/icon assets while preserving current scanning state.
- Warm cards increase focal contrast and keep cohesion with CORA�s parchment/vintage style without looking like generic white dashboards.

### The Tech Debt
- Opponent card currently always renders unknown/scanning placeholder in this component�s current states; when a matched-opponent payload is wired here, we should feed portrait/name/base into the same left-icon/right-info horizontal template without changing structure.

### Guardrails Kept
- Matchmaking progress logic and bar animation behavior were not changed.

## 2026-05-05 - MatchmakingWaiting Opponent-State Layout Refinement

### The Change
- Updated [apps/web/src/components/lobby/MatchmakingWaiting.tsx](/d:/projects/Cora/apps/web/src/components/lobby/MatchmakingWaiting.tsx) opponent card behavior with explicit state-based layouts:
  - **Unknown/searching state**: dark centered placeholder card (`SCANNING` + `Unknown`) with optional centered square placeholder block.
  - **Matched-opponent state (future-ready)**: warm horizontal card matching player composition (square portrait on left, opponent info on right).
- Added optional props to support matched rendering without breaking current call sites:
  - `opponentScientist?: Scientist | null`
  - `opponentWalletAddress?: string`
- Kept `VS` as clean centered typography (no circular container).

### The Reasoning
- The horizontal icon-left/text-right pattern is ideal for actual profile cards, but looked awkward when the opponent is unknown.
- Centered dark placeholder communicates temporary searching state more clearly and avoids off-center visual weight.
- Warm horizontal card on match provides a clear visual transition from searching to found opponent.

### The Tech Debt
- Matched opponent data is not yet wired from current waiting-phase parent flow, so the matched branch is prepared but not currently activated in normal waiting route.

### Guardrails Kept
- Matchmaking progress logic and bar animation behavior were not changed.

## 2026-05-05 - MatchmakingWaiting Final Opponent-State Polish

### The Change
- Updated [apps/web/src/components/lobby/MatchmakingWaiting.tsx](/d:/projects/Cora/apps/web/src/components/lobby/MatchmakingWaiting.tsx) unknown/matched opponent rendering behavior:
  - **Unknown/searching state**: removed the square `?` placeholder block; card now shows centered `SCANNING` + `Unknown` only on dark surface.
  - **Matched state (future-ready branch)**: preserved warm horizontal portrait-left/info-right structure so it mirrors player-card pattern.

### The Reasoning
- Unknown state should feel minimal and temporary, not like a partially-rendered profile card.
- Portrait placeholder should appear only when a real opponent exists, which creates clearer state transition and stronger visual symmetry.

### The Tech Debt
- Matched-opponent branch is ready but depends on parent flow wiring of `opponentScientist` / `opponentWalletAddress` for runtime activation.

### Guardrails Kept
- Matchmaking progress logic and progress bar animation behavior were not changed.

## 2026-05-05 - MatchmakingWaiting TS Narrowing Fix (Matched Opponent Branch)

### The Change
- Updated [apps/web/src/components/lobby/MatchmakingWaiting.tsx](/d:/projects/Cora/apps/web/src/components/lobby/MatchmakingWaiting.tsx) to fix TypeScript nullability warnings in the matched-opponent JSX branch.
- Replaced `hasMatchedOpponent` boolean check with a concrete narrowed variable:
  - `const matchedOpponent = opponentScientist ?? null`
  - branch now uses `matchedOpponent ? (...) : (...)`
  - matched branch reads `matchedOpponent.*` fields.

### The Reasoning
- Boolean coercion on optional values does not always provide sufficient narrowing for TS in JSX paths. Using a nullable local with direct truthy check guarantees safe narrowing.

### The Tech Debt
- None significant; this is a local type-safety cleanup and keeps behavior unchanged.

## 2026-05-05 - OpponentFound Versus-Screen Redesign (Post-Match Deposit Phase)

### The Change
- Refactored [apps/web/src/components/lobby/OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) to match the newer matchmaking versus-screen style while preserving signing/socket flow.
- Updated header/content hierarchy to player-facing match-confirmation copy:
  - Eyebrow: `{arena.label} � $${wagerUsd} {arena.token}`
  - Title: `Rival Locked`
  - Subtitle: `Sign the deposit before the timer expires.`
- Rebuilt versus row into warm horizontal matchup cards over dark arena shell:
  - Player and opponent cards now use square portrait placeholders on the left and info content on the right.
  - Added `YOU` / `RIVAL` chips for clear side identity.
  - Kept simple centered `VS` text with glow/shadow and no circular container.
  - Opponent card remains revealed/matched style even when scientist fallback is not yet synced (`Rival Synced` + fallback base text), per requested behavior.
- Moved `RoomStatusRail` behind a local player-facing visibility toggle:
  - Hidden by default.
  - Toggle label switches between `Show Room Status` / `Hide Room Status`.
  - Not labeled as dev mode.
- Elevated deposit action area by wrapping existing `DepositPanel` in a dark integrated action container so the signing step is visually central.
- Kept error alert behavior and dismiss/timer logic, while refreshing alert surface to a cohesive warm treatment.

### The Reasoning
- This phase should read as direct continuation of matchmaking: rival confirmed, immediate deposit action.
- Warm versus cards provide strong focal contrast against dark arena backgrounds and align with updated matchmaking language.
- Always-visible room status read as debug infrastructure; collapsing it by default keeps the player flow clean while retaining access when needed.

### The Tech Debt
- `DepositPanel` internal visual tokens remain shared/global and still include lighter defaults; this pass integrates it via wrapper styling rather than deep component theming.
- If this versus-card pattern is reused across multiple phases, extracting a shared matchup-card component will reduce style duplication.

### Guardrails Kept
- No changes to deposit signing logic, socket behavior, reconnect flow, redirect flow, countdown logic, status/hint helpers, or badge generation.

## 2026-05-05 - Play/Battle Screen Arena Visual Refactor (UI + FE-only Combat FX)

### The Change
- Refactored [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) visual layer to align `/play` with the updated lobby/draft/matchmaking/opponent-found direction:
  - Switched shell/background from light grid to dark cinematic arena gradient.
  - Updated headers/chips/alerts/guard panels to dark-compatible cream/gold palette.
  - Replaced circular `You` / `Enemy` placeholders with **4:5 character placeholders** (left player, right opponent) using character-based gradient fallback visuals.
  - Replaced tall base bars with **1:1 base placeholders** per side, including base HP labels.
  - Preserved bottom card hand flow but re-skinned cards to warm collectible surfaces.
- Added FE-only battle presentation state in [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - `characterActionSide`
  - `projectile`
  - `playerBaseFx` / `opponentBaseFx`
- Added FE-only placeholder projectile animation driven by existing `lastDamageEvent` (no backend protocol changes):
  - attacker pose pulse
  - projectile travel (attack/heal variant)
  - target base hit/heal pulse
  - local cleanup timers
- Kept active question modal, settlement modal, and share overlay behavior intact while updating visual surfaces to match new arena style.
- Updated shared room UI surfaces for dark coherence:
  - [CountdownBar.tsx](/d:/projects/Cora/apps/web/src/components/room/CountdownBar.tsx)
  - [PlayerRoomStatus.tsx](/d:/projects/Cora/apps/web/src/components/room/PlayerRoomStatus.tsx)
  - [RoomStatusRail.tsx](/d:/projects/Cora/apps/web/src/components/room/RoomStatusRail.tsx)

### The Reasoning
- The previous `/play` surface diverged from the rest of the updated flow and looked like a legacy light dashboard.
- Character/base placeholders needed explicit future-friendly framing (4:5 and 1:1) so art/pose systems can be swapped in later without structural rework.
- FE-only projectile/pose/base FX creates combat readability immediately while keeping server/game loop semantics unchanged.

### The Tech Debt
- Projectile travel currently uses coarse anchored coordinates (UI placeholder pass). Once final stage layout/asset anchors are fixed, this should move to measured DOM anchor coordinates for precision.
- Character/base visuals are still placeholder glyph/gradient assets; replace with final art and state-specific sprites/poses when available.
- Shared room status components are now dark-biased; if any warm-surface contexts require old look, introduce variant props/tokens instead of one-size styling.

### Guardrails Kept
- No changes to `useMatchSocket` semantics, gameplay scoring, answer flow, settlement flow, countdown source logic, route/query handling, or backend message contracts.

## 2026-05-05 - Challenge Share Card Final Polish (Light Collectible Pass)

### The Change
- Restyled [apps/web/src/components/challenge/ChallengeShareCard.tsx](/d:/projects/Cora/apps/web/src/components/challenge/ChallengeShareCard.tsx) into a light collectible challenge-ticket composition:
  - premium light cream/stone framed surface
  - strong two-zone layout (hero/editorial left + utility/QR right)
  - square challenger portrait placeholder (replacing generic circular avatar)
  - cleaner hierarchy for title, challenger identity, status chip, and description
  - utility panel with QR + token/wager/arena metadata rows
  - action buttons preserved (`Copy Link`, `Save As JPG`, `Share On X`) with light premium framed styling
  - link + notice handling unchanged
- Updated [apps/web/src/lib/challenge/renderChallengeCardJpg.ts](/d:/projects/Cora/apps/web/src/lib/challenge/renderChallengeCardJpg.ts) to visually match the new light collectible design in canvas export:
  - light premium framed background
  - editorial hero zone and utility zone
  - square challenger placeholder badge
  - clearer challenge hierarchy + status chip
  - QR + metadata ticket block
  - polished link strip
- Kept [apps/web/src/lib/challenge/createChallengeLink.ts](/d:/projects/Cora/apps/web/src/lib/challenge/createChallengeLink.ts) unchanged functionally.

### The Reasoning
- The share card should read like a premium collectible pass/challenge ticket rather than a dashboard widget.
- Light editorial styling differentiates challenge sharing from dark arena gameplay while keeping CORA identity coherent.
- Updating both preview and JPG renderer together prevents style drift between what users see and what they download/share.

### The Tech Debt
- Canvas export and in-app preview are aligned stylistically, but not pixel-identical. If strict design parity is required later, we should centralize layout tokens and dimensions used by both renderers.
- QR rendering still depends on remote QR image generation; if offline/resilience is needed, we should embed a local QR generation fallback.

## 2026-05-05 - Real-Only E2E Flow + CharacterId WS Wiring (FE)

### The Change
- Removed FE mock-mode pathways and integration-mode banner plumbing from the web app:
  - Deleted [apps/web/src/components/ui/IntegrationModeBanner.tsx](/d:/projects/Cora/apps/web/src/components/ui/IntegrationModeBanner.tsx)
  - Simplified [apps/web/src/lib/config/runtimeModes.ts](/d:/projects/Cora/apps/web/src/lib/config/runtimeModes.ts) to only retain `allowDevRoomPreview`.
  - Removed mock/deposit mode env documentation from [apps/web/.env.example](/d:/projects/Cora/apps/web/.env.example).
- Forced real settlement confirmation path in [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - removed `settlementMode === "mock"` branch and mock signature generation.
  - release confirmation now always follows Phantom signing flow.
- Removed wallet/address dev fallback in battle flow:
  - [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) now requires connected wallet address only.
- Wired FE-selected character ID to backend room join:
  - Extended [apps/web/src/hooks/useMatchSocket.ts](/d:/projects/Cora/apps/web/src/hooks/useMatchSocket.ts) to send `characterId` query param on WS connect.
  - Passed `characterId` from [apps/web/src/components/lobby/OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) and [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx).
- Aligned roster IDs/names with shared-types (`einstein`) and removed Newton leftovers:
  - Updated [apps/web/src/components/lobby/LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx)
  - Updated [apps/web/src/app/dev/room-states/page.tsx](/d:/projects/Cora/apps/web/src/app/dev/room-states/page.tsx)
  - Updated battle visual mapping in [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) to use Einstein path only.
- Replaced opponent character deterministic fallback with backend-authoritative mapping in [OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) by resolving from `gameState.opponent.characterId`.

### The Reasoning
- BE flow (per `DEVLOG-BE.md`) is now sequential-deposit + WS authoritative state; FE must stop short-circuiting via mock modes and must pass `characterId` on WS join so backend `playerMeta.characterId` is correct.
- Keeping mock toggles in FE created drift against BE E2E readiness and caused confusing mixed behavior (real deposit with mock settlement).
- Using backend-provided opponent character metadata ensures UI reflects true room state instead of deterministic local placeholders.

### The Tech Debt
- `next build` validation is currently blocked locally by locked `.next` artifacts (`EPERM`/access denied on unlink/remove), likely due to an external process holding handles. `npm run lint` passes.
- `allowDevRoomPreview` remains in runtime config for internal UI preview scenarios; if full prod-hardening is desired, this can be removed in a follow-up.

## 2026-05-05 - Battle Settlement UI Switched to Backend-Authoritative Mode

### The Change
- Refactored [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) to remove client-side settlement confirmation flow.
- Deleted FE-only settlement release state and actions:
  - removed `releaseState`, `releaseError`, `releaseSignature`
  - removed `onConfirmFundRelease()` and `getReleaseButtonLabel()`
  - removed settlement warning alert path derived from `releaseError`
- Removed client memo-sign settlement dependency usage in battle screen:
  - removed `useConnection` usage
  - removed `signSettlementReleaseIntent` usage
- Replaced "Fund Release Confirmation" card with backend-authoritative settlement card:
  - displays server-origin `settlementSignature` and `serverPublicKey` from `matchResult` payload when available
  - otherwise shows waiting message for server settlement payload

### The Reasoning
- Backend already owns settlement orchestration and signature emission (server oracle flow), so FE should present backend state rather than trigger a second client settlement intent.
- This avoids duplicate/conflicting settlement semantics and aligns FE with BE E2E contract while keeping services decoupled.

### The Tech Debt
- FE still cannot show definitive on-chain settlement transaction signature because current WS payload does not include tx hash. If product wants this, BE needs to expose settlement tx id in an event/payload and FE can render it.

## 2026-05-05 - FE Alignment Follow-up: Room Status + MatchFound Passive Support

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) to align active-play gating with current backend room statuses:
  - removed explicit `settling` branch from status label mapping
  - changed `isPlayStateReady` to depend on `playing` or match-complete signals instead of `settling`
- Extended [apps/web/src/hooks/useMatchSocket.ts](/d:/projects/Cora/apps/web/src/hooks/useMatchSocket.ts) with passive server queue-assignment event support:
  - added `lastMatchFound` state
  - handles both `matchFound` and `matchFoundWaiting` message types for compatibility
  - returns `lastMatchFound` to consumers
- Integrated non-breaking `matchFound` awareness in [apps/web/src/components/lobby/OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx):
  - derives `reassignedRoomId` from socket event when server announces a different room
  - surfaces this via deposit helper text (no forced navigation, no hard interrupt)

### The Reasoning
- Backend currently transitions `depositing -> playing -> finished`; FE no longer treats `settling` as a required active phase.
- Backend can emit `matchFound` in requeue paths; FE now records that event so UI can stay in sync without coupling to backend internals or direct function calls.
- Chosen UX is intentionally passive to avoid breaking existing flow while still exposing authoritative server signals.

### The Tech Debt
- `matchFound` signals are currently surfaced as guidance text only. If product wants automatic room handoff, FE will need an explicit navigation/resume policy agreed with BE contract semantics.

## 2026-05-05 - FE Sync: Settling Status + /match Forward Compatibility (No BE edits)

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - added explicit `settling` status label in `getStatusLabel`
  - updated play-state readiness gate to treat `settling` as an active ready state
  - relaxed hard guard that previously required `arena/token/wager` query params; now only `roomId` is mandatory (allows backend-authoritative context evolution)
- Updated [apps/web/src/lib/matchmaking/queueMatch.ts](/d:/projects/Cora/apps/web/src/lib/matchmaking/queueMatch.ts):
  - request now supports optional `tokenMint` / `wagerAmount` payload fields
  - response parser now supports optional `tokenMint` / `wagerAmount` / `roomType` fields while preserving backward compatibility with `{ roomId }`
- Updated [apps/web/src/components/lobby/LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx):
  - sends optional `tokenMint` to `/match` from selected arena token symbol

### The Reasoning
- BE/game flow now uses `settling` in shared contract, so FE battle status/gating should not treat it as unknown/terminal too early.
- `/match` contract may evolve to include richer room context; FE now tolerates enriched responses and can pass optional token context without breaking existing BE behavior.
- Keeping `roomId` as the only hard `/play` requirement reduces brittle FE dependence on URL-carried context as backend state becomes authoritative.

### The Tech Debt
- Optional `/match` fields are currently parsed but not yet fully consumed end-to-end in FE routing/state (future enhancement once BE contract is finalized for public room context).

## 2026-05-05 - Deposit Signing UI Restyle for Dark Arena Integration

### The Change
- Restyled [apps/web/src/components/deposit/DepositPanel.tsx](/d:/projects/Cora/apps/web/src/components/deposit/DepositPanel.tsx) with dark-arena-compatible visuals while preserving all existing props and behavior.
  - Heading chip now uses cream/gold-on-dark treatment instead of muted dashboard green.
  - Subtitle shifted to muted cream for dark-surface readability.
  - Primary action button restyled to chunky game-button treatment:
    - enabled: clay/bark gradient + cream text + stronger shadow/highlight
    - disabled: muted forest gradient + reduced opacity/readability preserved
  - `disabled={!canPrimaryAction}` behavior unchanged.
- Restyled [apps/web/src/components/deposit/DepositStatusCard.tsx](/d:/projects/Cora/apps/web/src/components/deposit/DepositStatusCard.tsx):
  - Replaced light card background with dark forest gradient surface.
  - Updated border/shadow/inset/highlight to warm arena console style.
  - Updated text hierarchy colors:
    - status label: gold accent
    - helper text: muted mint/cream
    - countdown: strong gold with shadow
    - signature: secondary muted mint in subtle inset strip
  - Kept all slot behavior (`walletSlot`, `retrySlot`, `cancelSlot`) and spacing support intact.

### The Reasoning
- Opponent-found/matchmaking UI moved to dark arena styling; shared deposit components still looked like legacy white dashboard blocks and broke visual continuity.
- This pass unifies the deposit signing area with arena visuals without touching functional logic or parent integration.

### The Tech Debt
- Shared deposit components are now dark-default. If future light-theme contexts reuse them, a variant/theming prop may be needed instead of per-page overrides.

## 2026-05-05 - FE First Pass: History + Wallet Inspect Foundation (Backend-Stub Ready)

### The Change
- Added backend-facing history client and normalized frontend types:
  - [apps/web/src/lib/history/historyApi.ts](/d:/projects/Cora/apps/web/src/lib/history/historyApi.ts)
  - [apps/web/src/lib/history/historyTypes.ts](/d:/projects/Cora/apps/web/src/lib/history/historyTypes.ts)
- Added reusable history / wallet-inspect UI primitives:
  - [apps/web/src/components/history/HistoryButton.tsx](/d:/projects/Cora/apps/web/src/components/history/HistoryButton.tsx)
  - [apps/web/src/components/history/HistoryDrawer.tsx](/d:/projects/Cora/apps/web/src/components/history/HistoryDrawer.tsx)
  - [apps/web/src/components/history/WalletInspectButton.tsx](/d:/projects/Cora/apps/web/src/components/history/WalletInspectButton.tsx)
  - [apps/web/src/components/history/WalletInspectPanel.tsx](/d:/projects/Cora/apps/web/src/components/history/WalletInspectPanel.tsx)
- Added arena playability hook (advisory-first):
  - [apps/web/src/hooks/useWalletArenaPlayability.ts](/d:/projects/Cora/apps/web/src/hooks/useWalletArenaPlayability.ts)
- Integrated primary history access in room-phase shell usage:
  - Updated [apps/web/src/components/lobby/CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/lobby/CharacterSelect.tsx) to render `HistoryButton` via `rightPanelSlot` and open shared `HistoryDrawer`.
  - Updated [apps/web/src/components/lobby/LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx) to pass `walletConnected` into `CharacterSelect`.
- Integrated wallet inspect shortcuts + advisory playability + history access in pre-battle deposit phase:
  - Updated [apps/web/src/components/lobby/OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx).
- Integrated settlement-modal history action and wallet inspect shortcuts in battle screen:
  - Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx).
- Validation:
  - `npm run lint --workspace apps/web` passes.

### The Reasoning
- FE calls backend endpoints only (`/api/history/...`) and never calls GoldRush directly, matching architecture boundaries before BE integration is live.
- The new UI contracts are backend-normalized and player-facing (`History`, `Wallet Inspect`, `Arena playable`), avoiding raw provider payload exposure.
- Playability is advisory-first by design: UI surfaces readiness (`Playable`, `Needs token`, `Unable to inspect`) without hard-blocking flow during backend maturation.
- Shared components keep styling consistent with the existing arena/parchment/clay visual language and prevent one-off explorer-like UI.

### The Tech Debt
- `historyApi.ts` currently relies on fallback behavior (`NEXT_PUBLIC_HISTORY_FALLBACK_MODE`) until BE endpoints are fully implemented and normalized.
- `WalletPlayability.reliable` semantics are provisional; once BE finalizes trust signals, FE should tighten blocking/allowance behavior if required.
- History views are currently scoped to arena/wallet lists; once BE exposes richer match identifiers and explorer links, FE can add direct per-match detail focus and deep links.

## 2026-05-05 - Wallet Inspect Chip Relocated to Lobby Setup (Arena Select)

### The Change
- Moved the advisory wallet-inspection indicator from character selection to the first lobby phase (`Choose Your Arena`):
  - Removed playability chip usage from [apps/web/src/components/lobby/CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/lobby/CharacterSelect.tsx).
  - Added token-aware balance/inspect chip in [apps/web/src/components/lobby/LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx) using `useWalletArenaPlayability`.
- Chip now follows selected arena token context:
  - SOL selected -> `SOL Balance: ...`
  - BONK selected -> `BONK Balance: ...`
- Updated [apps/web/src/components/lobby/LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx) to stop passing the now-removed `walletConnected` prop to `CharacterSelect`.
- Validation: `npm run lint --workspace apps/web` passes.

### The Reasoning
- Arena-readiness/balance feedback is more useful at token selection time than at character selection.
- This keeps phase intent clean: arena viability in setup phase, character decisions in draft phase.

### The Tech Debt
- Balance values remain dependent on backend playability normalization; until BE endpoint is live/reliable, chip may show `Inspecting...` / `Unavailable` / `--` fallback states.

## 2026-05-06 - Play Screen Character Sprite Wiring (stay/action)

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) to render character art assets from `public/assets/characters/{scientistId}/{state}.png` directly inside the existing 4:5 portrait slots.
- Added sprite state resolution for /play portraits:
  - maps backend/shared CharacterState to sprite state (stay or action)
  - preserves local action pulse behavior by forcing action during damage animation windows.
- Switched portrait rendering from initials-only placeholders to next/image with fallback:
  - if sprite exists, render image
  - if sprite missing or fails to load, fallback to previous initial-letter placeholder so gameplay UI does not break.
- Kept all gameplay logic untouched (socket contract, damage logic, cards, settlement, history).
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- FE needed to consume designer-delivered scientist assets in /play without changing backend contracts.
- Using shared-type-compatible states (stay, action) keeps naming and runtime behavior aligned across FE/BE.
- Graceful fallback avoids runtime breakage while asset delivery is still in progress.

### The Tech Debt
- Current repository assets include turing and curie states, but einstein sprite files are not present yet; Einstein currently renders fallback initials until those files are added.
- We currently support the shipped states (stay, action) only. If future character states (angry, happy) get dedicated art, we should extend the mapping and asset set.

## 2026-05-07 - Landing Features Uses Basic Scientist Pose Assets

### The Change
- Updated [apps/web/src/components/landing/Features.tsx](/d:/projects/Cora/apps/web/src/components/landing/Features.tsx) to render scientist portrait art from `public/assets/characters/{scientistId}/basic.png` inside the existing 4:5 portrait panel.
- Added `next/image` rendering for the basic pose with `fill + object-cover` so the new art consistently fits the current card ratio.
- Preserved a safe fallback: if a basic image is missing or fails to load, the previous placeholder portrait (emoji + silhouette) still renders.
- Kept existing overlays, badges, and HP strip layered above the image so current visual hierarchy remains intact.
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- The designer shipped basic poses and these are the best source for static landing cards, while action/stay assets remain gameplay-focused in `/play`.
- Reusing the current 4:5 frame avoids layout churn and keeps card composition stable across all scientists.
- Fallback behavior ensures the roster section does not regress when an asset is delayed or renamed.

### The Tech Debt
- `basic.png` naming/path is currently convention-based. If art versioning grows, we should centralize scientist asset metadata in one shared map instead of deriving paths inline.
- Overlay intensity is slightly stronger with real art than placeholder mode; we may want a quick polish pass once final color grading for all portraits is locked.

## 2026-05-07 - Landing Features Portrait Cleanup (Unobstructed Character Art)

### The Change
- Updated [apps/web/src/components/landing/Features.tsx](/d:/projects/Cora/apps/web/src/components/landing/Features.tsx) to remove portrait-overlay elements that were covering character art.
- Removed in-portrait center overlays:
  - base emoji marker
  - base label text
- Removed in-portrait bottom HP bar strip.
- Reduced portrait color-wash opacity when real art is present so the character remains clearly visible.
- Moved base context to the card body (`Base: ...`) so information is retained without overlapping the illustration.
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- The new basic pose assets are now the primary visual focus of each roster card.
- Overlay UI on top of portraits created readability and composition conflicts (especially around face and lower body).
- Keeping metadata in the body preserves information hierarchy while respecting the artwork.

### The Tech Debt
- If we later need dynamic HP visualization on landing cards, it should be rendered outside portrait bounds (for example as a compact row in card body) rather than layered on the image.

## 2026-05-07 - Features Expand Stats Aligned to Shared Character Definitions

### The Change
- Updated [apps/web/src/components/landing/Features.tsx](/d:/projects/Cora/apps/web/src/components/landing/Features.tsx) to drive expanded `View Stats` content from [packages/shared-types/src/characterStats.ts](/d:/projects/Cora/packages/shared-types/src/characterStats.ts) instead of hardcoded landing profile stat bars.
- Added shared-data integration in landing features:
  - imports `CHARACTER_DEFS` and `QuestionCategory`
  - maps canonical specialty category labels (`sequence`, `logical`, `math`) for display
- Refined click-expand (mobile + desktop drawer) stats UI to show gameplay-accurate combat intel:
  - Specialty category
  - Specialty bonus percent
  - Base correct power (`1.0x`)
  - Specialty power (`1.5x`)
  - Specialty + extra point max (`3.0x`)
- Updated progress bar math to normalize multiplier values against max stack (`3.0x`) so visual bars are consistent and comparable.
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- `characterStats.ts` is the canonical gameplay source for character specialties and multipliers; landing expand stats should reflect those same mechanics.
- This removes drift between marketing/landing representation and actual match behavior.
- The refined drawer now communicates meaningful, game-accurate stats when users click `View Stats`.

### The Tech Debt
- Landing profile `stats` fields in `content.ts` are still present for narrative profile metadata, but no longer drive expandable combat bars. If not needed elsewhere, we can deprecate or repurpose them in a cleanup pass.

## 2026-05-07 - Features Outer Card Narration and Pills Aligned to Shared Stats

### The Change
- Updated [apps/web/src/components/landing/Features.tsx](/d:/projects/Cora/apps/web/src/components/landing/Features.tsx) to make outer (collapsed) card narration and top pills derive from [packages/shared-types/src/characterStats.ts](/d:/projects/Cora/packages/shared-types/src/characterStats.ts).
- Replaced static/marketing pill values with stat-driven pills:
  - left pill now reflects specialty role derived from category (`Mathematician`, `Logician`, `Pattern Runner`)
  - right pill now shows canonical specialty bonus (`+50% Bonus` from multiplier)
- Replaced outer short narration with stat-aligned summary text generated from specialty category + multiplier (for consistency with gameplay rules).
- Removed the previous static rarity label dependency from this card layer.
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- The user asked for outer card narration/pills to match character stats; shared character definitions are the authoritative source.
- This keeps first-glance roster information aligned with actual gameplay mechanics rather than thematic-only labels.

### The Tech Debt
- Role and narration strings are currently generated with simple conditional helpers in `Features.tsx`. If this language is reused across pages, it should be centralized into a shared presentational mapping utility.

## 2026-05-07 - Dedicated /history Route + Informational GoldRush UX Scope

### The Change
- Added a dedicated history route at [apps/web/src/app/history/page.tsx](/d:/projects/Cora/apps/web/src/app/history/page.tsx) and new view component [apps/web/src/components/history/HistoryView.tsx](/d:/projects/Cora/apps/web/src/components/history/HistoryView.tsx).
- Implemented `HistoryView` as a non-blocking, informational page that reads query params (`scope`, `arena`, `token`, optional `address`) and fetches data via existing FE adapters:
  - `getArenaHistory`
  - `getWalletHistory`
- Updated [apps/web/src/components/history/HistoryButton.tsx](/d:/projects/Cora/apps/web/src/components/history/HistoryButton.tsx) to support both click-handler mode and link mode (`href`) so existing screens can route directly to `/history`.
- Rewired character-select history access to route mode:
  - [apps/web/src/components/lobby/CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/lobby/CharacterSelect.tsx) now links to `/history?...` and removes local drawer-fetch state.
- Reduced non-arena wallet inspect surface:
  - [apps/web/src/components/lobby/OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx): removed inline wallet inspect modal/buttons and local history drawer state; uses `/history` route entry.
  - [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx): removed wallet inspect modal/buttons and local history drawer state; `View History` now links to `/history?...`.
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- The user requested a dedicated `/history` view and clarified GoldRush should remain informational-only.
- Routing to a full page avoids repeating fetch + modal logic in multiple phases and keeps gameplay screens focused.
- Removing wallet-inspect actions from opponent/battle phases aligns UX to the intended scope: balance readiness is relevant in arena selection, not throughout the full match flow.

### The Tech Debt
- History data quality still depends on backend stub coverage for `/api/history/*`; UI reflects availability but does not yet annotate mock-vs-indexed provenance explicitly per item.
- `HistoryView` currently uses lightweight in-component query/state handling; if filtering/sorting grows, we should promote this into shared hooks for easier reuse and cache behavior consistency.

## 2026-05-07 - History UI & Header Placement Consolidation

### The Change
- Finalized the history experience as a player-facing records surface across:
  - [apps/web/src/components/history/HistoryView.tsx](/d:/projects/Cora/apps/web/src/components/history/HistoryView.tsx)
  - [apps/web/src/components/history/HistoryDrawer.tsx](/d:/projects/Cora/apps/web/src/components/history/HistoryDrawer.tsx)
  - [apps/web/src/components/history/WalletInspectPanel.tsx](/d:/projects/Cora/apps/web/src/components/history/WalletInspectPanel.tsx)
- Consolidated history UX updates in one pass:
  - removed internal-facing disclaimer copy
  - switched to player-facing records language
  - refined result-first receipt hierarchy (result/status/opponent/wager/signature)
  - improved chip consistency and visual emphasis
  - added subtle transition polish for history state/content changes
- Finalized history entry-point placement in [apps/web/src/components/lobby/LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx):
  - moved history access from character-select to arena setup
  - grouped header as left wallet, middle wager+balance, right history
  - aligned balance/history visuals with the existing header pill language
- Removed history action from character-select phase in [apps/web/src/components/lobby/CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/lobby/CharacterSelect.tsx).
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- History should feel like part of the game product, not backend diagnostics.
- Arena setup is the highest-context moment for history lookup (token decision + balance + prior records).
- Consolidating these small iterations into one coherent pass improves handoff readability.

### The Tech Debt
- History visuals and motion timing remain component-local; if reused across additional pages, we should extract shared tokens/primitives for chips, receipts, and transition timing.
- Header chip styling in `LobbySetup` remains local composition; future header variants may benefit from a shared layout primitive.




## 2026-05-07 - Battle Character Asset Presentation Polish (Facing, Action Pop, Frame Removal)

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) character presentation layer only:
  - **Opponent facing direction:** mirrored opponent sprite horizontally (`scaleX`) so opponent visually faces left; player remains facing right.
  - **Action micro-animation:** added lightweight pop/bounce when sprite enters `action` state using Framer Motion animation controls (`scale` + `y` sequence).
  - **Frame removal:** removed visible rectangular portrait frame/background treatment around both characters (no border/background/overlay frame), while preserving existing absolute positioning and scene layout.
  - adjusted sprite fit to `object-contain` for cleaner direct-in-scene character rendering.
- No changes to gameplay logic, socket flow, projectile logic, base logic, or scoring.
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- Opponent mirroring improves combat readability by making characters face each other.
- A short action pop increases perceived responsiveness for attack/heal events without adding heavy effects.
- Removing portrait frames aligns character assets with a more in-scene presentation and reduces UI-box feel.

### The Tech Debt
- Action micro-animation timing is currently local in `BattleScreen.tsx`; if we add more character-state motion across screens, we should centralize motion timing tokens/utilities.

## 2026-05-07 - Battle Result Modal Restyle (Player-First + Collapsible Settlement Details)

### The Change
- Restyled the match-complete modal in [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) to match the dark arena + warm card direction with:
  - stronger dark backdrop overlay
  - premium parchment card treatment
  - large centered Caprasimo result title (`You Win` / `You Lose` / `Match Invalidated`)
  - Gabarito subtitle copy (`Victory secured.`, `Rival took this round.`, `Match invalidated.`)
- Reduced default visible content to player-facing summary only:
  - settlement status chip (`Settled`, `Pending`, `Invalidated`)
  - rounds score (`Your Rounds`, `Opponent Rounds`)
  - compact outcome stats (`Correct`, `Timeout`, `Wrong`)
  - optional shortened winner line when context is useful
- Removed technical settlement/debug content from the default surface (match id, full authority block, server pubkey/signature, backend explanation).
- Added a local UI toggle in the same component:
  - `Show Settlement Details` / `Hide Settlement Details`
  - when expanded, reveals match id, server pubkey, settlement signature, and backend settlement text/waiting status.
- Reordered result actions to improve hierarchy:
  - primary style: `Blink Share`, `Back To Lobby`
  - secondary style: `View History`
- Cleaned dead code by removing now-unused outcome color/label helper functions after removing default turn-history rendering from this modal.
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- The previous modal mixed game UX and settlement internals, which made the result moment feel like an operations panel.
- This refactor keeps the end-of-match state celebratory and readable by default, while still preserving access to technical data on demand.
- Keeping all data wiring intact but changing only layout/copy/toggle behavior satisfies the requirement to avoid logic and routing regressions.

### The Tech Debt
- Modal visual tokens (overlay/card/button/chip styles) are still component-local in `BattleScreen.tsx`; if result surfaces expand to other screens, we should extract shared style primitives.
- The details panel currently uses plain text blocks; if settlement diagnostics become a recurring UX need, a shared key-value diagnostics component would improve consistency.

## 2026-05-07 - OpponentFound History Entry-Point Removal

### The Change
- Updated [apps/web/src/components/lobby/OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx) to remove history entry points from the opponent-found phase only.
- Removed `HistoryButton` import and removed `historyHref` constant (unused after UI removal).
- Removed top-row history button while keeping:
  - playability chip
  - `Show Room Status` / `Hide Room Status` toggle
- Removed bottom `Open Full History` link block.
- Kept all match-flow behavior unchanged: deposit signing, socket reconnection, status rail, timeout/cancel flow, and routing to battle.
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- Opponent-found should stay focused on immediate match flow (rival locked -> sign deposit -> enter battle).
- History access is now treated as app-level navigation rather than a repeated action in every match phase.

### The Tech Debt
- If product later needs contextual history during deposit phases, we should reintroduce it through a centralized phase-navigation policy instead of per-screen ad hoc links.

## 2026-05-07 - Battle Hand + Question Popup Rounded Placeholder Polish

### The Change
- Updated only visual styling in [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) for:
  - bottom battle hand cards
  - active question popup shell
  - answer option buttons
- Battle hand cards:
  - replaced sharp `frame-cut` card appearance with rounded placeholder cards
  - preserved existing fan layout/transforms, click behavior, disabled behavior, and active card highlighting
  - removed visible `card.type` / `locked` text from card face
  - kept a simple center `?` mark and added subtle placeholder texture layers
  - tuned disabled/locked cards to look intentionally inactive rather than broken
- Active question popup:
  - replaced old sharp modal shell with a rounded warm panel
  - kept dark overlay and all question/timer/answer logic unchanged
- Answer option buttons:
  - replaced sharp panels with rounded chunky button cards in the same warm style direction
  - kept existing `onAnswer`, disabled, and lock behavior unchanged
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- These elements were still visually anchored to the older sharp-frame style and felt out of place against the newer rounded battle UI.
- This pass introduces temporary rounded placeholders that are easier to swap later when final designer card assets land.

### The Tech Debt
- Card/popup placeholder textures and color treatments are currently inline style values in `BattleScreen.tsx`; these should become shared tokens/primitives if reused across more battle surfaces.
- Final art integration will likely replace most placeholder layers, so a follow-up cleanup pass should remove any temporary decorative styling that becomes redundant.

## 2026-05-08 - Battle Room Gate Banners Converted To Blocking Overlay Modal

### The Change
- Updated room gate presentation in [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) from inline banners to a centered blocking overlay modal.
- Removed inline rendering above the arena for:
  - `isRoomStateLoading`
  - `shouldShowPlayStateGate`
- Added a unified fixed overlay gate (`showRoomGateModal`) with dark low-opacity backdrop and centered panel so the arena stays in place.
- Modal copy now follows requested wording:
  - syncing: `Syncing Room State` + `Rejoining battle room after refresh. Waiting for server snapshot.`
  - non-playing: `Waiting For Battle` (when status is `waiting`) or `Room Locked` + `Current room status: ${getStatusLabel(status)}.`
- Preserved gate actions:
  - `Retry Room` (only when socket has issue)
  - `Return And Requeue`
- Kept socket/gameplay logic and state checks unchanged (presentation-only refactor).
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- Inline gate banners were affecting document flow and pushing the battle arena down, which made the screen feel broken.
- A fixed overlay preserves scene layout while still blocking interaction and communicating room state clearly.

### The Tech Debt
- This gate modal styling is local to `BattleScreen.tsx`; if similar blocking gates are needed elsewhere, we should extract a shared modal-gate primitive.
- There is still a separate `Unable to enter battle room` inline banner path; if we want full consistency, that path can be unified into the same overlay pattern in a follow-up pass.

## 2026-05-08 - OpponentFound Deposit Action Hierarchy Polish

### The Change
- Polished deposit action presentation for `OpponentFound` flow using:
  - [apps/web/src/components/deposit/DepositPanel.tsx](/d:/projects/Cora/apps/web/src/components/deposit/DepositPanel.tsx)
  - [apps/web/src/components/deposit/DepositStatusCard.tsx](/d:/projects/Cora/apps/web/src/components/deposit/DepositStatusCard.tsx)
  - [apps/web/src/components/lobby/OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx)
- Centered secondary action group in `DepositStatusCard` so `retrySlot` + `cancelSlot` are always centered together, and `Cancel Match` stays centered when alone.
- Reduced secondary action visual weight in `OpponentFound` by shrinking `Retry Connection` and `Cancel Match` padding/size (`px-3 py-1.5 text-[10px] shadow-sm`).
- Updated `DepositPanel` primary action button to the shared chunky primary game button family (`btn-game btn-game-primary`) with larger dominant CTA sizing and muted disabled styling in the same family.
- Kept all behavior intact: signing, retry, cancel, deposit status logic, and slot wiring unchanged.
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- The previous secondary actions looked too prominent and defaulted left alignment, which weakened the action hierarchy.
- Centering secondary actions and reducing their scale creates a clear primary-first flow while preserving utility access.
- Using the shared primary button family aligns deposit CTA visuals with established game CTAs like queue entry.

### The Tech Debt
- Slot-provided action sizing is still caller-controlled; if more screens reuse this pattern, we should standardize secondary-action size tokens at the deposit component level.
- Deposit CTA variant choices are now class-driven but still local to `DepositPanel`; a future button-variant utility could reduce repeated CTA class decisions across flows.

## 2026-05-08 - Matchmaking Deposit UX Role Gating + Mystery Rival + Play Character Source Lock

### The Change
- Updated matchmaking handoff and deposit UX flow across:
  - [apps/web/src/lib/matchmaking/queueMatch.ts](/d:/projects/Cora/apps/web/src/lib/matchmaking/queueMatch.ts)
  - [apps/web/src/components/lobby/LobbyScreen.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbyScreen.tsx)
  - [apps/web/src/components/lobby/OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx)
  - [apps/web/src/lib/solana/signDepositIntent.ts](/d:/projects/Cora/apps/web/src/lib/solana/signDepositIntent.ts)
  - [apps/web/src/hooks/useMatchSocket.ts](/d:/projects/Cora/apps/web/src/hooks/useMatchSocket.ts)
  - [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx)
- `/match` role propagation:
  - extended `queueMatch` response typing to include optional `role` (`playerA`/`playerB`)
  - stored role in `LobbyScreen` (`matchedRole`) and passed it into `OpponentFound` as `matchRole`
- Player B deposit lock + unlock behavior in `OpponentFound`:
  - disabled sign action for Player B until `depositUnlocked` is received
  - removed websocket-connection-state requirement from sign button enablement (wallet + role gate + signing state now control gating)
  - preserved `confirmDeposit` emission only after socket is `connected`
  - added Player B helper copy while locked: `Waiting for Player A to deposit first.`
  - on `depositUnlocked` for Player B, reset visible countdown to fresh 30s and show unlock copy: `Player A deposited � your turn.`
  - paused countdown/auto-timeout while Player B is locked pre-unlock
- Opponent identity privacy in `OpponentFound`:
  - replaced rival portrait/name/base with mystery state (`?`, `Mystery Rival`, `Character hidden until battle`)
  - kept opponent wallet/address visible
- `/play` character source hardening:
  - `BattleScreen` now sources player character from server `gameState.player.characterId` only (no FE query fallback)
  - `BattleScreen` websocket join no longer sends `characterId`
  - `useMatchSocket` now only appends `characterId` query when explicitly provided (removed default `einstein` fallback)
- Added lightweight debug logs to distinguish failure stage:
  - deposit click gating context in `OpponentFound`
  - backend transaction fetch start/failure/receipt in `signDepositIntent`
  - pre-`wallet.sendTransaction` log in `signDepositIntent`
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- Role-aware deposit gating is needed so Player B cannot sign before backend unlock and receives clear, deterministic UX state transitions.
- Decoupling sign-button enablement from transient socket reconnects avoids false-negative UX blocks while still preserving server confirmation sequencing.
- Hiding rival character in deposit phase prevents premature identity reveal and aligns reveal timing with battle entry.
- Removing FE character fallback in `/play` avoids stale local character assumptions after reconnect and makes server state authoritative.

### The Tech Debt
- Role fallback currently combines `/match` response with websocket `matchFound` payload; if backend role source-of-truth changes, this should be centralized in one shared match-session model.
- Deposit unlock UX messaging is component-local; if reused in other phases, we should extract a small role/deposit-state presentation helper.
- Logging is intentionally lightweight and ad hoc; if we formalize telemetry, these should be routed through a structured frontend observability layer.

## 2026-05-08 - Gameplay/Deposit UX Follow-Up Polish (Role Lock, Card Type Fallback, Result Transition)

### The Change
- Applied focused frontend polish across:
  - [apps/web/src/components/lobby/OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx)
  - [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx)
- OpponentFound deposit UX follow-up:
  - preserved role-based Player B lock behavior and non-draining pre-unlock state
  - updated Player B unlock copy to: `Player A deposited. Your turn to sign.`
  - updated debug click log payload to include requested fields: `role`, `depositUnlockedAt`, `playerBLocked`, `countdownSeconds`, `canAttemptSign`
  - retained reconnect-tolerant signing gate (signing not blocked solely by transient websocket reconnect)
- Opponent identity copy polish:
  - replaced `Mystery Rival` with `Your Rival`
  - replaced subcopy with neutral: `Character revealed when battle starts.`
  - kept `?` portrait placeholder and wallet/address visibility
- Temporary card type visibility fallback during play:
  - added simple readable hand-card label chips showing `Attack` or `Heal` on each playable card in battle hand
  - kept existing card layout/interaction intact
- Match result popup transition polish:
  - wrapped result overlay in `AnimatePresence`
  - added smooth fade for backdrop and subtle y/scale entrance/exit animation for result card using Framer Motion
  - no changes to settlement/routing/share logic
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- This pass fixes remaining UX rough edges without touching backend, queue, or settlement systems.
- Temporary card type text restores tactical readability until final art treatment lands.
- Motion polish removes abrupt result popup appearance while keeping match flow responsive.

### The Tech Debt
- Player-role reliability remains dependent on role propagation source; if `/match` role availability changes across environments, role-origin handling should be centralized into one explicit match-session contract.
- Temporary card type chips are intentionally stopgap UI and should be replaced once final card art/type indicators are delivered.
- Result modal motion values are local constants; if more overlays adopt similar behavior, motion tokens should be shared.

## 2026-05-08 - Gameplay Feedback Notification Pass + Deposit Waiting State Polish

### The Change
- Updated gameplay feedback presentation in [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - Removed inline post-action feedback text above hand cards.
  - Added a compact, upper-middle, non-blocking game notification system (`pointer-events-none`) with subtle motion.
  - Routed post-action feedback into notifications:
    - attack result (`Attack landed: -X HP` when available)
    - heal result (`Healed: +X HP` when available)
    - no-damage states (`No damage this turn.`)
  - Routed Extra Point phase change into the same upper-middle notification style (`Extra Point - every move matters.`).
  - Kept existing projectile/base-hit animations and interaction flow unchanged.
- Removed `View History` action from the win/lose result popup in [BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) only.
- Polished deposit waiting states in [apps/web/src/components/lobby/OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx):
  - Player A countdown now stops after signing (`signingState === waiting`) and shows clear waiting copy (`Deposit signed. Waiting for Player B.`).
  - Player B remains locked/passive pre-unlock (`Waiting for Player A to deposit first.`) with no draining countdown.
  - Player B unlock copy remains explicit (`Player A deposited. Your turn to sign.`).
  - Countdown visibility now uses explicit derived state (`shouldShowCountdown`) rather than always showing after mount.
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- Inline action text near hand cards was competing with play controls and looked disconnected from the game feedback style.
- A single upper-middle, non-blocking notification lane improves readability for both action outcomes and phase changes without obstructing card play.
- Deposit-phase copy and countdown visibility now better communicate who is waiting on whom, reducing confusion during Player A/Player B sequencing.

### The Tech Debt
- Notification copy/timing is still local to `BattleScreen`; if other gameplay screens need similar UX, this should become a shared game-notification primitive.
- Deposit waiting-state messaging logic is still component-local in `OpponentFound`; if additional deposit phases/screens are added, message derivation should be centralized.

## 2026-05-08 - Match Lifecycle UX Polish (/play Presence, Cancel/Surrender Semantics, Result States)

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - removed remaining `/play` requeue assumptions (`resumeQueue` URL construction and `Return And Requeue` actions)
  - replaced old `/play` recovery navigation with clean `/lobby` return paths only
  - upgraded current-player recovery copy/action to:
    - title/copy: `You were disconnected` + `Your match is still active. Rejoin to continue.`
    - action: `Rejoin Room` (same-room socket reconnect)
  - integrated backend lifecycle events into play UX:
    - consumes `lastRoomCancelled` and maps reason-specific user copy:
      - `player_cancelled` -> `Match cancelled`
      - `deposit_timeout` -> `Deposit timed out`
      - `disconnect` -> `Match cancelled before battle start`
    - consumes presence state (`presenceUpdate` and `player/opponent.isConnected`) for non-blocking opponent status:
      - transient notices: `Opponent disconnected` / `Opponent reconnected`
      - persistent opponent chip: `Connected` / `Away`
  - added cancel vs surrender action semantics on `/play`:
    - pre-commit (`waiting`/`depositing`): `Cancel Match` (sends `cancelMatch`)
    - committed/active (`playing`/`settling`): `Surrender`
  - replaced prompt-style surrender with explicit confirmation modal:
    - title: `Surrender match?`
    - body: `Surrendering means you forfeit this match. Your rival will receive the wager after settlement. You will return to lobby.`
    - actions: `Keep Playing` and `Surrender`
  - expanded result presentation to support non-winner assumptions safely:
    - `You Win` / `You Lose`
    - `Draw`
    - `You Surrendered`
    - `Opponent Surrendered`
    - cancellation result text via `roomCancelled` reasons
  - preserved existing animation/result structure and gameplay card flow.
- Updated [apps/web/src/components/lobby/OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx):
  - added friendly `roomCancelled` reason mapping messages before lobby return
  - removed immediate post-click forced timeout on cancel; now waits for backend cancellation signal path
  - updated stale `Returning to queue` language to `Returning to lobby` for deposit-failure context.
- Validation: `npm.cmd run lint --workspace apps/web` passes.

### The Reasoning
- `/play` should no longer imply auto-requeue behavior in wagered and recoverable match states.
- Presence-aware UX prevents confusion when an opponent disconnects while a connected player remains in an active room.
- Explicit cancel-vs-surrender wording aligns player intent with lifecycle phase and backend semantics.
- Result rendering must tolerate `winnerAddress: null` and lifecycle-terminal outcomes beyond simple win/lose.

### The Tech Debt
- Presence UX still depends on event timing between `presenceUpdate` and `gameStateUpdate`; if backend emits richer phase-aware presence metadata, the FE can further simplify conditions.
- Cancellation is now clearly rendered, but lobby-level post-cancel handoff remains distributed across component-local timers and callbacks.
- `/lobby` still retains legacy `resumeQueue` handling for compatibility; now that `/play` stopped emitting it, a future cleanup pass can remove that branch if no other flows depend on it.
## 2026-05-08 - Disconnect Overlay UX (Manual Rejoin + Optional Surrender)

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) reconnect UX for current-player disconnect during active/recoverable match:
  - added a full-screen blocking overlay in the same frame-cut visual style as existing battle overlays
  - title/body copy now:
    - `You were disconnected`
    - `Your match is still active. Rejoin to continue, or surrender to end the match.`
  - removed inline disconnect-state frame usage for this flow
  - suppressed top-right disconnect/reconnecting socket alerts while the full-screen disconnect overlay is active
  - removed auto-rejoin behavior from this disconnect UX path; reconnect is now user-triggered only
  - added explicit dual CTA behavior:
    - `Rejoin Room` -> calls `reconnect()` for same-room recovery
    - `Surrender` -> uses existing surrender intent flow, including reconnect-then-submit handling when disconnected
  - no countdown timer, no auto-dismiss, no auto-win/forfeit countdown added in FE
- Validation: `npm run lint` in `apps/web` passes.

### The Reasoning
- In a recoverable wagered match, disconnect should be explicit and player-controlled, not hidden in toasts or auto-retry side effects.
- A blocking overlay with clear actions reduces ambiguity about whether the room is still active and what the player can do next.
- Reusing existing surrender semantics keeps settlement ownership on backend lifecycle events rather than FE assumptions.

### The Tech Debt
- Reconnect/surrender intent orchestration is still component-local state in `BattleScreen`; if additional play surfaces share this behavior, it should be extracted into a dedicated match-recovery controller hook.
- Socket alert suppression is context-specific (`showDisconnectedOverlay`) and may need consolidation if other modal-priority states are introduced.

## 2026-05-08 - Character Expressions (Happy Preview + Battle Reaction Bubbles)

### The Change
- Updated [apps/web/src/components/character/CharacterCard.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterCard.tsx):
  - added expression portrait support for selection UI using `/assets/characters/{characterId}/exp/happy.png`
  - renders `happy` expression for selected or previewed cards (hover/focus preview)
  - keeps existing fallback initial rendering when expression asset is unavailable
- Updated [apps/web/src/components/character/CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterSelect.tsx):
  - explicitly passes `previewExpression="happy"` into `CharacterCard`
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - added battle reaction bubble UI near each character (left for player, right for rival)
  - bubble content is expression image assets from `/assets/characters/{characterId}/exp/{expression}.png`
  - added temporary reaction state with override behavior and auto-hide timers
  - wired reactions to existing match events/state only:
    - `happy` on local correct answer via `lastPlayResult.correct`
    - `hurt` on damaged target via `lastDamageEvent` attack damage
    - `confident` when `currentCorrectStreak >= 3` for player/opponent
  - intentionally uses `currentCorrectStreak` (not `longestCorrectStreak`) for FE reaction logic

### The Reasoning
- Expression assets are 1:1 and separate from combat pose assets (`stay/action/basic` 4:5), so expression rendering is isolated to `/exp` and mapped per use-case.
- Character selection now previews the intended expression style without changing gameplay sprites.
- Battle reactions are event-driven, brief, and non-blocking to preserve gameplay readability while providing emotional feedback.
- `currentCorrectStreak` represents live, player-facing momentum and is the correct source for confidence reactions.

### The Tech Debt
- Reaction trigger logic lives in `BattleScreen`; if additional battle surfaces need the same behavior, this should be extracted into a shared reaction hook/controller.
- Rival `happy` currently depends on available FE event context and can be expanded later if backend emits an explicit per-player correctness stream to both clients.
- Expression fallback behavior is per-component; a shared character-asset resolver utility could reduce duplication across lobby/play surfaces.

## 2026-05-08 - Character Select Expression State (Idle Default, Happy on Selected)

### The Change
- Updated [apps/web/src/components/character/CharacterCard.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterCard.tsx):
  - removed hover/focus-driven expression switching
  - expression rendering is now strictly selection-state based:
    - unselected card -> `/assets/characters/{characterId}/exp/idle.png`
    - selected card -> `/assets/characters/{characterId}/exp/happy.png`
  - preserved fallback initial rendering when expression asset is unavailable
- Kept [apps/web/src/components/character/CharacterSelect.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterSelect.tsx) selected-expression contract (`previewExpression="happy"`) unchanged.

### The Reasoning
- Selection intent should be explicit and stable; hover-based swaps can feel noisy and imply a state change that has not actually happened.
- `idle` as default and `happy` as selected gives a clean, readable visual cue for locked-in user intent.

### The Tech Debt
- Expression state mapping for select cards is still component-local; if multiple screens require the same selected/unselected expression policy, this should move into a shared character-expression helper.

## 2026-05-08 - Character Card Selection Bounce (Select <-> Deselect)

### The Change
- Updated [apps/web/src/components/character/CharacterCard.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterCard.tsx):
  - added a subtle bounce animation when selection state changes in either direction:
    - `not selected -> selected`
    - `selected -> not selected`
  - implemented via `framer-motion` animation controls with short keyframe-based `y/scale` motion
  - preserved existing hover lift and visual selection styling
  - switched expression error handling to a per-asset failure map to avoid effect-driven state resets and keep lint clean

### The Reasoning
- A small bounce gives immediate feedback that selection state actually changed, without introducing distracting motion.
- Animation controls provide explicit state-transition motion while keeping mount and hover behavior stable.
- Per-asset failure tracking keeps idle/happy expression swapping resilient when one asset is missing.

### The Tech Debt
- Selection bounce timing/curve is currently hardcoded in the card component; if we add similar transitions elsewhere, we should centralize motion tokens.

## 2026-05-08 - Card Hover Softening + Portrait-Only Selection Bounce

### The Change
- Updated [apps/web/src/components/character/CharacterCard.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterCard.tsx):
  - softened card hover lift to be less aggressive
  - moved select/deselect bounce animation from the full card container to the portrait block only
  - portrait now performs a subtle `y/scale` bounce on both transitions:
    - unselected -> selected
    - selected -> unselected
  - card keeps stable selection offset while avoiding large full-card motion

### The Reasoning
- Full-card bounce plus strong hover made interaction feel overly jumpy.
- Limiting bounce to the image area preserves responsiveness while keeping the overall layout calm.

### The Tech Debt
- Motion values are currently inline in `CharacterCard`; if we continue tuning interaction feel across components, shared motion tokens would reduce drift.

## 2026-05-08 - Character Card Cleanup (Remove Focused Badge + Dot/Line Marker)

### The Change
- Updated [apps/web/src/components/character/CharacterCard.tsx](/d:/projects/Cora/apps/web/src/components/character/CharacterCard.tsx):
  - removed the `Focused` label badge from selected portraits
  - removed the bottom dot/line indicator strip inside the portrait frame
  - preserved all selection, expression, and animation behavior otherwise

### The Reasoning
- These extra markers added visual noise and duplicated selection signals already conveyed by border/background/status treatments.
- Cleaner portrait framing improves readability of expression art.

### The Tech Debt
- Selection state is currently communicated by multiple visual channels; a future design pass could codify a minimal, shared state-token set for all character cards.

## 2026-05-08 - Battle Emote Reposition + Size Increase

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - moved player reaction emote to the right side of the player identity block (`You / Score / Address`)
  - moved rival reaction emote to the left side of the rival identity block (`Rival / Connected / Address / Score`)
  - removed old mid-arena absolute emote anchors
  - significantly increased emote bubble size from small overlays to large header-side bubbles (`96px` mobile, `112px` desktop)
  - preserved existing reaction timing, animation, and event triggers

### The Reasoning
- Emotes now sit exactly with the identity metadata the user reads first, which improves clarity and avoids visual competition with center combat sprites.
- Larger size improves readability of 1:1 expression art.

### The Tech Debt
- Player/rival emote bubble markup is duplicated in the header row; this can be extracted into a shared reaction bubble component if we keep iterating on style/behavior.

## 2026-05-08 - Battle Reaction Polish (Preload + Speech Bubble + Arena Attachment + Softer Timing)

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - added expression asset preloading for both active characters using a lightweight helper (`new window.Image()`), covering:
    - `happy`
    - `confident`
    - `hurt`
  - preloading runs when `playerCharacterId`/`opponentCharacterId` are available and does not block gameplay
  - increased default reaction display duration from `1200ms` to `1900ms`
  - replaced reaction visual from portrait-card look to a compact speech-bubble style:
    - warm cream bubble surface
    - stronger border/shadow
    - visible directional tail toward character
  - moved reaction bubbles from the header/name row back into the arena, anchored near each character sprite:
    - player bubble on character side-left
    - opponent bubble on character side-right
  - softened reaction motion to feel less abrupt:
    - pop-in with small bounce
    - gentler fade-out
  - kept all existing trigger logic unchanged (`happy`, `hurt`, `confident`) and no socket/gameplay behavior changes

### The Reasoning
- Preloading eliminates first-show image lag and makes reactions feel immediate.
- Speech-bubble styling communicates "reaction" better than square card framing.
- Arena-anchored placement reconnects the expression to the character action context.
- Slightly longer lifetime and softer transitions improve readability without clutter.

### The Tech Debt
- Reaction bubble markup exists twice (player/opponent variants); this can be extracted into a small shared render helper/component if more variants are added.
- Position offsets are tuned constants; a future responsive pass could derive offsets from measured sprite bounds for tighter device consistency.

## 2026-05-08 - Opponent Found Player Expression (Happy)

### The Change
- Updated [apps/web/src/components/lobby/OpponentFound.tsx](/d:/projects/Cora/apps/web/src/components/lobby/OpponentFound.tsx):
  - player-selected character portrait in the "Opponent Found" panel now renders:
    - `/assets/characters/{myScientist.id}/exp/happy.png`
  - added `next/image` rendering for the player portrait with graceful fallback to existing initial glyph if asset fails
  - opponent portrait remains unchanged as `?` (hidden identity behavior preserved)

### The Reasoning
- The player�s own selected scientist can be shown with expressive art before battle starts, while opponent identity remains intentionally concealed.

### The Tech Debt
- Expression asset resolution is component-local in `OpponentFound`; if more pre-battle surfaces need this behavior, a shared character portrait resolver helper would reduce duplication.

## 2026-05-08 - Battle Projectile Asset Wiring (Attacker-Based, Turing Variants, Heal Skip)

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - replaced placeholder projectile visual with character projectile assets
  - added projectile source resolver:
    - Einstein/Curie/others: `/assets/characters/{characterId}/projectile.png`
    - Turing: random per spawn between:
      - `/assets/characters/turing/projectile_0.png`
      - `/assets/characters/turing/projectile_1.png`
  - projectile asset is now selected from the attacker character (`playerCharacterId` or `opponentCharacterId` based on event side)
  - heal events no longer spawn projectile visuals
    - heal base FX and heal-related reaction behavior remain intact
  - removed framed projectile container/box styling
  - added subtle warm/gold radial glow behind projectile for dark-scene readability
  - added projectile asset failure tracking (`failedProjectileSprites`) and fallback rendering (glow + glyph) when image load fails

### The Reasoning
- Projectile visuals should match the active attacker identity to improve combat readability and character personality.
- Turing�s randomized binary projectile variants add variety while preserving deterministic gameplay logic.
- Heal should remain a non-projectile feedback channel, so visuals align with intended semantics.
- A free-floating asset with soft glow feels integrated into battle motion and avoids UI-card framing artifacts.

### The Tech Debt
- Projectile glow and motion constants are inline; if we introduce more VFX types, these should move to shared visual tokens/helpers.
- Projectile asset preloading is not yet centralized; if first-hit latency appears on slower devices, a shared preload pass can be added for projectile paths similar to expression preloading.

## 2026-05-08 - Real Base Asset Integration in Battle Arena

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) to replace square base placeholders with real base art:
  - player base now resolves from player character ID
  - opponent base now resolves from opponent character ID
  - base source rules:
    - Einstein player: `/assets/characters/einstein/projectile_left.png`
    - Einstein opponent: `/assets/characters/einstein/projectile_right.png`
    - Curie/Turing (and non-Einstein fallback): `/assets/characters/{characterId}/projectile.png`
- Preserved correct orientation behavior:
  - Einstein bases are never flipped
  - opponent Curie/Turing bases are horizontally flipped
- Added large, grounded base placement on the arena floor with outside-edge cropping:
  - player base cropped off left edge
  - opponent base cropped off right edge
  - base wrappers use preserved aspect ratio (`1700 / 1269`) and `object-contain`
- Added compact mirrored HP bars near each base:
  - label `Base`
  - fill based on HP percentage
  - numeric display (`{hp} / 100`)
- Kept and upgraded base FX mapping on new base wrappers:
  - hit: shake + warm red flash/glow
  - heal: mint glow pulse
- Added base-asset failure fallback:
  - tracks failed base image paths
  - falls back to existing glyph placeholder if base art fails to load

### The Reasoning
- Real base art needed to feel like anchored arena objects rather than UI placeholders.
- Matching baseline and controlled edge cropping make the base read as large environment geometry tied to each side.
- Mirrored HP bars preserve quick readability while reducing UI clutter from old standalone text blocks.

### The Tech Debt
- Base position offsets are tuned constants; a future responsive tuning pass may be needed for edge devices and unusual viewport heights.
- Base max HP is displayed as `/100` in FE; if backend later provides dynamic max-base-health, the bar denominator should be sourced from state.

## 2026-05-08 - Base Asset Path Correction + Layer/Presentation Fixes

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - corrected base asset resolver to use real base files:
    - Einstein player: `/assets/characters/einstein/base_left.png`
    - Einstein opponent: `/assets/characters/einstein/base_right.png`
    - others: `/assets/characters/{characterId}/base.png`
  - removed `projectile*` naming from base path logic
- Tightened arena layer ordering:
  - base wrappers moved to lowest layer (`z-0`)
  - character sprites explicitly above base (`z-[6]`)
  - projectile above sprites (`z-[12]`)
  - base HP bars above base (`z-[9]`)
- Preserved presentation rules:
  - no box/background/border/rounded card when base image loads
  - fallback placeholder only when base image fails
  - same baseline alignment, aspect ratio `1700 / 1269`, and outer-edge cropping remain intact

### The Reasoning
- Base art was incorrectly mapped to projectile filenames; this blocked real base visuals.
- Explicit z-index ordering removes ambiguity and ensures bases stay in the arena background while still allowing readable HP overlays.

### The Tech Debt
- Asset extension selection is still hardcoded to `.png`; if future character packs mix formats, a resolver map or manifest will be safer.

## 2026-05-08 - Base Presentation Tuning (HP Above Base + Smaller Scale + Shared Ground Line)

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - moved Base HP UI to sit directly above each base asset by anchoring it to each base wrapper
  - reduced base render footprint for better proportion with current character scale:
    - from `w-[clamp(280px,37vw,560px)]`
    - to `w-[clamp(220px,31vw,430px)]`
  - kept base aspect ratio unchanged (`1700 / 1269`) and existing asset sources
  - aligned base and character to the same floor plane by anchoring both to `bottom-[16%]`
  - preserved base background behavior:
    - no box/panel when base image loads
    - fallback placeholder still only on load failure
  - preserved cropping, hit/heal base FX, and Einstein-specific base handling

### The Reasoning
- HP context reads more naturally when tied to and floating above each base instead of feeling detached.
- Smaller base scale better matches the reduced character size and improves visual balance.
- Shared bottom anchoring reinforces the same-ground illusion between base and character.

### The Tech Debt
- Ground and offset values are still tuned constants; we may need a per-breakpoint calibration pass for very short/mobile viewports.

## 2026-05-08 - Base Repositioning Without Downscale (Cards Separation + Stable HP Layer)

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - restored base render size (removed prior downscale):
    - back to `w-[clamp(280px,37vw,560px)]`
    - restored matching `sizes` hint (`280px/560px`)
  - moved base and character pair upward together to preserve shared ground alignment while clearing hand cards:
    - base wrappers and character wrappers now both anchored at `bottom-[22%]`
  - detached HP UI from base crop/wrapper:
    - moved player/opponent base HP bars into independent arena overlay layers
    - HP bars remain stable/readable even with base edge cropping
- Preserved existing behavior:
  - base assets and aspect ratio unchanged
  - base behind character
  - no UI panel/box on successful base image
  - crop behavior retained
  - Einstein left/right handling retained
  - hit/heal base FX retained

### The Reasoning
- User feedback indicated scale was acceptable; visual conflict was positional.
- Raising the base+character ground line together keeps floor-plane coherence while protecting foreground card space.
- Decoupling HP bars from base wrappers avoids clipping and keeps health info consistently visible.

### The Tech Debt
- Bottom and HP overlay offsets are still hand-tuned constants; we should revisit with viewport-specific tokens if additional responsive edge cases appear.

## 2026-05-08 - Battle Arena Vertical Layout Reset

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - split the arena into a dedicated scene region and a separate bottom hand-card tray
  - reduced base visual dominance and kept base assets as background scene props with preserved aspect ratio
  - kept character and base bottoms on the same visual ground line while preventing overlap with the card tray
  - moved base HP bars into stable top-left/top-right arena UI positions, detached from base art cropping
  - compacted player/rival metadata into inline You/Rival, score pill, rounds pill, and address rows
  - kept rival connection state in the top status chip row instead of inside arena metadata

### The Reasoning
- The previous composition tried to solve card collision with shared absolute offsets, which made bases, characters, HP bars, and hand cards compete for the same vertical space.
- Separating scene and hand tray layout gives the cards a guaranteed bottom zone while letting the arena read as a stage again.
- HP is gameplay UI, not part of the base asset, so it now sits in predictable overlay positions independent of base image crop and scale.

### The Tech Debt
- Base/character ground offsets remain tuned constants; a future responsive QA pass should validate very short mobile viewports and unusual aspect ratios.
- Full npm run lint is still blocked by an existing react-hooks/set-state-in-effect issue in apps/web/src/components/lobby/OpponentFound.tsx; targeted ESLint for BattleScreen.tsx passes.

## 2026-05-08 - Battle Screen Single-Viewport Fit

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - changed the battle page shell from padded min-height to fixed 100svh height with hidden overflow
  - tightened top status chips, section padding, arena gaps, and player metadata spacing
  - made the arena scene flex within available height instead of enforcing large fixed minimum heights
  - reduced base, character, and hand-card clamp sizes so the full battle composition fits without page scroll

### The Reasoning
- The prior split between scene and hand tray fixed overlap, but fixed min-heights plus page padding made the total composition taller than the viewport.
- Treating the battle screen as a bounded viewport layout keeps the room header, arena, characters, bases, HP bars, and hand cards visible as one screen.

### The Tech Debt
- This is tuned for the current battle UI density; very short landscape/mobile viewports may still need a dedicated compact breakpoint if the top status row wraps heavily.

## 2026-05-08 - Battle Arena Edge-to-Edge Scene

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - removed horizontal padding from the arena frame itself
  - kept horizontal padding only on the compact player metadata row and hand-card tray
  - let the scene layer, including cropped base art, run edge-to-edge inside the arena border

### The Reasoning
- The base crop was visually separated from the arena border because the absolute scene was positioned inside the section padding box.
- Moving padding to UI rows preserves readable HUD spacing while allowing background scene props to crop against the actual arena frame.

### The Tech Debt
- Edge-to-edge scene art now depends more on base crop offsets; future character packs with different base silhouettes may need per-character positioning tokens.

## 2026-05-08 - Battle Rival Metadata Mirror Order

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - changed the right-aligned rival metadata order from `Rival · Score · Rounds` to `Score · Rounds · Rival`
  - left player metadata order unchanged as `You · Score · Rounds`

### The Reasoning
- The rival block is right-aligned, so placing the name at the outer edge makes the mirrored HUD read more naturally.

### The Tech Debt
- Metadata markup remains duplicated between player and rival rows; if this HUD keeps changing, a small metadata-row helper could reduce drift.

## 2026-05-08 - Battle Question Panel Above Hand

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - removed the full-screen active-card question overlay
  - rendered the active question as a compact panel directly above the hand cards in the bottom tray
  - kept the existing active card, countdown, answer lock, and `onAnswer` behavior unchanged
  - preserved the active selected card visual while other hand cards remain disabled during answering

### The Reasoning
- The question belongs to the hand-card interaction and should not block the arena scene.
- Placing it above the cards keeps the player focused on the current choice while preserving visibility of bases, characters, projectiles, and reactions.

### The Tech Debt
- The inline question panel is compact and clamps long question text; if future prompts become much longer, we may need a dedicated expanded/read-more state that still avoids blocking the arena.

## 2026-05-08 - Battle Question Panel Layering

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - changed the active question panel from an in-flow hand-tray element to an absolute overlay layer above the cards
  - preserved the same countdown, answer buttons, active-card state, and answer-locking behavior
  - kept a compact hand prompt in the tray so the hand row height stays stable while answering

### The Reasoning
- The previous inline question panel avoided blocking the arena, but it still pushed the arena scene upward because it participated in layout.
- Anchoring the panel above the cards as a layer keeps the top HUD and arena composition stable while preserving proximity to the card interaction.

### The Tech Debt
- The question overlay uses a tuned `bottom: calc(100% + 0.35rem)` anchor; if card tray height changes substantially, this offset may need a small adjustment.

## 2026-05-08 - Battle Question Overlay On Card Layer

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - moved the active question panel from above the card tray to the same bottom layer as the cards
  - anchored the panel over the hand row so it covers the cards while answering instead of floating above them
  - preserved the existing question, timer, and answer behavior

### The Reasoning
- The intended interaction is that selecting a card transforms the hand layer into the answer surface, not that the question becomes a separate layer above the hand.
- Keeping the panel on the card layer avoids pushing arena layout and keeps the interaction spatially tied to the chosen card.

### The Tech Debt
- The overlay currently covers the hand row as a single panel; if we want a more literal card-transform animation later, the selected card could expand into this panel using shared layout motion.

## 2026-05-08 - Battle Answer Feedback Persistence

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - added selected-answer feedback state for the active question panel
  - kept the question panel visible briefly after play result resolution so it does not disappear before attack/heal feedback finishes
  - colors only the selected option: green when the chosen answer is correct, brown/red when the chosen answer is incorrect
  - preserved non-disclosure behavior by not marking or revealing the correct answer when the selected answer is wrong
  - kept active card/question data in a local snapshot so the panel can persist even if hand state updates during resolution

### The Reasoning
- The result feedback should bridge the UI choice and the resulting combat action; clearing the panel immediately made the interaction feel abrupt.
- Showing feedback only on the selected option confirms the player's choice outcome without exposing the correct answer.

### The Tech Debt
- The feedback duration is a tuned constant (`ANSWER_FEEDBACK_DISPLAY_MS = 1200`); if backend animation timings change, this should be aligned with a more explicit combat-resolution signal.

## 2026-05-08 - Darker Correct Answer Green

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - darkened the selected-correct answer highlight to a deeper existing arena green gradient
  - adjusted selected-correct label and text color for contrast on the darker fill
  - left incorrect and neutral answer styling unchanged

### The Reasoning
- The previous correct-answer highlight was too light and felt disconnected from the arena palette.
- A deeper green keeps the success signal clear while matching existing in-game green tones.

### The Tech Debt
- Answer feedback colors are inline in the component; if we continue tuning battle UI states, these should move into shared color tokens.
## 2026-05-08 - BattleScreen Refactor (View Extraction)

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - kept socket state/effects/gameplay handlers in this file
  - replaced large inline UI chunks with extracted component usage
  - switched challenge-link derivation from `useMemo` to direct derivation (same behavior, cleaner lint outcome)
- Added [apps/web/src/components/play/BattleScreenGateStates.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenGateStates.tsx):
  - extracted "Match Context Missing" and "Wallet Required" screens
- Added [apps/web/src/components/play/BattleScreenStatusLayer.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenStatusLayer.tsx):
  - extracted alert stack and top notice banner
- Added [apps/web/src/components/play/BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx):
  - extracted room/disconnect/question/surrender/result/share overlays

### The Reasoning
- `BattleScreen.tsx` had become too large to iterate on safely from FE side.
- Separating presentation-heavy sections from gameplay/state logic reduces cognitive load and makes UI-only edits much faster.
- Overlay extraction also makes modal flows easier to test and tweak independently.

### The Tech Debt
- The central battle arena section (header + character stage + card hand) is still large and can be extracted next into focused presentational components.
- A few prop groups passed to overlay/status components are broad; introducing view-model objects by domain (room state, settlement state, share state) would further simplify contracts.

## 2026-05-08 - BattleScreen Overlay Type Fix (challengeLink nullable)

### The Change
- Updated [apps/web/src/components/play/BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx):
  - changed `challengeLink` prop type from `string` to `string | null` to match `createChallengeLink()` return type and `ChallengeShareCard` contract.

### The Reasoning
- `createChallengeLink` intentionally returns `null` when origin is unavailable.
- Keeping overlay prop strict to `string` caused Next/TS build failure when passing nullable link.
- Nullable typing aligns all layers without changing runtime behavior.

### The Tech Debt
- None introduced. Types are now consistent across link creator, overlay, and share card.

## 2026-05-08 - BattleScreen Refactor Follow-up (Inline Overlay Re-consolidation)

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - removed large inline overlay JSX block that had been reintroduced during conflict resolution
  - restored usage of [BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx) as the single overlay render path
  - removed an unused `playerAddressLabel` derived value

### The Reasoning
- Consolidating overlays back into the extracted component keeps `BattleScreen.tsx` focused on gameplay state/effects and avoids duplicated UI paths.
- It also reduces merge-conflict surface area significantly for future FE iterations.

### The Tech Debt
- The core arena section (header + character stage + hand + inline answer tray) is still the largest remaining block and can be extracted next.

## 2026-05-08 - BattleScreen Question UI De-duplication

### The Change
- Updated [apps/web/src/components/play/BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx):
  - removed the question modal overlay render path (`activeCard && status === "playing" && !isMatchComplete`)
  - removed now-unused question modal props (`activeCard`, `status`, `displaySecondsLeft`, `answerLocked`, `onAnswer`)
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - removed those question-modal props from `<BattleScreenOverlays />` callsite

### The Reasoning
- The in-arena question panel is already present; the overlay modal created duplicate question UI and degraded UX.
- Keeping only one question surface matches intended play flow and reduces visual noise.

### The Tech Debt
- None added. This removes duplicated rendering paths.

## 2026-05-08 - Battle Notice Reposition + Emphasis Upgrade

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - moved transient battle notifications (`gameNotice`) into the main battle arena layout, directly below the top score/VS divider line
  - replaced the previous minimal top overlay look with a stronger in-arena event banner that includes:
    - tone-based label (`Battle Update` for phase events, `Combat Update` for combat events)
    - clearer contrast, border, and shadow treatment per tone
    - preserved enter/exit motion timing and existing notice lifecycle behavior
- Updated [apps/web/src/components/play/BattleScreenStatusLayer.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenStatusLayer.tsx):
  - removed `gameNotice` rendering from the fixed status layer
  - kept socket/system alert stack behavior unchanged
  - removed no-longer-needed notice prop/types tied to that layer

### The Reasoning
- The user feedback was that notifications felt underwhelming and visually detached by appearing as a fixed line-level banner.
- Placing the notice under the battle header keeps it in the player focus zone and ties feedback to the duel stage.
- Separating concerns (alerts in status layer, battle event notices in arena layout) makes future UI tuning safer and clearer.

### The Tech Debt
- Notice colors and copy labels are still inline in `BattleScreen.tsx`; if notification variants expand, we should extract a small shared token map/helper.
- Timing (`2100ms`) is still a fixed constant and may need harmonization with future combat animation durations.

## 2026-05-09 - Battle Notice Vertical Nudge (Higher, Still Centered)

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - moved the in-arena notification banner higher by adjusting its absolute anchor from `top-2` to `top-[-2rem]`
  - kept horizontal centering and existing below-divider placement behavior

### The Reasoning
- The banner looked too low relative to the battle stage; this tweak lifts it closer to the base/combat visual level while preserving the same centered emphasis.

### The Tech Debt
- Vertical placement still depends on tuned offsets combined with scene container padding (`pt-[4.25rem]`); if we continue iterating this area, a dedicated banner anchor container would reduce offset coupling.

## 2026-05-09 - Round Change Winner Notification (Logic-Only)

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - added round progression tracking ref (`previousRoundsWonRef`) for player and rival round wins
  - added a new effect that listens to `playerRoundsWon` / `opponentRoundsWon` changes
  - triggers existing battle notice pipeline on round win changes:
    - `Round winner: You`
    - `Round winner: Your rival`
- Kept presentation/layout untouched (no UI structure/style changes).

### The Reasoning
- Round outcomes are already represented by `roundsWon` counters, so this is the safest source-of-truth to detect when a round result is finalized.
- Reusing `showGameNotice` preserves current notification timing/animation behavior with minimal risk.

### The Tech Debt
- If backend later introduces explicit per-round winner events, this derived approach should be switched to event-driven notices to avoid any edge cases around reconnect snapshots.

## 2026-05-09 - Longer Round-Winner Notification Duration

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - extended `showGameNotice` to accept optional `durationMs` (default remains `2100ms`)
  - kept all existing callers unchanged by relying on the default duration
  - set round-winner notices to a longer display time:
    - `Round winner: You` -> `3200ms`
    - `Round winner: Your rival` -> `3200ms`

### The Reasoning
- Round-result context is more important than transient hit/heal feedback, so it should remain visible a bit longer for readability.
- Using an optional duration parameter avoids UI changes and preserves current behavior for other notice types.

### The Tech Debt
- Notice durations are still hardcoded at call sites; if we keep tuning cadence, we should centralize durations in named constants.

## 2026-05-09 - Settlement Overlay Winner/Loser Emoji Bubbles

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - added `settlementEmojiMood` derivation from existing match outcome states
  - maps winner/loser mood for relevant outcomes:
    - `You Win` / `Opponent Surrendered`: player `confident`, rival `hurt`
    - `You Lose` / `You Surrendered`: player `hurt`, rival `confident`
  - passes `settlementEmojiMood` into the overlays component
- Updated [apps/web/src/components/play/BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx):
  - added `settlementEmojiMood` prop typing and handling
  - inserted a new row under settlement title/subtitle:
    - `[You bubble emoji] [Your Rival bubble emoji]`
  - used chat-bubble-like cards with small directional tails
  - emoji mapping:
    - confident -> `??`
    - hurt -> `??`

### The Reasoning
- The user wanted clearer emotional feedback tied to result outcomes without restructuring the rest of the settlement panel.
- Deriving mood in `BattleScreen` keeps business/outcome logic centralized and keeps overlays mostly presentational.

### The Tech Debt
- Emoji mapping and bubble styling are currently inline in the overlay component; if more expression variants are added, these should move to a shared presentational helper.

## 2026-05-09 - Settlement Overlay Uses Character Expression Assets (Left/Right Anchored)

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - added `settlementExpressionSrc` derived from selected character IDs and winner/loser mood (`confident` / `hurt`)
  - passed `settlementExpressionSrc` into `BattleScreenOverlays`
- Updated [apps/web/src/components/play/BattleScreenOverlays.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx):
  - replaced text emoji output with actual character expression images (`next/image`) inside the existing chat-bubble shapes
  - added per-image fallback handling (`failedExpressionSprites`) if an expression sprite is missing
  - changed result-expression row alignment from centered pair to full-width anchored layout:
    - `You` bubble sticks to left
    - `Your Rival` bubble sticks to right

### The Reasoning
- User requested real expression assets from selected characters rather than generic emoji symbols.
- Keeping mood derivation in `BattleScreen` ensures result logic remains centralized while overlays stay presentational.
- Left/right anchoring preserves side identity and reads closer to battle perspective.

### The Tech Debt
- Expression failure fallback currently shows mood text labels; if any character packs ship incomplete `exp/` sets, we may want dedicated fallback portraits.

## 2026-05-09 - Fix TS Declaration Order for Settlement Expression Sources

### The Change
- Updated [apps/web/src/components/play/BattleScreen.tsx](/d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx):
  - moved `settlementExpressionSrc` derivation to below `playerCharacterId` and `opponentCharacterId` declarations
  - resolved block-scoped variable usage-before-declaration errors for both character IDs

### The Reasoning
- `settlementExpressionSrc` depends on character IDs; deriving it before those constants caused TypeScript compile errors.
- Reordering keeps behavior identical while restoring valid declaration flow.

### The Tech Debt
- None introduced.

## 2026-05-09 - Lobby Restore Fetch Hardening + Unselected Arena Null Image

### The Change
- Updated [apps/web/src/lib/matchmaking/queueMatch.ts](/d:/projects/Cora/apps/web/src/lib/matchmaking/queueMatch.ts):
  - wrapped `getActiveMatchForAddress` fetch in a network-failure guard
  - when fetch fails for non-abort reasons, it now returns `{ inRoom: false }` instead of throwing
- Updated [apps/web/src/components/lobby/LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx):
  - defaulted arena preview background to `/assets/arena/null.png` when no arena is selected
  - always renders the arena image layer so unselected state shows the null image explicitly
- Ran lint verification for edited files:
  - `npm run lint -- src/components/lobby/LobbySetup.tsx src/lib/matchmaking/queueMatch.ts`

### The Reasoning
- Active room restore is best-effort and should not surface noisy fetch exceptions when API is temporarily unreachable.
- Returning `inRoom: false` for network misses preserves flow consistency: no active room means lobby stays in normal setup/select state.
- The UI already contains a null arena asset, so using it as the default unselected background keeps visual state explicit and avoids empty background ambiguity.

### The Tech Debt
- `getActiveMatchForAddress` now treats network errors as "not in room"; if strict connectivity diagnostics are needed later, we should add structured telemetry separate from user-facing flow control.

## 2026-05-09 - Lobby Arena Background Crossfade Stabilization

### The Change
- Updated [apps/web/src/components/lobby/LobbySetup.tsx](/d:/projects/Cora/apps/web/src/components/lobby/LobbySetup.tsx):
  - added deterministic arena-image preloading for `null`, `SOL`, and `BONK` backgrounds
  - replaced direct one-layer background swap behavior with a two-layer crossfade model:
    - base layer uses `displayedArenaImageUrl`
    - incoming layer fades in only after the new image is confirmed loaded/decoded
  - committed next background only after fade duration, reducing visible snap/jank
  - adjusted implementation to satisfy `react-hooks/set-state-in-effect` by deriving incoming URL from render state and only mutating load-state from async image callbacks
- Verified with lint:
  - `npm run lint -- src/components/lobby/LobbySetup.tsx`

### The Reasoning
- Occasional `SOL <-> BONK` rough transitions were caused by late image decode/cache misses while CSS `backgroundImage` URL changed immediately.
- Decoupling "selected image" from "displayed image" lets us wait for the next asset to be ready and then fade it in reliably.
- Keeping updates async-callback driven avoids extra synchronous render loops and aligns with current React lint guidance.

### The Tech Debt
- Crossfade timing is currently hardcoded (`320ms`); if we tune animation cadence globally, this duration should move into shared motion constants.

## 2026-05-09 - Arena Dynamic Subtitle Update

### The Change
- Updated the subtitle text below "Choose Your Arena" in `apps/web/src/components/lobby/LobbySetup.tsx` to dynamically show the selected arena token (e.g. `Selected: SOL Arena`).
- Maintained the instructional fallback text when no arena is selected.

### The Reasoning
- To provide clearer user feedback on which arena is currently selected, in alignment with user requests.
- Kept the change minimal and isolated without altering the broader lobby flow or background behavior.

### The Tech Debt
- None added.

## 2026-05-09 - Align Wallet Connecting UI and Blink Share Button

### The Change
- Grouped the wallet connecting UI and Blink Share button inside a single bottom row flex container using `justify-between` in `apps/web/src/components/lobby/LobbySetup.tsx`.
- Removed their separate margin-top values and added a shared `mt-4` to prevent vertical stacking and vertical scrollbars.

### The Reasoning
- To resolve a layout issue where the wallet UI and Blink Share button were misaligned vertically, causing page overflow and scrolling when the wallet prompt appeared.
- By placing them in a shared flex row, they act as a paired bottom action bar, preserving existing styling while fixing the layout bounds.

### The Tech Debt
- None added.

## 2026-05-09 - Polish Arena Selection Icons

### The Change
- Replaced the hardcoded text-based characters (`\u25ce` and `\u{1F436}`) in the `LobbySetup.tsx` arena card with clean, standard SVG icons using a new internal `ArenaIcon` component.
- The SOL arena now displays a clean geometric Solana logo SVG, and the BONK arena uses a matching styled dog-paw SVG.
- Both icons dynamically map to the appropriate card color states depending on whether they are active or inactive.

### The Reasoning
- Addressed visual inconsistency where SOL was unreadable as a faint text character and BONK appeared as a heavily-styled emoji sticker.
- Ensures both tokens share the same visual language, bounding box, and fill behavior, conforming to the intended premium game UI style.

### The Tech Debt
- The `ArenaIcon` component lives locally in `LobbySetup.tsx`. If these SVGs are needed elsewhere, they should be extracted to a shared icon set within `packages/ui` or `components/ui`.

## 2026-05-09 - Arena Selection Card Color Polish

### The Change
- Updated the active selection state background for the SOL arena card in `LobbySetup.tsx` to use a light green gradient (`linear-gradient(180deg, #eef6ec 0%, #d2e2cd 100%)`).
- Kept the BONK arena card's active background as the warm yellow gradient (`linear-gradient(180deg, #fff1cf 0%, #f8d694 100%)`).

### The Reasoning
- Addressed user feedback requesting a light green fill for the selected SOL button instead of yellow, ensuring better alignment with SOL's designated sage-green color palette (`#9db496`) while preserving BONK's yellow identity.

### The Tech Debt
- The gradients are still defined inline in the `style` prop of the button. Eventually, these specific token-mapped gradients should be added directly to the `ARENAS` data structure in `LobbyScreen.tsx` for cleaner component code.

## 2026-05-09 - Polish Scientist Selection Screen Layout

### The Change
- Added a `showLabels` prop (default `true`) to `apps/web/src/components/character/CharacterSelect.tsx` to allow hiding the "Roster", status line, and "Dev Mode" toggle row.
- Updated `apps/web/src/components/lobby/CharacterSelect.tsx` to pass `showLabels={false}`, removing the redundant UI elements from the lobby phase.
- Removed the Back button from the `preHeadingSlot` of the `RoomPhaseShell`.
- Reintroduced the Back button as a secondary game button (`btn-game-secondary`) positioned right-aligned directly above the character selection grid.

### The Reasoning
- Addressed visual clutter in the lobby by hiding unnecessary character select labels (like dev mode and roster).
- Repositioned the Back button to better match the visual hierarchy of the lobby flow, placing it directly above the action area rather than floating above the main screen header.

### The Tech Debt
- Added an additional prop `showLabels` to the already dense `CharacterSelectProps` in the shared component. As more context-specific visibility toggles are added, it may be worth refactoring this component into a compound component pattern.

## 2026-05-09 - Align Scientist Selection Header with Back Button

### The Change
- Added a `hideTitleBlock` prop to `RoomPhaseShell` and `RoomPhaseHeader` to conditionally hide the left-aligned title block while preserving the status slots.
- Re-implemented the header text (`Setup`, `Choose Your Scientist`, `Choose the mind that will defend your base in the arena.`) manually inside the `CharacterSelect.tsx` screen, placing it in the same flex row as the Back button directly above the scientist cards.

### The Reasoning
- Addressed user feedback stating that the screen header floated too high above the card selection area.
- Grouping the header and the Back button into a single visual band provides better vertical alignment and brings the context closer to the user's focus (the character grid).

### The Tech Debt
- Re-implementing the header block manually bypasses the automatic text handling from `ROOM_PHASE_LABELS`. If this layout pattern becomes standard, `RoomPhaseShell` should be updated to support rendering the header block inline with the children instead of relying on `hideTitleBlock`.

## 2026-05-09 - Rebalance Scientist Selection Header

### The Change
- Removed the `statusSlot` from the `RoomPhaseShell` configuration in `apps/web/src/components/lobby/CharacterSelect.tsx`.
- Moved the status chips (arena label, wager, and wallet address) into the custom header row, rendering them directly above the Back button.

### The Reasoning
- Addressed visual imbalance where the top-right status chips floated too high above the custom header block.
- Moving the status chips into the custom header block ensures the entire top area reads as a single, cohesive band, anchoring the UI directly above the scientist card grid.

### The Tech Debt
- Moving the `statusSlot` contents entirely into the children removes the last piece of content from the `RoomPhaseHeader` for this phase. In the future, this lobby screen may warrant its own bespoke shell layout rather than forcing `RoomPhaseShell` to render completely empty headers.

## 2026-05-09 - Polish Scientist Selection Vertical Spacing

### The Change
- Increased the internal vertical spacing of the header block inside `CharacterSelect.tsx` (e.g. `mt-3`, `leading-relaxed`).
- Increased the gap between the header block and the scientist cards to `mb-8 md:mb-10`.
- Moved the `Enter Queue` button out of the `RoomPhaseShell`'s `footerSlot` and placed it directly after the `CharacterSelectPanel` in the main children area with `mt-6 md:mt-8`.

### The Reasoning
- Addressed visual compression at the top of the screen by providing the header elements more breathing room before the card grid begins.
- Moving the `Enter Queue` button out of `footerSlot` prevents it from being pinned to the absolute bottom of the `100svh` viewport. This anchors the button visually to the card selection section and eliminates the awkward empty gap that was previously separating them.

### The Tech Debt
- None added. The layout relies on flexbox flow as intended, allowing the empty space to collect safely below the content instead of awkwardly separating the UI.

## 2026-05-09 - Restructure Scientist Selection Header Layout

### The Change
- Extracted the status pills (`SOL Arena`, wager, wallet) out of the main header row into their own independent utility row at the very top of `CharacterSelect.tsx`.
- Reconfigured the main header row to contain only the text block on the left and the Back button on the right.
- Changed the vertical alignment of the main header row to `items-center`, anchoring the Back button vertically to the title text rather than allowing it to be pushed downward.

### The Reasoning
- Addressed layout feedback where the Back button was visually misaligned, feeling closer to the scientist cards than to the header itself.
- Separating the purely informational status pills from the navigation/header row establishes a clearer visual hierarchy and prevents awkward flexbox stacking on the right side.

### The Tech Debt
- None. This is a standard structural refinement utilizing existing Tailwind utilities.

## 2026-05-09 - Adjust Scientist Selection Pill Padding

### The Change
- Restored the use of `statusSlot` in `RoomPhaseShell` within `CharacterSelect.tsx` for rendering the arena/wager/wallet pills.
- Removed the inline pill row that was nested directly inside the custom header container (`children`).

### The Reasoning
- Addressed user feedback regarding excessive top padding above the pill row. 
- By moving the pills back into `statusSlot`, they are rendered inside `RoomPhaseHeader`, perfectly matching the CSS container spacing (`pt-5 md:pt-6`) of the prior `LobbySetup` screen. This ensures a 1:1 visual continuity for the top-right utility elements across both phases.

### The Tech Debt
- None. This reverts a previous structural hack and utilizes the native shell slots properly.

## 2026-05-09 - Remove Fake Stats from Character Cards

### The Change
- Completely removed the mock `stats` arrays (e.g., `Logic 92`, `Computation 88`) from `LobbyScreen.tsx` and `app/dev/room-states/page.tsx` character data.
- Removed the `CharacterStat` type and the `stats` field from the `CharacterOption` interface in `characterTypes.ts`.
- Removed the rendering block in `CharacterCard.tsx` that mapped over and displayed the fake numeric stat chips.
- Renamed Albert Einstein's base to `The Relativity Room` and Marie Curie's base to `The Radium Reactor` to align better with their actual gameplay specialties (`math` and `logical`, respectively) and avoid misleading players with physics/chemistry imagery.

### The Reasoning
- Addressed a misleading discrepancy where the display-facing flavor stats on the character cards did not align with the actual gameplay specialty categories (`sequence`, `logical`, `math`) defined in `packages/shared-types/src/characterStats.ts`.
- Instead of inventing new fake numbers for the real categories, the fake numeric chips were removed entirely to keep the UI clean and strictly aligned with the single source of truth. The real specialty and multiplier (e.g., `Logical Specialist`, `x1.5`) are still displayed dynamically by `CharacterCard.tsx`.

### The Tech Debt
- Removed technical debt by eliminating the need to maintain mock `stats` arrays. The character cards now rely purely on the actual backend `CHARACTER_DEFS` mapping to display specialty and multiplier info.

## 2026-05-09 - Matchmaking Expression Imagery & Bug Fix

### The Change
- Fixed an iterable crash in `LobbyScreen.tsx` where `.stats` was still being destructured from the `characterOptions` memo, even though the field was removed.
- Added the selected character's `idle.png` expression image to the "You" and "Opponent" portrait slots in `MatchmakingWaiting.tsx`.
- Included an image loading fallback mechanism in `MatchmakingWaiting.tsx` that reverts to the character's initial if the expression image fails to load.

### The Reasoning
- Addressed an oversight from the fake stats removal where a spread operation on the undefined `stats` array caused a client-side crash.
- Replaced the text-based initials in the matchmaking waiting screen with the character's full 2D idle expressions, matching the aesthetic fidelity established in the character selection cards.

### The Tech Debt
- None. This aligns the matchmaking waiting UI with the asset loading patterns used elsewhere in the application.

## 2026-05-09 - Arena Background in BattleScreen

### The Change
- Added dynamic arena background rendering to `BattleScreen.tsx`.
- Mapped `arenaId` param to specific image assets (SOL or BONK).
- Included fallback behavior for missing or failed images using the existing green/radial background.
- Layered dark overlays for UI readability.

### The Reasoning
- Extends the lobby arena choice visually into the battle phase while keeping gameplay UI legible and undisturbed.

### The Tech Debt
- The arena images are loaded synchronously during render and fade in natively. If more arenas are added, dynamic preload strategies might be necessary.

## 2026-05-09 - Settlement Overlay Polish (Compact Stats, Emote Focus, Payout Copy)

### The Change
- Updated [`apps/web/src/components/play/BattleScreenOverlays.tsx`](d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx) to rebalance the finished/settlement modal layout:
- Replaced large stat boxes with a compact chip-based summary row (`Rounds`, `Correct`, `Timeout`, `Wrong`) to reduce vertical footprint.
- Enlarged the settlement emote portraits substantially and centered them as the visual focal point while keeping `YOU` and `YOUR RIVAL` labels.
- Added outcome-aware payout/result copy block near the title, with stronger highlight styling for winning outcomes.
- Made title/subtitle spacing resilient for short and long settlement titles using clamped title sizing, max-width constraints, and balanced wrapping.
- Added a new derived display prop in [`apps/web/src/components/play/BattleScreen.tsx`](d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx): `settlementOutcomeKind`, then passed it into `BattleScreenOverlays`.

### The Reasoning
- The previous grid-based stat cards dominated the modal height and competed with the emotional result moment; compact chips keep the data visible but secondary.
- Emote expressions are the strongest emotional signal at battle end, so increasing their size and visual weight improves clarity and delight.
- Payout relevance is highest on wins/surrenders; adding explicit, state-aware copy improves comprehension without touching settlement logic.
- Using an explicit derived outcome prop avoids brittle string parsing on `settlementText`, so variant titles (including long cancellation/invalidated states) can change safely.
- Payout text is deliberately conservative: it references available token/wager context and avoids inventing an exact payout amount.

### The Tech Debt
- `settlementOutcomeKind` currently lives as a local derived string in `BattleScreen.tsx`. If other screens need the same semantics, consider introducing a shared `deriveSettlementOutcomeKind(...)` helper to prevent drift.
- `wagerUsd` parsing assumes a numeric-like string (as currently supplied). If upstream formatting changes, a dedicated formatter utility would make this safer and reusable.

## 2026-05-09 - End-Game Defeated Base Transition Before Settlement Overlay

### The Change
- Updated [`apps/web/src/components/play/BattleScreen.tsx`](d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) to add a local visual-only end-game transition phase before the settlement modal appears.
- Introduced short transition states:
- `showSettlementOverlay` to gate settlement popup visibility without changing real match completion logic.
- `endgameDefeatedSide` (`player` | `opponent` | `null`) to target only the losing/surrendering side.
- `endgameBaseFadeActive` to trigger quick loser-base fade/dissolve timing.
- Added a keyed end-game sequence (with timer cleanup) that:
- identifies defeated side from `settlementOutcomeKind`,
- triggers hit/hurt beat,
- starts base fade on that side only,
- then reveals settlement overlay after ~1080ms.
- Draw/cancelled/invalidated/pending paths skip base fade and use a short neutral delay.
- Forced defeated-side `hurt` reaction display while transition runs so it remains visible until the popup appears.
- Updated base rendering to fade/sink only the defeated base (no full-screen fade, no winner base fade).
- Updated [`apps/web/src/components/play/BattleScreenOverlays.tsx`](d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx) to accept `showSettlementOverlay` and render the settlement popup/share modal only when the transition gate opens.

### The Reasoning
- The match-complete state should stay truthful immediately for gameplay/network logic, while the visual transition should be presentation-only.
- Isolating the defeated-side animation avoids unintended global fade behavior and preserves battle readability.
- A short, punchy timing window (~1.08s) delivers impact without making result flow feel sluggish.
- Explicit timer cleanup prevents stale animation state when remounting/resetting or when rapid state changes occur.

### The Tech Debt
- End-game timing constants are local in `BattleScreen.tsx`; if additional cinematic beats are added later, this should move into a dedicated transition config/helper for consistency.
- The defeated-base dissolve uses lightweight opacity/transform transitions; if art-direction asks for richer FX, consider a reusable shader/particle layer component.

## 2026-05-09 - Settlement Overlay Follow-up Polish (Consolidated)

### The Change
- Consolidated several small follow-up tweaks in [`apps/web/src/components/play/BattleScreenOverlays.tsx`](d:/projects/Cora/apps/web/src/components/play/BattleScreenOverlays.tsx):
- Moved `Show Settlement Details` below `Blink Share` and `Back To Lobby`, centered.
- Kept details panel behavior but relocated it under the new toggle position.
- Removed subtitle rendering (including `Victory secured.` style line).
- Removed the white framed stats wrapper while keeping compact stat chips.
- Updated win payout copy to use net formula `wagerUsd * 2 * 0.975`.
- Finalized direct payout copy format: `You win the $X wager in SOL/BONK.`
- Switched settlement CTAs to shared button system (`btn-game` variants).
- Reduced CTA width/footprint and changed layout to centered compact row.
- Applied green visual treatment to `Back To Lobby`.

### The Reasoning
- These were iterative UI micro-adjustments to improve hierarchy, reduce modal clutter, and align settlement CTAs/copy with the rest of the app.
- Consolidating the notes keeps the devlog readable while preserving intent and final-state decisions.

### The Tech Debt
- `settlementSubtitle` remains in the prop contract but is no longer rendered.
- Win payout formula and green `Back To Lobby` styling are currently UI-local. If reused, extract shared helper/class.

## 2026-05-09 - FE-Only Destroyed Base End-Game Effect

### The Change
- Enhanced end-of-match visual sequencing in [`apps/web/src/components/play/BattleScreen.tsx`](d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) with a frontend-only destroyed-base beat before settlement popup reveal.
- Added short phased end-game visual states and timings for:
- impact flash,
- crack reveal,
- smoke/debris particle reveal,
- loser-base fade/sink progression,
- popup reveal gating via existing `showSettlementOverlay`.
- Reused existing base shake pathway (`playerBaseFx` / `opponentBaseFx` with `hit`) for the punchy shake stage.
- Added defeated-base-only overlays (no new image assets):
- red radial impact flash,
- crack/damage line overlays,
- animated smoke/debris particle puffs,
- ground dust haze,
- stronger or softer fade/sink based on standard defeat vs surrender outcome.
- Kept forced `hurt` expression behavior until settlement popup appears.
- Preserved neutral behavior for draw/cancelled/invalidated (no destroyed-base effect, short neutral delay only).

### The Reasoning
- This gives a clear final impact moment for the losing side while keeping all authoritative match/settlement logic unchanged.
- Effects are scoped to the defeated base container only, ensuring the winning base and full-screen scene remain stable.
- Soft-mode handling for surrender outcomes keeps visual tone appropriate while still signaling defeat.

### The Tech Debt
- Destroyed overlays (crack line geometry and particle tuning) are handcrafted inline in `BattleScreen.tsx`; if reused later, they should be extracted into a dedicated reusable effect component.
- End-game visual timing constants are currently local and manually coordinated; if more cinematic variants are added, centralizing timing profiles would reduce drift.

## 2026-05-09 - Longer Destroyed-Base Beat + Winner Confident End Emote

### The Change
- Updated end-game timing in [`apps/web/src/components/play/BattleScreen.tsx`](d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) to make the destroyed-base sequence feel more rewarding before settlement popup appears.
- Increased total end-game transition duration from `1080ms` to `1320ms`.
- Delayed fade and smoke beat slightly to better pace impact -> crack -> debris -> sink.
- Added forced winner `confident` end-state reaction during the same pre-popup window, mirroring the forced loser `hurt` behavior.
- Winner/loser forced reactions now both hold until settlement popup is shown for clear-loser outcomes.

### The Reasoning
- The previous timing felt too quick for the visual achievement moment after a win.
- Showing both emotional states (`confident` winner and `hurt` loser) creates clearer end-match readability and stronger payoff.

### The Tech Debt
- End-game timing remains hardcoded constants in `BattleScreen.tsx`; if more variants are requested, timing profiles should be centralized.

## 2026-05-09 - Extend Destroyed-Base End Sequence to 2.5s (Active FX)

### The Change
- Updated end-match timing in [`apps/web/src/components/play/BattleScreen.tsx`](d:/projects/Cora/apps/web/src/components/play/BattleScreen.tsx) to a `2500ms` total transition.
- Retimed effect phases so added duration is filled by active visuals:
- impact/crack/smoke reveal delays pushed later,
- loser-base fade/sink transition extended,
- smoke/debris particle motion curves significantly extended with multi-stage opacity/position keyframes.

### The Reasoning
- Matches request for a longer accomplishment beat without dead air, by extending visual activity rather than just delaying popup timing.

### The Tech Debt
- End-game phase timing is still tuned by local constants and inline keyframes; a dedicated transition profile object would simplify future balancing.
