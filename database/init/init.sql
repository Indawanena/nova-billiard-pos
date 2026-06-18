-- Initial database setup for Nova Billiard POS
-- This script will run when the PostgreSQL container is first created

-- Create additional databases if needed
-- CREATE DATABASE nova_billiard_pos_dev;
-- CREATE DATABASE nova_billiard_pos_test;

-- Set timezone
SET timezone = 'UTC';

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE nova_billiard_pos TO postgres;

-- Create a dedicated user for the application (optional, for production)
-- CREATE USER nova_billiard_pos_app WITH ENCRYPTED PASSWORD 'secure_password';
-- GRANT CONNECT ON DATABASE nova_billiard_pos TO nova_billiard_pos_app;
-- GRANT USAGE ON SCHEMA public TO nova_billiard_pos_app;
-- GRANT CREATE ON SCHEMA public TO nova_billiard_pos_app;
