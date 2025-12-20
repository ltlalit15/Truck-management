-- Truck Management System Database Schema
-- MySQL Database Schema

-- Create database (uncomment if needed)
-- CREATE DATABASE IF NOT EXISTS truck_management;
-- USE truck_management;

-- Users table (for authentication)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'driver') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Drivers table
CREATE TABLE IF NOT EXISTS drivers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  user_id_code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  default_pay_rate DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  pin VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id_code (user_id_code),
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  default_bill_rate DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Trucks table (for truck number dropdown)
CREATE TABLE IF NOT EXISTS trucks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  truck_number VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_truck_number (truck_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Driver Customers table (junction table for driver-specific customers)
CREATE TABLE IF NOT EXISTS driver_customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  driver_id INT NOT NULL,
  customer_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  UNIQUE KEY unique_driver_customer (driver_id, customer_id),
  INDEX idx_driver_id (driver_id),
  INDEX idx_customer_id (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  driver_id INT NOT NULL,
  date DATE NOT NULL,
  truck_number VARCHAR(50),
  customer VARCHAR(255) NOT NULL,
  job_type VARCHAR(255),
  equipment_type VARCHAR(255),
  ticket_number VARCHAR(100) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  photo_path VARCHAR(500),
  bill_rate DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  pay_rate DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total_bill DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total_pay DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  status ENUM('Pending', 'Approved', 'Rejected') NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
  INDEX idx_driver_id (driver_id),
  INDEX idx_date (date),
  INDEX idx_customer (customer),
  INDEX idx_ticket_number (ticket_number),
  INDEX idx_status (status),
  INDEX idx_equipment_type (equipment_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample admin user
-- Password: 'password' (hashed with bcrypt)
-- Hash generated using: bcrypt.hash('password', 10)
-- Default admin credentials: email: admin@m.com, password: password
INSERT INTO users (email, password, role) VALUES 
('admin@m.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin')
ON DUPLICATE KEY UPDATE email=email;

-- Insert sample customers
INSERT INTO customers (name, default_bill_rate) VALUES
('Aecon', 135.00),
('PCL Construction', 120.00),
('EllisDon', 110.00),
('GrindStone', 140.00)
ON DUPLICATE KEY UPDATE name=name;

-- Insert sample trucks (you can add more truck numbers as needed)
INSERT INTO trucks (truck_number) VALUES
('TRUCK-001'),
('TRUCK-002'),
('TRUCK-003'),
('TRUCK-004'),
('TRUCK-005')
ON DUPLICATE KEY UPDATE truck_number=truck_number;

-- Note: The admin password hash above is a placeholder
-- In production, generate a proper hash using bcrypt.hash('password', 10)
-- Example hash for 'password': $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy

