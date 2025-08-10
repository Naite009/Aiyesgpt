import { supabase } from "@/lib/supabase";

export default function Auth() {
  const signInEmail = async () => {
    const email = prompt("Enter your email for a magic link:");
    if (!email) return;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }, // returns to your app
    });
    if (error) alert(error.message);
    else alert("Check your email for the sign-in link.");
  };

  const signInGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) alert(error.message);
  };

  return (
    <div className="max-w-sm mx-auto grid gap-3">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <button className="btn btn-outline" onClick={signInEmail}>Email magic link</button>
      <button className="btn btn-primary" onClick={signInGoogle}>Continue with Google</button>
      <p className="text-sm text-white/60">
        After clicking the email link, you’ll land back here signed in.
      </p>
    </div>
  );
}
