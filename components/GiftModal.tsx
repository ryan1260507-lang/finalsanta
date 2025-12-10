import React, { useEffect, useState } from 'react';

interface GiftModalProps {
  imgUrl: string;
  onClose: () => void;
}

const GiftModal: React.FC<GiftModalProps> = ({ imgUrl, onClose }) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Reset error when URL changes
    setHasError(false);

    // Trigger confetti when modal mounts
    if ((window as any).confetti) {
      const duration = 3000;
      const end = Date.now() + duration;

      (function frame() {
        (window as any).confetti({
          particleCount: 7,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#ff0000', '#00ff00', '#ffffff', '#ffd700'] 
        });
        (window as any).confetti({
          particleCount: 7,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#ff0000', '#00ff00', '#ffffff', '#ffd700']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      })();
    }
  }, [imgUrl]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div 
        className="relative flex flex-col items-center justify-center w-full h-full p-8 cursor-pointer"
        onClick={(e) => {
            e.stopPropagation();
            onClose();
        }}
      >
        <div className="bg-gradient-to-b from-red-700 to-red-900 border-4 border-yellow-400 rounded-lg p-2 shadow-2xl pixel-box transform transition-all scale-100 hover:scale-105 duration-300 max-h-[90vh] max-w-[90vw] aspect-[4/3] flex items-center justify-center overflow-hidden">
            {/* Gift Image - Display Full Screen-ish */}
            {!hasError ? (
                <img 
                    src={imgUrl} 
                    alt="Gift Prize" 
                    className="w-auto h-auto max-w-full max-h-[80vh] object-contain rounded-md"
                    onError={() => setHasError(true)}
                />
            ) : (
                <div className="text-white text-2xl p-4 text-center">
                    이미지 로드 실패<br/>
                    <small className="text-sm text-yellow-300">
                        설정(⚙️)에서 이미지를 업로드해주세요
                    </small>
                </div>
            )}
        </div>

        <div className="mt-8 text-3xl md:text-5xl text-white font-bold pixel-shadow animate-bounce text-center bg-black/50 p-4 rounded-lg">
          🎉 축하합니다! 🎉
          <div className="text-xl mt-2 text-yellow-300 blinking">화면을 눌러 닫기</div>
        </div>
      </div>
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
        .blinking {
            animation: blink 1s infinite;
        }
        @keyframes blink {
            0% { opacity: 1; }
            50% { opacity: 0; }
            100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default GiftModal;