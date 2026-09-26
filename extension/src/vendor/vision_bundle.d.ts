export interface FaceLandmarker {
  detectForVideo(videoFrame: HTMLVideoElement, timestampMs: number): any;
  detect(image: any): any;
  close(): void;
  [key: string]: any;
}

export declare const FaceLandmarker: {
  createFromOptions(vision: any, options: any): Promise<FaceLandmarker>;
  [key: string]: any;
};

export declare const FilesetResolver: {
  forVisionTasks(wasmPath: string): Promise<any>;
  [key: string]: any;
};

export declare const DrawingUtils: any;
export declare const FaceDetector: any;
export declare const MPImage: any;
