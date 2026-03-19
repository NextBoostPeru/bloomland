import React, { useState, useEffect } from 'react';
import { Plus, Eye, ArrowUpRight, ArrowDownLeft, Landmark, Edit } from 'lucide-react';
import api from '../../services/api';

const BankAccounts = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [movements, setMovements] = useState([]);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  
  const [formData, setFormData] = useState({
    bank_name: '',
    account_number: '',
    currency: 'PEN',
    balance: '',
    account_type: 'Ahorros'
  });

  const [movementData, setMovementData] = useState({
    type: 'income',
    amount: '',
    description: '',
    transaction_date: new Date().toISOString().split('T')[0]
  });

  const fetchAccounts = async () => {
    try {
      const response = await api.get('/finanzas/banks');
      setAccounts(response.data);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMovements = async (accountId) => {
    try {
      const response = await api.get(`/finanzas/banks/${accountId}/movements`);
      setMovements(response.data);
    } catch (error) {
      console.error('Error fetching movements:', error);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const openNewAccountModal = () => {
    setEditingAccount(null);
    setFormData({
      bank_name: '',
      account_number: '',
      currency: 'PEN',
      balance: '',
      account_type: 'Ahorros'
    });
    setShowModal(true);
  };

  const openEditAccountModal = (account) => {
    setEditingAccount(account);
    setFormData({
      bank_name: account.bank_name || '',
      account_number: account.account_number || '',
      currency: account.currency || 'PEN',
      balance: account.balance !== null && account.balance !== undefined ? String(account.balance) : '',
      account_type: account.account_type || 'Ahorros'
    });
    setShowModal(true);
  };

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        balance: formData.balance === '' ? 0 : parseFloat(formData.balance)
      };

      if (editingAccount) {
        await api.put(`/finanzas/banks/${editingAccount.id}`, payload);
        setSelectedAccount(prev => {
          if (prev && prev.id === editingAccount.id) {
            return { ...prev, ...payload };
          }
          return prev;
        });
      } else {
        await api.post('/finanzas/banks', payload);
      }
      setShowModal(false);
      setEditingAccount(null);
      setFormData({
        bank_name: '',
        account_number: '',
        currency: 'PEN',
        balance: '',
        account_type: 'Ahorros'
      });
      fetchAccounts();
    } catch (error) {
      console.error('Error creating account:', error);
    }
  };

  const handleCreateMovement = async (e) => {
    e.preventDefault();
    if (!selectedAccount) return;
    try {
      await api.post('/finanzas/movements', {
        ...movementData,
        bank_account_id: selectedAccount.id
      });
      setShowMovementModal(false);
      setMovementData({
        type: 'income',
        amount: '',
        description: '',
        transaction_date: new Date().toISOString().split('T')[0]
      });
      fetchAccounts(); // Refresh balance
      fetchMovements(selectedAccount.id); // Refresh movements list
    } catch (error) {
      console.error('Error creating movement:', error);
    }
  };

  const openAccountDetails = (account) => {
    setSelectedAccount(account);
    fetchMovements(account.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-slate-800">Cuentas Bancarias</h2>
        <button 
          onClick={openNewAccountModal}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700"
        >
          <Plus size={20} /> Nueva Cuenta
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <p>Cargando cuentas...</p>
        ) : accounts.length === 0 ? (
          <p className="text-slate-500">No hay cuentas registradas.</p>
        ) : (
          accounts.map(account => (
            <div key={account.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <Landmark className="text-blue-600" size={24} />
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => openEditAccountModal(account)}
                    className="text-slate-400 hover:text-indigo-600"
                    title="Editar cuenta"
                  >
                    <Edit size={18} />
                  </button>
                  <button 
                    onClick={() => openAccountDetails(account)}
                    className="text-slate-400 hover:text-indigo-600"
                    title="Ver movimientos"
                  >
                    <Eye size={20} />
                  </button>
                </div>
              </div>
              <h3 className="font-bold text-lg text-slate-800">{account.bank_name}</h3>
              <p className="text-slate-500 text-sm mb-4">{account.account_number} • {account.account_type}</p>
              
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Saldo Disponible</p>
                  <p className={`text-2xl font-bold ${account.balance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {account.currency === 'PEN' ? 'S/' : '$'} {parseFloat(account.balance).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Account Details & Movements Modal */}
      {selectedAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-slate-800">{selectedAccount.bank_name} - {selectedAccount.currency}</h3>
                <p className="text-slate-500">{selectedAccount.account_number}</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowMovementModal(true)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
                >
                  <Plus size={16} /> Registrar Movimiento
                </button>
                <button 
                  onClick={() => openEditAccountModal(selectedAccount)}
                  className="bg-slate-100 text-slate-700 px-3 py-2 rounded-lg text-sm hover:bg-slate-200"
                >
                  Editar Cuenta
                </button>
                <button 
                  onClick={() => setSelectedAccount(null)}
                  className="text-slate-400 hover:text-slate-600 px-2"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600">Fecha</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600">Descripción</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600 text-right">Monto</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600">Tipo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movements.map(mov => (
                    <tr key={mov.id}>
                      <td className="px-4 py-3 text-sm text-slate-600">{mov.transaction_date}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">{mov.description}</td>
                      <td className={`px-4 py-3 text-sm font-bold text-right ${mov.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {mov.type === 'income' ? '+' : '-'} {parseFloat(mov.amount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          mov.type === 'income' 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {mov.type === 'income' ? 'Ingreso' : 'Egreso'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* New Account Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">
              {editingAccount ? 'Editar Cuenta Bancaria' : 'Nueva Cuenta Bancaria'}
            </h3>
            <form onSubmit={handleSaveAccount} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Banco</label>
                <input 
                  type="text" required
                  className="w-full border border-slate-300 rounded-lg p-2"
                  value={formData.bank_name}
                  onChange={e => setFormData({...formData, bank_name: e.target.value})}
                  placeholder="BCP, Interbank, BBVA..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Número de Cuenta</label>
                <input 
                  type="text" required
                  className="w-full border border-slate-300 rounded-lg p-2"
                  value={formData.account_number}
                  onChange={e => setFormData({...formData, account_number: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Moneda</label>
                  <select 
                    className="w-full border border-slate-300 rounded-lg p-2"
                    value={formData.currency}
                    onChange={e => setFormData({...formData, currency: e.target.value})}
                  >
                    <option value="PEN">Soles (PEN)</option>
                    <option value="USD">Dólares (USD)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                  <select 
                    className="w-full border border-slate-300 rounded-lg p-2"
                    value={formData.account_type}
                    onChange={e => setFormData({...formData, account_type: e.target.value})}
                  >
                    <option>Ahorros</option>
                    <option>Corriente</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {editingAccount ? 'Saldo Actual' : 'Saldo Inicial'}
                </label>
                <input 
                  type="number" step="0.01" required
                  className="w-full border border-slate-300 rounded-lg p-2"
                  value={formData.balance}
                  onChange={e => setFormData({...formData, balance: e.target.value})}
                />
              </div>
              <div className="flex justify-end gap-2 mt-6">
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
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Movement Modal */}
      {showMovementModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60">
          <div className="bg-white p-6 rounded-xl w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Registrar Movimiento</h3>
            <form onSubmit={handleCreateMovement} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMovementData({...movementData, type: 'income'})}
                    className={`flex-1 py-2 rounded-lg font-medium ${movementData.type === 'income' ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-500' : 'bg-slate-100 text-slate-600'}`}
                  >
                    Ingreso
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementData({...movementData, type: 'expense'})}
                    className={`flex-1 py-2 rounded-lg font-medium ${movementData.type === 'expense' ? 'bg-red-100 text-red-700 ring-2 ring-red-500' : 'bg-slate-100 text-slate-600'}`}
                  >
                    Egreso
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Monto</label>
                <input 
                  type="number" step="0.01" required
                  className="w-full border border-slate-300 rounded-lg p-2"
                  value={movementData.amount}
                  onChange={e => setMovementData({...movementData, amount: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <input 
                  type="text" required
                  className="w-full border border-slate-300 rounded-lg p-2"
                  value={movementData.description}
                  onChange={e => setMovementData({...movementData, description: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                <input 
                  type="date" required
                  className="w-full border border-slate-300 rounded-lg p-2"
                  value={movementData.transaction_date}
                  onChange={e => setMovementData({...movementData, transaction_date: e.target.value})}
                />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button 
                  type="button" 
                  onClick={() => setShowMovementModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankAccounts;
