# Frontend (Vite + React)

Minimal React + TypeScript shell wired to the backend's Cognito user pool and API. It is hosted on AWS Amplify Hosting.

## What is in here

```
src/main.tsx            entry point, configures auth
src/App.tsx             app shell: setup check, sign-in, example protected call
src/config.ts           reads VITE_* settings, configures Amplify Auth (Cognito)
src/auth/AuthPanel.tsx  sign up, confirm email, sign in
src/auth/token.ts       gets the token for the realtime server (Cognito, or a dev token locally)
src/realtime/RoomClient.ts  THE integration point for the multiplayer backend: rooms, messages, auto-reconnect
src/realtime/useRoom.ts     React hook: one connected client per component
src/game/               the 2-player XO game (see "The XO game" below)
src/RoomPlayground.tsx  generic example screen (create, join, start, chat); no longer used by App, kept as a reference
src/api/client.ts       typed API client that sends the Cognito token
src/styles.css          light/dark styles
.env.example            the settings the app needs
```

## Settings

The app reads these from `.env.local` (local) or Amplify build environment variables (production):

| Variable | Source |
| --- | --- |
| `VITE_PROJECT_NAME` | `projectName` in `backend/cdk.json` |
| `VITE_API_URL` | stack output `ApiUrl` |
| `VITE_REGION` | stack output `Region` |
| `VITE_USER_POOL_ID` | stack output `UserPoolId` |
| `VITE_USER_POOL_CLIENT_ID` | stack output `UserPoolClientId` |
| `VITE_WS_URL` | stack output `WebSocketUrl` (leave out if realtime is disabled) |
| `VITE_DEV_AUTH` | set automatically by `npm run dev:local` (see `vite.config.ts`); never set it yourself |

### Generate `.env.local` from the deployed stack

```bash
cd ../backend
npm run deploy          # writes cdk-outputs.json
npm run env:frontend    # writes ../frontend/.env.local
```

Or copy `.env.example` to `.env.local` and fill it in by hand. If settings are missing, the app shows a "Setup needed" screen instead of failing.

## Commands

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Start the dev server at http://localhost:5173 (real Cognito and AWS) |
| `npm run dev:local` | Dev server against the local realtime server, with no sign-in (see below) |
| `npm test` | Run the unit tests (vitest): RoomClient, XO engine, messages, protocol, screens |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build locally |

## Using the realtime rooms from your app

All multiplayer code goes through `RoomClient`. Never open a raw WebSocket.

```tsx
import { useRoom } from './realtime/useRoom';

function Game() {
  const { client, snapshot } = useRoom();   // connects on mount, disconnects on unmount
  // snapshot: { connection, userId, room, seed }  (re-renders on every change)

  useEffect(() => client.on('move', (payload, msg) => applyMove(msg.from, payload)), [client]);
  useEffect(() => client.on('player.left', () => showWinner()), [client]);

  // await client.createRoom({ maxPlayers: 2 })   or   await client.joinRoom('ABCD')
  // client.send('move', { x: 3, seq: 12 })        goes to everyone else in the room
  // await client.start()                           host only; snapshot.seed is then shared by all
}
```

Errors are `RoomClientError` with a stable `code` (`room_full`, `room_not_found`, `room_locked`, ...). The full list is in `../docs/REALTIME-PROTOCOL.md`.

Guidelines: use the shared `seed` for anything random that must match across players; throttle state updates to a few per second; add a `seq` counter where order matters; resync state after `client.reconnected`.

## Testing locally with two players (no AWS, no sign-in)

```bash
# terminal 1
cd ../backend && npm run local:realtime
# terminal 2
npm run dev:local
```
Open `http://localhost:5173/?as=alice` and `http://localhost:5173/?as=bob`. Each browser tab is its own player (the identity is kept per tab). `dev:local` always points at the local server, even if you have already deployed and have a real `.env.local`. To use another port: `VITE_LOCAL_WS_URL=ws://localhost:8788 npm run dev:local` (PowerShell: `$env:VITE_LOCAL_WS_URL="ws://localhost:8788"; npm run dev:local`). This mode runs only in the Vite dev server and is compiled out of production builds.

## The XO game

Two players, one room. The host creates a room and plays X; the other player joins with the 4-letter code and plays O. The backend only relays messages, so the host is the referee: it checks every move and sends the board (`state`, with an increasing `seq`) to the other player. A room locks once the game starts, so a rematch means going back to the lobby and making a new room.

```
src/game/xo.ts          pure engine (board, win/draw, applyMove)
src/game/messages.ts    typed move / state / sync messages and validation
src/game/controller.ts  host-authoritative protocol, resync, forfeit (no React)
src/game/roles.ts       who is X/O, status text, result, canPlay
src/game/XoGame.tsx     picks the screen: Lobby, GameScreen, ResultScreen
```

Spec: `../.kiro/specs/xo-game/` (requirements, design, tasks).

To play with yourself, follow "Testing locally with two players" above and use two tabs: `?as=alice` creates the room, `?as=bob` joins with the code, then Alice presses Start. To test a drop, close one tab's network (DevTools, Network, Offline) and bring it back within 25 seconds; the other tab shows "Opponent reconnecting..." and play resumes.

## Where to add things

- **A new API call:** add a typed function in `src/api/client.ts`, for example `export const getThing = () => api.get<Thing>('/things')`.
- **New screens and components:** add them under `src/` and render them from `src/App.tsx`. Add a router if you need multiple pages.
- **Styling:** edit `src/styles.css`, or swap in your preferred UI library.

## Deployment

Amplify builds this folder on every push to the configured branch, using the build spec defined in `backend/lib/frontend-stack.ts` (`npm ci`, then `npm run build`, publishing `dist/`). Commit `package-lock.json` so `npm ci` works. See the root README for the one-time GitHub setup.
