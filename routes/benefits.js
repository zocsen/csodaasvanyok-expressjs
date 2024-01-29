const { Benefit } = require('../models/benefit');
const express = require('express');
const router = express.Router();
const { cacheMiddleware, clearAllCache } = require('../cacheMiddleware');

router.get(`/`, cacheMiddleware(2000000), async (req, res) => {
    try {
        const benefitList = await Benefit.find().collation({ locale: 'hu' }).sort({ name: 1 });

        if (!benefitList || benefitList.length === 0) {
            return res.status(200).json([]);
        }
        res.status(200).json({
            success: true,
            message: 'Benefits fetched successfully',
            data: benefitList
        });
    } catch (error) {
        console.error('Error fetching benefits: ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.get('/:id', cacheMiddleware(2000000), async (req, res) => {
    const { id } = req.params;

    if (!id || !isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'Invalid or missing ID' });
    }

    try {
        const benefit = await Benefit.findById(id);

        if (!benefit) {
            return res.status(404).json({
                success: false,
                message: 'The benefit with the given ID was not found.'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Benefit fetched by ID successfully',
            data: benefit
        });
    } catch (error) {
        console.error('Error fetching benefit by ID: ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.post('/', async (req, res) => {
    try {
        if (!req.body.name) {
            return res.status(400).json({ success: false, message: 'Benefit name is required!' });
        }

        let benefit = new Benefit({
            name: req.body.name
        });
        benefit = await benefit.save();

        clearAllCache();

        res.status(201).json({
            success: true,
            message: 'Benefit created successfully',
            data: benefit
        });
    } catch (error) {
        console.error('Error posting benefit: ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;

    if (!id || !isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'Invalid or missing ID' });
    }

    try {
        if (!req.body.name) {
            return res.status(400).json({ success: false, message: 'Benefit name is required' });
        }

        const benefit = await Benefit.findByIdAndUpdate(id, { name: req.body.name }, { new: true });

        if (!benefit) {
            return res.status(404).json({ success: false, message: 'Benefit not found' });
        }

        clearAllCache();

        res.status(200).json({
            success: true,
            message: 'Benefit updated successfully',
            data: benefit
        });
    } catch (error) {
        console.error('Error updating benefit: ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    if (!id || !isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'Invalid or missing ID' });
    }

    try {
        const benefit = await Benefit.findByIdAndRemove(id);

        if (!benefit) {
            return res.status(404).json({ success: false, message: 'Benefit not found!' });
        }

        clearAllCache();
        res.status(200).json({ success: true, message: 'The benefit is deleted!' });
    } catch (error) {
        console.error('Error deleting benefit: ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

module.exports = router;
