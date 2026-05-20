import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Activity, Users, Zap, CheckCircle2, Wifi, Radio } from 'lucide-react';

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
        setLeaderboard(data.payload.players);
      } 
      else if (data.type === 'LIVE_MATCH_EVENT') {
        // AWS JUST BROADCASTED A LIVE EVENT!
        const newEvent = data.payload.event;
        
        // Add it to the live feed UI
        setFeed(prev => [{ time: new Date().toLocaleTimeString(), text: `Live: ${newEvent}`, highlight: true }, ...prev]);
        
        // Auto-mark the board if the user has that square
        setMarked(prevMarked => {
          if (!prevMarked.includes(newEvent)) {
            // Use functional state to guarantee we don't have stale score data
            setScore(prevScore => {
              const updatedScore = prevScore + 50;
              syncScoreToAWS(updatedScore); // Instantly sync the new points back to AWS!
              return updatedScore;
            });
            return [...prevMarked, newEvent];
          }
          return prevMarked;
        });
      }
    };

    socket.onclose = () => {
      setIsConnected(false);
    };

    // Cleanup on unmount
    return () => {
      if (socket) socket.close();
    };
  }, []); 

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
      setScore(prevScore => {
        const finalScore = prevScore + 500;
        syncScoreToAWS(finalScore); // Push Bingo score to AWS
        return finalScore;
      });
      setFeed(prev => [{ time: new Date().toLocaleTimeString(), text: "🎉 BINGO! +500 PTS", highlight: true }, ...prev]);
    }
  }, [marked, board, hasBingo]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      
      {/* HEADER */}
      <header className="max-w-6xl mx-auto flex items-center justify-between border-b border-slate-800 pb-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Fan Squad</h1>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span>Live Match Experience</span>
              {isConnected ? (
                <span className="flex items-center gap-1 text-green-400 text-xs bg-green-400/10 px-2 py-0.5 rounded-full">
                  <Wifi className="w-3 h-3"/> Connected to AWS
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-400 text-xs bg-red-400/10 px-2 py-0.5 rounded-full">
                  <Wifi className="w-3 h-3"/> Disconnected
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-full border border-slate-800 shadow-inner">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium">Room: #{ROOM_ID}</span>
          </div>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <span className="text-xl font-bold text-yellow-500">{score} pts</span>
          </div>
        </div>
      </header>

      {/* MAIN GRID */}
      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: BINGO BOARD */}
        <div className="lg:col-span-2">
          <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl relative overflow-hidden">
            
            {hasBingo && (
              <div className="absolute inset-0 bg-blue-900/80 backdrop-blur-sm z-10 flex items-center justify-center flex-col animate-in fade-in duration-500">
                <Trophy className="w-24 h-24 text-yellow-400 mb-4 animate-bounce" />
                <h2 className="text-5xl font-extrabold text-white tracking-wider drop-shadow-lg">BINGO!</h2>
                <p className="text-blue-200 mt-2 font-medium">Squad Multiplier Activated</p>
                <button 
                  onClick={() => { setHasBingo(false); setMarked([]); setBoard(shuffleArray(MATCH_EVENTS)); }}
                  className="mt-6 px-6 py-3 bg-white text-blue-900 font-bold rounded-full hover:bg-blue-50 transition shadow-lg"
                >
                  New Card
                </button>
              </div>
            )}

            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Matchday Bingo</h2>
                <p className="text-sm text-slate-400">Waiting for live match broadcast from AWS...</p>
              </div>
              <div className="flex items-center gap-2 text-blue-400 bg-blue-400/10 px-3 py-1.5 rounded-lg text-sm font-medium animate-pulse">
                <Radio className="w-4 h-4" />
                Listening
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {board.map((event, index) => {
                const isMarked = marked.includes(event);
                return (
                  <div key={index} className={`aspect-square flex flex-col items-center justify-center p-3 text-center rounded-xl border-2 transition-all duration-300 ${
                      isMarked ? 'bg-blue-600/20 border-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)] scale-105' : 'bg-slate-950 border-slate-800 text-slate-400'
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

        {/* RIGHT COLUMN: FEED & LEADERBOARD */}
        <div className="space-y-6">
          
          {/* Live Cloud Feed */}
          <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <h3 className="text-lg font-bold text-white">Live Match Feed</h3>
            </div>
            
            <div className="space-y-3 h-48 overflow-y-auto pr-2">
              {feed.length === 0 ? (
                <p className="text-sm text-slate-500 italic text-center mt-10">Trigger events via Lambda Test...</p>
              ) : (
                feed.map((item, i) => (
                  <div key={i} className={`p-3 rounded-lg text-sm border transition-all ${item.highlight ? 'bg-blue-500/10 border-blue-500/30 text-blue-200' : 'bg-slate-950 border-slate-800 text-slate-300'}`}>
                    <span className="text-xs opacity-50 block mb-1 font-mono">{item.time}</span>
                    <span className="font-semibold">{item.text}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Multiplayer Leaderboard */}
          <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-lg">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
              <Users className="w-5 h-5 text-blue-400" />
              Live Leaderboard
            </h3>
            <div className="space-y-3">
              {leaderboard.length === 0 ? (
                <p className="text-slate-500 text-sm">Syncing room data...</p>
              ) : (
                leaderboard.map((player, i) => {
                  const isMe = player.username === playerInfo.username;
                  return (
                    <div key={i} className={`flex items-center justify-between p-3 rounded-lg ${isMe ? 'bg-blue-600/20 border border-blue-500/30' : 'bg-slate-950 border border-slate-800/50'}`}>
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