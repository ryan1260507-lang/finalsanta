import React, { useState, useRef } from 'react';
import { GameAssets } from '../types';
import { saveAsset, exportAssetsToJson, robustImportAssets } from '../utils/storage';

interface AssetSetupProps {
  currentAssets: GameAssets;
  onSave: (assets: GameAssets) => void;
  onClose: () => void;
}

const AssetSetup: React.FC<AssetSetupProps> = ({ currentAssets, onSave, onClose }) => {
  const [pendingBg, setPendingBg] = useState<File | null>(null);
  const [pendingSock, setPendingSock] = useState<File | null>(null);
  const [pendingGifts, setPendingGifts] = useState<Record<number, File>>({});
  
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPendingBg(e.target.files[0]);
    }
  };

  const handleSockChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPendingSock(e.target.files[0]);
    }
  };

  const handleGiftsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newGifts: Record<number, File> = {};
      Array.from(e.target.files).forEach((item) => {
        const file = item as File;
        const match = file.name.match(/(\d+)/);
        if (match) {
          const id = parseInt(match[1], 10);
          if (id >= 1 && id <= 35) {
            newGifts[id] = file;
          }
        }
      });
      setPendingGifts(prev => ({ ...prev, ...newGifts }));
    }
  };

  const handleSave = async () => {
    setIsProcessing(true);
    try {
        if (pendingBg) await saveAsset('bg', pendingBg);
        if (pendingSock) await saveAsset('sock', pendingSock);
        
        const promises = Object.entries(pendingGifts).map(([id, file]) => 
             saveAsset(`gift_${id}`, file as Blob)
        );
        await Promise.all(promises);

        const newAssets = { ...currentAssets };
        
        if (pendingBg) newAssets.bgUrl = URL.createObjectURL(pendingBg);
        if (pendingSock) newAssets.sockUrl = URL.createObjectURL(pendingSock);
        
        const newGiftUrls = { ...newAssets.giftUrls };
        for (const [idStr, file] of Object.entries(pendingGifts)) {
            newGiftUrls[Number(idStr)] = URL.createObjectURL(file as Blob);
        }
        newAssets.giftUrls = newGiftUrls;
        
        onSave(newAssets);
        onClose();
    } catch (e) {
        console.error("Error saving assets:", e);
        alert("저장 중 오류가 발생했습니다.");
    } finally {
        setIsProcessing(false);
    }
  };

  // Export
  const handleExport = async () => {
      if (!confirm("현재 설정된 이미지들을 JSON 파일로 내보내시겠습니까?\n이미지가 많으면 시간이 걸릴 수 있습니다.")) return;
      setIsProcessing(true);
      try {
          const jsonString = await exportAssetsToJson();
          const blob = new Blob([jsonString], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `santa-gift-assets-${new Date().toISOString().slice(0,10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
      } catch (e) {
          console.error(e);
          alert("내보내기에 실패했습니다. 이미지가 너무 크거나 많을 수 있습니다.");
      } finally {
          setIsProcessing(false);
      }
  };

  // Import
  const handleImportClick = () => {
      fileInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      if (!confirm("설정 파일(JSON)을 불러오면 기존 이미지가 덮어씌워집니다. 진행하시겠습니까?")) {
          e.target.value = '';
          return;
      }

      setIsProcessing(true);
      try {
          const text = await file.text();
          await robustImportAssets(text);
          alert("설정을 성공적으로 불러왔습니다! 적용을 위해 페이지를 새로고침합니다.");
          window.location.reload();
      } catch (e) {
          console.error(e);
          alert("파일 불러오기 실패. 올바른 JSON 형식이 아니거나 파일이 손상되었습니다.");
      } finally {
          setIsProcessing(false);
      }
  };

  const getBgPreview = () => pendingBg ? URL.createObjectURL(pendingBg) : currentAssets.bgUrl;
  const getSockPreview = () => pendingSock ? URL.createObjectURL(pendingSock) : currentAssets.sockUrl;
  
  const totalGiftCount = new Set([
      ...Object.keys(currentAssets.giftUrls),
      ...Object.keys(pendingGifts)
  ]).size;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="w-full max-w-2xl bg-gray-800 border-4 border-white text-white p-6 rounded-lg shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center mb-6 border-b-4 border-dashed border-gray-600 pb-2">
            <h2 className="text-2xl md:text-3xl font-bold text-yellow-400">
            🛠️ 게임 에셋 설정
            </h2>
            <div className="flex gap-2">
                 <button 
                    onClick={handleExport}
                    disabled={isProcessing}
                    className="px-3 py-1 bg-indigo-600 text-xs md:text-sm rounded hover:bg-indigo-500 pixel-box disabled:opacity-50"
                 >
                    💾 내보내기 (JSON)
                 </button>
                 <button 
                    onClick={handleImportClick}
                    disabled={isProcessing}
                    className="px-3 py-1 bg-pink-600 text-xs md:text-sm rounded hover:bg-pink-500 pixel-box disabled:opacity-50"
                 >
                    📂 불러오기 (JSON)
                 </button>
                 <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".json" 
                    onChange={handleImportFile}
                 />
            </div>
        </div>
        
        <p className="mb-6 text-gray-300 text-sm bg-gray-900 p-2 rounded">
          💡 <b>안내:</b> 배경, 양말, 선물을 설정하고 [저장]을 누르세요.<br/>
          다른 PC로 옮기려면 [내보내기] 후 파일을 저장하고, 다른 PC에서 [불러오기] 하세요.
        </p>

        <div className="space-y-6">
          <div className="bg-gray-700 p-4 rounded border-2 border-gray-600 flex flex-col md:flex-row gap-4 items-center">
             <div className="flex-1 w-full">
                <label className="block text-lg mb-2 font-bold text-blue-300">1. 배경 이미지</label>
                <input type="file" accept="image/*" onChange={handleBgChange} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"/>
                {pendingBg && <p className="text-green-400 text-sm mt-2">✓ 변경 대기중</p>}
             </div>
             <div className="w-24 h-16 bg-black border border-gray-500 overflow-hidden shrink-0">
                <img src={getBgPreview()} alt="Preview" className="w-full h-full object-cover" />
             </div>
          </div>

          <div className="bg-gray-700 p-4 rounded border-2 border-gray-600 flex flex-col md:flex-row gap-4 items-center">
             <div className="flex-1 w-full">
                <label className="block text-lg mb-2 font-bold text-red-300">2. 양말 이미지</label>
                <input type="file" accept="image/*" onChange={handleSockChange} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-red-600 file:text-white hover:file:bg-red-700"/>
                {pendingSock && <p className="text-green-400 text-sm mt-2">✓ 변경 대기중</p>}
             </div>
             <div className="w-16 h-16 bg-black border border-gray-500 overflow-hidden shrink-0 flex items-center justify-center">
                <img src={getSockPreview()} alt="Preview" className="w-full h-full object-contain" />
             </div>
          </div>

          <div className="bg-gray-700 p-4 rounded border-2 border-gray-600">
            <label className="block text-lg mb-2 font-bold text-green-300">3. 선물 이미지 (1~35번)</label>
            <p className="text-xs text-gray-400 mb-2">파일명을 숫자로 지정해서 한꺼번에 올려주세요 (예: 1.png, 2.jpg).<br/>새로 추가하면 기존 것과 합쳐집니다.</p>
            <input type="file" accept="image/*" multiple onChange={handleGiftsChange} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-700"/>
            <p className="mt-2 text-right font-bold text-yellow-400">
              총 저장될 선물: {totalGiftCount} / 35
            </p>
          </div>
        </div>

        <div className="mt-8 flex justify-end space-x-4">
          <button 
            onClick={onClose}
            disabled={isProcessing}
            className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 pixel-box disabled:opacity-50"
          >
            취소
          </button>
          <button 
            onClick={handleSave}
            disabled={isProcessing}
            className="px-6 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-500 animate-pulse pixel-box disabled:opacity-50 flex items-center"
          >
            {isProcessing ? '처리 중...' : '저장하고 적용하기'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssetSetup;