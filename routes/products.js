const express = require('express');
const { Product } = require('../models/product');
const { Category } = require('../models/category');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const AWS = require('aws-sdk');
const ObjectId = require('mongodb').ObjectId;
const sharp = require('sharp');

// Create an instance of the AWS S3 object with the access key ID and secret access key
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

// Use multer memory storage to upload files to memory instead of the local file system
const storage = multer.memoryStorage();
const uploadOptions = multer({ storage: storage });


router.get(`/`, async (req, res) => {
    let filter = {};
    if (req.query.categories) {
        filter = { category: req.query.categories.split(',') };
    }
    if (req.query.minerals) {
        filter = { mineral: req.query.minerals.split(',') };
    }
    if (req.query.subcategories) {
        filter = { subcategory: req.query.subcategories.split(',') };
    }
    if (req.query.colors) {
        filter = { color: req.query.colors.split(',') };
    }


    //
    const productList = await Product.find(filter).populate('category').populate('mineral').populate('subcategory').populate('color');

    if (!productList) {
        res.status(500).json({ success: false });
    }

    // Replace the image URL with S3 URL
    if (productList.image && productList.image.startsWith('https://')) {
        productList.image = s3.getSignedUrl('getObject', {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: productList.image.split(process.env.AWS_BUCKET_NAME + '/')[1]
        });
    }

    res.send(productList);
});

router.get(`/:id`, async (req, res) => {
    const product = await Product.findById(req.params.id).populate('category').populate('mineral').populate('subcategory').populate('color');

    if (!product) {
        res.status(500).json({ success: false });
    }

    res.send(product);
});

router.post(`/`, uploadOptions.single('image'), async (req, res) => {
    // Retrieve the category from the database using its ID
    const category = await Category.findById(req.body.category);
    if (!category) {
        return res.status(400).send('Invalid Category');
    }
    // TODO DO the above for mineral and subcategory without breaking the program due ID Array!!
    
    // Retrieve the uploaded file from the request
    const file = req.file;
    if (!file) {
        return res.status(400).send('No image in the request');
    }

    // Create a unique filename for the image to be stored in S3
    const fileName = file.originalname;

    const resizedImageBuffer = await sharp(file.buffer)
        .resize({ width: 800, height: 800, fit: 'inside' })
        .withMetadata()
        .toBuffer();

    // Set up the S3 upload parameters
    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: `${fileName}`,
        Body: resizedImageBuffer
    };

    // Upload the file to S3
    s3.upload(params, async (err, data) => {
        if (err) {
            return res.status(500).send('The product image could not be uploaded to AWS S3');
        }

        // Construct the base URL for the product image
        const basePath = `https://${process.env.AWS_BUCKET_NAME}.s3.amazonaws.com/`;

        // Create a new product object with the uploaded image URL

        const mineralString = req.body.mineral;
        const mineralArray = mineralString.split(",").map(id => new ObjectId(id));
        const subcategoryString = req.body.subcategory;
        const subcategoryArray = subcategoryString.split(",").map(id => new ObjectId(id));
        const colorString = req.body.color;
        const colorArray = colorString.split(",").map(id => new ObjectId(id));
        
        let product = new Product({
            name: req.body.name,
            description: req.body.description,
            image: `${basePath}${fileName}`,
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
            return res.status(500).send('The product cannot be created');
        }

        // Send the product object as the response to the client
        res.send(product);
    });
});

router.put('/:id', uploadOptions.single('image'), async (req, res) => {
    console.log("itt még jó 2");
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).send('Invalid Product Id');
    }
    const category = await Category.findById(req.body.category);
    if (!category) return res.status(400).send('Invalid Category');
    // TODO DO the above for mineral and subcategory without breaking the program due ID Array!!

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(400).send('Invalid Product!');

    const file = req.file;
    
    let imagepath;

    if (file) {
        const resizedImageBuffer = await sharp(file.buffer)
        .resize({ width: 800, height: 800, fit: 'inside' })
        .withMetadata()
        .toBuffer()

        const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: `${Date.now()}_${file.originalname}`,
            Body: resizedImageBuffer,
        };
        const data = await s3.upload(params).promise();
        imagepath = data.Location;
    } else {
        imagepath = product.image;
    }

    const mineralString = req.body.mineral
    const mineralArray = mineralString.split(",").map(id => new ObjectId(id));
    const subcategoryString = req.body.subcategory;
    const subcategoryArray = subcategoryString.split(",").map(id => new ObjectId(id));
    const colorString = req.body.color;
    const colorArray = colorString.split(",").map(id => new ObjectId(id));

    const updatedProduct = await Product.findByIdAndUpdate(
        req.params.id,
        {
            name: req.body.name,
            description: req.body.description,
            image: imagepath,
            price: req.body.price,
            category: req.body.category,
            mineral: mineralArray,
            subcategory: subcategoryArray,
            color: colorArray,
            //isFeatured: req.body.isFeatured
        },
        { new: true }
    );

    if (!updatedProduct) return res.status(500).send('the product cannot be updated!');

    res.send(updatedProduct);
});

router.delete('/:id', (req, res) => {
    Product.findByIdAndRemove(req.params.id)
        .then((product) => {
            if (product) {
                return res.status(200).json({
                    success: true,
                    message: 'the product is deleted!'
                });
            } else {
                return res.status(404).json({ success: false, message: 'product not found!' });
            }
        })
        .catch((err) => {
            return res.status(500).json({ success: false, error: err });
        });
});

router.get(`/get/count`, async (req, res) => {
    const productCount = await Product.countDocuments((count) => count);

    if (!productCount) {
        res.status(500).json({ success: false });
    }
    res.send({
        productCount: productCount
    });
});

router.get(`/get/featured/:count`, async (req, res) => {
    const count = req.params.count ? req.params.count : 0;
    //const products = await Product.find({ isFeatured: true }).limit(+count);

    if (!products) {
        res.status(500).json({ success: false });
    }
    res.send(products);
});

module.exports = router;
