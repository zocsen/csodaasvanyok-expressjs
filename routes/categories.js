const { Category } = require('../models/category');
const express = require('express');
const router = express.Router();
const { cacheMiddleware, clearAllCache } = require('../cacheMiddleware');

router.get(`/`, cacheMiddleware(2000000), async (req, res) => {
    try {
        const categoryList = await Category.find();

        if (!categoryList || categoryList.length === 0) {
            res.status(200).json([]);
        }
        res.status(200).json({
            success: true,
            message: 'Categories fetched successfully',
            data: categoryList
        });
    } catch (error) {
        console.error('Error fetching categories: ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.get('/:id', cacheMiddleware(2000000), async (req, res) => {
    const { id } = req.params;

    if (!id || !isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'Invalid or missing ID' });
    }

    try {
        const category = await Category.findById(id);

        if (!category) {
            res.status(404).json({
                success: false,
                message: 'The category with the given ID was not found.'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Category fetched by ID successfully',
            data: category
        });
    } catch (error) {
        console.error('Error fetching category by Id: ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.post('/', async (req, res) => {
    try {
        if (!req.res.name) {
            return res.status(400).json({ success: false, message: 'Category name is required!' });
        }

        let category = new Category({
            name: req.body.name,
            icon: req.body.icon,
            color: req.body.color
        });
        category = await category.save();

        clearAllCache();

        res.status(201).json({
            success: true,
            message: 'Category created successfully',
            data: category
        });
    } catch (error) {}
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;

    if (!id || !isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'Invalid or missing ID' });
    }

    try {
        if (!req.res.name) {
            return res.status(400).json({ success: false, message: 'Category name is required!' });
        }

        const category = await Category.findByIdAndUpdate(
            id,
            {
                name: req.body.name,
                icon: req.body.icon || category.icon,
                color: req.body.color
            },
            { new: true }
        );

        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        clearAllCache();

        res.status(200).json({
            success: true,
            message: 'Category updated successfully',
            data: category
        });
    } catch (error) {}
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    if (!id || !isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'Invalid or missing ID' });
    }

    try {
        const category = await Category.findByIdAndRemove(id);

        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found!' });
        }

        clearAllCache();
        res.status(200).json({ success: true, message: 'The category is deleted' });
    } catch (error) {
        console.error('Error deleting category: ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

module.exports = router;
