import { useEffect } from 'react';
import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import create from 'zustand';
import { PlayerState, PlayerUpdate } from '../types/multiplayer';

interface MultiplayerStore {
  players: Map<string, PlayerState>;
  socket: typeof Socket | null;
  localPlayerId: string | null;
  setSocket: (socket: typeof Socket) => void;
  setLocalPlayerId: (id: string) => void;
  updatePlayer: (id: string, update: PlayerUpdate) => void;
  removePlayer: (id: string) => void;
}

export const useMultiplayerStore = create<MultiplayerStore>((set) => ({
  players: new Map(),
  socket: null,
  localPlayerId: null,
  setSocket: (socket) => set({ socket }),
  setLocalPlayerId: (id) => set({ localPlayerId: id }),
  updatePlayer: (id, update) => set((state) => {
    const players = new Map(state.players);
    const player = players.get(id);
    if (player) {
      players.set(id, { ...player, ...update });
    } else {
      players.set(id, { id, ...update } as PlayerState);
    }
    return { players };
  }),
  removePlayer: (id) => set((state) => {
    const players = new Map(state.players);
    players.delete(id);
    return { players };
  })
}));

export function MultiplayerManager() {
  const { setSocket, setLocalPlayerId, updatePlayer, removePlayer } = useMultiplayerStore();

  useEffect(() => {
    const socket = io('http://localhost:3001');
    setSocket(socket);

    socket.on('connect', () => {
      console.log('Connected with ID:', socket.id);
      setLocalPlayerId(socket.id);
    });

    socket.on('gameState', (players: PlayerState[]) => {
      players.forEach(player => {
        updatePlayer(player.id, player);
      });
    });

    socket.on('playerJoined', (player: PlayerState) => {
        console.log('New player joined:', player.id);
        updatePlayer(player.id, player);
    });

    socket.on('playerUpdated', (update: PlayerState) => {
      if (update.id !== socket.id) {
        updatePlayer(update.id, update);
      }
    });

    socket.on('playerLeft', (id: string) => {
      console.log('Player left:', id);
      removePlayer(id);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return null;
}