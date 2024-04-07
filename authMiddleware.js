const jwt = require("jsonwebtoken");
const { User } = require("./models/user");

async function verifyToken(req, res, next) {
  const token = req.body.token;

  if (!token) {
    return res.status(401).json({ error: "Token is missing" });
  }

  try {
    const secret = process.env.secret;
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
    const user = await User.findById(decoded.userId);

    if (!user || !user.isAdmin) {
      return res.status(401).json({ error: "Unauthorized, not admin" });
    }

    if (decoded.isAdmin) {
      req.user = decoded;
      next();
    } else {
      return res.status(401).json({ error: "Unauthorized, not admin" });
    }
  } catch (err) {
    console.error("Error verifying token:", err.message); // More detailed error
    return res
      .status(401)
      .json({ error: "Token is invalid", details: err.message });
  }
}

module.exports = {
  verifyToken,
};
