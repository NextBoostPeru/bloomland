import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, Package, TrendingUp, Calendar } from 'lucide-react';
import api from '../../services/api';
import DashboardLayout from '../../layouts/DashboardLayout';

const ReportsPage = () => {
  const [activeTab, setActiveTab] = useState('sales');
  const [salesData, setSalesData] = useState(null);
  const [stockData, setStockData] = useState(null);
  const [financeData, setFinanceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchReport(activeTab);
  }, [activeTab, dateRange]);

  const fetchReport = async (type) => {
    setLoading(true);
    try {
      const params = { start_date: dateRange.start, end_date: dateRange.end };
      
      let endpoint = '';
      if (type === 'sales') endpoint = 'sales';
      else if (type === 'stock') endpoint = 'stock';
      else if (type === 'finance') endpoint = 'finance';

      const response = await api.get(`/reports/${endpoint}`, { params });

      if (type === 'sales') setSalesData(response.data);
      if (type === 'stock') setStockData(response.data);
      if (type === 'finance') setFinanceData(response.data);

    } catch (error) {
      console.error(`Error fetching ${type} report:`, error);
    } finally {
      setLoading(false);
    }
  };

  const renderSalesTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">Total Ventas (Periodo)</div>
          <div className="text-2xl font-bold text-slate-800">
            S/ {salesData?.summary?.total_revenue || '0.00'}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">Total Pedidos</div>
          <div className="text-2xl font-bold text-slate-800">
            {salesData?.summary?.count || 0}
          </div>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-96">
        <h3 className="text-lg font-semibold mb-4">Evolución de Ventas</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={salesData?.daily_sales || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="total_sales" fill="#4f46e5" name="Ventas (S/)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderStockTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="text-sm text-slate-500 mb-1">Valorización de Inventario (Estimado)</div>
        <div className="text-2xl font-bold text-slate-800">
          S/ {stockData?.inventory_valuation || '0.00'}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-red-600">Alerta de Stock Bajo</h3>
        </div>
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-semibold text-slate-600">Producto</th>
              <th className="px-6 py-4 font-semibold text-slate-600">SKU</th>
              <th className="px-6 py-4 font-semibold text-slate-600">Stock Actual</th>
              <th className="px-6 py-4 font-semibold text-slate-600">Mínimo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {stockData?.low_stock?.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium">{item.name}</td>
                <td className="px-6 py-4 text-slate-500">{item.sku}</td>
                <td className="px-6 py-4 text-red-600 font-bold">{item.stock_quantity}</td>
                <td className="px-6 py-4 text-slate-500">{item.min_stock_level}</td>
              </tr>
            ))}
            {(!stockData?.low_stock || stockData.low_stock.length === 0) && (
              <tr><td colSpan="4" className="p-6 text-center text-slate-500">No hay productos con stock bajo</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderFinanceTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">Ingresos</div>
          <div className="text-2xl font-bold text-green-600">
            S/ {financeData?.income || '0.00'}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">Gastos</div>
          <div className="text-2xl font-bold text-red-600">
            S/ {financeData?.expense || '0.00'}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">Balance</div>
          <div className={`text-2xl font-bold ${financeData?.balance >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
            S/ {financeData?.balance || '0.00'}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <DashboardLayout title="Reportes y Analítica">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <p className="text-slate-500">Informes detallados para la toma de decisiones</p>
          </div>
          
          <div className="flex gap-2 items-center bg-white p-2 rounded-lg border border-slate-200">
            <Calendar size={18} className="text-slate-400" />
            <input 
              type="date" 
              value={dateRange.start}
              onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
              className="text-sm border-none focus:ring-0 text-slate-600"
            />
            <span className="text-slate-400">-</span>
            <input 
              type="date" 
              value={dateRange.end}
              onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
              className="text-sm border-none focus:ring-0 text-slate-600"
            />
          </div>
        </div>

        <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('sales')}
          className={`flex items-center gap-2 px-4 py-3 font-medium text-sm whitespace-nowrap ${
            activeTab === 'sales' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <TrendingUp size={18} /> Ventas
        </button>
        <button
          onClick={() => setActiveTab('stock')}
          className={`flex items-center gap-2 px-4 py-3 font-medium text-sm whitespace-nowrap ${
            activeTab === 'stock' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Package size={18} /> Stock y Rotación
        </button>
        <button
          onClick={() => setActiveTab('finance')}
          className={`flex items-center gap-2 px-4 py-3 font-medium text-sm whitespace-nowrap ${
            activeTab === 'finance' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <DollarSign size={18} /> Financiero
        </button>
      </div>

      <div className="min-h-[300px]">
        {loading ? (
          <div className="flex justify-center items-center h-64 text-slate-500">Cargando datos...</div>
        ) : (
          <>
            {activeTab === 'sales' && renderSalesTab()}
            {activeTab === 'stock' && renderStockTab()}
            {activeTab === 'finance' && renderFinanceTab()}
          </>
        )}
      </div>
      </div>
    </DashboardLayout>
  );
};

export default ReportsPage;
