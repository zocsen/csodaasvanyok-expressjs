const express = require("express");
const { Product } = require("../models/product");
const { Category } = require("../models/category");
const { Subcategory } = require("../models/subcategory");
const router = express.Router();
const path = require("path");
const mongoose = require("mongoose");
const multer = require("multer");
const AWS = require("aws-sdk");
const ObjectId = require("mongodb").ObjectId;
const sharp = require("sharp");
const { cacheMiddleware, clearAllCache } = require("../cacheMiddleware");

// Create an instance of the AWS S3 object with the access key ID and secret access key
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const uploadToS3 = async (params) => {
  const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
  const client = new S3Client({ region: process.env.AWS_REGION });
  const command = new PutObjectCommand(params);
  await client.send(command);
};

// Use multer memory storage to upload files to memory instead of the local file system
const storage = multer.memoryStorage();
const uploadOptions = multer({ storage: storage });

router.get(`/`, cacheMiddleware(2000000), async (req, res) => {
  try {
    let filter = {};

    if (req.query.category && req.query.category !== "") {
      const categoryName = req.query.category;
      const foundCategory = await Category.find({
        name: { $in: categoryName },
      }).exec();

      if (foundCategory.length) {
        filter.category = { $in: foundCategory };
      }
    }

    if (req.query.minerals && req.query.minerals !== "") {
      filter.mineral = { $in: req.query.minerals.split(",") };
    }
    if (req.query.subcategories && req.query.subcategories !== "") {
      const subcategoryNames = req.query.subcategories.split(",");
      const subcategories = await Subcategory.find({
        name: { $in: subcategoryNames },
      });

      if (subcategories.length) {
        filter.subcategory = { $in: subcategories.map((sc) => sc._id) };
      } else {
        return res.status(404).send("Subcategory not found");
      }
    }
    if (req.query.colors && req.query.colors !== "") {
      filter.color = { $in: req.query.colors.split(",") };
    }

    //
    const productList = await Product.find(filter)
      .populate("category")
      .populate({
        path: "mineral",
        populate: {
          path: "benefit",
          model: "Benefit",
        },
      })
      .populate("subcategory")
      .populate("color");

    if (!productList || productList.length === 0) {
      return res.status(200).json([]);
    }

    // Replace the image URL with S3 URL
    if (productList.image && productList.image.startsWith("https://")) {
      productList.image = s3.getSignedUrl("getObject", {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: productList.image.split(process.env.AWS_BUCKET_NAME + "/")[1],
      });
    }

    res.status(200).json(productList);
  } catch (error) {
    console.error("Error fetching products: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.get(`/:id`, cacheMiddleware(2000000), async (req, res) => {
  const { id } = req.params;

  if (!id || !mongoose.isValidObjectId(id)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid or missing ID" });
  }

  try {
    const product = await Product.findById(id)
      .populate("category")
      .populate({
        path: "mineral",
        populate: {
          path: "benefit",
          model: "Benefit",
        },
      })
      .populate("subcategory")
      .populate("color");

    if (!product) {
      res.status(404).json({
        success: false,
        message: "The product with the given ID was not found.",
      });
    }

    res.status(200).json(product);
  } catch (error) {
    console.error("Error fetching product: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.post(`/`, uploadOptions.single("image"), async (req, res) => {
  try {
    // Retrieve the category from the database using its ID
    const category = await Category.findById(req.body.category);
    if (!category) {
      return res.status(400).send("Invalid Category");
    }
    // TODO DO the above for mineral and subcategory without breaking the program due ID Array!!

    // Retrieve the uploaded file from the request
    const file = req.file;
    if (!file) {
      return res.status(400).send("No image in the request");
    }

    // Create a unique filename for the image to be stored in S3
    const fileName = `${path.parse(file.originalname).name}.webp`;

    const resizedMainImageBuffer = await sharp(file.buffer)
      .resize({ width: 800, height: 800, fit: "inside" })
      .withMetadata()
      .webp()
      .rotate()
      .sharpen({ sigma: 1 })
      .toBuffer();

    const resizedSmallImageBuffer = await sharp(file.buffer)
      .resize({ width: 360, height: 360, fit: "inside" })
      .withMetadata()
      .webp()
      .rotate()
      .sharpen({ sigma: 1 })
      .toBuffer();

    // Set up the S3 upload parameters
    const mainParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: `${fileName}`,
      Body: resizedMainImageBuffer,
      ContentType: "image/webp",
    };

    const smallParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: `${fileName}`,
      Body: resizedSmallImageBuffer,
      ContentType: "image/webp",
    };

    await uploadToS3(mainParams);
    await uploadToS3(smallParams);

    // Construct the base URL for the product image
    const basePath = `https://${process.env.AWS_BUCKET_NAME}.s3.amazonaws.com/`;

    // Create a new product object with the uploaded image URL

    const mineralString = req.body.mineral;
    const mineralArray = mineralString.split(",").map((id) => new ObjectId(id));
    const subcategoryString = req.body.subcategory;
    const subcategoryArray = subcategoryString
      .split(",")
      .map((id) => new ObjectId(id));
    const colorString = req.body.color;
    const colorArray = colorString.split(",").map((id) => new ObjectId(id));

    let mainImageUrl = `${basePath}main/${fileName}`;
    mainImageUrl = encodeURI(mainImageUrl);

    let smallImageUrl = `${basePath}small/${fileName}`;
    smallImageUrl = encodeURI(smallImageUrl);

    let product = new Product({
      name: req.body.name,
      description: req.body.description,
      mainImage: mainImageUrl,
      smallImage: smallImageUrl,
      price: req.body.price,
      category: req.body.category,
      mineral: mineralArray,
      subcategory: subcategoryArray,
      color: colorArray,
      //isFeatured: req.body.isFeatured
    });

    // Save the product to the database
    product = await product.save();

    if (!product) {
      return res.status(500).send("The product cannot be created");
    }

    clearAllCache();

    // Send the product object as the response to the client
    res.status(200).json(product);
  } catch (error) {
    console.error("Error uploading product: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.put("/:id", uploadOptions.single("image"), async (req, res) => {
  const { id } = req.params;

  if (!id || !mongoose.isValidObjectId(id)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid or missing ID" });
  }
  try {
    const category = await Category.findById(req.body.category);
    if (!category) return res.status(400).send("Invalid Category");
    // TODO DO the above for mineral and subcategory without breaking the program due ID Array!!

    const product = await Product.findById(id);
    if (!product) return res.status(400).send("Invalid Product!");

    const file = req.file;

    let imagePath = product.image;

    if (file) {
      if (product.image) {
        const url = new URL(product.image);
        const key = decodeURIComponent(url.pathname.substring(1));
        const deleteParams = {
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: key,
        };
        try {
          await s3.deleteObject(deleteParams).promise();
        } catch (err) {
          return res.status(500).send("Error deleting old image");
        }
      }

      const newFileName = `${path.parse(file.originalname).name}.webp`;

      const resizedImageBuffer = await sharp(file.buffer)
        .resize({ width: 800, height: 800, fit: "inside" })
        .withMetadata()
        .webp()
        .rotate()
        .sharpen({ sigma: 1 })
        .toBuffer();

      const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: newFileName,
        Body: resizedImageBuffer,
        ContentType: "image/webp",
      };

      try {
        await s3.upload(params).promise();

        // Construct the base URL for the product image
        const basePath = `https://${process.env.AWS_BUCKET_NAME}.s3.amazonaws.com/`;
        imagePath = encodeURI(`${basePath}${newFileName}`);
      } catch (err) {
        return res.status(500).send("Error uploading new image");
      }
    }

    const mineralString = req.body.mineral;
    const mineralArray = mineralString.split(",").map((id) => new ObjectId(id));
    const subcategoryString = req.body.subcategory;
    const subcategoryArray = subcategoryString
      .split(",")
      .map((id) => new ObjectId(id));
    const colorString = req.body.color;
    const colorArray = colorString.split(",").map((id) => new ObjectId(id));

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      {
        name: req.body.name,
        description: req.body.description,
        image: imagePath,
        price: req.body.price,
        category: req.body.category,
        mineral: mineralArray,
        subcategory: subcategoryArray,
        color: colorArray,
        //isFeatured: req.body.isFeatured
      },
      { new: true }
    );

    if (!updatedProduct)
      return res.status(500).send("the product cannot be updated!");

    clearAllCache();

    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error("Error updating product: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  if (!id || !mongoose.isValidObjectId(id)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid or missing ID" });
  }

  try {
    const product = await Product.findByIdAndDelete(id);

    if (product) {
      const url = new URL(product.image);
      const key = decodeURIComponent(url.pathname.substring(1));
      const deleteParams = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
      };

      if (product.image) {
        try {
          await s3.deleteObject(deleteParams).promise();
        } catch (err) {
          return res.status(500).send("Error deleting image");
        }
      }

      clearAllCache();

      return res.status(200).json({
        success: true,
        message: "The product is successfully deleted!",
      });
    } else {
      return res
        .status(404)
        .json({ success: false, message: "product not found!" });
    }
  } catch (error) {
    console.error("Error deleting product: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.get(`/get/count`, async (req, res) => {
  try {
    const productCount = await Product.countDocuments();

    res.status(200).json({
      productCount: productCount,
    });
  } catch (error) {
    console.error("Error getting the count of all products: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// router.get(`/get/featured/:count`, async (req, res) => {
//   const count = req.params.count ? req.params.count : 0;
//   const products = await Product.find({ isFeatured: true }).limit(+count);

//   if (!products) {
//     res.status(500).json({ success: false });
//   }
//   res.status(200).json(products);
// });

module.exports = router;
