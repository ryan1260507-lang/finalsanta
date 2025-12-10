import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, Sock, GameAssets } from './types';
import { generateGiftDistribution } from './utils/gameLogic';
import { BG_IMAGE, SOCK_IMAGE, TOTAL_SOCKS, DRUMROLL_DURATION, SOUNDS, getGiftImage } from './constants';
import { loadAllAssets } from './utils/storage';
import Snowfall from './components/Snowfall';
import OrientationGuard from './components/OrientationGuard';
import GiftModal from './components/GiftModal';
import AssetSetup from './components/AssetSetup';

// Sub-component for individual Sock
const SockItem: React.FC<{
    sock: Sock;
    index: number;
    imageUrl: string;
    onClick: (index: number) => void;
}> = ({ sock, index, imageUrl, onClick }) => {
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        setHasError(false);
    }, [imageUrl]);

    return (
        <div 
            className={`
                relative group cursor-pointer transition-all duration-300 transform aspect-square
                ${sock.isOpened ? 'opacity-0 pointer-events-none' : 'hover:scale-110 active:scale-95 animate-float'}
            `}
            style={{ animationDelay: `${index * 0.1}s` }}
            onClick={(e) => {
                e.stopPropagation();
                onClick(index);
            }}
        >
             {!hasError ? (
                 <img 
                    src={imageUrl} 
                    alt="Christmas Sock"
                    className="w-full h-full object-contain drop-shadow-lg filter brightness-110 p-1"
                    onError={() => setHasError(true)}
                 />
             ) : (
                 <div className="w-full h-full flex items-center justify-center bg-red-700 rounded-full border-2 border-white">
                    <span className="text-white text-xs md:text-xl font-bold">?</span>
                 </div>
             )}
        </div>
    );
};

