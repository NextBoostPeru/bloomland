<?php
namespace App\Controllers;

use App\Config\Database;
use App\Utils\Response;
use PDO;

class WarehouseController
{
    private $conn;

    public function __construct()
    {
        $db = new Database();
        $this->conn = $db->connect();
    }

    public function index()
    {
        $stmt = $this->conn->query("SELECT * FROM warehouses WHERE active = 1 ORDER BY id ASC");
        Response::json($stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    public function create() {
        $data = json_decode(file_get_contents("php://input"), true);
        if (empty($data['name'])) Response::error("Nombre requerido");
        
        $stmt = $this->conn->prepare("INSERT INTO warehouses (name, address) VALUES (?, ?)");
        if ($stmt->execute([$data['name'], $data['address'] ?? ''])) {
            Response::json(['success' => true, 'id' => $this->conn->lastInsertId()]);
        } else {
            Response::error("Error al crear sede");
        }
    }

    public function update($id) {
        $data = json_decode(file_get_contents("php://input"), true);
        if (empty($data['name'])) Response::error("Nombre requerido");

        $stmt = $this->conn->prepare("UPDATE warehouses SET name = ?, address = ? WHERE id = ?");
        if ($stmt->execute([$data['name'], $data['address'] ?? '', $id])) {
            Response::json(['success' => true]);
        } else {
            Response::error("Error al actualizar sede");
        }
    }

    public function delete($id) {
        // Soft delete
        $stmt = $this->conn->prepare("UPDATE warehouses SET active = 0 WHERE id = ?");
        if ($stmt->execute([$id])) {
            Response::json(['success' => true]);
        } else {
            Response::error("Error al eliminar sede");
        }
    }
}
