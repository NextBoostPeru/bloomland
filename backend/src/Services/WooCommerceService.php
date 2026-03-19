<?php
namespace App\Services;

use App\Config\Database;
use PDO;

class WooCommerceService
{
    private $conn;
    private $settings;

    public function __construct()
    {
        $db = new Database();
        $this->conn = $db->connect();
        $this->loadSettings();
    }

    private function loadSettings()
    {
        $this->settings = [];

        // 1. Try KV Settings table first
        try {
            $stmt = $this->conn->query("SELECT setting_key, setting_value FROM settings");
            if ($stmt) {
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as $row) {
                    $key = $row['setting_key'];
                    $val = $row['setting_value'];
                    
                    // Map KV keys to Service expected keys
                    if ($key === 'woocommerce_key') {
                        $this->settings['woocommerce_consumer_key'] = $val;
                    } elseif ($key === 'woocommerce_secret') {
                        $this->settings['woocommerce_consumer_secret'] = $val;
                    } else {
                        $this->settings[$key] = $val;
                    }
                }
            }
        } catch (\Exception $e) {
            // Ignore error if table doesn't exist
        }

        // 2. Fallback/Merge from company_settings if essential data missing OR if woocommerce_enabled is missing
        if (empty($this->settings['woocommerce_url']) || empty($this->settings['woocommerce_consumer_key']) || !isset($this->settings['woocommerce_enabled'])) {
            try {
                $stmt = $this->conn->prepare("SELECT * FROM company_settings LIMIT 1");
                $stmt->execute();
                $legacy = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($legacy) {
                    // Merge legacy, preferring existing KV settings
                    // We iterate legacy keys and add them if not present in settings
                    foreach ($legacy as $k => $v) {
                        // Map legacy keys if needed, or just add them
                        if (!isset($this->settings[$k]) || $this->settings[$k] === '') {
                             $this->settings[$k] = $v;
                        }
                    }
                }
            } catch (\Exception $e) {
                // Ignore
            }
        }
    }

    public function isEnabled()
    {
        return !empty($this->settings['woocommerce_enabled']) && 
               !empty($this->settings['woocommerce_url']) && 
               !empty($this->settings['woocommerce_consumer_key']) && 
               !empty($this->settings['woocommerce_consumer_secret']);
    }

    // --- Category Sync ---
    public function syncCategories()
    {
        if (!$this->isEnabled()) {
            return ['success' => false, 'message' => 'WooCommerce integration is disabled or incomplete'];
        }

        $endpoint = rtrim($this->settings['woocommerce_url'], '/') . '/wp-json/wc/v3/products/categories';
        $page = 1;
        $perPage = 100;
        $keepFetching = true;
        $syncedCount = 0;
        $errors = [];
        $allCategories = [];

        // 1. Fetch ALL categories first
        while ($keepFetching) {
            $params = [
                'per_page' => $perPage,
                'page' => $page,
                'orderby' => 'id',
                'order' => 'asc',
                'hide_empty' => false
            ];
            
            $url = $endpoint . '?' . http_build_query($params);
            $result = $this->makeRequest('GET', $url);

            if (!$result['success']) {
                if ($page === 1) return $result;
                break;
            }

            $categories = $result['data'];
            if (empty($categories)) {
                $keepFetching = false;
            } else {
                $allCategories = array_merge($allCategories, $categories);
                $page++;
                if ($page > 20) break; // Safety limit
            }
        }

        // 2. First Pass: Upsert all categories and build map
        $wooIdToLocalId = [];
        
        foreach ($allCategories as $cat) {
            try {
                $wooId = $cat['id'];
                $name = $cat['name'];
                $description = $cat['description'] ?? '';
                $slug = $cat['slug'] ?? '';
                
                // 1. Try to find by woocommerce_id
                $stmt = $this->conn->prepare("SELECT id FROM categories WHERE woocommerce_id = ?");
                $stmt->execute([$wooId]);
                $existingId = $stmt->fetchColumn();

                if (!$existingId) {
                    // 2. Try to find by name (fallback)
                    $stmt = $this->conn->prepare("SELECT id FROM categories WHERE name = ?");
                    $stmt->execute([$name]);
                    $existingId = $stmt->fetchColumn();
                }
                if ($existingId) {
                    // Update existing category
                    $updateStmt = $this->conn->prepare("UPDATE categories SET name = ?, description = ?, slug = ?, woocommerce_id = ? WHERE id = ?");
                    $updateStmt->execute([$name, $description, $slug, $wooId, $existingId]);
                    $localId = $existingId;
                } else {
                    // Insert new category
                    $insertStmt = $this->conn->prepare("INSERT INTO categories (name, description, slug, woocommerce_id, active) VALUES (?, ?, ?, ?, 1)");
                    $insertStmt->execute([$name, $description, $slug, $wooId]);
                    $localId = $this->conn->lastInsertId();
                }
                
                $wooIdToLocalId[$wooId] = $localId;
                $syncedCount++;
            } catch (\Exception $e) {
                $errors[] = "Category {$cat['name']}: " . $e->getMessage();
            }
        }

        // 3. Second Pass: Update parent_id
        foreach ($allCategories as $cat) {
            if (!empty($cat['parent']) && $cat['parent'] > 0) {
                $wooParentId = $cat['parent'];
                $wooChildId = $cat['id'];
                
                if (isset($wooIdToLocalId[$wooParentId]) && isset($wooIdToLocalId[$wooChildId])) {
                    $localParentId = $wooIdToLocalId[$wooParentId];
                    $localChildId = $wooIdToLocalId[$wooChildId];
                    
                    try {
                        $updateParentStmt = $this->conn->prepare("UPDATE categories SET parent_id = ? WHERE id = ?");
                        $updateParentStmt->execute([$localParentId, $localChildId]);
                    } catch (\Exception $e) {
                        $errors[] = "Setting parent for {$cat['name']}: " . $e->getMessage();
                    }
                }
            }
        }

        return ['success' => true, 'synced' => $syncedCount, 'errors' => $errors];
    }

    public function createCategory($data)
    {
        if (!$this->isEnabled()) {
            return ['success' => false, 'message' => 'WooCommerce integration disabled'];
        }
        
        $endpoint = rtrim($this->settings['woocommerce_url'], '/') . "/wp-json/wc/v3/products/categories";
        
        $body = [
            'name' => $data['name'],
            'description' => $data['description'] ?? ''
        ];

        if (!empty($data['slug'])) {
            $body['slug'] = $data['slug'];
        }

        // Handle Parent Category
        if (!empty($data['parent_id'])) {
            // Get WooCommerce ID of the parent
            $stmt = $this->conn->prepare("SELECT woocommerce_id FROM categories WHERE id = ?");
            $stmt->execute([$data['parent_id']]);
            $parentId = $stmt->fetchColumn();
            
            if ($parentId) {
                $body['parent'] = (int)$parentId;
            }
        }
        
        return $this->makeRequest('POST', $endpoint, $body);
    }

    public function updateCategory($wooId, $data)
    {
        if (!$this->isEnabled()) {
            return ['success' => false, 'message' => 'WooCommerce integration disabled'];
        }
        
        $endpoint = rtrim($this->settings['woocommerce_url'], '/') . "/wp-json/wc/v3/products/categories/{$wooId}";
        
        $body = [
            'name' => $data['name'],
            'description' => $data['description'] ?? ''
        ];
        
        if (!empty($data['slug'])) {
            $body['slug'] = $data['slug'];
        }
        
        return $this->makeRequest('PUT', $endpoint, $body);
    }

    public function deleteCategory($wooId)
    {
        if (!$this->isEnabled()) {
            return ['success' => false, 'message' => 'WooCommerce integration disabled'];
        }
        
        // force=true to permanently delete, otherwise it goes to trash
        $endpoint = rtrim($this->settings['woocommerce_url'], '/') . "/wp-json/wc/v3/products/categories/{$wooId}?force=true";
        
        return $this->makeRequest('DELETE', $endpoint);
    }

    public function updateProductStock($wooId, $quantity)
    {
        if (!$this->isEnabled()) {
            return ['success' => false, 'message' => 'WooCommerce integration disabled'];
        }
        
        $endpoint = rtrim($this->settings['woocommerce_url'], '/') . "/wp-json/wc/v3/products/{$wooId}";
        
        $body = [
            'manage_stock' => true,
            'stock_quantity' => (int)$quantity
        ];
        
        return $this->makeRequest('PUT', $endpoint, $body);
    }

    private function log($message) {
        file_put_contents(__DIR__ . '/../../logs/woo_service.log', date('Y-m-d H:i:s') . " - " . $message . "\n", FILE_APPEND);
    }

    public function uploadImage($filePath)
    {
        if (!$this->isEnabled()) {
            return ['success' => false, 'message' => 'WooCommerce integration disabled'];
        }

        // Ensure logs directory exists
        $logDir = __DIR__ . '/../../logs';
        if (!is_dir($logDir)) {
            @mkdir($logDir, 0777, true);
        }

        $this->log("Starting image upload for: $filePath");

        if (!file_exists($filePath)) {
            $this->log("File not found: $filePath");
            return ['success' => false, 'message' => 'File not found: ' . $filePath];
        }

        $endpoint = rtrim($this->settings['woocommerce_url'], '/') . "/wp-json/wp/v2/media";
        $fileName = basename($filePath);
        $mimeType = @mime_content_type($filePath) ?: 'application/octet-stream';
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $endpoint);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        // Prefer WordPress Application Password for wp/v2/media
        if (!empty($this->settings['wordpress_username']) && !empty($this->settings['wordpress_app_password'])) {
            curl_setopt($ch, CURLOPT_USERPWD, $this->settings['wordpress_username'] . ':' . $this->settings['wordpress_app_password']);
            $this->log("Using WordPress App Password for media upload");
        } else {
            curl_setopt($ch, CURLOPT_USERPWD, $this->settings['woocommerce_consumer_key'] . ':' . $this->settings['woocommerce_consumer_secret']);
            $this->log("Using Woo CK/CS for media upload");
        }
        // Use multipart/form-data to improve compatibility with wp/v2/media
        if (function_exists('curl_file_create')) {
            $cfile = curl_file_create($filePath, $mimeType, $fileName);
        } else {
            $cfile = '@' . realpath($filePath);
        }
        $postFields = [
            'file' => $cfile,
            'title' => $fileName
        ];
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
        // Avoid 100-continue delays on some servers
        $headers = [
            'Expect:'
        ];
        
        // Disable SSL verification for development environments if needed
        // Ideally this should be configurable, but for quick fix on Windows/XAMPP:
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 15);
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        $curlInfo = curl_getinfo($ch);
        curl_close($ch);

        if ($error) {
            $this->log("cURL Error: $error");
            return ['success' => false, 'message' => "cURL Error: $error"];
        }

        if ($httpCode >= 200 && $httpCode < 300) {
            $this->log("Image uploaded successfully. Code: $httpCode");
            return ['success' => true, 'data' => json_decode($response, true)];
        }
        
        $this->log("HTTP Error $httpCode. Response: " . substr($response, 0, 500));
        $this->log("cURL Info: " . json_encode($curlInfo));
        return ['success' => false, 'message' => "HTTP Error $httpCode", 'details' => json_decode($response, true)];
    }

    public function syncProduct($productData)
    {
        // Map DB fields to Service fields if needed
        if (!isset($productData['price']) && isset($productData['price_pen'])) {
            $productData['price'] = $productData['price_pen'];
        }
        if (!isset($productData['stock']) && isset($productData['stock_quantity'])) {
            $productData['stock'] = $productData['stock_quantity'];
        }
        if (!isset($productData['min_stock']) && isset($productData['min_stock_alert'])) {
            $productData['min_stock'] = $productData['min_stock_alert'];
        }

        if (!empty($productData['woocommerce_id'])) {
            return $this->updateProduct($productData['woocommerce_id'], $productData);
        } else {
            return $this->createProduct($productData);
        }
    }

    public function updateProduct($wooId, $productData)
    {
        if (!$this->isEnabled()) {
            return ['success' => false, 'message' => 'WooCommerce integration disabled'];
        }
        
        $endpoint = rtrim($this->settings['woocommerce_url'], '/') . "/wp-json/wc/v3/products/{$wooId}";
        
        $type = $productData['type'] ?? 'simple';
        $data = [
            'name' => $productData['name'],
            'description' => $productData['description'] ?? '',
            'short_description' => $productData['short_description'] ?? '',
            'sku' => $productData['sku'] ?? '',
        ];

        if ($type === 'simple') {
            $data['type'] = 'simple';
            $data['regular_price'] = (string)$productData['price'];
            $data['manage_stock'] = true;
            $data['stock_quantity'] = (int)($productData['stock'] ?? 0);
        } else {
            // Variable product: update base and then sync variations
            // Build attributes from provided variations (custom attributes)
            $attributes = [];
            $sizes = [];
            $colors = [];
            $details = [];
            if (!empty($productData['variations']) && is_array($productData['variations'])) {
                foreach ($productData['variations'] as $v) {
                    if (!empty($v['size'])) $sizes[$v['size']] = true;
                    if (!empty($v['color'])) $colors[$v['color']] = true;
                    if (!empty($v['detail'])) $details[$v['detail']] = true;
                }
            }
            // Prefer global attributes by ID if available
            $sizeAttrId = $this->getAttributeIdBySlugOrName('talla');
            $colorAttrId = $this->getAttributeIdBySlugOrName('color');
            $designAttrId = $this->getAttributeIdBySlugOrName('diseño');
            if (!$designAttrId) {
                $designAttrId = $this->getAttributeIdBySlugOrName('diseno');
            }
            if (!empty($sizes)) {
                if ($sizeAttrId) {
                    $attributes[] = ['id' => $sizeAttrId, 'visible' => true, 'variation' => true, 'options' => array_keys($sizes)];
                } else {
                    $attributes[] = ['name' => 'Talla', 'visible' => true, 'variation' => true, 'options' => array_keys($sizes)];
                }
            }
            if (!empty($colors)) {
                if ($colorAttrId) {
                    $attributes[] = ['id' => $colorAttrId, 'visible' => true, 'variation' => true, 'options' => array_keys($colors)];
                } else {
                    $attributes[] = ['name' => 'Color', 'visible' => true, 'variation' => true, 'options' => array_keys($colors)];
                }
            }
            if (!empty($details)) {
                if ($designAttrId) {
                    $attributes[] = ['id' => $designAttrId, 'visible' => true, 'variation' => true, 'options' => array_keys($details)];
                } else {
                    $attributes[] = ['name' => 'Diseño', 'visible' => true, 'variation' => true, 'options' => array_keys($details)];
                }
            }
            $data['type'] = 'variable';
            // El producto padre no debe gestionar inventario cuando es variable
            $data['manage_stock'] = false;
            if (!empty($attributes)) {
                $data['attributes'] = $attributes;
            }
        }

        // Handle Categories
        if (!empty($productData['category_id'])) {
            $wooCatId = $this->ensureCategorySynced($productData['category_id']);
            if ($wooCatId) {
                $data['categories'] = [['id' => $wooCatId]];
            }
        }

        // Handle Brands
        if (!empty($productData['brand_id'])) {
            $wooBrandTermId = $this->ensureBrandSynced($productData['brand_id']);
            if ($wooBrandTermId) {
                $brandAttrId = $this->getBrandAttributeId();
                if ($brandAttrId) {
                    $data['attributes'][] = [
                        'id' => $brandAttrId,
                        'visible' => true,
                        'variation' => false,
                        'options' => [(string)$this->getBrandName($productData['brand_id'])]
                    ];
                }
            }
        }
        
        // Handle Images (preserve featured when adding gallery)
        $shouldUpdateImages = false;
        if (!empty($productData['local_image_path'])) $shouldUpdateImages = true;
        if (!empty($productData['gallery_images']) || !empty($productData['gallery_local_paths'])) $shouldUpdateImages = true;
        $isClear = array_key_exists('image_url', $productData) && $productData['image_url'] === '';
        if ($isClear) $shouldUpdateImages = true;

        if ($shouldUpdateImages) {
            $images = [];
            $seenSrcs = [];
            $seenIds = [];
            // Consider nueva principal solo si viene archivo local
            $hasNewMain = !empty($productData['local_image_path']);

            if (!$hasNewMain && !$isClear) {
                $endpointGet = rtrim($this->settings['woocommerce_url'], '/') . "/wp-json/wc/v3/products/{$wooId}";
                $existing = $this->makeRequest('GET', $endpointGet);
                if ($existing['success'] && !empty($existing['data']['images'])) {
                    $removeSet = [];
                    if (!empty($productData['remove_gallery']) && is_array($productData['remove_gallery'])) {
                        $removeSet = array_flip($productData['remove_gallery']);
                    }
                    foreach ($existing['data']['images'] as $idx => $img) {
                        $src = $img['src'] ?? null;
                        // Si es imagen de galería y está marcada para eliminar, la omitimos
                        if ($idx > 0 && $src && isset($removeSet[$src])) {
                            continue;
                        }
                        if (!empty($img['id'])) {
                            if (!isset($seenIds[$img['id']])) {
                                $images[] = ['id' => $img['id']];
                                $seenIds[$img['id']] = true;
                            }
                        } elseif ($src) {
                            if (!isset($seenSrcs[$src])) {
                                $images[] = ['src' => $src];
                                $seenSrcs[$src] = true;
                            }
                        }
                    }
                }
            }

            // Si no hay nueva principal pero se recibió image_url (existente), aseguramos que esté como primera
            if (!$hasNewMain && !$isClear && !empty($productData['image_url'])) {
                $src = $productData['image_url'];
                $alreadyFirst = !empty($images) && ((isset($images[0]['src']) && $images[0]['src'] === $src));
                if (!$alreadyFirst && !isset($seenSrcs[$src])) {
                    // Evitar duplicados: elimina si ya existe en posiciones posteriores
                    $images = array_values(array_filter($images, function($e) use ($src) {
                        return !(isset($e['src']) && $e['src'] === $src);
                    }));
                    array_unshift($images, ['src' => $src]);
                    $seenSrcs[$src] = true;
                }
            }

            if (!empty($productData['local_image_path'])) {
                $upMain = $this->uploadImage($productData['local_image_path']);
                if ($upMain['success'] && isset($upMain['data']['id'])) {
                    $mid = $upMain['data']['id'];
                    $images = array_values(array_filter($images, function($e) use ($mid) { return !isset($e['id']) || $e['id'] !== $mid; }));
                    array_unshift($images, ['id' => $mid]);
                    $seenIds[$mid] = true;
                } elseif (!empty($productData['image_url'])) {
                    $src = $productData['image_url'];
                    $images = array_values(array_filter($images, function($e) use ($src) { return !isset($e['src']) || $e['src'] !== $src; }));
                    array_unshift($images, ['src' => $src]);
                    $seenSrcs[$src] = true;
                }
            } elseif ($isClear) {
                $images = [];
            }

            $galleryUrls = [];
            if (!empty($productData['gallery_images']) && is_array($productData['gallery_images'])) {
                $galleryUrls = array_values($productData['gallery_images']);
            }
            $galleryLocals = [];
            if (!empty($productData['gallery_local_paths']) && is_array($productData['gallery_local_paths'])) {
                $galleryLocals = array_values($productData['gallery_local_paths']);
            }
            $max = max(count($galleryUrls), count($galleryLocals));
            for ($i = 0; $i < $max; $i++) {
                $local = $galleryLocals[$i] ?? null;
                $url = $galleryUrls[$i] ?? null;
                if (!empty($local)) {
                    $up = $this->uploadImage($local);
                    if ($up['success'] && isset($up['data']['id'])) {
                        $mid = $up['data']['id'];
                        if (!isset($seenIds[$mid])) {
                            $images[] = ['id' => $mid];
                            $seenIds[$mid] = true;
                        }
                        continue;
                    }
                }
                if (!empty($url) && !isset($seenSrcs[$url])) {
                    $images[] = ['src' => $url];
                    $seenSrcs[$url] = true;
                }
            }
            $data['images'] = $images;
        }

        // First update base product
        $baseRes = $this->makeRequest('PUT', $endpoint, $data);
        if (!$baseRes['success']) {
            return $baseRes;
        }

        // If it's a variable product, sync its variations separately
        if (($productData['type'] ?? 'simple') !== 'simple' && !empty($productData['variations']) && is_array($productData['variations'])) {
            $syncRes = $this->syncVariations($wooId, $productData);
            if (!$syncRes['success']) {
                // Return partial success info
                return ['success' => false, 'message' => 'Producto actualizado, pero fallo al sincronizar variaciones: ' . ($syncRes['message'] ?? 'Error desconocido')];
            }
        }

        return $baseRes;
    }

    public function removeGalleryImage($wooId, $imageUrl)
    {
        if (!$this->isEnabled()) {
            return ['success' => false, 'message' => 'WooCommerce integration disabled'];
        }
        if (empty($wooId) || empty($imageUrl)) {
            return ['success' => false, 'message' => 'Parámetros inválidos para eliminar imagen'];
        }

        $endpoint = rtrim($this->settings['woocommerce_url'], '/') . "/wp-json/wc/v3/products/{$wooId}";
        $current = $this->makeRequest('GET', $endpoint);
        if (!$current['success']) {
            return $current;
        }
        $images = $current['data']['images'] ?? [];
        if (empty($images)) {
            return ['success' => true, 'message' => 'Sin imágenes que actualizar'];
        }

        $newImages = [];
        foreach ($images as $idx => $img) {
            $src = $img['src'] ?? null;
            // Nunca eliminar la primera imagen (principal) con este método
            if ($idx > 0 && $src === $imageUrl) {
                continue;
            }
            if (!empty($img['id'])) {
                $newImages[] = ['id' => $img['id']];
            } elseif ($src) {
                $newImages[] = ['src' => $src];
            }
        }

        $payload = ['images' => $newImages];
        return $this->makeRequest('PUT', $endpoint, $payload);
    }

    public function getProductVariations($wooProductId)
    {
        if (!$this->isEnabled() || empty($wooProductId)) {
            return ['success' => false, 'message' => 'WooCommerce disabled or invalid product id'];
        }
        $endpoint = rtrim($this->settings['woocommerce_url'], '/') . "/wp-json/wc/v3/products/{$wooProductId}/variations?per_page=100";
        return $this->makeRequest('GET', $endpoint);
    }

    private function syncVariations($wooProductId, $productData)
    {
        // Fetch existing variations
        $endpointList = rtrim($this->settings['woocommerce_url'], '/') . "/wp-json/wc/v3/products/{$wooProductId}/variations?per_page=100";
        $existingRes = $this->makeRequest('GET', $endpointList);
        if (!$existingRes['success']) {
            return $existingRes;
        }
        $existing = $existingRes['data'];
        $bySku = [];
        foreach ($existing as $ev) {
            if (!empty($ev['sku'])) {
                $bySku[$ev['sku']] = $ev;
            }
        }

        foreach ($productData['variations'] as $v) {
            $sku = $v['sku'] ?? null;
            $attrs = [];
            $sizeAttrId = $this->getAttributeIdBySlugOrName('talla');
            $colorAttrId = $this->getAttributeIdBySlugOrName('color');
            if (!empty($v['size'])) {
                if ($sizeAttrId) $attrs[] = ['id' => $sizeAttrId, 'option' => (string)$v['size']];
                else $attrs[] = ['name' => 'Talla', 'option' => (string)$v['size']];
            }
            if (!empty($v['color'])) {
                if ($colorAttrId) $attrs[] = ['id' => $colorAttrId, 'option' => (string)$v['color']];
                else $attrs[] = ['name' => 'Color', 'option' => (string)$v['color']];
            }
            if (!empty($v['detail'])) $attrs[] = ['name' => 'Detalle', 'option' => (string)$v['detail']];

            $payload = [
                'manage_stock' => true,
                'stock_quantity' => (int)($v['stock'] ?? 0),
                'regular_price' => (string)($v['price'] ?? ($productData['price'] ?? 0)),
                'attributes' => $attrs
            ];
            if (!empty($sku)) {
                $payload['sku'] = $sku;
            }

            if ($sku && isset($bySku[$sku])) {
                // Update
                $varId = $bySku[$sku]['id'];
                $endpoint = rtrim($this->settings['woocommerce_url'], '/') . "/wp-json/wc/v3/products/{$wooProductId}/variations/{$varId}";
                $res = $this->makeRequest('PUT', $endpoint, $payload);
                if (!$res['success']) {
                    return $res;
                }
            } else {
                // Create
                $endpoint = rtrim($this->settings['woocommerce_url'], '/') . "/wp-json/wc/v3/products/{$wooProductId}/variations";
                $res = $this->makeRequest('POST', $endpoint, $payload);
                if (!$res['success']) {
                    return $res;
                }
            }
        }

        return ['success' => true];
    }

    // --- Fetch All Products for Export (Direct API) ---
    public function fetchAllProductsFromApi()
    {
        if (!$this->isEnabled()) {
            return ['success' => false, 'message' => 'WooCommerce integration is disabled or incomplete'];
        }

        $allProducts = [];
        $page = 1;
        $perPage = 100; // Max allowed by Woo is usually 100
        $keepFetching = true;

        while ($keepFetching) {
            $endpoint = rtrim($this->settings['woocommerce_url'], '/') . '/wp-json/wc/v3/products';
            $params = [
                'per_page' => $perPage,
                'page' => $page,
                'orderby' => 'id',
                'order' => 'asc'
            ];
            
            $url = $endpoint . '?' . http_build_query($params);
            $result = $this->makeRequest('GET', $url);

            if (!$result['success']) {
                // If error on first page, fail. If later page, return partial.
                if ($page === 1) {
                    return $result;
                }
                break;
            }

            $products = $result['data'];
            
            if (empty($products)) {
                $keepFetching = false;
            } else {
                $allProducts = array_merge($allProducts, $products);
                $page++;
                // Safety break to prevent infinite loops or huge memory usage
                if ($page > 20) break; // Max 2000 products for now
            }
        }

        return ['success' => true, 'data' => $allProducts];
    }

    public function getProductById($wooId)
    {
        if (!$this->isEnabled()) {
            return ['success' => false, 'message' => 'WooCommerce integration is disabled or incomplete'];
        }
        if (empty($wooId)) {
            return ['success' => false, 'message' => 'Invalid WooCommerce product id'];
        }
        $endpoint = rtrim($this->settings['woocommerce_url'], '/') . "/wp-json/wc/v3/products/{$wooId}";
        return $this->makeRequest('GET', $endpoint);
    }

    // --- Product Sync (Import) ---
    public function syncProducts()
    {
        if (!$this->isEnabled()) {
            return ['success' => false, 'message' => 'WooCommerce integration is disabled or incomplete'];
        }

        // 1. Fetch ALL products
        $allProducts = [];
        $page = 1;
        $perPage = 50; 
        $keepFetching = true;
        
        set_time_limit(0); 

        while ($keepFetching) {
            $endpoint = rtrim($this->settings['woocommerce_url'], '/') . '/wp-json/wc/v3/products';
            $params = [
                'per_page' => $perPage,
                'page' => $page,
                'orderby' => 'id',
                'order' => 'asc'
            ];
            
            $url = $endpoint . '?' . http_build_query($params);
            $result = $this->makeRequest('GET', $url);

            if (!$result['success']) {
                // If error on first page, fail. 
                if ($page === 1) return $result;
                // If error on later pages, stop but process what we have
                break;
            }

            $products = $result['data'];
            if (empty($products)) {
                $keepFetching = false;
            } else {
                $allProducts = array_merge($allProducts, $products);
                $page++;
                // Safety limit: 100 pages * 50 products = 5000 products
                if ($page > 100) break; 
            }
        }

        if (empty($allProducts)) {
             return ['success' => true, 'message' => 'No products found in WooCommerce', 'synced' => 0];
        }

        $syncedCount = 0;
        $errors = [];

        foreach ($allProducts as $wcProduct) {
            try {
                $this->conn->beginTransaction();

                // 1. Resolve Category
                $categoryId = null;
                if (!empty($wcProduct['categories'])) {
                    // Use the first category
                    $wcCat = $wcProduct['categories'][0];
                    $categoryId = $this->resolveLocalCategory($wcCat);
                }

                // 2. Resolve Brand (if exists in attributes)
                $brandId = null;
                if (!empty($wcProduct['attributes'])) {
                    foreach ($wcProduct['attributes'] as $attr) {
                        if (strtolower($attr['name']) === 'marca' || strtolower($attr['name']) === 'brand') {
                            if (!empty($attr['options'][0])) {
                                $brandId = $this->resolveLocalBrand($attr['options'][0]);
                            }
                            break;
                        }
                    }
                }

                // 3. Upsert Product
                // Check if exists by WC ID
                $stmt = $this->conn->prepare("SELECT id FROM products WHERE woocommerce_id = ?");
                $stmt->execute([$wcProduct['id']]);
                $existingId = $stmt->fetchColumn();

                // If not found by ID, try by SKU if present
                if (!$existingId && !empty($wcProduct['sku'])) {
                    $stmt = $this->conn->prepare("SELECT id FROM products WHERE sku = ?");
                    $stmt->execute([$wcProduct['sku']]);
                    $existingId = $stmt->fetchColumn();
                }

                $name = $wcProduct['name'];
                $sku = !empty($wcProduct['sku']) ? $wcProduct['sku'] : 'WC-' . $wcProduct['id']; // Fallback SKU
                // Saneamos el precio porque Woo puede enviar '' o strings no numéricos
                $priceRaw = $wcProduct['regular_price'] ?? ($wcProduct['price'] ?? null);
                if ($priceRaw === '' || $priceRaw === null || !is_numeric($priceRaw)) {
                    $price = 0.00;
                } else {
                    $price = (float)$priceRaw;
                }
                // Saneamos el stock
                $stockRaw = $wcProduct['stock_quantity'] ?? 0;
                $stock = is_numeric($stockRaw) ? (int)$stockRaw : 0;
                $description = $wcProduct['description'] ?? ''; // Added description
                
                // Fix Image URL mapping
                $imageUrl = '';
                if (!empty($wcProduct['images']) && is_array($wcProduct['images']) && isset($wcProduct['images'][0]['src'])) {
                    $imageUrl = $wcProduct['images'][0]['src'];
                }

                if ($existingId) {
                    // Update
                    $stmt = $this->conn->prepare("UPDATE products SET 
                        name = ?, 
                        sku = ?,
                        price_pen = ?, 
                        stock_quantity = ?, 
                        category_id = ?, 
                        brand_id = ?, 
                        image_url = ?, 
                        description = ?,
                        woocommerce_id = ?,
                        updated_at = NOW()
                        WHERE id = ?");
                    $stmt->execute([
                        $name, $sku, $price, $stock, $categoryId, $brandId, $imageUrl, $description, $wcProduct['id'], $existingId
                    ]);
                } else {
                    // Insert
                    $stmt = $this->conn->prepare("INSERT INTO products (
                        name, sku, price_pen, stock_quantity, category_id, brand_id, image_url, description, woocommerce_id, created_at, updated_at, active
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), 1)");
                    $stmt->execute([
                        $name, $sku, $price, $stock, $categoryId, $brandId, $imageUrl, $description, $wcProduct['id']
                    ]);
                    $existingId = $this->conn->lastInsertId();
                    
                    // Initialize warehouse stock (default warehouse 1)
                    $stmt = $this->conn->prepare("INSERT INTO product_stocks (product_id, warehouse_id, quantity) VALUES (?, 1, ?)");
                    $stmt->execute([$existingId, $stock]);
                }

                $this->conn->commit();
                $syncedCount++;

            } catch (\Exception $e) {
                if ($this->conn->inTransaction()) {
                    $this->conn->rollBack();
                }
                $errors[] = "Product {$wcProduct['id']}: " . $e->getMessage();
            }
        }

        // 4. Handle Deletions: Soft delete local products that are no longer in WooCommerce
        // We assume $allProducts contains ALL products from Woo.
        if (!empty($allProducts)) {
            $fetchedWooIds = array_column($allProducts, 'id');
            $fetchedMap = array_flip($fetchedWooIds);
            
            // Get all local products with woocommerce_id
            $stmt = $this->conn->query("SELECT id, woocommerce_id FROM products WHERE woocommerce_id IS NOT NULL AND active = 1");
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $wooId = $row['woocommerce_id'];
                // If local product has Woo ID but is not in the fetched list, it means it was deleted in Woo
                if (!isset($fetchedMap[$wooId])) {
                     $this->conn->prepare("UPDATE products SET active = 0 WHERE id = ?")->execute([$row['id']]);
                }
            }
        }

        return ['success' => true, 'synced' => $syncedCount, 'errors' => $errors];
    }

    // --- Product Export (Create) ---


    public function createProduct($productData)
    {
        if (!$this->isEnabled()) {
            return ['success' => false, 'message' => 'WooCommerce integration is disabled or incomplete'];
        }

        $endpoint = rtrim($this->settings['woocommerce_url'], '/') . '/wp-json/wc/v3/products';
        
        $type = $productData['type'] ?? 'simple';

        $data = [
            'name' => $productData['name'],
            'type' => $type,
            'description' => $productData['description'] ?? '',
            'short_description' => $productData['short_description'] ?? '',
            'sku' => $productData['sku'] ?? '',
        ];

        if ($type === 'simple') {
             $data['regular_price'] = (string)$productData['price'];
             $data['manage_stock'] = true;
             $data['stock_quantity'] = (int)($productData['stock'] ?? 0);
             $data['low_stock_amount'] = (int)($productData['min_stock'] ?? 0);
        } else {
            // Parent of variable products should not manage stock
            $data['manage_stock'] = false;
        }

        // Handle Categories
        if (!empty($productData['category_id'])) {
            $wooCatId = $this->ensureCategorySynced($productData['category_id']);
            if ($wooCatId) {
                $data['categories'] = [['id' => $wooCatId]];
            }
        }

        // Handle Brands (as Attributes)
        if (!empty($productData['brand_id'])) {
            $wooBrandTermId = $this->ensureBrandSynced($productData['brand_id']);
            if ($wooBrandTermId) {
                // Find or Create 'brand' attribute ID
                $brandAttrId = $this->getBrandAttributeId();
                if ($brandAttrId) {
                    $data['attributes'][] = [
                        'id' => $brandAttrId,
                        'visible' => true,
                        'variation' => false,
                        'options' => [(string)$this->getBrandName($productData['brand_id'])]
                    ];
                }
            }
        }
        
        // Handle Extra Fields as Attributes
        $extraFields = [
            'barcode' => 'Código de Barras',
            'material' => 'Material',
            'collection' => 'Colección',
            'gender' => 'Sexo',
            'pattern' => 'Diseño',
            'sleeve' => 'Manga',
            'line' => 'Línea'
        ];
        
        // For simple products, we can just add them.
        // For variable products, if we want to use them for variations, we need to handle them differently.
        // But here these are just informative attributes for now.
        
        foreach ($extraFields as $key => $label) {
            if (!empty($productData[$key])) {
                $data['attributes'][] = [
                    'name' => $label,
                    'visible' => true,
                    'variation' => false,
                    'options' => [(string)$productData[$key]]
                ];
            }
        }

        // Handle Variations Data Preparation
        if ($type === 'variable' && !empty($productData['variations'])) {
            // We need to define attributes for variations first (Talla, Color, Detalle)
            // 'size' -> 'Talla', 'color' -> 'Color', 'detail' -> 'Detalle'
            
            $varAttributes = [];
            $allSizes = [];
            $allColors = [];
            $allDetails = [];

            foreach ($productData['variations'] as $v) {
                if (!empty($v['size'])) $allSizes[] = $v['size'];
                if (!empty($v['color'])) $allColors[] = $v['color'];
                if (!empty($v['detail'])) $allDetails[] = $v['detail'];
            }
            
            $allSizes = array_values(array_unique($allSizes));
            $allColors = array_values(array_unique($allColors));
            $allDetails = array_values(array_unique($allDetails));

            if (!empty($allSizes)) {
                 $data['attributes'][] = [
                    'name' => 'Talla',
                    'visible' => true,
                    'variation' => true,
                    'options' => $allSizes
                 ];
            }
            if (!empty($allColors)) {
                 $data['attributes'][] = [
                    'name' => 'Color',
                    'visible' => true,
                    'variation' => true,
                    'options' => $allColors
                 ];
            }
            if (!empty($allDetails)) {
                $designAttrId = $this->getAttributeIdBySlugOrName('diseño');
                if (!$designAttrId) {
                    $designAttrId = $this->getAttributeIdBySlugOrName('diseno');
                }
                if ($designAttrId) {
                    $data['attributes'][] = [
                        'id' => $designAttrId,
                        'visible' => true,
                        'variation' => true,
                        'options' => $allDetails
                    ];
                } else {
                    $data['attributes'][] = [
                        'name' => 'Diseño',
                        'visible' => true,
                        'variation' => true,
                        'options' => $allDetails
                    ];
                }
           }
        }
        
        // Handle Image
        $images = [];
        $seenSrcs = [];
        $seenIds = [];
        
        // Priority: Local file path upload (for robustness), then URL
        if (!empty($productData['local_image_path'])) {
            $this->log("createProduct: Trying local image upload: " . $productData['local_image_path']);
            $uploadRes = $this->uploadImage($productData['local_image_path']);
            if ($uploadRes['success']) {
                $mediaId = $uploadRes['data']['id'];
                if (!isset($seenIds[$mediaId])) {
                    $images[] = ['id' => $mediaId];
                    $seenIds[$mediaId] = true;
                }
                $this->log("createProduct: Local image upload OK, media id=" . $uploadRes['data']['id']);
            } else {
                // Fallback to URL if upload fails
                if (!empty($productData['image_url'])) {
                    $this->log("createProduct: Upload failed, fallback to image URL: " . $productData['image_url']);
                    $src = $productData['image_url'];
                    if (!isset($seenSrcs[$src])) {
                        $images[] = ['src' => $src];
                        $seenSrcs[$src] = true;
                    }
                }
            }
        } elseif (!empty($productData['image_url'])) {
            $this->log("createProduct: Using image URL directly: " . $productData['image_url']);
            $src = $productData['image_url'];
            if (!isset($seenSrcs[$src])) {
                $images[] = ['src' => $src];
                $seenSrcs[$src] = true;
            }
        }

        // Handle Gallery
        $galleryUrls = [];
        if (!empty($productData['gallery_images']) && is_array($productData['gallery_images'])) {
            $galleryUrls = array_values($productData['gallery_images']);
        }
        $galleryLocals = [];
        if (!empty($productData['gallery_local_paths']) && is_array($productData['gallery_local_paths'])) {
            $galleryLocals = array_values($productData['gallery_local_paths']);
        }

        // Prefer local upload for gallery when paths are provided; fallback to URLs by index
        $max = max(count($galleryUrls), count($galleryLocals));
        for ($i = 0; $i < $max; $i++) {
            $local = $galleryLocals[$i] ?? null;
            $url = $galleryUrls[$i] ?? null;
            if (!empty($local)) {
                $this->log("createProduct: Gallery local upload: $local");
                $up = $this->uploadImage($local);
                if ($up['success'] && isset($up['data']['id'])) {
                    $mid = $up['data']['id'];
                    if (!isset($seenIds[$mid])) {
                        $images[] = ['id' => $mid];
                        $seenIds[$mid] = true;
                    }
                    continue;
                } else {
                    $this->log("createProduct: Gallery local upload failed, will fallback if URL present");
                }
            }
            if (!empty($url) && !isset($seenSrcs[$url])) {
                $images[] = ['src' => $url];
                $seenSrcs[$url] = true;
            }
        }
        
        if (!empty($images)) {
            $data['images'] = $images;
        }
        
        // CREATE PARENT PRODUCT
        $result = $this->makeRequest('POST', $endpoint, $data);

        // If variable product created successfully, create variations
        if ($result['success'] && $type === 'variable' && !empty($productData['variations'])) {
             $parentId = $result['data']['id'];
             $this->createVariations($parentId, $productData['variations'], $productData['price']);
        }
        
        return $result;
    }

    private function createVariations($parentId, $variations, $regularPrice) {
        $endpoint = rtrim($this->settings['woocommerce_url'], '/') . "/wp-json/wc/v3/products/$parentId/variations/batch";
        
        $createData = [];
        foreach ($variations as $v) {
            $attributes = [];
            if (!empty($v['size'])) $attributes[] = ['name' => 'Talla', 'option' => $v['size']];
            if (!empty($v['color'])) $attributes[] = ['name' => 'Color', 'option' => $v['color']];
            if (!empty($v['detail'])) $attributes[] = ['name' => 'Detalle', 'option' => $v['detail']];
            
            $createData[] = [
                'regular_price' => (string)$regularPrice,
                'stock_quantity' => (int)($v['stock'] ?? 0),
                'manage_stock' => true,
                'sku' => $v['sku'] ?? '',
                'attributes' => $attributes
            ];
        }
        
        // Batch create (max 100 per request, we assume less here)
        $payload = ['create' => $createData];
        $this->makeRequest('POST', $endpoint, $payload);
    }

    // --- Order Sync ---
    public function syncOrders()
    {
        if (!$this->isEnabled()) {
            return ['success' => false, 'message' => 'WooCommerce integration is disabled or incomplete'];
        }

        $endpoint = rtrim($this->settings['woocommerce_url'], '/') . '/wp-json/wc/v3/orders';
        $params = [
            'per_page' => 20,
            'orderby' => 'date',
            'order' => 'desc'
        ];
        
        $url = $endpoint . '?' . http_build_query($params);
        $result = $this->makeRequest('GET', $url);

        if (!$result['success']) {
            return $result;
        }

        $syncedCount = 0;
        $errors = [];

        foreach ($result['data'] as $wcOrder) {
            try {
                // Check if exists
                $stmt = $this->conn->prepare("SELECT id FROM orders WHERE woocommerce_order_id = ?");
                $stmt->execute([$wcOrder['id']]);
                if ($stmt->fetch()) {
                    continue; // Already synced
                }

                $this->conn->beginTransaction();

                // 1. Customer
                $customerId = $this->ensureCustomer($wcOrder);

                // 2. Order
                $statusMap = [
                    'pending' => 'PENDING',
                    'processing' => 'PAID',
                    'on-hold' => 'PENDING',
                    'completed' => 'PAID',
                    'cancelled' => 'CANCELLED',
                    'refunded' => 'REFUNDED',
                    'failed' => 'CANCELLED',
                    'trash' => 'CANCELLED'
                ];
                $localStatus = $statusMap[$wcOrder['status']] ?? 'PENDING';
                
                // Payment Method
                $paymentMethod = $wcOrder['payment_method_title'] ?? 'N/A';
                
                // Generate Order Number if needed, or use WC ID
                $orderNumber = 'WEB-' . $wcOrder['id'];

                $stmt = $this->conn->prepare("INSERT INTO orders (
                    order_number, 
                    customer_id, 
                    user_id, 
                    total_amount, 
                    currency, 
                    status, 
                    payment_method, 
                    receipt_type, 
                    invoice_type, 
                    origin, 
                    woocommerce_order_id, 
                    created_at,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

                // Use a default user ID for web orders (e.g., admin or a specific system user)
                $systemUserId = 1; 

                // Format date
                $createdAt = date('Y-m-d H:i:s', strtotime($wcOrder['date_created']));
                $updatedAt = date('Y-m-d H:i:s', strtotime($wcOrder['date_modified']));

                $stmt->execute([
                    $orderNumber,
                    $customerId,
                    $systemUserId,
                    $wcOrder['total'],
                    $wcOrder['currency'],
                    $localStatus,
                    $paymentMethod,
                    'Boleta', // Default
                    'BOLETA', // Default
                    'WEB',
                    $wcOrder['id'],
                    $createdAt,
                    $updatedAt
                ]);
                
                $localOrderId = $this->conn->lastInsertId();

                // 3. Items
                foreach ($wcOrder['line_items'] as $item) {
                    $localProductId = $this->findLocalProduct($item);
                    
                    if ($localProductId) {
                        $quantity = $item['quantity'];
                        $price = $item['price']; // Unit price? WC sends total and subtotal usually. 
                        // item['price'] is unit price in v3. item['total'] is line total.
                        // Wait, let's verify WC API response structure for price.
                        // Usually item['price'] is the price per unit.
                        
                        $stmtItem = $this->conn->prepare("INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)");
                        $stmtItem->execute([
                            $localOrderId,
                            $localProductId,
                            $quantity,
                            $item['price'],
                            $item['total']
                        ]);

                        // Update Stock (Deduct)
                        // Only deduct if not cancelled/failed
                        if (!in_array($localStatus, ['CANCELLED', 'REFUNDED'])) {
                            $updateStock = $this->conn->prepare("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?");
                            $updateStock->execute([$quantity, $localProductId]);
                            
                            // Log movement
                            $moveSql = "INSERT INTO inventory_movements (product_id, type, quantity, notes, created_at) VALUES (?, 'OUT', ?, ?, NOW())";
                            $moveStmt = $this->conn->prepare($moveSql);
                            $moveStmt->execute([$localProductId, $quantity, "Venta Web #" . $wcOrder['id']]);
                        }
                    }
                }
                
                // 4. Shipping (Optional - basic info)
                if (!empty($wcOrder['shipping'])) {
                    // Could insert into shipments table if needed
                }

                $this->conn->commit();
                $syncedCount++;

            } catch (\Exception $e) {
                if ($this->conn->inTransaction()) {
                    $this->conn->rollBack();
                }
                $errors[] = "Order {$wcOrder['id']}: " . $e->getMessage();
            }
        }

        return ['success' => true, 'synced' => $syncedCount, 'errors' => $errors];
    }

    private function ensureCustomer($wcOrder)
    {
        $billing = $wcOrder['billing'];
        $email = $billing['email'];
        $wcCustomerId = $wcOrder['customer_id']; // 0 if guest

        // 1. Try find by WooCommerce ID
        if ($wcCustomerId > 0) {
            $stmt = $this->conn->prepare("SELECT id FROM customers WHERE woocommerce_id = ?");
            $stmt->execute([$wcCustomerId]);
            $id = $stmt->fetchColumn();
            if ($id) return $id;
        }

        // 2. Try find by Email
        if (!empty($email)) {
            $stmt = $this->conn->prepare("SELECT id FROM customers WHERE email = ?");
            $stmt->execute([$email]);
            $id = $stmt->fetchColumn();
            if ($id) {
                // Link WC ID if not linked
                if ($wcCustomerId > 0) {
                    $this->conn->prepare("UPDATE customers SET woocommerce_id = ? WHERE id = ?")->execute([$wcCustomerId, $id]);
                }
                return $id;
            }
        }

        // 3. Create New Customer
        $firstName = $billing['first_name'];
        $lastName = $billing['last_name'];
        $phone = $billing['phone'];
        $address = $billing['address_1'] . ' ' . $billing['address_2'] . ', ' . $billing['city'];
        
        // Generate dummy doc number if not present (WEB-TIMESTAMP)
        $docNumber = 'WEB-' . time() . '-' . rand(100,999);
        
        $stmt = $this->conn->prepare("INSERT INTO customers (
            first_name, last_name, email, phone, address, 
            doc_type, doc_number, woocommerce_id, created_at
        ) VALUES (?, ?, ?, ?, ?, 'DNI', ?, ?, NOW())");
        
        $stmt->execute([
            $firstName, $lastName, $email, $phone, $address, 
            $docNumber, ($wcCustomerId > 0 ? $wcCustomerId : null)
        ]);
        
        return $this->conn->lastInsertId();
    }

    private function findLocalProduct($item)
    {
        // 1. Try by SKU
        if (!empty($item['sku'])) {
            $stmt = $this->conn->prepare("SELECT id FROM products WHERE sku = ?");
            $stmt->execute([$item['sku']]);
            $id = $stmt->fetchColumn();
            if ($id) return $id;
        }

        // 2. Try by WC Product ID
        if (!empty($item['product_id'])) {
            $stmt = $this->conn->prepare("SELECT id FROM products WHERE woocommerce_id = ?");
            $stmt->execute([$item['product_id']]);
            $id = $stmt->fetchColumn();
            if ($id) return $id;
        }
        
        return null; // Product not found locally
    }

    // --- Resolvers for Import ---

    private function resolveLocalCategory($wcCategory)
    {
        $wooId = $wcCategory['id'];
        $name = $wcCategory['name'];
        $slug = $wcCategory['slug'] ?? '';

        // 1. Try by Woo ID
        $stmt = $this->conn->prepare("SELECT id FROM categories WHERE woocommerce_id = ?");
        $stmt->execute([$wooId]);
        $id = $stmt->fetchColumn();
        if ($id) return $id;

        // 2. Try by Slug (if provided)
        if (!empty($slug)) {
            try {
                $stmt = $this->conn->prepare("SELECT id FROM categories WHERE slug = ?");
                $stmt->execute([$slug]);
                $id = $stmt->fetchColumn();
                if ($id) {
                    $this->conn->prepare("UPDATE categories SET woocommerce_id = ? WHERE id = ?")->execute([$wooId, $id]);
                    return $id;
                }
            } catch (\Exception $e) {
                // Ignore if slug column missing
            }
        }

        // 3. Try by Name
        $stmt = $this->conn->prepare("SELECT id FROM categories WHERE LOWER(name) = LOWER(?)");
        $stmt->execute([$name]);
        $id = $stmt->fetchColumn();
        
        if ($id) {
            // Link Woo ID
            $stmt = $this->conn->prepare("UPDATE categories SET woocommerce_id = ? WHERE id = ?");
            $stmt->execute([$wooId, $id]);
            return $id;
        }

        // 4. Create New
        try {
            if (!empty($slug)) {
                $stmt = $this->conn->prepare("INSERT INTO categories (name, slug, woocommerce_id, created_at, active) VALUES (?, ?, ?, NOW(), 1)");
                $stmt->execute([$name, $slug, $wooId]);
            } else {
                $stmt = $this->conn->prepare("INSERT INTO categories (name, woocommerce_id, created_at, active) VALUES (?, ?, NOW(), 1)");
                $stmt->execute([$name, $wooId]);
            }
            return $this->conn->lastInsertId();
        } catch (\Exception $e) {
            // Fallback (e.g. slug duplicate)
            $stmt = $this->conn->prepare("INSERT INTO categories (name, woocommerce_id, created_at, active) VALUES (?, ?, NOW(), 1)");
            $stmt->execute([$name, $wooId]);
            return $this->conn->lastInsertId();
        }
    }

    private function resolveLocalBrand($brandName)
    {
        // 1. Try by Name
        $stmt = $this->conn->prepare("SELECT id FROM brands WHERE LOWER(name) = LOWER(?)");
        $stmt->execute([$brandName]);
        $id = $stmt->fetchColumn();
        if ($id) return $id;

        // 2. Create New
        $stmt = $this->conn->prepare("INSERT INTO brands (name, created_at) VALUES (?, NOW())");
        $stmt->execute([$brandName]);
        return $this->conn->lastInsertId();
    }

    // --- Category Sync ---
    public function ensureCategorySynced($localCategoryId)
    {
        // Check if we have woo_id
        $stmt = $this->conn->prepare("SELECT name, woocommerce_id FROM categories WHERE id = ?");
        $stmt->execute([$localCategoryId]);
        $cat = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$cat) return null;
        if (!empty($cat['woocommerce_id'])) return $cat['woocommerce_id'];

        // Not synced, create in Woo
        $endpoint = rtrim($this->settings['woocommerce_url'], '/') . '/wp-json/wc/v3/products/categories';
        $payload = ['name' => $cat['name']];
        
        // First check if exists by name in Woo (to avoid dups if DB was reset)
        // Optimization: For now just try create, if 400 (slug exists), we search. 
        // But to be safe let's just create.
        
        $result = $this->makeRequest('POST', $endpoint, $payload);
        
        if ($result['success']) {
            $wooId = $result['data']['id'];
            $update = $this->conn->prepare("UPDATE categories SET woocommerce_id = ? WHERE id = ?");
            $update->execute([$wooId, $localCategoryId]);
            return $wooId;
        }
        
        return null;
    }

    // --- Brand Sync (Taxonomy or Attribute) ---
    public function syncBrands()
    {
        if (!$this->isEnabled()) {
            return ['success' => false, 'message' => 'WooCommerce integration is disabled or incomplete'];
        }

        $config = $this->getBrandConfig();
        if (!$config) {
            return ['success' => false, 'message' => 'Could not determine Brand configuration in WooCommerce'];
        }

        $endpoint = $config['endpoint'];
        $page = 1;
        $perPage = 100;
        $keepFetching = true;
        $syncedCount = 0;
        $errors = [];
        $allBrands = [];

        // 1. Fetch ALL brands first
        while ($keepFetching) {
            $params = [
                'per_page' => $perPage,
                'page' => $page,
                'orderby' => 'name', // WP API often uses name, WC API id
                'order' => 'asc',
                'hide_empty' => false
            ];
            
            // WP API (wp/v2) uses 'per_page', WC API (wc/v3) uses 'per_page'
            // WP API might not support orderby=id for terms, let's use name
            
            $url = $endpoint . '?' . http_build_query($params);
            $result = $this->makeRequest('GET', $url);

            if (!$result['success']) {
                if ($page === 1) return $result;
                break;
            }

            $brands = $result['data'];
            if (empty($brands)) {
                $keepFetching = false;
            } else {
                $allBrands = array_merge($allBrands, $brands);
                $page++;
                if ($page > 20) break; // Safety limit
            }
        }

        // 2. Upsert brands locally
        foreach ($allBrands as $brand) {
            try {
                $wooId = $brand['id'];
                $name = $brand['name'];
                $description = $brand['description'] ?? '';
                $slug = $brand['slug'] ?? '';
                
                // 1. Try to find by woocommerce_id
                $stmt = $this->conn->prepare("SELECT id FROM brands WHERE woocommerce_id = ?");
                $stmt->execute([$wooId]);
                $existingId = $stmt->fetchColumn();

                if (!$existingId) {
                    // 2. Try to find by name (fallback)
                    $stmt = $this->conn->prepare("SELECT id FROM brands WHERE name = ?");
                    $stmt->execute([$name]);
                    $existingId = $stmt->fetchColumn();
                }

                if ($existingId) {
                    // Update existing
                    $updateStmt = $this->conn->prepare("UPDATE brands SET name = ?, description = ?, slug = ?, woocommerce_id = ? WHERE id = ?");
                    $updateStmt->execute([$name, $description, $slug, $wooId, $existingId]);
                } else {
                    // Insert new
                    $insertStmt = $this->conn->prepare("INSERT INTO brands (name, description, slug, woocommerce_id, active) VALUES (?, ?, ?, ?, 1)");
                    $insertStmt->execute([$name, $description, $slug, $wooId]);
                }
                
                $syncedCount++;
            } catch (\Exception $e) {
                $errors[] = "Brand {$brand['name']}: " . $e->getMessage();
            }
        }

        return ['success' => true, 'synced' => $syncedCount, 'errors' => $errors];
    }

    private function getBrandConfig()
    {
        // Check cache
        if (!empty($this->settings['woocommerce_brand_config'])) {
            return json_decode($this->settings['woocommerce_brand_config'], true);
        }

        // 1. Try to detect common Brand Taxonomies via WP API
        $endpoint = rtrim($this->settings['woocommerce_url'], '/') . '/wp-json/wp/v2/taxonomies';
        $result = $this->makeRequest('GET', $endpoint);

        $config = null;

        if ($result['success']) {
            $taxonomies = $result['data'];
            // Common brand taxonomies
            $candidates = ['product_brand', 'pwb-brand', 'yith_product_brand', 'brand'];
            
            foreach ($candidates as $cand) {
                if (isset($taxonomies[$cand])) {
                    $config = [
                        'type' => 'taxonomy',
                        'taxonomy' => $cand,
                        'endpoint' => rtrim($this->settings['woocommerce_url'], '/') . "/wp-json/wp/v2/$cand"
                    ];
                    break;
                }
            }
        }

        // 2. If no taxonomy found, check for official WC Brands API (legacy v3)
        if (!$config) {
            $endpoint = rtrim($this->settings['woocommerce_url'], '/') . '/wp-json/wc/v3/products/brands';
            $check = $this->makeRequest('GET', $endpoint);
            if ($check['success']) {
                $config = [
                    'type' => 'wc_api',
                    'endpoint' => $endpoint
                ];
            }
        }

        // 3. Fallback to Attribute (pa_marca)
        if (!$config) {
            $attrId = $this->getBrandAttributeId();
            if ($attrId) {
                $config = [
                    'type' => 'attribute',
                    'attribute_id' => $attrId,
                    'endpoint' => rtrim($this->settings['woocommerce_url'], '/') . "/wp-json/wc/v3/products/attributes/$attrId/terms"
                ];
            }
        }

        if ($config) {
            // Save config to DB to avoid re-scanning (optional, but good for perf)
            // For now we just cache in memory or we could save to settings table if we had a field
            // $this->settings['woocommerce_brand_config'] = json_encode($config);
        }

        return $config;
    }

    public function ensureBrandSynced($localBrandId)
    {
        $stmt = $this->conn->prepare("SELECT name, description, slug, woocommerce_id FROM brands WHERE id = ?");
        $stmt->execute([$localBrandId]);
        $brand = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$brand) return null;
        if (!empty($brand['woocommerce_id'])) return $brand['woocommerce_id'];

        return $this->createBrand($brand)['data']['id'] ?? null;
    }

    public function createBrand($data)
    {
        if (!$this->isEnabled()) {
            return ['success' => false, 'message' => 'WooCommerce integration disabled'];
        }

        $config = $this->getBrandConfig();
        if (!$config) {
            return ['success' => false, 'message' => 'Could not determine Brand configuration in WooCommerce'];
        }

        $body = [
            'name' => $data['name'],
            'description' => $data['description'] ?? ''
        ];
        if (!empty($data['slug'])) {
            $body['slug'] = $data['slug'];
        }

        $endpoint = $config['endpoint'];

        $result = $this->makeRequest('POST', $endpoint, $body);

        if ($result['success']) {
            // If it's a new brand, update local ID
            if (isset($data['id'])) { // If called with internal data containing ID
                 // This check is tricky if called from ensureBrandSynced vs Controller
            }
            // Just return result, let caller handle DB update
        }

        return $result;
    }

    public function updateBrand($wooId, $data)
    {
        if (!$this->isEnabled()) {
            return ['success' => false, 'message' => 'WooCommerce integration disabled'];
        }

        $config = $this->getBrandConfig();
        if (!$config) return ['success' => false, 'message' => 'No brand config'];

        $endpoint = $config['endpoint'] . '/' . $wooId;
        
        $body = [
            'name' => $data['name'],
            'description' => $data['description'] ?? ''
        ];
        if (!empty($data['slug'])) {
            $body['slug'] = $data['slug'];
        }

        // Note: For WP API (taxonomy), PUT is standard. For WC API, PUT is also standard.
        return $this->makeRequest('PUT', $endpoint, $body); 
    }

    public function deleteBrand($wooId)
    {
        if (!$this->isEnabled()) {
            return ['success' => false, 'message' => 'WooCommerce integration disabled'];
        }

        $config = $this->getBrandConfig();
        if (!$config) return ['success' => false, 'message' => 'No brand config'];

        $endpoint = $config['endpoint'] . '/' . $wooId . '?force=true';
        
        return $this->makeRequest('DELETE', $endpoint);
    }

    private function getBrandName($id) {
        $stmt = $this->conn->prepare("SELECT name FROM brands WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetchColumn();
    }

    private function getBrandAttributeId()
    {
        // Check cache in settings
        if (!empty($this->settings['woocommerce_brand_attr_id'])) {
            return $this->settings['woocommerce_brand_attr_id'];
        }

        // Search in Woo
        $endpoint = rtrim($this->settings['woocommerce_url'], '/') . '/wp-json/wc/v3/products/attributes';
        $result = $this->makeRequest('GET', $endpoint);
        
        $brandAttrId = null;

        if ($result['success']) {
            foreach ($result['data'] as $attr) {
                if ($attr['slug'] === 'pa_marca' || $attr['slug'] === 'marca' || strtolower($attr['name']) === 'marca' || strtolower($attr['name']) === 'brand') {
                    $brandAttrId = $attr['id'];
                    break;
                }
            }
        }

        // If not found, create it
        if (!$brandAttrId) {
            $createRes = $this->makeRequest('POST', $endpoint, [
                'name' => 'Marca',
                'slug' => 'pa_marca',
                'type' => 'select',
                'order_by' => 'name',
                'has_archives' => true
            ]);
            
            if ($createRes['success']) {
                $brandAttrId = $createRes['data']['id'];
            }
        }

        // Save to DB
        if ($brandAttrId) {
            $this->conn->exec("UPDATE company_settings SET woocommerce_brand_attr_id = $brandAttrId");
            $this->settings['woocommerce_brand_attr_id'] = $brandAttrId; // Update local cache
        }

        return $brandAttrId;
    }

    // --- Generic Attribute Helpers for Talla/Color ---
    public function getAttributeIdBySlugOrName($key)
    {
        if (!$this->isEnabled()) {
            return null;
        }
        // Normalize
        $k = strtolower(trim($key));
        // Common candidates
        $slugCandidates = [];
        $nameCandidates = [];
        if (in_array($k, ['talla', 'pa_talla'])) {
            $slugCandidates = ['pa_talla', 'talla'];
            $nameCandidates = ['talla', 'Talla', 'size', 'Size'];
        } elseif (in_array($k, ['color', 'pa_color', 'pa_colores'])) {
            $slugCandidates = ['pa_color', 'color', 'pa_colores'];
            $nameCandidates = ['color', 'Color', 'colores', 'Colores'];
        } else {
            // Generic key support
            $slugCandidates = [$k, "pa_$k"];
            $nameCandidates = [$key, ucfirst($k)];
        }

        $endpoint = rtrim($this->settings['woocommerce_url'], '/') . '/wp-json/wc/v3/products/attributes';
        $result = $this->makeRequest('GET', $endpoint);
        if (!$result['success']) return null;

        foreach ($result['data'] as $attr) {
            $slug = strtolower($attr['slug'] ?? '');
            $name = strtolower($attr['name'] ?? '');
            if (in_array($slug, array_map('strtolower', $slugCandidates), true) ||
                in_array($name, array_map('strtolower', $nameCandidates), true)) {
                return $attr['id'];
            }
        }
        return null;
    }

    public function getAttributeTerms($attributeId)
    {
        if (!$this->isEnabled() || empty($attributeId)) {
            return ['success' => false, 'message' => 'WooCommerce disabled or invalid attribute id'];
        }
        $endpoint = rtrim($this->settings['woocommerce_url'], '/') . "/wp-json/wc/v3/products/attributes/{$attributeId}/terms";
        $params = [
            'per_page' => 100,
            'page' => 1,
            'hide_empty' => false
        ];
        $url = $endpoint . '?' . http_build_query($params);
        return $this->makeRequest('GET', $url);
    }

    public function createAttributeTerm($attributeId, $name, $slug = null)
    {
        if (!$this->isEnabled() || empty($attributeId) || trim($name) === '') {
            return ['success' => false, 'message' => 'Invalid parameters for creating attribute term'];
        }
        $endpoint = rtrim($this->settings['woocommerce_url'], '/') . "/wp-json/wc/v3/products/attributes/{$attributeId}/terms";
        $body = ['name' => $name];
        if (!empty($slug)) {
            $body['slug'] = $slug;
        }
        return $this->makeRequest('POST', $endpoint, $body);
    }

    public function updateAttributeTerm($attributeId, $termId, $data)
    {
        if (!$this->isEnabled() || empty($attributeId) || empty($termId)) {
            return ['success' => false, 'message' => 'Invalid parameters for updating attribute term'];
        }
        $payload = [];
        if (isset($data['name'])) {
            $payload['name'] = $data['name'];
        }
        if (isset($data['slug'])) {
            $payload['slug'] = $data['slug'];
        }
        if (empty($payload)) {
            return ['success' => false, 'message' => 'No data to update'];
        }
        $endpoint = rtrim($this->settings['woocommerce_url'], '/') . "/wp-json/wc/v3/products/attributes/{$attributeId}/terms/{$termId}";
        return $this->makeRequest('PUT', $endpoint, $payload);
    }

    public function deleteAttributeTerm($attributeId, $termId)
    {
        if (!$this->isEnabled() || empty($attributeId) || empty($termId)) {
            return ['success' => false, 'message' => 'Invalid parameters for deleting attribute term'];
        }
        $endpoint = rtrim($this->settings['woocommerce_url'], '/') . "/wp-json/wc/v3/products/attributes/{$attributeId}/terms/{$termId}";
        return $this->makeRequest('DELETE', $endpoint);
    }

    private function makeRequest($method, $url, $data = [])
    {
        $ch = curl_init();
        
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($ch, CURLOPT_USERPWD, $this->settings['woocommerce_consumer_key'] . ':' . $this->settings['woocommerce_consumer_secret']);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);

        if (!empty($data)) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        
        if ($error) {
            return ['success' => false, 'message' => "cURL Error: $error"];
        }

        if ($httpCode >= 200 && $httpCode < 300) {
            return ['success' => true, 'data' => json_decode($response, true)];
        }

        return ['success' => false, 'message' => "HTTP Error $httpCode", 'details' => json_decode($response, true)];
    }
}
