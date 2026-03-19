<?php

// CORS Headers - Must be first to handle preflight requests even if errors occur later
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: OPTIONS,GET,POST,PUT,DELETE");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Handle Preflight Options Request
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Shutdown function to handle fatal errors and send JSON response
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error && ($error['type'] === E_ERROR || $error['type'] === E_PARSE || $error['type'] === E_CORE_ERROR || $error['type'] === E_COMPILE_ERROR)) {
        // Clean any output buffers
        while (ob_get_level()) ob_end_clean();
        
        http_response_code(500);
        header("Content-Type: application/json; charset=UTF-8");
        echo json_encode([
            "error" => true, 
            "message" => "Fatal Error: " . $error['message'] . " in " . $error['file'] . " on line " . $error['line']
        ]);
    }
});

// Serve static files directly when using PHP built-in server
if (php_sapi_name() === 'cli-server') {
    $url = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $file = __DIR__ . $url;
    if (is_file($file)) {
        return false;
    }
}

require_once __DIR__ . '/vendor/autoload.php';

use App\Router;
use App\Controllers\HomeController;
use App\Controllers\AuthController;
use App\Controllers\UserController;
use App\Controllers\ProductController;
use App\Controllers\OrderController;
use App\Controllers\CustomerController;
use App\Controllers\InventoryController;
use App\Controllers\WarehouseController;
use App\Controllers\StockController;
use App\Controllers\FinanceController;
use App\Controllers\SettingsController;
use App\Controllers\ExternalServiceController;
use App\Controllers\CategoryController;
use App\Controllers\SubcategoryController;
use App\Controllers\BrandController;
use App\Controllers\SupplierController;
use App\Controllers\PurchaseOrderController;
use App\Controllers\LogisticsController;
use App\Controllers\AuditController;
use App\Controllers\ReportController;
use App\Controllers\MigrationController;
use App\Middleware\AuthMiddleware;
use Dotenv\Dotenv;

// Load Env
try {
    $dotenv = Dotenv::createImmutable(__DIR__);
    $dotenv->load();
} catch (\Exception $e) {
    // Return JSON error even if Env fails (headers are already sent)
    http_response_code(500);
    echo json_encode(["error" => true, "message" => "Environment configuration error: " . $e->getMessage()]);
    exit;
}

// Error Handling
if ($_ENV['APP_DEBUG'] ?? false) {
    ini_set('display_errors', 1);
    ini_set('display_startup_errors', 1);
    error_reporting(E_ALL);
}

$router = new Router();

// Home Route
$router->add('GET', '/', [HomeController::class, 'index'], []);
$router->add('GET', '/home/stats', [HomeController::class, 'stats'], []);
$router->add('GET', '/test-db', [HomeController::class, 'testDb'], []);
$router->add('GET', '/migrate/subcategories', [MigrationController::class, 'migrateSubcategories'], []);
$router->add('GET', '/migrate/add-slug', [MigrationController::class, 'addSlugToCategories'], []);
$router->add('GET', '/migrate/add-brand-columns', [MigrationController::class, 'addBrandColumns'], []);

