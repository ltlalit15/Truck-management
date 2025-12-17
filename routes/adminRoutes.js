/**
 * Admin Routes
 * All routes require admin authentication
 */

const express = require('express');
const router = express.Router();
const { authenticate, isAdmin } = require('../middleware/auth');
const adminController = require('../controllers/adminController');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'photo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Apply authentication middleware to all routes
router.use(authenticate);
router.use(isAdmin);

// Driver management routes
router.get('/drivers', adminController.getAllDrivers);
router.post('/drivers', adminController.createDriver);
router.put('/drivers/:id', adminController.updateDriver);
router.delete('/drivers/:id', adminController.deleteDriver);

// Customer management routes
router.get('/customers', adminController.getAllCustomers);
router.post('/customers', adminController.createCustomer);
router.put('/customers/:id', adminController.updateCustomer);
router.delete('/customers/:id', adminController.deleteCustomer);

// Ticket management routes
router.get('/tickets', adminController.getAllTickets);
router.get('/tickets/:id', adminController.getTicketById);
router.put('/tickets/:id', adminController.updateTicket);
router.put('/tickets/:id/status', adminController.updateTicketStatus);

// Dashboard routes
router.get('/dashboard/stats', adminController.getDashboardStats);

// Invoice routes
router.get('/invoices/generate', adminController.generateInvoice);
router.get('/invoices/download/:customerId', adminController.downloadInvoice);

// Settlement routes
router.get('/settlements/generate', adminController.generateSettlement);
router.get('/settlements/download/:driverId', adminController.downloadSettlement);

// Data setup routes (default bill rates)
router.get('/settings/bill-rates', adminController.getBillRates);
router.put('/settings/bill-rates', adminController.updateBillRates);

module.exports = router;

