<?php

namespace App\Controllers;

use App\Config\Database;
use App\Utils\Response;
use PDO;

class PurchaseOrderController
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
            $page = $_GET['page'] ?? 1;
            $limit = $_GET['limit'] ?? 20;
            $offset = ($page - 1) * $limit;
            
            $sql = "SELECT po.*, s.business_name as supplier_name, u.first_name as user_name 
                    FROM purchase_orders po 
                    LEFT JOIN suppliers s ON po.supplier_id = s.id 
                    LEFT JOIN users u ON po.user_id = u.id 
                    ORDER BY po.created_at DESC 
                    LIMIT :limit OFFSET :offset";
            
            $stmt = $this->conn->prepare($sql);
            $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
            $stmt->bindParam(':offset', $offset, PDO::PARAM_INT);
            $stmt->execute();
            $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $countStmt = $this->conn->query("SELECT COUNT(*) FROM purchase_orders");
            $total = $countStmt->fetchColumn();

            Response::json([
                'data' => $orders,
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

    public function show($id)
    {
        try {
            // Get Header
            $sql = "SELECT po.*, s.business_name as supplier_name, s.ruc, s.address, s.phone, u.first_name as user_name 
                    FROM purchase_orders po 
                    LEFT JOIN suppliers s ON po.supplier_id = s.id 
                    LEFT JOIN users u ON po.user_id = u.id 
                    WHERE po.id = ?";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute([$id]);
            $order = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$order) {
                Response::json(['error' => true, 'message' => 'Orden no encontrada'], 404);
            }

            // Get Items
            $sqlItems = "SELECT * FROM purchase_order_items WHERE purchase_order_id = ?";
            $stmtItems = $this->conn->prepare($sqlItems);
            $stmtItems->execute([$id]);
            $items = $stmtItems->fetchAll(PDO::FETCH_ASSOC);

            $order['items'] = $items;
            Response::json($order);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    public function store()
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            
            if (empty($data['supplier_id']) || empty($data['items'])) {
                Response::error("Proveedor e items son requeridos");
            }

            $this->conn->beginTransaction();

            // Create Header
            $sql = "INSERT INTO purchase_orders (supplier_id, user_id, status, total_amount, expected_date, notes) VALUES (?, ?, ?, ?, ?, ?)";
            
            // Handle empty date string
            $expectedDate = !empty($data['expected_date']) ? $data['expected_date'] : null;

            $stmt = $this->conn->prepare($sql);
            $stmt->execute([
                $data['supplier_id'],
                $data['user_id'] ?? null,
                'pending',
                $data['total_amount'] ?? 0,
                $expectedDate,
                $data['notes'] ?? ''
            ]);
            $orderId = $this->conn->lastInsertId();

            // Create Items
            $sqlItem = "INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_cost, subtotal) VALUES (?, ?, ?, ?, ?, ?)";
            $stmtItem = $this->conn->prepare($sqlItem);

            foreach ($data['items'] as $item) {
                $stmtItem->execute([
                    $orderId,
                    $item['product_id'] ?? null,
                    $item['product_name'],
                    $item['quantity'],
                    $item['unit_cost'],
                    $item['subtotal']
                ]);
            }

            $this->conn->commit();
            Response::json(['success' => true, 'id' => $orderId, 'message' => 'Orden de compra creada']);
        } catch (\Exception $e) {
            $this->conn->rollBack();
            Response::error($e->getMessage());
        }
    }

    public function update($id)
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            
            if (empty($data['supplier_id']) || empty($data['items'])) {
                Response::error("Proveedor e items son requeridos");
            }

            $this->conn->beginTransaction();

            // Check current status
            $checkStmt = $this->conn->prepare("SELECT status FROM purchase_orders WHERE id = ?");
            $checkStmt->execute([$id]);
            $currentOrder = $checkStmt->fetch(PDO::FETCH_ASSOC);

            if (!$currentOrder) {
                $this->conn->rollBack();
                Response::json(['error' => true, 'message' => 'Orden no encontrada'], 404);
            }

            if ($currentOrder['status'] !== 'pending') {
                $this->conn->rollBack();
                Response::error("Solo se pueden editar órdenes pendientes");
            }

            // Update Header
            $sql = "UPDATE purchase_orders SET supplier_id = ?, total_amount = ?, expected_date = ?, notes = ? WHERE id = ?";
            
            // Handle empty date string
            $expectedDate = !empty($data['expected_date']) ? $data['expected_date'] : null;

            $stmt = $this->conn->prepare($sql);
            $stmt->execute([
                $data['supplier_id'],
                $data['total_amount'] ?? 0,
                $expectedDate,
                $data['notes'] ?? '',
                $id
            ]);

            // Delete old items
            $deleteStmt = $this->conn->prepare("DELETE FROM purchase_order_items WHERE purchase_order_id = ?");
            $deleteStmt->execute([$id]);

            // Create Items
            $sqlItem = "INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_cost, subtotal) VALUES (?, ?, ?, ?, ?, ?)";
            $stmtItem = $this->conn->prepare($sqlItem);

            foreach ($data['items'] as $item) {
                $stmtItem->execute([
                    $id,
                    $item['product_id'] ?? null,
                    $item['product_name'],
                    $item['quantity'],
                    $item['unit_cost'],
                    $item['subtotal']
                ]);
            }

            $this->conn->commit();
            Response::json(['success' => true, 'message' => 'Orden actualizada correctamente']);
        } catch (\Exception $e) {
            $this->conn->rollBack();
            Response::error($e->getMessage());
        }
    }

    public function destroy($id)
    {
        try {
            // Check status
            $checkStmt = $this->conn->prepare("SELECT status FROM purchase_orders WHERE id = ?");
            $checkStmt->execute([$id]);
            $currentOrder = $checkStmt->fetch(PDO::FETCH_ASSOC);

            if (!$currentOrder) {
                Response::json(['error' => true, 'message' => 'Orden no encontrada'], 404);
            }

            if ($currentOrder['status'] !== 'pending' && $currentOrder['status'] !== 'cancelled') {
                Response::error("Solo se pueden eliminar órdenes pendientes o canceladas");
            }

            $stmt = $this->conn->prepare("DELETE FROM purchase_orders WHERE id = ?");
            $stmt->execute([$id]);

            Response::json(['success' => true, 'message' => 'Orden eliminada correctamente']);
        } catch (\Exception $e) {
            Response::error($e->getMessage());
        }
    }

    public function updateStatus($id)
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            $newStatus = $data['status']; // approved, received, cancelled

            $this->conn->beginTransaction();

            // Get current status and items if we are receiving
            $stmt = $this->conn->prepare("SELECT status FROM purchase_orders WHERE id = ?");
            $stmt->execute([$id]);
            $currentStatus = $stmt->fetchColumn();

            if ($currentStatus === $newStatus) {
                $this->conn->rollBack();
                Response::json(['success' => true, 'message' => "El estado ya es $newStatus"]);
                return;
            }

            // If changing to 'received', update stock
            if ($newStatus === 'received' && $currentStatus !== 'received') {
                $stmtItems = $this->conn->prepare("SELECT product_id, quantity FROM purchase_order_items WHERE purchase_order_id = ?");
                $stmtItems->execute([$id]);
                $items = $stmtItems->fetchAll(PDO::FETCH_ASSOC);

                foreach ($items as $item) {
                    if (!$item['product_id']) continue;

                    $productId = $item['product_id'];
                    $qty = $item['quantity'];
                    $warehouseId = 1; // Default warehouse

                    // 1. Update product_stocks
                    $stmtStock = $this->conn->prepare("INSERT INTO product_stocks (product_id, warehouse_id, quantity) 
                                                      VALUES (?, ?, ?) 
                                                      ON DUPLICATE KEY UPDATE quantity = quantity + ?");
                    $stmtStock->execute([$productId, $warehouseId, $qty, $qty]);

                    // 2. Update products total stock
                    $stmtTotal = $this->conn->prepare("UPDATE products SET stock_quantity = (SELECT SUM(quantity) FROM product_stocks WHERE product_id = ?) WHERE id = ?");
                    $stmtTotal->execute([$productId, $productId]);

                    // 3. Record Movement
                    $stmtMove = $this->conn->prepare("INSERT INTO inventory_movements (product_id, warehouse_id, type, quantity, notes, user_id) 
                                                     VALUES (?, ?, 'IN', ?, ?, ?)");
                    $notes = "Ingreso por Orden de Compra #$id";
                    $userId = 1; // Default admin for now
                    $stmtMove->execute([$productId, $warehouseId, $qty, $notes, $userId]);
                }
            }

            $stmt = $this->conn->prepare("UPDATE purchase_orders SET status = ? WHERE id = ?");
            $stmt->execute([$newStatus, $id]);

            $this->conn->commit();
            Response::json(['success' => true, 'message' => "Estado actualizado a $newStatus"]);
        } catch (\Exception $e) {
            if ($this->conn->inTransaction()) $this->conn->rollBack();
            Response::error($e->getMessage());
        }
    }
}
