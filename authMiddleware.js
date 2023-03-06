const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const token = req.body.token;

  if (!token) {
    return res.status(401).json({ error: 'Token is missing' });
  }

  try {
    const decoded = jwt.verify(token, process.env.secret);
    if (decoded.isAdmin) {
      // Token is valid and user is an admin
      req.user = decoded;
      next();
    } else {
      // User is not an admin
      return res.status(401).json({ error: 'Unauthorized' });
    }
  } catch (err) {
    return res.status(401).json({ error: 'Token is invalid' });
  }
}

module.exports = {
  verifyToken
};
