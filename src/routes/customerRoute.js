const express = require("express");
const router = express.Router();
const {verifyToken} = require("../middlewares/verifyToken.js");
const CustomerController = require("../controllers/customerController.js");


router.post("/createCustomer",CustomerController.customerSignup);

router.post("/login",CustomerController.customerLogin);


module.exports = router;