<?php
namespace App\Controllers;

use App\Config\Database;
use App\Utils\Response;
use App\Services\WooCommerceService;

class ProductController
{
    private $conn;

    public function __construct()
    {
        $db = new Database();
        $this->conn = $db->connect();
    }

    public function store()
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            
            // Validation
            if (empty($data['name']) || empty($data['price'])) {
                Response::error("Nombre y precio son requeridos");
            }

            $this->conn->beginTransaction();

            // Insert into local DB
            // Note: We check if woocommerce_id column exists implicitly by trying to use it if we needed to, 
            // but for insertion we use standard fields first.
            
            $sql = "INSERT INTO products (name, sku, description, price, category_id, stock, active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, NOW())";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute([
                $data['name'],
                $data['sku'] ?? null,
                $data['description'] ?? '',
                $data['price'],
                $data['category_id'] ?? null,
                $data['stock'] ?? 0
            ]);
            
            $productId = $this->conn->lastInsertId();

            // Handle Initial Stock in Warehouse (Main Warehouse by default if not specified)
            // Assuming Warehouse 1 is Main
            $warehouseId = $data['warehouse_id'] ?? 1;
            $stockQuantity = $data['stock'] ?? 0;
            
            if ($stockQuantity > 0) {
                 $stockSql = "INSERT INTO product_stocks (product_id, warehouse_id, quantity, updated_at) 
                              VALUES (?, ?, ?, NOW()) 
                              ON DUPLICATE KEY UPDATE quantity = ?";
                 $stockStmt = $this->conn->prepare($stockSql);
                 $stockStmt->execute([$productId, $warehouseId, $stockQuantity, $stockQuantity]);
                 
                 // Log movement
                 $moveSql = "INSERT INTO inventory_movements (product_id, warehouse_id, type, quantity, previous_stock, new_stock, notes, created_at)
                             VALUES (?, ?, 'IN', ?, 0, ?, 'Stock Inicial', NOW())";
                 $moveStmt = $this->conn->prepare($moveSql);
                 $moveStmt->execute([$productId, $warehouseId, $stockQuantity, $stockQuantity]);
            }

            $this->conn->commit();

            // Sync with WooCommerce
            $wooService = new WooCommerceService();
            $wooResult = null;
            
            if ($wooService->isEnabled()) {
                $wooResult = $wooService->createProduct($data);
                
                if ($wooResult['success']) {
                    // Try to update woocommerce_id if the column exists
                    // We wrap this in try-catch to avoid breaking the whole transaction if column is missing
                    try {
                        $wooId = $wooResult['data']['id'];
                        $updateSql = "UPDATE products SET woocommerce_id = ? WHERE id = ?";
                        $updateStmt = $this->conn->prepare($updateSql);
                        $updateStmt->execute([$wooId, $productId]);
                    } catch (\Exception $e) {
                        // Column might be missing, log or ignore
                    }
                }
            }
            
