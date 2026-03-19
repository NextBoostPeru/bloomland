<?php
namespace App\Controllers;

use App\Config\Database;
use App\Utils\Response;
use App\Services\WooCommerceService;
use PDO;

class CategoryController
{
    private $conn;
    private $woo;

    public function __construct()
    {
        $db = new Database();
        $this->conn = $db->connect();
        $this->woo = new WooCommerceService();
    }

    public function sync()
    {
        try {
            if (!$this->woo->isEnabled()) {
                Response::error("La integración con WooCommerce no está configurada", 400);
            }

            $result = $this->woo->syncCategories();
            
            if ($result['success']) {
                Response::json([
                    'success' => true,
                    'message' => "Sincronización completada: {$result['synced']} categorías procesadas",
                    'details' => $result
                ]);
            } else {
                Response::error($result['message'] ?? 'Error al sincronizar categorías');
            }
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    public function index()
    {
        try {
            $sql = "SELECT * FROM categories WHERE active = 1 ORDER BY name ASC";
            $stmt = $this->conn->query($sql);
            $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);
            Response::json($categories);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    public function store()
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            
            if (empty($data['name'])) {
                Response::error("El nombre es requerido");
            }

            // Validate slug
            $slug = null;
            if (!empty($data['slug'])) {
                $slug = trim($data['slug']);
                if (strpos($slug, ' ') !== false) {
                    Response::error("El slug no puede contener espacios");
                }
                
                // Check uniqueness
                $stmt = $this->conn->prepare("SELECT id FROM categories WHERE slug = ?");
                $stmt->execute([$slug]);
                if ($stmt->fetch()) {
                    Response::error("El slug '$slug' ya existe. Por favor elija otro.");
                }
            }

            $parentId = !empty($data['parent_id']) ? $data['parent_id'] : null;

            $stmt = $this->conn->prepare("INSERT INTO categories (name, description, slug, parent_id, active) VALUES (?, ?, ?, ?, 1)");
            $stmt->execute([
                $data['name'],
                $data['description'] ?? '',
                $slug,
                $parentId
            ]);
            
            $id = $this->conn->lastInsertId();
            
            // Sync to WooCommerce if enabled
            try {
                if ($this->woo->isEnabled()) {
                    // Prepare data for Woo
                    $wooData = $data;
                    $wooData['slug'] = $slug;
                    $wooData['parent_id'] = $parentId;
                    
                    $wooResult = $this->woo->createCategory($wooData);
                    
                    if ($wooResult['success'] && isset($wooResult['data']['id'])) {
                        // Update local with Woo ID
                        $wooId = $wooResult['data']['id'];
                        $updateStmt = $this->conn->prepare("UPDATE categories SET woocommerce_id = ? WHERE id = ?");
                        $updateStmt->execute([$wooId, $id]);
                    }
                }
            } catch (\Exception $ex) {
                // Log error but don't fail response
            }

            Response::json([
                'success' => true,
                'id' => $id,
                'message' => 'Categoría creada correctamente'
            ], 201);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    public function update($id)
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            
            if (empty($data['name'])) {
                Response::error("El nombre es requerido");
            }

            // Validate slug if present
            $slug = null;
            if (!empty($data['slug'])) {
                $slug = trim($data['slug']);
                if (strpos($slug, ' ') !== false) {
                    Response::error("El slug no puede contener espacios");
                }
            }

            // Get current category to check for woo_id
            $stmt = $this->conn->prepare("SELECT woocommerce_id FROM categories WHERE id = ?");
            $stmt->execute([$id]);
            $category = $stmt->fetch(PDO::FETCH_ASSOC);

            // Dynamically build update query
            $fields = "name = ?, description = ?";
            $params = [$data['name'], $data['description'] ?? ''];
            
            if ($slug !== null) {
                $fields .= ", slug = ?";
                $params[] = $slug;
            }
            
            $params[] = $id;

            $stmt = $this->conn->prepare("UPDATE categories SET $fields WHERE id = ?");
            $stmt->execute($params);
            
            // Sync to Woo if linked
            if ($category && !empty($category['woocommerce_id']) && $this->woo->isEnabled()) {
                // Pass slug to WooService if present
                if ($slug) {
                    $data['slug'] = $slug;
                }
                $this->woo->updateCategory($category['woocommerce_id'], $data);
            }

            Response::json(['success' => true, 'message' => 'Categoría actualizada']);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    public function delete($id)
    {
        try {
            // Get category to check for WooCommerce ID
            $stmt = $this->conn->prepare("SELECT woocommerce_id FROM categories WHERE id = ?");
            $stmt->execute([$id]);
            $category = $stmt->fetch(PDO::FETCH_ASSOC);

            // Sync delete to WooCommerce if enabled and linked
            if ($category && !empty($category['woocommerce_id']) && $this->woo->isEnabled()) {
                $this->woo->deleteCategory($category['woocommerce_id']);
            }

            // Soft delete locally
            $stmt = $this->conn->prepare("UPDATE categories SET active = 0 WHERE id = ?");
            $stmt->execute([$id]);
            Response::json(['success' => true, 'message' => 'Categoría eliminada de ERP y WooCommerce']);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    public function subcategories($categoryId)
    {
        try {
            // Check if table exists first to avoid 500 error on fresh install
            try {
                $stmt = $this->conn->prepare("SELECT * FROM subcategories WHERE category_id = ? AND active = 1 ORDER BY name ASC");
                $stmt->execute([$categoryId]);
                Response::json($stmt->fetchAll(PDO::FETCH_ASSOC));
            } catch (\Exception $ex) {
                // Return empty array if table doesn't exist
                if (strpos($ex->getMessage(), "doesn't exist") !== false) {
                    Response::json([]);
                }
                throw $ex;
            }
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }
}
