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
        res.status(200).send(benefitList);
    } catch (error) {
        console.error('Error fetching benefits: ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.get('/:id', cacheMiddleware(2000000), async (req, res) => {
    try {
        const benefit = await Benefit.findById(req.params.id);

        if (!benefit) {
            return res.status(404).json({
                success: false,
                message: 'The benefit with the given ID was not found.'
            });
        }
        res.status(200).send(benefit);
    } catch (error) {
        console.error('Error fetching benefit by Id: ', error);
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

        res.status.send(201).send(benefit);
    } catch (error) {
        console.error('Error posting benefit: ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        if (!req.body.name) {
            return res.status(400).json({ success: false, message: 'Benefit name is required' });
        }

        const benefit = await Benefit.findByIdAndUpdate(
            req.params.id,
            { name: req.body.name },
            { new: true }
        );

        if (!benefit) {
            return res.status(404).json({ success: false, message: 'Benefit not found' });
        }

        clearAllCache();

        res.send(benefit);
    } catch (error) {
        console.error('Error updating benefit: ', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const benefit = await Benefit.findByIdAndRemove(req.params.id);

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
