import React, { useState } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import Expenses from './Expenses';
import BankAccounts from './BankAccounts';
import { DollarSign, Landmark } from 'lucide-react';

const FinancePage = () => {
  const [activeTab, setActiveTab] = useState('banks');

  return (
    <DashboardLayout title="Finanzas">
      <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Finanzas</h1>
          <p className="text-slate-500">Gestión de bancos y caja chica</p>
        </div>
      </div>

      <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 inline-flex">
        <button
          onClick={() => setActiveTab('banks')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'banks' 
              ? 'bg-indigo-600 text-white shadow-sm' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Landmark size={18} />
          Bancos
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'expenses' 
              ? 'bg-indigo-600 text-white shadow-sm' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <DollarSign size={18} />
          Caja Chica
        </button>
      </div>

      {activeTab === 'banks' ? <BankAccounts /> : <Expenses />}
      </div>
    </DashboardLayout>
  );
};

export default FinancePage;
