import { onRequest } from "firebase-functions/v2/https";
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { PlayerState, GameState, AnimationName } from './types';

const app = express();
app.use(cors());
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket'],
  pingTimeout: 10000,
  pingInterval: 5000
});

// Store game state
const gameState: GameState = {
  players: new Map()
};

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  
  // Initialize new player
  const initialPlayerState: PlayerState = {
    id: socket.id,
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    animation: 'idle' as AnimationName,
    isHoldingTomato: false
  };
  
  gameState.players.set(socket.id, initialPlayerState);

  // Send current game state to new player
  socket.emit('gameState', Array.from(gameState.players.values()));
  
  // Broadcast new player to others
  socket.broadcast.emit('playerJoined', initialPlayerState);

  // Log connection event
  console.log(`Player ${socket.id} joined. Total players: ${gameState.players.size}`);

  // Handle player updates
  socket.on('playerUpdate', (update: Partial<PlayerState>) => {
    console.log(`Received update from player ${socket.id}:`, update);
    const player = gameState.players.get(socket.id);
    if (player) {
      Object.assign(player, update);
      socket.broadcast.emit('playerUpdated', player);
      console.log(`Broadcast update for player ${socket.id}`);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Player ${socket.id} disconnected`);
    gameState.players.delete(socket.id);
    io.emit('playerLeft', socket.id);
    console.log(`Total players remaining: ${gameState.players.size}`);
  });
});

// Export the Express API as a Firebase Function
export const game = onRequest({ 
  cors: true,
  maxInstances: 10,
  timeoutSeconds: 300,
  memory: '256MiB' 
}, async (request, response) => {
  console.log('Received request:', request.method, request.headers.upgrade ? '(WebSocket)' : '(HTTP)');
  
  if (request.headers.upgrade?.toLowerCase() === 'websocket') {
    console.log('Handling WebSocket upgrade');
    server.emit('upgrade', request, request.socket, Buffer.from(''));
  } else {
    console.log('Handling HTTP request');
    response.json({ status: 'Socket.IO server is running' });
  }
});