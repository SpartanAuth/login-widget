# Basic App Example

## Installation

Run the following command to install dependencies:

```bash
npm install
```

## Running the Example

After installation, start the example with:

```bash
npm run start
```

The app will be available at `http://localhost:5173` (or another port if 5173 is in use).

## Features

### Login Flow
- Navigate to `http://localhost:5173` to see the login page
- Supports multiple authentication methods (password, WebAuthn, OTP)
- Multi-language support (EN, FR, ES, JA) - click "Change Language" button

### Invite Flow
The app supports hash-based routing for completing user invitations:

- **Invite URL format:** `http://localhost:5173/?sub={userid}#invite=true&otp={inviteCode}`
- When users click the invite link in their email, they'll land on the invite completion page
- The invite widget automatically extracts the invite code from the URL
- Users can navigate back to login using the "← Back to Login" link

### Example Usage

1. **Admin invites a user** via the SpartanAuth API:
   ```bash
   POST /api/v1/users/invite
   {
     "sectorID": "your-sector-id",
     "email": "newuser@example.com",
     "name": "New User"
   }
   ```
   Response includes the `sub` (invite code).

2. **Email link** sent to user:
   ```
   http://localhost:5173/?sub={userid}#invite=true&otp={inviteCode}
   ```

3. **User clicks link** and lands on invite completion page with:
   - OTP field (from email)
   - Password field (to set their password)
   - Auto-redirect to app after completion

4. **Navigation:**
   - Login page: `http://localhost:5173` or `http://localhost:5173/#login`
   - Invite page: `http://localhost:5173/?sub={userid}#invite=true&otp={inviteCode}`

## Configuration

Update the `domain` attribute in `index.html` to point to your SpartanAuth server:

```html
<!-- Login widget -->
<spartan-login domain="http://your-server:11000" ... ></spartan-login>

<!-- Invite widget -->
<spartan-invite domain="http://your-server:11000" ... ></spartan-invite>
```

## Protected Page

After successful login or invite completion, users are redirected to `app.html` which demonstrates:
- Authentication required page
- Account settings widget
- Session management

