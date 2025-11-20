import React, { useRef, useEffect, useState } from "react";
import { useSettings } from "../SettingsContext";

import ambientMusic from "../../assets/music.mp3";
import ambientMusic2 from "../../assets/music2.mp3";
import ambientMusic3 from "../../assets/music3.mp3";

const tracks = [ambientMusic3, ambientMusic2, ambientMusic];

const MusicPlayer: React.FC = () => {
  const { settings } = useSettings();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [userInteracted, setUserInteracted] = useState(0);

  // Отслеживаем любое взаимодействие пользователя
  useEffect(() => {
    const handleUserInteraction = () => {
      setUserInteracted((userInteracted) => userInteracted + 1);
      document.removeEventListener("click", handleUserInteraction);
      document.removeEventListener("keydown", handleUserInteraction);
      document.removeEventListener("touchstart", handleUserInteraction);
    };

    if (userInteracted > 2) {
      return;
    }

    document.addEventListener("click", handleUserInteraction);
    document.addEventListener("keydown", handleUserInteraction);
    document.addEventListener("touchstart", handleUserInteraction);

    return () => {
      document.removeEventListener("click", handleUserInteraction);
      document.removeEventListener("keydown", handleUserInteraction);
      document.removeEventListener("touchstart", handleUserInteraction);
    };
  }, [userInteracted]);

  const playNextTrack = () => {
    const nextIndex = (currentTrackIndex + 1) % tracks.length;
    setCurrentTrackIndex(nextIndex);
  };

  useEffect(() => {
    if (audioRef.current && userInteracted) {
      audioRef.current.volume = settings.musicVolume;

      if (settings.musicEnabled) {
        audioRef.current.play().catch((error) => {
          console.log("Audio play failed:", error);
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [
    Boolean(audioRef.current),
    settings.musicEnabled,
    settings.musicVolume,
    currentTrackIndex,
    userInteracted,
  ]);

  const handleTrackEnd = () => {
    playNextTrack();
  };

  return (
    <audio
      ref={audioRef}
      src={tracks[currentTrackIndex]}
      onEnded={handleTrackEnd}
      preload="auto"
    />
  );
};

export default MusicPlayer;
