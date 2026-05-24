function sanitize(value) {
  if (!value || typeof value !== "object") return value;

  const blocked = new Set([
    "authorization",
    "token",
    "access_token",
    "refresh_token",
    "password",
    "secret",
    "apiKey",
    "apikey",
  ]);

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      blocked.has(key) ? "[redacted]" : entry,
    ])
  );
}

function info(message, metadata = undefined) {
  if (metadata === undefined) {
    console.log(message);
    return;
  }

  console.log(message, sanitize(metadata));
}

function warn(message, metadata = undefined) {
  if (metadata === undefined) {
    console.warn(message);
    return;
  }

  console.warn(message, sanitize(metadata));
}

function error(message, err = undefined) {
  if (!err) {
    console.error(message);
    return;
  }

  console.error(message, {
    message: err.message,
    code: err.code,
  });
}

module.exports = {
  info,
  warn,
  error,
};
