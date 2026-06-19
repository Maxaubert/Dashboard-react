import { useNavigate } from 'react-router-dom';
import { useCurrentUser, useLogout } from '@/hooks/useCurrentUser';

export function HomeAccount() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <div className="home-account">
      <span className="home-account-name">{user.display_name || user.email}</span>
      <button
        type="button"
        className="home-account-logout"
        disabled={logout.isPending}
        title="Logg ut"
        aria-label="Logg ut"
        onClick={() =>
          logout.mutate(undefined, {
            onSuccess: () => navigate('/login', { replace: true }),
          })
        }
      >
        Logg ut
      </button>
    </div>
  );
}
