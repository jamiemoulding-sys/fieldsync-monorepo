import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import supabase from '../lib/supabase';

function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const acceptInvite = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        navigate('/login');
        return;
      }

      const { data: invite } = await supabase
        .from('invitations')
        .select('*')
        .eq('token', token)
        .maybeSingle();

      if (!invite) {
        alert('Invalid invite');
        navigate('/dashboard');
        return;
      }

      await supabase.from('employees').insert({
        user_id: user.id,
        company_id: invite.company_id,
        role: invite.role
      });

      await supabase
        .from('invitations')
        .delete()
        .eq('token', token);

      navigate('/dashboard');
    };

    acceptInvite();
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center text-white">
      Joining company...
    </div>
  );
}

export default AcceptInvite;