<?php
namespace App\Controllers;

use App\Config\Database;
use App\Utils\Response;
use PDO;

class SupplierController
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
            $stmt = $this->conn->query("SELECT *, business_name as name FROM suppliers WHERE active = 1 ORDER BY business_name ASC");
            Response::json($stmt->fetchAll(PDO::FETCH_ASSOC));
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

            $stmt = $this->conn->prepare("INSERT INTO suppliers (business_name, contact_name, email, phone, address, ruc, active) VALUES (?, ?, ?, ?, ?, ?, 1)");
            $stmt->execute([
                $data['name'],
                $data['contact_name'] ?? '',
                $data['email'] ?? '',
                $data['phone'] ?? '',
                $data['address'] ?? '',
                $data['ruc'] ?? ''
            ]);
            
            $id = $this->conn->lastInsertId();
            
            Response::json([
                'success' => true,
                'id' => $id,
                'message' => 'Proveedor creado correctamente'
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

            $stmt = $this->conn->prepare("UPDATE suppliers SET business_name = ?, contact_name = ?, email = ?, phone = ?, address = ?, ruc = ? WHERE id = ?");
            $stmt->execute([
                $data['name'],
                $data['contact_name'] ?? '',
                $data['email'] ?? '',
                $data['phone'] ?? '',
                $data['address'] ?? '',
                $data['ruc'] ?? '',
                $id
            ]);
            
            Response::json(['success' => true, 'message' => 'Proveedor actualizado']);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    public function delete($id)
    {
        try {
            // Soft delete
            $stmt = $this->conn->prepare("UPDATE suppliers SET active = 0 WHERE id = ?");
            $stmt->execute([$id]);
            Response::json(['success' => true, 'message' => 'Proveedor eliminado']);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }
}