            Response::json([
                'success' => true, 
                'message' => 'Producto creado correctamente',
                'product_id' => $productId,
                'woocommerce_sync' => $wooResult
            ], 201);

        } catch (\Exception $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            Response::error($e->getMessage());
        }
    }

    public function show($id)
    {
        try {
            $sql = "SELECT p.*, c.name as category_name, 
                           COALESCE(p.stock_quantity, 0) as stock,
                           COALESCE(p.stock_quantity, 0) as total_stock
                    FROM products p 
                    LEFT JOIN categories c ON p.category_id = c.id 
                    WHERE p.id = ? AND p.active = 1";
            
            $stmt = $this->conn->prepare($sql);
            $stmt->execute([$id]);
            $product = $stmt->fetch(\PDO::FETCH_ASSOC);
            
            if (!$product) {
                Response::error("Producto no encontrado", 404);
                return;
            }

            // Fix image URLs
            if (!empty($product['image_url'])) {
                $appUrl = $_ENV['APP_URL'] ?? '';
                $appUrl = rtrim($appUrl, '/');

                $product['image_url'] = preg_replace('/^http:\/\/localhost:\d+\/api\/public\//', '/public/', $product['image_url']);
                $product['image_url'] = preg_replace('/^http:\/\/localhost:\d+\/public\//', '/public/', $product['image_url']);
                
                if (strpos($product['image_url'], 'uploads/') === 0) {
                    $product['image_url'] = '/public/' . $product['image_url'];
                }

                if (strpos($product['image_url'], '/public/uploads/') !== false) {
                    $product['image_url'] = substr($product['image_url'], strpos($product['image_url'], '/public/uploads/'));
                }

                if (!empty($appUrl) && strpos($product['image_url'], '/public/') === 0) {
                    $product['image_url'] = $appUrl . $product['image_url'];
                }
            }

            Response::json($product);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    public function index()
    {
        try {
            $search = $_GET['search'] ?? '';
            $category_id = $_GET['category_id'] ?? null;
            
            $sql = "SELECT p.*, c.name as category_name, 
                           COALESCE(p.stock_quantity, 0) as stock,
                           COALESCE(p.stock_quantity, 0) as total_stock
                    FROM products p 
                    LEFT JOIN categories c ON p.category_id = c.id 
                    WHERE p.active = 1";
            
            $params = [];
            
            if (!empty($search)) {
                $sql .= " AND (p.name LIKE ? OR p.sku LIKE ?)";
                $params[] = "%$search%";
                $params[] = "%$search%";
            }
            
            if (!empty($category_id)) {
                $sql .= " AND p.category_id = ?";
                $params[] = $category_id;
            }
            
            $sql .= " ORDER BY p.created_at DESC, p.id DESC LIMIT 50";
            
            $stmt = $this->conn->prepare($sql);
            $stmt->execute($params);
            $products = $stmt->fetchAll(\PDO::FETCH_ASSOC);
            
            // Fix image URLs for frontend compatibility
            $appUrl = $_ENV['APP_URL'] ?? '';
            // Remove trailing slash if present
            $appUrl = rtrim($appUrl, '/');

            foreach ($products as &$product) {
                if (!empty($product['image_url'])) {
                    // Remove localhost with port if present (legacy dev env)
                    $product['image_url'] = preg_replace('/^http:\/\/localhost:\d+\/api\/public\//', '/public/', $product['image_url']);
                    $product['image_url'] = preg_replace('/^http:\/\/localhost:\d+\/public\//', '/public/', $product['image_url']);
                    
                    // Ensure it starts with /public if it is a relative upload path
                    if (strpos($product['image_url'], 'uploads/') === 0) {
                        $product['image_url'] = '/public/' . $product['image_url'];
                    }

                    // Fallback for any other absolute URL that points to this server's uploads
                    if (strpos($product['image_url'], '/public/uploads/') !== false) {
                        // Extract everything from /public/ onwards
                        $product['image_url'] = substr($product['image_url'], strpos($product['image_url'], '/public/uploads/'));
                    }

                    // Prepend APP_URL if set and URL starts with /public/
                    if (!empty($appUrl) && strpos($product['image_url'], '/public/') === 0) {
                        $product['image_url'] = $appUrl . $product['image_url'];
                    }
                }
            }
            
            Response::json($products);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    public function exportWooCommerce()
    {
        set_time_limit(0); // Prevent timeout
        try {
            $wooService = new WooCommerceService();
            $result = $wooService->fetchAllProductsFromApi();

            if (!$result['success']) {
                Response::error($result['message'] ?? 'Error fetching products', 500);
                return;
            }

            $products = $result['data'];

            // Output CSV
            header('Content-Type: text/csv; charset=utf-8');
            header('Content-Disposition: attachment; filename="woocommerce_products.csv"');

            $output = fopen('php://output', 'w');
            
            // BOM for Excel
            fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));

            // Headers
            fputcsv($output, ['ID', 'Nombre', 'SKU', 'Precio', 'Stock', 'Categoría', 'Estado']);

            foreach ($products as $p) {
                $category = !empty($p['categories']) ? $p['categories'][0]['name'] : '';
                fputcsv($output, [
                    $p['id'],
                    $p['name'],
                    $p['sku'],
                    $p['price'],
                    $p['stock_quantity'] ?? 0,
                    $category,
                    $p['status']
                ]);
            }

            fclose($output);
            exit;

        } catch (\Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function sync()
    {
        try {
            $wooService = new WooCommerceService();
            $result = $wooService->syncProducts();
            
            if ($result['success']) {
                Response::json($result);
            } else {
                Response::error($result['message'], 500);
            }
        } catch (\Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }
}
