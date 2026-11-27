require('dotenv').config();

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const app = require('./app');
const sessionModel = require('./models/sessionModel');
const bookingModel = require('./models/bookingModel');

const HTTPS_PORT = Number(process.env.HTTPS_PORT) || 3443;
const HTTP_PORT = Number(process.env.HTTP_PORT) || 3000;

const keyFile = path.join(__dirname, '..', 'certs', 'key.pem');
const certFile = path.join(__dirname, '..', 'certs', 'cert.pem');

if (fs.existsSync(keyFile) && fs.existsSync(certFile)) {
  // HTTPS server: everything between the browser and the server is encrypted (TLS)
  const options = { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) };
  https.createServer(options, app).listen(HTTPS_PORT, () => {
    console.log(`Beity API running on https://localhost:${HTTPS_PORT}/api/v1`);
  });

  // plain HTTP only sends the user to the HTTPS address
  http
    .createServer((req, res) => {
      const host = (req.headers.host || 'localhost').split(':')[0];
      res.writeHead(301, { Location: `https://${host}:${HTTPS_PORT}${req.url}` });
      res.end();
    })
    .listen(HTTP_PORT, () => {
      console.log(`HTTP on port ${HTTP_PORT} redirects to HTTPS`);
    });
} else {
  // On cloud hosts like Render the host gives us HTTPS, so the app itself runs plain HTTP.
  // Locally, make a certificate first (see README) so cookies and HTTPS work like in real life.
  const port = Number(process.env.PORT) || HTTP_PORT;
  console.log('No certificate found in /certs, starting without HTTPS (only use this behind a cloud host).');
  app.listen(port, () => {
    console.log(`Beity API running on http://localhost:${port}/api/v1`);
  });
}

// Clean-up job every 10 minutes:
// - booking requests the host did not answer in 24 hours become "expired" and their nights are freed
// - old sessions are deleted
async function cleanUp() {
  try {
    const expired = await bookingModel.expireOldBookings();
    const removed = await sessionModel.deleteOldSessions();
    if (expired > 0 || removed > 0) {
      console.log(`Clean-up: ${expired} booking(s) expired, ${removed} old session(s) removed`);
    }
  } catch (err) {
    console.error('Clean-up failed:', err.message);
  }
}

setInterval(cleanUp, 10 * 60 * 1000);
cleanUp();
