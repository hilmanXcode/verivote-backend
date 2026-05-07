# VeriVote Backend

Complete blockchain-based e-voting backend for the VeriVote mobile app.

## Architecture

```
Mobile App (Expo/RN) → REST API (Express.js) → Blockchain (Solidity/Hardhat)
                                             → PostgreSQL (user data, announcements)
```

## Quick Start

### 1. Start Blockchain (Hardhat Local Node)

```bash
cd blockchain
npm install
npx hardhat node          # Terminal 1 - Keep running
npm run deploy:local      # Terminal 2 - Deploy contracts
```

### 2. Setup Database

Make sure PostgreSQL is running, then create the database:

```bash
createdb verivote
```

### 3. Start API Server

```bash
cd api
npm install
npm run seed              # Seed demo data
npm run dev               # Start server on port 3000
```

### 4. Connect Mobile App

Update `API_BASE_URL` in `verivote-mobile/src/services/api.ts`:

```typescript
// Android Emulator
const API_BASE_URL = "http://10.0.2.2:3000/api";

// iOS Simulator
const API_BASE_URL = "http://localhost:3000/api";

// Physical Device (replace with your PC's IP)
const API_BASE_URL = "http://192.168.x.x:3000/api";
```

## Smart Contracts

| Contract | Description |
|---|---|
| `VoterRegistry.sol` | Voter registration, NIM mapping, role management |
| `VeriVoteMain.sol` | Election lifecycle, candidate management, vote casting |

### Election Lifecycle

```
Draft → (add candidates) → Ongoing → (voting) → Completed → (view results)
```

## API Endpoints

### Auth
- `POST /api/auth/login` - Login with NIM & password
- `POST /api/auth/register` - Register new user
- `GET /api/auth/me` - Get current user info
- `PUT /api/auth/change-password` - Change password

### Elections (Blockchain)
- `GET /api/elections` - List all elections
- `GET /api/elections/:id` - Election details with candidates
- `POST /api/elections` - Create election (admin)
- `POST /api/elections/:id/candidates` - Add candidate (admin)
- `POST /api/elections/:id/start` - Start election (admin)
- `POST /api/elections/:id/end` - End election (admin)
- `GET /api/elections/:id/results` - Get results (completed only)

### Voting (Blockchain)
- `POST /api/vote/:electionId` - Cast vote
- `GET /api/vote/:electionId/status` - Check vote status
- `GET /api/vote/:electionId/verify/:address` - Verify vote

### Users
- `GET /api/users` - List users (admin)
- `POST /api/users` - Create user (admin)
- `PUT /api/users/:id` - Update user (admin)
- `DELETE /api/users/:id` - Delete user (admin)

### Announcements
- `GET /api/announcements` - List announcements
- `POST /api/announcements` - Create (admin/operator)
- `PUT /api/announcements/:id` - Update (admin/operator)
- `DELETE /api/announcements/:id` - Delete (admin/operator)

## Demo Accounts

| Role | NIM | Password |
|---|---|---|
| Admin | admin001 | admin123 |
| User | user001 | user123 |
| Operator | operator001 | operator123 |
