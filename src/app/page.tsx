'use client';

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FilesetResolver, ObjectDetector } from "@mediapipe/tasks-vision";
import Link from "next/link";
import { useEffect, useRef, useState } from "react"

function speakText(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      const synth = window.speechSynthesis;
      const voices = synth.getVoices();
      const englishVoice = voices.find(voice => voice.lang.startsWith('en'));
      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      utterance.onend = () => {
        console.log(`Finished speaking: "${text}"`);
        resolve(); // Resolve the promise when speech ends
      };

      utterance.onerror = (event) => {
        console.error('Text-to-speech error:', event.error);
        reject(event.error); // Reject the promise on error
      };

      synth.speak(utterance);
    } else {
      const error = new Error('Your browser does not support the Web Speech API.');
      console.warn(error.message);
      reject(error);
    }
  });
}

function countAndFormatItemsToString(items: string[], separator: string = ", "): string {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }
  const formattedItems: string[] = [];
  for (const [item, count] of counts.entries()) {
    formattedItems.push(`${count}-${item}`);
  }
  return formattedItems.join(separator);
}

export default function Home() {
  const [ready, setReady] = useState(false)
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)
  const [latestDetection, setLatestDetection] = useState<string | null>(null)

  const cont = useRef(true)
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastVideoTimeRef = useRef(-1)
  const objectDetector = useRef<ObjectDetector | null>(null)
  const ttsBusy = useRef(false);


  const runningMode: 'VIDEO' | 'IMAGE' = 'VIDEO';

  const renderLoop = async () => {
    if (cont.current) {
      videoRef.current?.requestVideoFrameCallback(renderLoop);
    }
    if (ttsBusy.current) { return false }
    const video = videoRef.current;
    if (video === null) { return }
    if (objectDetector.current === null) { return }
    console.log("video.currentTime", video.currentTime);
    const lastVideoTime = lastVideoTimeRef.current;

    ttsBusy.current = true
    const detections = objectDetector.current.detectForVideo(video, video.currentTime).detections;
    const resText = countAndFormatItemsToString(detections.map(det => {
      return det.categories[0].categoryName
    }))
    setLatestDetection(resText)
    await speakText(resText)
    ttsBusy.current = false
  }

  const start = () => {
    cont.current = true;
    videoRef.current?.requestVideoFrameCallback(renderLoop);
  }

  useEffect(() => {
    const effect = async () => {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
      });
      console.log("MediaStream:", mediaStream);
      setMediaStream(mediaStream);
      if (videoRef.current

      ) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
        };
        videoRef.current?.requestVideoFrameCallback(() => renderLoop());
      }


      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      objectDetector.current = await ObjectDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-tasks/object_detector/efficientdet_lite0_uint8.tflite`
        },
        scoreThreshold: 0.3,
        runningMode: runningMode,
        maxResults: 5
      });



    }
    effect()
    return () => {
      mediaStream?.getTracks().forEach(track => track.stop());
      setReady(false);
    }

  }, [videoRef])

  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-start">
        <h1 className="m-5 text-center text-4xl font-extrabold tracking-tight text-balance">
          Vision Orator: Object Detection and Text-to-Speech
        </h1>
        <Card className="md:w-3/5">
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
          </CardHeader>
          <CardDescription>
            <p className="pl-4">
              {latestDetection}
            </p>
          </CardDescription>
          <CardContent>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              width="100%"
              height="100%"
              style={{ objectFit: 'cover' }} />
          </CardContent>
          <CardFooter>

            <Button onClick={start} className="mr-1">Start</Button>
            <Button onClick={() => cont.current = false}>Stop</Button>
            <Button className="ml-5"><Link href={"/signOrator"}>Sign Language Detection</Link></Button>
          </CardFooter>
        </Card>
      </main>
    </>
  );
}
