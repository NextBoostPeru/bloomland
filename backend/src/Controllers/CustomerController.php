<?php
namespace App\Controllers;

use App\Config\Database;
use App\Utils\Response;
use PDO;

class CustomerController {
    private $conn;

    public function __construct() {
        $db = new Database();
        $this->conn = $db->connect();
    }

    // List customers with pagination and search (for CRM)
    public function index() {
        // Auth check
        $user = \App\Middleware\AuthMiddleware::authenticate();
        $isSalesperson = ($user['role'] === 'Vendedor' || $user['role'] === 'Cajero'); // Or strictly 'Vendedor' depending on requirements
        $currentUserId = $user['id'];

        // Compatibility with POS Autocomplete (uses ?q=)
        if (isset($_GET['q'])) {
            return $this->search();
        }

        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
        $search = isset($_GET['search']) ? $_GET['search'] : '';
        $offset = ($page - 1) * $limit;

        $whereClause = "WHERE 1=1";
        $params = [];

        // Private CRM: Salespeople can only see their own customers
        if ($isSalesperson) {
            $whereClause .= " AND user_id = ?";
            $params[] = $currentUserId;
        }

        if (!empty($search)) {
            $whereClause .= " AND (first_name LIKE ? OR last_name LIKE ? OR doc_number LIKE ? OR email LIKE ?)";
            $searchTerm = "%$search%";
            $params[] = $searchTerm;
            $params[] = $searchTerm;
            $params[] = $searchTerm;
            $params[] = $searchTerm;
        }

        // Count total
        $countSql = "SELECT COUNT(*) FROM customers $whereClause";
        $stmt = $this->conn->prepare($countSql);
        $stmt->execute($params);
        $total = $stmt->fetchColumn();

        // Get Data
        $sql = "SELECT * FROM customers $whereClause ORDER BY created_at DESC LIMIT $limit OFFSET $offset";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute($params);
        $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        Response::json([
            'data' => $customers,
            'pagination' => [
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'pages' => ceil($total / $limit)
            ]
        ]);
    }

    // Autocomplete Search (for POS) - Internal use via index() or explicit route
    public function search() {
        $user = \App\Middleware\AuthMiddleware::authenticate();
        $isSalesperson = ($user['role'] === 'Vendedor' || $user['role'] === 'Cajero');
        $currentUserId = $user['id'];

        $query = isset($_GET['q']) ? $_GET['q'] : '';
        
        $whereClause = "WHERE 1=1";
        $params = [];

        if ($isSalesperson) {
            $whereClause .= " AND user_id = ?";
            $params[] = $currentUserId;
        }

        if (empty($query)) {
            $stmt = $this->conn->prepare("SELECT id, first_name as name, doc_type as document_type, doc_number as document_number, email, phone, address FROM customers $whereClause ORDER BY created_at DESC LIMIT 5");
            $stmt->execute($params);
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
            return;
        }

        $whereClause .= " AND (doc_number LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)";
        $searchTerm = "%$query%";
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;

        $sql = "SELECT id, first_name as name, doc_type as document_type, doc_number as document_number, email, phone, address FROM customers $whereClause LIMIT 10";
        
        $stmt = $this->conn->prepare($sql);
        $stmt->execute($params);
        
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    public function create() {
        $user = \App\Middleware\AuthMiddleware::authenticate();
        $data = json_decode(file_get_contents("php://input"), true);

        if (!isset($data['name']) || !isset($data['document_number'])) {
            Response::error('Nombre y documento son requeridos', 400);
        }

        // Check if exists
        $stmt = $this->conn->prepare("SELECT id FROM customers WHERE doc_number = ?");
        $stmt->execute([$data['document_number']]);
        if ($stmt->fetch()) {
            Response::error('Cliente ya existe con este documento', 409);
        }

        $sql = "INSERT INTO customers (user_id, first_name, doc_type, doc_number, email, phone, address, credit_limit, credit_balance, created_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
        
        $stmt = $this->conn->prepare($sql);
        $result = $stmt->execute([
            $user['id'], // Assign owner
            $data['name'], 
            $data['document_type'] ?? 'DNI',
            $data['document_number'],
            $data['email'] ?? null,
            $data['phone'] ?? null,
            $data['address'] ?? null,
            $data['credit_limit'] ?? 0.00,
            0.00 // Initial balance is 0
        ]);

        if ($result) {
            $id = $this->conn->lastInsertId();
            Response::json([
                'id' => $id,
                'name' => $data['name'],
                'document_number' => $data['document_number'],
                'document_type' => $data['document_type'] ?? 'DNI',
                'message' => 'Cliente registrado correctamente'
            ], 201);
        } else {
            Response::error('Error al registrar cliente', 500);
        }
    }

    public function update($id) {
        $data = json_decode(file_get_contents("php://input"), true);

        $sql = "UPDATE customers SET first_name = ?, doc_type = ?, doc_number = ?, email = ?, phone = ?, address = ?, credit_limit = ? WHERE id = ?";
        $stmt = $this->conn->prepare($sql);
        $result = $stmt->execute([
            $data['name'], 
            $data['document_type'],
            $data['document_number'],
            $data['email'] ?? null,
            $data['phone'] ?? null,
            $data['address'] ?? null,
            $data['credit_limit'] ?? 0.00,
            $id
        ]);

        if ($result) {
            Response::json(['message' => 'Cliente actualizado correctamente']);
        } else {
            Response::error('Error al actualizar cliente', 500);
        }
    }

    public function show($id) {
        $stmt = $this->conn->prepare("SELECT * FROM customers WHERE id = ?");
        $stmt->execute([$id]);
        $customer = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$customer) {
            Response::error('Cliente no encontrado', 404);
        }

        Response::json($customer);
    }

    public function history($id) {
        $stmt = $this->conn->prepare("
            SELECT o.*, 
            (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as items_count,
            u.username as seller_name
            FROM orders o 
            LEFT JOIN users u ON o.user_id = u.id
            WHERE o.customer_id = ? 
            ORDER BY o.created_at DESC
        ");
        $stmt->execute([$id]);
        $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        Response::json($orders);
    }
}
