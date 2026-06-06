import { Tensor, InferenceSession, env } from 'onnxruntime-web';

env.wasm.numThreads = 1; // Vô hiệu hóa multithread để tránh lỗi SharedArrayBuffer do thiếu header COOP/COEP trên Vercel

const MODEL_SIZE = 640;

export async function loadModel() {
  try {
    const urls = [
      '/model/fire_model.onnx.part1',
      '/model/fire_model.onnx.part2',
      '/model/fire_model.onnx.part3',
      '/model/fire_model.onnx.part4'
    ];
    
    // Tải song song 4 file
    const buffers = await Promise.all(urls.map(url => fetch(url).then(r => r.arrayBuffer())));
    
    // Tính tổng kích thước
    const totalLength = buffers.reduce((acc, val) => acc + val.byteLength, 0);
    const combined = new Uint8Array(totalLength);
    
    // Gộp 4 file thành 1 model gốc
    let offset = 0;
    for (let buffer of buffers) {
      combined.set(new Uint8Array(buffer), offset);
      offset += buffer.byteLength;
    }

    return await InferenceSession.create(combined, { executionProviders: ['wasm'] });
  } catch (e) {
    console.error("Failed to load model:", e);
    throw e;
  }
}

export function preprocess(imageElement, canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = MODEL_SIZE;
  canvas.height = MODEL_SIZE;
  
  const ratio = Math.min(MODEL_SIZE / imageElement.videoWidth, MODEL_SIZE / imageElement.videoHeight);
  const newWidth = Math.round(imageElement.videoWidth * ratio);
  const newHeight = Math.round(imageElement.videoHeight * ratio);
  
  const padX = (MODEL_SIZE - newWidth) / 2;
  const padY = (MODEL_SIZE - newHeight) / 2;

  ctx.clearRect(0, 0, MODEL_SIZE, MODEL_SIZE);
  ctx.drawImage(imageElement, 0, 0, imageElement.videoWidth, imageElement.videoHeight, padX, padY, newWidth, newHeight);

  const imgData = ctx.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE);
  const data = imgData.data;

  const float32Data = new Float32Array(3 * MODEL_SIZE * MODEL_SIZE);
  for (let i = 0; i < MODEL_SIZE * MODEL_SIZE; i++) {
    float32Data[i] = data[i * 4] / 255.0; // R
    float32Data[i + MODEL_SIZE * MODEL_SIZE] = data[i * 4 + 1] / 255.0; // G
    float32Data[i + 2 * MODEL_SIZE * MODEL_SIZE] = data[i * 4 + 2] / 255.0; // B
  }

  return {
    tensor: new Tensor('float32', float32Data, [1, 3, MODEL_SIZE, MODEL_SIZE]),
    ratio, padX, padY
  };
}

export function postprocess(outputTensor, threshold = 0.45) {
  const data = outputTensor.data;
  const numFeatures = outputTensor.dims[1]; 
  const numAnchors = outputTensor.dims[2]; 
  
  let boxes = [];
  
  for (let i = 0; i < numAnchors; i++) {
    let maxScore = 0;
    let maxClassIdx = -1;
    
    for (let j = 4; j < numFeatures; j++) {
      const score = data[j * numAnchors + i];
      if (score > maxScore) {
        maxScore = score;
        maxClassIdx = j - 4;
      }
    }
    
    if (maxScore >= threshold) {
      const xc = data[0 * numAnchors + i];
      const yc = data[1 * numAnchors + i];
      const w = data[2 * numAnchors + i];
      const h = data[3 * numAnchors + i];
      
      const x1 = xc - w / 2;
      const y1 = yc - h / 2;
      const x2 = xc + w / 2;
      const y2 = yc + h / 2;
      
      boxes.push({
        box: [x1, y1, x2, y2],
        score: maxScore,
        classIdx: maxClassIdx
      });
    }
  }
  
  return nms(boxes, 0.45);
}

function nms(boxes, iouThreshold) {
  boxes.sort((a, b) => b.score - a.score);
  const selected = [];
  const active = new Array(boxes.length).fill(true);
  
  for (let i = 0; i < boxes.length; i++) {
    if (!active[i]) continue;
    selected.push(boxes[i]);
    
    for (let j = i + 1; j < boxes.length; j++) {
      if (!active[j]) continue;
      
      const iou = computeIOU(boxes[i].box, boxes[j].box);
      if (iou > iouThreshold) {
        active[j] = false;
      }
    }
  }
  
  return selected;
}

function computeIOU(box1, box2) {
  const [x1_1, y1_1, x2_1, y2_1] = box1;
  const [x1_2, y1_2, x2_2, y2_2] = box2;
  
  const x_left = Math.max(x1_1, x1_2);
  const y_top = Math.max(y1_1, y1_2);
  const x_right = Math.min(x2_1, x2_2);
  const y_bottom = Math.min(y2_1, y2_2);
  
  if (x_right < x_left || y_bottom < y_top) return 0.0;
  
  const intersectionArea = (x_right - x_left) * (y_bottom - y_top);
  const box1Area = (x2_1 - x1_1) * (y2_1 - y1_1);
  const box2Area = (x2_2 - x1_2) * (y2_2 - y1_2);
  
  return intersectionArea / (box1Area + box2Area - intersectionArea);
}
