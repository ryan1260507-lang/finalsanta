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
    giftUrls: {},
    audioUrls: { bgm: null, drum: null, tada: null }
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
  
  // Sound Refs
  const drumrollRef = useRef<HTMLAudioElement | null>(null);
  const tadaRef = useRef<HTMLAudioElement | null>(null);
  const bgmRef = useRef<HTMLAudioElement | null>(null);

  // Initialize Game Data & Load Assets
  useEffect(() => {
    // 1. Initialize Game Data
    const giftIds = generateGiftDistribution(TOTAL_SOCKS);
    const initialSocks: Sock[] = Array.from({ length: TOTAL_SOCKS }, (_, i) => ({
      id: i,
      giftId: giftIds[i],
      isOpened: false,
    }));
    setGameState(prev => ({ ...prev, socks: initialSocks }));

    // 2. Load Persistent Assets from DB
    const initAssets = async () => {
        try {
            const stored = await loadAllAssets();
            const defaultGifts: Record<number, string> = {};
            for (let i = 1; i <= TOTAL_SOCKS; i++) {
                defaultGifts[i] = getGiftImage(i);
            }

            setAssets({
                bgUrl: stored.bgUrl || BG_IMAGE,
                sockUrl: stored.sockUrl || SOCK_IMAGE,
                giftUrls: { ...defaultGifts, ...stored.giftUrls },
                audioUrls: {
                    bgm: stored.audioUrls.bgm || null,
                    drum: stored.audioUrls.drum || null,
                    tada: stored.audioUrls.tada || null,
                }
            });
        } catch (e) {
            console.error("Failed to load assets", e);
            const defaultGifts: Record<number, string> = {};
            for (let i = 1; i <= TOTAL_SOCKS; i++) {
                defaultGifts[i] = getGiftImage(i);
            }
            // Fallback
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

  // Update Audio sources when assets change
  useEffect(() => {
      bgmRef.current = new Audio(assets.audioUrls.bgm || SOUNDS.BGM);
      bgmRef.current.loop = true;
      bgmRef.current.volume = 0.3;
      bgmRef.current.preload = 'auto';

      drumrollRef.current = new Audio(assets.audioUrls.drum || SOUNDS.DRUMROLL);
      drumrollRef.current.loop = true;
      drumrollRef.current.volume = 0.6;
      drumrollRef.current.preload = 'auto';

      tadaRef.current = new Audio(assets.audioUrls.tada || SOUNDS.TADA);
      tadaRef.current.volume = 1.0;
      tadaRef.current.preload = 'auto';

      if (!isMuted) {
          bgmRef.current.play().catch(() => {});
      }

      return () => {
          bgmRef.current?.pause();
          drumrollRef.current?.pause();
          tadaRef.current?.pause();
      }
  }, [assets.audioUrls, isMuted]);

  // Audio Unlock / Play Handler
  const tryPlayAudio = useCallback(() => {
    if (isMuted) return;

    if (bgmRef.current && bgmRef.current.paused) {
        bgmRef.current.play().catch(e => console.log("BGM autoplay prevented:", e));
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
      
      {/* Game Completion Overlay */}
      {gameState.currentGift === null && gameState.openedCount === TOTAL_SOCKS && (
        <div 
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 animate-fade-in p-4 text-center select-none"
            onClick={() => {
                if(confirm("게임을 처음부터 다시 시작하시겠습니까?")) {
                    window.location.reload();
                }
            }}
        >
             <div className="space-y-6 md:space-y-10 z-10">
                <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold text-yellow-400 pixel-shadow leading-relaxed animate-pulse">
                    2026년에도<br/>전교조가 함께합니다!
                </h2>
                <p className="text-xl md:text-3xl lg:text-4xl text-white pixel-shadow leading-relaxed">
                    변호사보다 든든하고,<br/>
                    OTT보다 더 재밌는
                </p>
                <div className="text-5xl md:text-7xl lg:text-8xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-pink-600 pixel-shadow animate-bounce mt-8" style={{ textShadow: '4px 4px 0px #fff' }}>
                    전교조 화이팅!
                </div>
             </div>
             <p className="absolute bottom-10 text-gray-500 text-sm md:text-base animate-pulse z-10">
                (화면을 누르면 다시 시작합니다)
             </p>
             {/* Snowfall background for the ending screen */}
             <Snowfall /> 
        </div>
      )}

      {/* Main Game Container - Touch anywhere to start audio */}
      <div 
        className="relative w-screen h-screen overflow-hidden flex items-center justify-center bg-black scanlines"
        onClick={tryPlayAudio}
      >
        {/* Aspect Ratio Box */}
        <div 
            className="relative w-full max-w-[180vh] aspect-[18/9] bg-cover bg-center shadow-2xl overflow-hidden"
            style={{ 
                // Just try to show the background. If it fails, it fails (shows background color), 
                // but we don't actively hide it with logic anymore.
                backgroundImage: `url(${assets.bgUrl})`,
            }}
        >
            {/* Fallback background color/gradient if image fails to load/is transparent */}
            <div className={`absolute inset-0 -z-10 bg-[#1a1c2c]`} />
            <div className="absolute inset-0 bg-black/20" />
            <Snowfall />

            {/* Header Text */}
            <div className="absolute top-[3%] left-0 w-full text-center z-10 px-2 pointer-events-none">
                <p className="text-white text-base md:text-2xl lg:text-3xl font-bold mb-1 pixel-shadow text-yellow-100 whitespace-nowrap tracking-tight">
                    2025년 힘내서 달려오신 선생님께 감사하며 선물을 준비했어요!
                </p>
                <h1 className="text-4xl md:text-7xl lg:text-8xl font-extrabold text-white pixel-shadow bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 text-transparent bg-clip-text animate-pulse leading-none whitespace-nowrap tracking-tighter">
                    🎅전교조 산타의 SSS급 선물
                </h1>
            </div>

            {/* Settings Button - Highlighted so user knows they can fix things */}
            <button 
                onClick={(e) => { e.stopPropagation(); setShowSetup(true); }}
                className="absolute top-4 right-4 z-50 p-2 bg-black/50 text-white rounded hover:bg-white/20 transition-colors pointer-events-auto border border-white/30"
                title="설정: 배경/음악/선물 수정"
            >
                ⚙️ 설정
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
