import { useState, useEffect } from 'react';
import { 
  Search, 
  Calendar, 
  Filter, 
  Eye, 
  Printer, 
  FileText,
  DollarSign,
  CreditCard,
  User,
  Clock,
  X,
  ShoppingBag,
  MapPin,
  Phone,
  Mail,
  RefreshCw
} from 'lucide-react';
import api from '../../services/api';
import DashboardLayout from '../../layouts/DashboardLayout';
import { toast } from 'react-hot-toast';

export default function SalesPage() {
  const [sales, setSales] = useState([]);
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', userId: '' });
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 1
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchSales();
  }, [pagination.page, search, filters]);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchSales = async () => {
    setLoading(true);
    try {
      const response = await api.get('/ventas', {
        params: {
          page: pagination.page,
          limit: pagination.limit,
          search: search,
          start_date: filters.startDate,
          end_date: filters.endDate,
          user_id: filters.userId
        }
      });
      setSales(response.data.data);
      setPagination(prev => ({
        ...prev,
        ...response.data.pagination
      }));
    } catch (error) {
      console.error('Error fetching sales:', error);
      toast.error('Error al cargar las ventas');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = (id) => {
    const token = localStorage.getItem('token');
    window.open(`${import.meta.env.VITE_API_URL}/ventas/${id}/ticket?token=${token}`, '_blank');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'PAID': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'PENDING': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'CANCELLED': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount);
  };

  const handleView = async (sale) => {
    setViewLoading(true);
    try {
      const response = await api.get(`/ventas/${sale.id}`);
      setSelectedSale(response.data);
      setShowModal(true);
    } catch (error) {
      console.error('Error fetching sale details:', error);
      toast.error('Error al cargar detalles de la venta');
    } finally {
      setViewLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncLoading(true);
    const toastId = toast.loading('Sincronizando ventas...');
    try {
      const response = await api.post('/ventas/sync');
      if (response.data.success) {
        toast.success(`Sincronización completada: ${response.data.synced} ventas nuevas`, { id: toastId });
        fetchSales();
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

  return (
    <DashboardLayout title="Historial de Ventas">
      <div className="space-y-6">
        <div className="flex flex-col gap-1">
          <p className="text-slate-500">Consulta y gestiona el historial de todas las ventas realizadas.</p>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">
          <div className="relative w-full xl:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por N° Orden, Cliente o DNI..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto flex-wrap">
            <div className="flex items-center gap-2">
                <input 
                    type="date" 
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600"
                    value={filters.startDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                />
                <span className="text-slate-400">-</span>
                <input 
                    type="date" 
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600"
                    value={filters.endDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                />
            </div>
            
            <select
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-600"
                value={filters.userId}
                onChange={(e) => setFilters(prev => ({ ...prev, userId: e.target.value }))}
            >
                <option value="">Todos los vendedores</option>
                {users.map(user => (
                    <option key={user.id} value={user.id}>
                        {user.first_name} {user.last_name_paternal}
                    </option>
                ))}
            </select>

            {(filters.startDate || filters.endDate || filters.userId) && (
                <button 
                    onClick={() => setFilters({ startDate: '', endDate: '', userId: '' })}
                    className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 border border-red-200 rounded-lg"
                >
                    Limpiar
                </button>
            )}

            <button
                onClick={handleSync}
                disabled={syncLoading}
                className="px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
                <RefreshCw className={`w-4 h-4 ${syncLoading ? 'animate-spin' : ''}`} />
                Sincronizar Web
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold">
                  <th className="p-4">N° Orden</th>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Vendedor</th>
                  <th className="p-4">Total</th>
                  <th className="p-4">Pago</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="p-8 text-center text-slate-500">Cargando ventas...</td>
                  </tr>
                ) : sales.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-8 text-center text-slate-500">No se encontraron ventas</td>
                  </tr>
                ) : (
                  sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-medium text-slate-900">
                        {sale.invoice_type} <span className="text-slate-500 text-xs block">{sale.order_number}</span>
                      </td>
                      <td className="p-4 text-slate-600 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          {new Date(sale.created_at).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                          <Clock className="w-3 h-3" />
                          {new Date(sale.created_at).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-slate-800">{sale.customer_name || 'Varios'}</div>
                        <div className="text-xs text-slate-500">
                          {sale.document_type && `${sale.document_type}: `} {sale.document_number}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400" />
                          {sale.user_name}
                        </div>
                      </td>
                      <td className="p-4 font-bold text-slate-800">
                        {formatCurrency(sale.total_amount)}
                      </td>
                      <td className="p-4">
                         <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                           <CreditCard className="w-3 h-3" />
                           {sale.payment_method}
                         </span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(sale.status)}`}>
                          {sale.status === 'PAID' ? 'Pagado' : sale.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleView(sale)}
                            disabled={viewLoading}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Ver Detalles"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handlePrint(sale.id)}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Imprimir Ticket"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          <div className="p-4 border-t border-slate-200 flex justify-between items-center">
             <div className="text-sm text-slate-500">
                Mostrando {((pagination.page - 1) * pagination.limit) + 1} a {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} resultados
             </div>
             <div className="flex gap-2">
                <button 
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 border border-slate-300 rounded-md text-sm disabled:opacity-50 hover:bg-slate-50"
                >
                  Anterior
                </button>
                <button 
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page >= pagination.pages}
                  className="px-3 py-1 border border-slate-300 rounded-md text-sm disabled:opacity-50 hover:bg-slate-50"
                >
                  Siguiente
                </button>
             </div>
          </div>
        </div>
      </div>

      {/* Sale Detail Modal */}
      {showModal && selectedSale && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-2 rounded-lg">
                  <ShoppingBag className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">
                    Detalle de Venta
                  </h2>
                  <p className="text-sm text-slate-500">
                    {selectedSale.invoice_type} {selectedSale.order_number}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* General Info */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    Información General
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Fecha:</span>
                      <span className="font-medium">{new Date(selectedSale.created_at).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Estado:</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        ['completed', 'paid'].includes(selectedSale.status?.toLowerCase())
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {['completed', 'paid'].includes(selectedSale.status?.toLowerCase()) 
                          ? 'PAGADO' 
                          : selectedSale.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Método de Pago:</span>
                      <span className="font-medium">{selectedSale.payment_method}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Vendedor:</span>
                      <span className="font-medium">{selectedSale.user_name}</span>
                    </div>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <User className="w-4 h-4 text-indigo-500" />
                    Cliente
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="font-medium text-slate-800">
                      {selectedSale.customer_name || 'Cliente General'}
                    </div>
                    {selectedSale.document_number && (
                      <div className="text-slate-500">
                        {selectedSale.document_type}: {selectedSale.document_number}
                      </div>
                    )}
                    {selectedSale.customer_email && (
                      <div className="flex items-center gap-2 text-slate-500">
                        <Mail className="w-3 h-3" />
                        {selectedSale.customer_email}
                      </div>
                    )}
                    {selectedSale.customer_phone && (
                      <div className="flex items-center gap-2 text-slate-500">
                        <Phone className="w-3 h-3" />
                        {selectedSale.customer_phone}
                      </div>
                    )}
                    {selectedSale.customer_address && (
                      <div className="flex items-start gap-2 text-slate-500">
                        <MapPin className="w-3 h-3 mt-0.5" />
                        <span className="flex-1">{selectedSale.customer_address}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Totals */}
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex flex-col justify-center">
                  <div className="text-center">
                    <p className="text-sm text-indigo-600 mb-1">Total Pagado</p>
                    <p className="text-3xl font-bold text-indigo-700">
                      S/ {Number(selectedSale.total_amount).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Producto</th>
                      <th className="px-4 py-3 text-center">Cant.</th>
                      <th className="px-4 py-3 text-right">Precio Unit.</th>
                      <th className="px-4 py-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedSale.items?.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{item.product_name}</div>
                          <div className="text-xs text-slate-400">SKU: {item.sku}</div>
                        </td>
                        <td className="px-4 py-3 text-center">{item.quantity}</td>
                        <td className="px-4 py-3 text-right">S/ {Number(item.unit_price).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">
                          S/ {Number(item.subtotal).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-medium text-slate-700">
                    <tr>
                      <td colSpan="3" className="px-4 py-3 text-right">Total</td>
                      <td className="px-4 py-3 text-right text-indigo-600">
                        S/ {Number(selectedSale.total_amount).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50 rounded-b-xl">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
