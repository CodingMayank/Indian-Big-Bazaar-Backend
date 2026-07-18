const express = require("express");
const router = express.Router();
const {verifyToken} = require("../middlewares/customerverifyToken.js");
const CustomerController = require("../controllers/customerController.js");


router.get("/me", verifyToken, CustomerController.getMe);//to check the admin is logged in

router.post("/createCustomer",CustomerController.customerSignup);

router.post("/login",CustomerController.customerLogin);


module.exports = router;