const { Subcategory } = require('../models/subcategory');
const express = require('express');
const router = express.Router();
const { cacheMiddleware, clearAllCache } = require('../cacheMiddleware');
const mongoose = require('mongoose');

router.get(`/`, cacheMiddleware(2000000), async (req, res) => {
    try {
        const subcategoryList = await Subcategory.find();
        if (!subcategoryList) {
            return res.status(200).json([]);
        }
        res.status(200).send(subcategoryList);
    } catch (error) {
        console.error('Error fetching subcategories ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.get('/:id', cacheMiddleware(2000000), async (req, res) => {
    const { id } = req.params;

    if (!id || !mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'Invalid or missing ID' });
    }

    try {
        const subcategory = await Subcategory.findById(id);

        if (!subcategory) {
            return res.status(404).json({
                success: false,
                message: 'The subcategory with the given ID was not found.'
            });
        }
        res.status(200).send(subcategory);
    } catch (error) {
        console.error('Error fetching subcategory by ID: ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.post('/', async (req, res) => {
    try {
        if (!req.body.name) {
            return res.status(400).json({ success: false, message: 'The name is required!' });
        }
        let subcategory = new Subcategory({
            name: req.body.name,
            description: req.body.description
        });
        subcategory = await subcategory.save();

        clearAllCache();

        res.status(200).json(subcategory);
    } catch (error) {
        console.error('Error creating subcategory ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;

    if (!id || !mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'Invalid or missing ID' });
    }

    try {
        if (!req.body.name) {
            return res.status(400).json({ success: false, message: 'The name is required!' });
        }
        const subcategory = await Subcategory.findByIdAndUpdate(
            req.params.id,
            {
                name: req.body.name,
                description: req.body.description
            },
            { new: true }
        );

        if (!subcategory) {
            return res.status(404).json({ success: false, message: 'Subcategory not found' });
        }

        clearAllCache();

        res.status(200).json(subcategory);
    } catch (error) {
        console.error('Error updating subcategory', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.delete('/:id', (req, res) => {
    const { id } = req.params;

    if (!id || !mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'Invalid or missing ID' });
    }
    try {
        const subcategory = Subcategory.findByIdAndRemove(id);

        if (!subcategory) {
            return res.status(404).json({ success: false, message: 'Subcategory not found!' });
        }

        clearAllCache();
        res.status(200).json({ success: true, message: 'The subcategory is deleted!' });
    } catch (error) {
        console.error('Error deleting subcategory ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

module.exports = router;
