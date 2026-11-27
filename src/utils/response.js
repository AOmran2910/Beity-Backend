// Every answer from the API has the same shape (see Milestone 3):
//   { success: true, data: ... }
//   { success: false, error: { code, message } }

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data: data });
}

function fail(res, status, code, message, details) {
  const error = { code: code, message: message };
  if (details) {
    error.details = details;
  }
  return res.status(status).json({ success: false, error: error });
}

module.exports = { ok, fail };
