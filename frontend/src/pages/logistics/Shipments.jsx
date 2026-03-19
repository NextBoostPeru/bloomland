import React, { useState, useEffect, useRef } from 'react';
import { Truck, MapPin, Package, Calendar, Search, Plus, Filter, FileText, User, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const Shipments = () => {
  const { user } = useAuth();
  const [shipments, setShipments] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  
  // Customer Search State
  const [customerResults, setCustomerResults] = useState([]);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchWrapperRef = useRef(null);

  const [formData, setFormData] = useState({
    provider_id: '',
    tracking_number: '',
    remission_guide_number: '',
    recipient_name: '',
    shipping_address: '',
    shipping_cost: '',
    notes: ''
  });

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    ready_to_dispatch: 'bg-blue-100 text-blue-800',
    dispatched: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    returned: 'bg-gray-100 text-gray-800'
  };

  const statusLabels = {
    pending: 'Pendiente',
    ready_to_dispatch: 'Listo para Despacho',
    dispatched: 'En Ruta / Despachado',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
    returned: 'Devuelto'
  };

  useEffect(() => {
    fetchShipments();
    fetchProviders();
  }, [filterStatus]);

  // Click outside to close search results
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [searchWrapperRef]);

  // Debounced customer search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (formData.recipient_name.length > 2 && showResults) {
        searchCustomers(formData.recipient_name);
      } else {
        setCustomerResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [formData.recipient_name, showResults]);

  const searchCustomers = async (term) => {
    setIsSearchingCustomer(true);
    try {
      const { data } = await api.get(`/clientes?q=${term}`);
      // Handle both pagination format and simple array format
      setCustomerResults(Array.isArray(data) ? data : (data.data || []));
    } catch (error) {
      console.error('Error searching customers:', error);
    } finally {
      setIsSearchingCustomer(false);
    }
  };

  const handleCustomerSelect = (customer) => {
    setFormData(prev => ({
      ...prev,
      recipient_name: `${customer.first_name || customer.name} ${customer.last_name || ''}`.trim(),
      shipping_address: customer.address || prev.shipping_address,
      notes: prev.notes // Preserve existing notes
    }));
    setShowResults(false);
  };

  const fetchShipments = async () => {
    try {
      let url = '/logistics/shipments';
      if (filterStatus) url += `?status=${filterStatus}`;
      
      const response = await api.get(url);
      setShipments(response.data.data);
    } catch (error) {
      console.error('Error fetching shipments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProviders = async () => {
    try {
      const response = await api.get('/logistics/providers');
      setProviders(response.data);
    } catch (error) {
      console.error('Error fetching providers:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/logistics/shipments', formData);
      setShowModal(false);
      setFormData({
        provider_id: '',
        tracking_number: '',
        remission_guide_number: '',
        recipient_name: '',
        shipping_address: '',
        shipping_cost: '',
        notes: ''
      });
      fetchShipments();
    } catch (error) {
      console.error('Error creating shipment:', error);
      alert('Error al registrar envío');
    }
  };

  const updateStatus = async (id, newStatus) => {
    if (!window.confirm(`¿Cambiar estado a ${statusLabels[newStatus]}?`)) return;
    try {
      await api.put(`/logistics/shipments/${id}/status`, { status: newStatus });
      fetchShipments();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Gestión de Envíos y Despachos</h2>
          <p className="text-sm text-slate-500">Monitoreo de guías de remisión y couriers</p>
        </div>
        <div className="flex gap-3">
          <select 
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {Object.entries(statusLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <button 
            onClick={() => setShowModal(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700"
          >
            <Plus size={20} /> Nuevo Envío
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-600">ID / Fecha</th>
                <th className="px-6 py-4 font-semibold text-slate-600">Destinatario</th>
                <th className="px-6 py-4 font-semibold text-slate-600">Agencia / Courier</th>
                <th className="px-6 py-4 font-semibold text-slate-600">Seguimiento</th>
                <th className="px-6 py-4 font-semibold text-slate-600">Estado</th>
                <th className="px-6 py-4 font-semibold text-slate-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="6" className="p-6 text-center">Cargando...</td></tr>
              ) : shipments.length === 0 ? (
                <tr><td colSpan="6" className="p-6 text-center text-slate-500">No hay envíos registrados</td></tr>
              ) : (
                shipments.map((shipment) => (
                  <tr key={shipment.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="font-medium">#{shipment.id}</div>
                      <div className="text-xs text-slate-500">
                        {new Date(shipment.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{shipment.recipient_name}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[200px]" title={shipment.shipping_address}>
                        {shipment.shipping_address}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Truck size={16} className="text-slate-400" />
                        <span>{shipment.provider_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 space-y-1">
                      {shipment.tracking_number && (
                        <div className="text-xs flex items-center gap-1">
                          <span className="font-semibold">Track:</span> {shipment.tracking_number}
                        </div>
                      )}
                      {shipment.remission_guide_number && (
                        <div className="text-xs flex items-center gap-1 text-indigo-600">
                          <FileText size={12} />
                          <span className="font-semibold">Guía:</span> {shipment.remission_guide_number}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[shipment.status]}`}>
                        {statusLabels[shipment.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <select 
                        className="text-sm border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        value={shipment.status}
                        onChange={(e) => updateStatus(shipment.id, e.target.value)}
                      >
                        {Object.entries(statusLabels).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-lg w-full p-6">
            <h3 className="text-lg font-bold mb-4">Registrar Nuevo Envío</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Proveedor / Agencia</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.provider_id}
                    onChange={(e) => setFormData({...formData, provider_id: e.target.value})}
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {providers.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Costo Envío (S/)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.shipping_cost}
                    onChange={(e) => setFormData({...formData, shipping_cost: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Destinatario (Cliente)</label>
                <div className="relative" ref={searchWrapperRef}>
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User size={16} className="text-slate-400" />
                  </div>
                  <input
                    type="text"
                    className="w-full border rounded-lg pl-10 pr-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={formData.recipient_name}
                    onChange={(e) => {
                      setFormData({...formData, recipient_name: e.target.value});
                      setShowResults(true);
                    }}
                    onFocus={() => setShowResults(true)}
                    placeholder="Buscar cliente por nombre o DNI..."
                    required
                    autoComplete="off"
                  />
                  {isSearchingCustomer && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <Loader2 size={16} className="animate-spin text-slate-400" />
                    </div>
                  )}
                  
                  {showResults && customerResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {customerResults.map((customer) => (
                        <div
                          key={customer.id}
                          className="px-4 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                          onClick={() => handleCustomerSelect(customer)}
                        >
                          <div className="font-medium text-slate-800">
                            {customer.first_name || customer.name} {customer.last_name}
                          </div>
                          <div className="text-xs text-slate-500 flex gap-2">
                            <span>{customer.doc_number}</span>
                            {customer.address && (
                              <span className="truncate max-w-[200px]">• {customer.address}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dirección de Envío</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2"
                  value={formData.shipping_address}
                  onChange={(e) => setFormData({...formData, shipping_address: e.target.value})}
                  rows="2"
                  required
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">N° Guía Remisión</label>
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.remission_guide_number}
                    onChange={(e) => setFormData({...formData, remission_guide_number: e.target.value})}
                    placeholder="E001-000123"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tracking / Seguimiento</label>
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2 bg-slate-50 text-slate-500"
                    value={formData.tracking_number}
                    onChange={(e) => setFormData({...formData, tracking_number: e.target.value})}
                    placeholder="Generado automáticamente"
                    disabled
                  />
                  <p className="text-xs text-slate-400 mt-1">Se generará automáticamente si se deja vacío</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notas Adicionales</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows="2"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Guardar Envío
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Shipments;
