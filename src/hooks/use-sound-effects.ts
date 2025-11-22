import { useRef, useEffect } from "react";

// Импортируем звуковые эффекты
import croakSound from "../assets/croak.mp3";
import croakSound2 from "../assets/croak2.mp3";
import croakSound3 from "../assets/croak3.mp3";
import bubbles from "../assets/bubbles.mp3";
import bubblesShort from "../assets/bubbles-short.mp3";
import moneyBuy from "../assets/buy.mp3";
import moneySell from "../assets/sell.mp3";
import crunch from "../assets/crunch.mp3";
import exited from "../assets/exited-scream.mp3";
import { useSettings } from "../components/SettingsContext";
import clickSound from "../assets/click.mp3";
import crunchShort from "../assets/crunch-short.mp3";
import bubble2 from "../assets/bubble2.mp3";

export const useSoundEffects = () => {
  const { settings } = useSettings();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioRef2 = useRef<HTMLAudioElement | null>(null);
  const settingsRef = useRef({
    volume: settings.soundEffectsVolume,
    enabled: settings.soundEffectsEnabled,
  });

  useEffect(() => {
    settingsRef.current.volume = settings.soundEffectsEnabled
      ? settings.soundEffectsVolume
      : 0;

    settingsRef.current.enabled = settings.soundEffectsEnabled;
  }, [settings.soundEffectsEnabled, settings.soundEffectsVolume]);

  const playAudio = (sound: string) => {
    if (!settingsRef.current.enabled) return;

    audioRef.current = new Audio(sound);
    audioRef.current.volume = settingsRef.current.volume;

    if (audioRef.current) {
      // Случайная высота тона для разнообразия
      const pitch = 0.8 + Math.random() * 0.4;
      audioRef.current.playbackRate = pitch;

      // Сброс времени воспроизведения на случай, если звук уже играет
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(console.error);
    }
  };

  const playAudio2 = (sound: string) => {
    if (!settingsRef.current.enabled) return;

    audioRef2.current = new Audio(sound);
    audioRef2.current.volume = settingsRef.current.volume;

    if (audioRef2.current) {
      // Случайная высота тона для разнообразия
      const pitch = 0.8 + Math.random() * 0.4;
      audioRef2.current.playbackRate = pitch;

      // Сброс времени воспроизведения на случай, если звук уже играет
      audioRef2.current.currentTime = 0;
      audioRef2.current.play().catch(console.error);
    }
  };

  const playCroak = () => {
    playAudio(croakSound);
  };

  const playCroakSmall = () => {
    playAudio(croakSound2);
  };

  const playCroakBig = () => {
    playAudio(croakSound3);
  };

  const playClickCollider = () => {
    playAudio(bubblesShort);
  };

  const playBubblesLong = () => {
    playAudio(bubbles);
  };

  const playCell = () => {
    playAudio(moneySell);
  };

  const playBuy = () => {
    playAudio(moneyBuy);
  };

  const playCrunch = () => {
    playAudio(crunch);
    setTimeout(() => {
      playAudio(crunch);
    }, 2000);
    setTimeout(() => {
      playAudio(crunch);
    }, 1000);
  };

  const playExited = () => {
    playAudio2(exited);
  };
  const playClick = () => {
    playAudio(clickSound);
  };
  const playCrunchShort = () => {
    playAudio(crunchShort);
  };
  const playBubble2 = () => {
    playAudio(bubble2);
  };

  return {
    playClick,
    playCrunch,
    playExited,
    playCroak,
    playClickCollider,
    playBubblesLong,
    playCroakBig,
    playCroakSmall,
    playCell,
    playBuy,
    playCrunchShort,
    playBubble2,
  };
};
