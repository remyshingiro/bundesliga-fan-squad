import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Activity, Users, Zap, CheckCircle2, Wifi } from 'lucide-react';

const MATCH_EVENTS = [
  "Home Goal", "Away Goal", "Yellow Card", "Corner Kick",
  "Shot on Target", "Foul", "Substitution", "Red Card",
  "VAR Review", "Free Kick", "Penalty", "Header",
  "Goalkeeper Save", "Cross", "Tackle", "Throw-in"
];

const shuffleArray = (array) => [...array].sort(() => Math.random() - 0.5);

export default function App() {
  // === AWS WEBSOCKET STATE ===
  const wsRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [playerInfo, setPlayerInfo] = useState({ username: '' });
  const ROOM_ID = "DFL-99";

  // === BINGO GAME STATE ===
  const [board, setBoard] = useState([]);
  const [marked, setMarked] = useState([]);
  const [feed, setFeed] = useState([]);
  const [hasBingo, setHasBingo] = useState(false);
  const [score, setScore] = useState(0);

  // 1. INITIALIZE GAME & AWS CONNECTION ON LOAD
  useEffect(() => {
    // Set up the Bingo Board
    setBoard(shuffleArray(MATCH_EVENTS));

    // Generate a random fan name
    const myName = "Fan_" + Math.floor(Math.random() * 1000);
    setPlayerInfo({ username: myName });

    // Connect to AWS API Gateway
    const wsUrl = import.meta.env.VITE_AWS_WSS_URL;
    if (!wsUrl) {
      console.error("Missing VITE_AWS_WSS_URL in .env file!");
      return;
    }

    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      // Tell AWS we joined the room
      socket.send(JSON.stringify({
        action: 'joinRoom',
        roomId: ROOM_ID,
        username: myName
      }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'ROOM_SYNC') {
        // Update leaderboard when AWS broadcasts new scores
        setLeaderboard(data.payload.players);
      }
    };

    socket.onclose = () => {
      setIsConnected(false);
    };

    // Cleanup on unmount
    return () => {
      if (socket) socket.close();
    };
  }, []); // Empty dependency array means this runs exactly once when the app opens

  // Helper to send score updates to AWS
  const syncScoreToAWS = (newScore) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'syncBoard',
        roomId: ROOM_ID,
        score: newScore
      }));
    }
  };

  // 2. CHECK FOR BINGO
  useEffect(() => {
    if (marked.length < 4 || hasBingo) return;
    const winningLines = [
      [0,1,2,3], [4,5,6,7], [8,9,10,11], [12,13,14,15], // Rows
      [0,4,8,12], [1,5,9,13], [2,6,10,14], [3,7,11,15], // Cols
      [0,5,10,15], [3,6,9,12] // Diagonals
    ];

    const isBingo = winningLines.some(line => line.every(index => marked.includes(board[index])));

    if (isBingo) {
      setHasBingo(true);
      const newScore = score + 500;
      setScore(newScore);
      syncScoreToAWS(newScore); // Push Bingo score to AWS
      setFeed(prev => [{ time: new Date().toLocaleTimeString(), text: "🎉 BINGO! +500 PTS", highlight: true }, ...prev]);
    }
  }, [marked, board, hasBingo, score]);

  // 3. SIMULATE LIVE EVENT & SCORE POINTS
  const simulateLiveEvent = () => {
    const unmarkedEvents = board.filter(event => !marked.includes(event));
    if (unmarkedEvents.length === 0) return;

    const randomEvent = unmarkedEvents[Math.floor(Math.random() * unmarkedEvents.length)];
    
    setFeed(prev => [{ time: new Date().toLocaleTimeString(), text: `Live: ${randomEvent} occurred!`, highlight: false }, ...prev]);
    setMarked(prev => [...prev, randomEvent]);
    
    const newScore = score + 50;
    setScore(newScore);
    syncScoreToAWS(newScore); // Push standard score to AWS
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      <header className="max-w-6xl mx-auto flex items-center justify-between border-b border-slate-800 pb-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Fan Squad</h1>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span>Live Match Experience</span>
              {/* Show live connection status */}
              {isConnected ? (
                <span className="flex items-center gap-1 text-green-400 text-xs bg-green-400/10 px-2 py-0.5 rounded-full"><Wifi className="w-3 h-3"/> Connected to AWS</span>
              ) : (
                <span className="flex items-center gap-1 text-red-400 text-xs bg-red-400/10 px-2 py-0.5 rounded-full"><Wifi className="w-3 h-3"/> Disconnected</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-full border border-slate-800">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium">Room: #{ROOM_ID}</span>
          </div>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <span className="text-xl font-bold text-yellow-500">{score} pts</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl relative overflow-hidden">
            
            {hasBingo && (
              <div className="absolute inset-0 bg-blue-900/80 backdrop-blur-sm z-10 flex items-center justify-center flex-col">
                <Trophy className="w-24 h-24 text-yellow-400 mb-4 animate-bounce" />
                <h2 className="text-5xl font-extrabold text-white tracking-wider drop-shadow-lg">BINGO!</h2>
                <button 
                  onClick={() => { setHasBingo(false); setMarked([]); setBoard(shuffleArray(MATCH_EVENTS)); }}
                  className="mt-6 px-6 py-3 bg-white text-blue-900 font-bold rounded-full hover:bg-blue-50 transition"
                >
                  New Card
                </button>
              </div>
            )}

            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Matchday Bingo</h2>
                <p className="text-sm text-slate-400">Clicking simulate syncs to AWS.</p>
              </div>
              <button 
                onClick={simulateLiveEvent}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition active:scale-95 shadow-lg shadow-blue-900/20"
              >
                <Activity className="w-4 h-4" />
                Simulate Data Feed
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {board.map((event, index) => {
                const isMarked = marked.includes(event);
                return (
                  <div key={index} className={`aspect-square flex flex-col items-center justify-center p-3 text-center rounded-xl border-2 transition-all duration-300 ${
                      isMarked ? 'bg-blue-600/20 border-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    {isMarked ? <CheckCircle2 className="w-6 h-6 text-blue-400 mb-2" /> : <div className="w-6 h-6 mb-2 opacity-10" />}
                    <span className="text-xs sm:text-sm font-semibold leading-tight">{event}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              Live Squad Leaderboard
            </h3>
            <div className="space-y-3">
              {leaderboard.length === 0 ? (
                <p className="text-slate-500 text-sm">Connecting to AWS...</p>
              ) : (
                leaderboard.map((player, i) => {
                  const isMe = player.username === playerInfo.username;
                  return (
                    <div key={i} className={`flex items-center justify-between p-3 rounded-lg ${isMe ? 'bg-blue-600/20 border border-blue-500/30' : 'bg-slate-950'}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500 font-mono text-sm">#{i + 1}</span>
                        <span className={`font-medium ${isMe ? 'text-blue-400' : 'text-slate-200'}`}>
                          {player.username} {isMe && "(You)"}
                        </span>
                      </div>
                      <span className="font-bold text-slate-300">{player.score}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}