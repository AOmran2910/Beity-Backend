# Beity – Backend (Milestone 4)

Beity (بيتي, "my home") is a website for booking licensed holiday homes in Egypt, like Airbnb but only for Egypt. Every home must have a tourism licence that an admin checks before guests can book it.

This repository is the **backend**: a Node.js and Express API with a MySQL database. For Milestone 4 it has:

- Sign up, log in and log out with hashed passwords and a secure session cookie (HttpOnly, Secure, SameSite=Strict)
- Two helper cookies: `beity_prefs` (language and last searched place, 180 days) and `beity_recent` (recently viewed homes, 30 days). Both are HttpOnly, Secure and SameSite=Lax and hold no personal data
- Two complete use cases from Milestone 2: **Create Listing** and **Book a Stay**
- Security: a security log (event, user, IP and time), AES-256-GCM encryption for phone numbers and home addresses, input validation, CSRF tokens, role checks, rate limiting, account lock-out and HTTPS

The front end (HTML, CSS and JavaScript) will be added in the next milestone. All data is sent and received as JSON.

## Third-party packages

| Package | Why it is used |
|---|---|
| express | Web server and routes |
| mysql2 | Connects to MySQL with prepared statements |
| bcryptjs | Hashes passwords with bcrypt (pure JavaScript, so no build tools are needed) |
| cookie-parser | Reads the session cookie from requests |
| dotenv | Loads settings and secrets from the `.env` file |

Everything else (encryption, hashing session codes, HTTPS, tests) uses Node's built-in modules: `crypto`, `https` and `node:test`.

## Folder structure

```
beity-backend/
├── database/
│   ├── schema.sql        tables, keys and rules
│   ├── app_user.sql      MySQL user with only the rights the app needs
│   └── seed.js           test admin, host and one published home
├── src/
│   ├── server.js         starts HTTPS (and HTTP that redirects to HTTPS)
│   ├── app.js            Express app: middleware and routes
│   ├── config/db.js      MySQL connection pool
│   ├── routes/           which URL goes to which controller
│   ├── middleware/       login check, roles, CSRF, rate limit, headers, errors
│   ├── controllers/      the logic of each request
│   ├── models/           all the SQL queries
│   └── utils/            validation, encryption, dates and prices, security log
├── tests/
│   ├── unit/             unit tests (npm test)
│   └── api-checks.js     full API test of both use cases (npm run test:api)
└── postman/
    └── Beity_API.postman_collection.json   Postman collection (import it into Postman)
```

## How to run

You need **Node.js 20 or newer** and **MySQL 8**.

1. Install the packages:
   ```
   npm install
   ```
2. Create the database and the app user (or open the two files in MySQL Workbench and run them):
   ```
   mysql -u root -p < database/schema.sql
   mysql -u root -p < database/app_user.sql
   ```
3. Copy `.env.example` to `.env`. Put the same database password you used in `app_user.sql`, and make an encryption key:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
4. Make a local HTTPS certificate. On Windows, run this in **Git Bash** (in VS Code: terminal dropdown → Git Bash). `MSYS_NO_PATHCONV=1` stops Git Bash from changing `/CN=localhost` into a Windows path:
   ```
   MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:2048 -nodes -keyout certs/key.pem -out certs/cert.pem -days 365 -subj "/CN=localhost"
   ```
   On macOS or Linux, the same command works without `MSYS_NO_PATHCONV=1`.
5. Add the test data, then start the server:
   ```
   npm run seed
   npm start
   ```
   The API runs on `https://localhost:3443/api/v1`. Plain `http://localhost:3000` redirects to HTTPS.
6. Run the tests (keep the server running in another terminal for the API test):
   ```
   npm test
   npm run test:api
   npm run audit
   ```
   `npm test` runs 24 unit tests, `npm run test:api` runs 53 API checks, and `npm run audit` checks the packages for known security problems.

**Test accounts** (made by `npm run seed`, for local testing only):

| Role | Email | Password |
|---|---|---|
| Admin | admin@beity.test | Admin-Pass-2026 |
| Host | host@beity.test | Host-Pass-2026 |

## Postman

1. Open Postman and import `postman/Beity_API.postman_collection.json`.
2. In Postman settings, turn off "SSL certificate verification" (the local certificate is self-signed).
3. Start the server, then run the collection with the Collection Runner (folders 1 to 4 in order).

The collection has 33 requests and 57 tests. Postman keeps the cookies for you, and after every login a script saves the CSRF token in `{{csrfToken}}`, which is sent in the `X-CSRF-Token` header.

## Endpoints in this milestone

| Method | Endpoint | Who | What it does |
|---|---|---|---|
| POST | /auth/signup | Anyone | Makes a guest account and logs in |
| POST | /auth/login | Anyone | Checks email and password, starts a session |
| POST | /auth/logout | User | Ends the session and clears the cookie |
| GET | /auth/me | User | Returns the logged-in user and the CSRF token |
| GET | /listings/:id | Anyone | Shows a published home (and adds it to `beity_recent`) |
| GET | /listings/recent | Anyone | Recently viewed homes from the `beity_recent` cookie |
| GET / PUT | /preferences | Anyone | Reads / saves language and last searched place in `beity_prefs` |
| GET | /listings/:id/availability | Anyone | Checks dates and works out the price |
| GET / POST | /host/listings | Host | Lists the host's homes / saves a new home as a draft |
| PUT | /host/listings/:id/license | Host | Adds the tourism licence number |
| POST | /host/listings/:id/submit | Host | Sends the home to an admin for review |
| GET | /host/bookings | Host | Booking requests for the host's homes |
| PATCH | /host/bookings/:id | Host | Accepts or declines a request |
| POST / GET | /bookings | User | Books a stay / lists my bookings |
| GET | /bookings/:id | User | Shows one of my bookings |
| POST | /bookings/:id/cancel | User | Cancels before check-in |
| GET | /admin/listings | Admin | Homes waiting for review |
| PATCH | /admin/listings/:id | Admin | Approves or rejects a home |
| GET | /admin/security-logs | Admin | Reads the security log |

## Notes

- Never upload `.env` or the files in `certs/` to GitHub (they are in `.gitignore`).
- The rate limiter keeps its counts in memory, so restarting the server resets them.
- Photo and licence scan uploads, reviews, wishlist, chat and notifications come in the next milestones.
