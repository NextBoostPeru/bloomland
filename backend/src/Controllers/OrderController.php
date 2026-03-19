<?php
namespace App\Controllers;

use App\Config\Database;
use App\Utils\Response;
use App\Services\WooCommerceService;

class OrderController
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
            $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
            $search = $_GET['search'] ?? '';
            $offset = ($page - 1) * $limit;

            $query = "SELECT o.*, 
                             CONCAT(c.first_name, ' ', IFNULL(c.last_name, '')) as customer_name,
                             CONCAT(u.first_name, ' ', u.last_name_paternal) as user_name
                      FROM orders o
                      LEFT JOIN customers c ON o.customer_id = c.id
                      LEFT JOIN users u ON o.user_id = u.id
                      WHERE 1=1";
            
            $params = [];

            if (!empty($search)) {
                $query .= " AND (o.order_number LIKE ? OR c.first_name LIKE ? OR c.doc_number LIKE ?)";
                $params[] = "%$search%";
                $params[] = "%$search%";
                $params[] = "%$search%";
            }

            // Filters
            $startDate = $_GET['start_date'] ?? '';
            $endDate = $_GET['end_date'] ?? '';
            $userId = $_GET['user_id'] ?? '';

            if (!empty($startDate)) {
                $query .= " AND DATE(o.created_at) >= ?";
                $params[] = $startDate;
            }
            if (!empty($endDate)) {
                $query .= " AND DATE(o.created_at) <= ?";
                $params[] = $endDate;
            }
            if (!empty($userId)) {
                $query .= " AND o.user_id = ?";
                $params[] = $userId;
            }

            // Count total for pagination
            $countQuery = str_replace("o.*, \n                             CONCAT(c.first_name, ' ', IFNULL(c.last_name, '')) as customer_name,\n                             CONCAT(u.first_name, ' ', u.last_name_paternal) as user_name", "COUNT(*)", $query);
            $stmt = $this->conn->prepare($countQuery);
            $stmt->execute($params);
            $total = $stmt->fetchColumn();

            // Fetch data
            $query .= " ORDER BY o.created_at DESC LIMIT $limit OFFSET $offset";
            $stmt = $this->conn->prepare($query);
            $stmt->execute($params);
            $orders = $stmt->fetchAll(\PDO::FETCH_ASSOC);

            Response::json([
                'data' => $orders,
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => $total,
                    'pages' => ceil($total / $limit)
                ]
            ]);

        } catch (\Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function sync()
    {
        try {
            $wooService = new WooCommerceService();
            $result = $wooService->syncOrders();
            
            if ($result['success']) {
                Response::json($result);
            } else {
                Response::error($result['message'], 500);
            }
        } catch (\Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function store()
    {
        try {
            $data = json_decode(file_get_contents("php://input"), true);
            
            // Validate input
            if (empty($data['items']) || !is_array($data['items'])) {
                Response::error("El carrito está vacío", 400);
            }
        
            $userId = 1; 
            $customerId = $data['customer_id'] ?? null;
            
            // Map payment method to ENUM
            $paymentMethodMap = [
                'Efectivo' => 'CASH',
                'Tarjeta' => 'CARD',
                'Yape' => 'YAPE',
                'Plin' => 'PLIN',
                'Mixto' => 'CASH', // Fallback for mixed
                'Transferencia' => 'TRANSFER'
            ];
            $frontendPaymentMethod = $data['payment_method'] ?? 'Efectivo';
            $paymentMethod = $paymentMethodMap[$frontendPaymentMethod] ?? 'CASH';
            
            $receiptTypeInput = $data['receipt_type'] ?? 'Boleta';
            // Map to invoice_type ENUM (uppercase)
            $invoiceTypeMap = [
                'Boleta' => 'BOLETA',
                'Factura' => 'FACTURA',
                'Nota de Venta' => 'NOTA_VENTA'
            ];
            $invoiceType = $invoiceTypeMap[$receiptTypeInput] ?? 'BOLETA';
            
            $total = 0;

            // Start Transaction
            $this->conn->beginTransaction();

            // Calculate total and verify stock
            foreach ($data['items'] as $item) {
                $stmt = $this->conn->prepare("SELECT price_pen, stock_quantity FROM products WHERE id = ? FOR UPDATE");
                $stmt->execute([$item['id']]);
                $product = $stmt->fetch(\PDO::FETCH_ASSOC);

                if (!$product) {
                    throw new \Exception("Producto ID {$item['id']} no encontrado");
                }
                
                if ($product['stock_quantity'] < $item['quantity']) {
                    throw new \Exception("Stock insuficiente para producto ID {$item['id']}");
                }

                $total += $product['price_pen'] * $item['quantity'];
            }

            // Create Order
            // Generate unique order number
            $orderNumber = 'ORD-' . strtoupper(uniqid());
            
            $stmt = $this->conn->prepare("INSERT INTO orders (
                order_number, 
                user_id, 
                customer_id, 
                total_amount, 
                payment_method, 
                receipt_type, 
                invoice_type, 
                status, 
                origin,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PAID', 'POS', NOW())");
            
            $stmt->execute([
                $orderNumber,
                $userId,
                $customerId,
                $total,
                $paymentMethod,
                $receiptTypeInput,
                $invoiceType
            ]);
            $orderId = $this->conn->lastInsertId();

            // Create Order Items and Update Stock
            foreach ($data['items'] as $item) {
                $stmt = $this->conn->prepare("SELECT price_pen FROM products WHERE id = ?");
                $stmt->execute([$item['id']]);
                $price = $stmt->fetchColumn();
                $subtotal = $price * $item['quantity'];

                $stmt = $this->conn->prepare("INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)");
                $stmt->execute([$orderId, $item['id'], $item['quantity'], $price, $subtotal]);

                // Update Stock
                $stmt = $this->conn->prepare("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?");
                $stmt->execute([$item['quantity'], $item['id']]);
            }

            $this->conn->commit();

            Response::json([
                'success' => true,
                'message' => 'Venta registrada correctamente',
                'order_id' => $orderId
            ]);

        } catch (\Exception $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            Response::error($e->getMessage(), 500);
        }
    }

    public function show($id)
    {
        try {
            // Fetch Order
            $stmt = $this->conn->prepare("
                SELECT o.*, 
                       CONCAT(c.first_name, ' ', IFNULL(c.last_name, '')) as customer_name, 
                       c.doc_number as document_number, 
                       c.doc_type as document_type, 
                       c.address as customer_address,
                       c.email as customer_email,
                       c.phone as customer_phone,
                       CONCAT(u.first_name, ' ', u.last_name_paternal) as user_name
                FROM orders o
                LEFT JOIN customers c ON o.customer_id = c.id
                LEFT JOIN users u ON o.user_id = u.id
                WHERE o.id = ?
            ");
            $stmt->execute([$id]);
            $order = $stmt->fetch(\PDO::FETCH_ASSOC);

            if (!$order) {
                Response::error("Orden no encontrada", 404);
            }

            // Fetch Items
            $stmt = $this->conn->prepare("
                SELECT oi.*, p.name as product_name, p.sku, p.image_url
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                WHERE oi.order_id = ?
            ");
            $stmt->execute([$id]);
            $items = $stmt->fetchAll(\PDO::FETCH_ASSOC);

            $order['items'] = $items;

            Response::json($order);

        } catch (\Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function generateTicket($id)
    {
        try {
            // Fetch Order
            $stmt = $this->conn->prepare("
                SELECT o.*, 
                       CONCAT(c.first_name, ' ', IFNULL(c.last_name, '')) as customer_name, 
                       c.doc_number as document_number, 
                       c.doc_type as document_type, 
                       c.address as customer_address,
                       CONCAT(u.first_name, ' ', u.last_name_paternal) as user_name
                FROM orders o
                LEFT JOIN customers c ON o.customer_id = c.id
                LEFT JOIN users u ON o.user_id = u.id
                WHERE o.id = ?
            ");
            $stmt->execute([$id]);
            $order = $stmt->fetch(\PDO::FETCH_ASSOC);

            if (!$order) {
                Response::error("Orden no encontrada", 404);
            }

            // Fetch Items
            $stmt = $this->conn->prepare("
                SELECT oi.*, p.name as product_name
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                WHERE oi.order_id = ?
            ");
            $stmt->execute([$id]);
            $items = $stmt->fetchAll(\PDO::FETCH_ASSOC);

            // Fetch Settings
            $settings = [];
            
            // Try KV settings first
            try {
                $stmt = $this->conn->query("SELECT setting_key, setting_value FROM settings");
                $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);
                foreach ($rows as $row) {
                    $settings[$row['setting_key']] = $row['setting_value'];
                }
            } catch (\Exception $e) {
                // Ignore
            }

            // Fallback to company_settings if KV is empty or missing key fields
            if (empty($settings['company_name'])) {
                 $stmt = $this->conn->prepare("SELECT * FROM company_settings LIMIT 1");
                 $stmt->execute();
                 $legacy = $stmt->fetch(\PDO::FETCH_ASSOC);
                 if ($legacy) {
                     $settings['company_name'] = $legacy['business_name'] ?? $legacy['company_name'] ?? 'BABYLAND';
                     $settings['company_address'] = $legacy['address'] ?? '';
                     $settings['company_phone'] = $legacy['phone'] ?? '';
                     $settings['company_ruc'] = $legacy['ruc'] ?? '';
                     $settings['company_email'] = $legacy['email'] ?? '';
                     $settings['company_logo'] = $legacy['logo_url'] ?? '';
                 }
            }

            $companyName = $settings['company_name'] ?? 'BABYLAND';
            $companyAddress = $settings['company_address'] ?? 'Dirección Principal';
            $companyPhone = $settings['company_phone'] ?? '';
            $companyRuc = $settings['company_ruc'] ?? '';
            $companyEmail = $settings['company_email'] ?? '';
            $companyLogo = $settings['company_logo'] ?? '';

            // Generate PDF
            $pdf = new \Fpdf\Fpdf('P', 'mm', [80, 250]); // 80mm width
            $pdf->AddPage();
            $pdf->SetMargins(5, 5, 5);
            
            // Logo
            if (!empty($companyLogo)) {
                $logoPath = '';
                // Check if it's a URL or path
                if (strpos($companyLogo, 'http') === 0) {
                    // Extract path after /public/
                    $pathParts = explode('/public/', $companyLogo);
                    if (count($pathParts) > 1) {
                        $logoPath = __DIR__ . '/../../public/' . $pathParts[1];
                    }
                } else {
                    // Assume relative path
                    $logoPath = __DIR__ . '/../../public/' . ltrim($companyLogo, '/');
                }
                
                // Fallback for direct uploads folder
                if (!file_exists($logoPath) && strpos($companyLogo, 'uploads/') !== false) {
                     $pathParts = explode('uploads/', $companyLogo);
                     $logoPath = __DIR__ . '/../../public/uploads/' . end($pathParts);
                }

                if (file_exists($logoPath)) {
                    $pdf->Image($logoPath, 30, 5, 20); 
                    $pdf->Ln(20); 
                }
            }

            // Header
            $pdf->SetFont('Arial', 'B', 12);
            $pdf->Cell(70, 5, mb_convert_encoding($companyName, 'ISO-8859-1', 'UTF-8'), 0, 1, 'C');
            $pdf->SetFont('Arial', '', 8);
            $pdf->MultiCell(70, 4, mb_convert_encoding($companyAddress, 'ISO-8859-1', 'UTF-8'), 0, 'C');
            $pdf->Cell(70, 4, 'RUC: ' . $companyRuc, 0, 1, 'C');
            if (!empty($companyPhone)) {
                $pdf->Cell(70, 4, 'Telf: ' . $companyPhone, 0, 1, 'C');
            }
            if (!empty($companyEmail)) {
                $pdf->Cell(70, 4, 'Email: ' . $companyEmail, 0, 1, 'C');
            }
            $pdf->Ln(2);
            
            // Ticket Info
            $pdf->Cell(70, 4, '-----------------------------------------', 0, 1, 'C');
            $pdf->SetFont('Arial', 'B', 9);
            $pdf->Cell(70, 5, mb_convert_encoding($order['invoice_type'], 'ISO-8859-1', 'UTF-8') . ' ' . $order['order_number'], 0, 1, 'C');
            $pdf->SetFont('Arial', '', 8);
            $pdf->Cell(70, 4, 'Fecha: ' . $order['created_at'], 0, 1, 'L');
            $pdf->Cell(70, 4, 'Cajero: ' . mb_convert_encoding($order['user_name'] ?? 'Admin', 'ISO-8859-1', 'UTF-8'), 0, 1, 'L');
            
            // Customer Info
            $pdf->Cell(70, 4, '-----------------------------------------', 0, 1, 'C');
            if ($order['customer_name']) {
                $pdf->MultiCell(70, 4, 'Cliente: ' . mb_convert_encoding($order['customer_name'], 'ISO-8859-1', 'UTF-8'), 0, 'L');
                $pdf->Cell(70, 4, $order['document_type'] . ': ' . $order['document_number'], 0, 1, 'L');
                if ($order['customer_address']) {
                    $pdf->MultiCell(70, 4, 'Dir: ' . mb_convert_encoding($order['customer_address'], 'ISO-8859-1', 'UTF-8'), 0, 'L');
                }
            } else {
                $pdf->Cell(70, 4, 'Cliente: VARIOS', 0, 1, 'L');
            }
            
            // Items
            $pdf->Cell(70, 4, '-----------------------------------------', 0, 1, 'C');
            $pdf->Cell(10, 4, 'Cant.', 0, 0, 'L');
            $pdf->Cell(40, 4, 'Producto', 0, 0, 'L');
            $pdf->Cell(20, 4, 'Total', 0, 1, 'R');
            
            foreach ($items as $item) {
                $name = substr($item['product_name'], 0, 20); // Truncate for now
                $pdf->Cell(10, 4, $item['quantity'], 0, 0, 'L');
                $pdf->Cell(40, 4, mb_convert_encoding($name, 'ISO-8859-1', 'UTF-8'), 0, 0, 'L');
                $pdf->Cell(20, 4, number_format($item['subtotal'], 2), 0, 1, 'R');
            }
            
            // Totals
            $pdf->Cell(70, 4, '-----------------------------------------', 0, 1, 'C');
            $pdf->SetFont('Arial', 'B', 10);
            $pdf->Cell(50, 5, 'TOTAL A PAGAR:', 0, 0, 'R');
            $pdf->Cell(20, 5, 'S/ ' . number_format($order['total_amount'], 2), 0, 1, 'R');
            
            $pdf->SetFont('Arial', '', 8);
            $pdf->Cell(50, 4, 'Metodo Pago:', 0, 0, 'R');
            $pdf->Cell(20, 4, mb_convert_encoding($order['payment_method'], 'ISO-8859-1', 'UTF-8'), 0, 1, 'R');
            
            $pdf->Ln(5);
            $pdf->Cell(70, 4, 'Gracias por su compra!', 0, 1, 'C');
            
            $pdf->Output('I', 'ticket.pdf');
            exit;

        } catch (\Exception $e) {
            Response::error($e->getMessage(), 500);
        }
    }
}
