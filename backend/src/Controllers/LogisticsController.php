<?php

namespace App\Controllers;

use App\Config\Database;
use App\Utils\Response;
use PDO;

class LogisticsController
{
    private $conn;

    public function __construct()
    {
        $db = new Database();
        $this->conn = $db->connect();
    }

    // --- PROVIDERS (Agencias/Couriers) ---

    public function getProviders()
    {
        try {
            $stmt = $this->conn->query("SELECT * FROM logistics_providers WHERE active = 1");
            Response::json($stmt->fetchAll(PDO::FETCH_ASSOC));
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    public function createProvider()
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            
            if (empty($data['name'])) {
                Response::error("El nombre del proveedor es requerido");
            }

            $stmt = $this->conn->prepare("INSERT INTO logistics_providers (name, contact_info, website_url) VALUES (?, ?, ?)");
            $stmt->execute([
                $data['name'],
                $data['contact_info'] ?? '',
                $data['website_url'] ?? ''
            ]);

            Response::json(['success' => true, 'id' => $this->conn->lastInsertId(), 'message' => 'Proveedor logístico creado']);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    public function updateProvider($id)
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            
            $stmt = $this->conn->prepare("UPDATE logistics_providers SET name = ?, ruc = ?, contact_info = ?, website_url = ? WHERE id = ?");
            $stmt->execute([
                $data['name'],
                $data['ruc'] ?? null,
                $data['contact_info'] ?? '',
                $data['website_url'] ?? '',
                $id
            ]);

            Response::json(['success' => true, 'message' => 'Proveedor actualizado']);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    public function deleteProvider($id)
    {
        try {
            // Soft delete
            $stmt = $this->conn->prepare("UPDATE logistics_providers SET active = 0 WHERE id = ?");
            $stmt->execute([$id]);
            Response::json(['success' => true, 'message' => 'Proveedor eliminado']);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    // --- SHIPMENTS (Envíos/Guías) ---

    public function getShipments()
    {
        try {
            $page = $_GET['page'] ?? 1;
            $limit = $_GET['limit'] ?? 20;
            $offset = ($page - 1) * $limit;
            $status = $_GET['status'] ?? null;

            $sql = "SELECT s.*, lp.name as provider_name 
                    FROM shipments s 
                    LEFT JOIN logistics_providers lp ON s.provider_id = lp.id ";
            
            if ($status) {
                $sql .= "WHERE s.status = :status ";
            }
            
            $sql .= "ORDER BY s.created_at DESC LIMIT :limit OFFSET :offset";
            
            $stmt = $this->conn->prepare($sql);
            if ($status) {
                $stmt->bindParam(':status', $status);
            }
            $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
            $stmt->bindParam(':offset', $offset, PDO::PARAM_INT);
            $stmt->execute();
            $shipments = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Count
            $countSql = "SELECT COUNT(*) FROM shipments";
            if ($status) {
                $countSql .= " WHERE status = '$status'";
            }
            $countStmt = $this->conn->query($countSql);
            $total = $countStmt->fetchColumn();

            Response::json([
                'data' => $shipments,
                'pagination' => [
                    'page' => (int)$page,
                    'limit' => (int)$limit,
                    'total' => (int)$total,
                    'pages' => ceil($total / $limit)
                ]
            ]);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    public function createShipment()
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            
            if (empty($data['provider_id'])) {
                Response::error("Debe seleccionar un proveedor logístico");
            }

            // Auto-generate tracking number if not provided
            if (empty($data['tracking_number'])) {
                // Format: TRK-YYYYMMDD-XXXX (4 random chars)
                $data['tracking_number'] = 'TRK-' . date('Ymd') . '-' . strtoupper(substr(uniqid(), -4));
            }

            $sql = "INSERT INTO shipments (
                provider_id, order_id, tracking_number, remission_guide_number, 
                recipient_name, shipping_address, shipping_cost, notes, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')";
            
            $stmt = $this->conn->prepare($sql);
            $stmt->execute([
                $data['provider_id'],
                $data['order_id'] ?? null,
                $data['tracking_number'] ?? '',
                $data['remission_guide_number'] ?? '',
                $data['recipient_name'] ?? '',
                $data['shipping_address'] ?? '',
                $data['shipping_cost'] ?? 0.00,
                $data['notes'] ?? ''
            ]);

            Response::json(['success' => true, 'id' => $this->conn->lastInsertId(), 'message' => 'Envío registrado']);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    public function updateShipmentStatus($id)
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            $status = $data['status']; // pending, ready_to_dispatch, dispatched, delivered, cancelled

            $sql = "UPDATE shipments SET status = ?";
            $params = [$status];

            if ($status === 'dispatched') {
                $sql .= ", dispatch_date = NOW()";
            } elseif ($status === 'delivered') {
                $sql .= ", delivery_date = NOW()";
            }

            $sql .= " WHERE id = ?";
            $params[] = $id;

            $stmt = $this->conn->prepare($sql);
            $stmt->execute($params);

            Response::json(['success' => true, 'message' => "Estado de envío actualizado a $status"]);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    public function getShipment($id)
    {
        try {
            $stmt = $this->conn->prepare("SELECT s.*, lp.name as provider_name FROM shipments s LEFT JOIN logistics_providers lp ON s.provider_id = lp.id WHERE s.id = ?");
            $stmt->execute([$id]);
            $shipment = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$shipment) {
                Response::error("Envío no encontrado", 404);
            }

            Response::json($shipment);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }
}
