const { Mineral } = require('../models/mineral');
const { Benefit } = require('../models/benefit');
const express = require('express');
const router = express.Router();
const ObjectId = require('mongodb').ObjectId;
const { cacheMiddleware, clearAllCache } = require('../cacheMiddleware');

router.get(`/`, cacheMiddleware(2000000), async (req, res) => {
    let filter = {};
    if (req.query.benefits) {
        filter = { benefit: req.query.benefits.split(',') };
    }

    const mineralList = await Mineral.find(filter).populate('benefit').sort({ name: 1 });

    if (!mineralList) {
        res.status(500).json({ success: false });
    }
    res.status(200).send(mineralList);
});

router.get('/:id', cacheMiddleware(2000000), async (req, res) => {
    const mineral = await Mineral.findById(req.params.id).populate('benefit');

    if (!mineral) {
        res.status(500).json({ message: 'The mineral with the given ID was not found.' });
    }
    res.status(200).send(mineral);
});

router.post('/', async (req, res) => {
    const benefitString = req.body.benefit;
    const benefitArray = benefitString.split(',').map((id) => new ObjectId(id));

    let mineral = new Mineral({
        name: req.body.name,
        description: req.body.description,
        benefit: benefitArray
    });
    mineral = await mineral.save();

    if (!mineral) return res.status(400).send('the mineral cannot be created!');

    clearAllCache();

    res.send(mineral);
});

router.put('/:id', async (req, res) => {
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

    if (!mineral) return res.status(400).send('the mineral cannot be created!');

    clearAllCache();

    res.send(mineral);
});

router.delete('/:id', (req, res) => {
    Mineral.findByIdAndRemove(req.params.id)
        .then((mineral) => {
            if (mineral) {
                clearAllCache();
                return res.status(200).json({ success: true, message: 'the mineral is deleted!' });
            } else {
                return res.status(404).json({ success: false, message: 'mineral not found!' });
            }
        })
        .catch((err) => {
            return res.status(500).json({ success: false, error: err });
        });
});

module.exports = router;
