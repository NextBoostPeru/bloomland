<?php

namespace App\Controllers;

use App\Config\Database;
use App\Utils\Response;

class MigrationController
{
    private $conn;

    public function __construct()
    {
        // Load env if not loaded
        if (!isset($_ENV['DB_HOST'])) {
            try {
                $dotenv = \Dotenv\Dotenv::createImmutable(dirname(dirname(dirname(__DIR__))));
                $dotenv->load();
                
                // Manually populate $_ENV if dotenv doesn't do it automatically in this context
                if (!isset($_ENV['DB_USER'])) {
                    $_ENV['DB_HOST'] = $_SERVER['DB_HOST'] ?? getenv('DB_HOST');
                    $_ENV['DB_NAME'] = $_SERVER['DB_NAME'] ?? getenv('DB_NAME');
                    $_ENV['DB_USER'] = $_SERVER['DB_USER'] ?? getenv('DB_USER');
                    $_ENV['DB_PASS'] = $_SERVER['DB_PASS'] ?? getenv('DB_PASS');
                    $_ENV['DB_PORT'] = $_SERVER['DB_PORT'] ?? getenv('DB_PORT');
                }
            } catch (\Exception $e) {
                // Ignore if already loaded or file not found
            }
        }
        
        // Ensure manual load of .env file from api directory if previous load failed to get vars
        if (empty($_ENV['DB_USER'])) {
             $envFile = dirname(dirname(dirname(__DIR__))) . '/api/.env';
             if (file_exists($envFile)) {
                 $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
                 foreach ($lines as $line) {
                     if (strpos($line, '=') !== false && substr($line, 0, 1) !== '#') {
                         list($key, $value) = explode('=', $line, 2);
                         $key = trim($key);
                         $value = trim($value);
                         $_ENV[$key] = $value;
                         putenv("$key=$value");
                     }
                 }
             }
        }

        $database = new Database();
        $this->conn = $database->connect();
    }

