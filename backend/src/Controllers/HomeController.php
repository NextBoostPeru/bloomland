<?php

namespace App\Controllers;

use App\Utils\Response;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;

class HomeController
{
    public function index()
    {
        Response::json([
            'message' => 'Bienvenido a la API Bloomland ERP',
            'status' => 'online',
            'version' => '1.0.0',
            'timestamp' => date('Y-m-d H:i:s')
        ]);
    }

    public function stats()
    {
        // Initialize default response structure
        $response = [
            'stats' => [
                'total_sales' => [
                    'value' => 'S/ 0.00',
                    'trend' => 'up',
                    'trendValue' => '0%'
                ],
                'active_orders' => [
                    'value' => 0,
                    'trend' => 'up',
                    'trendValue' => '0%'
                ],
                'new_customers' => [
                    'value' => 0,
                    'trend' => 'up',
                    'trendValue' => '0%'
                ],
                'stock_alerts' => [
                    'value' => 0,
                    'trend' => 'down',
                    'trendValue' => '0%'
                ]
            ],
            'recent_inventory' => []
        ];

        $debugErrors = [];

        try {
            $db = new \App\Config\Database();
            $conn = $db->connect();
            $appUrl = $_ENV['APP_URL'] ?? '';
            $appUrl = rtrim($appUrl, '/');
            // 1. Ventas Totales (Mes actual vs anterior)
            try {
                $currentMonthStart = date('Y-m-01');
                $lastMonthStart = date('Y-m-01', strtotime('-1 month'));
                $lastMonthEnd = date('Y-m-t', strtotime('-1 month'));

                // Sales Query using orders table
                $salesQuery = "SELECT 
                    SUM(CASE WHEN created_at >= :currentMonthStart THEN total_amount ELSE 0 END) as current_total,
                    SUM(CASE WHEN created_at >= :lastMonthStart AND created_at <= :lastMonthEnd THEN total_amount ELSE 0 END) as last_total
                    FROM orders
                    WHERE status = 'PAID'";
                
                $stmt = $conn->prepare($salesQuery);
                $stmt->execute([
                    'currentMonthStart' => $currentMonthStart, 
                    'lastMonthStart' => $lastMonthStart,
                    'lastMonthEnd' => $lastMonthEnd
                ]);
                $salesStats = $stmt->fetch(\PDO::FETCH_ASSOC);

                if ($salesStats) {
                    $salesTrend = 0;
                    if (($salesStats['last_total'] ?? 0) > 0) {
                        $salesTrend = (($salesStats['current_total'] - $salesStats['last_total']) / $salesStats['last_total']) * 100;
                    }
                    
                    $response['stats']['total_sales'] = [
                        'value' => 'S/ ' . number_format($salesStats['current_total'] ?: 0, 2),
                        'trend' => $salesTrend >= 0 ? 'up' : 'down',
                        'trendValue' => number_format(abs($salesTrend), 1) . '%'
                    ];
                }
            } catch (\Exception $e) {
                $debugErrors['sales'] = $e->getMessage();
            }

            // 2. Pedidos Activos
            try {
                $activeOrdersQuery = "SELECT COUNT(*) FROM orders WHERE status = 'PENDING'";
                $activeOrders = $conn->query($activeOrdersQuery)->fetchColumn();
                $response['stats']['active_orders']['value'] = $activeOrders ?: 0;
            } catch (\Exception $e) {
                $debugErrors['active_orders'] = $e->getMessage();
            }

            // 3. Nuevos Clientes (Este mes)
            try {
                // Using customers table instead of users
                $customersQuery = "SELECT COUNT(*) FROM customers WHERE created_at >= :currentMonth";
                $stmt = $conn->prepare($customersQuery);
                $stmt->execute(['currentMonth' => date('Y-m-01')]);
                $newCustomers = $stmt->fetchColumn();
                $response['stats']['new_customers']['value'] = $newCustomers ?: 0;
            } catch (\Exception $e) {
                $debugErrors['new_customers'] = $e->getMessage();
            }

            // 4. Alertas de Stock (Desde tabla products del ERP)
            try {
                // products table has stock_quantity and min_stock_alert
                $stockAlertsQuery = "SELECT COUNT(*) FROM products WHERE stock_quantity <= COALESCE(min_stock_alert, 5) AND active = 1";
                $stockAlerts = $conn->query($stockAlertsQuery)->fetchColumn();
                $response['stats']['stock_alerts']['value'] = $stockAlerts ?: 0;
            } catch (\Exception $e) {
                $debugErrors['stock_alerts'] = $e->getMessage();
            }

            // 5. Inventario Reciente (Últimos movimientos)
            try {
                // Fix column names: p.price_pen instead of p.price, p.stock_quantity instead of p.stock
                $recentMovementsQuery = "SELECT m.*, p.name as product_name, p.image_url, c.name as category_name, p.price_pen as price, p.stock_quantity as stock, p.min_stock_alert
                    FROM inventory_movements m
                    JOIN products p ON m.product_id = p.id
                    LEFT JOIN categories c ON p.category_id = c.id
                    ORDER BY m.created_at DESC LIMIT 5";
                
                $recentMovements = $conn->query($recentMovementsQuery)->fetchAll(\PDO::FETCH_ASSOC);

                if ($recentMovements) {
                    // Preparar datos de inventario para el frontend
                    $response['recent_inventory'] = array_map(function($m) use ($appUrl) {
                        // Fix image URL (kept for completeness, though frontend might not use it yet)
                        $imageUrl = $m['image_url'] ?? '';
                        if (!empty($imageUrl)) {
                            $imageUrl = preg_replace('/^http:\/\/localhost:\d+\/api\/public\//', '/public/', $imageUrl);
                            $imageUrl = preg_replace('/^http:\/\/localhost:\d+\/public\//', '/public/', $imageUrl);
                            if (strpos($imageUrl, 'uploads/') === 0) {
                                $imageUrl = '/public/' . $imageUrl;
                            }
                            if (strpos($imageUrl, '/public/uploads/') !== false) {
                                $imageUrl = substr($imageUrl, strpos($imageUrl, '/public/uploads/'));
                            }
                            if (!empty($appUrl) && strpos($imageUrl, '/public/') === 0) {
                                $imageUrl = $appUrl . $imageUrl;
                            }
                        }

                        $stock = $m['new_stock'] ?? $m['stock'];
                        $minStock = $m['min_stock_alert'] ?? 5;
                        
                        $status = 'En Stock';
                        if ($stock <= 0) {
                            $status = 'Agotado';
                        } elseif ($stock <= $minStock) {
                            $status = 'Bajo Stock';
                        }

                        // Map to frontend expected keys: name, cat, stock, status, price
                        return [
                            'id' => $m['id'],
                            'name' => $m['product_name'], // Frontend uses 'name'
                            'cat' => $m['category_name'] ?? 'Sin categoría', // Frontend uses 'cat'
                            'stock' => $stock,
                            'status' => $status, // Frontend uses 'status' (Agotado, Bajo Stock, etc.)
                            'price' => 'S/ ' . number_format((float)($m['price'] ?? 0), 2),
                            // Extra fields just in case
                            'image' => $imageUrl,
                            'type' => $m['type'],
                            'date' => $m['created_at']
                        ];
                    }, $recentMovements);
                }
            } catch (\Exception $e) {
                $debugErrors['recent_inventory'] = $e->getMessage();
            }

            // Add debug info if debug mode is on
            if (($_ENV['APP_DEBUG'] ?? 'false') === 'true' && !empty($debugErrors)) {
                $response['debug_errors'] = $debugErrors;
            }

            Response::json($response);

        } catch (\Exception $e) {
            // Fatal error in connection or setup
            // Return what we have so far or error
            if (($_ENV['APP_DEBUG'] ?? 'false') === 'true') {
                 Response::json(['error' => true, 'message' => $e->getMessage(), 'trace' => $e->getTraceAsString()], 500);
            } else {
                 Response::json(['error' => true, 'message' => 'Internal Server Error'], 500);
            }
        }
    }

