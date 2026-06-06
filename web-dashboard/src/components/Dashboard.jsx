import React, { useState, useEffect, useRef } from 'react';
import { Thermometer, Wind, Flame } from 'lucide-react';
import SensorCard from './SensorCard';
import { loadModel, preprocess, postprocess } from '../utils/yolo';

const BLYNK_TOKEN = "j4pRYkAyzAoefb2LjHQGLJxqhBd5jbaj";

const fetchPin = async (pin) => {
  try {
    const res = await fetch(`https://blynk.cloud/external/api/get?token=${BLYNK_TOKEN}&${pin}`);
    if (!res.ok) return null;
    return await res.text();
  } catch(e) {
    return null;
  }
};

const updatePin = async (pin, value) => {
  try {
    await fetch(`https://blynk.cloud/external/api/update?token=${BLYNK_TOKEN}&${pin}=${encodeURIComponent(value)}`);
  } catch(e) {
    console.error("Lỗi cập nhật Blynk:", e);
  }
};

const Dashboard = () => {
  const [data, setData] = useState({
    temperature: '--',
    gas: '--',
    fireDetected: false,
    systemStatus: 'ĐANG KẾT NỐI...',
    statusColor: '#a0a5b5'
  });
  
  const [error, setError] = useState(false);
  const [aiStatus, setAiStatus] = useState("Đang tải AI Model...");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const sessionRef = useRef(null);
  const isRunningRef = useRef(false);

  // Debounce vars
  const fireConsecutiveFrames = useRef(0);
  const safeConsecutiveFrames = useRef(0);
  const fireInPreviousFrame = useRef(false);

  // Lấy dữ liệu cảm biến khác từ Blynk
  const fetchData = async () => {
    try {
      const [tStr, gasStr, sysStr] = await Promise.all([
        fetchPin('V0'),
        fetchPin('V1'),
        fetchPin('V5')
      ]);

      if (!tStr && !gasStr) throw new Error("No data");

      let temp = tStr ? parseFloat(tStr).toFixed(1) : '--';
      let gas = gasStr ? parseInt(gasStr) : '--';
      let sysStatus = sysStr ? sysStr.replace(/["\[\]]/g, '') : 'CHƯA RÕ';

      let color = '#10b981';
      if (sysStatus.includes('CHÁY')) color = '#ef4444';
      else if (sysStatus.includes('RÒ RỈ')) color = '#f59e0b';

      // NOTE: Cảm biến lửa sẽ do AI (Frontend) quyết định, không cần fetch V2 từ Blynk nữa.
      // Dùng state nội bộ cho fireDetected để UI cập nhật mượt hơn.
      setData(prev => ({
        ...prev,
        temperature: temp,
        gas: gas,
        systemStatus: sysStatus,
        statusColor: color
      }));
      setError(false);
    } catch (err) {
      setError(true);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  // Khởi động Camera và AI
  useEffect(() => {
    let animationId;

    const startAI = async () => {
      try {
        window.addEventListener('unhandledrejection', (event) => {
           setAiStatus(`Lỗi Ngầm: ${event.reason?.message || event.reason}`);
        });
        window.addEventListener('error', (event) => {
           setAiStatus(`Lỗi Trình Duyệt: ${event.message}`);
        });

        setAiStatus("Đang yêu cầu quyền Camera...");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: 640, height: 480 } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        setAiStatus("Đang tải mô hình YOLOv8 (~42MB, vui lòng chờ)...");
        // Timeout 20 giây nếu tải mô hình quá lâu
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Quá thời gian tải 20s (Timeout)")), 20000));
        
        try {
          sessionRef.current = await Promise.race([loadModel(), timeoutPromise]);
        } catch (modelErr) {
          setAiStatus(`Lỗi Model: ${modelErr.message || String(modelErr)}`);
          return;
        }

        if (sessionRef.current) {
          setAiStatus("AI Camera Sẵn sàng - Đang nhận diện...");
          isRunningRef.current = true;
          runInference();
        } else {
          setAiStatus("Lỗi: Hàm loadModel trả về null. Có thể do lỗi WASM hoặc 404.");
        }
      } catch (err) {
        setAiStatus(`Lỗi: ${err.message || String(err)}`);
        console.error(err);
      }
    };

    const runInference = async () => {
      if (!isRunningRef.current || !videoRef.current || !canvasRef.current || !sessionRef.current) return;
      if (videoRef.current.readyState < 2) {
        animationId = requestAnimationFrame(runInference);
        return;
      }

      // Preprocess image
      const hiddenCanvas = document.createElement("canvas");
      const { tensor, ratio, padX, padY } = preprocess(videoRef.current, hiddenCanvas);

      // Chạy Inference
      const feeds = {};
      feeds[sessionRef.current.inputNames[0]] = tensor;
      const results = await sessionRef.current.run(feeds);
      
      const outputName = sessionRef.current.outputNames[0];
      const outputTensor = results[outputName];
      
      // Box Postprocess
      const boxes = postprocess(outputTensor, 0.25); // Hạ ngưỡng từ 0.45 xuống 0.25 cho model nén

      // Vẽ Box & Cập nhật State
      drawBoxes(boxes, ratio, padX, padY);
      checkFireStatus(boxes);

      animationId = requestAnimationFrame(runInference);
    };

    startAI();

    return () => {
      isRunningRef.current = false;
      if (animationId) cancelAnimationFrame(animationId);
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const drawBoxes = (boxes, ratio, padX, padY) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    boxes.forEach(b => {
      // Model classes: 0: Fire, 1: default, 2: smoke
      const isFire = (b.classIdx === 0);
      const isSmoke = (b.classIdx === 2);
      
      // Vẽ box cho TẤT CẢ các class để test xem model có nhận lầm không
      let labelName = "DEFAULT";
      if (isFire) labelName = "FIRE";
      if (isSmoke) labelName = "SMOKE";

      const x1 = (b.box[0] - padX) / ratio;
      const y1 = (b.box[1] - padY) / ratio;
      const x2 = (b.box[2] - padX) / ratio;
      const y2 = (b.box[3] - padY) / ratio;

      const width = x2 - x1;
      const height = y2 - y1;

      ctx.strokeStyle = isFire ? "red" : (isSmoke ? "orange" : "blue");
      ctx.lineWidth = 3;
      ctx.strokeRect(x1, y1, width, height);
      
      ctx.fillStyle = isFire ? "red" : (isSmoke ? "orange" : "blue");
      const label = `${labelName} ${Math.round(b.score*100)}%`;
      ctx.font = "20px sans-serif";
      ctx.fillText(label, x1, y1 > 20 ? y1 - 5 : y1 + 20);
    });
  };

  const checkFireStatus = (boxes) => {
    // Tìm xem có box nào là Fire không (classIdx = 0)
    const hasFire = boxes.some(b => b.classIdx === 0);

    if (hasFire) {
      fireConsecutiveFrames.current += 1;
      safeConsecutiveFrames.current = 0;
    } else {
      safeConsecutiveFrames.current += 1;
      fireConsecutiveFrames.current = 0;
    }

    if (fireConsecutiveFrames.current >= 3 && !fireInPreviousFrame.current) {
      fireInPreviousFrame.current = true;
      setData(prev => ({ ...prev, fireDetected: true }));
      updatePin('V2', "CÓ LỬA");
    } 
    else if (safeConsecutiveFrames.current >= 15 && fireInPreviousFrame.current) {
      fireInPreviousFrame.current = false;
      setData(prev => ({ ...prev, fireDetected: false }));
      updatePin('V2', "An toàn");
    }
  };

  return (
    <div className="app-container">
      <header className="header glass-panel">
        <h1>IoT Dashboard</h1>
        <p>Hệ thống Cảnh báo Cháy & Rò rỉ Gas Thông minh (Web AI Mode)</p>
        {error && <p style={{color: 'var(--danger-color)', marginTop: '1rem'}}>Mất kết nối với Server / Thiết bị Offline</p>}
      </header>

      <div className="dashboard-grid">
        <SensorCard 
          title="Nhiệt Độ" 
          value={data.temperature} 
          unit="°C" 
          icon={Thermometer} 
          color={data.temperature !== '--' && data.temperature > 50 ? "var(--danger-color)" : "var(--accent-color)"}
        />
        <SensorCard 
          title="Nồng độ Gas" 
          value={data.gas} 
          unit="ppm" 
          icon={Wind} 
          color={data.gas !== '--' && data.gas > 500 ? "var(--danger-color)" : "var(--success-color)"}
        />
        <SensorCard 
          title="Cảm biến Lửa" 
          value={data.fireDetected ? "CÓ LỬA" : "AN TOÀN"} 
          icon={Flame} 
          color={data.fireDetected ? "var(--danger-color)" : "var(--success-color)"}
        />
      </div>

      <div className="glass-panel main-status-card camera-card" style={{ padding: '1.5rem', marginBottom: '2rem', border: '1px solid var(--glass-border)' }}>
        <h2 style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '2px' }}>
          AI CAMERA BROWSER (Trực tiếp)
        </h2>
        <div style={{ color: 'var(--accent-color)', marginBottom: '1rem', fontStyle: 'italic' }}>
          {aiStatus}
        </div>

        <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <video 
            ref={videoRef}
            autoPlay 
            playsInline 
            muted
            style={{ width: '100%', maxWidth: '800px', height: 'auto', display: 'block' }}
          />
          <canvas 
            ref={canvasRef}
            style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '800px', height: '100%', zIndex: 10, pointerEvents: 'none' }}
          />
        </div>
      </div>

      <div className="glass-panel main-status-card" style={{ borderColor: data.statusColor }}>
        <h2>NGƯỠNG CẢNH BÁO KHÍ GAS</h2>
        <div 
          className={`main-status-text ${data.systemStatus.includes('CHÁY') ? 'pulse' : ''}`}
          style={{ color: data.statusColor }}
        >
          {data.systemStatus} ppm
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
