import { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Filter, 
  MoreVertical, 
  Edit, 
  Trash2, 
  ShoppingBag, 
  Phone, 
  Mail, 
  MapPin,
  FileText
} from 'lucide-react';
import api from '../../services/api';
import CustomerModal from './CustomerModal';
import CustomerHistory from './CustomerHistory';
import { useAuth } from '../../context/AuthContext';

export default function CustomerList() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 1
  });

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Role permissions
  const canCreate = ['Administrador', 'Supervisor', 'Cajero', 'Vendedor'].includes(user?.role);
  const canEdit = ['Administrador', 'Supervisor'].includes(user?.role);
  const canViewHistory = ['Administrador', 'Supervisor'].includes(user?.role);
  const canViewCredit = ['Administrador', 'Supervisor'].includes(user?.role);

  useEffect(() => {
    fetchCustomers();
  }, [pagination.page, search]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/clientes', {
        params: {
          page: pagination.page,
          limit: pagination.limit,
          search: search
        }
      });
      setCustomers(response.data.data);
      setPagination(prev => ({
        ...prev,
        ...response.data.pagination
      }));
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (customer) => {
    setSelectedCustomer(customer);
    setShowModal(true);
  };

  const handleHistory = (customer) => {
    setSelectedCustomer(customer);
    setShowHistory(true);
  };

  const handleCreate = () => {
    setSelectedCustomer(null);
    setShowModal(true);
  };

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Cartera de Clientes</h2>
          <p className="text-sm text-slate-500">Gestión de clientes y fidelización</p>
        </div>
        {canCreate && (
          <button 
            onClick={handleCreate}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nuevo Cliente
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por nombre, documento, email..." 
            value={search}
            onChange={handleSearch}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>
        <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Filtros
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
              <th className="px-6 py-4 font-semibold rounded-tl-lg">Cliente / Razón Social</th>
              <th className="px-6 py-4 font-semibold">Documento</th>
              <th className="px-6 py-4 font-semibold">Contacto</th>
              {canViewCredit && <th className="px-6 py-4 font-semibold">Crédito</th>}
              <th className="px-6 py-4 font-semibold">Ubicación</th>
              <th className="px-6 py-4 font-semibold text-right rounded-tr-lg">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={canViewCredit ? 6 : 5} className="px-6 py-8 text-center text-slate-500">
                  <div className="flex justify-center mb-2">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                  </div>
                  Cargando clientes...
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={canViewCredit ? 6 : 5} className="px-6 py-12 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Search className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-slate-600 font-medium">No se encontraron clientes</p>
                  <p className="text-slate-400 text-sm">Intenta con otros términos de búsqueda</p>
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                        {(customer.first_name || customer.name || 'C').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{customer.first_name || customer.name}</p>
                        <p className="text-xs text-slate-500">Registrado: {new Date(customer.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        {customer.doc_type || 'DNI'}
                      </span>
                      <span className="text-sm text-slate-600 font-mono">{customer.doc_number}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {customer.email && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Mail className="w-3 h-3" />
                          {customer.email}
                        </div>
                      )}
                      {customer.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Phone className="w-3 h-3" />
                          {customer.phone}
                        </div>
                      )}
                    </div>
                  </td>
                  {canViewCredit && (
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="font-medium text-slate-700">S/ {Number(customer.credit_limit || 0).toFixed(2)}</div>
                        <div className="text-xs text-slate-500">Deuda: S/ {Number(customer.credit_balance || 0).toFixed(2)}</div>
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4">
                    {customer.address ? (
                      <div className="flex items-center gap-1.5 text-sm text-slate-600 max-w-[200px] truncate" title={customer.address}>
                        <MapPin className="w-3 h-3 flex-shrink-0 text-slate-400" />
                        {customer.address}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Sin dirección</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canViewHistory && (
                        <button 
                          onClick={() => handleHistory(customer)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Historial de Compras"
                        >
                          <ShoppingBag className="w-4 h-4" />
                        </button>
                      )}
                      {canEdit && (
                        <button 
                          onClick={() => handleEdit(customer)}
                          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
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

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="p-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Mostrando {((pagination.page - 1) * pagination.limit) + 1} a {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page === 1}
              className="px-3 py-1 border border-slate-200 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50"
            >
              Anterior
            </button>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page === pagination.pages}
              className="px-3 py-1 border border-slate-200 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <CustomerModal 
          customer={selectedCustomer} 
          onClose={() => setShowModal(false)} 
          onSuccess={() => {
            fetchCustomers();
          }}
        />
      )}

      {showHistory && (
        <CustomerHistory 
          customer={selectedCustomer} 
          onClose={() => setShowHistory(false)} 
        />
      )}
    </div>
  );
}