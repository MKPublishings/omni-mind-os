function createLogger(scope = "omni-image-engine") {
  function entry(level, message, payload) {
    const item = {
      scope,
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(payload ? { payload } : {})
    };
    const output = JSON.stringify(item);
    if (level === "error") {
      console.error(output);
    } else {
      console.log(output);
    }
  }

  return {
    info(message, payload) {
      entry("info", message, payload);
    },
    warn(message, payload) {
      entry("warn", message, payload);
    },
    error(message, payload) {
      entry("error", message, payload);
    }
  };
}

module.exports = {
  createLogger
};
