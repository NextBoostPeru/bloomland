import { useState, useEffect } from 'react';
import { X, Calendar, ShoppingBag, CreditCard, User } from 'lucide-react';
import api from '../../services/api';

export default function CustomerHistory({ customer, onClose }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (customer) {
      fetchHistory();
    }
  }, [customer]);

  const fetchHistory = async () => {
    try {
      const response = await api.get(`/clientes/${customer.id}/history`);
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      completed: 'bg-green-100 text-green-700',
      pending: 'bg-yellow-100 text-yellow-700',
      cancelled: 'bg-red-100 text-red-700',
      processing: 'bg-blue-100 text-blue-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Historial de Compras</h2>
            <p className="text-sm text-slate-500 flex items-center gap-2 mt-1">
              <User className="w-4 h-4" />
              {customer?.first_name || customer?.name}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
              <p className="text-slate-500">Cargando historial...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-100">
              <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">Sin compras registradas</p>
              <p className="text-slate-400 text-sm">Este cliente aún no ha realizado compras.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">Pedido #{order.id}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(order.created_at).toLocaleDateString('es-PE', { 
                            day: 'numeric', 
                            month: 'long', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        {order.status === 'completed' ? 'Completado' : order.status}
                      </span>
                      <p className="font-bold text-slate-800 text-lg">
                        S/ {parseFloat(order.total).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-t border-slate-100 pt-4">
                    <div>
                      <span className="text-slate-500 block text-xs mb-1">Método de Pago</span>
                      <span className="font-medium text-slate-700 flex items-center gap-1">
                        <CreditCard className="w-3 h-3" />
                        {order.payment_method}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-xs mb-1">Comprobante</span>
                      <span className="font-medium text-slate-700">{order.receipt_type}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-xs mb-1">Ítems</span>
                      <span className="font-medium text-slate-700">{order.items_count} productos</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-xs mb-1">Vendedor</span>
                      <span className="font-medium text-slate-700">{order.seller_name || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
