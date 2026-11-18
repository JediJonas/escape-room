import { useEffect } from 'react';
import { gameAudio } from '../sound/gameAudio.ts';
import { playKnocks } from '../sound/knock.ts';

/** Hur ofta det knackar medan brädet kallar. */
const KNOCK_EVERY_MS = 30_000;

/** Knackar direkt och sedan med jämna mellanrum, så länge något kallar på spelaren. */
export function useKnocking(isCalling: boolean) {
  useEffect(() => {
    if (!isCalling) return undefined;
    void playKnocks(gameAudio);
    const timer = setInterval(() => void playKnocks(gameAudio), KNOCK_EVERY_MS);
    return () => clearInterval(timer);
  }, [isCalling]);
}
