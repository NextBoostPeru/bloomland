import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, FileText, DollarSign, Search, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const Expenses = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    category: 'General',
    expense_date: new Date().toISOString().split('T')[0],
    type: 'expense' // 'income' or 'expense'
  });

  const fetchExpenses = async () => {
    try {
      const response = await api.get('/finanzas/expenses');
      setExpenses(response.data.data || []); // Handle case where data might be null/undefined
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/finanzas/expenses', {
        ...formData,
        user_id: user?.id
      });
      setShowModal(false);
      setFormData({
        amount: '',
        description: '',
        category: 'General',
        expense_date: new Date().toISOString().split('T')[0],
        type: 'expense'
      });
      fetchExpenses();
    } catch (error) {
      console.error('Error creating expense:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este movimiento?')) return;
    try {
      await api.delete(`/finanzas/expenses/${id}`);
      fetchExpenses();
    } catch (error) {
      console.error('Error deleting expense:', error);
    }
  };

  // Calculate totals
  const totalIncome = expenses.filter(e => e.type === 'income').reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
  const totalExpense = expenses.filter(e => e.type === 'expense').reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
  const balance = totalIncome - totalExpense;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Caja Chica / Movimientos</h2>
          <p className="text-sm text-slate-500">Gestión de ingresos y egresos menores</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700"
        >
          <Plus size={20} /> Nuevo Movimiento
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="text-slate-500 text-sm font-medium mb-1">Ingresos Totales</div>
          <div className="text-2xl font-bold text-green-600">S/ {totalIncome.toFixed(2)}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="text-slate-500 text-sm font-medium mb-1">Egresos Totales</div>
          <div className="text-2xl font-bold text-red-600">S/ {totalExpense.toFixed(2)}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="text-slate-500 text-sm font-medium mb-1">Balance Actual</div>
          <div className={`text-2xl font-bold ${balance >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
            S/ {balance.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-semibold text-slate-600">Tipo</th>
              <th className="px-6 py-4 font-semibold text-slate-600">Fecha</th>
              <th className="px-6 py-4 font-semibold text-slate-600">Descripción</th>
              <th className="px-6 py-4 font-semibold text-slate-600">Categoría</th>
              <th className="px-6 py-4 font-semibold text-slate-600">Monto</th>
              <th className="px-6 py-4 font-semibold text-slate-600">Responsable</th>
              <th className="px-6 py-4 font-semibold text-slate-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan="7" className="p-6 text-center">Cargando...</td></tr>
            ) : expenses.length === 0 ? (
              <tr><td colSpan="7" className="p-6 text-center text-slate-500">No hay movimientos registrados</td></tr>
            ) : (
              expenses.map(expense => (
                <tr key={expense.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    {expense.type === 'income' ? (
                      <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-full text-xs font-medium w-fit">
                        <ArrowUpCircle size={14} /> Ingreso
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-full text-xs font-medium w-fit">
                        <ArrowDownCircle size={14} /> Egreso
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{expense.expense_date}</td>
                  <td className="px-6 py-4 font-medium text-slate-800">{expense.description}</td>
                  <td className="px-6 py-4">
                    <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-medium">
                      {expense.category}
                    </span>
                  </td>
                  <td className={`px-6 py-4 font-bold ${expense.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {expense.type === 'income' ? '+' : '-'} S/ {parseFloat(expense.amount).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-sm">
                    {expense.user_name || 'Desconocido'}
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => handleDelete(expense.id)}
                      className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Registrar Movimiento</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Type Selector */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => setFormData({...formData, type: 'income'})}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg border font-medium transition-colors ${
                    formData.type === 'income' 
                      ? 'bg-green-50 border-green-200 text-green-700 ring-2 ring-green-500 ring-offset-1' 
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <ArrowUpCircle size={18} /> Ingreso
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, type: 'expense'})}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg border font-medium transition-colors ${
                    formData.type === 'expense' 
                      ? 'bg-red-50 border-red-200 text-red-700 ring-2 ring-red-500 ring-offset-1' 
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <ArrowDownCircle size={18} /> Egreso
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <input 
                  type="text" required
                  className="w-full border border-slate-300 rounded-lg p-2"
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  placeholder={formData.type === 'income' ? "Ej: Reposición de caja" : "Ej: Compra de útiles"}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Monto (S/)</label>
                  <input 
                    type="number" step="0.01" required
                    className="w-full border border-slate-300 rounded-lg p-2"
                    value={formData.amount}
                    onChange={e => setFormData({...formData, amount: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                  <input 
                    type="date" required
                    className="w-full border border-slate-300 rounded-lg p-2"
                    value={formData.expense_date}
                    onChange={e => setFormData({...formData, expense_date: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
                <select 
                  className="w-full border border-slate-300 rounded-lg p-2"
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                >
                  {formData.type === 'income' ? (
                    <>
                      <option>Reposición</option>
                      <option>Venta Efectivo</option>
                      <option>Devolución</option>
                      <option>Otros Ingresos</option>
                    </>
                  ) : (
                    <>
                      <option>General</option>
                      <option>Transporte</option>
                      <option>Alimentación</option>
                      <option>Materiales</option>
                      <option>Servicios</option>
                      <option>Mantenimiento</option>
                    </>
                  )}
                </select>
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
                  className={`px-4 py-2 text-white rounded-lg hover:opacity-90 ${formData.type === 'income' ? 'bg-green-600' : 'bg-red-600'}`}
                >
                  {formData.type === 'income' ? 'Registrar Ingreso' : 'Registrar Egreso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
