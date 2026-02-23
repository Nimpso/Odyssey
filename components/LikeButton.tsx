'use client';
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface LikeButtonProps {
  tripId: string;
  initialCount?: number;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
}

export default function LikeButton({ tripId, initialCount = 0, size = 'md', showCount = true }: LikeButtonProps) {
  const supabase = createClientComponentClient();
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setChecked(true); return; }
      setUserId(user.id);
      const { data } = await supabase.from('likes').select('id').eq('user_id', user.id).eq('trip_id', tripId).maybeSingle();
      setLiked(!!data);
      setChecked(true);
    };
    check();
  }, [tripId, supabase]);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault(); 
    e.stopPropagation(); // Empêche d'ouvrir le voyage quand on clique sur le cœur
    
    if (!userId) { /* redirect to login or show toast */ return; }
    if (loading) return;
    setLoading(true);
    
    if (liked) {
      await supabase.from('likes').delete().eq('user_id', userId).eq('trip_id', tripId);
      setLiked(false); 
      setCount(c => Math.max(0, c - 1));
    } else {
      await supabase.from('likes').insert({ user_id: userId, trip_id: tripId });
      setLiked(true); 
      setCount(c => c + 1);
    }
    setLoading(false);
  };

  const sizes = {
    sm: { btn: '0.35rem 0.65rem', icon: 12, font: '0.65rem', gap: 4, radius: 16 },
    md: { btn: '0.45rem 0.85rem', icon: 15, font: '0.72rem', gap: 5, radius: 20 },
    lg: { btn: '0.7rem 1.25rem', icon: 20, font: '0.88rem', gap: 7, radius: 24 },
  }[size];

  return (
    <div
      onClick={toggle}
      role="button"
      tabIndex={0}
      title={userId ? (liked ? 'Retirer des favoris' : 'Ajouter aux favoris') : 'Connectez-vous pour liker'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: sizes.gap,
        padding: sizes.btn,
        background: liked ? 'rgba(201,168,76,0.18)' : 'rgba(255,255,255,0.06)',
        border: `1px solid ${liked ? '#c9a84c' : 'rgba(255,255,255,0.12)'}`,
        borderRadius: sizes.radius,
        cursor: !userId ? 'default' : ((loading || !checked) ? 'wait' : 'pointer'),
        pointerEvents: (loading || !checked) ? 'none' : 'auto',
        transition: 'all 0.2s',
        opacity: (!checked || loading) ? 0.7 : 1,
        backdropFilter: 'blur(6px)',
      }}
      onMouseEnter={e => {
        if (!userId) return;
        (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.05)';
        (e.currentTarget as HTMLDivElement).style.borderColor = '#c9a84c';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
        (e.currentTarget as HTMLDivElement).style.borderColor = liked ? '#c9a84c' : 'rgba(255,255,255,0.12)';
      }}
    >
      <span style={{
        fontSize: sizes.icon,
        color: liked ? '#c9a84c' : 'rgba(255,255,255,0.6)',
        transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), color 0.2s',
        transform: liked ? 'scale(1.15)' : 'scale(1)',
        display: 'inline-block',
        lineHeight: 1,
      }}>
        {liked ? '♥' : '♡'}
      </span>

      {showCount && count > 0 && (
        <span style={{
          fontFamily: "'DM Sans',system-ui",
          fontSize: sizes.font,
          fontWeight: 600,
          color: liked ? '#c9a84c' : 'rgba(255,255,255,0.55)',
          transition: 'color 0.2s',
          lineHeight: 1,
        }}>
          {count}
        </span>
      )}

      {!userId && checked && (
        <span style={{ fontFamily:"'DM Sans',system-ui", fontSize:'0.6rem', color:'rgba(255,255,255,0.3)', lineHeight:1 }}>
          Connexion
        </span>
      )}
    </div>
  );
}