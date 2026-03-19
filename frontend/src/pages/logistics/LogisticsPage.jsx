import React, { useState } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import Shipments from './Shipments';
import Providers from './Providers';
import { useAuth } from '../../context/AuthContext';

const LogisticsPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('shipments');

  const tabs = [
    { id: 'shipments', label: 'Envíos y Despachos', roles: ['Administrador', 'Supervisor', 'Almacén'] },
    { id: 'providers', label: 'Proveedores Logísticos', roles: ['Administrador'] },
  ];

  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">Logística y Envíos</h1>
        
        <div className="flex space-x-4 mb-6 border-b border-slate-200">
          {tabs.map((tab) => {
            if (!tab.roles.includes(user?.role)) return null;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-4 font-medium text-sm transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-indigo-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full"></div>
                )}
              </button>
            );
          })}
        </div>

        {activeTab === 'shipments' && <Shipments />}
        {activeTab === 'providers' && <Providers />}
      </div>
    </DashboardLayout>
  );
};

export default LogisticsPage;
