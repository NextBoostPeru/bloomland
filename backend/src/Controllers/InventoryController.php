<?php
namespace App\Controllers;

use App\Config\Database;
use App\Utils\Response;
use App\Services\WooCommerceService;
use PDO;

class InventoryController
{
    private $conn;
    private function logInv($msg) {
        $dir = __DIR__ . '/../../logs';
        if (!is_dir($dir)) { @mkdir($dir, 0777, true); }
        @file_put_contents($dir . '/inventory.log', date('Y-m-d H:i:s') . " - " . $msg . "\n", FILE_APPEND);
    }

    public function __construct()
    {
        $db = new Database();
        $this->conn = $db->connect();
    }

    // List all products with their total stock and breakdown by warehouse
    public function index()
    {
        try {
            $search = $_GET['search'] ?? '';
            $warehouse_id = $_GET['warehouse_id'] ?? null;
            $category_id = $_GET['category_id'] ?? null;
            $brand_id = $_GET['brand_id'] ?? null;
            
            // Pagination
            $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
            if ($page < 1) $page = 1;
            if ($limit < 1) $limit = 20;
            $offset = ($page - 1) * $limit;

            $params = [];
            $whereClauses = ["p.active = 1"];
            
            // Common aliases for frontend compatibility
            $aliases = "p.price_pen as price, p.cost_price as cost, p.min_stock_alert as min_stock";
            
            // Base joins
            $joins = "LEFT JOIN categories c ON p.category_id = c.id 
                      LEFT JOIN brands b ON p.brand_id = b.id";

            if (!empty($warehouse_id)) {
                // Specific Warehouse View
                $selects = "p.*, c.name as category_name, b.name as brand_name, $aliases,
                            COALESCE(ps.quantity, 0) as stock_in_warehouse,
                            COALESCE(p.stock_quantity, 0) as total_stock,
                            COALESCE(p.stock_quantity, 0) as stock,
                            (SELECT COUNT(*) FROM product_variations pv WHERE pv.product_id = p.id) as variations_count";
                
                $joins .= " LEFT JOIN product_stocks ps ON p.id = ps.product_id AND ps.warehouse_id = ?";
                $params[] = $warehouse_id;
            } else {
                // Global View
                $selects = "p.*, c.name as category_name, b.name as brand_name, $aliases,
                            COALESCE(p.stock_quantity, 0) as total_stock,
                            COALESCE(p.stock_quantity, 0) as stock,
                            (SELECT COUNT(*) FROM product_variations pv WHERE pv.product_id = p.id) as variations_count";
            }
            
            // Filters
            if (!empty($search)) {
                $whereClauses[] = "(p.name LIKE ? OR p.sku LIKE ?)";
                $params[] = "%$search%";
                $params[] = "%$search%";
            }
            
            if (!empty($category_id)) {
                $whereClauses[] = "p.category_id = ?";
                $params[] = $category_id;
            }

            if (!empty($brand_id)) {
                $whereClauses[] = "p.brand_id = ?";
                $params[] = $brand_id;
            }

            $whereSql = implode(" AND ", $whereClauses);

            // Count Total Query - Optimized (No Joins needed for current filters)
            // Filters only use columns from 'products' table (p.category_id, p.brand_id, p.name, p.sku)
            $countSql = "SELECT COUNT(*) FROM products p WHERE $whereSql";
            
            // For count query, we need to replicate params because we use them twice (count + select)
            // But wait, $params contains values for placeholders.
            // If we run count query, we need to pass the same params.
            $stmtCount = $this->conn->prepare($countSql);
            $stmtCount->execute($params);
            $totalRecords = $stmtCount->fetchColumn();
            $totalPages = ceil($totalRecords / $limit);

            // Main Query
            $sql = "SELECT $selects 
                    FROM products p 
                    $joins 
                    WHERE $whereSql 
                    ORDER BY p.created_at DESC, p.id DESC 
                    LIMIT $limit OFFSET $offset";
            
            $stmt = $this->conn->prepare($sql);
            $stmt->execute($params);
            $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Optimization: Fetch stock details in batch to avoid N+1
            if (empty($warehouse_id) && !empty($products)) {
                $productIds = array_column($products, 'id');
                $placeholders = implode(',', array_fill(0, count($productIds), '?'));
                
                $sqlStocks = "SELECT ps.product_id, w.name, ps.quantity 
                              FROM product_stocks ps 
                              JOIN warehouses w ON ps.warehouse_id = w.id 
                              WHERE ps.product_id IN ($placeholders) AND w.active = 1";
                
                $stmtStocks = $this->conn->prepare($sqlStocks);
                $stmtStocks->execute($productIds);
                $allStocks = $stmtStocks->fetchAll(PDO::FETCH_GROUP | PDO::FETCH_ASSOC); // Groups by first column (product_id)
                
                // Map back to products
                foreach ($products as &$product) {
                    $product['stock_details'] = $allStocks[$product['id']] ?? [];
                }
            }
            
            // Fix image URLs for frontend compatibility
            $appUrl = $_ENV['APP_URL'] ?? '';
            $appUrl = rtrim($appUrl, '/');

            foreach ($products as &$product) {
                if (!empty($product['image_url'])) {
                    $product['image_url'] = preg_replace('/^http:\/\/localhost:\d+\/api\/public\//', '/public/', $product['image_url']);
                    $product['image_url'] = preg_replace('/^http:\/\/localhost:\d+\/public\//', '/public/', $product['image_url']);
                    
                    if (strpos($product['image_url'], 'uploads/') === 0) {
                        $product['image_url'] = '/public/' . $product['image_url'];
                    }
                    
                    if (strpos($product['image_url'], '/public/uploads/') !== false) {
                        $product['image_url'] = substr($product['image_url'], strpos($product['image_url'], '/public/uploads/'));
                    }

                    // Prepend APP_URL if set and URL starts with /public/
                    if (!empty($appUrl) && strpos($product['image_url'], '/public/') === 0) {
                        $product['image_url'] = $appUrl . $product['image_url'];
                    }
                }
            }
            
            Response::json([
                'data' => $products,
                'meta' => [
                    'current_page' => $page,
                    'last_page' => $totalPages,
                    'total_records' => $totalRecords,
                    'limit' => $limit
                ]
            ]);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    // Get Movement History
    public function movements()
    {
        try {
            $product_id = $_GET['product_id'] ?? null;
            $warehouse_id = $_GET['warehouse_id'] ?? null;
            $limit = $_GET['limit'] ?? 50;
            
            $sql = "SELECT m.*, p.name as product_name, w.name as warehouse_name, u.email as user_email
                    FROM inventory_movements m
                    JOIN products p ON m.product_id = p.id
                    JOIN warehouses w ON m.warehouse_id = w.id
                    LEFT JOIN users u ON m.user_id = u.id
                    WHERE 1=1";
            
            $params = [];
            
            if ($product_id) {
                $sql .= " AND m.product_id = ?";
                $params[] = $product_id;
            }
            
            if ($warehouse_id) {
                $sql .= " AND m.warehouse_id = ?";
                $params[] = $warehouse_id;
            }
            
            $sql .= " ORDER BY m.created_at DESC LIMIT " . (int)$limit;
            
            $stmt = $this->conn->prepare($sql);
            $stmt->execute($params);
            Response::json($stmt->fetchAll(PDO::FETCH_ASSOC));
            
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    // Adjust Stock (In/Out/Adjustment)
    public function adjust()
    {
        try {
            $data = json_decode(file_get_contents("php://input"), true);
            
            $product_id = $data['product_id'];
            $warehouse_id = $data['warehouse_id'];
            $type = $data['type']; // IN, OUT, ADJUSTMENT
            $quantity = (int)$data['quantity'];
            $notes = $data['notes'] ?? '';
            $user_id = $data['user_id'] ?? 1; // Should come from Auth
            
            if ($quantity <= 0) Response::error("La cantidad debe ser mayor a 0");
            
            $this->conn->beginTransaction();
            
            // Get current stock
            $stmt = $this->conn->prepare("SELECT quantity FROM product_stocks WHERE product_id = ? AND warehouse_id = ? FOR UPDATE");
            $stmt->execute([$product_id, $warehouse_id]);
            $current = $stmt->fetch(PDO::FETCH_ASSOC);
            $currentStock = $current ? (int)$current['quantity'] : 0;
            
            $newStock = $currentStock;
            
            if ($type === 'IN') {
                $newStock += $quantity;
            } elseif ($type === 'OUT') {
                if ($currentStock < $quantity) {
                    throw new \Exception("Stock insuficiente en esta sede");
                }
                $newStock -= $quantity;
            } elseif ($type === 'ADJUSTMENT') {
                $newStock = $quantity;
            }
            
            // Update/Insert Stock
            if ($current) {
                $stmt = $this->conn->prepare("UPDATE product_stocks SET quantity = ?, updated_at = NOW() WHERE product_id = ? AND warehouse_id = ?");
                $stmt->execute([$newStock, $product_id, $warehouse_id]);
            } else {
                $stmt = $this->conn->prepare("INSERT INTO product_stocks (product_id, warehouse_id, quantity) VALUES (?, ?, ?)");
                $stmt->execute([$product_id, $warehouse_id, $newStock]);
            }
            
            // Record Movement
            $stmt = $this->conn->prepare("INSERT INTO inventory_movements (product_id, warehouse_id, user_id, type, quantity, previous_stock, new_stock, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$product_id, $warehouse_id, $user_id, $type, $quantity, $currentStock, $newStock, $notes]);
            
            // Update Total Product Stock
            $stmt = $this->conn->prepare("UPDATE products SET stock_quantity = (SELECT SUM(quantity) FROM product_stocks WHERE product_id = ?) WHERE id = ?");
            $stmt->execute([$product_id, $product_id]);
            
            $this->conn->commit();
            
            // Sync Stock to Woo
            $stmt = $this->conn->prepare("SELECT woocommerce_id FROM products WHERE id = ?");
            $stmt->execute([$product_id]);
            $wooId = $stmt->fetchColumn();
            
            if ($wooId) {
                try {
                    $wooService = new WooCommerceService();
                    $result = $wooService->updateProductStock($wooId, $newStock);
                    if (!$result['success']) {
                         error_log("Woo Stock Sync Failed: " . ($result['message'] ?? 'Unknown error'));
                    }
                } catch (\Exception $e) {
                    error_log("Woo Stock Sync Error: " . $e->getMessage());
                }
            }
            
            Response::json(['message' => 'Stock actualizado correctamente']);
            
        } catch (\Exception $e) {
            if ($this->conn->inTransaction()) $this->conn->rollBack();
            Response::error($e->getMessage());
        }
    }

    // Get Variations
    public function getVariations($productId)
    {
        try {
            $stmt = $this->conn->prepare("SELECT * FROM product_variations WHERE product_id = ? ORDER BY id ASC");
            $stmt->execute([$productId]);
            $variations = $stmt->fetchAll(PDO::FETCH_ASSOC);
            Response::json($variations);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    public function getVariation($id)
    {
        try {
            $stmt = $this->conn->prepare("
                SELECT 
                    v.id,
                    v.product_id,
                    v.sku,
                    v.size,
                    v.color,
                    v.detail,
                    v.price,
                    v.stock,
                    p.name AS product_name
                FROM product_variations v
                INNER JOIN products p ON p.id = v.product_id
                WHERE v.id = ?
                LIMIT 1
            ");
            $stmt->execute([$id]);
            $variation = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$variation) {
                Response::error('Variación no encontrada', 404);
            }
            Response::json(['success' => true, 'data' => $variation]);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    // Add Variation
    public function addVariation($productId)
    {
        try {
            $data = json_decode(file_get_contents("php://input"), true);
            
            $size = $data['size'] ?? '';
            $price = isset($data['price']) ? (float)$data['price'] : null;
            $color = $data['color'] ?? '';
            $detail = $data['detail'] ?? '';
            $stock = (int)($data['stock'] ?? 0);
            
            if (empty($size) && empty($color) && empty($detail)) {
                Response::error("Debe especificar al menos Talla, Color o Diseño");
            }
            
            // Generate SKU
            $stmt = $this->conn->prepare("SELECT sku FROM products WHERE id = ?");
            $stmt->execute([$productId]);
            $product = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$product) Response::error("Producto no encontrado", 404);
            
            $skuSuffix = strtoupper(substr($size, 0, 3) . substr($color, 0, 3) . substr($detail, 0, 3));
            if (empty($skuSuffix)) $skuSuffix = rand(100, 999);
            $sku = $product['sku'] . '-' . $skuSuffix . '-' . rand(10, 99);
            
            $stmt = $this->conn->prepare("INSERT INTO product_variations (product_id, size, color, detail, price, stock, sku) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$productId, $size, $color, $detail, $price, $stock, $sku]);
            
            // Record Movement if stock > 0
            if ($stock > 0) {
                $notes = "Variación Creada: $sku " . trim("$size $color $detail");
                $this->recordVariationMovement($productId, 'IN', $stock, 0, $stock, $notes);
            }

            // Update Total Stock
            $this->updateTotalStock($productId);
            
            // Sync with Woo
            $this->syncProductToWoo($productId);
            
            Response::json(['message' => 'Variación agregada', 'id' => $this->conn->lastInsertId()]);
            
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    // Update Variation
    public function updateVariation($id)
    {
        try {
            $data = json_decode(file_get_contents("php://input"), true);
            
            // Get old data first
            $stmt = $this->conn->prepare("SELECT * FROM product_variations WHERE id = ?");
            $stmt->execute([$id]);
            $oldVar = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$oldVar) Response::error("Variación no encontrada", 404);

            $size = $data['size'] ?? '';
            $price = array_key_exists('price', $data) ? (float)$data['price'] : null;
            $color = $data['color'] ?? '';
            $detail = $data['detail'] ?? '';
            $stock = isset($data['stock']) ? (int)$data['stock'] : null;
            
            $setClauses = [];
            $params = [];
            
            if ($size !== '') { $setClauses[] = "size = ?"; $params[] = $size; }
            if ($price !== null) { $setClauses[] = "price = ?"; $params[] = $price; }
            if ($color !== '') { $setClauses[] = "color = ?"; $params[] = $color; }
            if ($detail !== '') { $setClauses[] = "detail = ?"; $params[] = $detail; }
            if ($stock !== null) { $setClauses[] = "stock = ?"; $params[] = $stock; }
            
            if (empty($setClauses)) Response::error("No hay datos para actualizar");
            
            $params[] = $id;
            
            $stmt = $this->conn->prepare("UPDATE product_variations SET " . implode(", ", $setClauses) . " WHERE id = ?");
            $stmt->execute($params);
            
            // Record Movement if stock changed
            if ($stock !== null && $oldVar['stock'] != $stock) {
                $diff = $stock - $oldVar['stock'];
                $type = $diff > 0 ? 'IN' : 'OUT';
                $notes = "Ajuste Variación: " . $oldVar['sku'];
                $this->recordVariationMovement($oldVar['product_id'], $type, abs($diff), $oldVar['stock'], $stock, $notes);
            }

            // Get product_id
            $productId = $oldVar['product_id'];
            
            if ($productId) {
                $this->updateTotalStock($productId);
                $this->syncProductToWoo($productId);
            }
            
            Response::json(['message' => 'Variación actualizada']);
            
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    // Delete Variation
    public function deleteVariation($id)
    {
        try {
            // Get product_id before delete
            $stmt = $this->conn->prepare("SELECT * FROM product_variations WHERE id = ?");
            $stmt->execute([$id]);
            $var = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$var) Response::error("Variación no encontrada", 404);
            
            $stmt = $this->conn->prepare("DELETE FROM product_variations WHERE id = ?");
            $stmt->execute([$id]);
            
            // Record Movement if stock > 0
            if ($var['stock'] > 0) {
                $notes = "Eliminación Variación: " . $var['sku'];
                $this->recordVariationMovement($var['product_id'], 'OUT', $var['stock'], $var['stock'], 0, $notes);
            }

            $this->updateTotalStock($var['product_id']);
            $this->syncProductToWoo($var['product_id']);
            
            Response::json(['message' => 'Variación eliminada']);
            
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    private function recordVariationMovement($productId, $type, $quantity, $previousStock, $newStock, $notes, $userId = 1)
    {
        try {
            // Default warehouse = 1
            $warehouseId = 1; 
            
            $stmt = $this->conn->prepare("INSERT INTO inventory_movements (product_id, warehouse_id, user_id, type, quantity, previous_stock, new_stock, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$productId, $warehouseId, $userId, $type, $quantity, $previousStock, $newStock, $notes]);
        } catch (\Exception $e) {
            error_log("Error recording movement: " . $e->getMessage());
        }
    }

    private function updateTotalStock($productId)
    {
        $stmt = $this->conn->prepare("UPDATE products SET stock_quantity = (SELECT COALESCE(SUM(stock), 0) FROM product_variations WHERE product_id = ?) WHERE id = ?");
        $stmt->execute([$productId, $productId]);
    }

    private function syncProductToWoo($productId, $extraData = [])
    {
        try {
            // Fetch fresh product data
            $stmt = $this->conn->prepare("SELECT * FROM products WHERE id = ?");
            $stmt->execute([$productId]);
            $product = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$product) return;
            
            // Fetch variations
            $stmt = $this->conn->prepare("SELECT * FROM product_variations WHERE product_id = ?");
            $stmt->execute([$productId]);
            $variations = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Construct Data for Woo Service
            $data = $product;
            $data['variations'] = $variations;
            $data['type'] = count($variations) > 0 ? 'variable' : 'simple';
            
            // Merge extra data (like local_image_path)
            if (!empty($extraData)) {
                $data = array_merge($data, $extraData);
            }
            
            // Sync
            $wooService = new WooCommerceService();
            $res = $wooService->syncProduct($data);
            // Log woo sync result for debugging
            $dir = __DIR__ . '/../../logs';
            if (!is_dir($dir)) { @mkdir($dir, 0777, true); }
            $msg = date('Y-m-d H:i:s') . " - Sync product_id={$productId} sku={$product['sku']} success=" . (($res['success'] ?? false) ? 'YES' : 'NO') . " msg=" . ($res['message'] ?? '') . "\n";
            if (isset($data['local_image_path'])) {
                $msg .= " with local_image_path=" . $data['local_image_path'] . "\n";
            }
            @file_put_contents($dir . '/woo_sync.log', $msg, FILE_APPEND);
            
            if (($res['success'] ?? false) && isset($res['data'])) {
                $wcData = $res['data'];
                $newUrl = null;
                if (!empty($wcData['images']) && isset($wcData['images'][0]['src'])) {
                    $newUrl = $wcData['images'][0]['src'];
                }
                $newWooId = $wcData['id'] ?? null;
                $setParts = [];
                $values = [];
                if (!empty($newUrl)) {
                    $setParts[] = "image_url = ?";
                    $values[] = $newUrl;
                }
                if (!empty($newWooId) && empty($product['woocommerce_id'])) {
                    $setParts[] = "woocommerce_id = ?";
                    $values[] = $newWooId;
                }
                if (!empty($setParts)) {
                    $values[] = $productId;
                    $sql = "UPDATE products SET " . implode(', ', $setParts) . " WHERE id = ?";
                    $up = $this->conn->prepare($sql);
                    $up->execute($values);
                }
            }
            return $res ?? ['success' => false, 'message' => 'No response from Woo sync'];
            
        } catch (\Exception $e) {
            // Log error silently or to file
            error_log("Woo Sync Error: " . $e->getMessage());
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Woo attribute terms (e.g., talla, color) for UI selects
    public function getWooAttributeTerms($slug)
    {
        try {
            $woo = new WooCommerceService();
            if (!$woo->isEnabled()) {
                Response::json(['success' => false, 'data' => []]);
                return;
            }
            $attrId = $woo->getAttributeIdBySlugOrName($slug);
            if (!$attrId) {
                Response::json(['success' => true, 'data' => []]);
                return;
            }
            $res = $woo->getAttributeTerms($attrId);
            if (!$res['success']) {
                Response::json(['success' => false, 'data' => [], 'message' => $res['message'] ?? 'Error']);
                return;
            }
            $terms = array_map(function ($t) {
                return [
                    'id' => $t['id'],
                    'name' => $t['name'],
                    'slug' => $t['slug']
                ];
            }, $res['data'] ?? []);
            Response::json(['success' => true, 'data' => $terms]);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    public function createWooAttributeTerm($slug)
    {
        try {
            $woo = new WooCommerceService();
            if (!$woo->isEnabled()) {
                Response::error('Integración con WooCommerce no configurada');
            }
            $raw = file_get_contents('php://input');
            $data = json_decode($raw, true);
            if (!is_array($data) || empty($data)) {
                $data = $_POST;
            }
            $name = trim($data['name'] ?? '');
            $termSlug = isset($data['slug']) ? trim($data['slug']) : null;
            if ($name === '') {
                Response::error('El nombre es obligatorio');
            }
            $attrId = $woo->getAttributeIdBySlugOrName($slug);
            if (!$attrId) {
                Response::error('Atributo no encontrado en WooCommerce');
            }
            $res = $woo->createAttributeTerm($attrId, $name, $termSlug);
            if (!$res['success']) {
                Response::error($res['message'] ?? 'Error al crear término');
            }
            $t = $res['data'] ?? [];
            $term = [
                'id' => $t['id'] ?? null,
                'name' => $t['name'] ?? $name,
                'slug' => $t['slug'] ?? $termSlug
            ];
            Response::json(['success' => true, 'data' => $term]);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    public function updateWooAttributeTerm($slug, $id)
    {
        try {
            $woo = new WooCommerceService();
            if (!$woo->isEnabled()) {
                Response::error('Integración con WooCommerce no configurada');
            }
            $raw = file_get_contents('php://input');
            $data = json_decode($raw, true);
            if (!is_array($data) || empty($data)) {
                $data = $_POST;
            }
            $payload = [];
            if (isset($data['name'])) {
                $name = trim($data['name']);
                if ($name === '') {
                    Response::error('El nombre no puede estar vacío');
                }
                $payload['name'] = $name;
            }
            if (isset($data['slug'])) {
                $payload['slug'] = trim($data['slug']);
            }
            if (empty($payload)) {
                Response::error('No hay datos para actualizar');
            }
            $attrId = $woo->getAttributeIdBySlugOrName($slug);
            if (!$attrId) {
                Response::error('Atributo no encontrado en WooCommerce');
            }
            $res = $woo->updateAttributeTerm($attrId, $id, $payload);
            if (!$res['success']) {
                Response::error($res['message'] ?? 'Error al actualizar término');
            }
            $t = $res['data'] ?? [];
            $term = [
                'id' => $t['id'] ?? $id,
                'name' => $t['name'] ?? ($payload['name'] ?? ''),
                'slug' => $t['slug'] ?? ($payload['slug'] ?? null)
            ];
            Response::json(['success' => true, 'data' => $term]);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    public function deleteWooAttributeTerm($slug, $id)
    {
        try {
            $woo = new WooCommerceService();
            if (!$woo->isEnabled()) {
                Response::error('Integración con WooCommerce no configurada');
            }
            $attrId = $woo->getAttributeIdBySlugOrName($slug);
            if (!$attrId) {
                Response::error('Atributo no encontrado en WooCommerce');
            }
            $res = $woo->deleteAttributeTerm($attrId, $id);
            if (!$res['success']) {
                Response::error($res['message'] ?? 'Error al eliminar término');
            }
            Response::json(['success' => true]);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }
    
    // Create Product (Full CRUD)
    public function createProduct()
    {
         try {
            $data = [];
            
            // Check content type to determine if JSON or Multipart
            $contentType = $_SERVER["CONTENT_TYPE"] ?? '';
            
            if (strpos($contentType, 'application/json') !== false) {
                $data = json_decode(file_get_contents("php://input"), true);
            } else {
                // Assume Multipart/Form-Data
                $data = $_POST;
            }

            // Validation...
            if (empty($data['name']) || empty($data['price'])) {
                Response::error("Nombre y Precio son obligatorios");
            }
            
            // Handle Image Upload
            $imageUrl = $data['image_url'] ?? '';
            if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
                $uploadDir = __DIR__ . '/../../public/uploads/products/';
                if (!is_dir($uploadDir)) {
                    mkdir($uploadDir, 0777, true);
                }
                
                $extension = pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION);
                $filename = uniqid('prod_') . '.' . $extension;
                $targetFile = $uploadDir . $filename;
                
                if (move_uploaded_file($_FILES['image']['tmp_name'], $targetFile)) {
                    // Generate Public URL (Adjust base URL as needed)
                    // Assuming API is at /api/ and public is accessible
                    // We'll store the relative path for now or absolute if we know the domain.
                    // Ideally, store relative 'uploads/products/...' and prepend domain in frontend/serializer.
                    // But for WooCommerce sync, we need a full URL. 
                    // Let's try to construct it.
                    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http";
                    $host = $_SERVER['HTTP_HOST'];
                    // Naive construction, assuming standard folder structure
                    $scriptDir = dirname($_SERVER['SCRIPT_NAME']); // /api or /
                    // If we are in /api/index.php, scriptDir is /api
                    // We want /api/public/uploads...
                    // Wait, public is usually the root.
                    // Let's assume standard structure: d:\Escritorio\babyland\api\public is the web root for API?
                    // Or d:\Escritorio\babyland\api is the root?
                    // Let's use a safe relative path for DB, and full URL for Woo.
                    
                    // DB: uploads/products/filename.jpg
                    $relativePath = 'uploads/products/' . $filename;
                    $imageUrl = $protocol . "://" . $host . "/api/public/" . $relativePath;
                    
                    // Add local file path for Woo upload
                    $data['local_image_path'] = $targetFile;
                    
                    // If running on built-in server or special config, this might vary.
                    // Let's just save the full URL constructed best-effort.
                }
            }
            
            // Check for duplicate SKU
            $checkStmt = $this->conn->prepare("SELECT id FROM products WHERE sku = ?");
            $checkStmt->execute([$data['sku']]);
            if ($checkStmt->fetch()) {
                Response::error("El SKU '{$data['sku']}' ya existe. Por favor use otro SKU.", 409);
            }

            $this->conn->beginTransaction();
            
            $pricePen = (isset($data['price']) && $data['price'] !== '' && is_numeric($data['price'])) ? (float)$data['price'] : 0.00;
            $costPrice = (isset($data['cost']) && $data['cost'] !== '' && is_numeric($data['cost'])) ? (float)$data['cost'] : null;
            $minStock = (isset($data['min_stock']) && $data['min_stock'] !== '' && is_numeric($data['min_stock'])) ? (int)$data['min_stock'] : 5;

            $stmt = $this->conn->prepare("INSERT INTO products 
                (name, sku, category_id, brand_id, price_pen, cost_price, description, min_stock_alert, image_url, 
                size, color, material, collection, gender, pattern, sleeve, line, active) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)");
            $stmt->execute([
                $data['name'], 
                $data['sku'], 
                !empty($data['category_id']) ? $data['category_id'] : null, 
                !empty($data['brand_id']) ? $data['brand_id'] : null,
                $pricePen, 
                $costPrice,
                $data['description'] ?? '', 
                $minStock,
                $imageUrl,
                $data['size'] ?? null,
                $data['color'] ?? null,
                $data['material'] ?? null,
                $data['collection'] ?? null,
                $data['gender'] ?? null,
                $data['pattern'] ?? null,
                $data['sleeve'] ?? null,
                $data['line'] ?? null
            ]);
            $productId = $this->conn->lastInsertId();
            $this->logInv("createProduct OK id={$productId} sku={$data['sku']} price={$pricePen} cost=" . ($costPrice === null ? 'NULL' : $costPrice));
            $productId = $this->conn->lastInsertId();

            $galleryUrls = [];
            $galleryLocalPaths = [];
            if (isset($_FILES['gallery']) && is_array($_FILES['gallery']['name'])) {
                $uploadDir = __DIR__ . '/../../public/uploads/products/';
                $count = count($_FILES['gallery']['name']);
                
                // Limit to 5 images as requested
                $limit = min($count, 5); 
                
                for ($i = 0; $i < $limit; $i++) {
                    if ($_FILES['gallery']['error'][$i] === UPLOAD_ERR_OK) {
                        $extension = pathinfo($_FILES['gallery']['name'][$i], PATHINFO_EXTENSION);
                        $filename = uniqid('prod_gallery_') . '.' . $extension;
                        $targetFile = $uploadDir . $filename;
                        
                        if (move_uploaded_file($_FILES['gallery']['tmp_name'][$i], $targetFile)) {
                            $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http";
                            $host = $_SERVER['HTTP_HOST'];
                            $relativePath = 'uploads/products/' . $filename;
                            $galleryUrl = $protocol . "://" . $host . "/api/public/" . $relativePath;
                            
                            $galleryUrls[] = $galleryUrl;
                            $galleryLocalPaths[] = $targetFile;

                            $stmtImg = $this->conn->prepare("INSERT INTO product_images (product_id, image_url, display_order) VALUES (?, ?, ?)");
                            $stmtImg->execute([$productId, $galleryUrl, $i]);
                        }
                    }
                }
            }
            
            // Init stock in selected warehouse
            $initialStock = (int)($data['initial_stock'] ?? 0);
            $warehouseId = !empty($data['warehouse_id']) ? (int)$data['warehouse_id'] : 1;
            
            // Handle Variations Logic
            $variations = [];
            if (!empty($data['has_variations']) && !empty($data['variations'])) {
                $rawVars = json_decode($data['variations'], true);
                if (is_array($rawVars)) {
                    foreach ($rawVars as $v) {
                        $vSize = $v['size'] ?? null;
                        $vColor = $v['color'] ?? null;
                        $vDetail = $v['detail'] ?? null;
                        $vStock = (int)($v['stock'] ?? 0);
                        
                        // Create Variation SKU
                        $vSku = $data['sku'] . '-' . substr(md5(json_encode($v)), 0, 6);
                        
                        $stmtVar = $this->conn->prepare("INSERT INTO product_variations (product_id, size, color, detail, stock, sku) VALUES (?, ?, ?, ?, ?, ?)");
                        $stmtVar->execute([$productId, $vSize, $vColor, $vDetail, $vStock, $vSku]);
                        
                        // Add stock for variation to warehouse?
                        // Currently product_stocks is per product_id. 
                        // If we have variations, do we track stock per variation ID?
                        // The system seems designed for product_id based stock.
                        // To properly track variation stock, we would need product_stocks to reference variation_id OR product_id.
                        // For now, we will just sum up stock to main product (already done in frontend total calculation)
                        // But for tracking WHICH variation has stock, we rely on product_variations table 'stock' column for now.
                        // Ideally, product_stocks should handle variations too.
                        
                        $variations[] = [
                            'size' => $vSize,
                            'color' => $vColor,
                            'detail' => $vDetail,
                            'stock' => $vStock,
                            'sku' => $vSku
                        ];
                    }
                }
            }

            if ($initialStock > 0) {
                 $stmt = $this->conn->prepare("INSERT INTO product_stocks (product_id, warehouse_id, quantity) VALUES (?, ?, ?)");
                 $stmt->execute([$productId, $warehouseId, $initialStock]);
                 
                 // Log initial
                 $stmt = $this->conn->prepare("INSERT INTO inventory_movements (product_id, warehouse_id, type, quantity, previous_stock, new_stock, notes, user_id) 
                                          VALUES (?, ?, 'IN', ?, 0, ?, 'Stock Inicial', ?)");
                 $stmt->execute([$productId, $warehouseId, $initialStock, $initialStock, 1]); // User 1 default
                 
                 // Update legacy
                 $stmt = $this->conn->prepare("UPDATE products SET stock_quantity = ? WHERE id = ?");
                 $stmt->execute([$initialStock, $productId]);
            }
            
            $this->conn->commit();

            // Sync with WooCommerce (Moved outside transaction to avoid lock timeout)
            $wooService = new WooCommerceService();
            $wooResult = null;
            
            if ($wooService->isEnabled()) {
                // Prepare data for Woo
                $wooData = $data;
                $wooData['stock'] = $data['initial_stock'] ?? 0;
                $wooData['image_url'] = $imageUrl; // Pass the image URL
                $wooData['gallery_images'] = $galleryUrls;
                if (!empty($galleryLocalPaths)) {
                    $wooData['gallery_local_paths'] = $galleryLocalPaths;
                }
                $wooData['min_stock'] = $data['min_stock'] ?? 0;
                
                // Pass variations to WooService
                if (!empty($variations)) {
                    $wooData['type'] = 'variable';
                    $wooData['variations'] = $variations;
                } else {
                    $wooData['type'] = 'simple';
                }
                
                $wooResult = $wooService->createProduct($wooData);
                
                // Log result for debugging
                $logEntry = date('Y-m-d H:i:s') . " - SKU: {$data['sku']} - Success: " . ($wooResult['success'] ? 'YES' : 'NO') . " - Msg: " . ($wooResult['message'] ?? '') . "\n";
                if (!$wooResult['success']) {
                    $logEntry .= "Error Data: " . json_encode($wooResult) . "\n";
                }
                file_put_contents(__DIR__ . '/../../logs/woo_sync.log', $logEntry, FILE_APPEND);

                if ($wooResult['success']) {
                    try {
                        $wooId = $wooResult['data']['id'];
                        // Update woocommerce_id if column exists
                        $updateStmt = $this->conn->prepare("UPDATE products SET woocommerce_id = ? WHERE id = ?");
                        $updateStmt->execute([$wooId, $productId]);
                    } catch (\Exception $e) {
                        // Ignore if column missing
                    }
                }
            }
            
            Response::json(['success' => true, 'id' => $productId, 'woocommerce_synced' => isset($wooResult) && $wooResult['success']]);
         } catch (\Exception $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            $this->logInv("createProduct ERR sku=" . ($data['sku'] ?? '') . " msg=" . $e->getMessage());
            // Check for Duplicate entry error (redundant but safe)
            if (strpos($e->getMessage(), 'Duplicate entry') !== false && strpos($e->getMessage(), 'sku') !== false) {
                 Response::error("El SKU '{$data['sku']}' ya existe.", 409);
            }
            Response::error($e->getMessage(), 500);
         }
    }

    // Update Product (Full Update)
    public function updateProduct($id)
    {
        try {
            $data = [];
            $contentType = $_SERVER["CONTENT_TYPE"] ?? '';
            
            if (strpos($contentType, 'application/json') !== false) {
                $data = json_decode(file_get_contents("php://input"), true);
            } else {
                $data = $_POST;
            }

            if (empty($data['name']) || empty($data['price'])) {
                Response::error("Nombre y Precio son obligatorios");
            }
            
            // Check if SKU exists for other products
            $checkStmt = $this->conn->prepare("SELECT id FROM products WHERE sku = ? AND id != ?");
            $checkStmt->execute([$data['sku'], $id]);
            if ($checkStmt->fetch()) {
                Response::error("El SKU '{$data['sku']}' ya existe en otro producto.", 409);
            }

            $this->conn->beginTransaction();
            
            // Handle Image Upload
            // Regla:
            // - Si el campo image_url NO viene en el request y no hay archivo => conservar la imagen actual
            // - Si viene image_url='' (vaciar) y no hay archivo => borrar imagen (dejamos '')
            $hasImageUrlKey = array_key_exists('image_url', $data);
            $imageUrl = $hasImageUrlKey ? $data['image_url'] : null; // null => no enviado
            if ($imageUrl === null && (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK)) {
                $stmtCur = $this->conn->prepare("SELECT image_url FROM products WHERE id = ?");
                $stmtCur->execute([$id]);
                $current = $stmtCur->fetch(PDO::FETCH_ASSOC);
                if ($current && array_key_exists('image_url', $current)) {
                    $imageUrl = $current['image_url'];
                }
            }
            if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
                $uploadDir = __DIR__ . '/../../public/uploads/products/';
                if (!is_dir($uploadDir)) mkdir($uploadDir, 0777, true);
                
                $extension = pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION);
                $filename = uniqid('prod_') . '.' . $extension;
                $targetFile = $uploadDir . $filename;
                
                if (move_uploaded_file($_FILES['image']['tmp_name'], $targetFile)) {
                    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http";
                    $host = $_SERVER['HTTP_HOST'];
                    $relativePath = 'uploads/products/' . $filename;
                    $imageUrl = $protocol . "://" . $host . "/api/public/" . $relativePath;
                    $data['local_image_path'] = $targetFile;
                    $this->logInv("updateProduct image uploaded id={$id} path={$targetFile} url={$imageUrl}");
                }
            }

            // Update Product Table
            $pricePenU = (isset($data['price']) && $data['price'] !== '' && is_numeric($data['price'])) ? (float)$data['price'] : 0.00;
            $costPriceU = (isset($data['cost']) && $data['cost'] !== '' && is_numeric($data['cost'])) ? (float)$data['cost'] : null;
            $minStockU = (isset($data['min_stock']) && $data['min_stock'] !== '' && is_numeric($data['min_stock'])) ? (int)$data['min_stock'] : 5;

            $stmt = $this->conn->prepare("UPDATE products SET 
                name = ?, sku = ?, category_id = ?, brand_id = ?, price_pen = ?, cost_price = ?, 
                description = ?, min_stock_alert = ?, image_url = ?, 
                size = ?, color = ?, material = ?, collection = ?, gender = ?, pattern = ?, sleeve = ?, line = ?
                WHERE id = ?");
            
            $stmt->execute([
                $data['name'], 
                $data['sku'], 
                !empty($data['category_id']) ? $data['category_id'] : null, 
                !empty($data['brand_id']) ? $data['brand_id'] : null,
                $pricePenU, 
                $costPriceU,
                $data['description'] ?? '', 
                $minStockU,
                $imageUrl,
                $data['size'] ?? null,
                $data['color'] ?? null,
                $data['material'] ?? null,
                $data['collection'] ?? null,
                $data['gender'] ?? null,
                $data['pattern'] ?? null,
                $data['sleeve'] ?? null,
                $data['line'] ?? null,
                $id
            ]);
            $this->logInv("updateProduct OK id={$id} sku={$data['sku']} price={$pricePenU} cost=" . ($costPriceU === null ? 'NULL' : $costPriceU));

            $galleryUrls = [];
            $galleryLocalPaths = [];
            if (isset($_FILES['gallery']) && is_array($_FILES['gallery']['name'])) {
                $uploadDir = __DIR__ . '/../../public/uploads/products/';
                $count = count($_FILES['gallery']['name']);
                $limit = min($count, 5); 
                
                for ($i = 0; $i < $limit; $i++) {
                    if ($_FILES['gallery']['error'][$i] === UPLOAD_ERR_OK) {
                        $extension = pathinfo($_FILES['gallery']['name'][$i], PATHINFO_EXTENSION);
                        $filename = uniqid('prod_gallery_') . '.' . $extension;
                        $targetFile = $uploadDir . $filename;
                        
                        if (move_uploaded_file($_FILES['gallery']['tmp_name'][$i], $targetFile)) {
                            $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http";
                            $host = $_SERVER['HTTP_HOST'];
                            $relativePath = 'uploads/products/' . $filename;
                            $galleryUrl = $protocol . "://" . $host . "/api/public/" . $relativePath;

                            $galleryUrls[] = $galleryUrl;
                            $galleryLocalPaths[] = $targetFile;
                            $stmtImg = $this->conn->prepare("INSERT INTO product_images (product_id, image_url, display_order) VALUES (?, ?, ?)");
                            $stmtImg->execute([$id, $galleryUrl, $i]);
                        }
                    }
                }
            }
            if (!empty($galleryUrls)) {
                $data['gallery_images'] = $galleryUrls;
            }
            if (!empty($galleryLocalPaths)) {
                $data['gallery_local_paths'] = $galleryLocalPaths;
            }
            // Manejar eliminaciones de imágenes de galería existentes
            if (!empty($_POST['remove_gallery']) && is_array($_POST['remove_gallery'])) {
                $remove = $_POST['remove_gallery'];
                $data['remove_gallery'] = $remove;
                $placeholders = implode(',', array_fill(0, count($remove), '?'));
                $paramsDel = $remove;
                array_unshift($paramsDel, $id);
                $stmtDel = $this->conn->prepare("DELETE FROM product_images WHERE product_id = ? AND image_url IN ($placeholders)");
                $stmtDel->execute($paramsDel);
            }
            
            // Handle Stock Update (Only for Simple Products)
            // Check if product has variations
            $stmt = $this->conn->prepare("SELECT COUNT(*) FROM product_variations WHERE product_id = ?");
            $stmt->execute([$id]);
            $hasVariations = $stmt->fetchColumn() > 0;

            if (!$hasVariations && isset($data['initial_stock'])) {
                // Determine warehouse
                $warehouseId = !empty($data['warehouse_id']) ? (int)$data['warehouse_id'] : 1;
                $newStock = (int)$data['initial_stock'];
                
                // Get current stock in warehouse
                $stmt = $this->conn->prepare("SELECT quantity FROM product_stocks WHERE product_id = ? AND warehouse_id = ? FOR UPDATE");
                $stmt->execute([$id, $warehouseId]);
                $current = $stmt->fetch(PDO::FETCH_ASSOC);
                $currentStock = $current ? (int)$current['quantity'] : 0;
                
                if ($newStock != $currentStock) {
                    $diff = $newStock - $currentStock;
                    $type = $diff > 0 ? 'IN' : 'OUT';
                    $notes = "Ajuste Manual desde Edición";
                    
                    // Update/Insert Stock
                    if ($current) {
                        $stmt = $this->conn->prepare("UPDATE product_stocks SET quantity = ?, updated_at = NOW() WHERE product_id = ? AND warehouse_id = ?");
                        $stmt->execute([$newStock, $id, $warehouseId]);
                    } else {
                        $stmt = $this->conn->prepare("INSERT INTO product_stocks (product_id, warehouse_id, quantity) VALUES (?, ?, ?)");
                        $stmt->execute([$id, $warehouseId, $newStock]);
                    }
                    
                    // Record Movement
                    $stmt = $this->conn->prepare("INSERT INTO inventory_movements (product_id, warehouse_id, type, quantity, previous_stock, new_stock, notes, user_id) 
                                             VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
                    $stmt->execute([$id, $warehouseId, $type, abs($diff), $currentStock, $newStock, $notes, 1]); // User 1 default
                    
                    // Update Total Product Stock
                    $stmt = $this->conn->prepare("UPDATE products SET stock_quantity = (SELECT SUM(quantity) FROM product_stocks WHERE product_id = ?) WHERE id = ?");
                    $stmt->execute([$id, $id]);
                }
            }

            $this->conn->commit();
            
            $wooRes = $this->syncProductToWoo($id, $data);
            
            Response::json(['success' => true, 'message' => 'Producto actualizado', 'woocommerce_synced' => ($wooRes['success'] ?? false), 'woo_message' => $wooRes['message'] ?? null]);
        } catch (\Exception $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            $this->logInv("updateProduct ERR id={$id} sku=" . ($data['sku'] ?? '') . " msg=" . $e->getMessage());
            Response::error($e->getMessage());
        }
    }

    public function refreshFromWoo($id)
    {
        try {
            // Get local product
            $stmt = $this->conn->prepare("SELECT id, sku, image_url, woocommerce_id FROM products WHERE id = ?");
            $stmt->execute([$id]);
            $product = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$product) {
                Response::error("Producto no encontrado", 404);
            }
            // If not linked to Woo, return local data plus gallery
            if (empty($product['woocommerce_id'])) {
                $galleryStmt = $this->conn->prepare("SELECT image_url FROM product_images WHERE product_id = ? ORDER BY display_order ASC, id ASC");
                $galleryStmt->execute([$id]);
                $gallery = array_map(function ($r) { return $r['image_url']; }, $galleryStmt->fetchAll(PDO::FETCH_ASSOC));
                Response::json(['success' => true, 'image_url' => $product['image_url'], 'gallery' => $gallery, 'synced' => false]);
            }
            // Fetch from Woo
            $woo = new WooCommerceService();
            if (!$woo->isEnabled()) {
                Response::error("Integración con WooCommerce no configurada");
            }
            $res = $woo->getProductById($product['woocommerce_id']);
            if (!$res['success']) {
                Response::error($res['message'] ?? 'Error al obtener producto de Woo');
            }
            $wc = $res['data'];
            $newImage = null;
            $gallery = [];
            if (!empty($wc['images'])) {
                $seen = [];
                foreach ($wc['images'] as $idx => $img) {
                    $src = $img['src'] ?? null;
                    if (empty($src)) continue;
                    if ($idx === 0 && $newImage === null) {
                        $newImage = $src;
                        $seen[$src] = true;
                        continue;
                    }
                    // Evitar que la imagen principal entre a la galería y evitar duplicados
                    if ($newImage !== null && $src === $newImage) continue;
                    if (isset($seen[$src])) continue;
                    $gallery[] = $src;
                    $seen[$src] = true;
                }
            }
            // Update local DB (image_url + gallery table)
            $this->conn->beginTransaction();
            $up = $this->conn->prepare("UPDATE products SET image_url = ? WHERE id = ?");
            $up->execute([$newImage ?: '', $id]);
            $del = $this->conn->prepare("DELETE FROM product_images WHERE product_id = ?");
            $del->execute([$id]);
            if (!empty($gallery)) {
                $ins = $this->conn->prepare("INSERT INTO product_images (product_id, image_url, display_order) VALUES (?, ?, ?)");
                foreach ($gallery as $i => $g) {
                    $ins->execute([$id, $g, $i]);
                }
            }
            $this->conn->commit();

            // Fetch and sync variations from Woo (if any)
            $varCount = 0;
            try {
                $varsRes = $woo->getProductVariations($product['woocommerce_id']);
                if (($varsRes['success'] ?? false) && !empty($varsRes['data']) && is_array($varsRes['data'])) {
                    $vars = $varsRes['data'];
                    // Replace local variations with Woo ones (source of truth)
                    $this->conn->beginTransaction();
                    $delV = $this->conn->prepare("DELETE FROM product_variations WHERE product_id = ?");
                    $delV->execute([$id]);
                    $insV = $this->conn->prepare("INSERT INTO product_variations (product_id, size, color, detail, price, stock, sku) VALUES (?, ?, ?, ?, ?, ?, ?)");
                    foreach ($vars as $v) {
                        $size = '';
                        $color = '';
                        $detail = '';
                        if (!empty($v['attributes']) && is_array($v['attributes'])) {
                            foreach ($v['attributes'] as $attr) {
                                $name = strtolower($attr['name'] ?? '');
                                $opt = (string)($attr['option'] ?? '');
                                if ($name === 'talla' || $name === 'size') $size = $opt;
                                elseif ($name === 'color') $color = $opt;
                                elseif ($name === 'detalle' || $name === 'diseño' || $name === 'diseno' || $name === 'design') $detail = $opt;
                            }
                            // Fallback: si no se reconocen nombres, usar primeros atributos
                            if ($size === '' && isset($v['attributes'][0]['option'])) $size = (string)$v['attributes'][0]['option'];
                            if ($color === '' && isset($v['attributes'][1]['option'])) $color = (string)$v['attributes'][1]['option'];
                        }
                        $price = isset($v['regular_price']) && $v['regular_price'] !== '' ? (float)$v['regular_price'] : null;
                        $stock = (int)($v['stock_quantity'] ?? 0);
                        $sku = $v['sku'] ?? '';
                        $insV->execute([$id, $size, $color, $detail, $price, $stock, $sku]);
                        $varCount++;
                    }
                    // Update total stock from variations
                    $this->updateTotalStock($id);
                    $this->conn->commit();
                }
            } catch (\Exception $ve) {
                // silent; keep images sync even if variations fail
            }

            Response::json(['success' => true, 'image_url' => $newImage, 'gallery' => $gallery, 'variations_count' => $varCount, 'synced' => true]);
        } catch (\Exception $e) {
            if ($this->conn->inTransaction()) $this->conn->rollBack();
            Response::error($e->getMessage());
        }
    }

    public function deleteGalleryImage($id)
    {
        try {
            $data = [];
            $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
            if (strpos($contentType, 'application/json') !== false) {
                $data = json_decode(file_get_contents('php://input'), true) ?? [];
            } else {
                $data = $_POST;
            }
            $imageUrl = $data['image_url'] ?? null;
            if (empty($imageUrl)) {
                Response::error('image_url es requerido');
            }

            $stmt = $this->conn->prepare("SELECT id, woocommerce_id FROM products WHERE id = ?");
            $stmt->execute([$id]);
            $product = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$product) {
                Response::error('Producto no encontrado', 404);
            }

            // Borrar de galería local
            $del = $this->conn->prepare("DELETE FROM product_images WHERE product_id = ? AND image_url = ?");
            $del->execute([$id, $imageUrl]);

            // Borrar en Woo (si está vinculado)
            if (!empty($product['woocommerce_id'])) {
                $woo = new WooCommerceService();
                if ($woo->isEnabled()) {
                    $wooRes = $woo->removeGalleryImage($product['woocommerce_id'], $imageUrl);
                    if (!$wooRes['success']) {
                        Response::error($wooRes['message'] ?? 'Error al eliminar imagen en WooCommerce');
                    }
                }
            }

            Response::json(['success' => true]);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }
    // Bulk Import (CSV)
    public function import()
    {
        try {
            if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
                Response::error("Archivo no válido");
            }
            
            $file = $_FILES['file']['tmp_name'];
            $handle = fopen($file, "r");
            if ($handle === false) Response::error("No se puede leer el archivo");
            
            $syncWoo = isset($_GET['sync_woo']) && $_GET['sync_woo'] == '1';
            $createdIds = [];
            $this->conn->beginTransaction();
            
            // Skip header
            fgetcsv($handle);
            
            $imported = 0;
            $skippedExisting = 0;
            $skippedInvalid = 0;
            $totalRows = 0;
            $invalidRows = [];
            
            while (($row = fgetcsv($handle, 1000, ",")) !== FALSE) {
                $totalRows++;
                
                // Si solo viene una columna y contiene ';', reintentar parseando por punto y coma
                if (count($row) === 1 && strpos($row[0], ';') !== false) {
                    $row = str_getcsv($row[0], ';');
                }
                
                if (count($row) < 3) {
                    $skippedInvalid++;
                    $invalidRows[] = [
                        'line' => $totalRows + 1,
                        'reason' => 'columnas_insuficientes',
                        'raw' => $row
                    ];
                    continue;
                }
                
                $name = isset($row[0]) ? trim($row[0]) : '';
                $sku = isset($row[1]) ? trim($row[1]) : '';
                $rawPrice = isset($row[2]) ? trim($row[2]) : '0';
                $price = (float)str_replace(',', '.', $rawPrice);
                $description = isset($row[3]) ? trim($row[3]) : '';
                $categoryId = isset($row[4]) && $row[4] !== '' ? (int)$row[4] : null;
                $stock = isset($row[5]) && $row[5] !== '' ? (int)$row[5] : 0;

                if ($name !== '' && !mb_check_encoding($name, 'UTF-8')) {
                    $name = mb_convert_encoding($name, 'UTF-8', 'ISO-8859-1');
                }
                if ($description !== '' && !mb_check_encoding($description, 'UTF-8')) {
                    $description = mb_convert_encoding($description, 'UTF-8', 'ISO-8859-1');
                }
                
                if ($sku === '' || $name === '') {
                    $skippedInvalid++;
                    $invalidRows[] = [
                        'line' => $totalRows + 1,
                        'reason' => 'name_or_sku_empty',
                        'raw' => $row
                    ];
                    continue;
                }
                
                $stmt = $this->conn->prepare("SELECT id FROM products WHERE sku = ?");
                $stmt->execute([$sku]);
                $exists = $stmt->fetchColumn();
                
                if ($exists) {
                    $skippedExisting++;
                    continue;
                }
                
                $stmt = $this->conn->prepare("INSERT INTO products (name, sku, price_pen, description, category_id) VALUES (?, ?, ?, ?, ?)");
                $stmt->execute([$name, $sku, $price, $description, $categoryId]);
                $productId = $this->conn->lastInsertId();
                
                if ($stock > 0) {
                    $stmt = $this->conn->prepare("INSERT INTO product_stocks (product_id, warehouse_id, quantity) VALUES (?, 1, ?)");
                    $stmt->execute([$productId, $stock]);
                    
                    $stmt = $this->conn->prepare("UPDATE products SET stock_quantity = ? WHERE id = ?");
                    $stmt->execute([$stock, $productId]);
                }
                $createdIds[] = $productId;
                $imported++;
            }
            
            fclose($handle);
            $this->conn->commit();
            
            $synced = 0;
            if ($syncWoo && $imported > 0) {
                foreach ($createdIds as $pid) {
                    try {
                        $wooRes = $this->syncProductToWoo($pid);
                        if ($wooRes && ($wooRes['success'] ?? false)) {
                            $synced++;
                        }
                    } catch (\Exception $e) {
                        // continuar con el siguiente
                    }
                }
            }
            
            Response::json([
                'success' => true,
                'rows' => $totalRows,
                'imported' => $imported,
                'synced' => $synced,
                'skipped_existing' => $skippedExisting,
                'skipped_invalid' => $skippedInvalid,
                'invalid_rows' => $invalidRows
            ]);
            
        } catch (\Exception $e) {
            $this->conn->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    // Export empty CSV template for product import
    public function exportImportTemplate()
    {
        // Simple CSV with header only, UTF-8 BOM for Excel compatibility
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="productos_template.csv"');
        $output = fopen('php://output', 'w');
        fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));
        fputcsv($output, ['Name', 'SKU', 'Price', 'Description', 'CategoryID', 'InitialStock']);
        fclose($output);
        exit;
    }
}
