import AdminApp from './components/admin/AdminApp.jsx';
import PublicFeedbackPage from './pages/PublicFeedbackPage.jsx';

export default function App() {
  return typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')
    ? <AdminApp />
    : <PublicFeedbackPage />;
}
