/**
 * Admin Controller
 * Handles all admin operations: drivers, customers, tickets, invoices, settlements, dashboard
 */

const bcrypt = require('bcryptjs');
const pool = require('../config/db');

/**
 * Get all drivers
 */
const getAllDrivers = async (req, res) => {
  try {
    const [drivers] = await pool.execute(
      `SELECT d.id, d.user_id, d.user_id_code, d.name, d.phone, d.default_pay_rate, u.email, u.created_at
       FROM drivers d
       JOIN users u ON d.user_id = u.id
       ORDER BY d.created_at DESC`
    );

    return res.json({
      success: true,
      data: drivers
    });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch drivers',
      error: error.message
    });
  }
};

/**
 * Create a new driver
 */
const createDriver = async (req, res) => {
  try {
    const { user_id_code, name, phone, default_pay_rate, pin } = req.body;

    // Validate required fields
    if (!user_id_code || !name || !default_pay_rate || !pin) {
      return res.status(400).json({
        success: false,
        message: 'User ID code, name, default pay rate, and PIN are required'
      });
    }

    // Validate PIN is 4 digits
    if (!/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        message: 'PIN must be exactly 4 digits'
      });
    }

    // Check if user_id_code already exists
    const [existing] = await pool.execute(
      'SELECT id FROM drivers WHERE user_id_code = ?',
      [user_id_code]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User ID code already exists'
      });
    }

    // Hash PIN
    const hashedPin = await bcrypt.hash(pin, 10);

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Create user account for driver
      const [userResult] = await connection.execute(
        'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
        [`driver_${user_id_code}@trucking.com`, hashedPin, 'driver']
      );

      const userId = userResult.insertId;

      // Create driver record
      await connection.execute(
        `INSERT INTO drivers (user_id, user_id_code, name, phone, default_pay_rate, pin)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, user_id_code, name, phone || null, default_pay_rate, hashedPin]
      );

      await connection.commit();

      return res.status(201).json({
        success: true,
        message: 'Driver created successfully'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error creating driver:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create driver',
      error: error.message
    });
  }
};

/**
 * Update a driver
 */
const updateDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id_code, name, phone, default_pay_rate, pin } = req.body;

    // Check if driver exists
    const [drivers] = await pool.execute(
      'SELECT id, user_id FROM drivers WHERE id = ?',
      [id]
    );

    if (drivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const updates = [];
    const values = [];

    if (user_id_code) {
      // Check if user_id_code already exists for another driver
      const [existing] = await pool.execute(
        'SELECT id FROM drivers WHERE user_id_code = ? AND id != ?',
        [user_id_code, id]
      );
      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'User ID code already exists'
        });
      }
      updates.push('user_id_code = ?');
      values.push(user_id_code);
    }

    if (name) {
      updates.push('name = ?');
      values.push(name);
    }

    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone || null);
    }

    if (default_pay_rate !== undefined) {
      updates.push('default_pay_rate = ?');
      values.push(default_pay_rate);
    }

    if (pin) {
      if (!/^\d{4}$/.test(pin)) {
        return res.status(400).json({
          success: false,
          message: 'PIN must be exactly 4 digits'
        });
      }
      const hashedPin = await bcrypt.hash(pin, 10);
      updates.push('pin = ?');
      values.push(hashedPin);
      
      // Also update user password
      await pool.execute(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPin, drivers[0].user_id]
      );
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    values.push(id);
    await pool.execute(
      `UPDATE drivers SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );

    return res.json({
      success: true,
      message: 'Driver updated successfully'
    });
  } catch (error) {
    console.error('Error updating driver:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update driver',
      error: error.message
    });
  }
};

/**
 * Delete a driver
 */
