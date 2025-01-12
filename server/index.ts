import * as functions from 'firebase-functions';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

interface PlayerState {
  id: string;
  position: { x: number; y: number; z: number };
  rotation: number;
  animation: string;
  isHoldingTomato: boolean;
}

interface GameState {
  players: Map<string, PlayerState>;
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',  // Update this with your Firebase hosting URL
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const gameState: GameState = {
  players: new Map()
};

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  
  // Initialize new player
  gameState.players.set(socket.id, {
    id: socket.id,
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    animation: 'idle',
    isHoldingTomato: false
  });

  // Send current game state to new player
  socket.emit('gameState', Array.from(gameState.players.values()));
  
  // Broadcast new player to others
  socket.broadcast.emit('playerJoined', gameState.players.get(socket.id));

  // Handle player updates
  socket.on('playerUpdate', (update: Partial<PlayerState>) => {
    const player = gameState.players.get(socket.id);
    if (player) {
      Object.assign(player, update);
      socket.broadcast.emit('playerUpdated', player);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    gameState.players.delete(socket.id);
    io.emit('playerLeft', socket.id);
  });
});

// Export for Firebase Functions
export const game = functions.https.onRequest(app);