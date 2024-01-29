const { Color } = require('../models/color');
const express = require('express');
const router = express.Router();
const { cacheMiddleware, clearAllCache } = require('../cacheMiddleware');
const mongoose = require('mongoose');

router.get(`/`, cacheMiddleware(2000000), async (req, res) => {
    try {
        const colorList = await Color.find();

        if (!colorList) {
            return res.status(200).json([]);
        }
        res.status(200).json(colorList);
    } catch (error) {
        console.error('Error fetching colors: ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.get('/:id', cacheMiddleware(2000000), async (req, res) => {
    const { id } = req.params;

    if (!id || !mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'Invalid or missing ID' });
    }

    try {
        const color = await Color.findById(id);

        if (!color) {
            return res.status(404).json({ message: 'The color with the given ID was not found.' });
        }
        res.status(200).send(color);
    } catch (error) {
        console.error('Error fetching color by ID: ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.post('/', async (req, res) => {
    try {
        if (!req.body.name) {
            return res.status(400).json({ success: false, message: 'Color name is required!' });
        }
        if (!req.body.code) {
            return res.status(400).json({ success: false, message: 'Color code is required!' });
        }
        let color = new Color({
            name: req.body.name,
            code: req.body.code
        });
        color = await color.save();

        clearAllCache();

        res.status(201).json(color);
    } catch (error) {
        console.error('Error creating color: ', error);
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
            return res.status(400).json({ success: false, message: 'Color name is required' });
        }
        if (!req.body.code) {
            return res.status(400).json({ success: false, message: 'Color code is required' });
        }
        const color = await Color.findByIdAndUpdate(
            req.params.id,
            {
                name: req.body.name,
                code: req.body.code
            },
            { new: true }
        );

        if (!color) {
            return res.status(404).json({ success: false, message: 'Color not found' });
        }

        clearAllCache();

        res.status(200).json(color);
    } catch (error) {
        console.error('Error updating color: ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    if (!id || !mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'Invalid or missing ID' });
    }

    try {
        const color = await Color.findByIdAndRemove(id);

        if (!color) {
            return res.status(404).json({ success: false, message: 'Color not found' });
        }

        clearAllCache();
        res.status(200).json({ success: true, message: 'The color is deleted!' });
    } catch (error) {
        console.error('Error fetching benefits: ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

module.exports = router;
