const cache = require('memory-cache');

function cacheMiddleware(duration) {
  return (req, res, next) => {
    const key = '__cache__' + req.originalUrl || req.url;
    const cachedResponse = cache.get(key);

    if (cachedResponse) {
      res.send(cachedResponse);
      return;
    }

    res.sendResponse = res.send;
    res.send = (body) => {
      cache.put(key, body, duration * 1000);
      res.sendResponse(body);
    };

    next();
  };
}

function clearProductsCache() {
  cache.keys().forEach((key) => {
    if (key.startsWith('__cache__' + api + '/products')) {
      cache.del(key);
    }
  });
}

module.exports = {
	cacheMiddleware,
	clearProductsCache
};