import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="card" style={{ maxWidth: 520, margin: '40px auto', textAlign: 'center', padding: 36 }}>
      <div className="empty-icon" style={{ margin: '0 auto 12px' }}>
        <Compass size={22} />
      </div>
      <h2 style={{ fontSize: 18 }}>Page not found</h2>
      <p className="small muted" style={{ marginTop: 6 }}>
        The page you are looking for does not exist or may have been moved. Please return to the dashboard to continue.
      </p>
      <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/')}>
        Back to dashboard
      </button>
    </div>
  );
}
