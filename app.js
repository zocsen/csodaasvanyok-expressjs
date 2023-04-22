const express = require("express");
const app = express();
const morgan = require("morgan");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv/config");
const authJwt = require("./helpers/jwt");
const errorHandler = require("./helpers/error-handler");
const { verifyToken } = require('./authMiddleware');
const cache = require('memory-cache');

function cacheProductsMiddleware(duration) {
  return (req, res, next) => {
    const key = '__products_cache__';
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

app.use(cors({
  origin: [
    "https://www.csodaasvanyok.hu",
    process.env.LOCALHOST
  ],
  optionsSuccessStatus: 200,
  //credentials: true
}))

//middleware
app.use(express.json());
app.use(morgan("tiny"));
app.use(authJwt());
app.use("/public/uploads", express.static(__dirname + "/public/uploads"));
app.use(errorHandler);

//Routes
const categoriesRoutes = require("./routes/categories");
const mineralsRoutes = require("./routes/minerals");
const subcategoriesRoutes = require("./routes/subcategories");
const benefitsRoutes = require("./routes/benefits");
const colorsRoutes = require("./routes/colors");
const productsRoutes = require("./routes/products");
const usersRoutes = require("./routes/users");
const ordersRoutes = require("./routes/orders");

const api = process.env.API_URL;

app.use(`${api}/categories`, categoriesRoutes);
app.use(`${api}/minerals`, mineralsRoutes);
app.use(`${api}/subcategories`, subcategoriesRoutes);
app.use(`${api}/benefits`, benefitsRoutes);
app.use(`${api}/colors`, colorsRoutes);
app.use(`${api}/products`, cacheProductsMiddleware(86400), productsRoutes);
app.use(`${api}/users`, usersRoutes);
app.use(`${api}/orders`, ordersRoutes);

app.post(`${api}/verifyToken`, verifyToken, (req, res) => {
  res.json({ isValid: true });
});

//Database
mongoose
  .connect(process.env.CONNECTION_STRING, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: process.env.DB_NAME,
  })
  .then(() => {
    console.log("Database Connection is ready...");
  })
  .catch((err) => {
    console.log(err);
  });

//Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is listening on port ${PORT}`);
});

