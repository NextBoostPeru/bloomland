import { useState, useEffect } from 'react';
import { X, Search, UserPlus, CreditCard, Banknote, Smartphone, Printer, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const CheckoutModal = ({ isOpen, onClose, total, cart, onProcessSale }) => {
  const [step, setStep] = useState(1); // 1: Customer, 2: Payment, 3: Success
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', document_number: '', document_type: 'DNI', address: '', email: '' });
  
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [amountTendered, setAmountTendered] = useState('');
  const [receiptType, setReceiptType] = useState('Boleta');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSaleId, setLastSaleId] = useState(null);
  const [searchingDoc, setSearchingDoc] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setCustomerSearch('');
      setSelectedCustomer(null);
      setPaymentMethod('Efectivo');
      setAmountTendered('');
      setReceiptType('Boleta');
      setLastSaleId(null);
      searchCustomers('');
    }
  }, [isOpen]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (isOpen && step === 1 && !isCreatingCustomer) {
        searchCustomers(customerSearch);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [customerSearch, isOpen, step, isCreatingCustomer]);

  const searchCustomers = async (query) => {
    try {
      const response = await api.get(`/clientes?q=${query}`);
      setCustomers(response.data);
    } catch (error) {
      console.error("Error searching customers:", error);
    }
  };

  const handleSearchDocument = async () => {
    if (!newCustomer.document_number) {
      toast.error('Ingrese un número de documento');
      return;
    }

    setSearchingDoc(true);
    try {
      let endpoint = '';
      if (newCustomer.document_type === 'DNI') {
        if (newCustomer.document_number.length !== 8) {
           toast.error('El DNI debe tener 8 dígitos');
           setSearchingDoc(false);
           return;
        }
        endpoint = `/external/dni/${newCustomer.document_number}`;
      } else if (newCustomer.document_type === 'RUC') {
        if (newCustomer.document_number.length !== 11) {
           toast.error('El RUC debe tener 11 dígitos');
           setSearchingDoc(false);
           return;
        }
        endpoint = `/external/ruc/${newCustomer.document_number}`;
      } else {
        toast.error('Búsqueda no disponible para este tipo de documento');
        setSearchingDoc(false);
        return;
      }

      const response = await api.get(endpoint);
      const data = response.data;

      if (newCustomer.document_type === 'DNI') {
        setNewCustomer(prev => ({
          ...prev,
          name: `${data.nombres} ${data.apellido_paterno} ${data.apellido_materno}`,
          address: '' 
        }));
      } else if (newCustomer.document_type === 'RUC') {
        setNewCustomer(prev => ({
          ...prev,
          name: data.nombre_o_razon_social,
          address: data.direccion_completa || ''
        }));
      }
      
      toast.success('Datos encontrados');
    } catch (error) {
      console.error(error);
      toast.error('No se encontraron datos o hubo un error');
    } finally {
      setSearchingDoc(false);
    }
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/clientes', newCustomer);
      setSelectedCustomer(response.data);
      setIsCreatingCustomer(false);
      toast.success('Cliente creado correctamente');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al crear cliente');
    }
  };

  const handleProcessSale = async () => {
    if (!selectedCustomer) {
      toast.error('Seleccione un cliente');
      return;
    }
    
    if (parseFloat(amountTendered || 0) < total && paymentMethod === 'Efectivo') {
      toast.error('El monto abonado es insuficiente');
      return;
    }

    setIsProcessing(true);
    try {
      const saleData = {
        customer_id: selectedCustomer.id,
        items: cart.map(item => ({ id: item.id, quantity: item.quantity, price: item.price })),
        total: total,
        payment_method: paymentMethod,
        amount_tendered: paymentMethod === 'Efectivo' ? parseFloat(amountTendered) : total,
        receipt_type: receiptType
      };

      // Call API to create order
      const response = await api.post('/ventas', saleData);
      
      setLastSaleId(response.data.order_id);
      setStep(3);
      if (onProcessSale) onProcessSale();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Error al procesar la venta');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Procesar Venta</h2>
            <p className="text-sm text-slate-500">Total a pagar: <span className="font-bold text-indigo-600 text-lg">S/ {total.toFixed(2)}</span></p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          {step === 1 && (
            <div className="space-y-6">
              {!isCreatingCustomer ? (
                <>
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-slate-700">Buscar Cliente</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="text"
                        placeholder="Buscar por DNI, RUC o Nombre..."
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-medium text-slate-700">Resultados</h3>
                      <button 
                        onClick={() => setIsCreatingCustomer(true)}
                        className="text-sm text-indigo-600 font-bold hover:text-indigo-700 flex items-center gap-1"
                      >
                        <UserPlus className="w-4 h-4" /> Nuevo Cliente
                      </button>
                    </div>
                    
                    <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 max-h-60 overflow-y-auto">
                      {customers.length === 0 ? (
                        <div className="p-4 text-center text-gray-400 text-sm">No se encontraron clientes</div>
                      ) : (
                        customers.map(customer => (
                          <div 
                            key={customer.id} 
                            onClick={() => setSelectedCustomer(customer)}
                            className={`p-3 flex justify-between items-center cursor-pointer hover:bg-indigo-50 transition-colors ${selectedCustomer?.id === customer.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''}`}
                          >
                            <div>
                              <p className="font-bold text-slate-800">{customer.name}</p>
                              <p className="text-xs text-gray-500">{customer.document_type}: {customer.document_number}</p>
                            </div>
                            {selectedCustomer?.id === customer.id && <CheckCircle className="w-5 h-5 text-indigo-600" />}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button
                      onClick={() => setStep(2)}
                      disabled={!selectedCustomer}
                      className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Continuar al Pago
                    </button>
                  </div>
                </>
              ) : (
                <form onSubmit={handleCreateCustomer} className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                    <h3 className="font-bold text-slate-800">Nuevo Cliente</h3>
                    <button type="button" onClick={() => setIsCreatingCustomer(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Tipo Doc.</label>
                      <select 
                        className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-indigo-500"
                        value={newCustomer.document_type}
                        onChange={e => setNewCustomer({...newCustomer, document_type: e.target.value})}
                      >
                        <option value="DNI">DNI</option>
                        <option value="RUC">RUC</option>
                        <option value="CE">Carnet Ext.</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Número Doc.</label>
                      <div className="relative">
                        <input 
                            type="text" 
                            required
                            className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-indigo-500 pr-10"
                            value={newCustomer.document_number}
                            onChange={e => setNewCustomer({...newCustomer, document_number: e.target.value})}
                        />
                        <button
                            type="button"
                            onClick={handleSearchDocument}
                            disabled={searchingDoc}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                            title="Buscar en RENIEC/SUNAT"
                        >
                            {searchingDoc ? <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div> : <Search className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Nombre Completo / Razón Social</label>
                    <input 
                      type="text" 
                      required
                      className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-indigo-500"
                      value={newCustomer.name}
                      onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Dirección (Opcional)</label>
                    <input 
                      type="text" 
                      className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:border-indigo-500"
                      value={newCustomer.address}
                      onChange={e => setNewCustomer({...newCustomer, address: e.target.value})}
                    />
                  </div>

                  <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors">
                    Guardar Cliente
                  </button>
                </form>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-500">Cliente</span>
                  <span className="font-bold text-slate-800">{selectedCustomer?.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Documento</span>
                  <span className="font-medium text-slate-800">{selectedCustomer?.document_type} {selectedCustomer?.document_number}</span>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">Tipo de Comprobante</label>
                <div className="grid grid-cols-3 gap-3">
                  {['Boleta', 'Factura', 'Nota de Venta'].map(type => (
                    <button
                      key={type}
                      onClick={() => setReceiptType(type)}
                      className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                        receiptType === type 
                          ? 'bg-indigo-600 text-white border-indigo-600' 
                          : 'bg-white text-slate-600 border-gray-200 hover:border-indigo-300'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">Método de Pago</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'Efectivo', icon: Banknote },
                    { id: 'Tarjeta', icon: CreditCard },
                    { id: 'Yape', icon: Smartphone },
                    { id: 'Plin', icon: Smartphone }
                  ].map(method => (
                    <button
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        paymentMethod === method.id 
                          ? 'bg-indigo-50 border-indigo-600 text-indigo-700 ring-1 ring-indigo-600' 
                          : 'bg-white border-gray-200 text-slate-600 hover:bg-gray-50'
                      }`}
                    >
                      <method.icon className="w-5 h-5" />
                      <span className="font-bold">{method.id}</span>
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod === 'Efectivo' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">Monto Abonado</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">S/</span>
                    <input
                      type="number"
                      step="0.10"
                      placeholder="0.00"
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-lg"
                      value={amountTendered}
                      onChange={(e) => setAmountTendered(e.target.value)}
                    />
                  </div>
                  {amountTendered && parseFloat(amountTendered) >= total && (
                    <div className="flex justify-between items-center p-3 bg-green-50 text-green-700 rounded-lg border border-green-100">
                      <span className="font-medium">Vuelto a entregar:</span>
                      <span className="font-bold text-xl">S/ {(parseFloat(amountTendered) - total).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between pt-4 gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Atrás
                </button>
                <button
                  onClick={handleProcessSale}
                  disabled={isProcessing || (paymentMethod === 'Efectivo' && parseFloat(amountTendered || 0) < total)}
                  className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                >
                  {isProcessing ? 'Procesando...' : `Cobrar S/ ${total.toFixed(2)}`}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col items-center justify-center py-8 space-y-6 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-2">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-800">¡Venta Exitosa!</h3>
                <p className="text-gray-500">La transacción se ha registrado correctamente.</p>
              </div>
              
              <div className="flex gap-3 w-full max-w-sm">
                <button onClick={onClose} className="flex-1 py-3 px-4 border border-gray-200 rounded-xl font-bold text-slate-600 hover:bg-gray-50 transition-colors">
                  Nueva Venta
                </button>
                <button 
                  onClick={() => {
                    const token = localStorage.getItem('token');
                    window.open(`${import.meta.env.VITE_API_URL}/ventas/${lastSaleId}/ticket?token=${token}`, '_blank');
                  }}
                  className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Printer className="w-5 h-5" /> Imprimir Ticket
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckoutModal;
