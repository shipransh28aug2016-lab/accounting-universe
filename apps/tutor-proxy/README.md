# Tutor proxy

A tiny server that lets the web app offer an AI tutor **without ever putting an API key in the browser**.

```
ANTHROPIC_API_KEY=… TUTOR_ORIGIN=https://your-site node server.mjs     # listens on :8787
```
Then build the web app with `VITE_TUTOR_URL=https://your-proxy/api/tutor`. If the variable is not set the tutor box is hidden and the app works exactly as before — **the core app never depends on AI**.

What it enforces (all covered by `npm test`, run against a mock upstream — **it has not been run against the live API from this repo**):
* the key lives only in the server's environment; it is never returned to the browser;
* the request must carry the **engine's own results** ("facts"); the model is told to explain them, not compute;
* **output guard**: any figure of 3+ digits in the reply that is not in the facts or the student's question causes the reply to be withheld;
* hint mode forbids giving the answer; the current chapter and prescribed-vs-supplementary rule are in the system prompt;
* cost: small output cap (400 tokens), per-IP hourly limit, global daily ceiling;
* no student names or progress are sent — only the question, the chapter name and the engine facts.
