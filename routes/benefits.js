const {Benefit} = require('../models/benefit');
const express = require('express');
const router = express.Router();

router.get(`/`, cacheMiddleware(86400), async (req, res) =>{
    const benefitList = await Benefit.find();

    if(!benefitList) {
        res.status(500).json({success: false})
    } 
    res.status(200).send(benefitList);
})

router.get('/:id', cacheMiddleware(86400), async(req,res)=>{
    const benefit = await Benefit.findById(req.params.id);

    if(!benefit) {
        res.status(500).json({message: 'The benefit with the given ID was not found.'})
    } 
    res.status(200).send(benefit);
})



router.post('/', async (req,res)=>{
    let benefit = new Benefit({
        name: req.body.name,
    })
    benefit = await benefit.save();

    if(!benefit)
    return res.status(400).send('the benefit cannot be created!')

    res.send(benefit);
})


router.put('/:id',async (req, res)=> {
    const benefit = await Benefit.findByIdAndUpdate(
        req.params.id,
        {
            name: req.body.name,
        },
        { new: true}
    )

    if(!benefit)
    return res.status(400).send('the benefit cannot be created!')

    res.send(benefit);
})

router.delete('/:id', (req, res)=>{
    Benefit.findByIdAndRemove(req.params.id).then(benefit =>{
        if(benefit) {
            return res.status(200).json({success: true, message: 'the benefit is deleted!'})
        } else {
            return res.status(404).json({success: false , message: "benefit not found!"})
        }
    }).catch(err=>{
       return res.status(500).json({success: false, error: err}) 
    })
})

module.exports =router;