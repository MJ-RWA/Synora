import React, { useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';

interface VideoPlayerProps {
  src?: string;
  embed?: string;
  poster?: string;
  subtitle1?: string;
  subtitle2?: string;
  subtitle3?: string;
  contentId?: string;
  title?: string;
  type?: 'movie' | 'series';
  videoUrl?: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  src, 
  embed, 
  poster, 
  subtitle1, 
  subtitle2, 
  subtitle3,
  contentId,
  title,
  type,
  videoUrl
}) => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSavedTimeRef = useRef<number>(0);

  const saveProgress = useCallback(async (time: number, duration: number) => {
    if (!user || !contentId || !title || !type) return;
    
    // Only save if time has changed significantly (e.g., every 10 seconds) or if it's the end
    if (Math.abs(time - lastSavedTimeRef.current) < 10 && time < duration - 1) return;

    try {
      await setDoc(doc(db, 'users', user.uid, 'history', contentId), {
        contentId,
        title,
        poster: poster || '',
        type,
        videoUrl: videoUrl || src || '',
        currentTime: time,
        duration: duration,
        updatedAt: serverTimestamp()
      });
      lastSavedTimeRef.current = time;
    } catch (error) {
      console.error("Error saving progress:", error);
    }
  }, [user, contentId, title, type, poster, videoUrl, src]);

  const isEmbed = (url?: string) => {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    return lowerUrl.includes('embed') || 
           lowerUrl.includes('iframe') || 
           lowerUrl.includes('player') ||
           lowerUrl.includes('vidsrc') || 
           lowerUrl.includes('dood') || 
           lowerUrl.includes('upstream') ||
           lowerUrl.includes('youtube.com') ||
           lowerUrl.includes('youtu.be') ||
           lowerUrl.includes('mixdrop') ||
           lowerUrl.includes('voe.sx') ||
           lowerUrl.includes('streamtape');
  };

  const convertToEmbed = (url?: string) => {
    if (!url) return undefined;
    if (url.includes('youtube.com/watch?v=')) {
      const id = url.split('v=')[1]?.split('&')[0];
      return `https://www.youtube.com/embed/${id}`;
    }
    if (url.includes('youtu.be/')) {
      const id = url.split('youtu.be/')[1]?.split('?')[0];
      return `https://www.youtube.com/embed/${id}`;
    }
    return url;
  };

  const encodeUrl = (url?: string) => {
    if (!url) return undefined;
    // Only encode if it contains spaces and isn't already encoded
    if (url.includes(' ') && !url.includes('%20')) {
      return encodeURI(url);
    }
    return url;
  };

  const effectiveEmbed = encodeUrl(convertToEmbed(embed || (isEmbed(src) ? src : undefined)));
  const effectiveSrc = isEmbed(src) ? undefined : encodeUrl(src);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !effectiveSrc) return;

    // Load initial time from history
    const loadInitialTime = async () => {
      if (!user || !contentId) return;
      try {
        const historyDoc = await getDoc(doc(db, 'users', user.uid, 'history', contentId));
        if (historyDoc.exists()) {
          const data = historyDoc.data();
          if (data.currentTime && data.duration) {
            // Only resume if not finished (e.g., less than 95% watched)
            const progress = (data.currentTime / data.duration) * 100;
            if (progress < 95) {
              video.currentTime = data.currentTime;
            }
          }
        }
      } catch (error) {
        console.error("Error loading history:", error);
      }
    };

    if (effectiveSrc.endsWith('.m3u8')) {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(effectiveSrc);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          loadInitialTime();
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = effectiveSrc;
        video.addEventListener('loadedmetadata', loadInitialTime);
      }
    } else {
      video.src = effectiveSrc;
      video.addEventListener('loadedmetadata', loadInitialTime);
    }

    const handleTimeUpdate = () => {
      saveProgress(video.currentTime, video.duration);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', loadInitialTime);
    };
  }, [effectiveSrc, user, contentId, saveProgress]);

  if (effectiveEmbed && !effectiveSrc) {
    return (
      <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10">
        <iframe 
          src={effectiveEmbed}
          className="w-full h-full"
          allowFullScreen
          frameBorder="0"
          title="Video Player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        />
      </div>
    );
  }

  return (
    <div className="relative w-full bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10">
      <video
        ref={videoRef}
        poster={poster || undefined}
        controls
        playsInline
        preload="auto"
        className="w-full h-auto max-h-[80vh] aspect-video"
        crossOrigin="anonymous"
      >
        {effectiveSrc && (
          <source src={effectiveSrc} type={effectiveSrc.endsWith('.m3u8') ? 'application/x-mpegURL' : 'video/mp4'} />
        )}
        {subtitle1 && (
          <track
            src={subtitle1}
            kind="subtitles"
            srcLang="en"
            label="English"
            default
          />
        )}
        {subtitle2 && (
          <track
            src={subtitle2}
            kind="subtitles"
            srcLang="en"
            label="Subtitle 2"
          />
        )}
        {subtitle3 && (
          <track
            src={subtitle3}
            kind="subtitles"
            srcLang="en"
            label="Subtitle 3"
          />
        )}
      </video>
    </div>
  );
};
