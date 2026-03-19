import { 
  TrendingUp, 
  Users, 
  ShoppingBag, 
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Loader2
} from 'lucide-react';
import { useState, useEffect } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import api from '../services/api';

const StatCard = ({ title, value, trend, trendValue, icon: Icon, color, loading }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300">
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        {loading ? (
          <div className="h-8 w-24 bg-gray-100 animate-pulse rounded"></div>
        ) : (
          <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
        )}
      </div>
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
    <div className="flex items-center text-sm">
      {loading ? (
        <div className="h-4 w-32 bg-gray-50 animate-pulse rounded"></div>
      ) : (
        <>
          <span className={`flex items-center font-semibold ${trend === 'up' ? 'text-emerald-500' : 'text-red-500'}`}>
            {trend === 'up' ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
            {trendValue}
          </span>
          <span className="text-gray-400 ml-2">vs mes anterior</span>
        </>
      )}
    </div>
  </div>
);

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/home/stats');
        setData(response.data);
      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
        setError('No se pudieron cargar las estadísticas');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <DashboardLayout title="Dashboard">
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Ventas Totales" 
          value={data?.stats?.total_sales?.value || 'S/ 0.00'} 
          trend={data?.stats?.total_sales?.trend || 'up'} 
          trendValue={data?.stats?.total_sales?.trendValue || '0%'} 
          icon={TrendingUp} 
          color="bg-indigo-500 shadow-indigo-200"
          loading={loading}
        />
        <StatCard 
          title="Pedidos Activos" 
          value={data?.stats?.active_orders?.value || '0'} 
          trend={data?.stats?.active_orders?.trend || 'up'} 
          trendValue={data?.stats?.active_orders?.trendValue || '0%'} 
          icon={ShoppingBag} 
          color="bg-emerald-500 shadow-emerald-200"
          loading={loading}
        />
        <StatCard 
          title="Nuevos Clientes" 
          value={data?.stats?.new_customers?.value || '0'} 
          trend={data?.stats?.new_customers?.trend || 'up'} 
          trendValue={data?.stats?.new_customers?.trendValue || '0%'} 
          icon={Users} 
          color="bg-blue-500 shadow-blue-200"
          loading={loading}
        />
        <StatCard 
          title="Alertas de Stock" 
          value={data?.stats?.stock_alerts?.value || '0'} 
          trend={data?.stats?.stock_alerts?.trend || 'down'} 
          trendValue={data?.stats?.stock_alerts?.trendValue || '0%'} 
          icon={AlertTriangle} 
          color="bg-amber-500 shadow-amber-200"
          loading={loading}
        />
      </div>

      {/* Main Content Area - Table Simulation */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Inventario Reciente</h3>
            <p className="text-sm text-gray-400">Últimos movimientos registrados</p>
          </div>
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
            Ver Todo
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <th className="px-6 py-4">Producto</th>
                <th className="px-6 py-4">Categoría</th>
                <th className="px-6 py-4 text-center">Stock</th>
                <th className="px-6 py-4 text-center">Estado</th>
                <th className="px-6 py-4 text-right">Precio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan="5" className="px-6 py-4">
                      <div className="h-8 bg-gray-50 animate-pulse rounded"></div>
                    </td>
                  </tr>
                ))
              ) : data?.recent_inventory?.length > 0 ? (
                data.recent_inventory.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                          <ShoppingBag className="w-5 h-5" />
                        </div>
                        <span className="font-semibold text-slate-700 text-sm">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                        {item.cat}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-sm text-slate-600">{item.stock}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        item.status === 'Agotado' ? 'bg-red-50 text-red-700 border-red-100' :
                        item.status === 'Bajo Stock' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                        'bg-emerald-50 text-emerald-700 border-emerald-100'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-700">{item.price}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                    {error || 'No hay datos disponibles'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