    public function testDb()
    {
        try {
            $host = $_ENV['DB_HOST'];
            $port = $_ENV['DB_PORT'] ?? '3306';
            $dbname = $_ENV['DB_NAME'];
            $user = $_ENV['DB_USER'];
            
            $dsn = "mysql:host=$host;port=$port;dbname=$dbname;charset=" . ($_ENV['DB_CHARSET'] ?? 'utf8mb4');
            
            $startTime = microtime(true);
            $pdo = new \PDO($dsn, $user, $_ENV['DB_PASS'], [
                \PDO::ATTR_TIMEOUT => 5, // 5 seconds timeout
                \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION
            ]);
            $endTime = microtime(true);
            
            $tables = [];
            $stmt = $pdo->query("SHOW TABLES");
            while ($row = $stmt->fetch(\PDO::FETCH_NUM)) {
                $tables[] = $row[0];
            }

            Response::json([
                'success' => true,
                'message' => 'Conexión exitosa',
                'connection_info' => [
                    'host' => $host,
                    'port' => $port,
                    'database' => $dbname,
                    'user' => $user,
                    'connection_time' => round(($endTime - $startTime) * 1000, 2) . 'ms'
                ],
                'tables_found' => count($tables),
                'tables' => $tables
            ]);

        } catch (\PDOException $e) {
            $message = $e->getMessage();
            $advice = "Error de conexión. ";
            
            if (strpos($message, '2002') !== false) {
                $advice .= "El servidor de base de datos no responde. Si estás en producción, intenta cambiar DB_HOST a 'localhost' en tu archivo .env. Si es una base de datos remota, asegúrate de haber habilitado el acceso remoto (Remote MySQL) para la IP de tu servidor web.";
            } elseif (strpos($message, '1045') !== false) {
                $advice .= "Usuario o contraseña incorrectos. Verifica las credenciales en el archivo .env.";
            } elseif (strpos($message, '1049') !== false) {
                $advice .= "La base de datos '$dbname' no existe. Verifica el nombre en el archivo .env.";
            }

            Response::json([
                'success' => false,
                'error' => $message,
                'advice' => $advice,
                'env_used' => [
                    'host' => $_ENV['DB_HOST'],
                    'database' => $_ENV['DB_NAME'],
                    'user' => $_ENV['DB_USER']
                ]
            ], 500);
        } catch (\Exception $e) {
            Response::json(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }
}
