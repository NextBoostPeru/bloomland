import React, { useState, useEffect } from 'react';
import { Plus, Eye, Search, ArrowLeft, Save, Trash2, Edit, Check, XCircle, PackageCheck } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../layouts/DashboardLayout';

const PurchasesPage = () => {
  const { user } = useAuth();
  const [view, setView] = useState('list'); // list, create, details
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editingId, setEditingId] = useState(null);

  // Form State
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]); // For search
  const [formData, setFormData] = useState({
    supplier_id: '',
    expected_date: '',
    notes: '',
    items: []
  });
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    if (view === 'list') fetchOrders();
    if (view === 'create') {
      fetchSuppliers();
    }
  }, [view]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (productSearch.length >= 2) {
        searchProducts(productSearch);
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [productSearch]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get('/compras');
      setOrders(response.data.data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/suppliers');
      setSuppliers(response.data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const searchProducts = async (query) => {
    if (!query) {
      setSearchResults([]);
      return;
    }
    try {
      const response = await api.get(`/inventory/products?search=${query}`);
      setSearchResults(response.data.data || []);
    } catch (error) {
      console.error('Error searching products:', error);
    }
  };

  const handleAddItem = (product) => {
    const existing = formData.items.find(item => item.product_id === product.id);
    if (existing) return; // Already added

    const newItem = {
      product_id: product.id,
      product_name: product.name || product.post_title, // Handle different formats
      quantity: 1,
      unit_cost: product.cost_price || product.price || 0,
      subtotal: product.cost_price || product.price || 0
    };
    setFormData({
      ...formData,
      items: [...formData.items, newItem]
    });
    setProductSearch('');
    setSearchResults([]);
  };

  const updateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    
    // Recalculate subtotal
    if (field === 'quantity' || field === 'unit_cost') {
      const qty = parseFloat(newItems[index].quantity) || 0;
      const cost = parseFloat(newItems[index].unit_cost) || 0;
      newItems[index].subtotal = qty * cost;
    }
    
    setFormData({ ...formData, items: newItems });
  };

  const removeItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + (parseFloat(item.subtotal) || 0), 0);
  };

  const handleEdit = async (order) => {
    try {
      const response = await api.get(`/compras/${order.id}`);
      const fullOrder = response.data;
      
      setFormData({
        supplier_id: fullOrder.supplier_id,
        expected_date: fullOrder.expected_date || '',
        notes: fullOrder.notes || '',
        items: fullOrder.items.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          subtotal: item.subtotal
        }))
      });
      setEditingId(order.id);
      setView('create');
    } catch (error) {
      console.error('Error preparing edit:', error);
      alert('Error al cargar la orden para edición');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar esta orden?')) return;
    
    try {
      await api.delete(`/compras/${id}`);
      fetchOrders();
    } catch (error) {
      console.error('Error deleting order:', error);
      alert('Error al eliminar la orden');
    }
  };

  const handleSubmit = async () => {
    if (!formData.supplier_id || formData.items.length === 0) {
      alert('Seleccione un proveedor y agregue al menos un producto');
      return;
    }

    try {
      if (editingId) {
        await api.put(`/compras/${editingId}`, {
          ...formData,
          total_amount: calculateTotal()
        });
        alert('Orden actualizada correctamente');
      } else {
        await api.post('/compras', {
          ...formData,
          user_id: user?.id,
          total_amount: calculateTotal()
        });
        alert('Orden de compra guardada');
      }
      setEditingId(null);
      setFormData({ supplier_id: '', expected_date: '', notes: '', items: [] });
      setView('list');
    } catch (error) { 
      console.error('Error saving order:', error);
      alert('Error al guardar la orden de compra');
    }
  };

  const fetchOrderDetails = async (id) => {
    try {
      const response = await api.get(`/compras/${id}`);
      setSelectedOrder(response.data);
      setView('details');
    } catch (error) {
      console.error('Error fetching order details:', error);
    }
  };

  const handleStatusUpdate = async (status) => {
    if (!selectedOrder) return;
    try {
      await api.put(`/compras/${selectedOrder.id}/status`, { status });
      fetchOrderDetails(selectedOrder.id);
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleListStatusUpdate = async (id, status) => {
    try {
      await api.put(`/compras/${id}/status`, { status });
      fetchOrders();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  if (view === 'create') {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
          <button onClick={() => setView('list')} className="p-2 hover:bg-slate-100 rounded-full">
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <h1 className="text-2xl font-bold text-slate-800">Nueva Orden de Compra</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Product Search */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-800 mb-4">Agregar Productos</h3>
              <div className="relative">
                <Search className="absolute left-3 top-3 text-slate-400" size={20} />
                <input 
                  type="text"
                  placeholder="Buscar productos..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg"
                  value={productSearch}
                  onChange={e => {
                    setProductSearch(e.target.value);
                  }}
                />
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-xl mt-1 max-h-60 overflow-y-auto z-10">
                    {searchResults.map(prod => (
                      <div 
                        key={prod.id}
                        onClick={() => handleAddItem(prod)}
                        className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                      >
                        <div className="font-medium text-slate-800">{prod.name || prod.post_title}</div>
                        <div className="text-sm text-slate-500">
                          SKU: {prod.sku} | Stock: {prod.total_stock ?? prod.stock ?? prod.stock_quantity ?? 0}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Items Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600">Producto</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600 w-24">Cant.</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600 w-32">Costo Unit.</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600 text-right">Subtotal</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {formData.items.length === 0 ? (
                    <tr><td colSpan="5" className="p-6 text-center text-slate-500">Agregue productos a la orden</td></tr>
                  ) : (
                    formData.items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3 text-sm font-medium text-slate-800">{item.product_name}</td>
                        <td className="px-4 py-3">
                          <input 
                            type="number" min="1"
                            className="w-full border border-slate-300 rounded p-1 text-sm"
                            value={item.quantity}
                            onChange={e => updateItem(index, 'quantity', e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="number" min="0" step="0.01"
                            className="w-full border border-slate-300 rounded p-1 text-sm"
                            value={item.unit_cost}
                            onChange={e => updateItem(index, 'unit_cost', e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-700">
                          S/ {parseFloat(item.subtotal || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => removeItem(index)} className="text-red-400 hover:text-red-600">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {formData.items.length > 0 && (
                  <tfoot className="bg-slate-50 border-t border-slate-200">
                    <tr>
                      <td colSpan="3" className="px-4 py-3 text-right font-bold text-slate-700">Total:</td>
                      <td className="px-4 py-3 text-right font-bold text-indigo-600 text-lg">
                        S/ {calculateTotal().toFixed(2)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-800 mb-4">Detalles de la Orden</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Proveedor</label>
                  <select 
                    className="w-full border border-slate-300 rounded-lg p-2"
                    value={formData.supplier_id}
                    onChange={e => setFormData({...formData, supplier_id: e.target.value})}
                  >
                    <option value="">Seleccione...</option>
                    {suppliers.map(sup => (
                      <option key={sup.id} value={sup.id}>{sup.business_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Esperada</label>
                  <input 
                    type="date"
                    className="w-full border border-slate-300 rounded-lg p-2"
                    value={formData.expected_date}
                    onChange={e => setFormData({...formData, expected_date: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
                  <textarea 
                    className="w-full border border-slate-300 rounded-lg p-2 h-24"
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                  />
                </div>
                <button 
                  onClick={handleSubmit}
                  className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 flex justify-center items-center gap-2"
                >
                  <Save size={20} /> {editingId ? 'Actualizar Orden' : 'Guardar Orden'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      </DashboardLayout>
    );
  }

  if (view === 'details' && selectedOrder) {
    return (
      <DashboardLayout title={`Orden #${selectedOrder.id}`}>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('list')} className="p-2 hover:bg-slate-100 rounded-full">
              <ArrowLeft size={20} className="text-slate-600" />
            </button>
            <h1 className="text-2xl font-bold text-slate-800">Orden #{selectedOrder.id}</h1>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            selectedOrder.status === 'received' ? 'bg-emerald-100 text-emerald-700' :
            selectedOrder.status === 'approved' ? 'bg-blue-100 text-blue-700' :
            selectedOrder.status === 'cancelled' ? 'bg-red-100 text-red-700' :
            'bg-yellow-100 text-yellow-700'
          }`}>
            {selectedOrder.status === 'received' ? 'Recibido' :
             selectedOrder.status === 'approved' ? 'Aprobado' :
             selectedOrder.status === 'cancelled' ? 'Cancelado' : 'Pendiente'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h3 className="font-bold text-slate-800">Items</h3>
              </div>
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-sm font-semibold text-slate-600">Producto</th>
                    <th className="px-6 py-3 text-sm font-semibold text-slate-600 text-right">Cant.</th>
                    <th className="px-6 py-3 text-sm font-semibold text-slate-600 text-right">Costo</th>
                    <th className="px-6 py-3 text-sm font-semibold text-slate-600 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedOrder.items?.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-6 py-4 text-slate-800">{item.product_name}</td>
                      <td className="px-6 py-4 text-right text-slate-600">{item.quantity}</td>
                      <td className="px-6 py-4 text-right text-slate-600">S/ {parseFloat(item.unit_cost).toFixed(2)}</td>
                      <td className="px-6 py-4 text-right font-medium text-slate-800">S/ {parseFloat(item.subtotal).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td colSpan="3" className="px-6 py-4 text-right font-bold text-slate-700">Total</td>
                    <td className="px-6 py-4 text-right font-bold text-indigo-600 text-lg">
                      S/ {parseFloat(selectedOrder.total_amount).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-2">Información</h3>
              <div>
                <p className="text-sm text-slate-500">Proveedor</p>
                <p className="font-medium text-slate-800">{selectedOrder.supplier_name}</p>
                <p className="text-xs text-slate-500">{selectedOrder.ruc}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Fecha Creación</p>
                <p className="font-medium text-slate-800">{new Date(selectedOrder.created_at).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Solicitado por</p>
                <p className="font-medium text-slate-800">{selectedOrder.user_name}</p>
              </div>
              {selectedOrder.notes && (
                <div>
                  <p className="text-sm text-slate-500">Notas</p>
                  <p className="text-sm text-slate-800 bg-slate-50 p-2 rounded">{selectedOrder.notes}</p>
                </div>
              )}
              
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <h4 className="text-sm font-bold text-slate-700">Acciones</h4>
                {selectedOrder.status === 'pending' && (
                  <button 
                    onClick={() => handleStatusUpdate('approved')}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
                  >
                    Aprobar Orden
                  </button>
                )}
                {selectedOrder.status === 'approved' && (
                  <button 
                    onClick={() => handleStatusUpdate('received')}
                    className="w-full bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 text-sm font-medium"
                  >
                    Marcar como Recibida
                  </button>
                )}
                {selectedOrder.status === 'pending' && (
                  <button 
                    onClick={() => handleStatusUpdate('cancelled')}
                    className="w-full bg-white border border-red-200 text-red-600 py-2 rounded-lg hover:bg-red-50 text-sm font-medium"
                  >
                    Cancelar Orden
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      </DashboardLayout>
    );
  }

  // List View
  return (
    <DashboardLayout title="Órdenes de Compra">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Órdenes de Compra</h1>
            <p className="text-slate-500">Gestión de abastecimiento</p>
          </div>
          <button 
            onClick={() => {
              setEditingId(null);
              setFormData({ supplier_id: '', expected_date: '', notes: '', items: [] });
              setView('create');
            }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-200"
          >
            <Plus size={20} /> Nueva Orden
          </button>
        </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-semibold text-slate-600">ID</th>
              <th className="px-6 py-4 font-semibold text-slate-600">Proveedor</th>
              <th className="px-6 py-4 font-semibold text-slate-600">Fecha</th>
              <th className="px-6 py-4 font-semibold text-slate-600">Total</th>
              <th className="px-6 py-4 font-semibold text-slate-600">Estado</th>
              <th className="px-6 py-4 font-semibold text-slate-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan="6" className="p-6 text-center">Cargando...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan="6" className="p-6 text-center text-slate-500">No hay órdenes registradas</td></tr>
            ) : (
              orders.map(order => (
                <tr key={order.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-600">#{order.id}</td>
                  <td className="px-6 py-4 text-slate-800">{order.supplier_name}</td>
                  <td className="px-6 py-4 text-slate-600">{new Date(order.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 font-bold text-slate-800">S/ {parseFloat(order.total_amount).toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      order.status === 'received' ? 'bg-emerald-100 text-emerald-700' :
                      order.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                      order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {order.status === 'received' ? 'Recibido' :
                       order.status === 'approved' ? 'Aprobado' :
                       order.status === 'cancelled' ? 'Cancelado' : 'Pendiente'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => fetchOrderDetails(order.id)}
                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                        title="Ver Detalles"
                      >
                        <Eye size={18} />
                      </button>
                      
                      {order.status === 'pending' && (
                        <>
                          <button 
                            onClick={() => handleListStatusUpdate(order.id, 'approved')}
                            className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                            title="Aprobar Orden"
                          >
                            <Check size={18} />
                          </button>
                          <button 
                            onClick={() => handleEdit(order)}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Editar"
                          >
                            <Edit size={18} />
                          </button>
                          <button 
                            onClick={() => handleListStatusUpdate(order.id, 'cancelled')}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Cancelar Orden"
                          >
                            <XCircle size={18} />
                          </button>
                        </>
                      )}

                      {order.status === 'approved' && (
                        <button 
                          onClick={() => handleListStatusUpdate(order.id, 'received')}
                          className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                          title="Marcar como Recibido"
                        >
                          <PackageCheck size={18} />
                        </button>
                      )}

                      {(order.status === 'pending' || order.status === 'cancelled') && (
                        <button 
                          onClick={() => handleDelete(order.id)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Eliminar"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
    </DashboardLayout>
  );
};

export default PurchasesPage;
