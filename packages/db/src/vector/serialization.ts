export function float32VectorToBuffer(values: readonly number[]): Buffer {
  return Buffer.from(new Float32Array(values).buffer);
}

export function vectorToJson(values: readonly number[]): string {
  return JSON.stringify(values);
}

export function toVectorBlob(vector: Buffer | readonly number[]): Buffer {
  return Buffer.isBuffer(vector) ? vector : float32VectorToBuffer(vector);
}

export function toVectorMatchValue(vector: Buffer | readonly number[]): Buffer | string {
  return Buffer.isBuffer(vector) ? vector : vectorToJson(vector);
}
