const { Mineral } = require('../models/mineral');
const { Benefit } = require('../models/benefit');
const express = require('express');
const router = express.Router();
const ObjectId = require('mongodb').ObjectId;
const { cacheMiddleware, clearAllCache } = require('../cacheMiddleware');
const mongoose = require('mongoose');

router.get(`/`, cacheMiddleware(2000000), async (req, res) => {
    try {
        let filter = {};
        if (req.query.benefits) {
            filter = { benefit: req.query.benefits.split(',') };
        }

        const mineralList = await Mineral.find(filter)
            .populate('benefit')
            .collation({ locale: 'hu' })
            .sort({ name: 1 });

        if (!mineralList) {
            return res.status(500).json([]);
        }
        res.status(200).json(mineralList);
    } catch (error) {
        console.error('Error fetching minerals: ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.get('/:id', cacheMiddleware(2000000), async (req, res) => {
    const { id } = req.params;

    if (!id || !mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'Invalid or missing ID' });
    }
    try {
        const mineral = await Mineral.findById(id).populate('benefit');

        if (!mineral) {
            res.status(404).json({ message: 'The mineral with the given ID was not found.' });
        }
        res.status(200).json(mineral);
    } catch (error) {
        console.error('Error getting mineral: ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.post('/', async (req, res) => {
    try {
        if (!req.body.name) {
            return res.status(400).json({ success: false, message: 'Mineral name is required' });
        }

        const benefitString = req.body.benefit;
        const benefitArray = benefitString.split(',').map((id) => new ObjectId(id));

        let mineral = new Mineral({
            name: req.body.name,
            description: req.body.description,
            benefit: benefitArray
        });
        mineral = await mineral.save();

        clearAllCache();

        res.status(201).json(mineral);
    } catch (error) {
        console.error('Error creating mineral: ', error);
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
            return res.status(400).json({ success: false, message: 'Mineral name is required' });
        }
        const benefitString = req.body.benefit;

        if (typeof benefitString !== 'string') {
            return res.status(400).json({ message: 'The benefit field must be a string.' });
        }
        const benefitArray = benefitString.split(',').map((id) => new ObjectId(id));
        const mineral = await Mineral.findByIdAndUpdate(
            req.params.id,
            {
                name: req.body.name,
                description: req.body.description,
                benefit: benefitArray
            },
            { new: true }
        );

        if (!mineral) return res.status(404).send('Mineral not found!');

        clearAllCache();

        res.send(mineral);
    } catch (error) {
        console.error('Error updating mineral: ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    if (!id || !mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'Invalid or missing ID' });
    }
    try {
        const mineral = await Mineral.findByIdAndRemove(id);
        if (!mineral) {
            return res.status(404).json({ success: false, message: 'Mineral not found!' });
        }
        clearAllCache();
        res.status(200).json({ success: true, message: 'The mineral is deleted!' });
    } catch (error) {
        console.error('Error deleting mineral: ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

module.exports = router;