const deleteDriver = async (req, res) => {
  try {
    const { id } = req.params;

    // Get driver info
    const [drivers] = await pool.execute(
      'SELECT user_id FROM drivers WHERE id = ?',
      [id]
    );

    if (drivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const userId = drivers[0].user_id;

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Delete driver
      await connection.execute('DELETE FROM drivers WHERE id = ?', [id]);
      
      // Delete user account
      await connection.execute('DELETE FROM users WHERE id = ?', [userId]);

      await connection.commit();

      return res.json({
        success: true,
        message: 'Driver deleted successfully'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error deleting driver:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete driver',
      error: error.message
    });
  }
};

/**
 * Get all customers
 */
const getAllCustomers = async (req, res) => {
  try {
    const [customers] = await pool.execute(
      'SELECT * FROM customers ORDER BY name ASC'
    );

    return res.json({
      success: true,
      data: customers
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch customers',
      error: error.message
    });
  }
};

/**
 * Create a new customer
 */
const createCustomer = async (req, res) => {
  try {
    const { name, default_bill_rate } = req.body;

    if (!name || default_bill_rate === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Name and default bill rate are required'
      });
    }

    const [result] = await pool.execute(
      'INSERT INTO customers (name, default_bill_rate) VALUES (?, ?)',
      [name, default_bill_rate]
    );

    return res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: { id: result.insertId, name, default_bill_rate }
    });
  } catch (error) {
    console.error('Error creating customer:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create customer',
      error: error.message
    });
  }
};

/**
 * Update a customer
 */
const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, default_bill_rate } = req.body;

    const updates = [];
    const values = [];

    if (name) {
      updates.push('name = ?');
      values.push(name);
    }

    if (default_bill_rate !== undefined) {
      updates.push('default_bill_rate = ?');
      values.push(default_bill_rate);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    values.push(id);
    await pool.execute(
      `UPDATE customers SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );

    return res.json({
      success: true,
      message: 'Customer updated successfully'
    });
  } catch (error) {
    console.error('Error updating customer:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update customer',
      error: error.message
    });
  }
};

/**
 * Delete a customer
 */
const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.execute('DELETE FROM customers WHERE id = ?', [id]);

    return res.json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting customer:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete customer',
      error: error.message
    });
  }
};

/**
 * Get all tickets with filters
 */
const getAllTickets = async (req, res) => {
  try {
    const { month, customer, driver, status, search } = req.query;

    let query = `
      SELECT t.*, d.name as driver_name, d.user_id_code, c.name as customer_name
      FROM tickets t
      LEFT JOIN drivers d ON t.driver_id = d.id
      LEFT JOIN customers c ON t.customer = c.name
      WHERE 1=1
    `;
    const params = [];

    if (month) {
      // Extract year and month from format like "Nov 2025"
      const [monthName, year] = month.split(' ');
      const monthNum = new Date(`${monthName} 1, ${year}`).getMonth() + 1;
      query += ` AND MONTH(t.date) = ? AND YEAR(t.date) = ?`;
      params.push(monthNum, year);
    }

    if (customer && customer !== 'All') {
      query += ` AND t.customer = ?`;
      params.push(customer);
    }

    if (driver && driver !== 'All') {
      query += ` AND d.name = ?`;
      params.push(driver);
    }

    if (status) {
      query += ` AND t.status = ?`;
      params.push(status);
    }

    if (search) {
      query += ` AND t.ticket_number LIKE ?`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY t.date DESC, t.created_at DESC`;

    const [tickets] = await pool.execute(query, params);

    return res.json({
      success: true,
      data: tickets
    });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch tickets',
      error: error.message
    });
  }
};

/**
 * Get ticket by ID
 */
const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;

    const [tickets] = await pool.execute(
      `SELECT t.*, d.name as driver_name, d.user_id_code, c.name as customer_name
       FROM tickets t
       LEFT JOIN drivers d ON t.driver_id = d.id
       LEFT JOIN customers c ON t.customer = c.name
       WHERE t.id = ?`,
      [id]
    );

    if (tickets.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    return res.json({
      success: true,
      data: tickets[0]
    });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch ticket',
      error: error.message
    });
  }
};

/**
 * Update ticket
 */
const updateTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { bill_rate, pay_rate, status, quantity } = req.body;

    const updates = [];
    const values = [];

    if (bill_rate !== undefined) {
      updates.push('bill_rate = ?');
      values.push(bill_rate);
    }

    if (pay_rate !== undefined) {
      updates.push('pay_rate = ?');
      values.push(pay_rate);
    }

    if (status) {
      updates.push('status = ?');
      values.push(status);
    }

    if (quantity !== undefined) {
      updates.push('quantity = ?');
      values.push(quantity);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    // Get current ticket to recalculate totals
    const [tickets] = await pool.execute(
      'SELECT quantity, bill_rate, pay_rate FROM tickets WHERE id = ?',
      [id]
    );

    if (tickets.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    const currentTicket = tickets[0];
    const finalQty = quantity !== undefined ? quantity : currentTicket.quantity;
    const finalBillRate = bill_rate !== undefined ? bill_rate : currentTicket.bill_rate;
    const finalPayRate = pay_rate !== undefined ? pay_rate : currentTicket.pay_rate;

    // Calculate totals
    updates.push('total_bill = ?');
    values.push(finalQty * finalBillRate);
    
    updates.push('total_pay = ?');
    values.push(finalQty * finalPayRate);

    values.push(id);
    await pool.execute(
      `UPDATE tickets SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );

    return res.json({
      success: true,
      message: 'Ticket updated successfully'
    });
  } catch (error) {
    console.error('Error updating ticket:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update ticket',
      error: error.message
    });
  }
};

/**
 * Update ticket status
 */
const updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['Pending', 'Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required (Pending, Approved, or Rejected)'
      });
    }

    await pool.execute(
      'UPDATE tickets SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, id]
    );

    return res.json({
      success: true,
      message: 'Ticket status updated successfully'
    });
  } catch (error) {
    console.error('Error updating ticket status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update ticket status',
      error: error.message
    });
  }
};

/**
 * Get dashboard statistics
 */
const getDashboardStats = async (req, res) => {
  try {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    // Unbilled tickets (Pending status)
    const [unbilledResult] = await pool.execute(
      'SELECT COUNT(*) as count FROM tickets WHERE status = ?',
      ['Pending']
    );
    const unbilledTickets = unbilledResult[0].count;

    // Revenue this month (total_bill from approved tickets)
    const [revenueResult] = await pool.execute(
      `SELECT COALESCE(SUM(total_bill), 0) as revenue
       FROM tickets
       WHERE status = 'Approved'
       AND MONTH(date) = ? AND YEAR(date) = ?`,
      [currentMonth, currentYear]
    );
    const revenue = parseFloat(revenueResult[0].revenue);

    // Driver pay this month (total_pay from approved tickets)
    const [payResult] = await pool.execute(
      `SELECT COALESCE(SUM(total_pay), 0) as pay
       FROM tickets
       WHERE status = 'Approved'
       AND MONTH(date) = ? AND YEAR(date) = ?`,
      [currentMonth, currentYear]
    );
    const driverPay = parseFloat(payResult[0].pay);

    // Estimated profit
    const estimatedProfit = revenue - driverPay;

    // Weekly breakdown for chart
    const [weeklyData] = await pool.execute(
      `SELECT 
        WEEK(date, 1) as week,
        COALESCE(SUM(total_bill), 0) as revenue,
        COALESCE(SUM(total_pay), 0) as pay
       FROM tickets
       WHERE status = 'Approved'
       AND MONTH(date) = ? AND YEAR(date) = ?
       GROUP BY WEEK(date, 1)
       ORDER BY week`,
      [currentMonth, currentYear]
    );

    return res.json({
      success: true,
      data: {
        unbilledTickets,
        revenue,
        driverPay,
        estimatedProfit,
        weeklyData
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
};

/**
 * Generate invoice for customer
 */
const generateInvoice = async (req, res) => {
  try {
    const { customerId, startDate, endDate } = req.query;

    if (!customerId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID, start date, and end date are required'
      });
    }

    // Get customer name
    const [customers] = await pool.execute(
      'SELECT name FROM customers WHERE id = ?',
      [customerId]
    );

    if (customers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const customerName = customers[0].name;

    // Get approved tickets for customer in date range
    const [tickets] = await pool.execute(
      `SELECT t.*, d.name as driver_name, d.user_id_code
       FROM tickets t
       LEFT JOIN drivers d ON t.driver_id = d.id
       WHERE t.customer = ? 
       AND t.status = 'Approved'
       AND t.date >= ? AND t.date <= ?
       ORDER BY t.date ASC`,
      [customerName, startDate, endDate]
    );

    const subtotal = tickets.reduce((sum, ticket) => sum + parseFloat(ticket.total_bill), 0);
    const gst = subtotal * 0.05; // 5% GST
    const total = subtotal + gst;

    return res.json({
      success: true,
      data: {
        customer: customerName,
        startDate,
        endDate,
        tickets,
        subtotal,
        gst,
        total
      }
    });
  } catch (error) {
    console.error('Error generating invoice:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate invoice',
      error: error.message
    });
  }
};

/**
 * Download invoice as PDF
 * Route: GET /admin/invoices/download/:customerId?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
const downloadInvoice = async (req, res) => {
  try {
    // Get customerId from URL params, dates from query params
    const { customerId } = req.params;
    const { startDate, endDate } = req.query;

    // Validate required parameters
    if (!customerId || !startDate || !endDate) {
      res.status(400);
      return res.send('Customer ID, start date, and end date are required');
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      res.status(400);
      return res.send('Dates must be in YYYY-MM-DD format');
    }

    // Get customer name
    const [customers] = await pool.execute(
      'SELECT name FROM customers WHERE id = ?',
      [customerId]
    );

    if (customers.length === 0) {
      res.status(404);
      return res.send('Customer not found');
    }

    const customerName = customers[0].name;

    // Get approved tickets for customer in date range
    const [tickets] = await pool.execute(
      `SELECT t.*, d.name as driver_name, d.user_id_code
       FROM tickets t
       LEFT JOIN drivers d ON t.driver_id = d.id
       WHERE t.customer = ? 
       AND t.status = 'Approved'
       AND t.date >= ? AND t.date <= ?
       ORDER BY t.date ASC`,
      [customerName, startDate, endDate]
    );

    if (tickets.length === 0) {
      res.status(404);
      return res.send('No approved tickets found for the selected date range');
    }

    // Calculate totals
    const subtotal = tickets.reduce((sum, ticket) => sum + parseFloat(ticket.total_bill || 0), 0);
    const gst = subtotal * 0.05; // 5% GST
    const total = subtotal + gst;

    // Generate PDF using pdf-lib
    const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
    const pdfDoc = await PDFDocument.create();
    
    // Add a page
    const page = pdfDoc.addPage([612, 792]); // US Letter size
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const primaryColor = rgb(0.16, 0.36, 0.32); // #295b52
    
    // Invoice Header
    page.drawText('INVOICE', {
      x: 50,
      y: height - 50,
      size: 24,
      font: boldFont,
      color: primaryColor,
    });

    // Invoice Details
    const invoiceNumber = `INV-${customerId}-${Date.now().toString().slice(-6)}`;
    const invoiceDate = new Date().toLocaleDateString();
    
    page.drawText(`Invoice #: ${invoiceNumber}`, {
      x: 50,
      y: height - 80,
      size: 10,
      font: font,
    });

    page.drawText(`Date of Issue: ${invoiceDate}`, {
      x: 50,
      y: height - 95,
      size: 10,
      font: font,
    });

    // Bill To Section
    page.drawText('Bill To:', {
      x: width - 200,
      y: height - 50,
      size: 12,
      font: boldFont,
      color: primaryColor,
    });

    page.drawText(customerName, {
      x: width - 200,
      y: height - 70,
      size: 10,
      font: font,
    });

    page.drawText(`Period: ${startDate} to ${endDate}`, {
      x: width - 200,
      y: height - 85,
      size: 9,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Table Header
    let yPos = height - 140;
    const rowHeight = 20;
    const colWidths = [80, 80, 120, 80, 60, 70, 80]; // Date, Ticket#, Description, Driver, Qty, Rate, Total
    
    // Header background
    page.drawRectangle({
      x: 50,
      y: yPos - 15,
      width: width - 100,
      height: rowHeight,
      color: primaryColor,
    });

    // Header text
    const headers = ['Date', 'Ticket #', 'Description', 'Driver', 'Qty', 'Rate', 'Total'];
    let xPos = 55;
    headers.forEach((header, index) => {
      page.drawText(header, {
        x: xPos,
        y: yPos - 5,
        size: 10,
        font: boldFont,
        color: rgb(1, 1, 1),
      });
      xPos += colWidths[index];
    });

    yPos -= rowHeight;

    // Table rows
    tickets.forEach((ticket) => {
      if (yPos < 100) {
        // Add new page if needed
        const newPage = pdfDoc.addPage([612, 792]);
        yPos = height - 50;
      }

      const rowData = [
        ticket.date,
        ticket.ticket_number || '-',
        (ticket.job_type || ticket.description || '-').substring(0, 20),
        (ticket.driver_name || '-').substring(0, 15),
        parseFloat(ticket.quantity || 0).toFixed(1),
        `$${parseFloat(ticket.bill_rate || 0).toFixed(2)}`,
        `$${parseFloat(ticket.total_bill || 0).toFixed(2)}`,
      ];

      xPos = 55;
      rowData.forEach((cell, index) => {
        page.drawText(String(cell), {
          x: xPos,
          y: yPos - 5,
          size: 9,
          font: font,
        });
        xPos += colWidths[index];
      });

      yPos -= rowHeight;
    });

    // Totals Section
    yPos -= 20;
    const totalsY = yPos;
    
    page.drawText('Subtotal:', {
      x: width - 250,
      y: totalsY,
      size: 10,
      font: font,
    });
    page.drawText(`$${subtotal.toFixed(2)}`, {
      x: width - 100,
      y: totalsY,
      size: 10,
      font: font,
    });

    page.drawText('GST (5%):', {
      x: width - 250,
      y: totalsY - 20,
      size: 10,
      font: font,
    });
    page.drawText(`$${gst.toFixed(2)}`, {
      x: width - 100,
      y: totalsY - 20,
      size: 10,
      font: font,
    });

    page.drawText('Total:', {
      x: width - 250,
      y: totalsY - 40,
      size: 14,
      font: boldFont,
      color: primaryColor,
    });
    page.drawText(`$${total.toFixed(2)}`, {
      x: width - 100,
      y: totalsY - 40,
      size: 14,
      font: boldFont,
      color: primaryColor,
    });

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save();

    // Set headers to prevent caching and ensure PDF download
    const sanitizedCustomerName = customerName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Invoice-${sanitizedCustomerName}-${startDate}-${endDate}.pdf`;

    // Prevent caching - CRITICAL to avoid 304 responses
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.removeHeader('ETag'); // Remove ETag to prevent 304
    
    // Set PDF headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBytes.length);

    // Return PDF binary data with 200 status
    res.status(200);
    return res.send(pdfBytes);

  } catch (error) {
    console.error('Error downloading invoice PDF:', error);
    // Return plain text error, not JSON
    res.status(500);
    res.setHeader('Content-Type', 'text/plain');
    return res.send(`Failed to generate invoice PDF: ${error.message}`);
  }
};
/**
 * Generate settlement for driver
 */
const generateSettlement = async (req, res) => {
  try {
    const { driverId, startDate, endDate } = req.query;

    // Validate all required parameters with specific error messages
    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: 'Driver ID is required',
        missing: 'driverId'
      });
    }
    
    if (!startDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date is required (format: YYYY-MM-DD)',
        missing: 'startDate'
      });
    }
    
    if (!endDate) {
      return res.status(400).json({
        success: false,
        message: 'End date is required (format: YYYY-MM-DD)',
        missing: 'endDate'
      });
    }
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate)) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be in YYYY-MM-DD format',
        received: startDate
      });
    }
    
    if (!dateRegex.test(endDate)) {
      return res.status(400).json({
        success: false,
        message: 'End date must be in YYYY-MM-DD format',
        received: endDate
      });
    }

    // Get driver info
    const [drivers] = await pool.execute(
      'SELECT id, name, user_id_code FROM drivers WHERE id = ?',
      [driverId]
    );

    if (drivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const driver = drivers[0];

    // Get tickets for driver in date range
    const [tickets] = await pool.execute(
      `SELECT t.*, c.name as customer_name
       FROM tickets t
       LEFT JOIN customers c ON t.customer = c.name
       WHERE t.driver_id = ?
       AND t.date >= ? AND t.date <= ?
       ORDER BY t.date ASC`,
      [driverId, startDate, endDate]
    );

    const totalPay = tickets.reduce((sum, ticket) => sum + parseFloat(ticket.total_pay), 0);

    return res.json({
      success: true,
      data: {
        driver: {
          id: driver.id,
          name: driver.name,
          user_id_code: driver.user_id_code
        },
        startDate,
        endDate,
        tickets,
        totalPay
      }
    });
  } catch (error) {
    console.error('Error generating settlement:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate settlement',
      error: error.message
    });
  }
};

/**
 * Download settlement as PDF (placeholder)
 * 
 * Route: GET /admin/settlements/download/:driverId?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * 
 * Parameters:
 * - driverId (URL param): Driver ID
 * - startDate (query param): Start date in YYYY-MM-DD format (required)
 * - endDate (query param): End date in YYYY-MM-DD format (required)
 * 
 * Note: Settlements are generated dynamically from tickets. This endpoint requires
 * all three parameters to generate the settlement PDF.
 */
/**
 * Download settlement as PDF
 */
const downloadSettlement = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { startDate, endDate } = req.query;

    if (!driverId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Driver ID, start date, and end date are required'
      });
    }

    // Get driver info
    const [drivers] = await pool.execute(
      'SELECT name, user_id_code FROM drivers WHERE id = ?',
      [driverId]
    );

    if (drivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const driver = drivers[0];
    const filename = `Settlement-${driver.user_id_code}-${startDate}-${endDate}.pdf`;

    // ✅ DISABLE CACHING
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // ✅ SET CORRECT PDF HEADERS
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // ✅ SEND DUMMY PDF
    const dummyPdf = Buffer.from(
      `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources <<>> /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 60 >>
stream
BT /F1 18 Tf 72 720 Td (DRIVER SETTLEMENT) Tj
/Courier 12 Tf 72 690 Td (Driver: ${driver.name} (${driver.user_id_code})) Tj
72 670 Td (Period: ${startDate} to ${endDate}) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000015 00000 n 
0000000076 00000 n 
0000000130 00000 n 
0000000212 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
305
%%EOF`
    );

    return res.status(200).send(dummyPdf);
  } catch (error) {
    console.error('Error downloading settlement:', error);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      success: false,
      message: 'Failed to generate settlement PDF',
      error: error.message
    });
  }
};

/**
 * Get bill rates (default customer bill rates)
 */
const getBillRates = async (req, res) => {
  try {
    const [customers] = await pool.execute(
      'SELECT id, name, default_bill_rate FROM customers ORDER BY name ASC'
    );

    return res.json({
      success: true,
      data: customers
    });
  } catch (error) {
    console.error('Error fetching bill rates:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch bill rates',
      error: error.message
    });
  }
};

/**
 * Update bill rates
 */
const updateBillRates = async (req, res) => {
  try {
    const { rates } = req.body; // Array of {id, default_bill_rate}

    if (!Array.isArray(rates)) {
      return res.status(400).json({
        success: false,
        message: 'Rates must be an array'
      });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      for (const rate of rates) {
        await connection.execute(
          'UPDATE customers SET default_bill_rate = ?, updated_at = NOW() WHERE id = ?',
          [rate.default_bill_rate, rate.id]
        );
      }

      await connection.commit();

      return res.json({
        success: true,
        message: 'Bill rates updated successfully'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error updating bill rates:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update bill rates',
      error: error.message
    });
  }
};

module.exports = {
  getAllDrivers,
  createDriver,
  updateDriver,
  deleteDriver,
  getAllCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getAllTickets,
  getTicketById,
  updateTicket,
  updateTicketStatus,
  getDashboardStats,
  generateInvoice,
  downloadInvoice,
  generateSettlement,
  downloadSettlement,
  getBillRates,
  updateBillRates
};

