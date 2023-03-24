const {Mineral} = require('../models/mineral');
const express = require('express');
const router = express.Router();

router.get(`/`, async (req, res) =>{
    const mineralList = await Mineral.find();

    if(!mineralList) {
        res.status(500).json({success: false})
    } 
    res.status(200).send(mineralList);
})

router.get('/:id', async(req,res)=>{
    const mineral = await Mineral.findById(req.params.id);

    if(!mineral) {
        res.status(500).json({message: 'The mineral with the given ID was not found.'})
    } 
    res.status(200).send(mineral);
})



router.post('/', async (req,res)=>{
    let mineral = new Mineral({
        name: req.body.name,
        description: req.body.description,
    })
    mineral = await mineral.save();

    if(!mineral)
    return res.status(400).send('the mineral cannot be created!')

    res.send(mineral);
})


router.put('/:id',async (req, res)=> {
    const mineral = await Mineral.findByIdAndUpdate(
        req.params.id,
        {
            name: req.body.name,
            description: req.body.description,
        },
        { new: true}
    )

    if(!mineral)
    return res.status(400).send('the mineral cannot be created!')

    res.send(mineral);
})

router.delete('/:id', (req, res)=>{
    Mineral.findByIdAndRemove(req.params.id).then(mineral =>{
        if(mineral) {
            return res.status(200).json({success: true, message: 'the mineral is deleted!'})
        } else {
            return res.status(404).json({success: false , message: "mineral not found!"})
        }
    }).catch(err=>{
       return res.status(500).json({success: false, error: err}) 
    })
})

module.exports =router;