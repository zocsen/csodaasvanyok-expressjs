const {Color} = require('../models/color');
const express = require('express');
const router = express.Router();
const { cacheMiddleware, clearAllCache } = require('../cacheMiddleware');

router.get(`/`, cacheMiddleware(86400), async (req, res) =>{
    const colorList = await Color.find();

    if(!colorList) {
        res.status(500).json({success: false})
    } 
    res.status(200).send(colorList);
})

router.get('/:id', cacheMiddleware(86400), async(req,res)=>{
    const color = await Color.findById(req.params.id);

    if(!color) {
        res.status(500).json({message: 'The color with the given ID was not found.'})
    } 
    res.status(200).send(color);
})



router.post('/', async (req,res)=>{
    let color = new Color({
        name: req.body.name,
        code: req.body.code,
    })
    color = await color.save();

    if(!color)
    return res.status(400).send('the color cannot be created!')

    clearAllCache()
    
    res.send(color);
})


router.put('/:id',async (req, res)=> {
    const color = await Color.findByIdAndUpdate(
        req.params.id,
        {
            name: req.body.name,
            code: req.body.code,
        },
        { new: true}
    )

    if(!color)
    return res.status(400).send('the color cannot be created!')

    clearAllCache()

    res.send(color);
})

router.delete('/:id', (req, res)=>{
    Color.findByIdAndRemove(req.params.id).then(color =>{
        if (color) {
            clearAllCache()
            return res.status(200).json({success: true, message: 'the color is deleted!'})
        } else {
            return res.status(404).json({success: false , message: "color not found!"})
        }
    }).catch(err=>{
       return res.status(500).json({success: false, error: err}) 
    })
})

module.exports =router;