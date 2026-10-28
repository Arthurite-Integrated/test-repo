---
inclusion: always
---

# Realtime rooms (multiplayer layer)

This boilerplate includes an app-agnostic multiplayer backend: rooms with 4-letter codes, join/leave, a host who starts the game with a shared seed, and message relay between players. Full protocol: #[[file:docs/REALTIME-PROTOCOL.md]]

## Rules for any app built on it

- The frontend talks to the backend ONLY through `RoomClient` (`frontend/src/realtime/RoomClient.ts`) and the `useRoom` hook. Never open a raw `WebSocket` in app code.
- Do NOT change the backend for app-specific rules. The backend only relays messages and manages rooms. Scoring, win conditions, game logic and message formats belong in the frontend. Only change `backend/src/shared/` or `backend/lib/realtime.ts` when the generic room behaviour itself needs to change, and then update `docs/REALTIME-PROTOCOL.md` and the tests.
- Define your app's message types in one place (for example `src/game/messages.ts`) as a typed union, and wrap `client.send` / `client.on` so the rest of the app is type-safe.
- Use `snapshot.seed` (from `game.started`) for anything random that all players must agree on. Never use `Math.random()` for shared state.
- Throttle state broadcasts (a few per second, never every frame). Put an incrementing counter in payloads where order matters; messages can arrive out of order.
- After `client.reconnected` or `player.reconnected`, resync state. The backend does not replay missed messages.
- Handle `client.closed` and `player.left` in the UI (for example by declaring the other player the winner).
- Show errors from `RoomClientError.code` to the user in plain words (see the error table in the protocol doc).

## Testing during development

- Run the local server: `cd backend && npm run local:realtime`.
- Run the frontend against it: `cd frontend && npm run dev:local`, then open two tabs: `http://localhost:5173/?as=alice` and `http://localhost:5173/?as=bob`. Each tab is a separate player and no Cognito account is needed.
- `src/RoomPlayground.tsx` is a working example of create/join/start/chat. Use it as a reference, and remove it from `App.tsx` once the real game screens exist.
- Before calling work done, run in `frontend/`: `npm run build` and `npm test`. Run in `backend/`: `npm test` and `npx cdk synth`.
- The `chrome-devtools` MCP server (see `.kiro/settings/mcp.json`) can drive the browser: open two tabs, play, and read console errors. Use it to verify behaviour instead of assuming.
