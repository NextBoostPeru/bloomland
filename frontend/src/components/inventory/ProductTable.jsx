import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { Search, Plus, Filter, MoreVertical, Edit, Trash, Box, Upload, ChevronLeft, ChevronRight, RefreshCw, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import ProductModal from './modals/ProductModal';
import StockModal from './modals/StockModal';
import VariationsModal from './modals/VariationsModal';
import { Layers } from 'lucide-react';

const ProductTable = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination & Filters
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [filters, setFilters] = useState({
    category_id: '',
    brand_id: ''
  });

  const [showProductModal, setShowProductModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showVariationsModal, setShowVariationsModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const fileInputRef = useRef(null);
  const [importPreview, setImportPreview] = useState({ open: false, rows: [], file: null });
  const [importConfirmLoading, setImportConfirmLoading] = useState(false);

  // Load Metadata
  useEffect(() => {
    const fetchMetadata = async () => {
        try {
            const [catsRes, brandsRes] = await Promise.all([
                api.get('/categories'),
                api.get('/brands')
            ]);
            setCategories(catsRes.data);
            setBrands(brandsRes.data);
        } catch (error) {
            console.error("Error loading metadata", error);
        }
    };
    fetchMetadata();
  }, []);

  const fetchProducts = async (page = 1) => {
    try {
      setLoading(true);
      const { data } = await api.get('/inventory/products', {
        params: { 
            search: searchTerm,
            page: page,
            limit: 20,
            category_id: filters.category_id,
            brand_id: filters.brand_id
        }
      });
      
      if (data.meta) {
          setProducts(data.data);
          setTotalPages(data.meta.last_page);
          setTotalRecords(data.meta.total_records);
          setCurrentPage(data.meta.current_page);
      } else {
          setProducts(data);
      }
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar productos');
    } finally {
      setLoading(false);
    }
  };

  // Debounced Search
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchProducts(1); // Reset to page 1 on search
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [searchTerm, filters]); // Re-fetch on search or filter change

  // Page Change
  const handlePageChange = (newPage) => {
      if (newPage >= 1 && newPage <= totalPages) {
          fetchProducts(newPage);
      }
  };

  const handleEdit = (product) => {
    setSelectedProduct(product);
    setShowProductModal(true);
  };

  const handleAdjustStock = (product) => {
    setSelectedProduct(product);
    setShowStockModal(true);
  };

  const handleVariations = (product) => {
    setSelectedProduct(product);
    setShowVariationsModal(true);
  };

  const handleCloseModal = () => {
    setShowProductModal(false);
    setShowStockModal(false);
    setShowVariationsModal(false);
    setSelectedProduct(null);
    fetchProducts(currentPage); // Refresh current page
  };

  const handleSync = async () => {
    setSyncLoading(true);
    const toastId = toast.loading('Sincronizando productos...');
    try {
      const response = await api.post('/productos/sync');
      if (response.data.success) {
        toast.success(`Sincronización completada: ${response.data.synced} productos importados`, { id: toastId });
        fetchProducts(1);
      } else {
        toast.error('Error: ' + response.data.message, { id: toastId });
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Error al conectar con el servidor', { id: toastId });
    } finally {
      setSyncLoading(false);
    }
  };

  const handleExportWoo = async () => {
    setExportLoading(true);
    const toastId = toast.loading('Generando reporte de WooCommerce...');
    try {
      const response = await api.get('/productos/export-woo', {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'woocommerce_products.csv');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      
      toast.success('Reporte descargado exitosamente', { id: toastId });
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Error al descargar el reporte', { id: toastId });
    } finally {
      setExportLoading(false);
    }
  };

  const [templateLoading, setTemplateLoading] = useState(false);

  const handleDownloadTemplate = async () => {
    if (templateLoading) return;
    const toastId = toast.loading('Preparando plantilla...');
    try {
      setTemplateLoading(true);
      const response = await api.get('/inventory/import-template', {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'productos_template.csv');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      toast.success('Plantilla descargada correctamente', { id: toastId });
    } catch (error) {
      console.error('Template download error:', error);
      toast.error('Error al descargar la plantilla', { id: toastId });
    } finally {
      setTemplateLoading(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 2) {
        toast.error('El archivo no contiene filas de productos');
        e.target.value = '';
        return;
      }

      const header = lines[0];
      const delimiter = header.includes(';') && !header.includes(',') ? ';' : ',';
      const headers = header.split(delimiter).map(h => h.trim());

      const idxName = headers.findIndex(h => h.toLowerCase() === 'name');
      const idxSku = headers.findIndex(h => h.toLowerCase() === 'sku');
      const idxPrice = headers.findIndex(h => h.toLowerCase() === 'price');
      const idxDescription = headers.findIndex(h => h.toLowerCase() === 'description');
      const idxCategory = headers.findIndex(h => h.toLowerCase() === 'categoryid');
      const idxStock = headers.findIndex(h => h.toLowerCase() === 'initialstock');

      if (idxName === -1 || idxSku === -1 || idxPrice === -1) {
        toast.error('Encabezados inválidos. Debe incluir Name, SKU y Price');
        e.target.value = '';
        return;
      }

      const rows = lines.slice(1).map((line, i) => {
        const cols = line.split(delimiter);
        const get = (idx) => (idx >= 0 && idx < cols.length ? cols[idx].trim() : '');
        return {
          line: i + 2,
          name: get(idxName),
          sku: get(idxSku),
          price: get(idxPrice),
          description: get(idxDescription),
          categoryId: get(idxCategory),
          stock: get(idxStock)
        };
      }).filter(r => r.name || r.sku);

      if (rows.length === 0) {
        toast.error('No se encontraron productos válidos en el archivo');
        e.target.value = '';
        return;
      }

      setImportPreview({ open: true, rows, file });
    } catch (err) {
      console.error(err);
      toast.error('No se pudo leer el archivo CSV');
      e.target.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview.file) return;
    const file = importPreview.file;
    const formData = new FormData();
    formData.append('file', file);

    const toastId = toast.loading('Importando y subiendo productos a Woo...');
    try {
      setImportConfirmLoading(true);
      const response = await api.post('/inventory/import?sync_woo=1', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      console.log('Respuesta completa importación CSV (axios):', response);
      const data = response?.data ?? {};
      console.log('Resultado importación CSV:', data);
      const imported = Number(data.imported ?? 0);
      const synced = Number(data.synced ?? 0);
      const skippedExisting = Number(data.skipped_existing ?? 0);
      const skippedInvalid = Number(data.skipped_invalid ?? 0);
      const invalidRows = data.invalid_rows ?? [];
      const parts = [
        `${imported} agregados`,
        `${synced} enviados a Woo`
      ];
      if (skippedExisting > 0) parts.push(`${skippedExisting} omitidos (SKU existente)`);
      if (skippedInvalid > 0) parts.push(`${skippedInvalid} filas inválidas`);
      toast.success(`Importación completada: ${parts.join(', ')}`, { id: toastId });
      if (skippedInvalid > 0 && invalidRows.length > 0) {
        const first = invalidRows[0];
        let reasonText = 'motivo desconocido';
        if (first.reason === 'columnas_insuficientes') reasonText = 'columnas insuficientes en la fila';
        if (first.reason === 'name_or_sku_empty') reasonText = 'Name o SKU vacíos en la fila';
        toast.error(`Primera fila inválida en línea ${first.line}: ${reasonText}`);
        console.warn('Filas inválidas en importación:', invalidRows);
      }
      if (imported === 0) {
        console.error('Importación finalizada sin productos agregados. Respuesta completa:', data);
      }
      setImportPreview({ open: false, rows: [], file: null });
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchProducts(1);
    } catch (error) {
      console.error(error);
      toast.error('Error al importar archivo para Woo', { id: toastId });
    } finally {
      setImportConfirmLoading(false);
    }
  };

  const handleCancelImport = () => {
    setImportPreview({ open: false, rows: [], file: null });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-6">
      {/* Header Actions */}
      <div className="flex flex-col gap-4 mb-6">
        {/* Top Row: Title and Search */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h2 className="text-xl font-bold text-slate-800">Listado de Productos</h2>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        
        {/* Bottom Row: Filters and Buttons */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            {/* Filters */}
            <select 
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={filters.category_id}
                onChange={(e) => setFilters({...filters, category_id: e.target.value})}
            >
                <option value="">Todas las Categorías</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>

            <select 
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={filters.brand_id}
                onChange={(e) => setFilters({...filters, brand_id: e.target.value})}
            >
                <option value="">Todas las Marcas</option>
                {brands.map(brand => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </select>
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto justify-end">
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".csv" 
                className="hidden" 
            />
            
            <button 
                onClick={handleSync}
                disabled={syncLoading}
                className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-50 transition-colors"
                title="Sincronizar con WooCommerce"
            >
                <RefreshCw size={18} className={syncLoading ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Sincronizar</span>
            </button>

            <button 
                onClick={handleExportWoo}
                disabled={exportLoading}
                className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-50 transition-colors"
                title="Exportar todos los productos de WooCommerce a Excel"
            >
                {exportLoading ? (
                <RefreshCw size={18} className="animate-spin" />
                ) : (
                <Download size={18} />
                )}
                <span className="hidden sm:inline">Exportar Woo</span>
            </button>

            <button
                onClick={handleDownloadTemplate}
                disabled={templateLoading}
                className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                title="Descargar plantilla CSV vacía para importar productos"
            >
                {templateLoading ? (
                  <RefreshCw size={18} className="animate-spin" />
                ) : (
                  <Download size={18} />
                )}
                <span className="hidden sm:inline">Plantilla CSV</span>
            </button>

            <button 
                onClick={handleImportClick}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-700 transition-colors"
                title="Importar CSV y subir masivo a WooCommerce (ERP + Woo)"
            >
                <Upload size={18} />
                <span className="hidden sm:inline">Importar a Woo</span>
            </button>

            <button 
                onClick={() => { setSelectedProduct(null); setShowProductModal(true); }}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
            >
                <Plus size={18} />
                <span className="hidden sm:inline">Nuevo Producto</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-y border-slate-200">
              <th className="px-6 py-4">Producto</th>
              <th className="px-6 py-4">Categoría / Marca</th>
              <th className="px-6 py-4 text-center">Stock Total</th>
              <th className="px-6 py-4 text-right">Precio</th>
              <th className="px-6 py-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan="5" className="text-center py-8 text-gray-500">Cargando...</td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center py-8 text-gray-500">No se encontraron productos</td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                        {product.image_url ? (
                          <img src={product.image_url} alt="" className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <Box size={20} />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-slate-800 flex items-center gap-2">
                          {product.name}
                          {product.woocommerce_id && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                              Woo
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400">{product.sku}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    <div className="flex flex-col">
                        <span className="font-medium">{product.category_name || 'Sin Categoría'}</span>
                        <span className="text-xs text-slate-400">{product.brand_name || 'Sin Marca'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center">
                      <span className={`font-bold ${
                        Number(product.total_stock) <= Number(product.min_stock) 
                          ? 'text-red-500' 
                          : 'text-emerald-600'
                      }`}>
                        {product.total_stock}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-slate-700">
                    S/ {Number(product.price).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleAdjustStock(product)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg tooltip"
                        title="Ajustar Stock"
                      >
                        <Box size={18} />
                      </button>
                      <button 
                        onClick={() => handleVariations(product)}
                        className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg tooltip"
                        title="Variantes"
                      >
                        <Layers size={18} />
                      </button>
                      <button 
                        onClick={() => handleEdit(product)}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                        title="Editar"
                      >
                        <Edit size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {!loading && totalPages > 1 && (
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100 text-sm text-slate-600">
            <div>
                Mostrando {products.length} de {totalRecords} productos
            </div>
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ChevronLeft size={16} />
                </button>
                <span className="px-2">Página {currentPage} de {totalPages}</span>
                <button 
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-2 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
      )}

      {showProductModal && (
        <ProductModal 
          isOpen={showProductModal} 
          onClose={handleCloseModal}
          product={selectedProduct}
        />
      )}
      
      {showStockModal && (
        <StockModal
          isOpen={showStockModal}
          onClose={handleCloseModal}
          product={selectedProduct}
        />
      )}
      
      {showVariationsModal && (
        <VariationsModal
          isOpen={showVariationsModal}
          onClose={handleCloseModal}
          product={selectedProduct}
        />
      )}
      
      {importPreview.open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-slate-800 text-lg">Vista previa de importación</h3>
              <button
                type="button"
                onClick={handleCancelImport}
                className="text-slate-400 hover:text-slate-600 px-2 py-1 rounded-full hover:bg-slate-100"
              >
                ×
              </button>
            </div>
            <div className="p-4 flex-1 overflow-auto">
              <p className="text-sm text-slate-500 mb-3">
                Revisa los productos que se importarán. Al confirmar se crearán en el ERP y se enviarán a WooCommerce.
              </p>
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-y border-slate-200">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2 text-right">Precio</th>
                    <th className="px-3 py-2">Stock</th>
                    <th className="px-3 py-2">Categoría ID</th>
                    <th className="px-3 py-2">Descripción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {importPreview.rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-xs text-slate-400">{row.line}</td>
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-600">{row.sku}</td>
                      <td className="px-3 py-2 text-right">S/ {row.price}</td>
                      <td className="px-3 py-2">{row.stock}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{row.categoryId}</td>
                      <td className="px-3 py-2 text-xs text-slate-600 whitespace-normal max-w-[24rem]">
                        {row.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
              <button
                type="button"
                onClick={handleCancelImport}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
                disabled={importConfirmLoading}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importConfirmLoading}
                className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {importConfirmLoading ? 'Confirmando...' : 'Confirmar subida a Woo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductTable;
