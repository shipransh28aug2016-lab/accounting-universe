# UI / UX Design System (apps/web)

**Principles:** exact numbers from the engine, never decoration; every control usable by keyboard and touch; honesty about what is unbuilt.

* **Colour tokens** (CSS variables in `src/styles.css`): deep teal brand, warm paper background, gold accent; separate good/warn/bad/info tints.
  Light and dark follow `prefers-color-scheme`. Text pairs were chosen for AA contrast; **not tool-measured** (see TESTING_STRATEGY).
* **Type:** system UI stack incl. Devanagari fallbacks; 1rem body, fluid `h2`.
* **Layout:** single column, max 1080px, cards/panels; 16px gutter; verified no horizontal page scroll at 390px. Wide tables scroll inside their own wrapper.
* **Navigation:** HOME · CLASS XI · CLASS XII · VISUAL LABS · PRACTICE · AI TUTOR · MY PROGRESS · TEACHER DASHBOARD; collapses to a menu button < 720px; skip link; `aria-current`.
* **Class selector:** Home hero; Class XII also asks for Option I (analysis) or Option II (computerised) and states Option II labs are not built.
* **Lab pattern:** 1 Learn → 2 Worked example → 3 Try it (ARIA tablist with arrow keys). Results are a list of typed blocks (tables, journals, bars, ratio bars, equation tanks, cash streams, lifecycle) drawn as SVG/DOM from engine values.
* **Animation:** Play / Pause / Step / Reset / Speed on the ledger page; under `prefers-reduced-motion` transitions are removed and Play slows to one step per 2.4 s.
* **Feedback:** errors are plain sentences with the field marked `aria-invalid`; live regions announce posts, results and errors.
* **Colour is never the only signal:** status chips carry text, balanced/unbalanced shows ✓/✗ and words.
* **Dark mode, mobile** reviewed visually via screenshots in this session; not tested on real devices or other browsers.
