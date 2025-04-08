"use client";

import { useState, useRef, useEffect } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";

export default function MapVideoForm() {
  const [coords, setCoords] = useState({ lat: "", lng: "" });
  const [locationName, setLocationName] = useState(""); // New Field
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const ffmpegRef = useRef<FFmpeg>(new FFmpeg());
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const latitude = parseFloat(coords.lat);
    const longitude = parseFloat(coords.lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      alert("Please enter valid latitude and longitude values.");
      setLoading(false);
      return;
    }

    try {
      const ffmpeg = ffmpegRef.current;
      if (!ffmpeg.loaded) {
        await ffmpeg.load();
      }

      const frameRate = 10;
      const totalFrames = 120;
      const minZoom = 5;
      const maxZoom = 20;

      const images = await fetchMapImagesForLocation(
        latitude,
        longitude,
        minZoom,
        maxZoom,
        totalFrames
      );

      for (let i = 0; i < images.length; i++) {
        const response = await fetch(images[i].url);
        if (!response.ok)
          throw new Error(`Tile fetch failed: ${images[i].url}`);
        const imageBlob = await response.blob();
        await ffmpeg.writeFile(
          `frame${i}.png`,
          new Uint8Array(await imageBlob.arrayBuffer())
        );
      }

      await ffmpeg.exec([
        "-framerate",
        frameRate.toString(),
        "-i",
        "frame%d.png",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-vf",
        "scale=640:640",
        "main.mp4",
      ]);
      const musicUrl = "/api/music";

      const musicResponse = await fetch(musicUrl);
      const musicBlob = await musicResponse.blob();
      await ffmpeg.writeFile(
        "bgmusic.mp3",
        new Uint8Array(await musicBlob.arrayBuffer())
      );

      await ffmpeg.exec([
        "-i",
        "main.mp4",
        "-i",
        "bgmusic.mp3",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-shortest",
        "final_with_music.mp4",
      ]);

      const finalData = await ffmpeg.readFile("final_with_music.mp4");
      const finalBlob = new Blob([finalData], { type: "video/mp4" });
      const finalUrl = URL.createObjectURL(finalBlob);
      setVideoUrl(finalUrl);
    } catch (error) {
      console.error("Error generating video:", error);
      alert("Video generation failed. Please check the console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-4">
        <input
          type="text"
          placeholder="Location Name"
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
          className="w-full p-2 border rounded"
        />

        <div className="flex gap-4">
          <input
            type="number"
            step="any"
            placeholder="Latitude"
            value={coords.lat}
            onChange={(e) => setCoords({ ...coords, lat: e.target.value })}
            className="flex-1 p-2 border rounded"
            required
          />
          <input
            type="number"
            step="any"
            placeholder="Longitude"
            value={coords.lng}
            onChange={(e) => setCoords({ ...coords, lng: e.target.value })}
            className="flex-1 p-2 border rounded"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {loading ? "Generating Video..." : "Generate Video with Music"}
        </button>
      </form>

      {videoUrl && (
        <div className="mt-8 text-center">
          <h2 className="text-xl font-semibold mb-2">
            {locationName || "Map Video"}
          </h2>
          <video
            ref={videoRef}
            width="640"
            height="640"
            controls
            autoPlay
            className="mx-auto"
          >
            <source src={videoUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          <small className="block mt-2 text-gray-600">
            Map data © OpenStreetMap contributors
          </small>
        </div>
      )}
    </div>
  );
}

async function fetchMapImagesForLocation(
  latitude: number,
  longitude: number,
  minZoom: number,
  maxZoom: number,
  totalFrames: number
) {
  const images: { url: string; zoomLevel: number }[] = [];
  const zoomRange = maxZoom - minZoom;
  const accessToken =
    "pk.eyJ1IjoidmFuYWdyb3czNDQ1IiwiYSI6ImNtOThlMTFyZTAxejAya3NlbGRoaHFxOWQifQ.0KYHnJMDy2KXRUkA0CaOlQ"; // replace with your token
  const style = "mapbox/streets-v11"; // or try: satellite-streets-v12, dark-v10 etc.

  for (let i = 0; i < totalFrames; i++) {
    const progress = i / totalFrames;
    const currentZoom = minZoom + zoomRange * progress;
    const roundedZoom = Math.round(currentZoom * 100) / 100; // smooth zoom

    const url = `https://api.mapbox.com/styles/v1/${style}/static/${longitude},${latitude},${roundedZoom},0/640x640?access_token=${accessToken}`;
    images.push({ url, zoomLevel: roundedZoom });
  }

  return images;
}