    public function migrateInventory()
    {
        try {
            if (!$this->conn) {
                Response::error("Database connection failed", 500);
                return;
            }

            // 1. Brands (Lineas)
            $this->conn->exec("CREATE TABLE IF NOT EXISTS brands (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                active TINYINT(1) DEFAULT 1
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            // 2. Warehouses
            $this->conn->exec("CREATE TABLE IF NOT EXISTS warehouses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                location VARCHAR(255),
                active TINYINT(1) DEFAULT 1
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            // 3. Products
            $this->conn->exec("CREATE TABLE IF NOT EXISTS products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sku VARCHAR(100) UNIQUE,
                barcode VARCHAR(100),
                name VARCHAR(255) NOT NULL,
                description_web TEXT,
                technical_specs TEXT,
                
                category_id INT,
                subcategory_id INT,
                brand_id INT,
                supplier_id INT,
                
                cost_price DECIMAL(10, 2) DEFAULT 0.00,
                price DECIMAL(10, 2) DEFAULT 0.00,
                
                gender VARCHAR(50),
                collection VARCHAR(100),
                design VARCHAR(100),
                material VARCHAR(100),
                neck_type VARCHAR(100),
                details TEXT,
                aisle VARCHAR(50),
                
                image_url VARCHAR(255),
                
                active TINYINT(1) DEFAULT 1,
                stock_quantity INT DEFAULT 0,
                min_stock_alert INT DEFAULT 0,
                
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
                FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE SET NULL,
                FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
                FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            // 4. Product Images
            $this->conn->exec("CREATE TABLE IF NOT EXISTS product_images (
                id INT AUTO_INCREMENT PRIMARY KEY,
                product_id INT NOT NULL,
                image_url TEXT NOT NULL,
                display_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            // 5. Product Stocks
            $this->conn->exec("CREATE TABLE IF NOT EXISTS product_stocks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                product_id INT NOT NULL,
                warehouse_id INT NOT NULL,
                quantity INT DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_stock (product_id, warehouse_id),
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            // 6. Users (Simple table for FK)
            $this->conn->exec("CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50),
                email VARCHAR(100),
                password VARCHAR(255),
                role VARCHAR(20) DEFAULT 'user',
                active TINYINT(1) DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            // 7. Inventory Movements
            $this->conn->exec("CREATE TABLE IF NOT EXISTS inventory_movements (
                id INT AUTO_INCREMENT PRIMARY KEY,
                product_id INT NOT NULL,
                warehouse_id INT NOT NULL,
                user_id INT(11) UNSIGNED,
                type ENUM('IN', 'OUT', 'ADJUSTMENT', 'TRANSFER') NOT NULL,
                quantity INT NOT NULL,
                previous_stock INT,
                new_stock INT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(userID) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            Response::json(['message' => 'Inventory tables migrated successfully']);
        } catch (\Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function migrateSubcategories()
    {
        try {
            // Check connection first
            if (!$this->conn) {
                Response::error("Database connection failed", 500);
                return;
            }

            // Subcategories Table
            // First check if categories table exists, if not, create it
            $this->conn->exec("CREATE TABLE IF NOT EXISTS categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                active TINYINT(1) DEFAULT 1
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            $sql = "CREATE TABLE IF NOT EXISTS subcategories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                category_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                active TINYINT(1) DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";

            $this->conn->exec($sql);

            // Suppliers Table
            $sqlSuppliers = "CREATE TABLE IF NOT EXISTS suppliers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                contact_name VARCHAR(255),
                email VARCHAR(255),
                phone VARCHAR(50),
                address TEXT,
                ruc VARCHAR(20),
                active TINYINT(1) DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";

            $this->conn->exec($sqlSuppliers);

            Response::json(['message' => 'Tables migrated successfully']);
        } catch (\Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function addSlugToCategories()
    {
        try {
            // 1. Check if column exists
            $stmt = $this->conn->query("SHOW COLUMNS FROM categories LIKE 'slug'");
            $exists = $stmt->fetch();

            if (!$exists) {
                // 2. Add column
                $this->conn->exec("ALTER TABLE categories ADD COLUMN slug VARCHAR(255) DEFAULT NULL AFTER name");
                // Add unique index
                $this->conn->exec("ALTER TABLE categories ADD UNIQUE INDEX unique_slug (slug)");
                Response::json(['success' => true, 'message' => 'Columna slug agregada a categories']);
            } else {
                Response::json(['success' => true, 'message' => 'Columna slug ya existe en categories']);
            }
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    public function addProductColumns()
    {
        try {
            $messages = [];

            // 1. Check woocommerce_id
            $stmt = $this->conn->query("SHOW COLUMNS FROM products LIKE 'woocommerce_id'");
            if (!$stmt->fetch()) {
                $this->conn->exec("ALTER TABLE products ADD COLUMN woocommerce_id BIGINT DEFAULT NULL AFTER id");
                $this->conn->exec("ALTER TABLE products ADD INDEX idx_woo_product_id (woocommerce_id)");
                $messages[] = 'Columna woocommerce_id agregada';
            }

            // 2. Check image_url (ensure it is long enough)
            $stmt = $this->conn->query("SHOW COLUMNS FROM products LIKE 'image_url'");
            $col = $stmt->fetch(\PDO::FETCH_ASSOC);
            if ($col) {
                // Check type if possible, but simpler to just modify to TEXT or larger VARCHAR
                $this->conn->exec("ALTER TABLE products MODIFY COLUMN image_url TEXT");
                $messages[] = 'Columna image_url modificada a TEXT';
            } else {
                 $this->conn->exec("ALTER TABLE products ADD COLUMN image_url TEXT");
                 $messages[] = 'Columna image_url agregada';
            }

            if (empty($messages)) {
                Response::json(['success' => true, 'message' => 'Columnas de producto ya actualizadas']);
            } else {
                Response::json(['success' => true, 'message' => implode(', ', $messages)]);
            }

        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }
}
