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
