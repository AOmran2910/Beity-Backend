-- Least privilege: the app does not log in to MySQL as root.
-- It uses this account, which can only do what the code needs.
--
-- Run it after schema.sql:  mysql -u root -p < database/app_user.sql
-- Change the password here and in your .env file.

CREATE USER IF NOT EXISTS 'beity_app'@'localhost' IDENTIFIED BY 'change-this-password';

GRANT SELECT, INSERT, UPDATE, DELETE ON beity.users TO 'beity_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON beity.sessions TO 'beity_app'@'localhost';
GRANT SELECT ON beity.destinations TO 'beity_app'@'localhost';

-- homes and bookings are never deleted, only their status changes
GRANT SELECT, INSERT, UPDATE ON beity.listings TO 'beity_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON beity.bookings TO 'beity_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON beity.seasonal_prices TO 'beity_app'@'localhost';
GRANT SELECT, INSERT, DELETE ON beity.calendar_nights TO 'beity_app'@'localhost';

-- the security log can be added to and read, but never changed or deleted
GRANT SELECT, INSERT ON beity.security_logs TO 'beity_app'@'localhost';

FLUSH PRIVILEGES;
