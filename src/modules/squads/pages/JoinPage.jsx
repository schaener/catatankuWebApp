import { useNavigate, useParams } from 'react-router-dom';
import { JoinSheet } from './SquadsPage.jsx';

/** Invite links (/join/KLG-7Q2M) open the join sheet with the code filled in. */
export default function JoinPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  return (
    <div className="page k-page">
      <JoinSheet initialCode={code || ''} onClose={() => navigate('/squads', { replace: true })} />
    </div>
  );
}