const App: React.FC = () => {
  // Asset State
  const [assets, setAssets] = useState<GameAssets>({
    bgUrl: BG_IMAGE,
    sockUrl: SOCK_IMAGE,
    giftUrls: {} 
  });
  const [showSetup, setShowSetup] = useState(false);

  // Game State
  const [gameState, setGameState] = useState<GameState>({
    socks: [],
    currentGift: null,
    isDrumrolling: false,
    openedCount: 0,
  });

  // Audio State
  const [isMuted, setIsMuted] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);
  
  // Sound Refs
  const drumrollRef = useRef<HTMLAudioElement | null>(null);
  const tadaRef = useRef<HTMLAudioElement | null>(null);
  const bgmRef = useRef<HTMLAudioElement | null>(null);

  // Initialization
  useEffect(() => {
    // 1. Initialize Audio Objects
    drumrollRef.current = new Audio(SOUNDS.DRUMROLL);
    tadaRef.current = new Audio(SOUNDS.TADA);
    bgmRef.current = new Audio(SOUNDS.BGM);
    
    // Configure BGM
    if (bgmRef.current) {
        bgmRef.current.loop = true;
        bgmRef.current.volume = 0.3;
        bgmRef.current.preload = 'auto';
    }
    // Configure SFX
    if (drumrollRef.current) {
        drumrollRef.current.loop = true;
        drumrollRef.current.volume = 0.6;
        drumrollRef.current.preload = 'auto';
    }
    if (tadaRef.current) {
        tadaRef.current.volume = 1.0;
        tadaRef.current.preload = 'auto';
    }

    // 2. Initialize Game Data
    const giftIds = generateGiftDistribution(TOTAL_SOCKS);
    const initialSocks: Sock[] = Array.from({ length: TOTAL_SOCKS }, (_, i) => ({
      id: i,
      giftId: giftIds[i],
      isOpened: false,
    }));
    setGameState(prev => ({ ...prev, socks: initialSocks }));

    // 3. Load Persistent Assets
    const initAssets = async () => {
        try {
            const stored = await loadAllAssets();
            const defaultGifts: Record<number, string> = {};
            for (let i = 1; i <= TOTAL_SOCKS; i++) {
                defaultGifts[i] = getGiftImage(i);
            }

            setAssets(prev => ({
                bgUrl: stored.bgUrl || BG_IMAGE,
                sockUrl: stored.sockUrl || SOCK_IMAGE,
                giftUrls: { ...defaultGifts, ...stored.giftUrls }
            }));
        } catch (e) {
            console.error("Failed to load assets", e);
            const defaultGifts: Record<number, string> = {};
            for (let i = 1; i <= TOTAL_SOCKS; i++) {
                defaultGifts[i] = getGiftImage(i);
            }
            setAssets(prev => ({...prev, giftUrls: defaultGifts}));
        }
    };
    initAssets();

    return () => {
      drumrollRef.current?.pause();
      tadaRef.current?.pause();
      bgmRef.current?.pause();
    };
  }, []);

  // Audio Unlock / Play Handler
  const tryPlayAudio = useCallback(() => {
    if (isMuted) return;

    // Initialize/Resume BGM
    if (bgmRef.current && bgmRef.current.paused) {
        bgmRef.current.play().then(() => {
            setAudioInitialized(true);
        }).catch(e => console.log("BGM autoplay prevented:", e));
    }
  }, [isMuted]);

  // Handle Mute Toggle
  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(prev => {
        const next = !prev;
        if (next) {
            bgmRef.current?.pause();
            if (drumrollRef.current) drumrollRef.current.pause();
            if (tadaRef.current) tadaRef.current.pause();
        } else {
            bgmRef.current?.play().catch(() => {});
        }
        return next;
    });
  };

  // Handle Sock Click
  const handleSockClick = useCallback((index: number) => {
    // Unlock audio context just in case it wasn't already
    tryPlayAudio();

    // Prevent interaction if already opening or opened
    if (gameState.isDrumrolling || gameState.currentGift !== null || gameState.socks[index].isOpened) {
      return;
    }

    // Force unlock/prime TADA sound on this interaction so it plays in setTimeout
    if (tadaRef.current && !isMuted) {
        // Playing and immediately pausing acts as a "warmup" for iOS/strict browsers
        tadaRef.current.play().then(() => {
            tadaRef.current?.pause();
            if (tadaRef.current) tadaRef.current.currentTime = 0;
        }).catch(() => {});
    }

    // Start Drumroll
    setGameState(prev => ({ ...prev, isDrumrolling: true }));
    
    if (!isMuted && drumrollRef.current) {
        drumrollRef.current.currentTime = 0;
        drumrollRef.current.play().catch(e => console.log("Drumroll fail", e));
        
        // Duck BGM volume
        if (bgmRef.current) bgmRef.current.volume = 0.1;
    }

    // After delay, show result
    setTimeout(() => {
      // Stop drumroll
      if (drumrollRef.current) {
          drumrollRef.current.pause();
          drumrollRef.current.currentTime = 0;
      }
      
      // Play Tada
      if (!isMuted && tadaRef.current) {
          tadaRef.current.currentTime = 0;
          tadaRef.current.play().catch(e => console.log("Tada fail", e));
          
          // Restore BGM volume
          if (bgmRef.current) bgmRef.current.volume = 0.3;
      }

      setGameState(prev => {
        const newSocks = [...prev.socks];
        newSocks[index] = { ...newSocks[index], isOpened: true };
        
        return {
          ...prev,
          socks: newSocks,
          isDrumrolling: false,
          currentGift: newSocks[index].giftId,
          openedCount: prev.openedCount + 1
        };
      });
    }, DRUMROLL_DURATION);
  }, [gameState.isDrumrolling, gameState.currentGift, gameState.socks, isMuted, tryPlayAudio]);

  // Handle Modal Close
  const handleCloseModal = () => {
    setGameState(prev => ({ ...prev, currentGift: null }));
  };

  const getCurrentGiftUrl = () => {
      if (gameState.currentGift === null) return '';
      return assets.giftUrls[gameState.currentGift] || getGiftImage(gameState.currentGift);
  };

  return (
    <>
      <OrientationGuard />

      {/* Setup Modal */}
      {showSetup && (
        <AssetSetup 
          currentAssets={assets} 
          onSave={(newAssets) => setAssets(newAssets)} 
          onClose={() => setShowSetup(false)} 
        />
      )}
      
      {/* Main Game Container - Touch anywhere to start audio */}
      <div 
        className="relative w-screen h-screen overflow-hidden flex items-center justify-center bg-black scanlines"
        onClick={tryPlayAudio}
      >
        {/* Aspect Ratio Box */}
        <div 
            className="relative w-full max-w-[180vh] aspect-[18/9] bg-cover bg-center shadow-2xl overflow-hidden"
            style={{ backgroundImage: `url(${assets.bgUrl})` }}
        >
            {/* Fallback background color */}
            <div className="absolute inset-0 bg-[#1a1c2c] -z-10" />
            <div className="absolute inset-0 bg-black/20" />
            <Snowfall />

            {/* Header Text - Adjusted to fit 1 line: Reduced size slightly, added tracking-tighter and nowrap */}
            <div className="absolute top-[3%] left-0 w-full text-center z-10 px-2 pointer-events-none">
                <p className="text-white text-base md:text-2xl lg:text-3xl font-bold mb-1 pixel-shadow text-yellow-100 whitespace-nowrap tracking-tight">
                    2025년 힘내서 달려오신 선생님께 감사하며 선물을 준비했어요!
                </p>
                <h1 className="text-4xl md:text-7xl lg:text-8xl font-extrabold text-white pixel-shadow bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 text-transparent bg-clip-text animate-pulse leading-none whitespace-nowrap tracking-tighter">
                    🎅전교조 산타의 SSS급 선물
                </h1>
            </div>

            {/* Settings Button */}
            <button 
                onClick={(e) => { e.stopPropagation(); setShowSetup(true); }}
                className="absolute top-4 right-4 z-50 p-2 bg-black/50 text-white rounded hover:bg-white/20 transition-colors pointer-events-auto"
            >
                ⚙️
            </button>

            {/* Sound Toggle Button */}
            <button 
                onClick={toggleMute}
                className={`absolute bottom-4 right-4 z-50 px-4 py-2 rounded-full font-bold text-sm md:text-base transition-all pixel-box pointer-events-auto ${isMuted ? 'bg-gray-600 text-gray-300' : 'bg-green-600 text-white animate-pulse'}`}
            >
                {isMuted ? '🔇 소리 켜기' : '🔊 BGM ON'}
            </button>

            {/* Sock Grid - Positioned lower for large text */}
            <div className="absolute inset-0 top-[28%] flex items-center justify-center p-2 z-20">
                <div className="grid grid-cols-7 gap-1 md:gap-2 w-[60%] md:w-[50%] max-w-2xl mx-auto">
                    {gameState.socks.map((sock, index) => (
                        <SockItem 
                            key={sock.id}
                            sock={sock}
                            index={index}
                            imageUrl={assets.sockUrl}
                            onClick={handleSockClick}
                        />
                    ))}
                </div>
            </div>

            {/* Drumroll Overlay */}
            {gameState.isDrumrolling && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="text-6xl md:text-8xl text-yellow-400 font-bold animate-bounce pixel-shadow">
                        두구두구...
                    </div>
                </div>
            )}

            {/* Gift Modal */}
            {gameState.currentGift !== null && (
                <GiftModal 
                    imgUrl={getCurrentGiftUrl()} 
                    onClose={handleCloseModal} 
                />
            )}
        </div>
      </div>
    </>
  );
};

export default App;