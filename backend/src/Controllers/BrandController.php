<?php
namespace App\Controllers;

use App\Config\Database;
use App\Utils\Response;
use App\Services\WooCommerceService;
use PDO;

class BrandController
{
    private $conn;
    private $woo;

    public function __construct()
    {
        $db = new Database();
        $this->conn = $db->connect();
        $this->woo = new WooCommerceService();
    }

    public function index()
    {
        try {
            $sql = "SELECT * FROM brands WHERE active = 1 ORDER BY name ASC";
            $stmt = $this->conn->query($sql);
            $brands = $stmt->fetchAll(PDO::FETCH_ASSOC);
            Response::json($brands);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    public function sync()
    {
        try {
            $result = $this->woo->syncBrands();
            Response::json($result);
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
                $stmt = $this->conn->prepare("SELECT id FROM brands WHERE slug = ?");
                $stmt->execute([$slug]);
                if ($stmt->fetch()) {
                    Response::error("El slug '$slug' ya existe. Por favor elija otro.");
                }
            }

            $stmt = $this->conn->prepare("INSERT INTO brands (name, description, slug, active) VALUES (?, ?, ?, 1)");
            $stmt->execute([
                $data['name'],
                $data['description'] ?? '',
                $slug
            ]);
            
            $id = $this->conn->lastInsertId();

            // Sync to WooCommerce if enabled
            $syncMessage = '';
            try {
                if ($this->woo->isEnabled()) {
                    $wooData = $data;
                    $wooData['slug'] = $slug;

                    $result = $this->woo->createBrand($wooData);
                    
                    if ($result['success']) {
                        $wooId = $result['data']['id'];
                        $update = $this->conn->prepare("UPDATE brands SET woocommerce_id = ? WHERE id = ?");
                        $update->execute([$wooId, $id]);
                    } else {
                         $syncMessage = '. Advertencia: No se pudo crear en WooCommerce (' . ($result['message'] ?? 'Error desconocido') . ')';
                    }
                }
            } catch (\Exception $ex) {
                $syncMessage = '. Error de sincronización: ' . $ex->getMessage();
            }
            
            Response::json([
                'success' => true,
                'id' => $id,
                'message' => 'Marca creada correctamente' . $syncMessage
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

            // Validate slug
            $slug = null;
            if (!empty($data['slug'])) {
                $slug = trim($data['slug']);
                if (strpos($slug, ' ') !== false) {
                    Response::error("El slug no puede contener espacios");
                }
                
                // Check uniqueness (exclude current brand)
                $stmt = $this->conn->prepare("SELECT id FROM brands WHERE slug = ? AND id != ?");
                $stmt->execute([$slug, $id]);
                if ($stmt->fetch()) {
                    Response::error("El slug '$slug' ya existe. Por favor elija otro.");
                }
            }

            $stmt = $this->conn->prepare("UPDATE brands SET name = ?, description = ?, slug = ? WHERE id = ?");
            $stmt->execute([
                $data['name'],
                $data['description'] ?? '',
                $slug,
                $id
            ]);

            // Sync with WooCommerce
            $syncMessage = '';
            try {
                if ($this->woo->isEnabled()) {
                    $stmt = $this->conn->prepare("SELECT woocommerce_id FROM brands WHERE id = ?");
                    $stmt->execute([$id]);
                    $brand = $stmt->fetch(PDO::FETCH_ASSOC);

                    if ($brand && !empty($brand['woocommerce_id'])) {
                        // Update existing in Woo
                        $wooData = $data;
                        $wooData['slug'] = $slug;
                        $res = $this->woo->updateBrand($brand['woocommerce_id'], $wooData);
                        if (!$res['success']) {
                            $syncMessage = '. Advertencia: No se pudo actualizar en WooCommerce (' . ($res['message'] ?? 'Error desconocido') . ')';
                        }
                    } else {
                        // Create in Woo if not exists (and link)
                        $wooData = $data;
                        $wooData['slug'] = $slug;
                        $result = $this->woo->createBrand($wooData);
                        if ($result['success']) {
                            $wooId = $result['data']['id'];
                            $update = $this->conn->prepare("UPDATE brands SET woocommerce_id = ? WHERE id = ?");
                            $update->execute([$wooId, $id]);
                        } else {
                            $syncMessage = '. Advertencia: No se pudo crear en WooCommerce (' . ($result['message'] ?? 'Error desconocido') . ')';
                        }
                    }
                }
            } catch (\Exception $ex) {
                $syncMessage = '. Error de sincronización: ' . $ex->getMessage();
            }
            
            Response::json(['success' => true, 'message' => 'Marca actualizada' . $syncMessage]);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    public function delete($id)
    {
        try {
            // Check if synced
            $stmt = $this->conn->prepare("SELECT woocommerce_id FROM brands WHERE id = ?");
            $stmt->execute([$id]);
            $brand = $stmt->fetch(PDO::FETCH_ASSOC);

            // Sync Delete (WooCommerce)
            if ($brand && !empty($brand['woocommerce_id']) && $this->woo->isEnabled()) {
                $this->woo->deleteBrand($brand['woocommerce_id']);
            }

            // Soft delete
            $stmt = $this->conn->prepare("UPDATE brands SET active = 0 WHERE id = ?");
            $stmt->execute([$id]);
            Response::json(['success' => true, 'message' => 'Marca eliminada de ERP y WooCommerce']);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }
}
