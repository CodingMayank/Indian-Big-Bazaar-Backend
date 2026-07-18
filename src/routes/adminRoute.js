const express = require("express");
const router = express.Router();
const {verifyToken} = require("../middlewares/verifyToken.js");
const AdminController = require("../controllers/adminController.js");


router.get("/me", verifyToken, AdminController.getMe);//to check the admin is logged in

router.post("/createAdmin",AdminController.createAdmin);

router.post("/login",AdminController.adminLogin);



module.exports = router;