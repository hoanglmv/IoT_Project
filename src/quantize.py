import onnx
from onnxruntime.quantization import quantize_dynamic, QuantType

model_fp32 = 'fire_model.onnx'
model_quant = 'fire_model_int8.onnx'

quantize_dynamic(model_fp32, model_quant, weight_type=QuantType.QUInt8)
print("Quantization complete!")
