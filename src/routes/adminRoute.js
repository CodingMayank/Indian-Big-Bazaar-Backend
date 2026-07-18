const express = require("express");
const router = express.Router();
const {verifyToken} = require("../middlewares/verifyToken.js");
const AdminController = require("../controllers/adminController.js");
const upload = require("../middlewares/upload.js");

router.get("/me", verifyToken, AdminController.getMe);//to check the admin is logged in

router.post("/createAdmin",AdminController.createAdmin);

router.post("/login",AdminController.adminLogin);

router.post("/createproduct", upload.single("product_image"), AdminController.createOrUpdateProduct);

router.get("/getproduct/:admin_id", AdminController.getProductsByAdmin);

module.exports = router;