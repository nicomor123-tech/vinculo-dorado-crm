import { useState } from 'react';
import { UserPlus, Building2 } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { LeadsModule } from './components/LeadsModule';
import { NewLeadForm } from './components/NewLeadForm';
import { LeadDetail } from './components/LeadDetail';
import { HogaresModule } from './components/hogares/HogaresModule';
import { HogarDetail } from './components/hogares/HogarDetail';
import { NewHogarForm } from './components/hogares/NewHogarForm';
import { ProposalPage } from './components/ProposalPage';
import { KanbanView } from './components/KanbanView';
import { UserManagement } from './components/UserManagement';
import { ComisionesModule } from './components/ComisionesModule';

const proposalMatch = window.location.pathname.match(/^\/propuesta\/([^/]+)/);
const PUBLIC_PROPOSAL_ID = proposalMatch ? proposalMatch[1] : null;

function AppContent() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedHogarId, setSelectedHogarId] = useState<string | null>(null);
  const [showNewLeadForm, setShowNewLeadForm] = useState(false);
  const [showNewHogarForm, setShowNewHogarForm] = useState(false);
  const [leadsFilter, setLeadsFilter] = useState<{ estado?: string; urgencia?: string } | null>(null);

  const handleViewChange = (view: string) => {
    setCurrentView(view);
    setSelectedLeadId(null);
    setSelectedHogarId(null);
    setShowNewLeadForm(false);
    if (view !== 'leads') setLeadsFilter(null);
  };

  const handleNavigateToLeads = (filter: { estado?: string; urgencia?: string }) => {
    setLeadsFilter(filter);
    setSelectedLeadId(null);
    setCurrentView('leads');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-sage-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sage-500 text-sm font-medium">Cargando Vínculo Dorado...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <Layout currentView={currentView} onViewChange={handleViewChange}>
      {currentView === 'dashboard' && (
        <Dashboard
          onNavigateToLeads={handleNavigateToLeads}
          onViewLead={(id) => { setSelectedLeadId(id); setCurrentView('leads'); }}
        />
      )}

      {currentView === 'leads' && !selectedLeadId && (
        <LeadsModule
          onCreateNew={() => setShowNewLeadForm(true)}
          onViewDetail={setSelectedLeadId}
          initialFilter={leadsFilter}
        />
      )}
      {currentView === 'leads' && selectedLeadId && (
        <LeadDetail leadId={selectedLeadId} onBack={() => setSelectedLeadId(null)} />
      )}

      {currentView === 'kanban' && (
        <KanbanView onViewDetail={(id) => { setSelectedLeadId(id); setCurrentView('leads'); }} />
      )}

      {currentView === 'hogares' && !selectedHogarId && (
        <HogaresModule onViewDetail={setSelectedHogarId} onCreateNew={() => setShowNewHogarForm(true)} />
      )}
      {currentView === 'hogares' && selectedHogarId && (
        <HogarDetail hogarId={selectedHogarId} onBack={() => setSelectedHogarId(null)} />
      )}

      {currentView === 'comisiones' && <ComisionesModule />}

      {currentView === 'usuarios' && <UserManagement />}

      {/* Mobile FAB — lead (dashboard, leads, kanban) */}
      {['dashboard', 'leads', 'kanban'].includes(currentView) && !selectedLeadId && (
        <button
          onClick={() => setShowNewLeadForm(true)}
          className="fixed bottom-[72px] right-4 z-30 lg:hidden w-14 h-14 rounded-full text-white flex items-center justify-center shadow-xl active:scale-95 transition-transform"
          style={{ background: 'linear-gradient(135deg, #3d653d, #213521)' }}
          title="Nuevo lead"
        >
          <UserPlus className="w-6 h-6" />
        </button>
      )}

      {/* Mobile FAB — hogar */}
      {currentView === 'hogares' && !selectedHogarId && (
        <button
          onClick={() => setShowNewHogarForm(true)}
          className="fixed bottom-[72px] right-4 z-30 lg:hidden w-14 h-14 rounded-full text-white flex items-center justify-center shadow-xl active:scale-95 transition-transform"
          style={{ background: 'linear-gradient(135deg, #0d9488, #0f766e)' }}
          title="Nuevo hogar"
        >
          <Building2 className="w-6 h-6" />
        </button>
      )}

      {showNewLeadForm && (
        <NewLeadForm
          onClose={() => setShowNewLeadForm(false)}
          onSuccess={() => { setShowNewLeadForm(false); setCurrentView('leads'); }}
          onViewHogar={(id) => { setShowNewLeadForm(false); setSelectedHogarId(id); setCurrentView('hogares'); }}
        />
      )}

      {showNewHogarForm && (
        <NewHogarForm
          onClose={() => setShowNewHogarForm(false)}
          onSuccess={(id) => {
            setShowNewHogarForm(false);
            if (id) { setSelectedHogarId(id); setCurrentView('hogares'); }
          }}
        />
      )}
    </Layout>
  );
}

function App() {
  if (PUBLIC_PROPOSAL_ID) return <ProposalPage propuestaId={PUBLIC_PROPOSAL_ID} />;
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
