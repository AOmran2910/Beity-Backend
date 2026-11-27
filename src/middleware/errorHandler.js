const { fail } = require('../utils/response');

// Last stop for any error. The user gets a simple message,
// the full details are only printed in the server terminal.
// (Express knows this is an error handler because it has 4 parameters.)
function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return fail(res, 400, 'BAD_JSON', 'The request body is not valid JSON.');
  }
  if (err.type === 'entity.too.large') {
    return fail(res, 413, 'TOO_LARGE', 'The request body is too big.');
  }

  console.error(err);
  return fail(res, 500, 'SERVER_ERROR', 'Something went wrong on our side. Please try again later.');
}

module.exports = errorHandler;
