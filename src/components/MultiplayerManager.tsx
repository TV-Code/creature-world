import { useEffect } from 'react';
import { ref, onValue, set, onDisconnect, get, remove } from 'firebase/database';
import { database } from '../firebase';
import create from 'zustand';
import type { PlayerState } from '../types/multiplayer';

interface MultiplayerStore {
  players: Map<string, PlayerState>;
  localPlayerId: string | null;
  setPlayers: (players: Map<string, PlayerState>) => void;
  addPlayer: (player: PlayerState) => void;
  updatePlayer: (id: string, update: Partial<PlayerState>) => void;
  removePlayer: (id: string) => void;
  setLocalPlayerId: (id: string) => void;
}

export const useMultiplayerStore = create<MultiplayerStore>((set) => ({
  players: new Map(),
  localPlayerId: null,
  setPlayers: (players) => set({ players }),
  addPlayer: (player) =>
    set((state) => {
      const newPlayers = new Map(state.players);
      newPlayers.set(player.id, player);
      return { players: newPlayers };
    }),
  updatePlayer: (id, update) =>
    set((state) => {
      const newPlayers = new Map(state.players);
      const player = newPlayers.get(id);
      if (player) {
        newPlayers.set(id, { ...player, ...update });
      }
      return { players: newPlayers };
    }),
  removePlayer: (id) =>
    set((state) => {
      const newPlayers = new Map(state.players);
      newPlayers.delete(id);
      return { players: newPlayers };
    }),
  setLocalPlayerId: (id) => set({ localPlayerId: id })
}));

export const MultiplayerManager = () => {
  const { setPlayers, removePlayer, setLocalPlayerId, localPlayerId } = useMultiplayerStore();

  useEffect(() => {
    // Generate a truly unique ID using timestamp and random string
    const timestamp = new Date().getTime();
    const random = Math.random().toString(36).substring(2, 15);
    const playerId = `player_${timestamp}_${random}`;
    
    console.log('Player joining with ID:', playerId);
    setLocalPlayerId(playerId);

    const playerRef = ref(database, `players/${playerId}`);
    const allPlayersRef = ref(database, 'players');

    // Initialize player data
    const initialPlayerState: PlayerState = {
      id: playerId,
      position: { x: 0, y: 0, z: 0 },
      rotation: 0,
      animation: 'idle',
      isHoldingTomato: false
    };

    // Set up player data
    const setupPlayer = async () => {
      try {
        // Set initial state
        await set(playerRef, initialPlayerState);
        console.log('Initial player state set:', initialPlayerState);
        
        // Set up disconnect handler
        await onDisconnect(playerRef).remove();
        console.log('Disconnect handler set up');
      } catch (error) {
        console.error('Error setting up player:', error);
      }
    };

    setupPlayer();

    // Listen for all players' updates
    const unsubscribe = onValue(allPlayersRef, (snapshot) => {
      const playersData = snapshot.val();
      console.log('Received players data:', playersData);
      console.log('Local player ID:', playerId);

      if (playersData) {
        const currentPlayers = new Map<string, PlayerState>();
        
        Object.entries(playersData).forEach(([id, player]: [string, any]) => {
          console.log(`Processing player ${id}:`, player);
          // Make sure we're not including the local player in the remote players list
          if (id !== playerId) {
            console.log('Adding remote player:', id);
            currentPlayers.set(id, player as PlayerState);
          } else {
            console.log('Skipping local player:', id);
          }
        });
        
        console.log('Final players map:', Array.from(currentPlayers.entries()));
        setPlayers(currentPlayers);
      } else {
        console.log('No players data received');
        setPlayers(new Map());
      }
    });

    // Cleanup function
    return () => {
      console.log('Cleaning up player:', playerId);
      unsubscribe();
      remove(playerRef).catch(error => {
        console.error('Error removing player:', error);
      });
    };
  }, []); // Empty dependency array since we want this to run once

  return null;
};
