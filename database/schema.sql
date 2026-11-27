-- Beity database (MySQL 8)
-- Milestone 4: the tables needed for login, Create Listing and Book a Stay.
-- The other tables from Milestone 3 (photos, reviews, chat...) will be added with their features.
--
-- Run it with:  mysql -u root -p < database/schema.sql
-- WARNING: running this file again deletes all the data and starts fresh.

CREATE DATABASE IF NOT EXISTS beity CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE beity;

DROP TABLE IF EXISTS calendar_nights;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS seasonal_prices;
DROP TABLE IF EXISTS listings;
DROP TABLE IF EXISTS destinations;
DROP TABLE IF EXISTS security_logs;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;

-- ---------- user tables ----------

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone_encrypted VARCHAR(255) NULL,          -- AES-256-GCM, never plain text
  password_hash CHAR(60) NOT NULL,            -- bcrypt hash, never the real password
  role ENUM('guest', 'host', 'admin') NOT NULL DEFAULT 'guest',
  status ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
  failed_logins INT NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
  id CHAR(64) PRIMARY KEY,                    -- SHA-256 hash of the code in the cookie
  user_id INT NOT NULL,
  csrf_token CHAR(64) NOT NULL,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,               -- login time + 24 hours
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE security_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  event_type VARCHAR(40) NOT NULL,            -- e.g. LOGIN_SUCCESS, LOGIN_FAILED
  ip_address VARCHAR(45) NOT NULL,
  user_agent VARCHAR(255) NULL,
  details VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_logs_event (event_type),
  INDEX idx_logs_time (created_at)
);

-- ---------- feature tables ----------

CREATE TABLE destinations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE listings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  host_id INT NOT NULL,
  destination_id INT NOT NULL,
  title VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  property_type ENUM('apartment', 'chalet', 'villa', 'studio') NOT NULL,
  address_encrypted TEXT NOT NULL,            -- only shown to a guest after the booking is confirmed
  max_guests INT NOT NULL,
  bedrooms INT NOT NULL,
  bathrooms INT NOT NULL,
  base_price DECIMAL(10,2) NOT NULL,
  house_rules TEXT NULL,
  license_number VARCHAR(50) NULL UNIQUE,
  license_file VARCHAR(255) NULL,             -- scan upload comes in a later milestone
  status ENUM('draft', 'pending_review', 'published', 'rejected', 'archived') NOT NULL DEFAULT 'draft',
  rejection_reason VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (destination_id) REFERENCES destinations(id) ON DELETE RESTRICT,
  CHECK (max_guests BETWEEN 1 AND 20),
  CHECK (bedrooms BETWEEN 0 AND 20),
  CHECK (bathrooms >= 1),
  CHECK (base_price > 0),
  -- a home cannot be sent for review or published without a licence number
  CHECK (status IN ('draft', 'rejected', 'archived') OR license_number IS NOT NULL)
);

CREATE TABLE seasonal_prices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  listing_id INT NOT NULL,
  name VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  price_per_night DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
  CHECK (price_per_night > 0),
  CHECK (end_date >= start_date)
);

CREATE TABLE bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  listing_id INT NOT NULL,
  guest_id INT NOT NULL,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  nights INT NOT NULL,
  guests_count INT NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,         -- worked out by the server, never sent by the browser
  message_to_host VARCHAR(500) NULL,
  status ENUM('pending', 'confirmed', 'declined', 'cancelled', 'expired') NOT NULL DEFAULT 'pending',
  expires_at DATETIME NOT NULL,               -- the host has 24 hours to answer
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE RESTRICT,
  FOREIGN KEY (guest_id) REFERENCES users(id) ON DELETE RESTRICT,
  CHECK (check_out > check_in),
  CHECK (nights BETWEEN 1 AND 30),
  CHECK (guests_count >= 1),
  CHECK (total_price > 0)
);

-- One row for every night that is not free.
-- The primary key (listing_id, night_date) means the same night can never be saved twice,
-- so two guests can never book the same night.
CREATE TABLE calendar_nights (
  listing_id INT NOT NULL,
  night_date DATE NOT NULL,
  booking_id INT NULL,                        -- empty if the host blocked the night
  PRIMARY KEY (listing_id, night_date),
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT
);

-- ---------- fixed data ----------

INSERT INTO destinations (name, slug) VALUES
  ('North Coast (Sahel)', 'north-coast'),
  ('Ain Sokhna', 'ain-sokhna'),
  ('El Gouna', 'el-gouna'),
  ('Hurghada', 'hurghada'),
  ('Sharm El Sheikh', 'sharm-el-sheikh'),
  ('Dahab', 'dahab');
