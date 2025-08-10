import { supabase } from "@/lib/supabase";
import { useSession } from "@/hooks/useSession";
import { Link } from "react-router-dom";

export default function AuthButton() {
  const { user } = useSession();

  if (!user) {
    return <Link to="/auth" className="btn btn-outline">Sign in</Link>;
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-white/80">{user.email}</span>
      <button className="btn btn-primary" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </div>
  );
}