// Auth Routes
$router->add('POST', '/auth/login', [AuthController::class, 'login'], []);
$router->add('POST', '/auth/forgot-password', [AuthController::class, 'forgotPassword'], []);
$router->add('POST', '/auth/reset-password', [AuthController::class, 'resetPassword'], []);
$router->add('GET', '/auth/me', [AuthController::class, 'me'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('POST', '/auth/logout', [AuthController::class, 'logout'], [[AuthMiddleware::class, 'authenticate']]);

// User Routes (Protected, Admin only)
$router->add('GET', '/users', [UserController::class, 'index'], [
    function() { AuthMiddleware::authorize(['Administrador']); }
]);
$router->add('GET', '/users/{id}', [UserController::class, 'show'], [
    function() { AuthMiddleware::authorize(['Administrador']); }
]);
$router->add('POST', '/users', [UserController::class, 'store'], [
    function() { AuthMiddleware::authorize(['Administrador']); }
]);
$router->add('PUT', '/users/{id}', [UserController::class, 'update'], [
    function() { AuthMiddleware::authorize(['Administrador']); }
]);
$router->add('DELETE', '/users/{id}', [UserController::class, 'destroy'], [
    function() { AuthMiddleware::authorize(['Administrador']); }
]);

// Roles & Audit
$router->add('GET', '/roles', [UserController::class, 'getRoles'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('POST', '/roles', [UserController::class, 'createRole'], [
    function() { AuthMiddleware::authorize(['Administrador']); }
]);
$router->add('PUT', '/roles/{id}', [UserController::class, 'updateRole'], [
    function() { AuthMiddleware::authorize(['Administrador']); }
]);
$router->add('DELETE', '/roles/{id}', [UserController::class, 'deleteRole'], [
    function() { AuthMiddleware::authorize(['Administrador']); }
]);
$router->add('GET', '/audit-logs', [AuditController::class, 'index'], [
    function() { AuthMiddleware::authorize(['Administrador']); }
]);

// Product Routes
$router->add('GET', '/productos/sync', [ProductController::class, 'sync'], [[AuthMiddleware::class, 'authenticate']]); // Added sync route (GET)
$router->add('POST', '/productos/sync', [ProductController::class, 'sync'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('GET', '/productos/export-woo', [ProductController::class, 'exportWooCommerce'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('GET', '/productos', [ProductController::class, 'index'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('GET', '/productos/{id}', [ProductController::class, 'show'], [[AuthMiddleware::class, 'authenticate']]);

// Stock Routes
$router->add('GET', '/stock', [StockController::class, 'index'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('POST', '/stock/movimiento', [StockController::class, 'update'], [[AuthMiddleware::class, 'authenticate']]);

// Order Routes
$router->add('POST', '/ventas/sync', [OrderController::class, 'sync'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('GET', '/ventas', [OrderController::class, 'index'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('POST', '/ventas', [OrderController::class, 'store'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('GET', '/ventas/{id}/ticket', [OrderController::class, 'generateTicket'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('GET', '/ventas/{id}', [OrderController::class, 'show'], [[AuthMiddleware::class, 'authenticate']]);

// Customer Routes
$router->add('GET', '/clientes', [CustomerController::class, 'index'], [
    function() { AuthMiddleware::authorize(['Administrador', 'Supervisor', 'Cajero', 'Vendedor']); }
]);
$router->add('POST', '/clientes', [CustomerController::class, 'create'], [
    function() { AuthMiddleware::authorize(['Administrador', 'Supervisor', 'Cajero', 'Vendedor']); }
]);
$router->add('GET', '/clientes/{id}', [CustomerController::class, 'show'], [
    function() { AuthMiddleware::authorize(['Administrador', 'Supervisor', 'Cajero', 'Vendedor']); }
]);
$router->add('PUT', '/clientes/{id}', [CustomerController::class, 'update'], [
    function() { AuthMiddleware::authorize(['Administrador', 'Supervisor']); }
]);
$router->add('GET', '/clientes/{id}/history', [CustomerController::class, 'history'], [
    function() { AuthMiddleware::authorize(['Administrador', 'Supervisor']); }
]);

// Category Routes
$router->add('POST', '/categories/sync', [CategoryController::class, 'sync'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('GET', '/categories', [CategoryController::class, 'index'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('POST', '/categories', [CategoryController::class, 'store'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('PUT', '/categories/{id}', [CategoryController::class, 'update'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('DELETE', '/categories/{id}', [CategoryController::class, 'delete'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('GET', '/categories/{id}/subcategories', [CategoryController::class, 'subcategories'], [[AuthMiddleware::class, 'authenticate']]);

// Subcategory Routes
$router->add('GET', '/subcategories', [SubcategoryController::class, 'index'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('POST', '/subcategories', [SubcategoryController::class, 'store'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('PUT', '/subcategories/{id}', [SubcategoryController::class, 'update'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('DELETE', '/subcategories/{id}', [SubcategoryController::class, 'delete'], [[AuthMiddleware::class, 'authenticate']]);

// Brand Routes
$router->add('POST', '/brands/sync', [BrandController::class, 'sync'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('GET', '/brands', [BrandController::class, 'index'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('POST', '/brands', [BrandController::class, 'store'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('PUT', '/brands/{id}', [BrandController::class, 'update'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('DELETE', '/brands/{id}', [BrandController::class, 'delete'], [[AuthMiddleware::class, 'authenticate']]);

// Supplier Routes
$router->add('GET', '/suppliers', [SupplierController::class, 'index'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('POST', '/suppliers', [SupplierController::class, 'store'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('PUT', '/suppliers/{id}', [SupplierController::class, 'update'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('DELETE', '/suppliers/{id}', [SupplierController::class, 'delete'], [[AuthMiddleware::class, 'authenticate']]);

// Purchase Orders Routes
$router->add('GET', '/compras', [PurchaseOrderController::class, 'index'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('POST', '/compras', [PurchaseOrderController::class, 'store'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('GET', '/compras/{id}', [PurchaseOrderController::class, 'show'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('PUT', '/compras/{id}', [PurchaseOrderController::class, 'update'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('DELETE', '/compras/{id}', [PurchaseOrderController::class, 'destroy'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('PUT', '/compras/{id}/status', [PurchaseOrderController::class, 'updateStatus'], [[AuthMiddleware::class, 'authenticate']]);

// Inventory & Warehouse Routes
$router->add('GET', '/inventory/products', [InventoryController::class, 'index'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('POST', '/inventory/products', [InventoryController::class, 'createProduct'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('POST', '/inventory/products/{id}', [InventoryController::class, 'updateProduct'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('GET', '/inventory/products/{id}/refresh-woo', [InventoryController::class, 'refreshFromWoo'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('POST', '/inventory/products/{id}/gallery/delete', [InventoryController::class, 'deleteGalleryImage'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('POST', '/inventory/import', [InventoryController::class, 'import'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('GET', '/inventory/import-template', [InventoryController::class, 'exportImportTemplate'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('GET', '/inventory/movements', [InventoryController::class, 'movements'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('POST', '/inventory/adjust', [InventoryController::class, 'adjust'], [[AuthMiddleware::class, 'authenticate']]);

// Variations Routes
$router->add('GET', '/inventory/products/{id}/variations', [InventoryController::class, 'getVariations'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('GET', '/inventory/variations/{id}', [InventoryController::class, 'getVariation'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('POST', '/inventory/products/{id}/variations', [InventoryController::class, 'addVariation'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('PUT', '/inventory/variations/{id}', [InventoryController::class, 'updateVariation'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('DELETE', '/inventory/variations/{id}', [InventoryController::class, 'deleteVariation'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('GET', '/inventory/attributes/{slug}/terms', [InventoryController::class, 'getWooAttributeTerms'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('POST', '/inventory/attributes/{slug}/terms', [InventoryController::class, 'createWooAttributeTerm'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('PUT', '/inventory/attributes/{slug}/terms/{id}', [InventoryController::class, 'updateWooAttributeTerm'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('DELETE', '/inventory/attributes/{slug}/terms/{id}', [InventoryController::class, 'deleteWooAttributeTerm'], [[AuthMiddleware::class, 'authenticate']]);

$router->add('GET', '/warehouses', [WarehouseController::class, 'index'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('POST', '/warehouses', [WarehouseController::class, 'create'], [
    function() { AuthMiddleware::authorize(['Administrador', 'Supervisor', 'Almacén']); }
]);
$router->add('PUT', '/warehouses/{id}', [WarehouseController::class, 'update'], [
    function() { AuthMiddleware::authorize(['Administrador', 'Supervisor', 'Almacén']); }
]);
$router->add('DELETE', '/warehouses/{id}', [WarehouseController::class, 'delete'], [
    function() { AuthMiddleware::authorize(['Administrador', 'Supervisor']); }
]);

// Settings Routes (Admin only)
$router->add('GET', '/settings', [SettingsController::class, 'index'], [
    function() { AuthMiddleware::authorize(['Administrador']); }
]);
$router->add('POST', '/settings', [SettingsController::class, 'updateSettings'], [
    function() { AuthMiddleware::authorize(['Administrador']); }
]);
$router->add('POST', '/settings/test-email', [SettingsController::class, 'testEmail'], [
    function() { AuthMiddleware::authorize(['Administrador']); }
]);
$router->add('PUT', '/settings', [SettingsController::class, 'update'], [
    function() { AuthMiddleware::authorize(['Administrador']); }
]);
$router->add('POST', '/settings/test-woo', [SettingsController::class, 'testWooCommerce'], [
    function() { AuthMiddleware::authorize(['Administrador']); }
]);
$router->add('POST', '/settings/logo', [SettingsController::class, 'uploadLogo'], [
    function() { AuthMiddleware::authorize(['Administrador']); }
]);

// Finance Routes
$router->add('GET', '/finanzas/banks', [FinanceController::class, 'getBankAccounts'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('POST', '/finanzas/banks', [FinanceController::class, 'createBankAccount'], [
    function() { AuthMiddleware::authorize(['Administrador', 'Supervisor']); }
]);
$router->add('PUT', '/finanzas/banks/{id}', [FinanceController::class, 'updateBankAccount'], [
    function() { AuthMiddleware::authorize(['Administrador', 'Supervisor']); }
]);
$router->add('GET', '/finanzas/banks/{id}/movements', [FinanceController::class, 'getBankMovements'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('POST', '/finanzas/movements', [FinanceController::class, 'createBankMovement'], [
    function() { AuthMiddleware::authorize(['Administrador', 'Supervisor']); }
]);
$router->add('GET', '/finanzas/expenses', [FinanceController::class, 'getExpenses'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('POST', '/finanzas/expenses', [FinanceController::class, 'createExpense'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('DELETE', '/finanzas/expenses/{id}', [FinanceController::class, 'deleteExpense'], [
    function() { AuthMiddleware::authorize(['Administrador', 'Supervisor']); }
]);

// Logistics Routes
$router->add('GET', '/logistics/providers', [LogisticsController::class, 'getProviders'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('POST', '/logistics/providers', [LogisticsController::class, 'createProvider'], [
    function() { AuthMiddleware::authorize(['Administrador', 'Supervisor', 'Almacén']); }
]);
$router->add('PUT', '/logistics/providers/{id}', [LogisticsController::class, 'updateProvider'], [
    function() { AuthMiddleware::authorize(['Administrador', 'Supervisor', 'Almacén']); }
]);
$router->add('DELETE', '/logistics/providers/{id}', [LogisticsController::class, 'deleteProvider'], [
    function() { AuthMiddleware::authorize(['Administrador', 'Supervisor']); }
]);

$router->add('GET', '/logistics/shipments', [LogisticsController::class, 'getShipments'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('POST', '/logistics/shipments', [LogisticsController::class, 'createShipment'], [
    function() { AuthMiddleware::authorize(['Administrador', 'Supervisor', 'Almacén']); }
]);
$router->add('GET', '/logistics/shipments/{id}', [LogisticsController::class, 'getShipment'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('PUT', '/logistics/shipments/{id}/status', [LogisticsController::class, 'updateShipmentStatus'], [
    function() { AuthMiddleware::authorize(['Administrador', 'Supervisor', 'Almacén']); }
]);

// External Services
$router->add('GET', '/external/ruc/{ruc}', [ExternalServiceController::class, 'consultRuc'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('GET', '/external/dni/{dni}', [ExternalServiceController::class, 'consultDni'], [[AuthMiddleware::class, 'authenticate']]);

// Report Routes
$router->add('GET', '/reports/sales', [ReportController::class, 'getSalesReport'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('GET', '/reports/stock', [ReportController::class, 'getStockReport'], [[AuthMiddleware::class, 'authenticate']]);
$router->add('GET', '/reports/finance', [ReportController::class, 'getFinancialReport'], [[AuthMiddleware::class, 'authenticate']]);

// Dispatch
try {
    $router->dispatch();
} catch (\Exception $e) {
    http_response_code(500);
    echo json_encode([
        "error" => true,
        "message" => "Internal Server Error: " . $e->getMessage(),
        "trace" => $_ENV['APP_DEBUG'] ? $e->getTrace() : []
    ]);
}
