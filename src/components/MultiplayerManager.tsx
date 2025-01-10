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
    const SOCKET_URL = process.env.NODE_ENV === 'production'
      ? 'https://your-project-name.vercel.app'  // Update this with your Vercel URL
      : 'http://localhost:3001';

    let socket: typeof Socket | null = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    if (socket) {
      setSocket(socket);

      socket.on('connect', () => {
        if (socket) {  // Check if socket still exists
          console.log('Connected with ID:', socket.id);
          setLocalPlayerId(socket.id);
        }
      });

      socket.on('gameState', (players: PlayerState[]) => {
        players.forEach(player => {
          updatePlayer(player.id, player);
        });
      });

      socket.on('playerJoined', (player: PlayerState) => {
        if (socket) {  // Check if socket still exists
          console.log('New player joined:', player.id);
          updatePlayer(player.id, player);
        }
      });

      socket.on('playerUpdated', (update: PlayerState) => {
        if (socket && update.id !== socket.id) {
          updatePlayer(update.id, update);
        }
      });

      socket.on('playerLeft', (id: string) => {
        console.log('Player left:', id);
        removePlayer(id);
      });
    }

    return () => {
      if (socket) {
        // Remove all listeners before disconnecting
        socket.removeAllListeners();
        socket.disconnect();
        socket = null;  // Clear the reference
      }
    };
  }, [setSocket, setLocalPlayerId, updatePlayer, removePlayer]);

  return null;
}