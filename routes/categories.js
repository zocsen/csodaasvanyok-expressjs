const { Category } = require("../models/category");
const express = require("express");
const router = express.Router();
const { cacheMiddleware, clearAllCache } = require("../cacheMiddleware");
const mongoose = require("mongoose");

router.get(`/`, cacheMiddleware(2000000), async (req, res) => {
  try {
    const categoryList = await Category.find();

    if (!categoryList || categoryList.length === 0) {
      return res.status(200).json([]);
    }
    res.status(200).json(categoryList);
  } catch (error) {
    console.error("Error fetching categories: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.get("/:id", cacheMiddleware(2000000), async (req, res) => {
  const { id } = req.params;

  if (!id || !mongoose.isValidObjectId(id)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid or missing ID" });
  }

  try {
    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "The category with the given ID was not found.",
      });
    }
    res.status(200).json(category);
  } catch (error) {
    console.error("Error fetching category by Id: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.post("/", async (req, res) => {
  try {
    if (!req.body.name) {
      return res
        .status(400)
        .json({ success: false, message: "Category name is required!" });
    }

    let category = new Category({
      name: req.body.name,
      icon: req.body.icon,
      color: req.body.color,
    });
    category = await category.save();

    clearAllCache();

    res.status(201).json(category);
  } catch (error) {
    console.error("Error creating category: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;

  if (!id || !mongoose.isValidObjectId(id)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid or missing ID" });
  }

  try {
    if (!req.body.name) {
      return res
        .status(400)
        .json({ success: false, message: "Category name is required!" });
    }

    const category = await Category.findByIdAndUpdate(
      id,
      {
        name: req.body.name,
        icon: req.body.icon || category.icon,
        color: req.body.color,
      },
      { new: true }
    );

    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    clearAllCache();

    res.status(200).json(category);
  } catch (error) {
    console.error("Error updating category: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  if (!id || !mongoose.isValidObjectId(id)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid or missing ID" });
  }

  try {
    const category = await Category.findByIdAndDelete()(id);

    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found!" });
    }

    clearAllCache();
    res.status(200).json({ success: true, message: "The category is deleted" });
  } catch (error) {
    console.error("Error deleting category: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
