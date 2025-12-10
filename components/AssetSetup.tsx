import React, { useState, useRef } from 'react';
import { GameAssets } from '../types';
import { saveAsset, exportAssetsToJson, robustImportAssets, clearAllAssets } from '../utils/storage';

interface AssetSetupProps {
  currentAssets: GameAssets;
  onSave: (assets: GameAssets) => void;
  onClose: () => void;
}

const AssetSetup: React.FC<AssetSetupProps> = ({ currentAssets, onSave, onClose }) => {
  const [pendingBg, setPendingBg] = useState<File | null>(null);
  const [pendingSock, setPendingSock] = useState<File | null>(null);
  const [pendingGifts, setPendingGifts] = useState<Record<number, File>>({});
  
  // Audio pending states
  const [pendingBgm, setPendingBgm] = useState<File | null>(null);
  const [pendingDrum, setPendingDrum] = useState<File | null>(null);
  const [pendingTada, setPendingTada] = useState<File | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (setter: React.Dispatch<React.SetStateAction<File | null>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setter(e.target.files[0]);
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
        if (pendingBgm) await saveAsset('audio_bgm', pendingBgm);
        if (pendingDrum) await saveAsset('audio_drum', pendingDrum);
        if (pendingTada) await saveAsset('audio_tada', pendingTada);
        
        const promises = Object.entries(pendingGifts).map(([id, file]) => 
             saveAsset(`gift_${id}`, file as Blob)
        );
        await Promise.all(promises);

        const newAssets = { ...currentAssets };
        
        if (pendingBg) newAssets.bgUrl = URL.createObjectURL(pendingBg);
        if (pendingSock) newAssets.sockUrl = URL.createObjectURL(pendingSock);
        if (pendingBgm) newAssets.audioUrls.bgm = URL.createObjectURL(pendingBgm);
        if (pendingDrum) newAssets.audioUrls.drum = URL.createObjectURL(pendingDrum);
        if (pendingTada) newAssets.audioUrls.tada = URL.createObjectURL(pendingTada);
        
        const newGiftUrls = { ...newAssets.giftUrls };
        for (const [idStr, file] of Object.entries(pendingGifts)) {
            newGiftUrls[Number(idStr)] = URL.createObjectURL(file as Blob);
        }
        newAssets.giftUrls = newGiftUrls;
        
        onSave(newAssets);
        onClose();
        // Force reload to ensure audio contexts update cleanly
        if (pendingBgm || pendingDrum || pendingTada) {
            if(confirm("오디오 설정이 변경되었습니다. 적용을 위해 새로고침하시겠습니까?")) {
                window.location.reload();
            }
        }
    } catch (e) {
        console.error("Error saving assets:", e);
        alert("저장 중 오류가 발생했습니다.");
    } finally {
        setIsProcessing(false);
    }
  };

  // Reset
  const handleReset = async () => {
      if (!confirm("모든 설정을 초기화하고 기본(Public 폴더) 파일로 되돌리시겠습니까?")) return;
      setIsProcessing(true);
      try {
          await clearAllAssets();
          alert("초기화되었습니다. 페이지를 새로고침합니다.");
          window.location.reload();
      } catch (e) {
          console.error(e);
          alert("초기화 실패");
      } finally {
          setIsProcessing(false);
      }
  };

  // Export
  const handleExport = async () => {
      if (!confirm("현재 설정된 이미지/오디오를 JSON 파일로 내보내시겠습니까?\n용량이 크면 시간이 걸릴 수 있습니다.")) return;
      setIsProcessing(true);
      try {
          const jsonString = await exportAssetsToJson();
          const blob = new Blob([jsonString], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `santa-assets-${new Date().toISOString().slice(0,10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
      } catch (e) {
          console.error(e);
          alert("내보내기에 실패했습니다.");
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
      
      if (!confirm("설정 파일을 불러오면 기존 설정이 덮어씌워집니다. 진행하시겠습니까?")) {
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
                    💾 백업
                 </button>
                 <button 
                    onClick={handleImportClick}
                    disabled={isProcessing}
                    className="px-3 py-1 bg-pink-600 text-xs md:text-sm rounded hover:bg-pink-500 pixel-box disabled:opacity-50"
                 >
                    📂 복원
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
          💡 <b>해결사 가이드:</b> 배경이나 소리가 안 나오나요? 여기서 직접 파일을 올리고 [저장]을 누르면 해결됩니다!
        </p>

        <div className="space-y-6">
          {/* Background */}
          <div className="bg-gray-700 p-4 rounded border-2 border-gray-600 flex flex-col md:flex-row gap-4 items-center">
             <div className="flex-1 w-full">
                <label className="block text-lg mb-2 font-bold text-blue-300">1. 배경 이미지 (필수)</label>
                <input type="file" accept="image/*" onChange={handleFileChange(setPendingBg)} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"/>
                {pendingBg && <p className="text-green-400 text-sm mt-2">✓ 변경 대기중</p>}
             </div>
             <div className="w-24 h-16 bg-black border border-gray-500 overflow-hidden shrink-0">
                <img src={getBgPreview()} alt="Preview" className="w-full h-full object-cover" />
             </div>
          </div>

          {/* Audio Section */}
          <div className="bg-gray-700 p-4 rounded border-2 border-gray-600">
              <label className="block text-lg mb-4 font-bold text-purple-300">🎵 오디오 설정 (소리가 안 나면 여기서 업로드)</label>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                      <label className="block text-sm mb-1 text-gray-300">BGM (배경음악)</label>
                      <input type="file" accept="audio/*" onChange={handleFileChange(setPendingBgm)} className="text-xs text-gray-400 w-full"/>
                      {pendingBgm && <span className="text-green-400 text-xs">✓ 대기중</span>}
                  </div>
                  <div>
                      <label className="block text-sm mb-1 text-gray-300">Drum (두구두구)</label>
                      <input type="file" accept="audio/*" onChange={handleFileChange(setPendingDrum)} className="text-xs text-gray-400 w-full"/>
                      {pendingDrum && <span className="text-green-400 text-xs">✓ 대기중</span>}
                  </div>
                  <div>
                      <label className="block text-sm mb-1 text-gray-300">Tada (당첨음)</label>
                      <input type="file" accept="audio/*" onChange={handleFileChange(setPendingTada)} className="text-xs text-gray-400 w-full"/>
                      {pendingTada && <span className="text-green-400 text-xs">✓ 대기중</span>}
                  </div>
              </div>
          </div>

          {/* Sock */}
          <div className="bg-gray-700 p-4 rounded border-2 border-gray-600 flex flex-col md:flex-row gap-4 items-center">
             <div className="flex-1 w-full">
                <label className="block text-lg mb-2 font-bold text-red-300">2. 양말 이미지</label>
                <input type="file" accept="image/*" onChange={handleFileChange(setPendingSock)} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-red-600 file:text-white hover:file:bg-red-700"/>
                {pendingSock && <p className="text-green-400 text-sm mt-2">✓ 변경 대기중</p>}
             </div>
             <div className="w-16 h-16 bg-black border border-gray-500 overflow-hidden shrink-0 flex items-center justify-center">
                <img src={getSockPreview()} alt="Preview" className="w-full h-full object-contain" />
             </div>
          </div>

          {/* Gifts */}
          <div className="bg-gray-700 p-4 rounded border-2 border-gray-600">
            <label className="block text-lg mb-2 font-bold text-green-300">3. 선물 이미지 (1~35번)</label>
            <p className="text-xs text-gray-400 mb-2">파일명을 숫자로 지정해서 한꺼번에 올려주세요 (예: 1.png, 2.jpg).</p>
            <input type="file" accept="image/*" multiple onChange={handleGiftsChange} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-700"/>
            <p className="mt-2 text-right font-bold text-yellow-400">
              총 저장될 선물: {totalGiftCount} / 35
            </p>
          </div>
        </div>

        <div className="mt-8 flex justify-between">
           <button 
            onClick={handleReset}
            disabled={isProcessing}
            className="px-4 py-2 bg-red-800 text-white rounded hover:bg-red-700 pixel-box text-sm disabled:opacity-50"
          >
            🗑️ 초기화
          </button>

          <div className="flex space-x-4">
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
    </div>
  );
};

export default AssetSetup;
