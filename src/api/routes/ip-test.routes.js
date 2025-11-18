const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const ipInfo = {
    'x-forwarded-for': req.headers['x-forwarded-for'],
    'x-real-ip': req.headers['x-real-ip'],
    'cf-connecting-ip': req.headers['cf-connecting-ip'],
    'true-client-ip': req.headers['true-client-ip'],
    'x-client-ip': req.headers['x-client-ip'],
    'connection.remoteAddress': req.connection?.remoteAddress,
    'socket.remoteAddress': req.socket?.remoteAddress,
    'user-agent': req.headers['user-agent'],
    'detected-ip': getClientIP(req)
  };

  res.json(ipInfo);
});

function getClientIP(req) {
  let ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.headers["cf-connecting-ip"] ||
    req.headers["true-client-ip"] ||
    req.headers["x-client-ip"] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    "Unknown";

  if (ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }
  
  if (ip === "::1" || ip === "127.0.0.1" || ip === "localhost") {
    ip = "127.0.0.1";
  }

  if (ip.includes(":") && !ip.includes("::")) {
    ip = ip.split(":")[0];
  }

  return ip;
}

module.exports = router;

