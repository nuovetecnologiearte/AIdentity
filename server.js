const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: "*",
  methods: ["GET", "POST"]
}));

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static('src'));

io.on('connection', (socket) => {
  console.log('Client connected');

  socket.on('emotion', (data) => {
    console.log('emotion:', data);
    io.emit('update', data);
  });
});

server.listen(3001, '0.0.0.0', () => {
  console.log('Server OK');
});

//  Update localIP
const fs = require('fs');
const path = require('path');

const iniPath = path.join(__dirname, 'config.ini');

fs.readFile(iniPath, 'utf8', (err, data) => {
    if (err) {
        console.error('Cannot read config.ini:', err);
        return;
    }

    const match = data.match(/^IPAddress=(.+)$/m);
    if (match) {
        const ip = match[1].trim();
        console.log(`Running on: http://${ip}`);
    } else {
        console.log('LocalIPAddress not found.');
    }
});
