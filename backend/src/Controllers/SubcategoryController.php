<?php
namespace App\Controllers;

use App\Config\Database;
use App\Utils\Response;
use PDO;

class SubcategoryController
{
    private $conn;

    public function __construct()
    {
        $db = new Database();
        $this->conn = $db->connect();
    }

    public function index()
    {
        try {
            $categoryId = $_GET['category_id'] ?? null;
            
            $sql = "SELECT * FROM subcategories WHERE active = 1";
            $params = [];
            
            if ($categoryId) {
                $sql .= " AND category_id = ?";
                $params[] = $categoryId;
            }
            
            $sql .= " ORDER BY name ASC";
            
            $stmt = $this->conn->prepare($sql);
            $stmt->execute($params);
            Response::json($stmt->fetchAll(PDO::FETCH_ASSOC));
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    public function store()
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            
            if (empty($data['name']) || empty($data['category_id'])) {
                Response::error("El nombre y la categoría son requeridos");
            }

            $stmt = $this->conn->prepare("INSERT INTO subcategories (name, category_id, active) VALUES (?, ?, 1)");
            $stmt->execute([
                $data['name'],
                $data['category_id']
            ]);
            
            $id = $this->conn->lastInsertId();
            
            Response::json([
                'success' => true,
                'id' => $id,
                'message' => 'Subcategoría creada correctamente'
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

            $stmt = $this->conn->prepare("UPDATE subcategories SET name = ? WHERE id = ?");
            $stmt->execute([
                $data['name'],
                $id
            ]);
            
            Response::json(['success' => true, 'message' => 'Subcategoría actualizada']);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    public function delete($id)
    {
        try {
            // Soft delete
            $stmt = $this->conn->prepare("UPDATE subcategories SET active = 0 WHERE id = ?");
            $stmt->execute([$id]);
            Response::json(['success' => true, 'message' => 'Subcategoría eliminada']);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }
}
